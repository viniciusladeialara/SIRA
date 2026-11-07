const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * GET /api/uniforms
 * Lista controle de estoque e entregas de uniformes (RF304 / UC02)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM uniforms ORDER BY description ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar dados de uniformes.' });
  }
});

/**
 * POST /api/uniforms
 */
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'USER', 'COORDENADOR'), async (req, res) => {
  const { description, size, quantity } = req.body;
  if (!description || !size) {
    return res.status(400).json({ error: 'Descrição e tamanho são obrigatórios.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO uniforms (description, size, quantity)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [description, size, quantity || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cadastrar uniforme.' });
  }
});

module.exports = router;
