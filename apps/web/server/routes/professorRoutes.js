const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/professores
 * Lista todos os professores (Módulo 02)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM teachers WHERE is_active = true ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar lista de professores.' });
  }
});

/**
 * POST /api/professores
 * Cadastra um novo docente
 */
router.post('/', authenticateToken, async (req, res) => {
  const { name, email, phone, specialty, user_id, allocated_hours } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Nome e e-mail do professor são obrigatórios.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO teachers (name, email, phone, specialty, user_id, allocated_hours)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, email.toLowerCase().trim(), phone || null, specialty || null, user_id || null, allocated_hours || 40]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Já existe um professor cadastrado com este e-mail.' });
    }
    res.status(500).json({ error: 'Erro ao cadastrar professor.' });
  }
});

/**
 * PUT /api/professores/:id
 * Edita dados do docente e carga horária alocada
 */
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, specialty, allocated_hours, is_active, user_id } = req.body;

  try {
    const result = await pool.query(
      `UPDATE teachers
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           specialty = COALESCE($4, specialty),
           allocated_hours = COALESCE($5, allocated_hours),
           is_active = COALESCE($6, is_active),
           user_id = COALESCE($7, user_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [name, email ? email.toLowerCase().trim() : null, phone, specialty, allocated_hours, is_active, user_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Professor não encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar docente:', error);
    res.status(500).json({ error: 'Erro ao atualizar dados do professor.' });
  }
});

/**
 * DELETE /api/professores/:id
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('UPDATE teachers SET is_active = false WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Professor não encontrado.' });
    }
    res.json({ message: 'Professor inativado com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao inativar professor.' });
  }
});

module.exports = router;
