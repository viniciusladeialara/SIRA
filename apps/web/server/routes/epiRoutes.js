const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * GET /api/epis
 * Lista controle e validades de EPIs (RF305)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM epis ORDER BY description ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar controle de EPIs.' });
  }
});

/**
 * POST /api/epis
 */
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'USER', 'COORDENADOR'), async (req, res) => {
  const { description, ca_number, quantity, expiration_date } = req.body;
  if (!description || !ca_number) {
    return res.status(400).json({ error: 'Descrição e número do CA são obrigatórios.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO epis (description, ca_number, quantity, expiration_date)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [description, ca_number, quantity || 0, expiration_date || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cadastrar EPI.' });
  }
});

module.exports = router;
