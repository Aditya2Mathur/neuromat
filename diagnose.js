require('dotenv').config({ path: './backend/.env' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function diagnose() {
  console.log('\n🔍 NEUROMAT — Database Diagnostic\n')
  console.log('Supabase URL:', process.env.SUPABASE_URL)
  console.log('')

  // Check each table
  const tables = ['staff', 'doctors', 'medicines', 'patients', 'prescriptions', 'prescription_items', 'queue', 'name_database']
  
  for (const table of tables) {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact' })
      .limit(3)
    
    if (error) {
      console.log(`❌ ${table}: ERROR — ${error.message}`)
    } else {
      console.log(`✅ ${table}: EXISTS — ${count} rows`)
      if (table === 'staff' && data?.length > 0) {
        console.log('   Staff accounts:')
        data.forEach(s => console.log(`   - ${s.email} (role: ${s.role}, password_hash: ${s.password_hash})`))
      }
      if (table === 'doctors' && data?.length > 0) {
        console.log('   Doctors:')
        data.forEach(d => console.log(`   - ${d.name} (${d.specialty})`))
      }
    }
  }

  console.log('\n📋 Trying to fix: Inserting staff accounts...\n')

  // Try to insert staff accounts (will succeed if table exists)
  const staffAccounts = [
    { name: 'Admin User', email: 'admin@neuromat.com', role: 'admin', password_hash: 'admin123', is_active: true },
    { name: 'Reception Staff', email: 'reception@neuromat.com', role: 'reception', password_hash: 'reception123', is_active: true },
    { name: 'Medical Store', email: 'store@neuromat.com', role: 'medical_store', password_hash: 'store123', is_active: true },
    { name: 'Dr. Mohd. Shakir', email: 'shakir@neuromat.com', role: 'doctor', password_hash: 'doctor123', is_active: true },
    { name: 'Dr. Afifa', email: 'afifa@neuromat.com', role: 'doctor', password_hash: 'doctor123', is_active: true },
  ]

  const { data: insertedStaff, error: staffErr } = await supabase
    .from('staff')
    .upsert(staffAccounts, { onConflict: 'email', ignoreDuplicates: false })
    .select()

  if (staffErr) {
    console.log('❌ Staff insert failed:', staffErr.message)
    console.log('\n⚠️  ACTION REQUIRED: Tables dont exist! You MUST run database_schema.sql in Supabase SQL Editor.')
    console.log('   Go to: https://supabase.com/dashboard/project/snixjunmvtobazikvqxs/sql/new')
    console.log('   Copy content of: database_schema.sql')
    console.log('   Paste and press Ctrl+Enter\n')
  } else {
    console.log('✅ Staff accounts upserted successfully!')
    console.log('   Inserted/Updated:', insertedStaff?.length, 'accounts')

    // Link doctors to staff
    const { data: drShakir } = await supabase.from('doctors').select('id').eq('name', 'Dr. Mohd. Shakir').single()
    const { data: drAfifa } = await supabase.from('doctors').select('id').eq('name', 'Dr. Afifa').single()

    if (drShakir) {
      await supabase.from('staff').update({ doctor_id: drShakir.id }).eq('email', 'shakir@neuromat.com')
      console.log('✅ Dr. Shakir linked to staff account')
    }
    if (drAfifa) {
      await supabase.from('staff').update({ doctor_id: drAfifa.id }).eq('email', 'afifa@neuromat.com')
      console.log('✅ Dr. Afifa linked to staff account')
    }

    console.log('\n🎉 All done! Try logging in now:')
    console.log('   Admin:      admin@neuromat.com     / admin123')
    console.log('   Reception:  reception@neuromat.com / reception123')
    console.log('   Dr. Shakir: shakir@neuromat.com    / doctor123')
    console.log('   Dr. Afifa:  afifa@neuromat.com     / doctor123')
    console.log('   Med Store:  store@neuromat.com     / store123\n')
  }
}

diagnose().catch(console.error)
