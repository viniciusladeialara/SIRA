const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * GET /api/events
 * Lista eventos institucionais (Módulo 08)
 */
router.get('/', authenticateToken, async (req, res) => {
  const { start, end, event_type } = req.query;
  try {
    let query = `
      SELECT e.*, u.name AS created_by_name
      FROM events e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (start) {
      query += ` AND e.start_time >= $${paramIndex++}`;
      params.push(start);
    }
    if (end) {
      query += ` AND e.end_time <= $${paramIndex++}`;
      params.push(end);
    }
    if (event_type) {
      query += ` AND e.event_type = $${paramIndex++}`;
      params.push(event_type);
    }

    query += ' ORDER BY e.start_time ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar eventos:', error);
    res.status(500).json({ error: 'Erro ao carregar lista de eventos.' });
  }
});

/**
 * POST /api/events
 * Criar evento institucional (Permissão: ADMIN ou USER, PROFESSOR apenas visualiza)
 */
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'USER', 'COORDENADOR'), async (req, res) => {
  const { title, description, event_type, start_time, end_time, room_ids } = req.body;

  if (!title || !event_type || !start_time || !end_time) {
    return res.status(400).json({ error: 'Título, tipo de evento, início e término são obrigatórios.' });
  }

  const validTypes = ['Treinamento', 'Workshop', 'Palestra', 'Feira', 'Reunião', 'Evento Externo'];
  if (!validTypes.includes(event_type)) {
    return res.status(400).json({ error: 'Tipo de evento inválido.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO events (title, description, event_type, start_time, end_time, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, description || null, event_type, start_time, end_time, req.user.id]
    );

    const event = result.rows[0];

    // Se informou salas vinculadas
    if (Array.isArray(room_ids) && room_ids.length > 0) {
      for (const roomId of room_ids) {
        await pool.query(
          'INSERT INTO event_rooms (event_id, room_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [event.id, roomId]
        );
      }
    }

    res.status(201).json(event);
  } catch (error) {
    console.error('Erro ao criar evento:', error);
    res.status(500).json({ error: 'Erro ao criar evento institucional.' });
  }
});

/**
 * PUT /api/events/:id
 */
router.put('/:id', authenticateToken, authorizeRoles('ADMIN', 'USER', 'COORDENADOR'), async (req, res) => {
  const { id } = req.params;
  const { title, description, event_type, start_time, end_time, status } = req.body;

  try {
    const result = await pool.query(
      `UPDATE events
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           event_type = COALESCE($3, event_type),
           start_time = COALESCE($4, start_time),
           end_time = COALESCE($5, end_time),
           status = COALESCE($6, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [title, description, event_type, start_time, end_time, status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Evento não encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar evento.' });
  }
});

/**
 * DELETE /api/events/:id
 */
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN', 'USER', 'COORDENADOR'), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("UPDATE events SET status = 'CANCELADO' WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Evento não encontrado.' });
    }
    res.json({ message: 'Evento cancelado com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cancelar evento.' });
  }
});

module.exports = router;
