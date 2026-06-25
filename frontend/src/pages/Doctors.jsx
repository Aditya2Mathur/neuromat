import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  Stethoscope, Plus, Pencil, Trash, X, Spinner,
  UserCircle, Phone, EnvelopeSimple
} from '@phosphor-icons/react'
import toast from 'react-hot-toast'

export default function Doctors() {
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', specialty: '', email: '', phone: '', default_fee: '' })
  const [saving, setSaving] = useState(false)
  const [staffForms, setStaffForms] = useState({ email: '', password: '' })
  const [addingStaff, setAddingStaff] = useState(false)

  const SPECIALTIES = [
    'General Physician', 'Neurosurgeon', 'Gynecologist', 'Pediatrician',
    'Cardiologist', 'Orthopedist', 'Dermatologist', 'Ophthalmologist',
    'ENT Specialist', 'Psychiatrist', 'Oncologist', 'Radiologist', 'Other'
  ]

  useEffect(() => { fetchDoctors() }, [])

  const fetchDoctors = async () => {
    setLoading(true)
    const { data } = await supabase.from('doctors').select('*, staff(*)').order('name')
    setDoctors(data || [])
    setLoading(false)
  }

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', specialty: '', email: '', phone: '', default_fee: '' })
    setStaffForms({ email: '', password: '' })
    setShowModal(true)
  }

  const openEdit = (doc) => {
    setEditing(doc)
    setForm({
      name: doc.name,
      specialty: doc.specialty,
      email: doc.email || '',
      phone: doc.phone || '',
      default_fee: doc.default_fee !== undefined && doc.default_fee !== null ? doc.default_fee.toString() : ''
    })
    setStaffForms({ email: '', password: '' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.specialty) return toast.error('Name and specialty are required')
    setSaving(true)
    
    const payload = {
      name: form.name,
      specialty: form.specialty,
      email: form.email || null,
      phone: form.phone || null,
      default_fee: form.default_fee ? parseInt(form.default_fee) : 0
    }

    try {
      if (editing) {
        const { error } = await supabase.from('doctors').update(payload).eq('id', editing.id)
        if (error) throw error
        toast.success('Doctor updated!')
      } else {
        // Create doctor
        const { data: doc, error } = await supabase.from('doctors').insert({
          ...payload, is_active: true
        }).select().single()
        if (error) throw error

        // Create staff account if email/password provided
        if (staffForms.email && staffForms.password) {
          const { error: staffErr } = await supabase.from('staff').insert({
            name: form.name,
            email: staffForms.email.toLowerCase(),
            role: 'doctor',
            password_hash: staffForms.password,
            doctor_id: doc.id,
            is_active: true
          })
          if (staffErr && staffErr.code !== '23505') throw staffErr
        }
        toast.success('Doctor added!')
      }
      setShowModal(false)
      fetchDoctors()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (doc) => {
    await supabase.from('doctors').update({ is_active: !doc.is_active }).eq('id', doc.id)
    fetchDoctors()
  }

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Doctors</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
            {doctors.filter(d => d.is_active).length} active doctors
          </p>
        </div>
        <button id="add-doctor-btn" onClick={openAdd} className="btn btn-primary">
          <Plus size={16} /> Add Doctor
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {[...Array(2)].map((_, i) => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 16 }} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {doctors.map(doc => (
            <div key={doc.id} className="card" style={{ padding: '20px 22px', opacity: doc.is_active ? 1 : 0.55 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, flexShrink: 0, background: 'rgba(99,102,241,0.12)', color: 'var(--primary-light)' }}>
                  {doc.name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{doc.name}</h3>
                    {!doc.is_active && <span className="badge badge-secondary">Inactive</span>}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--primary-light)', marginBottom: 10 }}>{doc.specialty}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}><Stethoscope size={12} /> Default Fee: ₹{doc.default_fee || 0}</div>
                    {doc.email && <div style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}><EnvelopeSimple size={12} /> {doc.email}</div>}
                    {doc.phone && <div style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}><Phone size={12} /> {doc.phone}</div>}
                    {doc.staff?.length > 0 && <div style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)' }}><UserCircle size={12} /> Account: {doc.staff[0]?.email}</div>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <button onClick={() => openEdit(doc)} className="btn btn-sm btn-secondary"><Pencil size={13} /> Edit</button>
                <button onClick={() => toggleActive(doc)} className={`btn btn-sm ${doc.is_active ? 'btn-danger' : 'btn-success'}`}>
                  {doc.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22, paddingBottom: 18, borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                {editing ? 'Edit Doctor' : 'Add New Doctor'}
              </h3>
              <button onClick={() => setShowModal(false)} className="btn btn-icon btn-secondary btn-sm">
                <X size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>DOCTOR NAME *</label>
                <input id="doctor-name-input" type="text" className="input" placeholder="Dr. Full Name"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>SPECIALTY *</label>
                <select className="input" value={form.specialty}
                  onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}>
                  <option value="">Select specialty</option>
                  {SPECIALTIES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>EMAIL</label>
                  <input type="email" className="input" placeholder="doctor@email.com"
                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>PHONE</label>
                  <input type="tel" className="input" placeholder="Phone number"
                    value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>DEFAULT FEE (₹)</label>
                <input
                  id="doctor-fee-input"
                  type="number"
                  className="input"
                  placeholder="e.g. 500"
                  value={form.default_fee}
                  onChange={e => setForm(f => ({ ...f, default_fee: e.target.value }))}
                />
              </div>

              {!editing && (
                <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>LOGIN CREDENTIALS (optional)</label>
                  <input type="email" className="input" placeholder="Login email"
                    value={staffForms.email}
                    onChange={e => setStaffForms(f => ({ ...f, email: e.target.value }))} />
                  <input type="password" className="input" placeholder="Login password"
                    value={staffForms.password}
                    onChange={e => setStaffForms(f => ({ ...f, password: e.target.value }))} />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button id="save-doctor-btn" onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
                {saving ? <Spinner size={16} className="animate-spin" /> : editing ? 'Update Doctor' : 'Add Doctor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
