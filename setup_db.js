const https = require('https')

const sql = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS doctors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  specialty text NOT NULL,
  email text UNIQUE,
  phone text,
  default_fee integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO doctors (name, specialty, default_fee) VALUES 
  ('Dr. Mohd. Shakir', 'Neurosurgeon', 500),
  ('Dr. Afifa', 'Gynecologist', 300)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS medicines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  category text,
  unit text DEFAULT 'tablet',
  stock_quantity integer DEFAULT 0,
  low_stock_threshold integer DEFAULT 10,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  phone text NOT NULL,
  age integer,
  gender text,
  address text,
  weight decimal(5,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(name, phone)
);

CREATE TABLE IF NOT EXISTS name_database (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('first', 'last'))
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid REFERENCES patients(id),
  doctor_id uuid REFERENCES doctors(id),
  visit_date timestamptz DEFAULT now(),
  expiry_date timestamptz DEFAULT (now() + interval '5 days'),
  diagnosis text,
  notes text,
  other_instruction text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'dispensed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prescription_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescription_id uuid REFERENCES prescriptions(id) ON DELETE CASCADE,
  medicine_id uuid REFERENCES medicines(id),
  medicine_name text NOT NULL,
  dosage text,
  frequency text,
  duration text,
  instructions text,
  quantity integer DEFAULT 1
);

CREATE TABLE IF NOT EXISTS queue (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid REFERENCES patients(id),
  doctor_id uuid REFERENCES doctors(id),
  prescription_id uuid REFERENCES prescriptions(id),
  token_number integer,
  status text DEFAULT 'waiting' CHECK (status IN ('waiting', 'with_doctor', 'completed', 'dispensing', 'done')),
  fee integer DEFAULT 0,
  visit_date date DEFAULT current_date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'reception', 'doctor', 'medical_store')),
  password_hash text,
  doctor_id uuid REFERENCES doctors(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE name_database ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'doctors' AND policyname = 'Allow all') THEN
    CREATE POLICY "Allow all" ON doctors FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'medicines' AND policyname = 'Allow all') THEN
    CREATE POLICY "Allow all" ON medicines FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'patients' AND policyname = 'Allow all') THEN
    CREATE POLICY "Allow all" ON patients FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prescriptions' AND policyname = 'Allow all') THEN
    CREATE POLICY "Allow all" ON prescriptions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prescription_items' AND policyname = 'Allow all') THEN
    CREATE POLICY "Allow all" ON prescription_items FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'queue' AND policyname = 'Allow all') THEN
    CREATE POLICY "Allow all" ON queue FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff' AND policyname = 'Allow all') THEN
    CREATE POLICY "Allow all" ON staff FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'name_database' AND policyname = 'Allow all') THEN
    CREATE POLICY "Allow all" ON name_database FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

INSERT INTO staff (name, email, role, password_hash) VALUES
  ('Admin User', 'admin@neuromat.com', 'admin', 'admin 123'),
  ('Reception Staff', 'reception@neuromat.com', 'reception', 'reception123'),
  ('Medical Store', 'store@neuromat.com', 'medical_store', 'store123'),
  ('Dr. Mohd. Shakir', 'shakir@neuromat.com', 'doctor', 'doctor123'),
  ('Dr. Afifa', 'afifa@neuromat.com', 'doctor', 'doctor123')
ON CONFLICT (email) DO NOTHING;

-- Link doctor staff to doctors table
UPDATE staff SET doctor_id = (SELECT id FROM doctors WHERE name = 'Dr. Mohd. Shakir' LIMIT 1)
WHERE email = 'shakir@neuromat.com' AND doctor_id IS NULL;

UPDATE staff SET doctor_id = (SELECT id FROM doctors WHERE name = 'Dr. Afifa' LIMIT 1)
WHERE email = 'afifa@neuromat.com' AND doctor_id IS NULL;

-- Function to decrement medicine stock quantity atomically
CREATE OR REPLACE FUNCTION decrement_stock(med_id uuid, qty integer)
RETURNS void AS $$
BEGIN
  UPDATE medicines
  SET stock_quantity = COALESCE(stock_quantity, 0) - qty,
      updated_at = NOW()
  WHERE id = med_id;
END;
$$ LANGUAGE plpgsql;
`

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuaXhqdW5tdnRvYmF6aWt2cXhzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTY3OTU0OCwiZXhwIjoyMDk3MjU1NTQ4fQ.hd-dVOFDdZzQJms_WPxL-N4alC5sC6X01DKL4XVJSWM'

async function runSQL() {
  const body = JSON.stringify({ query: sql })
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'snixjunmvtobazikvqxs.supabase.co',
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }
    
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => {
        console.log('Status:', res.statusCode)
        console.log('Response:', data.substring(0, 500))
        resolve({ status: res.statusCode, data })
      })
    })
    
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

runSQL().then(r => {
  if (r.status === 200 || r.status === 201) {
    console.log('SUCCESS: Schema created!')
  } else {
    console.log('Note: RPC exec_sql may not exist, trying management API...')
    // Try Supabase Management API
    const mgmtBody = JSON.stringify({ query: sql })
    const mgmtOpts = {
      hostname: 'api.supabase.com',
      path: '/v1/projects/snixjunmvtobazikvqxs/database/query',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Length': Buffer.byteLength(mgmtBody)
      }
    }
    
    const req2 = https.request(mgmtOpts, (res2) => {
      let d2 = ''
      res2.on('data', c => d2 += c)
      res2.on('end', () => {
        console.log('Mgmt API Status:', res2.statusCode)
        console.log('Mgmt API Response:', d2.substring(0, 500))
      })
    })
    req2.on('error', e => console.log('Mgmt error:', e.message))
    req2.write(mgmtBody)
    req2.end()
  }
}).catch(e => console.error('Error:', e.message))
