import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { FirstAid, Calendar, Stethoscope, MagnifyingGlass, Printer } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'

export default function Prescriptions() {
  const { user } = useAuth()
  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => { fetchPrescriptions() }, [])

  const fetchPrescriptions = async () => {
    setLoading(true)
    let query = supabase
      .from('prescriptions')
      .select('*, patients(*), doctors(*), prescription_items(*)')
      .order('created_at', { ascending: false })
      .limit(50)

    if (user?.role === 'doctor') {
      const doctorId = user.doctor_id || user.doctor?.id
      if (doctorId) query = query.eq('doctor_id', doctorId)
    }

    const { data } = await query
    setPrescriptions(data || [])
    setLoading(false)
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

      <div className="input-group">
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
                    <button
                      onClick={() => setSelected(rx)}
                      className="btn btn-sm btn-secondary"
                    >View</button>
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
              <button onClick={() => setSelected(null)} className="btn btn-sm btn-secondary btn-icon">✕</button>
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
                <div>{selected.diagnosis || '—'}</div>
                {selected.notes && (
                  <div className="mt-2">
                    <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>NOTES</div>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{selected.notes}</div>
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
    </div>
  )
}
