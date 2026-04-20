import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Calendar, Clock, User, CheckCircle, ChevronLeft, ChevronRight, FileText } from 'lucide-react'

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

interface Slot { time_start: string; time_end: string }
interface BookingInfo { clinic_name: string; lead_name: string; professional_name: string; professional_id: number; account_id: number }
interface Confirmation { date: string; time_start: string; time_end: string; professional_name: string; lead_name: string }

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function toISO(d: Date) { return d.toISOString().slice(0, 10) }
function formatDateFull(d: string) {
  const dt = new Date(d + 'T12:00:00')
  return `${dt.getDate()} de ${MONTHS[dt.getMonth()]}, ${DAYS[dt.getDay()]}`
}

export default function Booking() {
  const { token } = useParams<{ token: string }>()
  const [step, setStep] = useState<'loading' | 'date' | 'time' | 'confirm' | 'done' | 'error' | 'used'>('loading')
  const [info, setInfo] = useState<BookingInfo | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Load booking info
  useEffect(() => {
    fetch(`${BASE}/api/booking/t/${token}`)
      .then(async r => {
        const d = await r.json()
        if (!r.ok) {
          if (r.status === 410) { setStep('used'); return }
          setErrorMsg(d.error || 'Link invalido'); setStep('error'); return
        }
        setInfo(d); setStep('date')
      })
      .catch(() => { setErrorMsg('Erro de conexao'); setStep('error') })
  }, [token])

  // Load slots
  useEffect(() => {
    if (!selectedDate || !token) return
    setLoadingSlots(true)
    fetch(`${BASE}/api/booking/t/${token}/slots?date=${selectedDate}`)
      .then(r => r.json())
      .then(d => { setSlots(d.slots || []); setLoadingSlots(false) })
      .catch(() => setLoadingSlots(false))
  }, [selectedDate, token])

  const handleBook = async () => {
    if (!selectedSlot) return
    setSaving(true); setError('')
    try {
      const res = await fetch(`${BASE}/api/booking/t/${token}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, time_start: selectedSlot.time_start, time_end: selectedSlot.time_end, notes }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao agendar'); setSaving(false); return }
      setConfirmation(data.appointment); setStep('done')
    } catch { setError('Erro de conexao') }
    setSaving(false)
  }

  const today = toISO(new Date())
  const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate()
  const firstDow = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1).getDay()
  const calDays: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  const selectDate = (day: number) => {
    const d = new Date(calMonth.getFullYear(), calMonth.getMonth(), day)
    const iso = toISO(d)
    if (iso < today) return
    setSelectedDate(iso); setSelectedSlot(null); setStep('time')
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh', background: 'linear-gradient(135deg, #E6F7F6 0%, #F0F4F8 50%, #E8F4F8 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Inter', sans-serif",
  }
  const cardStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 480,
    boxShadow: '0 8px 40px rgba(0,0,0,0.08)', border: '1px solid #E2E8F0',
  }

  if (step === 'loading') return <div style={containerStyle}><div style={cardStyle}><div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto 12px', borderTopColor: '#5CB8B2' }} /><p style={{ color: '#718096' }}>Carregando...</p></div></div></div>
  if (step === 'error') return <div style={containerStyle}><div style={cardStyle}><div style={{ textAlign: 'center', padding: 40, color: '#718096' }}><p style={{ fontSize: 18, fontWeight: 600, color: '#2D3748' }}>Link invalido</p><p>{errorMsg}</p></div></div></div>
  if (step === 'used') return <div style={containerStyle}><div style={cardStyle}><div style={{ textAlign: 'center', padding: 40 }}><CheckCircle size={40} color="#48BB78" style={{ marginBottom: 12 }} /><p style={{ fontSize: 18, fontWeight: 600, color: '#2D3748' }}>Agendamento ja realizado</p><p style={{ color: '#718096' }}>Este link ja foi utilizado.</p></div></div></div>

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src={`${BASE}/logo.png`} alt="" style={{ height: 50, marginBottom: 10 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#2D3748', margin: 0, fontFamily: "'Outfit', sans-serif" }}>{info?.clinic_name}</h1>
          <p style={{ color: '#718096', fontSize: 13, marginTop: 4 }}>Agendamento de consulta</p>
        </div>

        {/* Patient + Professional info */}
        <div style={{ background: '#F7F9FC', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div><span style={{ color: '#718096' }}>Paciente:</span> <strong style={{ color: '#2D3748' }}>{info?.lead_name}</strong></div>
            <div><span style={{ color: '#718096' }}>Profissional:</span> <strong style={{ color: '#2D3748' }}>{info?.professional_name}</strong></div>
          </div>
        </div>

        {/* Steps */}
        {step !== 'done' && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
            {['Data', 'Horario', 'Confirmar'].map((s, i) => {
              const steps = ['date', 'time', 'confirm']
              const currentIdx = steps.indexOf(step)
              const isActive = i <= currentIdx
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: isActive ? '#5CB8B2' : '#E2E8F0', color: isActive ? '#fff' : '#A0AEC0', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
                  <span style={{ fontSize: 11, color: isActive ? '#2D3748' : '#A0AEC0', fontWeight: 500 }}>{s}</span>
                  {i < 2 && <div style={{ width: 20, height: 1, background: '#E2E8F0', margin: '0 4px' }} />}
                </div>
              )
            })}
          </div>
        )}

        {/* Step: Date */}
        {step === 'date' && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#2D3748', marginBottom: 16 }}>Escolha a data</h2>
            <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F7F9FC' }}>
                <button onClick={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><ChevronLeft size={16} color="#718096" /></button>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#2D3748' }}>{MONTHS[calMonth.getMonth()]} {calMonth.getFullYear()}</span>
                <button onClick={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><ChevronRight size={16} color="#718096" /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', padding: 8, gap: 2 }}>
                {DAYS.map(d => <div key={d} style={{ fontSize: 10, color: '#A0AEC0', fontWeight: 600, padding: 4 }}>{d}</div>)}
                {calDays.map((day, i) => {
                  if (!day) return <div key={`e${i}`} />
                  const iso = toISO(new Date(calMonth.getFullYear(), calMonth.getMonth(), day))
                  const isPast = iso < today
                  const isSelected = iso === selectedDate
                  return (
                    <button key={i} disabled={isPast} onClick={() => selectDate(day)}
                      style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: isPast ? 'default' : 'pointer', background: isSelected ? '#5CB8B2' : 'transparent', color: isSelected ? '#fff' : isPast ? '#CBD5E0' : '#2D3748', fontSize: 13, fontWeight: isSelected ? 700 : 400, transition: '0.15s', margin: '0 auto' }}>
                      {day}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step: Time */}
        {step === 'time' && (
          <div>
            <button onClick={() => { setStep('date'); setSelectedSlot(null) }} style={{ background: 'none', border: 'none', color: '#5CB8B2', fontSize: 12, cursor: 'pointer', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ChevronLeft size={14} /> Trocar data
            </button>
            <div style={{ fontSize: 12, color: '#718096', marginBottom: 12 }}>
              <Calendar size={12} color="#5CB8B2" /> <strong style={{ color: '#2D3748' }}>{formatDateFull(selectedDate)}</strong>
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#2D3748', marginBottom: 16 }}>Escolha o horario</h2>

            {loadingSlots ? (
              <div style={{ textAlign: 'center', padding: 30 }}><div className="spinner" style={{ margin: '0 auto', borderTopColor: '#5CB8B2' }} /></div>
            ) : slots.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#718096' }}>
                <Clock size={24} style={{ marginBottom: 8, color: '#A0AEC0' }} />
                <p>Nenhum horario disponivel neste dia.</p>
                <button onClick={() => setStep('date')} style={{ marginTop: 12, padding: '8px 16px', border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#718096', fontSize: 12 }}>Escolher outra data</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {slots.map(s => (
                  <button key={s.time_start} onClick={() => { setSelectedSlot(s); setStep('confirm') }}
                    style={{ padding: '12px 8px', border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff', cursor: 'pointer', transition: '0.15s', textAlign: 'center' }}
                    onMouseOver={e => (e.currentTarget.style.borderColor = '#5CB8B2')} onMouseOut={e => (e.currentTarget.style.borderColor = '#E2E8F0')}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#2D3748' }}>{s.time_start}</div>
                    <div style={{ fontSize: 10, color: '#A0AEC0' }}>ate {s.time_end}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && (
          <div>
            <button onClick={() => setStep('time')} style={{ background: 'none', border: 'none', color: '#5CB8B2', fontSize: 12, cursor: 'pointer', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ChevronLeft size={14} /> Trocar horario
            </button>

            <div style={{ background: '#F7F9FC', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: '#718096' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <span><User size={12} color="#5CB8B2" /> {info?.professional_name}</span>
                <span><Calendar size={12} color="#5CB8B2" /> {formatDateFull(selectedDate)}</span>
                <span><Clock size={12} color="#5CB8B2" /> {selectedSlot?.time_start} - {selectedSlot?.time_end}</span>
              </div>
            </div>

            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#2D3748', marginBottom: 16 }}>Confirmar agendamento</h2>

            {error && <div style={{ background: '#FED7D7', color: '#C53030', padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{error}</div>}

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#718096', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><FileText size={12} /> Observacao (opcional)</label>
              <textarea className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Descreva brevemente o motivo da consulta" rows={3} style={{ resize: 'vertical' }} />
            </div>

            <button onClick={handleBook} disabled={saving}
              style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #5CB8B2, #7DCEC9)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'Agendando...' : 'Confirmar Agendamento'}
            </button>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && confirmation && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#C6F6D5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle size={32} color="#48BB78" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#2D3748', marginBottom: 4, fontFamily: "'Outfit', sans-serif" }}>Agendamento confirmado!</h2>
            <p style={{ color: '#718096', fontSize: 13, marginBottom: 20 }}>Sua consulta foi marcada com sucesso.</p>

            <div style={{ background: '#F7F9FC', borderRadius: 10, padding: 16, textAlign: 'left', fontSize: 13 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <User size={14} color="#5CB8B2" />
                  <span style={{ color: '#718096' }}>Profissional:</span>
                  <span style={{ fontWeight: 600, color: '#2D3748' }}>{confirmation.professional_name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={14} color="#5CB8B2" />
                  <span style={{ color: '#718096' }}>Data:</span>
                  <span style={{ fontWeight: 600, color: '#2D3748' }}>{formatDateFull(confirmation.date)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={14} color="#5CB8B2" />
                  <span style={{ color: '#718096' }}>Horario:</span>
                  <span style={{ fontWeight: 600, color: '#2D3748' }}>{confirmation.time_start} - {confirmation.time_end}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
