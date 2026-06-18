-- ============================================
-- NEUROMAT CLINIC MANAGEMENT SYSTEM
-- Complete Database Schema for Supabase
-- Run this in: Supabase > SQL Editor
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Doctors table
CREATE TABLE IF NOT EXISTS doctors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  specialty text NOT NULL,
  email text UNIQUE,
  phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Insert the two doctors
INSERT INTO doctors (name, specialty) VALUES 
  ('Dr. Mohd. Shakir', 'Neurosurgeon'),
  ('Dr. Afifa', 'Gynecologist')
ON CONFLICT DO NOTHING;

-- Medicines/Inventory table
CREATE TABLE IF NOT EXISTS medicines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  category text,
  unit text DEFAULT 'tablet',
  stock_quantity integer DEFAULT 0,
  low_stock_threshold integer DEFAULT 10,
  price decimal(10,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Patients table
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

-- Name database table (Indian names)
CREATE TABLE IF NOT EXISTS name_database (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('first', 'last'))
);

-- Prescriptions table
CREATE TABLE IF NOT EXISTS prescriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid REFERENCES patients(id),
  doctor_id uuid REFERENCES doctors(id),
  visit_date timestamptz DEFAULT now(),
  expiry_date timestamptz DEFAULT (now() + interval '5 days'),
  diagnosis text,
  notes text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'dispensed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Prescription items table
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

-- Queue/Appointments table
CREATE TABLE IF NOT EXISTS queue (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid REFERENCES patients(id),
  doctor_id uuid REFERENCES doctors(id),
  prescription_id uuid REFERENCES prescriptions(id),
  token_number integer,
  status text DEFAULT 'waiting' CHECK (status IN ('waiting', 'with_doctor', 'completed', 'dispensing', 'done')),
  visit_date date DEFAULT current_date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Staff/Users table
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

-- Enable Row Level Security on all tables
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE name_database ENABLE ROW LEVEL SECURITY;

-- Create permissive policies (app handles auth)
CREATE POLICY "Allow all" ON doctors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON medicines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON patients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON prescriptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON prescription_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON queue FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON staff FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON name_database FOR ALL USING (true) WITH CHECK (true);

-- Insert default staff accounts (password stored as plain for now)
INSERT INTO staff (name, email, role, password_hash) VALUES
  ('Admin User', 'admin@neuromat.com', 'admin', 'admin123'),
  ('Reception Staff', 'reception@neuromat.com', 'reception', 'reception123'),
  ('Medical Store', 'store@neuromat.com', 'medical_store', 'store123'),
  ('Dr. Mohd. Shakir', 'shakir@neuromat.com', 'doctor', 'doctor123'),
  ('Dr. Afifa', 'afifa@neuromat.com', 'doctor', 'doctor123')
ON CONFLICT (email) DO NOTHING;

-- Link doctor staff accounts to their doctor profiles
UPDATE staff 
SET doctor_id = (SELECT id FROM doctors WHERE name = 'Dr. Mohd. Shakir' LIMIT 1)
WHERE email = 'shakir@neuromat.com' AND doctor_id IS NULL;

UPDATE staff 
SET doctor_id = (SELECT id FROM doctors WHERE name = 'Dr. Afifa' LIMIT 1)
WHERE email = 'afifa@neuromat.com' AND doctor_id IS NULL;

-- Sample medicines (optional - uncomment to add)
INSERT INTO medicines (name, category, unit, stock_quantity, low_stock_threshold, price) VALUES
  ('Paracetamol 500mg', 'Analgesic', 'tablet', 500, 50, 2.5),
  ('Amoxicillin 500mg', 'Antibiotic', 'capsule', 200, 20, 15),
  ('Omeprazole 20mg', 'Antacid', 'capsule', 150, 20, 8),
  ('Metformin 500mg', 'Antidiabetic', 'tablet', 300, 30, 5),
  ('Atorvastatin 10mg', 'Cardiovascular', 'tablet', 100, 15, 12),
  ('Cetirizine 10mg', 'Antihistamine', 'tablet', 200, 25, 4),
  ('Ibuprofen 400mg', 'Analgesic', 'tablet', 400, 40, 6),
  ('Pantoprazole 40mg', 'Antacid', 'tablet', 250, 25, 10),
  ('Vitamin B Complex', 'Vitamin', 'tablet', 300, 30, 8),
  ('Calcium + Vitamin D3', 'Supplement', 'tablet', 200, 20, 15)
ON CONFLICT (name) DO NOTHING;
