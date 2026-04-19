import { Router } from 'express'
import db from '../db.js'

const router = Router()

// List anamneses for a lead
router.get('/lead/:leadId', (req, res) => {
  if (!req.accountId) return res.status(400).json({ error: 'account_id required' })
  const anamneses = db.prepare(`
    SELECT an.*, u.name as professional_name
    FROM anamneses an LEFT JOIN users u ON u.id = an.professional_id
    WHERE an.lead_id = ? AND an.account_id = ?
    ORDER BY an.created_at DESC
  `).all(req.params.leadId, req.accountId)
  res.json({ anamneses })
})

// Get single anamnese
router.get('/:id', (req, res) => {
  const anamnese = db.prepare(`
    SELECT an.*, u.name as professional_name, l.name as lead_name, l.phone as lead_phone
    FROM anamneses an LEFT JOIN users u ON u.id = an.professional_id LEFT JOIN leads l ON l.id = an.lead_id
    WHERE an.id = ?
  `).get(req.params.id)
  if (!anamnese) return res.status(404).json({ error: 'Anamnese nao encontrada' })
  res.json({ anamnese })
})

// List all anamneses (for professionals: only theirs)
router.get('/', (req, res) => {
  if (!req.accountId) return res.status(400).json({ error: 'account_id required' })
  let where = 'an.account_id = ?'
  const params = [req.accountId]

  if (req.user.role === 'profissional') {
    where += ' AND an.professional_id = ?'
    params.push(req.user.id)
  }

  const anamneses = db.prepare(`
    SELECT an.*, u.name as professional_name, l.name as lead_name, l.phone as lead_phone
    FROM anamneses an LEFT JOIN users u ON u.id = an.professional_id LEFT JOIN leads l ON l.id = an.lead_id
    WHERE ${where}
    ORDER BY an.created_at DESC
  `).all(...params)
  res.json({ anamneses })
})

// Create anamnese
router.post('/', (req, res) => {
  if (!req.accountId) return res.status(400).json({ error: 'account_id required' })
  const { lead_id, chief_complaint, history, medications, allergies, notes, custom_fields } = req.body
  if (!lead_id) return res.status(400).json({ error: 'lead_id required' })

  const result = db.prepare(`
    INSERT INTO anamneses (account_id, lead_id, professional_id, chief_complaint, history, medications, allergies, notes, custom_fields)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.accountId, lead_id, req.user.id, chief_complaint || null, history || null, medications || null, allergies || null, notes || null, custom_fields ? JSON.stringify(custom_fields) : null)

  const anamnese = db.prepare('SELECT * FROM anamneses WHERE id = ?').get(result.lastInsertRowid)
  res.json({ anamnese })
})

// Update anamnese
router.put('/:id', (req, res) => {
  const { chief_complaint, history, medications, allergies, notes, custom_fields } = req.body
  const sets = []; const params = []
  if (chief_complaint !== undefined) { sets.push('chief_complaint = ?'); params.push(chief_complaint) }
  if (history !== undefined) { sets.push('history = ?'); params.push(history) }
  if (medications !== undefined) { sets.push('medications = ?'); params.push(medications) }
  if (allergies !== undefined) { sets.push('allergies = ?'); params.push(allergies) }
  if (notes !== undefined) { sets.push('notes = ?'); params.push(notes) }
  if (custom_fields !== undefined) { sets.push('custom_fields = ?'); params.push(JSON.stringify(custom_fields)) }
  if (sets.length === 0) return res.status(400).json({ error: 'Nada pra atualizar' })
  sets.push("updated_at = datetime('now')")
  params.push(req.params.id)
  db.prepare(`UPDATE anamneses SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  const anamnese = db.prepare('SELECT * FROM anamneses WHERE id = ?').get(req.params.id)
  res.json({ anamnese })
})

// Delete anamnese
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM anamneses WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
