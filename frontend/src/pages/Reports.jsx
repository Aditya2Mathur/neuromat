import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ChartBar, Users, FirstAid, Pill, TrendUp } from '@phosphor-icons/react'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, ArcElement,
  Title, Tooltip, Legend
} from 'chart.js'
import { format, subDays } from 'date-fns'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend)

export default function Reports() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 6) // default to last 7 days
    return format(d, 'yyyy-MM-dd')
  })
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [stats, setStats] = useState({ patients: 0, prescriptions: 0, medicines: 0, queue: [] })
  const [weeklyData, setWeeklyData] = useState([])
  const [statusData, setStatusData] = useState({ waiting: 0, done: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [startDate, endDate])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const startDateISO = new Date(`${startDate}T00:00:00`).toISOString()
      const endDateISO = new Date(`${endDate}T23:59:59`).toISOString()

      const [pats, rxs, meds, queueWeek] = await Promise.all([
        supabase.from('patients').select('id', { count: 'exact' }).gte('created_at', startDateISO).lte('created_at', endDateISO),
        supabase.from('prescriptions').select('id', { count: 'exact' }).gte('created_at', startDateISO).lte('created_at', endDateISO),
        supabase.from('medicines').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('queue').select('visit_date, status')
          .gte('visit_date', startDate)
          .lte('visit_date', endDate)
          .order('visit_date'),
      ])

      const qData = queueWeek.data || []
      
      const start = new Date(startDate)
      const end = new Date(endDate)
      const diffTime = Math.abs(end - start)
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
      
      const dates = []
      for (let i = 0; i < diffDays; i++) {
        const nextDate = new Date(start)
        nextDate.setDate(start.getDate() + i)
        dates.push(format(nextDate, 'yyyy-MM-dd'))
      }

      const weekly = dates.map(d => ({
        date: format(new Date(`${d}T00:00:00`), 'dd MMM'),
        count: qData.filter(q => q.visit_date === d).length
      }))

      setStats({
        patients: pats.count || 0,
        prescriptions: rxs.count || 0,
        medicines: meds.count || 0,
      })
      setWeeklyData(weekly)
      setStatusData({
        done: qData.filter(q => q.status === 'done').length,
        pending: qData.filter(q => q.status !== 'done').length,
      })
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const chartTheme = {
    backgroundColor: [
      'rgba(99,102,241,0.7)', 'rgba(139,92,246,0.7)', 'rgba(6,182,212,0.7)',
      'rgba(16,185,129,0.7)', 'rgba(245,158,11,0.7)', 'rgba(239,68,68,0.7)', 'rgba(99,102,241,0.4)'
    ],
    borderColor: [
      'rgba(99,102,241,1)', 'rgba(139,92,246,1)', 'rgba(6,182,212,1)',
      'rgba(16,185,129,1)', 'rgba(245,158,11,1)', 'rgba(239,68,68,1)', 'rgba(99,102,241,1)'
    ],
  }

  const barChartData = {
    labels: weeklyData.map(d => d.date),
    datasets: [{
      label: 'Patients',
      data: weeklyData.map(d => d.count),
      backgroundColor: chartTheme.backgroundColor,
      borderColor: chartTheme.borderColor,
      borderWidth: 1,
      borderRadius: 8,
    }]
  }

  const doughnutData = {
    labels: ['Completed', 'Pending'],
    datasets: [{
      data: [statusData.done, statusData.pending],
      backgroundColor: ['rgba(16,185,129,0.7)', 'rgba(245,158,11,0.7)'],
      borderColor: ['rgba(16,185,129,1)', 'rgba(245,158,11,1)'],
      borderWidth: 2,
    }]
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { labels: { color: '#475569', font: { family: 'Inter', size: 12 } } },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: '#64748b', stepSize: 1 },
        grid: { color: 'rgba(0,0,0,0.05)' }
      },
      x: {
        ticks: { color: '#64748b' },
        grid: { display: false }
      }
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 96, borderRadius: 16 }} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {[...Array(2)].map((_, i) => <div key={i} className="skeleton" style={{ height: 280, borderRadius: 16 }} />)}
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Reports & Analytics</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>System overview and statistics</p>
        </div>
        {/* Date range inputs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>From</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>To</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[
          { label: 'Patients Registered', value: stats.patients,      icon: Users,    color: '#6366f1' },
          { label: 'Prescriptions Issued', value: stats.prescriptions, icon: FirstAid, color: '#10b981' },
          { label: 'Active Medicines',     value: stats.medicines,      icon: Pill,     color: '#06b6d4' },
        ].map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className="stat-card">
              <div style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${s.color}18`, marginBottom: 8 }}>
                <Icon size={20} color={s.color} weight="fill" />
              </div>
              <div style={{ fontSize: 34, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-1px' }}>{s.value}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
            </div>
          )
        })}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: '22px 24px' }}>
          <h3 style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <TrendUp size={15} color="#6366f1" /> Patient Visits
          </h3>
          <Bar data={barChartData} options={chartOptions} />
        </div>
        <div className="card" style={{ padding: '22px 24px' }}>
          <h3 style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <ChartBar size={15} color="#10b981" /> Queue Status Breakdown
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ maxWidth: 260, width: '100%' }}>
              <Doughnut data={doughnutData} options={{
                responsive: true,
                plugins: {
                  legend: { position: 'bottom', labels: { color: '#475569', font: { family: 'Inter', size: 12 } } }
                }
              }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
