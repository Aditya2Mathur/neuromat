import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { FirstAid, Calendar, Stethoscope, MagnifyingGlass, Printer, NotePencil, Plus, Trash, Pill, Spinner, Check } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const FREQ_OPTIONS = [
  'Once daily', 'Twice daily', 'Thrice daily',
  'Four times daily', 'As needed', 'At bedtime', 'Every 8 hours',
]

export default function Prescriptions() {
  const { user } = useAuth()
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return format(d, 'yyyy-MM-dd')
  })
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  /* Edit state */
  const [editing, setEditing] = useState(null)
  const [editDiagnosis, setEditDiagnosis] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editOtherInstruction, setEditOtherInstruction] = useState('')
  const [editItems, setEditItems] = useState([])
  const [medicines, setMedicines] = useState([])
  const [medSuggestions, setMedSuggestions] = useState(null) // {idx, list}
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchMedicines()
  }, [])

  useEffect(() => {
    fetchPrescriptions()
  }, [startDate, endDate])

  const fetchMedicines = async () => {
    const { data } = await supabase.from('medicines').select('*')
      .eq('is_active', true).gt('stock_quantity', 0).order('name')
    setMedicines(data || [])
  }

  const startEdit = (rx) => {
    setEditing(rx)
    setEditDiagnosis(rx.diagnosis || '')
    setEditNotes(rx.notes || '')
    setEditOtherInstruction(rx.other_instruction || '')
    setEditItems((rx.prescription_items || []).map(item => ({
      medicine_id: item.medicine_id || '',
      medicine_name: item.medicine_name || '',
      dosage: item.dosage || '',
      frequency: item.frequency || '',
      duration: item.duration || '',
      quantity: item.quantity || 1,
      instructions: item.instructions || '',
    })))
    setMedSuggestions(null)
  }

  const addEditMedItem = () => {
    setEditItems(items => [
      ...items,
      {
        medicine_id: '',
        medicine_name: '',
        dosage: '',
        frequency: '',
        duration: '',
        quantity: 1,
        instructions: '',
      }
    ])
  }

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

  const updateEditItem = (idx, field, val) => {
    setEditItems(items =>
      items.map((item, i) => {
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
    )
  }

  const removeEditItem = (idx) => {
    setEditItems(items => items.filter((_, i) => i !== idx))
  }

  const onEditMedInput = (val, idx) => {
    updateEditItem(idx, 'medicine_name', val)
    if (val.length >= 2) {
      const hits = medicines
        .filter(m => m.name.toLowerCase().includes(val.toLowerCase()))
        .slice(0, 8)
      setMedSuggestions({ idx, list: hits })
    } else {
      setMedSuggestions(null)
    }
  }

  const pickEditMedicine = (med, idx) => {
    updateEditItem(idx, 'medicine_id', med.id)
    updateEditItem(idx, 'medicine_name', med.name)
    setMedSuggestions(null)
  }

  const savePrescription = async () => {
    if (!editDiagnosis)
      return toast.error('Diagnosis is required')
    if (editItems.length === 0)
      return toast.error('Add at least one medicine')
    if (editItems.some(i => !i.medicine_name))
      return toast.error('All medicines need names')

    setSaving(true)
    try {
      const { error: rxError } = await supabase
        .from('prescriptions')
        .update({
          diagnosis: editDiagnosis,
          notes: editNotes,
          other_instruction: editOtherInstruction || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editing.id)
      if (rxError) throw rxError

      const { error: delError } = await supabase
        .from('prescription_items')
        .delete()
        .eq('prescription_id', editing.id)
      if (delError) throw delError

      const { error: insError } = await supabase
        .from('prescription_items')
        .insert(
          editItems.map(item => ({
            prescription_id: editing.id,
            medicine_id: item.medicine_id || null,
            medicine_name: item.medicine_name,
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
            quantity: item.quantity || 1,
            instructions: item.instructions,
          }))
        )
      if (insError) throw insError

      toast.success('✅ Prescription updated successfully!')
      setEditing(null)
      fetchPrescriptions()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const fetchPrescriptions = async () => {
    setLoading(true)
    try {
      const startDateISO = new Date(`${startDate}T00:00:00`).toISOString()
      const endDateISO = new Date(`${endDate}T23:59:59`).toISOString()
      
      let query = supabase
        .from('prescriptions')
        .select('*, patients(*), doctors(*), prescription_items(*)')
        .gte('created_at', startDateISO)
        .lte('created_at', endDateISO)
        .order('created_at', { ascending: false })

      if (user?.role === 'doctor') {
        const doctorId = user.doctor_id || user.doctor?.id
        if (doctorId) query = query.eq('doctor_id', doctorId)
      }

      const { data } = await query
      setPrescriptions(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const filtered = prescriptions.filter(p =>
    p.patients?.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.diagnosis || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Prescriptions</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {prescriptions.length} total records
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="input-group" style={{ flex: 1, minWidth: 260 }}>
          <MagnifyingGlass size={16} className="input-icon" />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: '40px' }}
            placeholder="Search by patient name or diagnosis..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Date range inputs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div 
            onClick={(e) => {
              const input = e.currentTarget.querySelector('input[type="date"]')
              if (input && typeof input.showPicker === 'function') input.showPicker()
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border)', cursor: 'pointer' }}
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
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border)', cursor: 'pointer' }}
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
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <FirstAid size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>No prescriptions found</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Diagnosis</th>
                <th>Medicines</th>
                <th>Date</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(rx => (
                <tr key={rx.id}>
                  <td>
                    <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{rx.patients?.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{rx.patients?.phone}</div>
                  </td>
                  <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {rx.doctors?.name}
                  </td>
                  <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {rx.diagnosis || '—'}
                  </td>
                  <td>
                    <span className="badge badge-info">{rx.prescription_items?.length || 0} items</span>
                  </td>
                  <td className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {format(new Date(rx.created_at), 'dd MMM, hh:mm a')}
                  </td>
                  <td>
                    <span className={`badge ${rx.status === 'dispensed' ? 'badge-success' : rx.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                      {rx.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {user?.role === 'doctor' && rx.status === 'pending' && (
                        <button
                          onClick={() => startEdit(rx)}
                          className="btn btn-sm btn-secondary"
                          style={{ gap: 6 }}
                        >
                          <NotePencil size={14} />
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => setSelected(rx)}
                        className="btn btn-sm btn-secondary"
                      >View</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Prescription Detail</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {user?.role === 'doctor' && selected.status === 'pending' && (
                  <button
                    onClick={() => {
                      const rxToEdit = selected
                      setSelected(null)
                      startEdit(rxToEdit)
                    }}
                    className="btn btn-sm btn-primary"
                    style={{ gap: 6 }}
                  >
                    <NotePencil size={14} />
                    Edit
                  </button>
                )}
                <button onClick={() => setSelected(null)} className="btn btn-sm btn-secondary btn-icon">✕</button>
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-elevated)' }}>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Patient</div>
                  <div className="font-semibold mt-0.5">{selected.patients?.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{selected.patients?.phone}</div>
                </div>
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-elevated)' }}>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Doctor</div>
                  <div className="font-semibold mt-0.5">{selected.doctors?.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{selected.doctors?.specialty}</div>
                </div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-elevated)' }}>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>DIAGNOSIS</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{selected.diagnosis || '—'}</div>
                {selected.notes && (
                  <div className="mt-2">
                    <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>NOTES</div>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{selected.notes}</div>
                  </div>
                )}
                {selected.other_instruction && (
                  <div className="mt-2">
                    <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>OTHER INSTRUCTION</div>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{selected.other_instruction}</div>
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>MEDICINES</div>
                <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th>Dosage</th>
                        <th>Frequency</th>
                        <th>Duration</th>
                        <th>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.prescription_items?.map(item => (
                        <tr key={item.id}>
                          <td className="font-medium">{item.medicine_name}</td>
                          <td>{item.dosage || '—'}</td>
                          <td>{item.frequency || '—'}</td>
                          <td>{item.duration || '—'}</td>
                          <td>{item.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Edit Prescription</h3>
              <button onClick={() => setEditing(null)} className="btn btn-sm btn-secondary btn-icon">✕</button>
            </div>
            
            <div style={{ maxHeight: 'calc(80vh - 120px)', overflowY: 'auto', paddingRight: '8px' }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-elevated)' }}>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Patient</div>
                  <div className="font-semibold mt-0.5">{editing.patients?.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{editing.patients?.phone}</div>
                </div>
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-elevated)' }}>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Doctor</div>
                  <div className="font-semibold mt-0.5">{editing.doctors?.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{editing.doctors?.specialty}</div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Diagnosis *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Acute Headache..."
                  value={editDiagnosis}
                  onChange={e => setEditDiagnosis(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Clinical Notes & Instructions</label>
                <textarea
                  className="input"
                  placeholder="Additional observations, instructions..."
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  style={{ minHeight: 80 }}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Other Instruction (Optional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Any other special instructions..."
                  value={editOtherInstruction}
                  onChange={e => setEditOtherInstruction(e.target.value)}
                />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>MEDICINES</div>
                  <button
                    onClick={addEditMedItem}
                    className="btn btn-primary btn-sm"
                    style={{ gap: 6 }}
                  >
                    <Plus size={14} weight="bold" /> Add Medicine
                  </button>
                </div>

                <div className="space-y-3">
                  {editItems.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'rgba(99,102,241,0.04)',
                        borderBottom: '1px solid var(--border)',
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                          Medicine #{idx + 1}
                        </span>
                        <button
                          onClick={() => removeEditItem(idx)}
                          className="btn btn-icon btn-danger btn-sm"
                          style={{ width: 28, height: 28, padding: 0 }}
                        >
                          <Trash size={13} />
                        </button>
                      </div>

                      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ position: 'relative' }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Medicine Name *</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="Search medicine from inventory…"
                            value={item.medicine_name}
                            onChange={e => onEditMedInput(e.target.value, idx)}
                            onBlur={() => setTimeout(() => setMedSuggestions(null), 200)}
                          />
                          {medSuggestions?.idx === idx && medSuggestions.list.length > 0 && (
                            <div style={{
                              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border)',
                              borderRadius: 8,
                              boxShadow: 'var(--shadow-lg)',
                              zIndex: 1200,
                              overflow: 'hidden',
                            }}>
                              {medSuggestions.list.map(med => (
                                <button
                                  key={med.id}
                                  type="button"
                                  onMouseDown={() => pickEditMedicine(med, idx)}
                                  style={{
                                    width: '100%', textAlign: 'left',
                                    padding: '8px 12px',
                                    background: 'transparent', border: 'none',
                                    borderBottom: '1px solid var(--border)',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    gap: 12,
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.06)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                  <div>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                      {med.name}
                                    </span>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                                      {med.category}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--success)' }}>
                                    Stock: {med.stock_quantity}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr 70px', gap: 10 }}>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Dosage</label>
                            <input type="text" className="input" placeholder="500mg"
                              value={item.dosage}
                              onChange={e => updateEditItem(idx, 'dosage', e.target.value)} />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Frequency</label>
                            <select className="input" value={item.frequency}
                              onChange={e => updateEditItem(idx, 'frequency', e.target.value)}>
                              <option value="">Select…</option>
                              {FREQ_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Duration</label>
                            <input type="text" className="input" placeholder="5 days"
                              value={item.duration}
                              onChange={e => updateEditItem(idx, 'duration', e.target.value)} />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Qty</label>
                            <input type="number" className="input" min="1"
                              value={item.quantity}
                              onChange={e => updateEditItem(idx, 'quantity', parseInt(e.target.value) || 1)} />
                          </div>
                        </div>

                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Instructions</label>
                          <input type="text" className="input" placeholder="Take after meals"
                            value={item.instructions}
                            onChange={e => updateEditItem(idx, 'instructions', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setEditing(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={savePrescription}
                  disabled={saving}
                  className="btn btn-primary"
                  style={{ minWidth: 140 }}
                >
                  {saving ? (
                    <><Spinner size={16} className="animate-spin" /> Saving…</>
                  ) : (
                    <><Check size={16} weight="bold" /> Save Changes</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
