const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/swaps
 * Lista solicitações de trocas (Módulo 07)
 */
router.get('/', authenticateToken, async (req, res) => {
  const { teacher_id, status } = req.query;
  try {
    let query = `
      SELECT sr.*, 
        req_t.name AS requester_teacher_name, req_t.email AS requester_teacher_email,
        targ_t.name AS target_teacher_name, targ_t.email AS target_teacher_email,
        s1.title AS requester_schedule_title, s1.start_time AS requester_start_time,
        s2.title AS target_schedule_title, s2.start_time AS target_start_time
      FROM swap_requests sr
      JOIN teachers req_t ON sr.requester_teacher_id = req_t.id
      JOIN teachers targ_t ON sr.target_teacher_id = targ_t.id
      JOIN schedules s1 ON sr.requester_schedule_id = s1.id
      JOIN schedules s2 ON sr.target_schedule_id = s2.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (teacher_id) {
      query += ` AND (sr.requester_teacher_id = $${paramIndex} OR sr.target_teacher_id = $${paramIndex})`;
      paramIndex++;
      params.push(teacher_id);
    }
    if (status) {
      query += ` AND sr.status = $${paramIndex++}`;
      params.push(status);
    }

    query += ' ORDER BY sr.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar solicitações de troca:', error);
    res.status(500).json({ error: 'Erro ao carregar lista de trocas.' });
  }
});

/**
 * POST /api/swaps
 * Solicita uma troca de aula entre o Professor A (Solicitante) e o Professor B (Destinatário)
 */
router.post('/', authenticateToken, async (req, res) => {
  const { requesterScheduleId, targetScheduleId, requesterTeacherId, targetTeacherId, reason } = req.body;

  if (!requesterScheduleId || !targetScheduleId || !requesterTeacherId || !targetTeacherId) {
    return res.status(400).json({ error: 'ID do agendamento de origem, agendamento de destino e professores são obrigatórios.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO swap_requests (requester_schedule_id, target_schedule_id, requester_teacher_id, target_teacher_id, reason, status)
       VALUES ($1, $2, $3, $4, $5, 'PENDING')
       RETURNING *`,
      [requesterScheduleId, targetScheduleId, requesterTeacherId, targetTeacherId, reason || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar solicitação de troca:', error);
    res.status(500).json({ error: 'Erro ao registrar solicitação de troca.' });
  }
});

/**
 * POST /api/swaps/:id/approve
 * Aceita a solicitação de troca (RN102, RN103, RN104, RN105)
 * Atualiza os professores nos agendamentos correspondentes.
 */
router.post('/:id/approve', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;

  try {
    const swapRes = await pool.query('SELECT * FROM swap_requests WHERE id = $1', [id]);
    if (swapRes.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitação de troca não encontrada.' });
    }

    const swap = swapRes.rows[0];
    if (swap.status !== 'PENDING') {
      return res.status(400).json({ error: 'Esta solicitação de troca já foi processada.' });
    }

    // RN103: Validar se os agendamentos ainda existem e estão ativos
    const s1Res = await pool.query('SELECT * FROM schedules WHERE id = $1 AND status != \'CANCELADO\'', [swap.requester_schedule_id]);
    const s2Res = await pool.query('SELECT * FROM schedules WHERE id = $1 AND status != \'CANCELADO\'', [swap.target_schedule_id]);

    if (s1Res.rows.length === 0 || s2Res.rows.length === 0) {
      return res.status(400).json({ error: 'RN103: Um dos agendamentos envolvidos foi cancelado ou alterado.' });
    }

    // Executar a troca de professores nos agendamentos (RN105: preserva a carga da turma)
    await pool.query('UPDATE schedules SET teacher_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [swap.target_teacher_id, swap.requester_schedule_id]);
    await pool.query('UPDATE schedules SET teacher_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [swap.requester_teacher_id, swap.target_schedule_id]);

    // Atualizar status da solicitação de troca
    await pool.query("UPDATE swap_requests SET status = 'APPROVED', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);

    // RN104: Registrar histórico em swap_approvals e audit_logs
    await pool.query(
      "INSERT INTO swap_approvals (swap_request_id, approved_by, action, notes) VALUES ($1, $2, 'APPROVED', $3)",
      [id, req.user.id, notes || null]
    );

    res.json({ message: 'Troca de aulas aprovada e efetuada com sucesso!' });

  } catch (error) {
    console.error('Erro ao aprovar troca:', error);
    res.status(500).json({ error: 'Erro ao processar aprovação da troca.' });
  }
});

/**
 * POST /api/swaps/:id/reject
 */
router.post('/:id/reject', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;

  try {
    const swapRes = await pool.query('SELECT * FROM swap_requests WHERE id = $1', [id]);
    if (swapRes.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitação de troca não encontrada.' });
    }

    await pool.query("UPDATE swap_requests SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);

    await pool.query(
      "INSERT INTO swap_approvals (swap_request_id, approved_by, action, notes) VALUES ($1, $2, 'REJECTED', $3)",
      [id, req.user.id, notes || null]
    );

    res.json({ message: 'Solicitação de troca recusada.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao recusar troca.' });
  }
});

module.exports = router;
