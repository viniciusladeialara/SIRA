const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * GET /api/inventory
 * Lista itens do inventário de TI e Laboratórios (RF302)
 */
router.get('/', authenticateToken, async (req, res) => {
  const { category, status } = req.query;
  try {
    let query = 'SELECT * FROM inventory_items WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(category);
    }
    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    query += ' ORDER BY name ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar inventário.' });
  }
});

/**
 * POST /api/inventory
 */
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'USER', 'COORDENADOR'), async (req, res) => {
  const { name, category, serial_number, status, acquisition_date, value } = req.body;
  if (!name || !category) {
    return res.status(400).json({ error: 'Nome e categoria são obrigatórios.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO inventory_items (name, category, serial_number, status, acquisition_date, value)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, category, serial_number || null, status || 'Ativo', acquisition_date || new Date(), value || 0.00]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Número de série já cadastrado no inventário.' });
    }
    res.status(500).json({ error: 'Erro ao cadastrar item de inventário.' });
  }
});

module.exports = router;
