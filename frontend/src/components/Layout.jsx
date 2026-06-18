import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  House, UserCircle, Stethoscope, FirstAid, Pill, Bell,
  SignOut, List, X, Clock, ChartBar, Users, Queue, Package,
  CaretRight, Heartbeat
} from '@phosphor-icons/react'
import { format } from 'date-fns'

const ROLE_NAV = {
  admin: [
    { id: 'dashboard', label: 'Dashboard',  icon: House },
    { id: 'doctors',   label: 'Doctors',    icon: Stethoscope },
    { id: 'medicines', label: 'Medicines',  icon: Pill },
    { id: 'patients',  label: 'Patients',   icon: Users },
    { id: 'reports',   label: 'Reports',    icon: ChartBar },
  ],
  reception: [
    { id: 'dashboard', label: 'Dashboard',        icon: House },
    { id: 'register',  label: 'Register Patient', icon: UserCircle },
    { id: 'queue',     label: "Today's Queue",    icon: Queue },
  ],
  doctor: [
    { id: 'dashboard',     label: 'Dashboard',    icon: House },
    { id: 'queue',         label: 'Patient Queue', icon: Queue },
    { id: 'prescriptions', label: 'Prescriptions', icon: FirstAid },
  ],
  medical_store: [
    { id: 'dashboard', label: 'Dashboard',       icon: House },
    { id: 'pharmacy',  label: 'Pharmacy Queue',  icon: Pill },
    { id: 'inventory', label: 'Inventory',       icon: Package },
  ],
}

const ROLE_LABELS = {
  admin:         'Administrator',
  reception:     'Reception',
  doctor:        'Doctor',
  medical_store: 'Medical Store',
}

const ROLE_COLORS = {
  admin:         { bg: '#ede9fe', text: '#6d28d9' },
  reception:     { bg: '#e0f2fe', text: '#0284c7' },
  doctor:        { bg: '#d1fae5', text: '#059669' },
  medical_store: { bg: '#fef3c7', text: '#d97706' },
}

export default function Layout({ children, activePage, onNavigate }) {
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const navItems  = ROLE_NAV[user?.role] || []
  const roleColor = ROLE_COLORS[user?.role] || { bg: '#f1f5f9', text: '#64748b' }
  const pageTitle = navItems.find(n => n.id === activePage)?.label || 'Dashboard'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-page)' }}>

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        style={{
          width: 264,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-card)',
          borderRight: '1px solid var(--border)',
          position: 'fixed',
          inset: '0 auto 0 0',
          zIndex: 50,
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}
        // Force it visible on large screens via inline override
        ref={el => {
          if (el) {
            const mq = window.matchMedia('(min-width: 1024px)')
            const toggle = e => { el.style.transform = e.matches ? 'translateX(0)' : '' }
            mq.addEventListener('change', toggle)
            el.style.transform = mq.matches ? 'translateX(0)' : ''
          }
        }}
      >
        {/* Logo */}
        <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Heartbeat size={18} weight="fill" color="white" />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                  Neuromat
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                  Clinic System
                </div>
              </div>
            </div>
            <button
              className="lg:hidden btn btn-icon btn-secondary"
              onClick={() => setSidebarOpen(false)}
              style={{ display: 'none' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* User chip */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 12px',
            background: 'var(--bg-surface)',
            borderRadius: 12,
            border: '1px solid var(--border)',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: roleColor.bg,
              color: roleColor.text,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name}
              </div>
              <div style={{ fontSize: 11, color: roleColor.text, marginTop: 1 }}>
                {ROLE_LABELS[user?.role]}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '14px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '4px 10px 8px' }}>
            Menu
          </div>
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = activePage === item.id
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => { onNavigate(item.id); setSidebarOpen(false) }}
                className={`nav-link${isActive ? ' active' : ''}`}
              >
                <Icon size={17} weight={isActive ? 'fill' : 'regular'} />
                <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                {isActive && <CaretRight size={11} style={{ color: 'var(--primary)', opacity: 0.7 }} />}
              </button>
            )
          })}
        </nav>

        {/* Sign out */}
        <div style={{ padding: '12px 12px 20px', borderTop: '1px solid var(--border)' }}>
          <button
            id="logout-btn"
            onClick={logout}
            className="nav-link"
            style={{ color: 'var(--danger)' }}
          >
            <SignOut size={17} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Sidebar backdrop (mobile) */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(15,23,42,0.4)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main area ───────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        overflow: 'hidden',
        marginLeft: 264,
      }}>

        {/* Topbar */}
        <header style={{
          height: 60,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border)',
          gap: 16,
        }}>
          {/* Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              className="btn btn-icon btn-secondary"
              style={{ display: 'none' }}
              onClick={() => setSidebarOpen(true)}
            >
              <List size={18} />
            </button>
            <div>
              <h1 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {pageTitle}
              </h1>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                {format(time, 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Clock */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}>
              <Clock size={13} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                {format(time, 'hh:mm:ss a')}
              </span>
            </div>

            {/* Avatar */}
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: roleColor.bg,
              color: roleColor.text,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 13,
            }}>
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
