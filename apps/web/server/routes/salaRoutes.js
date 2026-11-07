const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/salas
 * Lista todos os ambientes/salas ativas ou filtrar por status/tipo
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rooms WHERE is_active = true ORDER BY block, name ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar lista de ambientes/salas.' });
  }
});

/**
 * POST /api/salas
 * Cadastra um novo ambiente (Módulo 05)
 */
router.post('/', authenticateToken, async (req, res) => {
  const { name, block, floor, type, capacity, resources, status } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'O nome da sala/ambiente é obrigatório.' });
  }
  try {
    const formattedResources = Array.isArray(resources) ? JSON.stringify(resources) : (resources || '[]');
    const roomStatus = status || 'Disponível';

    const result = await pool.query(
      `INSERT INTO rooms (name, block, floor, type, capacity, resources, status)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       RETURNING *`,
      [name, block || 'Bloco A', floor || 'Térreo', type || 'Sala de Aula', capacity || 40, formattedResources, roomStatus]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao cadastrar ambiente:', error);
    res.status(500).json({ error: 'Erro ao cadastrar novo ambiente.' });
  }
});

/**
 * PUT /api/salas/:id
 * Edita um ambiente existente
 */
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, block, floor, type, capacity, resources, status, is_active } = req.body;

  try {
    const formattedResources = Array.isArray(resources) ? JSON.stringify(resources) : resources;

    const result = await pool.query(
      `UPDATE rooms
       SET name = COALESCE($1, name),
           block = COALESCE($2, block),
           floor = COALESCE($3, floor),
           type = COALESCE($4, type),
           capacity = COALESCE($5, capacity),
           resources = CASE WHEN $6::jsonb IS NOT NULL THEN $6::jsonb ELSE resources END,
           status = COALESCE($7, status),
           is_active = COALESCE($8, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [name, block, floor, type, capacity, formattedResources || null, status, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ambiente não encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar ambiente:', error);
    res.status(500).json({ error: 'Erro ao atualizar ambiente.' });
  }
});

/**
 * DELETE /api/salas/:id
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('UPDATE rooms SET is_active = false WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ambiente não encontrado.' });
    }
    res.json({ message: 'Ambiente inativado com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao inativar ambiente.' });
  }
});

module.exports = router;
