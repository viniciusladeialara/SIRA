const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * GET /api/calendar/holidays
 * Lista feriados e recessos (Módulo 09)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM holiday_calendar ORDER BY date ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar calendário institucional.' });
  }
});

/**
 * POST /api/calendar/holidays
 * Cadastra feriado ou recesso (ADMIN / COORDENADOR)
 */
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'COORDENADOR'), async (req, res) => {
  const { date, title, category, is_working_day, notes } = req.body;

  if (!date || !title || !category) {
    return res.status(400).json({ error: 'Data, título e categoria são obrigatórios.' });
  }

  const validCategories = ['Nacional', 'Estadual', 'Municipal', 'Recesso', 'Evento'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Categoria inválida.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO holiday_calendar (date, title, category, is_working_day, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [date, title, category, is_working_day || false, notes || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Já existe uma data cadastrada para este feriado.' });
    }
    res.status(500).json({ error: 'Erro ao cadastrar feriado.' });
  }
});

/**
 * DELETE /api/calendar/holidays/:id
 */
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN', 'COORDENADOR'), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM holiday_calendar WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feriado/Recesso não encontrado.' });
    }
    res.json({ message: 'Feriado/Recesso removido com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover feriado.' });
  }
});

module.exports = router;
