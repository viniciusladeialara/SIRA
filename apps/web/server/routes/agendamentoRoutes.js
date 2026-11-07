const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/agendamentos
 * Lista agendamentos com suporte a filtros (schedule_type, sala, professor, turma, período).
 */
router.get('/', authenticateToken, async (req, res) => {
  const { type, room_id, teacher_id, class_id, start, end } = req.query;

  try {
    let query = `
      SELECT 
        s.id, s.class_id, s.room_id, s.teacher_id, s.schedule_type, s.title, s.description,
        s.start_time, s.end_time, s.status, s.created_at,
        c.name AS class_name, c.code AS class_code, c.shift AS class_shift,
        r.name AS room_name, r.block AS room_block,
        t.name AS teacher_name, t.email AS teacher_email,
        u.name AS created_by_name
      FROM schedules s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN rooms r ON s.room_id = r.id
      LEFT JOIN teachers t ON s.teacher_id = t.id
      LEFT JOIN users u ON s.created_by = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (type) {
      query += ` AND s.schedule_type = $${paramIndex++}`;
      params.push(type);
    }
    if (room_id) {
      query += ` AND s.room_id = $${paramIndex++}`;
      params.push(room_id);
    }
    if (teacher_id) {
      query += ` AND s.teacher_id = $${paramIndex++}`;
      params.push(teacher_id);
    }
    if (class_id) {
      query += ` AND s.class_id = $${paramIndex++}`;
      params.push(class_id);
    }
    if (start) {
      query += ` AND s.start_time >= $${paramIndex++}`;
      params.push(start);
    }
    if (end) {
      query += ` AND s.end_time <= $${paramIndex++}`;
      params.push(end);
    }

    query += ' ORDER BY s.start_time ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar agendamentos:', error);
    res.status(500).json({ error: 'Erro ao carregar lista de agendamentos.' });
  }
});

/**
 * Auxiliar: Validação das Regras de Negócio (RN001 - RN004)
 */
async function validateScheduleBusinessRules({ scheduleId, room_id, teacher_id, class_id, start_time, end_time }) {
  const start = new Date(start_time);
  const end = new Date(end_time);

  // RN003: Validação de datas válidas e não sobrepostas
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    return { valid: false, code: 400, error: 'RN003: O horário de início deve ser estritamente menor que o horário de término.' };
  }

  // RN004: Validação de Turno da Turma (se vinculada a uma turma)
  if (class_id) {
    const classRes = await pool.query('SELECT shift FROM classes WHERE id = $1', [class_id]);
    if (classRes.rows.length > 0) {
      const shift = classRes.rows[0].shift;
      const startHour = start.getHours();
      const endHour = end.getHours();

      if (shift === 'MATUTINO' && (startHour < 6 || endHour > 13)) {
        return { valid: false, code: 422, error: 'RN004: Agendamento fora do horário do turno MATUTINO da turma (07:00 as 12:00).' };
      }
      if (shift === 'VESPERTINO' && (startHour < 12 || endHour > 18)) {
        return { valid: false, code: 422, error: 'RN004: Agendamento fora do horário do turno VESPERTINO da turma (13:00 as 18:00).' };
      }
      if (shift === 'NOTURNO' && (startHour < 18 || endHour > 23)) {
        return { valid: false, code: 422, error: 'RN004: Agendamento fora do horário do turno NOTURNO da turma (18:00 as 22:30).' };
      }
    }
  }

  // RN001: Não permitir conflito de sala
  let roomQuery = `
    SELECT id, title FROM schedules
    WHERE room_id = $1 AND status != 'CANCELADO'
      AND NOT (end_time <= $2 OR start_time >= $3)
  `;
  const roomParams = [room_id, start_time, end_time];
  if (scheduleId) {
    roomQuery += ` AND id != $4`;
    roomParams.push(scheduleId);
  }

  const roomConflict = await pool.query(roomQuery, roomParams);
  if (roomConflict.rows.length > 0) {
    return {
      valid: false,
      code: 409,
      error: 'RN001 - Conflito de Ambiente: Este ambiente já possui um agendamento no horário selecionado.',
      conflict: roomConflict.rows[0]
    };
  }

  // RN002: Não permitir conflito de professor
  if (teacher_id) {
    let teacherQuery = `
      SELECT id, title FROM schedules
      WHERE teacher_id = $1 AND status != 'CANCELADO'
        AND NOT (end_time <= $2 OR start_time >= $3)
    `;
    const teacherParams = [teacher_id, start_time, end_time];
    if (scheduleId) {
      teacherQuery += ` AND id != $4`;
      teacherParams.push(scheduleId);
    }

    const teacherConflict = await pool.query(teacherQuery, teacherParams);
    if (teacherConflict.rows.length > 0) {
      return {
        valid: false,
        code: 409,
        error: 'RN002 - Conflito de Professor: O docente selecionado já está alocado em outra atividade neste horário.',
        conflict: teacherConflict.rows[0]
      };
    }
  }

  return { valid: true };
}

/**
 * POST /api/agendamentos
 * Cadastra um novo agendamento validando RN001 a RN005.
 */
router.post('/', authenticateToken, async (req, res) => {
  const { class_id, room_id, teacher_id, schedule_type, title, description, start_time, end_time } = req.body;

  if (!room_id || !start_time || !end_time) {
    return res.status(400).json({ error: 'Campos obrigatórios: sala, horário inicial e horário final.' });
  }

  const type = schedule_type || 'AULA';

  try {
    const validation = await validateScheduleBusinessRules({
      room_id,
      teacher_id,
      class_id,
      start_time,
      end_time
    });

    if (!validation.valid) {
      return res.status(validation.code).json({ error: validation.error, conflict: validation.conflict });
    }

    // RN005: Registrar usuário responsável pela criação (req.user.id)
    const result = await pool.query(`
      INSERT INTO schedules (class_id, room_id, teacher_id, schedule_type, title, description, start_time, end_time, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [class_id || null, room_id, teacher_id || null, type, title || 'Agendamento/Aula', description || null, start_time, end_time, req.user.id]);

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    res.status(500).json({ error: 'Erro interno ao salvar agendamento.' });
  }
});

/**
 * PUT /api/agendamentos/:id
 * Edita um agendamento existente com revalidação de conflitos.
 */
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { room_id, teacher_id, class_id, schedule_type, title, description, start_time, end_time, status } = req.body;

  try {
    const currentRes = await pool.query('SELECT * FROM schedules WHERE id = $1', [id]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }

    const current = currentRes.rows[0];
    const targetRoom = room_id || current.room_id;
    const targetTeacher = teacher_id !== undefined ? teacher_id : current.teacher_id;
    const targetClass = class_id !== undefined ? class_id : current.class_id;
    const targetStart = start_time || current.start_time;
    const targetEnd = end_time || current.end_time;

    const validation = await validateScheduleBusinessRules({
      scheduleId: id,
      room_id: targetRoom,
      teacher_id: targetTeacher,
      class_id: targetClass,
      start_time: targetStart,
      end_time: targetEnd
    });

    if (!validation.valid) {
      return res.status(validation.code).json({ error: validation.error, conflict: validation.conflict });
    }

    const updateRes = await pool.query(`
      UPDATE schedules
      SET room_id = $1,
          teacher_id = $2,
          class_id = $3,
          schedule_type = COALESCE($4, schedule_type),
          title = COALESCE($5, title),
          description = COALESCE($6, description),
          start_time = $7,
          end_time = $8,
          status = COALESCE($9, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `, [targetRoom, targetTeacher, targetClass, schedule_type, title, description, targetStart, targetEnd, status, id]);

    res.json(updateRes.rows[0]);

  } catch (error) {
    console.error('Erro ao atualizar agendamento:', error);
    res.status(500).json({ error: 'Erro ao atualizar agendamento.' });
  }
});

/**
 * DELETE /api/agendamentos/:id
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM schedules WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }
    res.json({ message: 'Agendamento cancelado/removido com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover agendamento.' });
  }
});

module.exports = router;
