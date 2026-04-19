import { useState, useEffect, useCallback } from 'react'
import { Calendar, Clock, User, Plus, Check, X, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  fetchAppointments, fetchSlots, createAppointment, updateAppointment, fetchProfessionals,
  type Appointment, type TimeSlot, type Professional,
} from '../lib/api'
import { useAccount } from '../context/AccountContext'
import { useAuth } from '../context/AuthContext'

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#5CB8B2',
  confirmed: '#48BB78',
  completed: '#A0AEC0',
  cancelled: '#FC8181',
  no_show: '#ECC94B',
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8) // 8..20
const DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function getMondayOf(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

interface CreateModalState {
  date: string
  patientName: string
  professionalId: string
  slot: string
  notes: string
  slots: TimeSlot[]
  loadingSlots: boolean
}

interface DetailModalState {
  appointment: Appointment
}

export default function Agenda() {
  const { accountId } = useAccount()
  const { user } = useAuth()
  const isGerente = user?.role === 'gerente' || user?.role === 'super_admin'
  const isAtendente = user?.role === 'atendente'
  const canSeeAll = isGerente || isAtendente

  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()))
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [filterProfId, setFilterProfId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [createModal, setCreateModal] = useState<CreateModalState | null>(null)
  const [detailModal, setDetailModal] = useState<DetailModalState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekFrom = toISODate(weekStart)
  const weekTo = toISODate(addDays(weekStart, 6))

  // Load professionals
  useEffect(() => {
    if (!accountId) return
    fetchProfessionals(accountId).then(setProfessionals).catch(() => {})
  }, [accountId])

  // Profissional only sees their own; gerente/atendente see all
  useEffect(() => {
    if (!canSeeAll && user?.id) {
      setFilterProfId(String(user.id))
    }
  }, [canSeeAll, user?.id])

  const loadAppointments = useCallback(() => {
    if (!accountId) return
    setLoading(true)
    const params: Record<string, string> = { date_from: weekFrom, date_to: weekTo }
    if (filterProfId) params.professional_id = filterProfId
    fetchAppointments(accountId, params)
      .then(setAppointments)
      .catch(() => setError('Erro ao carregar agendamentos'))
      .finally(() => setLoading(false))
  }, [accountId, weekFrom, weekTo, filterProfId])

  useEffect(() => { loadAppointments() }, [loadAppointments])

  // Week navigation
  const prevWeek = () => setWeekStart(d => addDays(d, -7))
  const nextWeek = () => setWeekStart(d => addDays(d, 7))
  const goToday = () => setWeekStart(getMondayOf(new Date()))

  // Get appointments for a specific day
  const aptsForDay = (date: Date) => {
    const iso = toISODate(date)
    return appointments.filter(a => a.date === iso)
  }

  // Open create modal for a day
  const openCreate = (date: Date) => {
    const defaultProfId = canSeeAll ? (professionals[0]?.id ? String(professionals[0].id) : '') : String(user?.id ?? '')
    setCreateModal({
      date: toISODate(date),
      patientName: '',
      professionalId: defaultProfId,
      slot: '',
      slots: [],
      loadingSlots: false,
      notes: '',
    })
    setError('')
  }

  // Load slots when professional or date changes in modal
  const loadSlots = useCallback(async (profId: string, date: string) => {
    if (!accountId || !profId || !date) return
    setCreateModal(prev => prev ? { ...prev, loadingSlots: true, slot: '', slots: [] } : null)
    try {
      const slots = await fetchSlots(accountId, Number(profId), date)
      setCreateModal(prev => prev ? { ...prev, slots, loadingSlots: false } : null)
    } catch {
      setCreateModal(prev => prev ? { ...prev, loadingSlots: false } : null)
    }
  }, [accountId])

  useEffect(() => {
    if (createModal?.professionalId && createModal?.date) {
      loadSlots(createModal.professionalId, createModal.date)
    }
  }, [createModal?.professionalId, createModal?.date, loadSlots])

  const handleCreate = async () => {
    if (!accountId || !createModal) return
    if (!createModal.patientName.trim()) { setError('Informe o nome do paciente'); return }
    if (!createModal.professionalId) { setError('Selecione o profissional'); return }
    if (!createModal.slot) { setError('Selecione um horário'); return }
    const [time_start, time_end] = createModal.slot.split('|')
    setSaving(true)
    setError('')
    try {
      await createAppointment(accountId, {
        lead_id: 0, // backend resolves by name search; we pass name in notes or a separate field
        professional_id: Number(createModal.professionalId),
        date: createModal.date,
        time_start,
        time_end,
        status: 'scheduled',
        notes: createModal.notes || null,
        // @ts-ignore — backend accepts patient_name for lookup
        patient_name: createModal.patientName,
      })
      setCreateModal(null)
      loadAppointments()
    } catch (e: any) {
      setError(e.message || 'Erro ao criar agendamento')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (apt: Appointment, status: string) => {
    if (!accountId) return
    setSaving(true)
    try {
      const updated = await updateAppointment(apt.id, accountId, { status })
      setDetailModal({ appointment: updated })
      loadAppointments()
    } catch (e: any) {
      setError(e.message || 'Erro ao atualizar')
    } finally {
      setSaving(false)
    }
  }

  const todayStr = toISODate(new Date())

  return (
    <div style={{ padding: '24px', background: '#F0F4F8', minHeight: '100vh' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Calendar size={22} color="#5CB8B2" />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#2D3748', margin: 0 }}>Agenda</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {canSeeAll && (
            <select
              className="select"
              value={filterProfId}
              onChange={e => setFilterProfId(e.target.value)}
              style={{ minWidth: 160 }}
            >
              <option value="">Todos os profissionais</option>
              {professionals.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <button className="btn btn-secondary btn-sm" onClick={goToday}>Hoje</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button className="btn btn-secondary btn-sm" onClick={prevWeek} style={{ padding: '4px 8px' }}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 14, color: '#2D3748', fontWeight: 600, minWidth: 180, textAlign: 'center' }}>
              {formatDate(weekStart)} – {formatDate(addDays(weekStart, 6))}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={nextWeek} style={{ padding: '4px 8px' }}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ background: '#F7FAFC' }} />
          {weekDays.map((day, i) => {
            const iso = toISODate(day)
            const isToday = iso === todayStr
            return (
              <div
                key={i}
                style={{
                  padding: '10px 4px',
                  textAlign: 'center',
                  background: isToday ? '#EBF8F7' : '#F7FAFC',
                  borderLeft: '1px solid #E2E8F0',
                }}
              >
                <div style={{ fontSize: 11, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{DAY_NAMES[i]}</div>
                <div style={{
                  fontSize: 15, fontWeight: 700,
                  color: isToday ? '#5CB8B2' : '#2D3748',
                  marginTop: 2,
                }}>{day.getDate()}</div>
              </div>
            )
          })}
        </div>

        {/* Time rows */}
        <div style={{ position: 'relative', overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
          {loading && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, fontSize: 14, color: '#718096' }}>
              Carregando...
            </div>
          )}
          {HOURS.map(hour => (
            <div
              key={hour}
              style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: '1px solid #E2E8F0', minHeight: 56 }}
            >
              <div style={{ padding: '4px 8px', fontSize: 11, color: '#A0AEC0', textAlign: 'right', paddingTop: 6, background: '#FAFAFA' }}>
                {`${hour}:00`}
              </div>
              {weekDays.map((day, di) => {
                const dayApts = aptsForDay(day).filter(a => {
                  const aptHour = parseInt(a.time_start.split(':')[0], 10)
                  return aptHour === hour
                })
                return (
                  <div
                    key={di}
                    onClick={() => openCreate(day)}
                    style={{
                      borderLeft: '1px solid #E2E8F0',
                      padding: '2px 4px',
                      cursor: 'pointer',
                      position: 'relative',
                      minHeight: 56,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F0F4F8')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    {dayApts.map(apt => (
                      <div
                        key={apt.id}
                        onClick={e => { e.stopPropagation(); setDetailModal({ appointment: apt }); setError('') }}
                        style={{
                          background: STATUS_COLORS[apt.status] || '#5CB8B2',
                          color: '#fff',
                          borderRadius: 4,
                          padding: '2px 6px',
                          marginBottom: 2,
                          fontSize: 11,
                          lineHeight: '1.4',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                        }}
                      >
                        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {apt.lead_name || 'Paciente'}
                        </div>
                        <div style={{ opacity: 0.9 }}>{apt.time_start.slice(0, 5)}</div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#718096' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_COLORS[key] }} />
            {label}
          </div>
        ))}
        <button
          className="btn btn-primary btn-sm"
          onClick={() => openCreate(new Date())}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={14} /> Novo agendamento
        </button>
      </div>

      {/* Create Modal */}
      {createModal && (
        <div className="modal-overlay" onClick={() => setCreateModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#2D3748', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={18} color="#5CB8B2" /> Novo agendamento
              </h2>
              <button onClick={() => setCreateModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#718096' }}>
                <X size={18} />
              </button>
            </div>

            {error && (
              <div style={{ background: '#FFF5F5', border: '1px solid #FC8181', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 13, color: '#C53030' }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label style={{ fontSize: 13, fontWeight: 600, color: '#4A5568', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <User size={13} /> Paciente
              </label>
              <input
                className="input"
                placeholder="Nome do paciente"
                value={createModal.patientName}
                onChange={e => setCreateModal(prev => prev ? { ...prev, patientName: e.target.value } : null)}
              />
            </div>

            {canSeeAll && (
              <div className="form-group">
                <label style={{ fontSize: 13, fontWeight: 600, color: '#4A5568', marginBottom: 6, display: 'block' }}>Profissional</label>
                <select
                  className="select"
                  value={createModal.professionalId}
                  onChange={e => setCreateModal(prev => prev ? { ...prev, professionalId: e.target.value } : null)}
                >
                  <option value="">Selecione...</option>
                  {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}

            <div className="form-group">
              <label style={{ fontSize: 13, fontWeight: 600, color: '#4A5568', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <Calendar size={13} /> Data
              </label>
              <input
                className="input"
                type="date"
                value={createModal.date}
                onChange={e => setCreateModal(prev => prev ? { ...prev, date: e.target.value } : null)}
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: 13, fontWeight: 600, color: '#4A5568', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <Clock size={13} /> Horário
              </label>
              {createModal.loadingSlots ? (
                <div style={{ fontSize: 13, color: '#718096', padding: '8px 0' }}>Carregando horários...</div>
              ) : createModal.slots.length === 0 ? (
                <div style={{ fontSize: 13, color: '#A0AEC0', padding: '8px 0' }}>
                  {createModal.professionalId && createModal.date ? 'Nenhum horário disponível' : 'Selecione profissional e data'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {createModal.slots.filter(s => s.available).map(s => {
                    const val = `${s.time_start}|${s.time_end}`
                    const selected = createModal.slot === val
                    return (
                      <button
                        key={val}
                        onClick={() => setCreateModal(prev => prev ? { ...prev, slot: val } : null)}
                        style={{
                          padding: '4px 10px', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontWeight: 500,
                          background: selected ? '#5CB8B2' : '#F7FAFC',
                          color: selected ? '#fff' : '#4A5568',
                          border: `1px solid ${selected ? '#5CB8B2' : '#E2E8F0'}`,
                          transition: 'all 0.15s',
                        }}
                      >
                        {s.time_start.slice(0, 5)}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="form-group">
              <label style={{ fontSize: 13, fontWeight: 600, color: '#4A5568', marginBottom: 6, display: 'block' }}>Observações</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Observações opcionais..."
                value={createModal.notes}
                onChange={e => setCreateModal(prev => prev ? { ...prev, notes: e.target.value } : null)}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setCreateModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? 'Salvando...' : 'Agendar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailModal && (
        <div className="modal-overlay" onClick={() => setDetailModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#2D3748', margin: 0 }}>Agendamento</h2>
              <button onClick={() => setDetailModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#718096' }}>
                <X size={18} />
              </button>
            </div>

            {error && (
              <div style={{ background: '#FFF5F5', border: '1px solid #FC8181', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 13, color: '#C53030' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              <InfoRow icon={<User size={14} />} label="Paciente" value={detailModal.appointment.lead_name || '—'} />
              <InfoRow icon={<User size={14} />} label="Profissional" value={detailModal.appointment.professional_name || '—'} />
              <InfoRow icon={<Calendar size={14} />} label="Data" value={new Date(detailModal.appointment.date + 'T00:00:00').toLocaleDateString('pt-BR')} />
              <InfoRow icon={<Clock size={14} />} label="Horário" value={`${detailModal.appointment.time_start.slice(0, 5)} – ${detailModal.appointment.time_end.slice(0, 5)}`} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#718096', minWidth: 90 }}>Status</span>
                <span style={{
                  background: STATUS_COLORS[detailModal.appointment.status] || '#A0AEC0',
                  color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600,
                }}>
                  {STATUS_LABELS[detailModal.appointment.status] || detailModal.appointment.status}
                </span>
              </div>
              {detailModal.appointment.notes && (
                <InfoRow icon={null} label="Obs." value={detailModal.appointment.notes} />
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: '#718096', marginBottom: 8, fontWeight: 600 }}>Alterar status:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.entries(STATUS_LABELS).map(([key, label]) => {
                  const isCurrent = detailModal.appointment.status === key
                  return (
                    <button
                      key={key}
                      disabled={isCurrent || saving}
                      onClick={() => handleStatusChange(detailModal.appointment, key)}
                      style={{
                        padding: '4px 10px', borderRadius: 4, fontSize: 12, cursor: isCurrent ? 'default' : 'pointer',
                        fontWeight: 500, border: `1px solid ${STATUS_COLORS[key]}`,
                        background: isCurrent ? STATUS_COLORS[key] : 'transparent',
                        color: isCurrent ? '#fff' : STATUS_COLORS[key],
                        opacity: saving ? 0.6 : 1,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      {isCurrent && <Check size={11} />}
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDetailModal(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      {icon && <span style={{ color: '#5CB8B2', marginTop: 1 }}>{icon}</span>}
      <span style={{ fontSize: 12, color: '#718096', minWidth: icon ? 82 : 90 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#2D3748', fontWeight: 500 }}>{value}</span>
    </div>
  )
}
