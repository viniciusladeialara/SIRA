const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/checklists/templates
 * Lista modelos de checklists disponíveis (RF306)
 */
router.get('/templates', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM checklist_templates ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar modelos de checklists.' });
  }
});

/**
 * POST /api/checklists/templates
 */
router.post('/templates', authenticateToken, async (req, res) => {
  const { name, items } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Nome do modelo é obrigatório.' });
  }
  try {
    const formattedItems = Array.isArray(items) ? JSON.stringify(items) : (items || '[]');
    const result = await pool.query(
      `INSERT INTO checklist_templates (name, items)
       VALUES ($1, $2::jsonb)
       RETURNING *`,
      [name, formattedItems]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar modelo de checklist.' });
  }
});

/**
 * GET /api/checklists/executions
 * Lista verificações de checklist executadas (UC03)
 */
router.get('/executions', authenticateToken, async (req, res) => {
  const { room_id } = req.query;
  try {
    let query = `
      SELECT ce.*, ct.name AS template_name, r.name AS room_name, u.name AS executed_by_name
      FROM checklist_executions ce
      JOIN checklist_templates ct ON ce.template_id = ct.id
      LEFT JOIN rooms r ON ce.room_id = r.id
      LEFT JOIN users u ON ce.executed_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (room_id) {
      query += ' AND ce.room_id = $1';
      params.push(room_id);
    }
    query += ' ORDER BY ce.executed_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar histórico de checklists.' });
  }
});

/**
 * POST /api/checklists/executions (UC03 - Executar Checklist de Laboratório)
 */
router.post('/executions', authenticateToken, async (req, res) => {
  const { template_id, room_id, responses } = req.body;
  if (!template_id || !room_id) {
    return res.status(400).json({ error: 'ID do modelo e ID da sala são obrigatórios.' });
  }
  try {
    const formattedResponses = typeof responses === 'object' ? JSON.stringify(responses) : (responses || '{}');
    const result = await pool.query(
      `INSERT INTO checklist_executions (template_id, room_id, executed_by, responses)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING *`,
      [template_id, room_id, req.user.id, formattedResponses]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao registrar execução de checklist:', error);
    res.status(500).json({ error: 'Erro ao registrar checklist de ambiente.' });
  }
});

module.exports = router;
