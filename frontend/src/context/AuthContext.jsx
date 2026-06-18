import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('neuromat_user')) } catch { return null }
  })
  const [loading, setLoading] = useState(false)

  const login = async (email, password) => {
    setLoading(true)
    try {
      const { data: staff, error } = await supabase
        .from('staff')
        .select('*, doctors(*)')
        .eq('email', email.toLowerCase().trim())
        .eq('is_active', true)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Invalid credentials (email not found)')
        }
        console.error('Supabase query error:', error)
        throw new Error(`Database error: ${error.message || 'Unable to connect to Supabase'}`)
      }
      if (!staff) {
        throw new Error('Invalid credentials (email not found)')
      }

      const isValid = staff.password_hash === password

      if (!isValid) {
        throw new Error('Invalid credentials (password incorrect)')
      }

      const userData = {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        doctor: staff.doctors,
        doctor_id: staff.doctor_id,
      }
      localStorage.setItem('neuromat_user', JSON.stringify(userData))
      setUser(userData)
      return { success: true, user: userData }
    } catch (err) {
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }


  const logout = () => {
    localStorage.removeItem('neuromat_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
