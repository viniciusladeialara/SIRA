const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/reservations
 * Lista reservas de ambientes (Módulo 10)
 */
router.get('/', authenticateToken, async (req, res) => {
  const { room_id, start, end } = req.query;
  try {
    let query = `
      SELECT r.*, rm.name AS room_name, rm.block AS room_block, u.name AS user_name, u.email AS user_email
      FROM room_reservations r
      JOIN rooms rm ON r.room_id = rm.id
      JOIN users u ON r.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (room_id) {
      query += ` AND r.room_id = $${paramIndex++}`;
      params.push(room_id);
    }
    if (start) {
      query += ` AND r.start_time >= $${paramIndex++}`;
      params.push(start);
    }
    if (end) {
      query += ` AND r.end_time <= $${paramIndex++}`;
      params.push(end);
    }

    query += ' ORDER BY r.start_time ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar reservas:', error);
    res.status(500).json({ error: 'Erro ao carregar lista de reservas.' });
  }
});

/**
 * POST /api/reservations
 * Cadastra reserva validando RN301, RN302, RN303, RN304
 */
router.post('/', authenticateToken, async (req, res) => {
  const { room_id, title, purpose, start_time, end_time } = req.body;

  // RN303 & RN304: Título, Finalidade, Início e Término obrigatórios
  if (!room_id || !title || !purpose || !start_time || !end_time) {
    return res.status(400).json({ error: 'RN303/RN304: Sala, título, finalidade e intervalo de horário são obrigatórios.' });
  }

  const start = new Date(start_time);
  const end = new Date(end_time);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    return res.status(400).json({ error: 'Horário de início deve ser menor que o horário de término.' });
  }

  try {
    // RN302: Respeitar bloqueios de manutenção
    const maintenanceCheck = await pool.query(`
      SELECT id, title FROM room_maintenance
      WHERE room_id = $1 AND status IN ('Planejada', 'Em execução')
        AND NOT (end_time <= $2 OR start_time >= $3)
    `, [room_id, start_time, end_time]);

    if (maintenanceCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'RN302 - Bloqueio de Manutenção: Este ambiente está em manutenção no horário solicitado.',
        maintenance: maintenanceCheck.rows[0]
      });
    }

    // RN301: Não permitir dupla reserva ou conflito com a agenda
    const reservationConflict = await pool.query(`
      SELECT id, title FROM room_reservations
      WHERE room_id = $1 AND status = 'CONFIRMADA'
        AND NOT (end_time <= $2 OR start_time >= $3)
    `, [room_id, start_time, end_time]);

    if (reservationConflict.rows.length > 0) {
      return res.status(409).json({
        error: 'RN301 - Dupla Reserva: O ambiente já possui uma reserva confirmada para este horário.',
        conflict: reservationConflict.rows[0]
      });
    }

    // RN303: Registrar usuário autenticado como responsável (req.user.id)
    const result = await pool.query(
      `INSERT INTO room_reservations (room_id, user_id, title, purpose, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [room_id, req.user.id, title, purpose, start_time, end_time]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar reserva:', error);
    res.status(500).json({ error: 'Erro ao efetuar reserva de ambiente.' });
  }
});

/**
 * DELETE /api/reservations/:id
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("UPDATE room_reservations SET status = 'CANCELADA' WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }
    res.json({ message: 'Reserva cancelada com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cancelar reserva.' });
  }
});

module.exports = router;
