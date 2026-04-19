import { Router } from 'express'
import db from '../db.js'
import { requireRole } from '../middleware/auth.js'

const router = Router()

// List appointments (filtered by date range, professional)
router.get('/', (req, res) => {
  if (!req.accountId) return res.status(400).json({ error: 'account_id required' })
  const { date, week_start, week_end, date_from, date_to, professional_id } = req.query

  let where = 'a.account_id = ?'
  const params = [req.accountId]

  // Profissional only sees their own
  if (req.user.role === 'profissional') {
    where += ' AND a.professional_id = ?'
    params.push(req.user.id)
  } else if (professional_id) {
    where += ' AND a.professional_id = ?'
    params.push(parseInt(professional_id))
  }

  if (date) {
    where += ' AND a.date = ?'
    params.push(date)
  } else if (week_start && week_end) {
    where += ' AND a.date BETWEEN ? AND ?'
    params.push(week_start, week_end)
  } else if (date_from && date_to) {
    where += ' AND a.date BETWEEN ? AND ?'
    params.push(date_from, date_to)
  }

  const appointments = db.prepare(`
    SELECT a.*, l.name as lead_name, l.phone as lead_phone, l.profile_pic_url,
      u.name as professional_name
    FROM appointments a
    LEFT JOIN leads l ON l.id = a.lead_id
    LEFT JOIN users u ON u.id = a.professional_id
    WHERE ${where}
    ORDER BY a.date ASC, a.time_start ASC
  `).all(...params)

  res.json({ appointments })
})

// Get available slots for a professional on a date
router.get('/slots', (req, res) => {
  if (!req.accountId) return res.status(400).json({ error: 'account_id required' })
  const { professional_id, date } = req.query
  if (!professional_id || !date) return res.status(400).json({ error: 'professional_id and date required' })

  const d = new Date(date + 'T00:00:00')
  const dayOfWeek = d.getDay()

  // Get professional's schedules for this day (multiple turnos per day)
  const schedules = db.prepare(
    'SELECT * FROM professional_schedules WHERE professional_id = ? AND account_id = ? AND day_of_week = ? AND is_active = 1 ORDER BY time_start'
  ).all(parseInt(professional_id), req.accountId, dayOfWeek)

  if (!schedules.length) return res.json({ slots: [], message: 'Profissional nao atende neste dia' })

  // Get existing appointments
  const existing = db.prepare(
    "SELECT time_start, time_end FROM appointments WHERE professional_id = ? AND date = ? AND status != 'cancelled'"
  ).all(parseInt(professional_id), date)

  // Generate slots from all turnos
  const slots = []
  for (const schedule of schedules) {
    const [startH, startM] = schedule.time_start.split(':').map(Number)
    const [endH, endM] = schedule.time_end.split(':').map(Number)
    const duration = schedule.slot_duration || 60
    let current = startH * 60 + startM
    const end = endH * 60 + endM

    while (current + duration <= end) {
      const slotStart = `${String(Math.floor(current / 60)).padStart(2, '0')}:${String(current % 60).padStart(2, '0')}`
      const slotEnd = `${String(Math.floor((current + duration) / 60)).padStart(2, '0')}:${String((current + duration) % 60).padStart(2, '0')}`

      const isBooked = existing.some(e => {
        const eStart = e.time_start.slice(0, 5)
        const eEnd = e.time_end.slice(0, 5)
        return slotStart < eEnd && slotEnd > eStart
      })

      slots.push({ time_start: slotStart, time_end: slotEnd, available: !isBooked })
      current += duration
    }
  }

  res.json({ slots })
})

// Create appointment
router.post('/', (req, res) => {
  if (!req.accountId) return res.status(400).json({ error: 'account_id required' })
  let { lead_id, patient_name, professional_id, date, time_start, time_end, notes } = req.body
  if (!professional_id || !date || !time_start || !time_end) {
    return res.status(400).json({ error: 'professional_id, date, time_start, time_end required' })
  }

  // If patient_name provided instead of lead_id, search or create lead
  if (!lead_id && patient_name) {
    let lead = db.prepare('SELECT id FROM leads WHERE account_id = ? AND name LIKE ? LIMIT 1').get(req.accountId, `%${patient_name}%`)
    if (!lead) {
      const r = db.prepare('INSERT INTO leads (account_id, name, source) VALUES (?, ?, ?)').run(req.accountId, patient_name, 'consulta')
      lead = { id: r.lastInsertRowid }
    }
    lead_id = lead.id
  }
  if (!lead_id) return res.status(400).json({ error: 'lead_id ou patient_name required' })

  // Check for conflicts
  const conflict = db.prepare(`
    SELECT id FROM appointments WHERE professional_id = ? AND date = ? AND status != 'cancelled'
    AND time_start < ? AND time_end > ?
  `).get(professional_id, date, time_end, time_start)

  if (conflict) return res.status(409).json({ error: 'Horario ja ocupado' })

  const result = db.prepare(`
    INSERT INTO appointments (account_id, lead_id, professional_id, date, time_start, time_end, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.accountId, lead_id, professional_id, date, time_start, time_end, notes || null, req.user.id)

  const appointment = db.prepare(`
    SELECT a.*, l.name as lead_name, l.phone as lead_phone, u.name as professional_name
    FROM appointments a LEFT JOIN leads l ON l.id = a.lead_id LEFT JOIN users u ON u.id = a.professional_id
    WHERE a.id = ?
  `).get(result.lastInsertRowid)

  res.json({ appointment })
})

// Update appointment status
router.put('/:id', (req, res) => {
  const { status, notes, date, time_start, time_end } = req.body
  const sets = []; const params = []
  if (status) { sets.push('status = ?'); params.push(status) }
  if (notes !== undefined) { sets.push('notes = ?'); params.push(notes) }
  if (date) { sets.push('date = ?'); params.push(date) }
  if (time_start) { sets.push('time_start = ?'); params.push(time_start) }
  if (time_end) { sets.push('time_end = ?'); params.push(time_end) }
  if (sets.length === 0) return res.status(400).json({ error: 'Nada pra atualizar' })
  sets.push("updated_at = datetime('now')")
  params.push(req.params.id)
  db.prepare(`UPDATE appointments SET ${sets.join(', ')} WHERE id = ?`).run(...params)

  const appointment = db.prepare(`
    SELECT a.*, l.name as lead_name, l.phone as lead_phone, u.name as professional_name
    FROM appointments a LEFT JOIN leads l ON l.id = a.lead_id LEFT JOIN users u ON u.id = a.professional_id
    WHERE a.id = ?
  `).get(req.params.id)
  res.json({ appointment })
})

// Delete appointment
router.delete('/:id', requireRole('super_admin', 'gerente'), (req, res) => {
  db.prepare('DELETE FROM appointments WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ─── Professional Schedules ─────────────────────────────────────

// Get schedules for a professional
router.get('/schedules/:professionalId', (req, res) => {
  if (!req.accountId) return res.status(400).json({ error: 'account_id required' })
  const schedules = db.prepare(
    'SELECT * FROM professional_schedules WHERE professional_id = ? AND account_id = ? ORDER BY day_of_week'
  ).all(req.params.professionalId, req.accountId)
  res.json({ schedules })
})

// Set schedules (full replacement for a professional)
router.put('/schedules/:professionalId', requireRole('super_admin', 'gerente', 'profissional'), (req, res) => {
  if (!req.accountId) return res.status(400).json({ error: 'account_id required' })
  const { schedules } = req.body
  if (!Array.isArray(schedules)) return res.status(400).json({ error: 'schedules array required' })

  // Profissional can only edit their own
  if (req.user.role === 'profissional' && parseInt(req.params.professionalId) !== req.user.id) {
    return res.status(403).json({ error: 'So pode editar sua propria agenda' })
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM professional_schedules WHERE professional_id = ? AND account_id = ?').run(req.params.professionalId, req.accountId)
    const stmt = db.prepare('INSERT INTO professional_schedules (professional_id, account_id, day_of_week, time_start, time_end, slot_duration) VALUES (?, ?, ?, ?, ?, ?)')
    for (const s of schedules) {
      if (s.time_start && s.time_end) {
        stmt.run(req.params.professionalId, req.accountId, s.day_of_week, s.time_start, s.time_end, s.slot_duration || 60)
      }
    }
  })
  tx()

  const updated = db.prepare(
    'SELECT * FROM professional_schedules WHERE professional_id = ? AND account_id = ? ORDER BY day_of_week'
  ).all(req.params.professionalId, req.accountId)
  res.json({ schedules: updated })
})

// List professionals for this account
router.get('/professionals', (req, res) => {
  if (!req.accountId) return res.status(400).json({ error: 'account_id required' })
  const professionals = db.prepare(
    "SELECT id, name, email, avatar_url FROM users WHERE account_id = ? AND role = 'profissional' AND is_active = 1 ORDER BY name"
  ).all(req.accountId)
  res.json({ professionals })
})

export default router
