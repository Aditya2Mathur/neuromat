import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Users, Phone, MagnifyingGlass, Calendar, Stethoscope, X } from '@phosphor-icons/react'
import { format } from 'date-fns'

export default function Patients() {
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [patientHistory, setPatientHistory] = useState([])

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
                    <button
                      onClick={() => viewPatient(p)}
                      className="btn btn-sm btn-secondary"
                    >
                      View History
                    </button>
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
    </div>
  )
}
