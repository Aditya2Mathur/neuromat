require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { createClient } = require('@supabase/supabase-js')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const app = express()
const PORT = process.env.PORT || 3001

// Supabase admin client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Middleware
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }))
app.use(express.json())

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), service: 'Neuromat Backend' })
})

// Auth middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  try {
    const { data: staff, error } = await supabase
      .from('staff')
      .select('*, doctors(*)')
      .eq('email', email.toLowerCase().trim())
      .eq('is_active', true)
      .single()

    if (error || !staff) return res.status(401).json({ error: 'Invalid credentials' })

    // Check password (plain comparison for demo, or bcrypt)
    let isValid = false
    if (staff.password_hash?.startsWith('$2')) {
      isValid = await bcrypt.compare(password, staff.password_hash)
    } else {
      isValid = staff.password_hash === password
    }

    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' })

    const token = jwt.sign(
      { id: staff.id, role: staff.role, name: staff.name, doctor_id: staff.doctor_id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    )

    res.json({
      token,
      user: {
        id: staff.id, name: staff.name, email: staff.email,
        role: staff.role, doctor: staff.doctors, doctor_id: staff.doctor_id,
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/queue/today
app.get('/api/queue/today', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    let query = supabase
      .from('queue')
      .select('*, patients(*), doctors(*), prescriptions(*, prescription_items(*))')
      .eq('visit_date', today)
      .order('token_number', { ascending: true })

    if (req.user.role === 'doctor' && req.user.doctor_id) {
      query = query.eq('doctor_id', req.user.doctor_id)
    }

    const { data, error } = await query
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/prescriptions
app.post('/api/prescriptions', authMiddleware, async (req, res) => {
  if (req.user.role !== 'doctor') return res.status(403).json({ error: 'Doctors only' })
  const { queue_id, patient_id, doctor_id, diagnosis, notes, items } = req.body

  try {
    const { data: rx, error } = await supabase.from('prescriptions').insert({
      patient_id, doctor_id, diagnosis, notes,
      status: 'pending',
      visit_date: new Date().toISOString(),
      expiry_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    }).select().single()

    if (error) throw error

    if (items?.length) {
      await supabase.from('prescription_items').insert(
        items.map(i => ({ prescription_id: rx.id, ...i }))
      )
    }

    await supabase.from('queue').update({
      status: 'completed',
      prescription_id: rx.id,
      updated_at: new Date().toISOString(),
    }).eq('id', queue_id)

    res.json(rx)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/dispense/:prescription_id
app.post('/api/dispense/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'medical_store') return res.status(403).json({ error: 'Medical Store only' })
  const { id } = req.params
  const { queue_id } = req.body

  try {
    // Get prescription items
    const { data: items } = await supabase
      .from('prescription_items')
      .select('*')
      .eq('prescription_id', id)

    // Update stock for each medicine
    for (const item of items || []) {
      if (item.medicine_id) {
        const { data: med } = await supabase.from('medicines').select('stock_quantity').eq('id', item.medicine_id).single()
        if (med) {
          await supabase.from('medicines').update({
            stock_quantity: Math.max(0, med.stock_quantity - (item.quantity || 1)),
            updated_at: new Date().toISOString()
          }).eq('id', item.medicine_id)
        }
      }
    }

    await supabase.from('prescriptions').update({ status: 'dispensed' }).eq('id', id)
    if (queue_id) {
      await supabase.from('queue').update({ status: 'done', updated_at: new Date().toISOString() }).eq('id', queue_id)
    }

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/stats
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const [queueRes, docRes, medRes] = await Promise.all([
      supabase.from('queue').select('status').eq('visit_date', today),
      supabase.from('doctors').select('id').eq('is_active', true),
      supabase.from('medicines').select('id, stock_quantity, low_stock_threshold').eq('is_active', true),
    ])

    const queue = queueRes.data || []
    const meds = medRes.data || []

    res.json({
      todayPatients: queue.length,
      waiting: queue.filter(q => q.status === 'waiting').length,
      withDoctor: queue.filter(q => q.status === 'with_doctor').length,
      completed: queue.filter(q => q.status === 'done').length,
      doctors: docRes.data?.length || 0,
      medicines: meds.length,
      lowStock: meds.filter(m => m.stock_quantity <= (m.low_stock_threshold || 10)).length,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`\n🏥 Neuromat Backend running on http://localhost:${PORT}`)
  console.log(`📊 Health: http://localhost:${PORT}/api/health\n`)
})
