import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeSlash, Stethoscope, Lightning } from '@phosphor-icons/react'
import toast from 'react-hot-toast'

const ROLE_COLORS = {
  admin: 'from-violet-600 to-purple-700',
  reception: 'from-blue-600 to-cyan-600',
  doctor: 'from-emerald-600 to-teal-600',
  medical_store: 'from-orange-600 to-amber-600',
}

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@neuromat.com', password: 'admin123' },
  { role: 'Reception', email: 'reception@neuromat.com', password: 'reception123' },
  { role: 'Doctor (Shakir)', email: 'shakir@neuromat.com', password: 'doctor123' },
  { role: 'Doctor (Afifa)', email: 'afifa@neuromat.com', password: 'doctor123' },
  { role: 'Medical Store', email: 'store@neuromat.com', password: 'store123' },
]

export default function Login() {
  const { login, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) return toast.error('Please fill all fields')
    const result = await login(email, password)
    if (!result.success) toast.error(result.error || 'Login failed')
    else toast.success(`Welcome back!`)
  }

  const fillDemo = (acc) => {
    setEmail(acc.email)
    setPassword(acc.password)
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-dark)' }}>
      {/* Left Panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #eef2ff, #f5f3ff, #f0fdfa)' }}>
        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full opacity-40"
          style={{ background: 'radial-gradient(circle, var(--primary-light), transparent)', filter: 'blur(60px)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, var(--secondary), transparent)', filter: 'blur(50px)' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
              <Stethoscope size={20} weight="fill" color="white" />
            </div>
            <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Neuromat</span>
          </div>
          <p style={{ color: 'var(--text-muted)' }} className="text-sm">Clinic Management System</p>
        </div>

        <div className="relative z-10 space-y-6">
          <div>
            <h1 className="text-4xl font-bold leading-tight mb-3" style={{ color: 'var(--text-primary)' }}>
              Smart Healthcare<br />
              <span className="gradient-text">Management</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)' }} className="text-base leading-relaxed">
              Streamline patient care, prescriptions, pharmacy, and administration — all in one place.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: '🏥', label: 'Reception', desc: 'Patient registration' },
              { icon: '👨‍⚕️', label: 'Doctor', desc: 'Digital prescriptions' },
              { icon: '💊', label: 'Pharmacy', desc: 'Medicine dispensing' },
              { icon: '⚙️', label: 'Admin', desc: 'System management' },
            ].map(f => (
              <div key={f.label} className="glass rounded-xl p-4" style={{ borderColor: 'rgba(79,70,229,0.1)' }}>
                <div className="text-2xl mb-1">{f.icon}</div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{f.label}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <Lightning size={14} color="var(--primary)" />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Powered by Supabase • Real-time sync
          </span>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md animate-fade-in">
          {/* Logo Mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
              <Stethoscope size={20} weight="fill" color="white" />
            </div>
            <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Neuromat</span>
          </div>

          <div className="card p-8 mb-4" style={{ background: 'var(--bg-card)' }}>
            <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Sign in</h2>
            <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
              Access your role-based dashboard
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Email Address
                </label>
                <input
                  id="login-email"
                  type="email"
                  className="input"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPass ? 'text' : 'password'}
                    className="input"
                    style={{ paddingRight: '44px' }}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    {showPass ? <EyeSlash size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <button
                id="login-btn"
                type="submit"
                className="btn btn-primary w-full justify-center"
                disabled={loading}
                style={{ width: '100%' }}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : 'Sign In'}
              </button>
            </form>
          </div>

          {/* Demo accounts */}
          <div className="card p-5" style={{ background: 'var(--bg-card)' }}>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>
              DEMO ACCOUNTS — Click to fill
            </p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.email}
                  onClick={() => fillDemo(acc)}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg transition-all text-left"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div>
                    <div className="text-xs font-semibold">{acc.role}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{acc.email}</div>
                  </div>
                  <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{acc.password}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
