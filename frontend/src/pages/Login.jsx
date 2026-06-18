import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  Eye, EyeSlash, Stethoscope, Lightning, ArrowRight,
  Hospital, UserCircle, Pill, Gear,
} from '@phosphor-icons/react'
import toast from 'react-hot-toast'

const FEATURES = [
  { icon: Hospital,     label: 'Reception',   desc: 'Patient registration & queue' },
  { icon: UserCircle,   label: 'Doctor',      desc: 'Digital prescriptions'        },
  { icon: Pill,         label: 'Pharmacy',    desc: 'Medicine dispensing'          },
  { icon: Gear,         label: 'Admin',       desc: 'System management'            },
]

/* ══════════════════════════════════════════════ */
export default function Login() {
  const { login, loading } = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) return toast.error('Please fill all fields')
    const result = await login(email, password)
    if (!result.success) toast.error(result.error || 'Login failed')
    else toast.success('Welcome back!')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'var(--bg-dark)',
      fontFamily: 'Inter, sans-serif',
    }}>

      {/* ══════ LEFT PANEL ══════ */}
      <div style={{
        display: 'none',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '50%',
        padding: '48px 56px',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(145deg, #eef2ff 0%, #f5f3ff 50%, #f0fdfa 100%)',
        // Show on large screens via inline CSS trick (handled by media in index.css)
      }}
        className="login-left-panel"
      >
        {/* Ambient glow orbs */}
        <div style={{
          position: 'absolute', top: '15%', left: '10%',
          width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.25), transparent 70%)',
          filter: 'blur(50px)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '20%', right: '10%',
          width: 240, height: 240, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.2), transparent 70%)',
          filter: 'blur(45px)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: '55%', left: '50%',
          width: 180, height: 180, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(6,182,212,0.15), transparent 70%)',
          filter: 'blur(40px)', pointerEvents: 'none',
        }} />

        {/* Brand */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
            }}>
              <Stethoscope size={22} weight="fill" color="white" />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                Neuromat
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -2 }}>
                Clinic Management System
              </div>
            </div>
          </div>
        </div>

        {/* Hero content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ marginBottom: 36 }}>
            <h1 style={{
              fontSize: 40, fontWeight: 800, lineHeight: 1.15,
              color: 'var(--text-primary)', letterSpacing: '-1.5px',
              marginBottom: 16,
            }}>
              Smart Healthcare<br />
              <span className="gradient-text">Management</span>
            </h1>
            <p style={{
              fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7,
              maxWidth: 380,
            }}>
              Streamline patient care, prescriptions, pharmacy, and administration — all in one modern platform.
            </p>
          </div>

          {/* Feature grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(99,102,241,0.12)',
                borderRadius: 16,
                padding: '18px 20px',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(99,102,241,0.12)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(99,102,241,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 10,
                }}>
                  <Icon size={18} color="var(--primary)" weight="fill" />
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>
                  {label}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          position: 'relative', zIndex: 1,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Lightning size={14} color="var(--primary)" weight="fill" />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Powered by Supabase · Real-time sync · 2026
          </span>
        </div>
      </div>

      {/* ══════ RIGHT PANEL ══════ */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: 440 }} className="animate-fade-in">

          {/* Mobile brand (only visible on small screens) */}
          <div className="login-mobile-brand" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 32,
            justifyContent: 'center',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(99,102,241,0.35)',
            }}>
              <Stethoscope size={22} weight="fill" color="white" />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                Neuromat
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Clinic Management</div>
            </div>
          </div>

          {/* ── Login card ── */}
          <div className="card" style={{
            padding: '36px 36px 32px',
            marginBottom: 16,
          }}>
            {/* Card header */}
            <div style={{ marginBottom: 28 }}>
              <h2 style={{
                fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px',
                color: 'var(--text-primary)', marginBottom: 6,
              }}>
                Welcome back
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Sign in to access your role-based dashboard
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Email field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={{
                  fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
                  letterSpacing: '0.1px',
                }}>
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
                  style={{ height: 46, fontSize: 14 }}
                />
              </div>

              {/* Password field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={{
                  fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
                  letterSpacing: '0.1px',
                }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-password"
                    type={showPass ? 'text' : 'password'}
                    className="input"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    style={{ height: 46, fontSize: 14, paddingRight: 48 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position: 'absolute', right: 14, top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                      padding: 4, borderRadius: 6, transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    {showPass ? <EyeSlash size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit button */}
              <button
                id="login-btn"
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{
                  width: '100%', height: 48,
                  fontSize: 15, fontWeight: 700,
                  justifyContent: 'center', gap: 8,
                  marginTop: 4,
                  letterSpacing: '0.2px',
                }}
              >
                {loading ? (
                  <>
                    <span style={{
                      width: 18, height: 18, borderRadius: '50%',
                      border: '2.5px solid rgba(255,255,255,0.35)',
                      borderTopColor: '#fff',
                      display: 'inline-block', animation: 'spin 0.7s linear infinite',
                    }} />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign In <ArrowRight size={16} weight="bold" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Copyright */}
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              © 2026 Neuromat · All rights reserved
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
