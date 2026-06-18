import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  Queue, ArrowLeft, ArrowRight, Check, Stethoscope,
  Plus, Trash, Pill, Spinner, User, Clock, FirstAid,
  NotePencil, Warning, Heart, Scales,
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
export default function DoctorQueue() {
  const { user } = useAuth()

  /* Queue state */
  const [queue,        setQueue]       = useState([])
  const [loading,      setLoading]     = useState(true)

  /* Prescription workspace state */
  const [activeEntry,  setActiveEntry] = useState(null)   // patient being prescribed
  const [prescription, setPrescription] = useState({ diagnosis: '', notes: '', items: [] })
  const [submitting,   setSubmitting]  = useState(false)
  const [medSearch,    setMedSearch]   = useState('')
  const [medicines,    setMedicines]   = useState([])
  const [medSuggestions, setMedSuggestions] = useState(null) // {idx, list}

  /* ── Data fetching ──────────────────────────── */
  useEffect(() => {
    fetchQueue()
    fetchMedicines()
    const sub = supabase.channel('dq-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, fetchQueue)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  const fetchQueue = async () => {
    setLoading(true)
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      let q = supabase.from('queue')
        .select('*, patients(*), doctors(*), prescriptions(*)')
        .eq('visit_date', today)
        .in('status', ['waiting', 'with_doctor', 'completed'])
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
    setPrescription({ diagnosis: '', notes: '', items: [] })
    setMedSuggestions(null)
    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const closePrescribe = () => {
    setActiveEntry(null)
    setPrescription({ diagnosis: '', notes: '', items: [] })
    setMedSuggestions(null)
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

  const updateItem = (idx, field, val) =>
    setPrescription(p => ({
      ...p,
      items: p.items.map((item, i) => i === idx ? { ...item, [field]: val } : item),
    }))

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
    if (!prescription.diagnosis)
      return toast.error('Diagnosis is required')
    if (prescription.items.length === 0)
      return toast.error('Add at least one medicine')
    if (prescription.items.some(i => !i.medicine_name))
      return toast.error('All medicines need names')

    setSubmitting(true)
    try {
      const doctorId = user?.doctor_id || user?.doctor?.id || activeEntry?.doctor_id
      const { data: rx, error } = await supabase.from('prescriptions').insert({
        patient_id:  activeEntry.patient_id,
        doctor_id:   doctorId,
        diagnosis:   prescription.diagnosis,
        notes:       prescription.notes,
        status:      'pending',
        visit_date:  new Date().toISOString(),
        expiry_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      }).select().single()
      if (error) throw error

      await supabase.from('prescription_items').insert(
        prescription.items.map(item => ({
          prescription_id: rx.id,
          medicine_id:     item.medicine_id || null,
          medicine_name:   item.medicine_name,
          dosage:          item.dosage,
          frequency:       item.frequency,
          duration:        item.duration,
          quantity:        item.quantity || 1,
          instructions:    item.instructions,
        }))
      )

      await supabase.from('queue').update({
        status: 'completed',
        prescription_id: rx.id,
        updated_at: new Date().toISOString(),
      }).eq('id', activeEntry.id)

      toast.success('✅ Prescription sent to pharmacy!')
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
              {format(new Date(), 'EEEE, MMMM d, yyyy')} · {queue.length} patients
            </p>
          </div>
          <button onClick={fetchQueue} className="btn btn-sm btn-secondary">Refresh</button>
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
              Write Prescription
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              Token #{activeEntry.token_number} · {format(new Date(), 'dd MMM yyyy, hh:mm a')}
            </p>
          </div>
        </div>

        {/* Submit button at top for easy access */}
        <button
          onClick={submitPrescription}
          disabled={submitting}
          className="btn btn-primary btn-lg"
        >
          {submitting
            ? <><Spinner size={17} className="animate-spin" /> Sending…</>
            : <><Check size={17} weight="bold" /> Send to Pharmacy</>
          }
        </button>
      </div>

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
                Token #{activeEntry.token_number}
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

          {/* ── Diagnosis + Notes card ── */}
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
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Clinical Information</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Diagnosis and clinical notes</div>
              </div>
            </div>

            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={fld}>
                <label style={lbl}>Diagnosis *</label>
                <input
                  id="diagnosis-input"
                  type="text"
                  className="input"
                  placeholder="e.g. Acute Headache, Upper Respiratory Tract Infection…"
                  value={prescription.diagnosis}
                  onChange={e => setPrescription(p => ({ ...p, diagnosis: e.target.value }))}
                  style={{ fontSize: 14 }}
                />
              </div>

              <div style={fld}>
                <label style={lbl}>Clinical Notes & Instructions</label>
                <textarea
                  className="input"
                  placeholder="Additional observations, follow-up instructions, lifestyle advice…"
                  value={prescription.notes}
                  onChange={e => setPrescription(p => ({ ...p, notes: e.target.value }))}
                  style={{ resize: 'vertical', minHeight: 80, fontSize: 14 }}
                />
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

                        {/* Instructions */}
                        <div style={fld}>
                          <label style={lbl}>Instructions</label>
                          <input type="text" className="input" placeholder="e.g. Take after meals with water"
                            value={item.instructions}
                            onChange={e => updateItem(idx, 'instructions', e.target.value)} />
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
              {prescription.items.length} medicine{prescription.items.length !== 1 ? 's' : ''} · Ready to send
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={closePrescribe} className="btn btn-secondary">
                <ArrowLeft size={14} /> Cancel
              </button>
              <button
                id="submit-prescription-btn"
                onClick={submitPrescription}
                disabled={submitting}
                className="btn btn-primary"
                style={{ minWidth: 180 }}
              >
                {submitting
                  ? <><Spinner size={16} className="animate-spin" /> Sending…</>
                  : <><Check size={16} weight="bold" /> Send to Pharmacy</>
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
