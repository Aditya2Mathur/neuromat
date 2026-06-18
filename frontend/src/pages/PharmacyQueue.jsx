import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import {
  Pill, CheckCircle, Printer, ShareNetwork, Warning,
  Queue, ArrowLeft, ArrowRight, Spinner, User, Stethoscope,
  Clock, Package, Heart, Scales, FirstAid, NotePencil,
  WhatsappLogo, Tag,
} from '@phosphor-icons/react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

/* ── Status map ───────────────────────────────── */
const STATUS_MAP = {
  completed:  { label: 'Ready to Dispense', color: '#065f46', bg: 'rgba(5,150,105,0.1)'  },
  dispensing: { label: 'Dispensing',        color: '#312e81', bg: 'rgba(79,70,229,0.1)'  },
  done:       { label: 'Done',              color: '#475569', bg: 'rgba(100,116,139,0.1)' },
}

/* ═════════════════════════════════════════════════ */
export default function PharmacyQueue() {
  const [queue,         setQueue]        = useState([])
  const [loading,       setLoading]      = useState(true)
  const [activeEntry,   setActiveEntry]  = useState(null)
  const [prescription,  setPrescription] = useState(null)
  const [dispensing,    setDispensing]   = useState(false)
  const printRef = useRef()

  /* ── Realtime + initial load ──────────────────── */
  useEffect(() => {
    fetchQueue()
    const sub = supabase.channel('pharmacy-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, fetchQueue)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  const fetchQueue = async () => {
    setLoading(true)
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const { data } = await supabase
        .from('queue')
        .select('*, patients(*), doctors(*), prescriptions(*, prescription_items(*))')
        .eq('visit_date', today)
        .in('status', ['completed', 'dispensing'])
        .order('token_number', { ascending: true })
      setQueue(data || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  /* ── Open dispense workspace ──────────────────── */
  const openDispense = (entry) => {
    setActiveEntry(entry)
    setPrescription(entry.prescriptions)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const closeDispense = () => {
    setActiveEntry(null)
    setPrescription(null)
    fetchQueue()
  }

  /* ── Dispense medicines ───────────────────────── */
  const dispense = async () => {
    if (!activeEntry) return
    setDispensing(true)
    try {
      await supabase.from('queue')
        .update({ status: 'done', updated_at: new Date().toISOString() })
        .eq('id', activeEntry.id)

      if (activeEntry.prescription_id) {
        await supabase.from('prescriptions')
          .update({ status: 'dispensed' })
          .eq('id', activeEntry.prescription_id)

        if (prescription?.prescription_items) {
          for (const item of prescription.prescription_items) {
            if (item.medicine_id) {
              const { error: rpcError } = await supabase.rpc('decrement_stock', {
                med_id: item.medicine_id,
                qty: item.quantity || 1
              })

              if (rpcError) {
                console.warn('decrement_stock RPC failed, falling back to manual update:', rpcError.message)
                const { data: med } = await supabase.from('medicines')
                  .select('stock_quantity').eq('id', item.medicine_id).single()
                if (med) {
                  await supabase.from('medicines').update({
                    stock_quantity: Math.max(0, med.stock_quantity - (item.quantity || 1)),
                    updated_at: new Date().toISOString(),
                  }).eq('id', item.medicine_id)
                }
              }
            }
          }
        }
      }

      toast.success('✅ Medicines dispensed successfully!')
      closeDispense()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDispensing(false)
    }
  }

  /* ── Print ────────────────────────────────────── */
  const handlePrint = () => {
    window.print()
  }

  /* ── WhatsApp ─────────────────────────────────── */
  const handleWhatsApp = () => {
    if (!activeEntry || !prescription) return
    const phone = activeEntry.patients?.phone?.replace(/\D/g, '')
    const items = prescription.prescription_items?.map(i =>
      `• ${i.medicine_name} — ${i.dosage || ''} ${i.frequency || ''} for ${i.duration || ''}`
    ).join('\n') || 'No medicines listed'
    const msg = encodeURIComponent(
      `*NEUROMAT CLINIC — PRESCRIPTION*\n\n` +
      `👤 Patient: ${activeEntry.patients?.name}\n` +
      `📅 Date: ${format(new Date(), 'dd MMM yyyy')}\n` +
      `👨‍⚕️ Doctor: ${activeEntry.doctors?.name}\n\n` +
      `🔍 Diagnosis: ${prescription.diagnosis || 'N/A'}\n\n` +
      `💊 *Medicines:*\n${items}\n\n` +
      `📝 Notes: ${prescription.notes || 'None'}\n\n` +
      `⚠️ Valid for 5 days only`
    )
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
  }

  /* ══════════════════════════════════════════════════
   *  VIEW A — Queue List
   * ═════════════════════════════════════════════════ */
  if (!activeEntry) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Pharmacy Queue</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
              {format(new Date(), 'EEEE, MMMM d, yyyy')} · {queue.length} pending prescription{queue.length !== 1 ? 's' : ''}
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
              <Pill size={48} className="empty-state-icon" />
              <p className="empty-state-title">No pending prescriptions</p>
              <p className="empty-state-text">Waiting for doctors to prescribe medicines</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {queue.map((entry, idx) => {
              const rxItems = entry.prescriptions?.prescription_items || []
              const s = STATUS_MAP[entry.status] || STATUS_MAP.completed
              const isNext = idx === 0

              return (
                <div
                  key={entry.id}
                  className="card animate-fade-in"
                  style={{
                    padding: '18px 22px',
                    border: isNext ? '1.5px solid rgba(5,150,105,0.35)' : undefined,
                    background: isNext ? 'rgba(5,150,105,0.025)' : undefined,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>

                    {/* Token badge */}
                    <div style={{
                      width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                      background: isNext
                        ? 'linear-gradient(135deg,rgba(5,150,105,0.22),rgba(6,182,212,0.12))'
                        : 'var(--bg-elevated)',
                      color: isNext ? 'var(--success)' : 'var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 20,
                      border: isNext ? '1px solid rgba(5,150,105,0.22)' : '1px solid var(--border)',
                    }}>
                      {entry.token_number}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {entry.patients?.name}
                        </span>
                        {isNext && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: '#fff',
                            background: 'linear-gradient(135deg,#059669,#06b6d4)',
                            padding: '2px 8px', borderRadius: 20, letterSpacing: '0.5px',
                          }}>NEXT</span>
                        )}
                        <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                        <span className="badge badge-info">
                          <Pill size={10} /> {rxItems.length} medicine{rxItems.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Stethoscope size={12} /> {entry.doctors?.name}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <FirstAid size={12} /> {entry.prescriptions?.diagnosis || 'No diagnosis noted'}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} /> {format(new Date(entry.created_at), 'hh:mm a')}
                        </span>
                      </div>
                    </div>

                    {/* Action */}
                    <button
                      id={`view-rx-${entry.id}`}
                      onClick={() => openDispense(entry)}
                      className="btn btn-success"
                      style={{ flexShrink: 0, gap: 8 }}
                    >
                      <Package size={15} weight="fill" />
                      View & Dispense
                    </button>
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
   *  VIEW B — Dispense Workspace (full inline)
   * ═════════════════════════════════════════════════ */
  const pat = activeEntry.patients || {}
  const doc = activeEntry.doctors  || {}
  const rxItems = prescription?.prescription_items || []

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 0 }} className="animate-fade-in">

      {/* Print-only spacer & header */}
      <div className="print-only-spacer" />
      
      <div className="print-only-patient-header">
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
          <tbody>
            <tr>
              <td style={{ padding: '4px 0', fontSize: '13px', color: '#000' }}>
                <strong>Patient:</strong> {pat.name} ({pat.age ? `${pat.age} yrs` : '—'} / {pat.gender || '—'})
              </td>
              <td style={{ padding: '4px 0', fontSize: '13px', color: '#000', textAlign: 'right' }}>
                <strong>Date:</strong> {format(new Date(activeEntry.created_at || Date.now()), 'dd MMM yyyy')}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '4px 0', fontSize: '12px', color: '#000' }}>
                <strong>Weight:</strong> {pat.weight ? `${pat.weight} kg` : '—'} | <strong>Phone:</strong> {pat.phone || '—'}
              </td>
              <td style={{ padding: '4px 0', fontSize: '12px', color: '#000', textAlign: 'right' }}>
                <strong>Token:</strong> #{activeEntry.token_number}
              </td>
            </tr>
          </tbody>
        </table>
        <div style={{ borderBottom: '1.5px solid #000', marginBottom: 12 }} />
      </div>

      {/* ── Top bar ─────────────────────────────────── */}
      <div className="no-print" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, marginBottom: 24, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={closeDispense}
            className="btn btn-secondary"
            style={{ gap: 8, padding: '9px 16px' }}
          >
            <ArrowLeft size={15} weight="bold" /> Back to Queue
          </button>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              Dispense Medicines
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              Token #{activeEntry.token_number} · {format(new Date(), 'dd MMM yyyy, hh:mm a')}
            </p>
          </div>
        </div>

        {/* Action buttons top */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={handleWhatsApp} className="btn btn-secondary" style={{ gap: 8 }}>
            <ShareNetwork size={15} /> WhatsApp
          </button>
          <button onClick={handlePrint} className="btn btn-secondary" style={{ gap: 8 }}>
            <Printer size={15} /> Print
          </button>
          <button
            onClick={dispense}
            disabled={dispensing}
            className="btn btn-success btn-lg"
          >
            {dispensing
              ? <><Spinner size={17} className="animate-spin" /> Dispensing…</>
              : <><CheckCircle size={17} weight="fill" /> Dispense Medicines</>
            }
          </button>
        </div>
      </div>

      {/* ── 2-column layout ─────────────────────────── */}
      <div className="prescription-grid" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ═══ LEFT — Patient & Prescription Info ════ */}
        <div className="prescription-left no-print" style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 20 }}>

          {/* Patient card */}
          <div className="card" style={{ overflow: 'hidden' }}>
            {/* Gradient header */}
            <div style={{
              background: 'linear-gradient(135deg, #059669 0%, #06b6d4 100%)',
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
                border: '1px solid rgba(255,255,255,0.35)',
                color: '#fff', fontSize: 11, fontWeight: 700,
                padding: '3px 10px', borderRadius: 20,
              }}>
                Token #{activeEntry.token_number}
              </div>
            </div>

            {/* Stat chips */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              margin: '-20px 16px 0', position: 'relative',
              gap: 10, paddingBottom: 16,
            }}>
              {[
                { icon: User,        label: 'Age',    value: pat.age ? `${pat.age} yrs` : '—' },
                { icon: Heart,       label: 'Gender',  value: pat.gender || '—' },
                { icon: Scales,      label: 'Weight',  value: pat.weight ? `${pat.weight} kg` : '—' },
                { icon: Stethoscope, label: 'Doctor',  value: doc.name?.split(' ').slice(-1)[0] || '—' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '10px 12px', textAlign: 'center',
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  <div style={{ color: 'var(--success)', marginBottom: 4, display: 'flex', justifyContent: 'center' }}>
                    <Icon size={15} weight="fill" />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Doctor card */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
              Prescribing Doctor
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: 'rgba(99,102,241,0.12)', color: 'var(--primary)',
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

          {/* Validity */}
          <div className="no-print" style={{
            padding: '12px 14px', borderRadius: 12,
            background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.22)',
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <Warning size={16} color="#d97706" weight="fill" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
              Valid until <strong>
                {format(new Date(prescription?.expiry_date || Date.now()), 'dd MMM yyyy')}
              </strong>
            </p>
          </div>

          {/* Summary count */}
          <div className="no-print" style={{
            padding: '14px 16px', borderRadius: 12,
            background: 'rgba(8,145,178,0.06)', border: '1px solid rgba(8,145,178,0.18)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Pill size={18} color="var(--accent)" weight="fill" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                {rxItems.length} medicine{rxItems.length !== 1 ? 's' : ''} to dispense
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Total qty: {rxItems.reduce((s, i) => s + (i.quantity || 1), 0)} units
              </div>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT — Prescription Detail Panel ════ */}
        <div className="prescription-right" style={{ display: 'flex', flexDirection: 'column', gap: 16 }} ref={printRef}>

          {/* Clinic branding (for print) */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="no-print" style={{
              padding: '14px 22px', borderBottom: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,0.12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FirstAid size={16} weight="fill" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Clinical Diagnosis</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>As written by the doctor</div>
              </div>
            </div>

            <div className="prescription-details-body" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Diagnosis */}
              <div>
                <div className="print-compact-header" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
                  Diagnosis
                </div>
                <div className="print-compact-box" style={{
                  padding: '12px 16px', borderRadius: 10,
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.04))',
                  border: '1px solid rgba(99,102,241,0.15)',
                  fontSize: 15, fontWeight: 600, color: 'var(--text-primary)',
                }}>
                  {prescription?.diagnosis || '—'}
                </div>
              </div>

              {/* Notes */}
              {prescription?.notes && (
                <div>
                  <div className="print-compact-header" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
                    Clinical Notes
                  </div>
                  <div className="print-compact-box" style={{
                    padding: '12px 16px', borderRadius: 10,
                    background: 'var(--bg-surface)', border: '1px solid var(--border)',
                    fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6,
                  }}>
                    {prescription.notes}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Medicines list */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="no-print" style={{
              padding: '14px 22px', borderBottom: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(5,150,105,0.12)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Pill size={16} weight="fill" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Prescribed Medicines
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {rxItems.length} item{rxItems.length !== 1 ? 's' : ''} to prepare and dispense
                  </div>
                </div>
              </div>
              <span className="badge badge-success" style={{ padding: '5px 12px', fontSize: 12 }}>
                Ready to Dispense
              </span>
            </div>

            <div style={{ padding: '16px 22px' }}>
              {rxItems.length === 0 ? (
                <div className="empty-state" style={{ padding: '32px 0' }}>
                  <Pill size={36} className="empty-state-icon" />
                  <p className="empty-state-text">No medicines in this prescription</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="prescription-meds-table" style={{ width: '100%', borderCollapse: 'collapse', borderSpacing: 0 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                        <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', width: '50px' }}>#</th>
                        <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Medicine</th>
                        <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', width: '120px' }}>Dosage</th>
                        <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', width: '150px' }}>Frequency</th>
                        <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', width: '100px' }}>Duration</th>
                        <th style={{ padding: '12px 10px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', width: '80px', textAlign: 'right' }}>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rxItems.map((item, idx) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                          <td style={{ padding: '14px 10px', fontSize: '13.5px', color: 'var(--text-secondary)' }}>{idx + 1}</td>
                          <td style={{ padding: '14px 10px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                            {item.medicine_name}
                            {item.instructions && (
                              <div style={{ 
                                fontSize: '12px', 
                                fontWeight: '500', 
                                color: '#b45309', 
                                background: 'rgba(245,158,11,0.06)',
                                border: '1px solid rgba(245,158,11,0.15)',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                marginTop: '6px',
                                display: 'inline-block',
                                fontStyle: 'italic'
                              }}>
                                Instruction: {item.instructions}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '14px 10px', fontSize: '13.5px', color: 'var(--text-primary)' }}>{item.dosage || '—'}</td>
                          <td style={{ padding: '14px 10px', fontSize: '13.5px', color: 'var(--text-primary)' }}>{item.frequency || '—'}</td>
                          <td style={{ padding: '14px 10px', fontSize: '13.5px', color: 'var(--text-primary)' }}>{item.duration || '—'}</td>
                          <td style={{ padding: '14px 10px', fontSize: '14.5px', fontWeight: '700', color: 'var(--success)', textAlign: 'right' }}>{item.quantity || 1}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ── Bottom action bar ── */}
          <div className="no-print" style={{
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
              {rxItems.length} medicine{rxItems.length !== 1 ? 's' : ''} ·{' '}
              {rxItems.reduce((s, i) => s + (i.quantity || 1), 0)} total units
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={closeDispense} className="btn btn-secondary">
                <ArrowLeft size={14} /> Cancel
              </button>
              <button
                id="dispense-btn"
                onClick={dispense}
                disabled={dispensing}
                className="btn btn-success"
                style={{ minWidth: 200 }}
              >
                {dispensing
                  ? <><Spinner size={16} className="animate-spin" /> Dispensing…</>
                  : <><CheckCircle size={16} weight="fill" /> Dispense Medicines</>
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
