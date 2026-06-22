import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Users, Phone, MagnifyingGlass, Calendar, Stethoscope, X, NotePencil, Spinner } from '@phosphor-icons/react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function Patients() {
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [patientHistory, setPatientHistory] = useState([])

  /* Edit patient details states */
  const [showEditModal, setShowEditModal] = useState(false)
  const [editPatient, setEditPatient] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '', age: '', gender: '', weight: '', address: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchPatients() }, [])

  const fetchPatients = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('patients')
      .select('*')
      .order('updated_at', { ascending: false })
    setPatients(data || [])
    setLoading(false)
  }

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.phone.includes(search)
  )

  const viewPatient = async (patient) => {
    setSelected(patient)
    const { data } = await supabase
      .from('queue')
      .select('*, doctors(*), prescriptions(*, prescription_items(*))')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })
      .limit(10)
    setPatientHistory(data || [])
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
      fetchPatients()
    } catch (err) {
      toast.error(err.message || 'Failed to update patient details')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Patients</h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
          {patients.length} registered patients
        </p>
      </div>

      <div className="input-group">
        <span className="input-icon"><MagnifyingGlass size={16} /></span>
        <input
          type="text"
          className="input"
          placeholder="Search by name or phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 10 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Users size={40} className="empty-state-icon" />
            <p className="empty-state-title">No patients found</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Phone</th>
                <th>Age/Gender</th>
                <th>Last Visit</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--primary-light)' }}>
                        {p.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</div>
                        {p.address && <div className="text-xs truncate max-w-xs" style={{ color: 'var(--text-muted)' }}>{p.address}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="text-sm flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <Phone size={12} /> {p.phone}
                    </div>
                  </td>
                  <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {[p.age && `${p.age}y`, p.gender].filter(Boolean).join(' • ') || '—'}
                  </td>
                  <td className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {format(new Date(p.updated_at), 'dd MMM yyyy')}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => viewPatient(p)}
                        className="btn btn-sm btn-secondary"
                      >
                        History
                      </button>
                      <button
                        id={`edit-patient-${p.id}`}
                        onClick={() => openEditModal(p)}
                        className="btn btn-sm btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <NotePencil size={13} /> Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Patient History Modal */}
      {selected && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22, paddingBottom: 18, borderBottom: '1px solid var(--border)' }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{selected.name}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
                  {selected.phone} · {selected.age && `${selected.age}y`} {selected.gender}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="btn btn-icon btn-secondary btn-sm"><X size={14} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {patientHistory.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-state-text">No visit history found</p>
                </div>
              ) : patientHistory.map(visit => (
                <div key={visit.id} className="rounded-xl p-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} color="#6366f1" />
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {format(new Date(visit.created_at), 'dd MMM yyyy, hh:mm a')}
                      </span>
                    </div>
                    <span className="badge badge-secondary">Token #{visit.token_number}</span>
                  </div>
                  <div className="text-xs flex items-center gap-1.5 mb-2" style={{ color: 'var(--text-muted)' }}>
                    <Stethoscope size={12} /> {visit.doctors?.name} ({visit.doctors?.specialty})
                  </div>
                  {visit.prescriptions && (
                    <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                        Diagnosis: <span style={{ color: 'var(--text-secondary)' }}>{visit.prescriptions.diagnosis || '—'}</span>
                      </p>
                      {visit.prescriptions.prescription_items?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {visit.prescriptions.prescription_items.map(item => (
                            <span key={item.id} className="tag">{item.medicine_name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
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
                  id="edit-name-input"
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
                  id="edit-phone-input"
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
                  id="save-patient-changes-btn"
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
