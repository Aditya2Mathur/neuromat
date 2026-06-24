import React, { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Reception from './pages/Reception'
import DoctorQueue from './pages/DoctorQueue'
import PharmacyQueue from './pages/PharmacyQueue'
import Inventory from './pages/Inventory'
import Doctors from './pages/Doctors'
import Patients from './pages/Patients'
import QueuePage from './pages/QueuePage'
import Prescriptions from './pages/Prescriptions'
import Reports from './pages/Reports'

function AppContent() {
  const { user } = useAuth()
  const [activePage, setActivePage] = useState('dashboard')
  const [selectedQueueItem, setSelectedQueueItem] = useState(null)

  useEffect(() => {
    setActivePage('dashboard')
    setSelectedQueueItem(null)
  }, [user?.id])

  if (!user) return <Login />

  const getPageComponent = () => {
    switch (activePage) {
      case 'dashboard':
        return (
          <Dashboard
            onNavigate={setActivePage}
            onSelectQueueItem={setSelectedQueueItem}
          />
        )
      case 'register': return <Reception onNavigate={setActivePage} />
      case 'queue':
        return user.role === 'doctor' ? (
          <DoctorQueue
            onNavigate={setActivePage}
            selectedQueueItem={selectedQueueItem}
            clearSelectedQueueItem={() => setSelectedQueueItem(null)}
          />
        ) : (
          <QueuePage />
        )
      case 'prescriptions': return <Prescriptions />
      case 'pharmacy': return <PharmacyQueue />
      case 'medicines':
      case 'inventory': return <Inventory />
      case 'doctors': return <Doctors />
      case 'patients': return <Patients />
      case 'reports': return <Reports />
      default:
        return (
          <Dashboard
            onNavigate={setActivePage}
            onSelectQueueItem={setSelectedQueueItem}
          />
        )
    }
  }

  return (
    <Layout activePage={activePage} onNavigate={setActivePage}>
      {getPageComponent()}
    </Layout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#ffffff',
            color: '#0f172a',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            borderRadius: '12px',
            fontSize: '14px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.03)',
          },
          success: { iconTheme: { primary: '#059669', secondary: '#ffffff' } },
          error: { iconTheme: { primary: '#dc2626', secondary: '#ffffff' } },
        }}
      />
      <AppContent />
    </AuthProvider>
  )
}
