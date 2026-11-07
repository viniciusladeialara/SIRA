const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * GET /api/maintenance
 * Lista manutenções de ambientes (Módulo 11)
 */
router.get('/', authenticateToken, async (req, res) => {
  const { room_id, status } = req.query;
  try {
    let query = `
      SELECT m.*, r.name AS room_name, r.block AS room_block, u.name AS created_by_name
      FROM room_maintenance m
      JOIN rooms r ON m.room_id = r.id
      LEFT JOIN users u ON m.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (room_id) {
      query += ` AND m.room_id = $${paramIndex++}`;
      params.push(room_id);
    }
    if (status) {
      query += ` AND m.status = $${paramIndex++}`;
      params.push(status);
    }

    query += ' ORDER BY m.start_time DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar manutenções:', error);
    res.status(500).json({ error: 'Erro ao carregar histórico de manutenções.' });
  }
});

/**
 * POST /api/maintenance
 * Cadastra manutenção de ambiente (RN401 & RN402: Bloqueia ambiente e cancela/remaneja agendamentos ativos no período)
 */
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'USER', 'COORDENADOR'), async (req, res) => {
  const { room_id, title, description, start_time, end_time, status } = req.body;

  if (!room_id || !title || !start_time || !end_time) {
    return res.status(400).json({ error: 'Sala, título, data de início e término são obrigatórios.' });
  }

  const maintenanceStatus = status || 'Planejada';

  try {
    // 1. Cadastrar Manutenção
    const result = await pool.query(
      `INSERT INTO room_maintenance (room_id, title, description, start_time, end_time, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [room_id, title, description || null, start_time, end_time, maintenanceStatus, req.user.id]
    );

    const maintenance = result.rows[0];

    // RN402: Bloqueio automático da agenda - Marcar agendamentos conflitantes como REMANEJADO
    if (maintenanceStatus === 'Planejada' || maintenanceStatus === 'Em execução') {
      await pool.query(`
        UPDATE schedules
        SET status = 'REMANEJADO',
            updated_at = CURRENT_TIMESTAMP
        WHERE room_id = $1 AND status = 'CONFIRMADO'
          AND NOT (end_time <= $2 OR start_time >= $3)
      `, [room_id, start_time, end_time]);

      // Atualizar status da sala para 'Manutenção'
      await pool.query("UPDATE rooms SET status = 'Manutenção' WHERE id = $1", [room_id]);
    }

    res.status(201).json(maintenance);
  } catch (error) {
    console.error('Erro ao criar manutenção:', error);
    res.status(500).json({ error: 'Erro ao agendar manutenção.' });
  }
});

/**
 * PUT /api/maintenance/:id
 */
router.put('/:id', authenticateToken, authorizeRoles('ADMIN', 'USER', 'COORDENADOR'), async (req, res) => {
  const { id } = req.params;
  const { status, description, end_time } = req.body;

  try {
    const result = await pool.query(
      `UPDATE room_maintenance
       SET status = COALESCE($1, status),
           description = COALESCE($2, description),
           end_time = COALESCE($3, end_time),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [status, description, end_time, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro de manutenção não encontrado.' });
    }

    const maintenance = result.rows[0];

    // Se concluída ou cancelada, restaurar status do ambiente para 'Disponível'
    if (status === 'Concluída' || status === 'Cancelada') {
      await pool.query("UPDATE rooms SET status = 'Disponível' WHERE id = $1", [maintenance.room_id]);
    }

    res.json(maintenance);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar manutenção.' });
  }
});

module.exports = router;
