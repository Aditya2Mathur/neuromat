import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://snixjunmvtobazikvqxs.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuaXhqdW5tdnRvYmF6aWt2cXhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2Nzk1NDgsImV4cCI6MjA5NzI1NTU0OH0.aNup2WVh4fAWkYU0eZmPSfolOLpSsub0Vt_zoAG7Fmc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
})

export default supabase
