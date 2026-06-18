import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  Package, Plus, Pencil, Warning, CheckCircle, Trash,
  MagnifyingGlass, ArrowUp, ArrowDown, Spinner, X
} from '@phosphor-icons/react'
import toast from 'react-hot-toast'

export default function Inventory() {
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    name: '', category: '', unit: 'tablet',
    stock_quantity: 0, low_stock_threshold: 10, price: 0
  })
  const [saving, setSaving] = useState(false)

  const CATEGORIES = ['Analgesic', 'Antibiotic', 'Antifungal', 'Antiviral', 'Antacid',
    'Antihistamine', 'Antihypertensive', 'Antidiabetic', 'Vitamin', 'Supplement',
    'Neurological', 'Gynecological', 'Cardiovascular', 'Respiratory', 'Other']

  useEffect(() => { fetchMedicines() }, [])

  const fetchMedicines = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('medicines')
      .select('*')
      .eq('is_active', true)
      .order('name')
    setMedicines(data || [])
    setLoading(false)
  }

  const filtered = medicines.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.category || '').toLowerCase().includes(search.toLowerCase())
  )

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', category: '', unit: 'tablet', stock_quantity: 0, low_stock_threshold: 10, price: 0 })
    setShowModal(true)
  }

  const openEdit = (med) => {
    setEditing(med)
    setForm({
      name: med.name, category: med.category || '', unit: med.unit || 'tablet',
      stock_quantity: med.stock_quantity || 0,
      low_stock_threshold: med.low_stock_threshold || 10,
      price: med.price || 0
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Medicine name is required')
    setSaving(true)
    try {
      if (editing) {
        const { error } = await supabase.from('medicines').update({
          ...form,
          updated_at: new Date().toISOString()
        }).eq('id', editing.id)
        if (error) throw error
        toast.success('Medicine updated!')
      } else {
        const { error } = await supabase.from('medicines').insert({
          ...form,
          is_active: true
        })
        if (error) {
          if (error.code === '23505') throw new Error('Medicine with this name already exists')
          throw error
        }
        toast.success('Medicine added!')
      }
      setShowModal(false)
      fetchMedicines()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Deactivate this medicine? It will no longer be shown to doctors.')) return
    await supabase.from('medicines').update({ is_active: false }).eq('id', id)
    toast.success('Medicine deactivated')
    fetchMedicines()
  }

  const adjustStock = async (med, delta) => {
    const newQty = Math.max(0, (med.stock_quantity || 0) + delta)
    await supabase.from('medicines').update({ stock_quantity: newQty, updated_at: new Date().toISOString() }).eq('id', med.id)
    setMedicines(prev => prev.map(m => m.id === med.id ? { ...m, stock_quantity: newQty } : m))
  }

  const lowStockCount = medicines.filter(m => m.stock_quantity <= (m.low_stock_threshold || 10)).length

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Medicine Inventory</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
            {medicines.length} medicines
            {lowStockCount > 0 && <span style={{ color: '#d97706', marginLeft: 6 }}>· {lowStockCount} low stock alerts</span>}
          </p>
        </div>
        <button id="add-medicine-btn" onClick={openAdd} className="btn btn-primary">
          <Plus size={16} /> Add Medicine
        </button>
      </div>

      {/* Low stock alert */}
      {lowStockCount > 0 && (
        <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 18px', borderRadius: 12, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.22)' }}>
          <Warning size={20} color="#f59e0b" weight="fill" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#92400e' }}>
              {lowStockCount} medicine{lowStockCount > 1 ? 's' : ''} running low on stock
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
              Please restock to ensure availability for prescriptions
            </p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="input-group">
        <span className="input-icon"><MagnifyingGlass size={16} /></span>
        <input
          id="med-search"
          type="text"
          className="input"
          placeholder="Search medicines by name or category…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 10 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Package size={40} className="empty-state-icon" />
            <p className="empty-state-title">No medicines found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Medicine Name</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(med => {
                  const isLow = med.stock_quantity <= (med.low_stock_threshold || 10)
                  return (
                    <tr key={med.id}>
                      <td>
                        <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{med.name}</div>
                        {med.price > 0 && (
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>₹{med.price}</div>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-secondary">{med.category || 'General'}</span>
                      </td>
                      <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {med.unit}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => adjustStock(med, -1)}
                            className="btn btn-icon btn-secondary btn-sm"
                            style={{ width: '26px', height: '26px', padding: '4px' }}
                          >
                            <ArrowDown size={12} />
                          </button>
                          <span className="font-semibold text-sm" style={{ color: isLow ? '#d97706' : 'var(--text-primary)' }}>
                            {med.stock_quantity}
                          </span>
                          <button
                            onClick={() => adjustStock(med, 1)}
                            className="btn btn-icon btn-secondary btn-sm"
                            style={{ width: '26px', height: '26px', padding: '4px' }}
                          >
                            <ArrowUp size={12} />
                          </button>
                        </div>
                      </td>
                      <td>
                        {isLow ? (
                          <span className="badge badge-warning">
                            <Warning size={10} /> Low Stock
                          </span>
                        ) : (
                          <span className="badge badge-success">
                            <CheckCircle size={10} /> In Stock
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            id={`edit-med-${med.id}`}
                            onClick={() => openEdit(med)}
                            className="btn btn-sm btn-secondary"
                          >
                            <Pencil size={13} /> Edit
                          </button>
                          <button
                            onClick={() => handleDelete(med.id)}
                            className="btn btn-sm btn-danger"
                          >
                            <Trash size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22, paddingBottom: 18, borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                {editing ? 'Edit Medicine' : 'Add New Medicine'}
              </h3>
              <button onClick={() => setShowModal(false)} className="btn btn-icon btn-secondary btn-sm">
                <X size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>MEDICINE NAME *</label>
                <input id="med-name-input" type="text" className="input" placeholder="e.g. Paracetamol"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>CATEGORY</label>
                  <select className="input" value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="">Select category</option>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>UNIT</label>
                  <select className="input" value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                    <option value="tablet">Tablet</option>
                    <option value="capsule">Capsule</option>
                    <option value="syrup">Syrup (ml)</option>
                    <option value="injection">Injection</option>
                    <option value="cream">Cream (g)</option>
                    <option value="drops">Drops</option>
                    <option value="sachet">Sachet</option>
                    <option value="patch">Patch</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>STOCK QTY</label>
                  <input type="number" className="input" min="0"
                    value={form.stock_quantity}
                    onChange={e => setForm(f => ({ ...f, stock_quantity: parseInt(e.target.value) || 0 }))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>LOW STOCK AT</label>
                  <input type="number" className="input" min="1"
                    value={form.low_stock_threshold}
                    onChange={e => setForm(f => ({ ...f, low_stock_threshold: parseInt(e.target.value) || 10 }))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>PRICE (₹)</label>
                  <input type="number" className="input" min="0" step="0.01"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button id="save-medicine-btn" onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
                {saving ? <Spinner size={16} className="animate-spin" /> : editing ? 'Update Medicine' : 'Add Medicine'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
