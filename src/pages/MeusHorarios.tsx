import { useState, useEffect } from 'react'
import { useAccount } from '../context/AccountContext'
import { useAuth } from '../context/AuthContext'
import { fetchProfessionalSchedules, saveProfessionalSchedules, type ProfessionalSchedule } from '../lib/api'
import { Clock, Save, Check, Plus, Trash2 } from 'lucide-react'

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

interface Turno {
  time_start: string
  time_end: string
  slot_duration: number
}

interface DayConfig {
  active: boolean
  turnos: Turno[]
}

const defaultTurno = (): Turno => ({ time_start: '08:00', time_end: '12:00', slot_duration: 60 })
const defaultDay = (): DayConfig => ({ active: false, turnos: [defaultTurno()] })

export default function MeusHorarios() {
  const { accountId } = useAccount()
  const { user } = useAuth()
  const [days, setDays] = useState<DayConfig[]>(Array.from({ length: 7 }, defaultDay))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!accountId || !user) return
    setLoading(true)
    fetchProfessionalSchedules(user.id, accountId)
      .then(schedules => {
        const newDays: DayConfig[] = Array.from({ length: 7 }, defaultDay)
        // Group by day_of_week (multiple rows per day = multiple turnos)
        for (const s of schedules) {
          const d = newDays[s.day_of_week]
          if (!d.active) {
            d.active = true
            d.turnos = []
          }
          d.turnos.push({ time_start: s.time_start, time_end: s.time_end, slot_duration: s.slot_duration || 60 })
        }
        setDays(newDays)
      })
      .finally(() => setLoading(false))
  }, [accountId, user])

  const toggleDay = (i: number) => {
    setDays(prev => prev.map((d, idx) => idx === i ? { ...d, active: !d.active, turnos: d.active ? d.turnos : [defaultTurno()] } : d))
    setSaved(false)
  }

  const addTurno = (dayIdx: number) => {
    setDays(prev => prev.map((d, i) => i === dayIdx ? { ...d, turnos: [...d.turnos, { time_start: '13:00', time_end: '18:00', slot_duration: d.turnos[0]?.slot_duration || 60 }] } : d))
    setSaved(false)
  }

  const removeTurno = (dayIdx: number, turnoIdx: number) => {
    setDays(prev => prev.map((d, i) => i === dayIdx ? { ...d, turnos: d.turnos.filter((_, ti) => ti !== turnoIdx) } : d))
    setSaved(false)
  }

  const updateTurno = (dayIdx: number, turnoIdx: number, field: keyof Turno, value: any) => {
    setDays(prev => prev.map((d, i) => i === dayIdx ? {
      ...d, turnos: d.turnos.map((t, ti) => ti === turnoIdx ? { ...t, [field]: field === 'slot_duration' ? parseInt(value) : value } : t)
    } : d))
    setSaved(false)
  }

  const handleSave = async () => {
    if (!accountId || !user) return
    setSaving(true)
    const schedules: Partial<ProfessionalSchedule>[] = []
    days.forEach((d, dayIdx) => {
      if (!d.active) return
      d.turnos.forEach(t => {
        if (t.time_start && t.time_end) {
          schedules.push({ day_of_week: dayIdx, time_start: t.time_start, time_end: t.time_end, slot_duration: t.slot_duration })
        }
      })
    })
    await saveProfessionalSchedules(user.id, accountId, schedules)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const getTotalSessions = () => {
    let total = 0
    days.forEach(d => {
      if (!d.active) return
      d.turnos.forEach(t => {
        const [sh, sm] = t.time_start.split(':').map(Number)
        const [eh, em] = t.time_end.split(':').map(Number)
        const mins = (eh * 60 + em) - (sh * 60 + sm)
        if (mins > 0) total += Math.floor(mins / t.slot_duration)
      })
    })
    return total
  }

  if (loading) return <div className="loading-container"><div className="spinner" /></div>

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Clock size={20} color="#5CB8B2" />
          <h1>Meus Horários</h1>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saved ? <><Check size={14} /> Salvo</> : <><Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}</>}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ fontSize: 13, color: '#718096' }}>
          Configure seus dias e turnos de atendimento. Adicione quantos turnos precisar por dia (manhã, tarde, noite).
          Os horários vagos serão calculados automaticamente para agendamento.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {days.map((d, dayIdx) => (
          <div key={dayIdx} className="card" style={{ padding: 16, opacity: d.active ? 1 : 0.5, transition: '0.2s' }}>
            {/* Day header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: d.active ? 12 : 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={d.active}
                  onChange={() => toggleDay(dayIdx)}
                  style={{ width: 18, height: 18, accentColor: '#5CB8B2' }}
                />
                <span style={{ fontSize: 14, fontWeight: 600, color: d.active ? '#2D3748' : '#A0AEC0' }}>
                  {DAYS[dayIdx]}
                </span>
              </label>
              {d.active && (
                <span style={{ fontSize: 11, color: '#A0AEC0' }}>
                  {d.turnos.reduce((sum, t) => {
                    const [sh, sm] = t.time_start.split(':').map(Number)
                    const [eh, em] = t.time_end.split(':').map(Number)
                    const mins = (eh * 60 + em) - (sh * 60 + sm)
                    return sum + (mins > 0 ? Math.floor(mins / t.slot_duration) : 0)
                  }, 0)} sessões
                </span>
              )}
            </div>

            {/* Turnos */}
            {d.active && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {d.turnos.map((t, turnoIdx) => (
                  <div key={turnoIdx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#F7F9FC', borderRadius: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: '#5CB8B2', fontWeight: 700, minWidth: 55 }}>
                      Turno {turnoIdx + 1}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 11, color: '#718096' }}>Das</span>
                      <input type="time" className="input" value={t.time_start} onChange={e => updateTurno(dayIdx, turnoIdx, 'time_start', e.target.value)} style={{ width: 100, padding: '6px 8px' }} />
                      <span style={{ fontSize: 11, color: '#718096' }}>às</span>
                      <input type="time" className="input" value={t.time_end} onChange={e => updateTurno(dayIdx, turnoIdx, 'time_end', e.target.value)} style={{ width: 100, padding: '6px 8px' }} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 11, color: '#718096' }}>Sessão:</span>
                      <select className="select" value={t.slot_duration} onChange={e => updateTurno(dayIdx, turnoIdx, 'slot_duration', e.target.value)} style={{ width: 90, padding: '6px 8px' }}>
                        <option value={30}>30 min</option>
                        <option value={45}>45 min</option>
                        <option value={60}>1 hora</option>
                        <option value={90}>1h30</option>
                        <option value={120}>2 horas</option>
                      </select>
                    </div>

                    {d.turnos.length > 1 && (
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeTurno(dayIdx, turnoIdx)} title="Remover turno" style={{ padding: 4 }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}

                <button className="btn btn-secondary btn-sm" onClick={() => addTurno(dayIdx)} style={{ alignSelf: 'flex-start', fontSize: 11 }}>
                  <Plus size={12} /> Adicionar turno
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16, padding: 16 }}>
        <div style={{ fontSize: 13, color: '#718096' }}>
          <strong>Resumo semanal:</strong>{' '}
          {days.filter(d => d.active).length} dias ativos —{' '}
          {getTotalSessions()} sessões/semana
        </div>
      </div>
    </div>
  )
}
