import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import {
  UserCircle, Phone, MagnifyingGlass, ArrowRight,
  Spinner, CheckCircle, Warning,
} from '@phosphor-icons/react'
import toast from 'react-hot-toast'
import { format, differenceInDays } from 'date-fns'

const SEED_FIRST_NAMES = [
  'Aarav','Aditya','Akash','Amit','Amitabh','Anand','Anil','Anjali','Ankita','Ankit',
  'Arjun','Aryan','Asha','Ashok','Ayaan','Ayesha','Bhavna','Deepak','Deepika','Divya',
  'Farhan','Fatima','Gaurav','Geeta','Gopal','Harish','Heena','Hemant','Ishaan','Jaya',
  'Kajal','Karan','Kavya','Kishan','Komal','Krishna','Lakshmi','Lalit','Lata','Mahesh',
  'Manish','Meena','Meera','Mohit','Monika','Mukesh','Nandini','Neha','Nisha','Nitin',
  'Pallavi','Pankaj','Pooja','Pradeep','Priya','Rahul','Raj','Rajesh','Rakesh','Ramesh',
  'Ravi','Reena','Ritu','Rohit','Ruhi','Sachin','Sagar','Sahil','Salman','Sandeep',
  'Sanjay','Sapna','Seema','Shilpa','Shivam','Shreya','Shweta','Simran','Smita','Sneha',
  'Sonam','Sonu','Sunil','Sunita','Suresh','Swati','Tanvi','Tanya','Tarun','Usha',
  'Varun','Vikas','Vikash','Vikram','Vinay','Vinod','Vishal','Yogesh','Zara','Abhishek',
]

const SEED_LAST_NAMES = [
  'Agarwal','Ahuja','Arora','Bahl','Bajaj','Bansal','Batra','Bhatnagar','Bose','Chandra',
  'Chauhan','Chopra','Choudhary','Dalal','Das','Desai','Deshpande','Dixit','Dube','Dutta',
  'Gandhi','Garg','Ghosh','Goswami','Gupta','Iyer','Jain','Joshi','Kapur','Kapoor',
  'Khatri','Khanna','Kumar','Kulkarni','Lal','Malhotra','Mehrotra','Mehta','Menon','Mishra',
  'Modi','Murthy','Nair','Nanda','Narang','Narayan','Pandey','Patel','Pillai','Prasad',
  'Rawat','Reddy','Roy','Saha','Sahni','Saxena','Sethi','Shah','Sharma','Shukla',
  'Singh','Sinha','Suri','Tewari','Thakur','Tripathi','Varma','Verma','Yadav','Mathur',
]

export default function ReceptionPage({ onNavigate }) {
  const [phone, setPhone] = useState('')
  const [searching, setSearching] = useState(false)
  const [existingPatient, setExistingPatient] = useState(null)
  const [lastVisit, setLastVisit] = useState(null)
  const [form, setForm] = useState({ name: '', age: '', gender: '', address: '', weight: '', doctor_id: '' })
  const [doctors, setDoctors] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [firstNames, setFirstNames] = useState([])
  const [lastNames, setLastNames] = useState([])
  const [nameSuggestions, setNameSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const nameInputRef = useRef(null)

  useEffect(() => { fetchDoctors(); fetchNames() }, [])

  const fetchDoctors = async () => {
    const { data } = await supabase.from('doctors').select('*').eq('is_active', true).order('name')
    setDoctors(data || [])
  }

  const fetchNames = async () => {
    const { data } = await supabase.from('name_database').select('*').limit(1000)
    if (data?.length) {
      setFirstNames(data.filter(n => n.type === 'first').map(n => n.name))
      setLastNames(data.filter(n => n.type === 'last').map(n => n.name))
    } else {
      seedNames()
      setFirstNames(SEED_FIRST_NAMES)
      setLastNames(SEED_LAST_NAMES)
    }
  }

  const seedNames = async () => {
    const rows = [
      ...SEED_FIRST_NAMES.map(n => ({ name: n, type: 'first' })),
      ...SEED_LAST_NAMES.map(n =>  ({ name: n, type: 'last' })),
    ]
    await supabase.from('name_database').upsert(rows, { onConflict: 'name' })
  }

  const handlePhoneSearch = async () => {
    if (phone.length < 10) return toast.error('Enter a valid phone number')
    setSearching(true)
    setExistingPatient(null)
    setLastVisit(null)

    const { data } = await supabase
      .from('patients').select('*')
      .eq('phone', phone)
      .order('updated_at', { ascending: false })

    setSearching(false)

    if (data?.length) {
      const p = data[0]
      setExistingPatient(p)
      setForm({ name: p.name, age: p.age || '', gender: p.gender || '', address: p.address || '', weight: p.weight || '', doctor_id: '' })
      toast.success('Patient found! Details auto-filled.')

      const { data: visits } = await supabase
        .from('queue').select('*, prescriptions(*)')
        .eq('patient_id', p.id)
        .order('created_at', { ascending: false })
        .limit(1)
      if (visits?.length) setLastVisit(visits[0])
    }
  }

  const handleNameInput = (val) => {
    setForm(f => ({ ...f, name: val }))
    if (val.length >= 2) {
      const allNames = [
        ...firstNames, ...lastNames,
        ...firstNames.flatMap(fn => lastNames.slice(0, 3).map(ln => `${fn} ${ln}`)),
      ]
      const matches = allNames.filter(n => n.toLowerCase().startsWith(val.toLowerCase())).slice(0, 8)
      setNameSuggestions(matches)
      setShowSuggestions(matches.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!form.name) return toast.error('Patient name is required')
    if (!phone)     return toast.error('Phone number is required')
    if (!form.doctor_id) return toast.error('Please select a doctor')

    setSubmitting(true)
    try {
      let patientId = existingPatient?.id

      if (!patientId) {
        const { data: newP, error } = await supabase
          .from('patients')
          .upsert({
            name: form.name.trim(), phone: phone.trim(),
            age: form.age ? parseInt(form.age) : null,
            gender: form.gender || null,
            address: form.address || null,
            weight: form.weight ? parseFloat(form.weight) : null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'name,phone' })
          .select().single()
        if (error) throw error
        patientId = newP.id

        // Add name parts to name_database
        const parts = form.name.trim().split(' ')
        for (const part of parts) {
          if (part.length >= 2) {
            await supabase.from('name_database')
              .upsert({ name: part, type: parts.indexOf(part) === 0 ? 'first' : 'last' }, { onConflict: 'name' })
          }
        }
      } else {
        await supabase.from('patients').update({
          age: form.age ? parseInt(form.age) : null,
          gender: form.gender || null,
          address: form.address || null,
          weight: form.weight ? parseFloat(form.weight) : null,
          updated_at: new Date().toISOString(),
        }).eq('id', patientId)
      }

      const today = format(new Date(), 'yyyy-MM-dd')
      const { data: todayQueue } = await supabase
        .from('queue').select('token_number')
        .eq('visit_date', today).eq('doctor_id', form.doctor_id)
        .order('token_number', { ascending: false }).limit(1)

      const nextToken = (todayQueue?.[0]?.token_number || 0) + 1

      const { error: qErr } = await supabase.from('queue').insert({
        patient_id: patientId, doctor_id: form.doctor_id,
        token_number: nextToken, status: 'waiting', visit_date: today,
      })
      if (qErr) throw qErr

      toast.success(`✅ Patient registered! Token #${nextToken}`)
      setPhone(''); setExistingPatient(null); setLastVisit(null)
      setForm({ name: '', age: '', gender: '', address: '', weight: '', doctor_id: '' })
      setTimeout(() => onNavigate('queue'), 1200)
    } catch (err) {
      toast.error(err.message || 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  const daysSince = lastVisit ? differenceInDays(new Date(), new Date(lastVisit.created_at)) : null

  /* ─────────── STYLES ─────────── */
  const fieldStyle = { display: 'flex', flexDirection: 'column', gap: 6 }
  const labelStyle = {
    fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.6px',
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Patient Registration</h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
          Search by phone to auto-fill returning patient details
        </p>
      </div>

      {/* Phone lookup card */}
      <div className="card" style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Phone size={16} color="var(--primary)" weight="fill" />
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Phone Number Lookup</h3>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <input
              id="phone-input"
              type="tel"
              className="input"
              placeholder="Enter patient's phone number"
              value={phone}
              onChange={e => { setPhone(e.target.value); setExistingPatient(null); setLastVisit(null) }}
              onKeyDown={e => e.key === 'Enter' && handlePhoneSearch()}
              maxLength={15}
            />
          </div>
          <button
            id="search-btn"
            onClick={handlePhoneSearch}
            disabled={searching || phone.length < 10}
            className="btn btn-primary"
          >
            {searching ? <Spinner size={16} className="animate-spin" /> : <MagnifyingGlass size={16} />}
            Search
          </button>
        </div>

        {/* Existing patient found banner */}
        {existingPatient && (
          <div style={{
            marginTop: 16, padding: '14px 16px', borderRadius: 12,
            background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)',
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }} className="animate-fade-in">
            <CheckCircle size={20} color="#10b981" weight="fill" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#065f46' }}>Returning Patient Found</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
                {existingPatient.name} · {existingPatient.phone}
                {daysSince !== null && (
                  <span style={{ marginLeft: 8, fontWeight: 600, color: daysSince <= 5 ? 'var(--warning)' : 'var(--text-muted)' }}>
                    · Last visit: {daysSince === 0 ? 'Today' : `${daysSince} days ago`}
                    {daysSince <= 5 && ' ⚠️ (within 5-day window)'}
                  </span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Registration form */}
      <form onSubmit={handleRegister} className="card" style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22, paddingBottom: 18, borderBottom: '1px solid var(--border)' }}>
          <UserCircle size={16} color="var(--primary)" weight="fill" />
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Patient Information</h3>
          {existingPatient && <span className="badge badge-success" style={{ marginLeft: 'auto' }}>Returning Patient</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Full name with autocomplete */}
          <div style={{ ...fieldStyle, position: 'relative' }}>
            <label style={labelStyle}>Full Name *</label>
            <input
              id="patient-name"
              ref={nameInputRef}
              type="text"
              className="input"
              placeholder="Start typing patient's name…"
              value={form.name}
              onChange={e => handleNameInput(e.target.value)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
              required
            />
            {showSuggestions && (
              <div className="glass" style={{
                position: 'absolute', top: '100%', marginTop: 4, left: 0, right: 0,
                zIndex: 50, borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-lg)',
              }}>
                {nameSuggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    style={{
                      width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: 14,
                      color: 'var(--text-primary)', borderBottom: '1px solid var(--border)',
                      background: 'transparent', border: 'none', cursor: 'pointer', display: 'block',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,70,229,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => { setForm(f => ({ ...f, name: s })); setShowSuggestions(false) }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Age + Gender */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Age</label>
              <input id="patient-age" type="number" className="input" placeholder="e.g. 35"
                value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                min={0} max={150} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Gender</label>
              <select id="patient-gender" className="input" value={form.gender}
                onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Weight + Doctor */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Weight (kg)</label>
              <input id="patient-weight" type="number" step="0.1" className="input" placeholder="e.g. 65.5"
                value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Assign Doctor *</label>
              <select id="patient-doctor" className="input" value={form.doctor_id}
                onChange={e => setForm(f => ({ ...f, doctor_id: e.target.value }))} required>
                <option value="">Select doctor</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Address */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Address</label>
            <textarea id="patient-address" className="input" placeholder="Patient's address…"
              value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              style={{ resize: 'none', height: 80 }} />
          </div>

          {/* Submit */}
          <button
            id="register-submit-btn"
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
            style={{ width: '100%', padding: '13px 20px', fontSize: 15, marginTop: 4 }}
          >
            {submitting ? (
              <><Spinner size={16} className="animate-spin" /> Registering…</>
            ) : (
              <><ArrowRight size={16} /> Register & Add to Queue</>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
