import { useState, useEffect, useRef } from 'react'
import { FileText, Plus, Search, Edit, Trash2, User, Clock, AlertCircle, Pill } from 'lucide-react'
import { fetchAnamneses, createAnamnese, updateAnamnese, deleteAnamnese, apiFetch, type Anamnese } from '../lib/api'
import { useAccount } from '../context/AccountContext'
import { useAuth } from '../context/AuthContext'

const EMPTY_FORM = { lead_id: 0, lead_name: '', chief_complaint: '', history: '', medications: '', allergies: '', notes: '' }

export default function AnamnesePage() {
  const { accountId } = useAccount()
  const { user } = useAuth()

  const [anamneses, setAnamneses] = useState<Anamnese[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Anamnese | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Anamnese | null>(null)

  // lead search
  const [leadQuery, setLeadQuery] = useState('')
  const [leadResults, setLeadResults] = useState<{ id: number; name: string; phone: string | null }[]>([])
  const [leadSearching, setLeadSearching] = useState(false)
  const leadDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = () => {
    if (!accountId) return
    setLoading(true)
    fetchAnamneses(accountId)
      .then(data => {
        if (user?.role === 'atendente') {
          setAnamneses(data.filter(a => a.professional_id === user.id))
        } else {
          setAnamneses(data)
        }
      })
      .catch(() => setError('Erro ao carregar anamneses'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [accountId])

  const filtered = anamneses.filter(a =>
    !search || (a.lead_name || '').toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setLeadQuery('')
    setLeadResults([])
    setModal('create')
  }

  const openEdit = (a: Anamnese) => {
    setEditing(a)
    setForm({
      lead_id: a.lead_id,
      lead_name: a.lead_name || '',
      chief_complaint: a.chief_complaint || '',
      history: a.history || '',
      medications: a.medications || '',
      allergies: a.allergies || '',
      notes: a.notes || '',
    })
    setLeadQuery(a.lead_name || '')
    setLeadResults([])
    setModal('edit')
  }

  const closeModal = () => { setModal(null); setEditing(null) }

  const searchLeads = (q: string) => {
    setLeadQuery(q)
    if (leadDebounce.current) clearTimeout(leadDebounce.current)
    if (!q.trim() || !accountId) { setLeadResults([]); return }
    leadDebounce.current = setTimeout(() => {
      setLeadSearching(true)
      apiFetch<{ leads: { id: number; name: string; phone: string | null }[] }>(`/api/leads?account_id=${accountId}&search=${encodeURIComponent(q)}`)
        .then(d => setLeadResults(d.leads || []))
        .catch(() => setLeadResults([]))
        .finally(() => setLeadSearching(false))
    }, 350)
  }

  const selectLead = (lead: { id: number; name: string; phone: string | null }) => {
    setForm(f => ({ ...f, lead_id: lead.id, lead_name: lead.name }))
    setLeadQuery(lead.name)
    setLeadResults([])
  }

  const handleSave = async () => {
    if (!accountId || !form.lead_id) return
    setSaving(true)
    const payload = {
      lead_id: form.lead_id,
      chief_complaint: form.chief_complaint || null,
      history: form.history || null,
      medications: form.medications || null,
      allergies: form.allergies || null,
      notes: form.notes || null,
    }
    try {
      if (modal === 'edit' && editing) {
        await updateAnamnese(editing.id, accountId, payload)
      } else {
        await createAnamnese(accountId, payload)
      }
      closeModal()
      load()
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || !accountId) return
    try {
      await deleteAnamnese(deleteTarget.id, accountId)
      setDeleteTarget(null)
      load()
    } catch (e: any) {
      setError(e.message || 'Erro ao excluir')
    }
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div style={{ padding: '24px', background: '#F0F4F8', minHeight: '100vh' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <FileText size={24} color="#5CB8B2" />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#2D3748' }}>Anamneses</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#718096' }}>Fichas de anamnese dos pacientes</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> Nova Anamnese
        </button>
      </div>

      {error && (
        <div style={{ background: '#FFF5F5', border: '1px solid #FC8181', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: '#C53030', fontSize: 14 }}>
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#C53030' }}>✕</button>
        </div>
      )}

      {/* Filter bar */}
      <div className="filter-bar" style={{ marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#A0AEC0' }} />
          <input className="input" placeholder="Buscar por paciente..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 32, width: '100%' }} />
        </div>
        <span style={{ fontSize: 13, color: '#718096', alignSelf: 'center' }}>{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="table-card card">
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#A0AEC0' }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#A0AEC0' }}>
            <FileText size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
            <p>Nenhuma anamnese encontrada</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                {['Paciente', 'Data', 'Profissional', 'Queixa Principal', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid #E2E8F0' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F7FAFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#EBF8F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={15} color="#5CB8B2" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#2D3748', fontSize: 14 }}>{a.lead_name || '—'}</div>
                        {a.lead_phone && <div style={{ fontSize: 12, color: '#A0AEC0' }}>{a.lead_phone}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#718096', fontSize: 13 }}>
                      <Clock size={13} /> {fmtDate(a.created_at)}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#2D3748', fontSize: 13 }}>{a.professional_name || '—'}</td>
                  <td style={{ padding: '12px 16px', maxWidth: 240 }}>
                    <span style={{ fontSize: 13, color: '#718096', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.chief_complaint || <span style={{ color: '#A0AEC0', fontStyle: 'italic' }}>Não informado</span>}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(a)} title="Editar" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Edit size={13} /> Editar
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(a)} title="Excluir" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, width: '90%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #E2E8F0' }}>
              <FileText size={20} color="#5CB8B2" />
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#2D3748' }}>
                {modal === 'edit' ? 'Editar Anamnese' : 'Nova Anamnese'}
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '65vh', overflowY: 'auto', paddingRight: 4 }}>
              {/* Patient search */}
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#2D3748', marginBottom: 6 }}>
                  <User size={14} color="#5CB8B2" /> Paciente *
                </label>
                <div style={{ position: 'relative' }}>
                  <input className="input" placeholder="Buscar paciente por nome..." value={leadQuery}
                    onChange={e => searchLeads(e.target.value)} style={{ width: '100%' }} />
                  {leadSearching && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#A0AEC0', fontSize: 12 }}>Buscando...</span>}
                  {leadResults.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 10, maxHeight: 180, overflowY: 'auto' }}>
                      {leadResults.map(l => (
                        <div key={l.id} onClick={() => selectLead(l)}
                          style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F0F4F8', fontSize: 14, color: '#2D3748' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F0F4F8')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}>
                          <div style={{ fontWeight: 600 }}>{l.name}</div>
                          {l.phone && <div style={{ fontSize: 12, color: '#A0AEC0' }}>{l.phone}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {form.lead_id > 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: '#5CB8B2', fontWeight: 600 }}>Paciente selecionado: {form.lead_name}</div>
                )}
              </div>

              {/* Chief complaint */}
              <div className="form-group">
                <label style={{ fontSize: 13, fontWeight: 600, color: '#2D3748', marginBottom: 6, display: 'block' }}>Queixa Principal</label>
                <textarea className="input" rows={3} placeholder="Descreva a queixa principal do paciente..."
                  value={form.chief_complaint} onChange={e => setForm(f => ({ ...f, chief_complaint: e.target.value }))}
                  style={{ width: '100%', resize: 'vertical' }} />
              </div>

              {/* History */}
              <div className="form-group">
                <label style={{ fontSize: 13, fontWeight: 600, color: '#2D3748', marginBottom: 6, display: 'block' }}>Histórico de Saúde</label>
                <textarea className="input" rows={3} placeholder="Histórico médico, cirurgias, condições pré-existentes..."
                  value={form.history} onChange={e => setForm(f => ({ ...f, history: e.target.value }))}
                  style={{ width: '100%', resize: 'vertical' }} />
              </div>

              {/* Medications */}
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#2D3748', marginBottom: 6 }}>
                  <Pill size={14} color="#5CB8B2" /> Medicamentos em Uso
                </label>
                <textarea className="input" rows={2} placeholder="Liste os medicamentos utilizados..."
                  value={form.medications} onChange={e => setForm(f => ({ ...f, medications: e.target.value }))}
                  style={{ width: '100%', resize: 'vertical' }} />
              </div>

              {/* Allergies */}
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#2D3748', marginBottom: 6 }}>
                  <AlertCircle size={14} color="#E53E3E" /> Alergias
                </label>
                <textarea className="input" rows={2} placeholder="Alergias conhecidas..."
                  value={form.allergies} onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))}
                  style={{ width: '100%', resize: 'vertical' }} />
              </div>

              {/* Notes */}
              <div className="form-group">
                <label style={{ fontSize: 13, fontWeight: 600, color: '#2D3748', marginBottom: 6, display: 'block' }}>Observações</label>
                <textarea className="input" rows={3} placeholder="Observações adicionais do profissional..."
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  style={{ width: '100%', resize: 'vertical' }} />
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.lead_id}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {saving ? 'Salvando...' : modal === 'edit' ? 'Salvar Alterações' : 'Criar Anamnese'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, width: '90%', textAlign: 'center' }}>
            <Trash2 size={36} color="#E53E3E" style={{ marginBottom: 12 }} />
            <h3 style={{ margin: '0 0 8px', color: '#2D3748' }}>Excluir Anamnese?</h3>
            <p style={{ color: '#718096', fontSize: 14, margin: '0 0 20px' }}>
              A anamnese de <strong>{deleteTarget.lead_name || 'este paciente'}</strong> será removida permanentemente.
            </p>
            <div className="modal-actions" style={{ justifyContent: 'center', display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDelete}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
