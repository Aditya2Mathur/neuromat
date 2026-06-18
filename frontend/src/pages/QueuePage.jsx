import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Queue, Clock, CheckCircle, ArrowClockwise } from '@phosphor-icons/react'
import { format } from 'date-fns'

const STATUS_MAP = {
  waiting:     { label: 'Waiting',     color: '#92400e', bg: 'rgba(217,119,6,0.1)' },
  with_doctor: { label: 'With Doctor', color: '#065f46', bg: 'rgba(5,150,105,0.1)' },
  completed:   { label: 'Prescribed',  color: '#134e4a', bg: 'rgba(8,145,178,0.1)' },
  dispensing:  { label: 'At Pharmacy', color: '#312e81', bg: 'rgba(79,70,229,0.1)' },
  done:        { label: 'Done',        color: '#475569', bg: 'rgba(100,116,139,0.1)' },
}

export default function QueuePage() {
  const [queue,   setQueue]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('active')

  useEffect(() => {
    fetchQueue()
    const sub = supabase.channel('queue-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, fetchQueue)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  const fetchQueue = async () => {
    setLoading(true)
    const today = format(new Date(), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('queue')
      .select('*, patients(*), doctors(*), prescriptions(*)')
      .eq('visit_date', today)
      .order('token_number', { ascending: true })
    setQueue(data || [])
    setLoading(false)
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

                  {entry.status === 'done' && (
                    <CheckCircle size={22} color="#10b981" weight="fill" style={{ flexShrink: 0 }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
