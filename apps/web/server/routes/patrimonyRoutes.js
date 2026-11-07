const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * GET /api/patrimonies
 * Lista itens patrimoniais (RF303 / UC01)
 */
router.get('/', authenticateToken, async (req, res) => {
  const { room_id, status } = req.query;
  try {
    let query = `
      SELECT p.*, r.name AS room_name, r.block AS room_block
      FROM patrimonies p
      LEFT JOIN rooms r ON p.room_id = r.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (room_id) {
      query += ` AND p.room_id = $${paramIndex++}`;
      params.push(room_id);
    }
    if (status) {
      query += ` AND p.status = $${paramIndex++}`;
      params.push(status);
    }

    query += ' ORDER BY p.tag ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar dados patrimoniais.' });
  }
});

/**
 * POST /api/patrimonies (UC01 - Registrar Patrimônio)
 */
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'USER', 'COORDENADOR'), async (req, res) => {
  const { tag, description, room_id, status } = req.body;
  if (!tag || !description) {
    return res.status(400).json({ error: 'TAG patrimonial e descrição são obrigatórios.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO patrimonies (tag, description, room_id, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [tag.toUpperCase().trim(), description, room_id || null, status || 'Operacional']
    );

    // Auditoria UC01
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'CREATE_PATRIMONY', 'patrimonies', $2, $3)`,
      [req.user.id, result.rows[0].id, JSON.stringify({ tag, description })]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'TAG patrimonial já cadastrada.' });
    }
    res.status(500).json({ error: 'Erro ao registrar patrimônio.' });
  }
});

module.exports = router;
