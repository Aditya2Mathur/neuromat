# 🏥 Neuromat Clinic Management System

A modern, role-based clinic management system built with React, Node.js, and Supabase.

## 🚀 Quick Start

1. **Run the setup SQL** in Supabase (see Step 1 below)
2. **Double-click** `start.bat` to launch both servers
3. **Open** http://localhost:5173 in your browser

## 📁 Project Structure

```
FinalClinicManagement_System/
├── frontend/          # React + TailwindCSS v4 + Vite
├── backend/           # Node.js + Express API
├── database_schema.sql  # ⚠️ Run this in Supabase first!
├── start.bat          # Start both servers
└── README.md
```

## ⚠️ MANUAL STEP REQUIRED: Database Setup

You must run the SQL schema manually in Supabase:

1. Go to: https://supabase.com/dashboard/project/snixjunmvtobazikvqxs/sql/new
2. Open the file `database_schema.sql` in this folder
3. Copy all contents and paste into the SQL editor
4. Click **Run** or press `Ctrl+Enter`

## 🔐 Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@neuromat.com | admin123 |
| Reception | reception@neuromat.com | reception123 |
| Dr. Mohd. Shakir | shakir@neuromat.com | doctor123 |
| Dr. Afifa | afifa@neuromat.com | doctor123 |
| Medical Store | store@neuromat.com | store123 |

## 🛠️ Tech Stack

- **Frontend**: React 18, TailwindCSS v4, Vite, Phosphor Icons
- **Backend**: Node.js, Express.js
- **Database**: Supabase (PostgreSQL)
- **Charts**: Chart.js + react-chartjs-2
- **Fonts**: Inter (Google Fonts)

## 📱 Features by Role

### 🏥 Reception
- Phone number lookup for returning patients
- Auto-fill patient details
- 5-day visit window detection
- Indian name autocomplete (1000+ names)
- Token generation & queue management

### 👨‍⚕️ Doctor
- Live patient queue
- Digital prescription editor
- Medicine search from available stock
- Dosage, frequency, duration fields
- Prescription automatically sent to pharmacy

### 💊 Medical Store
- Pharmacy queue with prescribed medicines
- One-click dispense workflow
- Automatic stock deduction
- Print prescription (A4 format)
- WhatsApp sharing

### ⚙️ Admin
- Doctor management (add/edit/activate)
- Medicine inventory management
- Low stock alerts
- Patient records & history
- Analytics & reports with charts

## 🔧 Environment Variables

### Frontend (.env)
```env
VITE_SUPABASE_URL=https://snixjunmvtobazikvqxs.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_API_URL=http://localhost:3001/api
```

### Backend (.env)
```env
SUPABASE_URL=https://snixjunmvtobazikvqxs.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...
JWT_SECRET=neuromat_clinic_jwt_secret_2026_very_secure
PORT=3001
```

## 📊 Database Schema

| Table | Description |
|-------|-------------|
| `doctors` | Doctor profiles |
| `medicines` | Medicine inventory |
| `patients` | Patient records |
| `name_database` | Indian names (first/last) |
| `prescriptions` | Prescription headers |
| `prescription_items` | Prescription line items |
| `queue` | Daily patient queue |
| `staff` | User accounts |
