import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  Queue, ArrowLeft, ArrowRight, Check, Stethoscope,
  Plus, Trash, Pill, Spinner, User, Clock, FirstAid,
  NotePencil, Warning, Heart, Scales, X, CheckCircle,
} from '@phosphor-icons/react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

/* ── Status styles ────────────────────────────── */
const STATUS_MAP = {
  waiting:     { label: 'Waiting',     color: '#92400e', bg: 'rgba(217,119,6,0.1)' },
  with_doctor: { label: 'With Doctor', color: '#065f46', bg: 'rgba(5,150,105,0.1)' },
  completed:   { label: 'Prescribed',  color: '#134e4a', bg: 'rgba(8,145,178,0.1)' },
  dispensing:  { label: 'At Pharmacy', color: '#312e81', bg: 'rgba(79,70,229,0.1)' },
  done:        { label: 'Done',        color: '#475569', bg: 'rgba(100,116,139,0.1)' },
}

/* ── Frequency options ────────────────────────── */
const FREQ_OPTIONS = [
  'Once daily', 'Twice daily', 'Thrice daily',
  'Four times daily', 'As needed', 'At bedtime', 'Every 8 hours',
]

/* ════════════════════════════════════════════════ */
export default function DoctorQueue({ selectedQueueItem, clearSelectedQueueItem }) {
  const { user } = useAuth()

  /* Queue state */
  const [queue,        setQueue]       = useState([])
  const [loading,      setLoading]     = useState(true)
  const [filter,       setFilter]      = useState('active')

  /* Prescription workspace state */
  const [activeEntry,  setActiveEntry] = useState(null)   // patient being prescribed
  const [prescription, setPrescription] = useState({ diagnosis: '', notes: '', other_instruction: '', items: [] })
  const [submitting,   setSubmitting]  = useState(false)
  const [medSearch,    setMedSearch]   = useState('')
  const [medicines,    setMedicines]   = useState([])
  const [medSuggestions, setMedSuggestions] = useState(null) // {idx, list}

  /* Edit patient details states */
  const [showEditModal, setShowEditModal] = useState(false)
  const [editPatient, setEditPatient] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '', age: '', gender: '', weight: '', address: '' })
  const [savingPatient, setSavingPatient] = useState(false)

  /* Historical suggestions states */
  const [suggestionsDb, setSuggestionsDb] = useState({ diagnoses: [], notesLines: [], instructions: [], otherInstructions: [], pastMeds: {} })
  const [diagnosisSuggestions, setDiagnosisSuggestions] = useState(null)
  const [notesSuggestions, setNotesSuggestions] = useState(null)
  const [instSuggestions, setInstSuggestions] = useState(null)
  const [otherInstSuggestions, setOtherInstSuggestions] = useState(null)

  /* ── Data fetching ──────────────────────────── */
  useEffect(() => {
    fetchQueue()
  }, [filter])

  useEffect(() => {
    fetchMedicines()
    fetchSuggestionsDb()
    const sub = supabase.channel('dq-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, fetchQueue)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [filter])

  const fetchQueue = async () => {
    setLoading(true)
    try {
      const today = new Date()
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const startOfTodayISO = startOfToday.toISOString()

      const statuses = filter === 'dispensed'
        ? ['dispensing', 'done']
        : ['waiting', 'with_doctor', 'completed']
      let q = supabase.from('queue')
        .select('*, patients(*), doctors(*), prescriptions(*)')
        .gte('created_at', startOfTodayISO)
        .in('status', statuses)
        .order('token_number', { ascending: true })
      if (user?.role === 'doctor' && user?.doctor_id)
        q = q.eq('doctor_id', user.doctor_id)
      else if (user?.role === 'doctor' && user?.doctor?.id)
        q = q.eq('doctor_id', user.doctor.id)
      const { data } = await q
      setQueue(data || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const fetchMedicines = async () => {
    const { data } = await supabase.from('medicines').select('*')
      .eq('is_active', true).gt('stock_quantity', 0).order('name')
    setMedicines(data || [])
  }

  const fetchSuggestionsDb = async () => {
    try {
      const { data: rxData } = await supabase
        .from('prescriptions')
        .select('diagnosis, notes, other_instruction')
        .order('created_at', { ascending: false })
        .limit(1000)

      const { data: itemData } = await supabase
        .from('prescription_items')
        .select('medicine_name, dosage, frequency, duration, instructions')
        .order('id', { ascending: false })
        .limit(2000)

      const diagnoses = new Set()
      const notesLines = new Set()
      const instructions = new Set()
      const otherInstructions = new Set()
      const pastMedsMap = {}

      rxData?.forEach(r => {
        if (r.diagnosis?.trim()) diagnoses.add(r.diagnosis.trim())
        if (r.notes) {
          r.notes.split('\n').forEach(line => {
            const trimmed = line.trim()
            if (trimmed.length >= 2) notesLines.add(trimmed)
          })
        }
        if (r.other_instruction?.trim()) {
          otherInstructions.add(r.other_instruction.trim())
        }
      })

      itemData?.forEach(item => {
        if (item.instructions?.trim()) instructions.add(item.instructions.trim())
        if (item.medicine_name?.trim()) {
          const medKey = item.medicine_name.trim().toLowerCase()
          if (!pastMedsMap[medKey]) {
            pastMedsMap[medKey] = []
          }
          const exists = pastMedsMap[medKey].some(
            x => x.dosage === item.dosage &&
                 x.frequency === item.frequency &&
                 x.duration === item.duration &&
                 x.instructions === item.instructions
          )
          if (!exists) {
            pastMedsMap[medKey].push({
              dosage: item.dosage || '',
              frequency: item.frequency || '',
              duration: item.duration || '',
              instructions: item.instructions || ''
            })
          }
        }
      })

      setSuggestionsDb({
        diagnoses: Array.from(diagnoses),
        notesLines: Array.from(notesLines),
        instructions: Array.from(instructions),
        otherInstructions: Array.from(otherInstructions),
        pastMeds: pastMedsMap
      })
    } catch (err) {
      console.error('Error loading suggestions db:', err)
    }
  }

  const handleSavePatient = async (e) => {
    e.preventDefault()
    if (!editForm.name.trim()) return toast.error('Patient name is required')
    if (!editForm.phone.trim()) return toast.error('Phone number is required')

    setSavingPatient(true)
    try {
      const { data, error } = await supabase
        .from('patients')
        .update({
          name: editForm.name.trim(),
          phone: editForm.phone.trim(),
          age: editForm.age ? parseInt(editForm.age) : null,
          gender: editForm.gender || null,
          weight: editForm.weight ? parseFloat(editForm.weight) : null,
          address: editForm.address || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editPatient.id)
        .select()
        .single()

      if (error) throw error

      toast.success('Patient details updated successfully!')
      setActiveEntry(prev => ({
        ...prev,
        patients: data
      }))
      setQueue(prev => prev.map(entry => {
        if (entry.patient_id === data.id) {
          return { ...entry, patients: data }
        }
        return entry
      }))
      setShowEditModal(false)
    } catch (err) {
      toast.error(err.message || 'Failed to update patient details')
    } finally {
      setSavingPatient(false)
    }
  }

  const handleNotesChange = (e) => {
    const val = e.target.value
    const selectionStart = e.target.selectionStart
    setPrescription(p => ({ ...p, notes: val }))

    const beforeCaret = val.slice(0, selectionStart)
    const linesBefore = beforeCaret.split('\n')
    const activeLine = linesBefore[linesBefore.length - 1] || ''

    if (activeLine.trim().length >= 2) {
      const query = activeLine.trim().toLowerCase()
      const matches = suggestionsDb.notesLines
        .filter(line => line.toLowerCase().includes(query))
        .slice(0, 8)
      setNotesSuggestions({ matches, selectionStart })
    } else {
      setNotesSuggestions(null)
    }
  }

  const selectNotesSuggestion = (suggestionText) => {
    if (!notesSuggestions) return
    const val = prescription.notes
    const pos = notesSuggestions.selectionStart

    const beforeCaret = val.slice(0, pos)
    const afterCaret = val.slice(pos)

    const linesBefore = beforeCaret.split('\n')
    linesBefore[linesBefore.length - 1] = suggestionText

    const newBeforeCaret = linesBefore.join('\n')
    const newValue = newBeforeCaret + afterCaret

    setPrescription(p => ({ ...p, notes: newValue }))
    setNotesSuggestions(null)

    setTimeout(() => {
      const textarea = document.getElementById('notes-textarea')
      if (textarea) {
        textarea.focus()
        const newPos = newBeforeCaret.length
        textarea.setSelectionRange(newPos, newPos)
      }
    }, 50)
  }

  const onInstInput = (val, idx) => {
    updateItem(idx, 'instructions', val)
    if (val.trim().length >= 2) {
      const query = val.trim().toLowerCase()
      const matches = suggestionsDb.instructions
        .filter(ins => ins.toLowerCase().includes(query))
        .slice(0, 8)
      setInstSuggestions({ idx, list: matches })
    } else {
      setInstSuggestions(null)
    }
  }

  const handleOtherInstChange = (e) => {
    const val = e.target.value
    setPrescription(p => ({ ...p, other_instruction: val }))
    if (val.trim().length >= 2) {
      const query = val.trim().toLowerCase()
      const matches = (suggestionsDb.otherInstructions || [])
        .filter(ins => ins.toLowerCase().includes(query))
        .slice(0, 8)
      setOtherInstSuggestions(matches)
    } else {
      setOtherInstSuggestions(null)
    }
  }

  /* ── Open prescription workspace ─────────────── */
  const openPrescribe = async (entry) => {
    // If waiting → call patient (status update)
    if (entry.status === 'waiting') {
      await supabase.from('queue')
        .update({ status: 'with_doctor', updated_at: new Date().toISOString() })
        .eq('id', entry.id)
      fetchQueue()
    }
    setActiveEntry(entry)
    
    // Check if it's a follow-up (prescription_id is present on entry)
    if (entry.prescription_id) {
      try {
        // Fetch prescription items
        const { data: items, error } = await supabase
          .from('prescription_items')
          .select('*')
          .eq('prescription_id', entry.prescription_id)
        
        if (error) {
          console.error('Failed to load previous prescription items:', error)
          setPrescription({ diagnosis: '', notes: '', other_instruction: '', items: [] })
        } else {
          setPrescription({
            // Note: We DO NOT set prescription.id here so that it submits as a NEW prescription
            diagnosis: entry.prescriptions?.diagnosis || '',
            notes: entry.prescriptions?.notes || '',
            other_instruction: entry.prescriptions?.other_instruction || '',
            items: (items || []).map(item => ({
              medicine_id: item.medicine_id || '',
              medicine_name: item.medicine_name || '',
              dosage: item.dosage || '',
              frequency: item.frequency || '',
              duration: item.duration || '',
              quantity: item.quantity || 1,
              instructions: item.instructions || '',
            }))
          })
          toast.success('Follow-up patient: Previous prescription details loaded!')
        }
      } catch (err) {
        console.error('Error fetching follow-up details:', err)
        setPrescription({ diagnosis: '', notes: '', other_instruction: '', items: [] })
      }
    } else {
      setPrescription({ diagnosis: '', notes: '', other_instruction: '', items: [] })
    }
    
    setMedSuggestions(null)
    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    if (selectedQueueItem && !loading) {
      const found = queue.find(item => item.id === selectedQueueItem.id)
      openPrescribe(found || selectedQueueItem)
      clearSelectedQueueItem()
    }
  }, [selectedQueueItem, queue, loading])

  const startEditPrescription = async (entry) => {
    setActiveEntry(entry)
    // Fetch prescription items
    const { data: items, error } = await supabase
      .from('prescription_items')
      .select('*')
      .eq('prescription_id', entry.prescription_id)
    
    if (error) {
      toast.error('Failed to load prescription items: ' + error.message)
      return
    }

    setPrescription({
      id: entry.prescription_id,
      diagnosis: entry.prescriptions?.diagnosis || '',
      notes: entry.prescriptions?.notes || '',
      other_instruction: entry.prescriptions?.other_instruction || '',
      items: items || []
    })
    setMedSuggestions(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const closePrescribe = () => {
    setActiveEntry(null)
    setPrescription({ diagnosis: '', notes: '', other_instruction: '', items: [] })
    setMedSuggestions(null)
    setOtherInstSuggestions(null)
    fetchQueue()
  }

  /* ── Medicine item helpers ─────────────────── */
  const addMedItem = () =>
    setPrescription(p => ({
      ...p,
      items: [...p.items, {
        medicine_id: '', medicine_name: '', dosage: '',
        frequency: '', duration: '', quantity: 1, instructions: '',
      }],
    }))

  const parseFrequency = (freq) => {
    if (!freq) return 1
    const f = freq.toLowerCase().trim()
    if (f === 'once daily' || f === 'at bedtime' || f === 'as needed') return 1
    if (f === 'twice daily') return 2
    if (f === 'thrice daily') return 3
    if (f === 'four times daily') return 4
    if (f === 'every 8 hours') return 3
    if (f === 'every 12 hours') return 2
    if (f === 'every 6 hours') return 4
    
    // Pattern check like 1-0-1 or 1-1-1
    const patternMatch = f.match(/^[0-9]+(-[0-9]+)+$/)
    if (patternMatch) {
      const parts = f.split('-').map(Number)
      const sum = parts.reduce((a, b) => a + b, 0)
      return sum > 0 ? sum : 1
    }
    
    // Single number check
    const num = parseInt(f)
    if (!isNaN(num) && num > 0) return num
    
    return 1
  }

  const parseDurationDays = (dur) => {
    if (!dur) return 1
    const d = dur.toLowerCase().trim()
    const numMatch = d.match(/^([0-9\.]+)/)
    if (!numMatch) return 1
    const val = parseFloat(numMatch[1])
    if (isNaN(val)) return 1
    
    if (d.includes('week')) {
      return Math.ceil(val * 7)
    }
    if (d.includes('month')) {
      return Math.ceil(val * 30)
    }
    return Math.ceil(val)
  }

  const updateItem = (idx, field, val) =>
    setPrescription(p => {
      const updated = p.items.map((item, i) => {
        if (i === idx) {
          const updatedItem = { ...item, [field]: val }
          if (field === 'frequency' || field === 'duration') {
            const freq = field === 'frequency' ? val : item.frequency
            const dur = field === 'duration' ? val : item.duration
            if (freq && dur) {
              const dailyCount = parseFrequency(freq)
              const days = parseDurationDays(dur)
              updatedItem.quantity = dailyCount * days
            }
          }
          return updatedItem
        }
        return item
      })
      return { ...p, items: updated }
    })

  const removeItem = (idx) =>
    setPrescription(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))

  const onMedInput = (val, idx) => {
    updateItem(idx, 'medicine_name', val)
    if (val.length >= 2) {
      const hits = medicines
        .filter(m => m.name.toLowerCase().includes(val.toLowerCase()))
        .slice(0, 8)
      setMedSuggestions({ idx, list: hits })
    } else {
      setMedSuggestions(null)
    }
  }

  const pickMedicine = (med, idx) => {
    updateItem(idx, 'medicine_id', med.id)
    updateItem(idx, 'medicine_name', med.name)
    setMedSuggestions(null)
  }

  /* ── Submit ────────────────────────────────── */
  const submitPrescription = async () => {
    setSubmitting(true)
    try {
      const doctorId = user?.doctor_id || user?.doctor?.id || activeEntry?.doctor_id
      let rxId = prescription.id

      // Filter out empty items
      const activeItems = (prescription.items || []).filter(item => item.medicine_name && item.medicine_name.trim())

      if (rxId) {
        // Edit flow
        const { error: rxError } = await supabase
          .from('prescriptions')
          .update({
            diagnosis:   prescription.diagnosis || null,
            notes:       prescription.notes || null,
            other_instruction: prescription.other_instruction || null,
            updated_at:  new Date().toISOString(),
          })
          .eq('id', rxId)
        if (rxError) throw rxError

        // Delete old items
        const { error: delError } = await supabase
          .from('prescription_items')
          .delete()
          .eq('prescription_id', rxId)
        if (delError) throw delError

        // Insert new items if there are any active items
        if (activeItems.length > 0) {
          const { error: insError } = await supabase.from('prescription_items').insert(
            activeItems.map(item => ({
              prescription_id: rxId,
              medicine_id:     item.medicine_id || null,
              medicine_name:   item.medicine_name.trim(),
              dosage:          item.dosage || null,
              frequency:       item.frequency || null,
              duration:        item.duration || null,
              quantity:        item.quantity || 1,
              instructions:    item.instructions || null,
            }))
          )
          if (insError) throw insError
        }

        toast.success('✅ Prescription updated successfully!')
      } else {
        // Create flow
        const { data: rx, error } = await supabase.from('prescriptions').insert({
          patient_id:  activeEntry.patient_id,
          doctor_id:   doctorId,
          diagnosis:   prescription.diagnosis || null,
          notes:       prescription.notes || null,
          other_instruction: prescription.other_instruction || null,
          status:      'pending',
          visit_date:  new Date().toISOString(),
          expiry_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        }).select().single()
        if (error) throw error
        rxId = rx.id

        if (activeItems.length > 0) {
          const { error: insError } = await supabase.from('prescription_items').insert(
            activeItems.map(item => ({
              prescription_id: rxId,
              medicine_id:     item.medicine_id || null,
              medicine_name:   item.medicine_name.trim(),
              dosage:          item.dosage || null,
              frequency:       item.frequency || null,
              duration:        item.duration || null,
              quantity:        item.quantity || 1,
              instructions:    item.instructions || null,
            }))
          )
          if (insError) throw insError
        }

        await supabase.from('queue').update({
          status: 'completed',
          prescription_id: rxId,
          updated_at: new Date().toISOString(),
        }).eq('id', activeEntry.id)

        toast.success('✅ Prescription sent to pharmacy!')
      }
      fetchSuggestionsDb()
      closePrescribe()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  /* ════════════════════════════ STYLE HELPERS ═══════ */
  const lbl = {
    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6, display: 'block',
  }
  const fld = { display: 'flex', flexDirection: 'column' }

  /* ══════════════════════════════════════════════════
   *  VIEW A — Queue List
   * ═════════════════════════════════════════════════ */
  if (!activeEntry) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
              {user?.role === 'doctor' ? 'My Patient Queue' : "Today's Queue"}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
              {format(new Date(), 'EEEE, MMMM d, yyyy')} · {queue.length} {filter === 'dispensed' ? 'dispensed' : 'active'} patient{queue.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={fetchQueue} className="btn btn-sm btn-secondary">Refresh</button>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            id="filter-active"
            onClick={() => setFilter('active')}
            className={`btn btn-sm ${filter === 'active' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Active Patients
          </button>
          <button
            id="filter-dispensed-rx"
            onClick={() => setFilter('dispensed')}
            className={`btn btn-sm ${filter === 'dispensed' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Dispensed Prescriptions
          </button>
        </div>

        {/* Queue cards */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 88, borderRadius: 16 }} />
            ))}
          </div>
        ) : queue.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <Queue size={48} className="empty-state-icon" />
              <p className="empty-state-title">No patients in queue</p>
              <p className="empty-state-text">All done for today — great work!</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {queue.map((entry, idx) => {
              const s = STATUS_MAP[entry.status] || STATUS_MAP.waiting
              const isNext = idx === 0 && entry.status === 'waiting'
              const canCall = entry.status === 'waiting' && user?.role === 'doctor'
              const canPrescribe = entry.status === 'with_doctor' && user?.role === 'doctor'
              const isDispensed = ['dispensing', 'done'].includes(entry.status)
              const canEdit = ['completed', 'dispensing', 'done'].includes(entry.status) && user?.role === 'doctor' && entry.prescription_id

              return (
                <div
                  key={entry.id}
                  className="card animate-fade-in"
                  style={{
                    padding: '18px 22px',
                    border: isNext ? '1.5px solid rgba(99,102,241,0.4)' : undefined,
                    background: isNext ? 'rgba(99,102,241,0.025)' : undefined,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>

                    {/* Token badge */}
                    <div style={{
                      width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                      background: isNext
                        ? 'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(139,92,246,0.15))'
                        : 'var(--bg-elevated)',
                      color: 'var(--primary-light)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 20, border: isNext ? '1px solid rgba(99,102,241,0.2)' : '1px solid var(--border)',
                    }}>
                      {entry.token_number}
                    </div>

                    {/* Patient info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {entry.patients?.name}
                        </span>
                        {isNext && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: '#fff',
                            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                            padding: '2px 8px', borderRadius: 20, letterSpacing: '0.5px',
                          }}>NEXT</span>
                        )}
                        <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                        {entry.prescription_id && (
                          <span className="badge badge-success">Follow-up</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                        <span>{entry.patients?.phone}</span>
                        {entry.patients?.age && <span>Age: {entry.patients.age}y</span>}
                        {entry.patients?.gender && <span>{entry.patients.gender}</span>}
                        {entry.patients?.weight && <span>{entry.patients.weight} kg</span>}
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Stethoscope size={12} /> {entry.doctors?.name}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} /> {format(new Date(entry.created_at), 'hh:mm a')}
                        </span>
                      </div>
                    </div>

                    {/* Action button */}
                    <div style={{ flexShrink: 0 }}>
                      {canCall && (
                        <button
                          id={`call-${entry.id}`}
                          onClick={() => openPrescribe(entry)}
                          className="btn btn-primary"
                          style={{ gap: 8 }}
                        >
                          <ArrowRight size={15} weight="bold" />
                          Call Patient
                        </button>
                      )}
                      {canPrescribe && (
                        <button
                          id={`prescribe-${entry.id}`}
                          onClick={() => openPrescribe(entry)}
                          className="btn btn-success"
                          style={{ gap: 8 }}
                        >
                          <NotePencil size={15} weight="bold" />
                          Write Prescription
                        </button>
                      )}
                      {canEdit && (
                        <button
                          id={`edit-rx-${entry.id}`}
                          onClick={() => startEditPrescription(entry)}
                          className={`btn btn-sm ${isDispensed ? 'btn-secondary' : 'btn-secondary'}`}
                          style={{ gap: 8 }}
                        >
                          <NotePencil size={15} weight="bold" />
                          {isDispensed ? 'View & Edit Rx' : 'Edit Prescription'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  /* ══════════════════════════════════════════════════
   *  VIEW B — Prescription Workspace (full inline)
   * ═════════════════════════════════════════════════ */
  const pat = activeEntry.patients || {}
  const doc = activeEntry.doctors  || {}

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 0 }} className="animate-fade-in">

      {/* ── Top bar ─────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, marginBottom: 24, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={closePrescribe}
            className="btn btn-secondary"
            style={{ gap: 8, padding: '9px 16px' }}
          >
            <ArrowLeft size={15} weight="bold" /> Back to Queue
          </button>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {prescription.id ? 'Edit Prescription' : 'Write Prescription'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              Token #{activeEntry.token_number} {activeEntry.prescription_id && !prescription.id && '(Follow-up)'} · {format(new Date(), 'dd MMM yyyy, hh:mm a')}
            </p>
          </div>
        </div>

        {/* Submit button at top for easy access */}
        <button
          onClick={submitPrescription}
          disabled={submitting}
          className="btn btn-primary btn-lg"
        >
          {submitting ? (
            <><Spinner size={17} className="animate-spin" /> {prescription.id ? 'Updating…' : 'Sending…'}</>
          ) : ['dispensing', 'done'].includes(activeEntry.status) ? (
            <><Check size={17} weight="bold" /> Update Prescription</>
          ) : (
            <><Check size={17} weight="bold" /> {prescription.id ? 'Update & Send' : 'Send to Pharmacy'}</>
          )}
        </button>
      </div>

      {/* Dispensed status notice */}
      {['dispensing', 'done'].includes(activeEntry.status) && (
        <div style={{
          marginBottom: 20, padding: '12px 18px', borderRadius: 12,
          background: activeEntry.status === 'done'
            ? 'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(6,182,212,0.04))'
            : 'rgba(99,102,241,0.07)',
          border: activeEntry.status === 'done'
            ? '1px solid rgba(5,150,105,0.28)'
            : '1px solid rgba(99,102,241,0.22)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Warning
            size={16}
            color={activeEntry.status === 'done' ? '#059669' : '#6366f1'}
            weight="fill"
            style={{ flexShrink: 0 }}
          />
          <p style={{ fontSize: 13, color: activeEntry.status === 'done' ? '#065f46' : '#4338ca', lineHeight: 1.5 }}>
            {activeEntry.status === 'done'
              ? <><strong>Already Dispensed.</strong> This prescription has been dispensed. You can still edit and save corrections.</>
              : <><strong>At Pharmacy.</strong> This prescription is being processed at the pharmacy. Your edits will update the record immediately.</>
            }
          </p>
        </div>
      )}

      {/* Follow-up pre-fill notice banner */}
      {activeEntry.prescription_id && !prescription.id && (
        <div style={{
          marginBottom: 20, padding: '12px 18px', borderRadius: 12,
          background: 'rgba(16,185,129,0.07)',
          border: '1px solid rgba(16,185,129,0.22)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <CheckCircle
            size={16}
            color="#10b981"
            weight="fill"
            style={{ flexShrink: 0 }}
          />
          <p style={{ fontSize: 13, color: '#065f46', lineHeight: 1.5 }}>
            <strong>Follow-up Visit.</strong> Previous prescription details (diagnosis, notes, and items) have been pre-filled for your convenience. You can modify or submit them as a new prescription.
          </p>
        </div>
      )}

      {/* ── Main 2-column layout ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ═══ LEFT — Patient Info Panel ══════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 20 }}>

          {/* Patient card */}
          <div className="card" style={{ overflow: 'hidden' }}>
            {/* Gradient header strip */}
            <div style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              padding: '20px 20px 40px',
              position: 'relative',
            }}>
              {/* Edit button */}
              <button
                type="button"
                onClick={() => {
                  setEditPatient(pat)
                  setEditForm({
                    name: pat.name || '',
                    phone: pat.phone || '',
                    age: pat.age || '',
                    gender: pat.gender || '',
                    weight: pat.weight || '',
                    address: pat.address || '',
                  })
                  setShowEditModal(true)
                }}
                style={{
                  position: 'absolute', top: 12, left: 14,
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#fff', padding: '5px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                title="Edit Patient Details"
              >
                <NotePencil size={14} weight="bold" />
              </button>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                border: '3px solid rgba(255,255,255,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, fontWeight: 800, color: '#fff',
                margin: '0 auto',
              }}>
                {pat.name?.charAt(0)?.toUpperCase()}
              </div>
              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{pat.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 3 }}>{pat.phone}</div>
              </div>
              {/* Token bubble */}
              <div style={{
                position: 'absolute', top: 12, right: 14,
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff', fontSize: 11, fontWeight: 700,
                padding: '3px 10px', borderRadius: 20,
              }}>
                Token #{activeEntry.token_number} {activeEntry.prescription_id && !prescription.id && '(Follow-up)'}
              </div>
            </div>

            {/* Stats grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              margin: '-20px 16px 0', position: 'relative',
              gap: 10, paddingBottom: 16,
            }}>
              {[
                { icon: User,   label: 'Age',    value: pat.age ? `${pat.age} yrs` : '—' },
                { icon: Heart,  label: 'Gender',  value: pat.gender || '—' },
                { icon: Scales, label: 'Weight',  value: pat.weight ? `${pat.weight} kg` : '—' },
                { icon: Stethoscope, label: 'Doctor', value: doc.name?.split(' ').slice(-1)[0] || '—' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '10px 12px', textAlign: 'center',
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  <div style={{ color: 'var(--primary)', marginBottom: 4, display: 'flex', justifyContent: 'center' }}>
                    <Icon size={15} weight="fill" />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Address */}
            {pat.address && (
              <div style={{ padding: '0 16px 16px' }}>
                <div style={{
                  fontSize: 12.5, color: 'var(--text-muted)', padding: '8px 12px',
                  background: 'var(--bg-surface)', borderRadius: 8,
                  border: '1px solid var(--border)', lineHeight: 1.5,
                }}>
                  📍 {pat.address}
                </div>
              </div>
            )}
          </div>

          {/* Doctor card */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
              Consulting Doctor
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: 'rgba(16,185,129,0.12)', color: 'var(--success)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 16,
              }}>
                {doc.name?.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{doc.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{doc.specialty}</div>
              </div>
            </div>
          </div>

          {/* Validity notice */}
          <div style={{
            padding: '12px 14px', borderRadius: 12,
            background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)',
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <Warning size={16} color="#d97706" weight="fill" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
              This prescription will be valid for <strong>5 days</strong> from today.
            </p>
          </div>
        </div>

        {/* ═══ RIGHT — Prescription Form ═══════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Clinical Notes & Instructions Card ── */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{
              padding: '16px 22px', borderBottom: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,0.12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FirstAid size={16} weight="fill" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Clinical Notes & Instructions</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Additional observations and follow-up instructions</div>
              </div>
            </div>

            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={fld}>
                <label style={lbl}>Clinical Notes & Instructions</label>
                <textarea
                  id="notes-textarea"
                  className="input"
                  placeholder="Additional observations, follow-up instructions, lifestyle advice…"
                  value={prescription.notes}
                  onChange={handleNotesChange}
                  onBlur={() => setTimeout(() => setNotesSuggestions(null), 200)}
                  style={{ resize: 'vertical', minHeight: 100, fontSize: 14 }}
                />
                
                {/* Notes historical line suggestions */}
                {notesSuggestions && notesSuggestions.matches.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }} className="animate-fade-in">
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center', fontWeight: 600 }}>Suggestions:</span>
                    {notesSuggestions.matches.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        className="tag"
                        style={{ cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseDown={() => selectNotesSuggestion(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={fld}>
                <label style={lbl}>Other Instruction (Optional)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Any other special instructions..."
                    value={prescription.other_instruction || ''}
                    onChange={handleOtherInstChange}
                    onBlur={() => setTimeout(() => setOtherInstSuggestions(null), 200)}
                    style={{ fontSize: 14 }}
                  />
                  {otherInstSuggestions && otherInstSuggestions.length > 0 && (
                    <div className="glass" style={{
                      position: 'absolute', top: '100%', marginTop: 4, left: 0, right: 0,
                      zIndex: 150, borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-lg)',
                    }}>
                      {otherInstSuggestions.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          style={{
                            width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: 14,
                            color: 'var(--text-primary)', borderBottom: '1px solid var(--border)',
                            background: 'var(--bg-card)', border: 'none', cursor: 'pointer', display: 'block',
                            fontFamily: 'inherit',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,70,229,0.06)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                          onMouseDown={() => {
                            setPrescription(p => ({ ...p, other_instruction: s }))
                            setOtherInstSuggestions(null)
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Diagnosis Card ── */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{
              padding: '16px 22px', borderBottom: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,0.12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Stethoscope size={16} weight="fill" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Diagnosis *</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Final clinical diagnosis</div>
              </div>
            </div>

            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ ...fld, position: 'relative' }}>
                <label style={lbl}>Diagnosis *</label>
                <input
                  id="diagnosis-input"
                  type="text"
                  className="input"
                  placeholder="e.g. Acute Headache, Upper Respiratory Tract Infection…"
                  value={prescription.diagnosis}
                  onChange={e => {
                    const val = e.target.value
                    setPrescription(p => ({ ...p, diagnosis: val }))
                    if (val.trim().length >= 2) {
                      const query = val.trim().toLowerCase()
                      const matches = suggestionsDb.diagnoses
                        .filter(d => d.toLowerCase().includes(query))
                        .slice(0, 8)
                      setDiagnosisSuggestions(matches)
                    } else {
                      setDiagnosisSuggestions(null)
                    }
                  }}
                  onBlur={() => setTimeout(() => setDiagnosisSuggestions(null), 200)}
                  style={{ fontSize: 14 }}
                />
                
                {/* Diagnosis suggestions dropdown */}
                {diagnosisSuggestions && diagnosisSuggestions.length > 0 && (
                  <div className="glass" style={{
                    position: 'absolute', top: '100%', marginTop: 4, left: 0, right: 0,
                    zIndex: 150, borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-lg)',
                  }}>
                    {diagnosisSuggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        style={{
                          width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: 14,
                          color: 'var(--text-primary)', borderBottom: '1px solid var(--border)',
                          background: 'var(--bg-card)', border: 'none', cursor: 'pointer', display: 'block',
                          fontFamily: 'inherit',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,70,229,0.06)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                        onMouseDown={() => {
                          setPrescription(p => ({ ...p, diagnosis: s }))
                          setDiagnosisSuggestions(null)
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Medicines card ── */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{
              padding: '16px 22px', borderBottom: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(16,185,129,0.12)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Pill size={16} weight="fill" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Medicines</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {prescription.items.length === 0 ? 'No medicines added' : `${prescription.items.length} medicine${prescription.items.length > 1 ? 's' : ''} added`}
                  </div>
                </div>
              </div>
              <button
                id="add-medicine-btn"
                onClick={addMedItem}
                className="btn btn-primary btn-sm"
              >
                <Plus size={14} weight="bold" /> Add Medicine
              </button>
            </div>

            <div style={{ padding: '16px 22px' }}>
              {prescription.items.length === 0 ? (
                /* Empty state */
                <div
                  onClick={addMedItem}
                  style={{
                    textAlign: 'center', padding: '36px 24px',
                    borderRadius: 14, border: '2px dashed var(--border)',
                    background: 'var(--bg-surface)',
                    cursor: 'pointer', transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'
                    e.currentTarget.style.background = 'rgba(99,102,241,0.03)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.background = 'var(--bg-surface)'
                  }}
                >
                  <Pill size={36} style={{ color: 'var(--text-muted)', opacity: 0.4, display: 'block', margin: '0 auto 10px' }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>Click to add a medicine</p>
                  <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, opacity: 0.7 }}>
                    Or use the "Add Medicine" button above
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {prescription.items.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 14,
                        overflow: 'hidden',
                        transition: 'border-color 0.18s',
                      }}
                    >
                      {/* Medicine card header */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: 'rgba(99,102,241,0.04)',
                        borderBottom: '1px solid var(--border)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: 8,
                            background: 'rgba(99,102,241,0.15)',
                            color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 800,
                          }}>
                            {idx + 1}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {item.medicine_name || `Medicine ${idx + 1}`}
                          </span>
                        </div>
                        <button
                          onClick={() => removeItem(idx)}
                          className="btn btn-icon btn-danger btn-sm"
                          style={{ width: 30, height: 30, padding: 0 }}
                          title="Remove medicine"
                        >
                          <Trash size={13} />
                        </button>
                      </div>

                      {/* Medicine fields */}
                      <div style={{ padding: '16px' }}>

                        {/* Medicine name with autocomplete */}
                        <div style={{ ...fld, marginBottom: 14, position: 'relative' }}>
                          <label style={lbl}>Medicine Name *</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="Search medicine from inventory…"
                            value={item.medicine_name}
                            onChange={e => onMedInput(e.target.value, idx)}
                            onBlur={() => setTimeout(() => setMedSuggestions(null), 200)}
                          />
                          {/* Autocomplete dropdown */}
                          {medSuggestions?.idx === idx && medSuggestions.list.length > 0 && (
                            <div style={{
                              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border)',
                              borderRadius: 12,
                              boxShadow: 'var(--shadow-lg)',
                              zIndex: 200,
                              overflow: 'hidden',
                            }}>
                              {medSuggestions.list.map(med => (
                                <button
                                  key={med.id}
                                  type="button"
                                  onMouseDown={() => pickMedicine(med, idx)}
                                  style={{
                                    width: '100%', textAlign: 'left',
                                    padding: '10px 16px',
                                    background: 'transparent', border: 'none',
                                    borderBottom: '1px solid var(--border)',
                                    cursor: 'pointer', fontFamily: 'inherit',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    gap: 12, transition: 'background 0.12s',
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.06)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                  <div>
                                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                                      {med.name}
                                    </span>
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                                      {med.category}
                                    </span>
                                  </div>
                                  <div style={{
                                    fontSize: 11, fontWeight: 600,
                                    color: med.stock_quantity <= 10 ? 'var(--danger)' : 'var(--success)',
                                    background: med.stock_quantity <= 10 ? 'rgba(220,38,38,0.08)' : 'rgba(5,150,105,0.08)',
                                    padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
                                  }}>
                                    Stock: {med.stock_quantity}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Dosage · Frequency · Duration · Qty */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr 80px', gap: 12, marginBottom: 12 }}>
                          <div style={fld}>
                            <label style={lbl}>Dosage</label>
                            <input type="text" className="input" placeholder="e.g. 500mg"
                              value={item.dosage}
                              onChange={e => updateItem(idx, 'dosage', e.target.value)} />
                          </div>
                          <div style={fld}>
                            <label style={lbl}>Frequency</label>
                            <select className="input" value={item.frequency}
                              onChange={e => updateItem(idx, 'frequency', e.target.value)}>
                              <option value="">Select…</option>
                              {FREQ_OPTIONS.map(f => <option key={f}>{f}</option>)}
                            </select>
                          </div>
                          <div style={fld}>
                            <label style={lbl}>Duration</label>
                            <input type="text" className="input" placeholder="e.g. 5 days"
                              value={item.duration}
                              onChange={e => updateItem(idx, 'duration', e.target.value)} />
                          </div>
                          <div style={fld}>
                            <label style={lbl}>Qty</label>
                            <input type="number" className="input" min="1"
                              value={item.quantity}
                              onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)} />
                          </div>
                        </div>

                        {/* Past medicine prescriptions suggestions */}
                        {item.medicine_name && suggestionsDb.pastMeds?.[item.medicine_name.trim().toLowerCase()]?.length > 0 && (
                          <div style={{ marginBottom: 14 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Suggested Combinations:
                            </span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                              {suggestionsDb.pastMeds[item.medicine_name.trim().toLowerCase()].slice(0, 4).map((sug, sIdx) => (
                                <button
                                  key={sIdx}
                                  type="button"
                                  onClick={() => {
                                    updateItem(idx, 'dosage', sug.dosage)
                                    updateItem(idx, 'frequency', sug.frequency)
                                    updateItem(idx, 'duration', sug.duration)
                                    updateItem(idx, 'instructions', sug.instructions)
                                    // Calculate quantity
                                    const dailyCount = parseFrequency(sug.frequency)
                                    const days = parseDurationDays(sug.duration)
                                    updateItem(idx, 'quantity', dailyCount * days)
                                  }}
                                  className="tag"
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    borderRadius: '8px',
                                    background: 'rgba(99,102,241,0.06)',
                                    border: '1px solid rgba(99,102,241,0.15)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    fontFamily: 'inherit',
                                    transition: 'all 0.15s'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.background = 'rgba(99,102,241,0.12)'
                                    e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.background = 'rgba(99,102,241,0.06)'
                                    e.currentTarget.style.borderColor = 'rgba(99,102,241,0.15)'
                                  }}
                                >
                                  {sug.dosage || 'No Dose'} · {sug.frequency || 'No Freq'} · {sug.duration || 'No Dur'} {sug.instructions ? `(${sug.instructions})` : ''}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Instructions */}
                        <div style={{ ...fld, position: 'relative' }}>
                          <label style={lbl}>Instructions</label>
                          <input type="text" className="input" placeholder="e.g. Take after meals with water"
                            value={item.instructions}
                            onChange={e => onInstInput(e.target.value, idx)}
                            onBlur={() => setTimeout(() => setInstSuggestions(null), 200)} />

                          {/* Instructions suggestions dropdown */}
                          {instSuggestions?.idx === idx && instSuggestions.list.length > 0 && (
                            <div className="glass" style={{
                              position: 'absolute', top: '100%', marginTop: 4, left: 0, right: 0,
                              zIndex: 150, borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-lg)',
                            }}>
                              {instSuggestions.list.map((s, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  style={{
                                    width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: 13,
                                    color: 'var(--text-primary)', borderBottom: '1px solid var(--border)',
                                    background: 'var(--bg-card)', border: 'none', cursor: 'pointer', display: 'block',
                                    fontFamily: 'inherit',
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,70,229,0.06)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                                  onMouseDown={() => {
                                    updateItem(idx, 'instructions', s)
                                    setInstSuggestions(null)
                                  }}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add another */}
                  <button
                    onClick={addMedItem}
                    style={{
                      width: '100%', padding: '12px',
                      borderRadius: 12, border: '2px dashed rgba(99,102,241,0.3)',
                      background: 'rgba(99,102,241,0.03)', color: 'var(--primary)',
                      fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      transition: 'all 0.18s', fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)'
                      e.currentTarget.style.background = 'rgba(99,102,241,0.07)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'
                      e.currentTarget.style.background = 'rgba(99,102,241,0.03)'
                    }}
                  >
                    <Plus size={15} weight="bold" /> Add Another Medicine
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Bottom action bar ── */}
          <div style={{
            display: 'flex', gap: 12,
            padding: '18px 22px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {prescription.items.length} medicine{prescription.items.length !== 1 ? 's' : ''} ·{' '}
              {['dispensing', 'done'].includes(activeEntry.status) ? 'Retrospective edit' : 'Ready to send'}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={closePrescribe} className="btn btn-secondary">
                <ArrowLeft size={14} /> Back to Queue
              </button>
              <button
                id="submit-prescription-btn"
                onClick={submitPrescription}
                disabled={submitting}
                className="btn btn-primary"
                style={{ minWidth: 180 }}
              >
                {submitting ? (
                  <><Spinner size={16} className="animate-spin" /> {prescription.id ? 'Updating…' : 'Sending…'}</>
                ) : ['dispensing', 'done'].includes(activeEntry.status) ? (
                  <><Check size={16} weight="bold" /> Update Prescription</>
                ) : (
                  <><Check size={16} weight="bold" /> {prescription.id ? 'Update & Send' : 'Send to Pharmacy'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Patient Profile Modal */}
      {showEditModal && editPatient && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Edit Patient Profile</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>Update active patient profile details</p>
              </div>
              <button
                type="button"
                className="btn btn-icon btn-secondary btn-sm"
                onClick={() => setShowEditModal(false)}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSavePatient} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Full Name *</label>
                <input
                  type="text"
                  className="input"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Phone Number *</label>
                <input
                  type="tel"
                  className="input"
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  maxLength={15}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Age</label>
                  <input
                    type="number"
                    className="input"
                    value={editForm.age}
                    onChange={e => setEditForm(f => ({ ...f, age: e.target.value }))}
                    min={0}
                    max={150}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Gender</label>
                  <select
                    className="input"
                    value={editForm.gender}
                    onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  value={editForm.weight}
                  onChange={e => setEditForm(f => ({ ...f, weight: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Address</label>
                <textarea
                  className="input"
                  value={editForm.address}
                  onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                  style={{ resize: 'none', height: 80 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPatient}
                  className="btn btn-primary"
                  style={{ minWidth: 120 }}
                >
                  {savingPatient ? (
                    <><Spinner size={14} className="animate-spin" /> Saving…</>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
