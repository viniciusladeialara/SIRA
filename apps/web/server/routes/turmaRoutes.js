const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/turmas
 * Lista todas as turmas cadastradas com informações vinculadas de curso, professor e ambiente.
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        c.id, c.code, c.name, c.shift, c.start_date, c.end_date, c.daily_hours, c.student_count, c.status, c.created_at,
        co.name AS course_name, co.id AS course_id,
        t.name AS teacher_name, t.id AS teacher_id,
        r.name AS room_name, r.id AS room_id
      FROM classes c
      LEFT JOIN courses co ON c.course_id = co.id
      LEFT JOIN teachers t ON c.teacher_id = t.id
      LEFT JOIN rooms r ON c.room_id = r.id
      ORDER BY c.created_at DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar turmas:', error);
    res.status(500).json({ error: 'Erro ao carregar a lista de turmas.' });
  }
});

/**
 * GET /api/turmas/:id
 * Retorna dados detalhados de uma turma específica e seus agendamentos vinculados.
 */
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const classResult = await pool.query(`
      SELECT c.*, co.name AS course_name, t.name AS teacher_name, r.name AS room_name
      FROM classes c
      LEFT JOIN courses co ON c.course_id = co.id
      LEFT JOIN teachers t ON c.teacher_id = t.id
      LEFT JOIN rooms r ON c.room_id = r.id
      WHERE c.id = $1
    `, [id]);

    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: 'Turma não encontrada.' });
    }

    const schedulesResult = await pool.query(`
      SELECT s.*, r.name AS room_name, t.name AS teacher_name
      FROM schedules s
      LEFT JOIN rooms r ON s.room_id = r.id
      LEFT JOIN teachers t ON s.teacher_id = t.id
      WHERE s.class_id = $1
      ORDER BY s.start_time ASC
    `, [id]);

    res.json({
      turma: classResult.rows[0],
      agendamentos: schedulesResult.rows
    });
  } catch (error) {
    console.error('Erro ao buscar turma por id:', error);
    res.status(500).json({ error: 'Erro ao buscar detalhes da turma.' });
  }
});

/**
 * POST /api/turmas
 * Cadastra uma nova turma no sistema (Status padrão: PLANEJADA ou ATIVA)
 */
router.post('/', authenticateToken, async (req, res) => {
  const { code, name, course_id, teacher_id, room_id, shift, start_date, end_date, daily_hours, student_count, status } = req.body;

  if (!code || !name || !shift || !start_date || !end_date) {
    return res.status(400).json({ error: 'Campos obrigatórios: código, nome, turno, data de início e término.' });
  }

  const validStatuses = ['PLANEJADA', 'ATIVA', 'PAUSADA', 'CONCLUIDA', 'CANCELADA'];
  const classStatus = validStatuses.includes(status) ? status : 'PLANEJADA';

  try {
    const result = await pool.query(
      `INSERT INTO classes (code, name, course_id, teacher_id, room_id, shift, start_date, end_date, daily_hours, student_count, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [code.toUpperCase().trim(), name, course_id || null, teacher_id || null, room_id || null, shift, start_date, end_date, daily_hours || 4.0, student_count || 30, classStatus]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar turma:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Já existe uma turma cadastrada com este código.' });
    }
    res.status(500).json({ error: 'Erro ao criar nova turma.' });
  }
});

/**
 * POST /api/turmas/:id/gerar-agendamentos
 * REGRA DE NEGÓCIO PRINCIPAL: Gerador automático de agendamentos para a Turma (segunda a sexta)
 */
router.post('/:id/gerar-agendamentos', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const turmaResult = await pool.query('SELECT * FROM classes WHERE id = $1', [id]);
    if (turmaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Turma não encontrada.' });
    }

    const turma = turmaResult.rows[0];
    if (!turma.room_id || !turma.teacher_id) {
      return res.status(400).json({ error: 'Para gerar o agendamento da turma, defina o professor e a sala alocados.' });
    }

    // Definir horário com base no turno (RN004)
    let startHour = 7;
    let endHour = 11;
    if (turma.shift === 'VESPERTINO') {
      startHour = 13;
      endHour = 17;
    } else if (turma.shift === 'NOTURNO') {
      startHour = 18;
      endHour = 22;
    }

    const startDate = new Date(turma.start_date);
    const endDate = new Date(turma.end_date);
    let createdCount = 0;

    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      // Apenas dias úteis (Segunda=1 a Sexta=5)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const startTime = new Date(currentDate);
        startTime.setHours(startHour, 30, 0, 0);

        const endTime = new Date(currentDate);
        endTime.setHours(endHour, 30, 0, 0);

        // Inserir agendamento com schedule_type 'AULA'
        await pool.query(
          `INSERT INTO schedules (class_id, room_id, teacher_id, schedule_type, title, start_time, end_time, created_by)
           VALUES ($1, $2, $3, 'AULA', $4, $5, $6, $7)`,
          [
            turma.id,
            turma.room_id,
            turma.teacher_id,
            `Aula da Turma ${turma.code}`,
            startTime.toISOString(),
            endTime.toISOString(),
            req.user.id
          ]
        );
        createdCount++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Atualizar status da turma para ATIVA
    await pool.query("UPDATE classes SET status = 'ATIVA' WHERE id = $1", [id]);

    res.json({
      message: `Agendamentos gerados com sucesso para a turma ${turma.name}.`,
      totalAgendamentos: createdCount
    });

  } catch (error) {
    console.error('Erro ao gerar agendamentos da turma:', error);
    res.status(500).json({ error: 'Erro ao processar geração automática de agendamentos.' });
  }
});

/**
 * PUT /api/turmas/:id
 */
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, shift, start_date, end_date, status, room_id, teacher_id, student_count } = req.body;

  try {
    const result = await pool.query(
      `UPDATE classes
       SET name = COALESCE($1, name),
           shift = COALESCE($2, shift),
           start_date = COALESCE($3, start_date),
           end_date = COALESCE($4, end_date),
           status = COALESCE($5, status),
           room_id = COALESCE($6, room_id),
           teacher_id = COALESCE($7, teacher_id),
           student_count = COALESCE($8, student_count),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 RETURNING *`,
      [name, shift, start_date, end_date, status, room_id, teacher_id, student_count, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Turma não encontrada.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar dados da turma.' });
  }
});

/**
 * DELETE /api/turmas/:id
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM classes WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Turma não encontrada.' });
    }
    res.json({ message: 'Turma removida com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover turma.' });
  }
});

module.exports = router;
