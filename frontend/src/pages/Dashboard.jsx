import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  Users, Queue, Pill, Stethoscope, CheckCircle, Warning,
  ArrowUp, Heartbeat, TrendUp, ArrowRight, NotePencil, WhatsappLogo,
  CurrencyInr
} from '@phosphor-icons/react'
import { format } from 'date-fns'

const STATUS_STYLE = {
  waiting:    { color: '#92400e', bg: 'rgba(217,119,6,0.1)',    label: 'Waiting' },
  with_doctor:{ color: '#065f46', bg: 'rgba(5,150,105,0.1)',   label: 'With Doctor' },
  completed:  { color: '#134e4a', bg: 'rgba(8,145,178,0.1)',   label: 'Prescribed' },
  dispensing: { color: '#312e81', bg: 'rgba(79,70,229,0.1)',   label: 'Dispensing' },
  done:       { color: '#475569', bg: 'rgba(100,116,139,0.1)', label: 'Done' },
}

export default function Dashboard({ onNavigate, onSelectQueueItem }) {
  const { user } = useAuth()
  const [period, setPeriod] = useState('daily') // 'daily', 'weekly', 'monthly'
  const [stats, setStats] = useState({
    todayPatients: 0, pendingQueue: 0, doctors: 0,
    medicines: 0, lowStock: 0, completedToday: 0,
    moneyCollected: 0,
  })
  const [recentQueue, setRecentQueue] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStats() }, [period])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const today = new Date()
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      
      let startDate = startOfToday
      if (period === 'weekly') {
        startDate = new Date(startOfToday)
        startDate.setDate(startOfToday.getDate() - 6)
      } else if (period === 'monthly') {
        startDate = new Date(startOfToday)
        startDate.setDate(startOfToday.getDate() - 29)
      }
      
      const startDateISO = startDate.toISOString()

      const [queueRes, doctorsRes, medRes, lowStockRes] = await Promise.all([
        supabase.from('queue')
          .select('*, patients(*), doctors(*), prescriptions(*)')
          .gte('created_at', startDateISO)
          .order('created_at', { ascending: false }),
        supabase.from('doctors').select('id').eq('is_active', true),
        supabase.from('medicines').select('id').eq('is_active', true),
        supabase.from('medicines').select('id').lt('stock_quantity', 10).gt('stock_quantity', -1).eq('is_active', true),
      ])

      const queue = queueRes.data || []
      const docId = user?.doctor_id || user?.doctor?.id
      const doctorFees = queue
        .filter(item => item.doctor_id === docId)
        .reduce((sum, item) => sum + (item.fee || 0), 0)
      const totalFees = queue.reduce((sum, item) => sum + (item.fee || 0), 0)

      setStats({
        todayPatients:  queue.length,
        pendingQueue:   queue.filter(q => ['waiting','with_doctor'].includes(q.status)).length,
        doctors:        doctorsRes.data?.length || 0,
        medicines:      medRes.data?.length || 0,
        lowStock:       lowStockRes.data?.length || 0,
        completedToday: queue.filter(q => q.status === 'done').length,
        moneyCollected: user?.role === 'doctor' ? doctorFees : totalFees,
      })
      setRecentQueue(queue.slice(0, 15))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const handleSendWhatsApp = (entry) => {
    if (!entry.patients) return
    const phone = entry.patients.phone?.replace(/\D/g, '')
    const dateStr = format(new Date(entry.created_at), 'dd MMM yyyy')
    const feeStr = entry.fee === 0 ? 'Free' : `₹${entry.fee || 0}`
    const msg = encodeURIComponent(
      `*NEUROMAT CLINIC — TOKEN CONFIRMATION*\n\n` +
      `Hello *${entry.patients.name}*,\n` +
      `You have been registered successfully!\n\n` +
      `🎫 *Token Number:* ${entry.token_number} ${entry.prescription_id ? '(Follow-up)' : ''}\n` +
      `👨‍⚕️ *Doctor:* ${entry.doctors?.name || 'Assigned Doctor'}\n` +
      `💵 *Fee:* ${feeStr}\n` +
      `📅 *Date:* ${dateStr}\n\n` +
      `Please wait for your turn. Thank you!`
    )
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
  }

  const STAT_CARDS = []
  
  if (['admin', 'reception', 'doctor'].includes(user?.role)) {
    STAT_CARDS.push({
      label: period === 'daily' ? "Daily Collection" : period === 'weekly' ? "Weekly Collection" : "Monthly Collection",
      value: `₹${stats.moneyCollected.toLocaleString('en-IN')}`,
      icon: CurrencyInr,
      color: '#10b981', // green
    })
  }

  STAT_CARDS.push(
    { 
      label: period === 'daily' ? "Today's Patients" : period === 'weekly' ? "Weekly Patients" : "Monthly Patients", 
      value: stats.todayPatients, 
      icon: Users,        
      color: '#6366f1', 
      trend: period === 'daily' 
    },
    { 
      label: period === 'daily' ? 'Pending Queue' : period === 'weekly' ? 'Weekly Pending' : 'Monthly Pending',    
      value: stats.pendingQueue,  
      icon: Queue,        
      color: '#f59e0b' 
    }
  )

  if (user?.role === 'admin') {
    STAT_CARDS.push(
      { label: 'Active Doctors',   value: stats.doctors,       icon: Stethoscope,  color: '#10b981' },
      { label: 'Medicines',        value: stats.medicines,     icon: Pill,         color: '#06b6d4' },
      { label: 'Low Stock Items',  value: stats.lowStock,      icon: Warning,      color: '#ef4444', alert: stats.lowStock > 0 }
    )
  }

  STAT_CARDS.push({ 
    label: period === 'daily' ? 'Completed Today' : period === 'weekly' ? 'Weekly Completed' : 'Monthly Completed',  
    value: stats.completedToday,
    icon: CheckCircle,  
    color: '#8b5cf6' 
  })

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 16 }} />)}
      </div>
      <div className="skeleton" style={{ height: 400, borderRadius: 16 }} />
    </div>
  )

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'},{' '}
            <span className="gradient-text">{user?.name?.split(' ')[0]}</span>
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>
            {format(new Date(), 'EEEE, MMMM d, yyyy')} · Here's what's happening {period === 'daily' ? 'today' : period === 'weekly' ? 'this week' : 'this month'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Period filter segmented control */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
            {['daily', 'weekly', 'monthly'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  border: 'none',
                  background: period === p ? 'var(--primary)' : 'transparent',
                  color: period === p ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {p}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <Heartbeat size={15} color="#ef4444" weight="fill" />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Live</span>
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
        {STAT_CARDS.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className="stat-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} color={s.color} weight="fill" />
                </div>
                {s.alert && <span className="badge badge-danger">Alert</span>}
                {s.trend && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: '#10b981', fontWeight: 600 }}>
                    <ArrowUp size={11} /> Live
                  </div>
                )}
              </div>
              <div style={{ fontSize: 34, fontWeight: 700, color: s.alert ? 'var(--danger)' : 'var(--text-primary)', lineHeight: 1, letterSpacing: '-1px' }}>
                {s.value}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
            </div>
          )
        })}
      </div>

      {/* Today's Queue table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-header">
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              {period === 'daily' ? "Today's Queue" : period === 'weekly' ? "Weekly Queue" : "Monthly Queue"}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {period === 'daily' ? "Live patient status updates" : `Recent updates for the last ${period === 'weekly' ? '7' : '30'} days`}
            </p>
          </div>
          <button onClick={fetchStats} className="btn btn-sm btn-secondary">Refresh</button>
        </div>

        {recentQueue.length === 0 ? (
          <div className="empty-state">
            <Queue size={40} className="empty-state-icon" />
            <p className="empty-state-title">
              {period === 'daily' ? "No patients in queue today" : `No patients in queue for this ${period === 'weekly' ? 'week' : 'month'}`}
            </p>
            <p className="empty-state-text">Patients registered by reception will appear here</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Status</th>
                  {['admin', 'reception'].includes(user?.role) && <th>Fee</th>}
                  <th>Time</th>
                  {user?.role === 'doctor' && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {recentQueue.map(q => {
                  const s = STATUS_STYLE[q.status] || STATUS_STYLE.waiting
                  const isDoctor = user?.role === 'doctor'
                  const isMyPatient = q.doctor_id === user?.doctor_id || q.doctor_id === user?.doctor?.id
                  const canCall = q.status === 'waiting' && isDoctor && isMyPatient
                  const canPrescribe = q.status === 'with_doctor' && isDoctor && isMyPatient

                  return (
                    <tr key={q.id}>
                      <td>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.12)', color: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                          {q.token_number}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{q.patients?.name}</div>
                          {q.prescription_id && (
                            <span className="badge badge-success" style={{ fontSize: 10, padding: '1px 6px' }}>Follow-up</span>
                          )}
                          {['admin', 'reception'].includes(user?.role) && q.patients && (
                            <button
                              onClick={() => handleSendWhatsApp(q)}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', color: '#25D366' }}
                              title="Send WhatsApp Token"
                            >
                              <WhatsappLogo size={14} weight="fill" />
                            </button>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{q.patients?.phone}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{q.doctors?.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{q.doctors?.specialty}</div>
                      </td>
                      <td>
                        <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                      </td>
                      {['admin', 'reception'].includes(user?.role) && (
                        <td style={{ fontSize: 13, fontWeight: 600, color: q.fee === 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
                          {q.fee === 0 ? 'Free' : `₹${q.fee || 0}`}
                        </td>
                      )}
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {period === 'daily' 
                          ? format(new Date(q.created_at), 'hh:mm a')
                          : format(new Date(q.created_at), 'dd MMM, hh:mm a')}
                      </td>
                      {isDoctor && (
                        <td>
                          {canCall && (
                            <button
                              onClick={() => {
                                onSelectQueueItem(q)
                                onNavigate('queue')
                              }}
                              className="btn btn-primary btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            >
                              <ArrowRight size={13} weight="bold" />
                              Call Patient
                            </button>
                          )}
                          {canPrescribe && (
                            <button
                              onClick={() => {
                                onSelectQueueItem(q)
                                onNavigate('queue')
                              }}
                              className="btn btn-success btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            >
                              <NotePencil size={13} weight="bold" />
                              Write Rx
                            </button>
                          )}
                          {!canCall && !canPrescribe && (
                            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
