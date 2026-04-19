import { Router } from 'express'
import crypto from 'crypto'
import db from '../db.js'
import { requireRole } from '../middleware/auth.js'

const router = Router()

// ─── Generate booking link (authenticated — atendente/gerente/admin) ────
router.post('/generate', (req, res) => {
  if (!req.accountId) return res.status(400).json({ error: 'account_id required' })
  const { lead_id, professional_id } = req.body
  if (!lead_id || !professional_id) return res.status(400).json({ error: 'lead_id e professional_id obrigatorios' })

  // Verify lead and professional exist
  const lead = db.prepare('SELECT id, name FROM leads WHERE id = ? AND account_id = ?').get(lead_id, req.accountId)
  if (!lead) return res.status(404).json({ error: 'Paciente nao encontrado' })
  const prof = db.prepare("SELECT id, name FROM users WHERE id = ? AND role = 'profissional' AND account_id = ?").get(professional_id, req.accountId)
  if (!prof) return res.status(404).json({ error: 'Profissional nao encontrado' })

  const token = crypto.randomBytes(16).toString('hex')

  db.prepare(
    'INSERT INTO booking_links (account_id, lead_id, professional_id, token, created_by) VALUES (?, ?, ?, ?, ?)'
  ).run(req.accountId, lead_id, professional_id, token, req.user.id)

  const link = db.prepare('SELECT * FROM booking_links WHERE token = ?').get(token)
  res.json({ link, token, lead_name: lead.name, professional_name: prof.name })
})

// ─── List booking links (authenticated) ────
router.get('/links', (req, res) => {
  if (!req.accountId) return res.status(400).json({ error: 'account_id required' })
  const links = db.prepare(`
    SELECT bl.*, l.name as lead_name, l.phone as lead_phone, u.name as professional_name, c.name as created_by_name
    FROM booking_links bl
    LEFT JOIN leads l ON l.id = bl.lead_id
    LEFT JOIN users u ON u.id = bl.professional_id
    LEFT JOIN users c ON c.id = bl.created_by
    WHERE bl.account_id = ?
    ORDER BY bl.created_at DESC
  `).all(req.accountId)
  res.json({ links })
})

// ─── Delete booking link ────
router.delete('/links/:id', (req, res) => {
  db.prepare('DELETE FROM booking_links WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ══════════════════════════════════════════════
// PUBLIC ROUTES (no auth) — used by patients
// ══════════════════════════════════════════════

// Get booking info by token (public)
router.get('/:token', (req, res) => {
  const link = db.prepare(`
    SELECT bl.*, l.name as lead_name, u.name as professional_name, a.name as clinic_name
    FROM booking_links bl
    LEFT JOIN leads l ON l.id = bl.lead_id
    LEFT JOIN users u ON u.id = bl.professional_id
    LEFT JOIN accounts a ON a.id = bl.account_id
    WHERE bl.token = ?
  `).get(req.params.token)

  if (!link) return res.status(404).json({ error: 'Link invalido ou expirado' })
  if (link.status !== 'active') return res.status(410).json({ error: 'Este link ja foi utilizado', status: link.status })

  res.json({
    clinic_name: link.clinic_name,
    lead_name: link.lead_name,
    professional_name: link.professional_name,
    professional_id: link.professional_id,
    account_id: link.account_id,
  })
})

// Get slots for booking link (public)
router.get('/:token/slots', (req, res) => {
  const link = db.prepare('SELECT * FROM booking_links WHERE token = ? AND status = ?').get(req.params.token, 'active')
  if (!link) return res.status(404).json({ error: 'Link invalido' })

  const { date } = req.query
  if (!date) return res.status(400).json({ error: 'date required' })

  const d = new Date(date + 'T00:00:00')
  const dayOfWeek = d.getDay()

  const schedules = db.prepare(
    'SELECT * FROM professional_schedules WHERE professional_id = ? AND account_id = ? AND day_of_week = ? AND is_active = 1 ORDER BY time_start'
  ).all(link.professional_id, link.account_id, dayOfWeek)

  if (!schedules.length) return res.json({ slots: [], message: 'Profissional nao atende neste dia' })

  const existing = db.prepare(
    "SELECT time_start, time_end FROM appointments WHERE professional_id = ? AND date = ? AND status != 'cancelled'"
  ).all(link.professional_id, date)

  const slots = []
  let duration = 60
  for (const schedule of schedules) {
    const [startH, startM] = schedule.time_start.split(':').map(Number)
    const [endH, endM] = schedule.time_end.split(':').map(Number)
    duration = schedule.slot_duration || 60
    let current = startH * 60 + startM
    const end = endH * 60 + endM

    while (current + duration <= end) {
      const slotStart = `${String(Math.floor(current / 60)).padStart(2, '0')}:${String(current % 60).padStart(2, '0')}`
      const slotEnd = `${String(Math.floor((current + duration) / 60)).padStart(2, '0')}:${String((current + duration) % 60).padStart(2, '0')}`

      const isBooked = existing.some(e => slotStart < e.time_end.slice(0, 5) && slotEnd > e.time_start.slice(0, 5))
      if (!isBooked) slots.push({ time_start: slotStart, time_end: slotEnd })
      current += duration
    }
  }

  res.json({ slots, duration })
})

// Book appointment via token (public)
router.post('/:token/book', (req, res) => {
  const link = db.prepare('SELECT * FROM booking_links WHERE token = ? AND status = ?').get(req.params.token, 'active')
  if (!link) return res.status(404).json({ error: 'Link invalido ou ja utilizado' })

  const { date, time_start, time_end, notes } = req.body
  if (!date || !time_start || !time_end) return res.status(400).json({ error: 'date, time_start e time_end obrigatorios' })

  // Check conflict
  const conflict = db.prepare(`
    SELECT id FROM appointments WHERE professional_id = ? AND date = ? AND status != 'cancelled'
    AND time_start < ? AND time_end > ?
  `).get(link.professional_id, date, time_end, time_start)
  if (conflict) return res.status(409).json({ error: 'Este horario acabou de ser reservado. Tente outro.' })

  // Create appointment
  const result = db.prepare(`
    INSERT INTO appointments (account_id, lead_id, professional_id, date, time_start, time_end, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled')
  `).run(link.account_id, link.lead_id, link.professional_id, date, time_start, time_end, notes || null)

  // Mark link as used
  db.prepare("UPDATE booking_links SET status = 'used', used_at = datetime('now'), appointment_id = ? WHERE id = ?").run(result.lastInsertRowid, link.id)

  const prof = db.prepare('SELECT name FROM users WHERE id = ?').get(link.professional_id)
  const lead = db.prepare('SELECT name FROM leads WHERE id = ?').get(link.lead_id)

  res.json({
    ok: true,
    appointment: {
      id: result.lastInsertRowid,
      date, time_start, time_end,
      professional_name: prof?.name || '',
      lead_name: lead?.name || '',
    }
  })
})

export default router
