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
  const [stats, setStats] = useState({ patients: 0, prescriptions: 0, medicines: 0, queue: [] })
  const [weeklyData, setWeeklyData] = useState([])
  const [statusData, setStatusData] = useState({ waiting: 0, done: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStats() }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const [pats, rxs, meds, queueWeek] = await Promise.all([
        supabase.from('patients').select('id', { count: 'exact' }),
        supabase.from('prescriptions').select('id', { count: 'exact' }),
        supabase.from('medicines').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('queue').select('visit_date, status')
          .gte('visit_date', format(subDays(new Date(), 6), 'yyyy-MM-dd'))
          .order('visit_date'),
      ])

      const qData = queueWeek.data || []
      
      // Group by date for weekly chart
      const dates = [...Array(7)].map((_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd'))
      const weekly = dates.map(d => ({
        date: format(new Date(d), 'EEE'),
        count: qData.filter(q => q.visit_date === d).length
      }))

      const todayQ = qData.filter(q => q.visit_date === format(new Date(), 'yyyy-MM-dd'))
      
      setStats({
        patients: pats.count || 0,
        prescriptions: rxs.count || 0,
        medicines: meds.count || 0,
      })
      setWeeklyData(weekly)
      setStatusData({
        done: todayQ.filter(q => q.status === 'done').length,
        pending: todayQ.filter(q => q.status !== 'done').length,
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
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Reports & Analytics</h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>System overview and statistics</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[
          { label: 'Total Patients',       value: stats.patients,       icon: Users,    color: '#6366f1' },
          { label: 'Total Prescriptions',  value: stats.prescriptions,  icon: FirstAid, color: '#10b981' },
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
            <TrendUp size={15} color="#6366f1" /> Weekly Patients (Last 7 Days)
          </h3>
          <Bar data={barChartData} options={chartOptions} />
        </div>
        <div className="card" style={{ padding: '22px 24px' }}>
          <h3 style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <ChartBar size={15} color="#10b981" /> Today's Queue Status
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
