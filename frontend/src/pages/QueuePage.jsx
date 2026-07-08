import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { Queue, Clock, CheckCircle, ArrowClockwise, NotePencil, X, Spinner, WhatsappLogo } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const STATUS_MAP = {
  waiting:     { label: 'Waiting',     color: '#92400e', bg: 'rgba(217,119,6,0.1)' },
  with_doctor: { label: 'With Doctor', color: '#065f46', bg: 'rgba(5,150,105,0.1)' },
  completed:   { label: 'Prescribed',  color: '#134e4a', bg: 'rgba(8,145,178,0.1)' },
  dispensing:  { label: 'At Pharmacy', color: '#312e81', bg: 'rgba(79,70,229,0.1)' },
  done:        { label: 'Done',        color: '#475569', bg: 'rgba(100,116,139,0.1)' },
}

export default function QueuePage() {
  const { user } = useAuth()
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [queue,   setQueue]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('active')

  /* Edit patient details states */
  const [showEditModal, setShowEditModal] = useState(false)
  const [editPatient, setEditPatient] = useState(null)
  const [editQueueItem, setEditQueueItem] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '', age: '', gender: '', weight: '', address: '', fee: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchQueue()
    const sub = supabase.channel('queue-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, fetchQueue)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [startDate, endDate])

  const fetchQueue = async () => {
    setLoading(true)
    try {
      const startDateISO = new Date(`${startDate}T00:00:00`).toISOString()
      const endDateISO = new Date(`${endDate}T23:59:59`).toISOString()
      const { data } = await supabase
        .from('queue')
        .select('*, patients(*), doctors(*), prescriptions(*)')
        .gte('created_at', startDateISO)
        .lte('created_at', endDateISO)
        .order('token_number', { ascending: true })
      setQueue(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const openEditModal = (entry) => {
    setEditPatient(entry.patients)
    setEditQueueItem(entry)
    setEditForm({
      name: entry.patients.name,
      phone: entry.patients.phone,
      age: entry.patients.age || '',
      gender: entry.patients.gender || '',
      weight: entry.patients.weight || '',
      address: entry.patients.address || '',
      fee: entry.fee !== undefined && entry.fee !== null ? entry.fee.toString() : '0',
    })
    setShowEditModal(true)
  }

  const handleSavePatient = async (e) => {
    e.preventDefault()
    if (!editForm.name.trim()) return toast.error('Patient name is required')
    if (!editForm.phone.trim()) return toast.error('Phone number is required')
    setSaving(true)
    try {
      const { error: patientError } = await supabase
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

      if (patientError) throw patientError

      if (editQueueItem) {
        const parsedFee = editForm.fee !== '' ? parseInt(editForm.fee) : 0
        if (isNaN(parsedFee)) {
          throw new Error('Fee must be a valid number')
        }
        const { error: queueError } = await supabase
          .from('queue')
          .update({
            fee: parsedFee,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editQueueItem.id)

        if (queueError) throw queueError
      }
      
      toast.success('Patient details and fee updated successfully!')
      setShowEditModal(false)
      setEditQueueItem(null)
      fetchQueue()
    } catch (err) {
      toast.error(err.message || 'Failed to update patient details')
    } finally {
      setSaving(false)
    }
  }

  const handleSendWhatsApp = (entry) => {
    if (!entry.patients) return
    const phone = entry.patients.phone?.replace(/\D/g, '')
    const dateStr = format(new Date(entry.created_at), 'dd MMM yyyy')
    const feeStr = entry.fee === 0 ? 'Free' : `₹${entry.fee || 0}`
    const msg = encodeURIComponent(
      `*🧠 NEUROMAT CLINIC — TOKEN CONFIRMATION*\n\n` +
      `Hello *${entry.patients.name}*,\n\n` +
      `✅ Your registration has been completed successfully.\n\n` +
      `🎫 *Token Number:* ${entry.token_number} ${entry.prescription_id ? '(Follow-up)' : ''}\n` +
      `👨‍⚕️ *Doctor:* ${entry.doctors?.name || 'Assigned Doctor'}\n` +
      `💰 *Consultation Fee:* ${feeStr}\n` +
      `📅 *Date:* ${dateStr}\n\n` +
      `Please wait for your turn. Thank you for choosing *Neuromat Clinic*. 🙏\n\n` +
      `⭐ *We'd love to hear your feedback!*\n` +
      `Please share your experience by leaving us a Google Review:\n` +
      `📍 GMB Review: https://g.page/r/CaaDBhjIN5VQEBM/review\n\n` +
      `📲 Stay connected with us for health tips, updates, and clinic announcements:\n\n` +
      `📸 Instagram: https://www.instagram.com/neuromat_2026?igsh=ZjJ4bmE3b2VzajFq\n\n` +
      `📘 Facebook: https://www.facebook.com/share/1P583NUYby/\n\n` +
      `🙏 Thank you for trusting *Neuromat Clinic*. We wish you good health!`
    )
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
  }

  const filtered = queue.filter(q => {
    if (filter === 'active') return ['waiting', 'with_doctor', 'completed', 'dispensing'].includes(q.status)
    if (filter === 'done')   return q.status === 'done'
    return true
  })

  const counts = {
    waiting:     queue.filter(q => q.status === 'waiting').length,
    with_doctor: queue.filter(q => q.status === 'with_doctor').length,
    done:        queue.filter(q => q.status === 'done').length,
  }

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
            {startDate === endDate && startDate === format(new Date(), 'yyyy-MM-dd') ? "Today's Queue" : "Queue Records"}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
            {startDate === endDate ? format(new Date(`${startDate}T00:00:00`), 'EEEE, MMMM d, yyyy') : `${format(new Date(`${startDate}T00:00:00`), 'dd MMM yyyy')} - ${format(new Date(`${endDate}T00:00:00`), 'dd MMM yyyy')}`} · {queue.length} total patients
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Date range inputs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div 
              onClick={(e) => {
                const input = e.currentTarget.querySelector('input[type="date"]')
                if (input && typeof input.showPicker === 'function') input.showPicker()
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', padding: '6px 14px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>From</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  outline: 'none',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              />
            </div>
            <div 
              onClick={(e) => {
                const input = e.currentTarget.querySelector('input[type="date"]')
                if (input && typeof input.showPicker === 'function') input.showPicker()
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', padding: '6px 14px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  outline: 'none',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              />
            </div>
          </div>
          <button id="refresh-queue-btn" onClick={fetchQueue} className="btn btn-sm btn-secondary">
            <ArrowClockwise size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary stat chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[
          { label: 'Waiting',     value: counts.waiting,     color: '#d97706', bg: 'rgba(217,119,6,0.08)' },
          { label: 'With Doctor', value: counts.with_doctor, color: '#059669', bg: 'rgba(5,150,105,0.08)' },
          { label: 'Completed',   value: counts.done,        color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
        ].map(s => (
          <div
            key={s.label}
            style={{
              borderRadius: 14, padding: '18px 20px',
              background: s.bg, border: `1px solid ${s.color}22`,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 32, fontWeight: 700, color: s.color, lineHeight: 1, letterSpacing: '-1px' }}>
              {s.value}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, fontWeight: 500 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { id: 'active', label: 'Active' },
          { id: 'done',   label: 'Done' },
          { id: 'all',    label: 'All Patients' },
        ].map(f => (
          <button
            key={f.id}
            id={`filter-${f.id}`}
            onClick={() => setFilter(f.id)}
            className={`btn btn-sm ${filter === f.id ? 'btn-primary' : 'btn-secondary'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Queue items */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 14 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Queue size={44} className="empty-state-icon" />
            <p className="empty-state-title">No patients in this category</p>
            <p className="empty-state-text">Try switching the filter above</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(entry => {
            const s = STATUS_MAP[entry.status] || STATUS_MAP.waiting
            return (
              <div key={entry.id} className="card" style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {/* Token circle */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: 'rgba(99,102,241,0.12)', color: 'var(--primary-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 16,
                  }}>
                    {entry.token_number}
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {entry.patients?.name}
                      </span>
                      {entry.prescription_id && (
                        <span className="badge badge-success" style={{ fontSize: 10, padding: '2px 8px' }}>Follow-up</span>
                      )}
                      <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4, fontSize: 12.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      <span>{entry.patients?.phone}</span>
                      <span>→ {entry.doctors?.name}</span>
                      <span style={{ fontWeight: 600, color: entry.fee === 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
                        Fee: {entry.fee === 0 ? 'Free' : `₹${entry.fee || 0}`}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={11} />
                        {format(new Date(entry.created_at), 'hh:mm a')}
                      </span>
                    </div>
                  </div>

                  {['admin', 'reception'].includes(user?.role) && entry.patients && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        id={`whatsapp-queue-patient-${entry.id}`}
                        onClick={() => handleSendWhatsApp(entry)}
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#25D366', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        title="Send WhatsApp Token"
                      >
                        <WhatsappLogo size={15} weight="fill" />
                        <span>WhatsApp</span>
                      </button>
                      <button
                        id={`edit-queue-patient-${entry.id}`}
                        onClick={() => openEditModal(entry)}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        title="Edit Patient & Fee"
                      >
                        <NotePencil size={15} />
                        <span>Edit</span>
                      </button>
                    </div>
                  )}
                  {entry.status === 'done' && (
                    <CheckCircle size={22} color="#10b981" weight="fill" style={{ flexShrink: 0 }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit Patient Modal */}
      {showEditModal && editPatient && createPortal(
        <div className="modal-overlay" onClick={() => { setShowEditModal(false); setEditQueueItem(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22, paddingBottom: 18, borderBottom: '1px solid var(--border)' }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Edit Patient Details</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>Update registration details</p>
              </div>
              <button onClick={() => { setShowEditModal(false); setEditQueueItem(null); }} className="btn btn-icon btn-secondary btn-sm"><X size={14} /></button>
            </div>

            <form onSubmit={handleSavePatient} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Full Name *</label>
                <input
                  id="queue-edit-name"
                  type="text"
                  className="input"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Phone Number *</label>
                <input
                  id="queue-edit-phone"
                  type="tel"
                  className="input"
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  maxLength={15}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Age</label>
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
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Gender</label>
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
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  value={editForm.weight}
                  onChange={e => setEditForm(f => ({ ...f, weight: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Registration Fee (₹) *</label>
                <input
                  id="queue-edit-fee"
                  type="number"
                  className="input"
                  value={editForm.fee}
                  onChange={e => setEditForm(f => ({ ...f, fee: e.target.value }))}
                  min={0}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Address</label>
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
                  onClick={() => { setShowEditModal(false); setEditQueueItem(null); }}
                >
                  Cancel
                </button>
                <button
                  id="queue-save-patient-changes-btn"
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary"
                  style={{ minWidth: 120 }}
                >
                  {saving ? <Spinner size={14} className="animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
