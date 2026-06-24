import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Queue, Clock, CheckCircle, ArrowClockwise, NotePencil, X, Spinner } from '@phosphor-icons/react'
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
  const [queue,   setQueue]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('active')

  /* Edit patient details states */
  const [showEditModal, setShowEditModal] = useState(false)
  const [editPatient, setEditPatient] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '', age: '', gender: '', weight: '', address: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchQueue()
    const sub = supabase.channel('queue-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, fetchQueue)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  const fetchQueue = async () => {
    setLoading(true)
    const today = new Date()
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const startOfTodayISO = startOfToday.toISOString()
    const { data } = await supabase
      .from('queue')
      .select('*, patients(*), doctors(*), prescriptions(*)')
      .gte('created_at', startOfTodayISO)
      .order('token_number', { ascending: true })
    setQueue(data || [])
    setLoading(false)
  }

  const openEditModal = (p) => {
    setEditPatient(p)
    setEditForm({
      name: p.name,
      phone: p.phone,
      age: p.age || '',
      gender: p.gender || '',
      weight: p.weight || '',
      address: p.address || '',
    })
    setShowEditModal(true)
  }

  const handleSavePatient = async (e) => {
    e.preventDefault()
    if (!editForm.name.trim()) return toast.error('Patient name is required')
    if (!editForm.phone.trim()) return toast.error('Phone number is required')
    setSaving(true)
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
      setShowEditModal(false)
      fetchQueue()
    } catch (err) {
      toast.error(err.message || 'Failed to update patient details')
    } finally {
      setSaving(false)
    }
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
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Today's Queue</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
            {format(new Date(), 'EEEE, MMMM d, yyyy')} · {queue.length} total patients
          </p>
        </div>
        <button id="refresh-queue-btn" onClick={fetchQueue} className="btn btn-sm btn-secondary">
          <ArrowClockwise size={14} /> Refresh
        </button>
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
                      <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4, fontSize: 12.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      <span>{entry.patients?.phone}</span>
                      <span>→ {entry.doctors?.name}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={11} />
                        {format(new Date(entry.created_at), 'hh:mm a')}
                      </span>
                    </div>
                  </div>

                  {['admin', 'reception'].includes(user?.role) && entry.patients && (
                    <button
                      id={`edit-queue-patient-${entry.id}`}
                      onClick={() => openEditModal(entry.patients)}
                      className="btn btn-icon btn-secondary btn-sm"
                      style={{ flexShrink: 0, padding: 6 }}
                      title="Edit Patient"
                    >
                      <NotePencil size={15} />
                    </button>
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
      {showEditModal && editPatient && (
        <div className="modal-overlay">
          <div className="modal">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22, paddingBottom: 18, borderBottom: '1px solid var(--border)' }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Edit Patient Details</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>Update registration details</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="btn btn-icon btn-secondary btn-sm"><X size={14} /></button>
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
                  onClick={() => setShowEditModal(false)}
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
        </div>
      )}
    </div>
  )
}
