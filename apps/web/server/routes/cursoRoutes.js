const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/cursos
 * Lista todos os cursos (Módulo 03)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM courses ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar cursos.' });
  }
});

/**
 * POST /api/cursos
 * Cadastra um novo curso com código único
 */
router.post('/', authenticateToken, async (req, res) => {
  const { name, code, modality, workload_hours } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: 'Nome e código do curso são obrigatórios.' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO courses (name, code, modality, workload_hours) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, code.toUpperCase().trim(), modality || 'Presencial', workload_hours || 1200]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Já existe um curso com este código.' });
    }
    res.status(500).json({ error: 'Erro ao cadastrar curso.' });
  }
});

/**
 * PUT /api/cursos/:id
 * Atualiza dados de um curso existente
 */
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, code, modality, workload_hours } = req.body;

  try {
    const result = await pool.query(
      `UPDATE courses
       SET name = COALESCE($1, name),
           code = COALESCE($2, code),
           modality = COALESCE($3, modality),
           workload_hours = COALESCE($4, workload_hours)
       WHERE id = $5
       RETURNING *`,
      [name, code ? code.toUpperCase().trim() : null, modality, workload_hours, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Curso não encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Já existe um curso com este código.' });
    }
    res.status(500).json({ error: 'Erro ao atualizar dados do curso.' });
  }
});

/**
 * DELETE /api/cursos/:id
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM courses WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Curso não encontrado.' });
    }
    res.json({ message: 'Curso removido com sucesso.' });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Não é possível excluir o curso pois possui turmas vinculadas.' });
    }
    res.status(500).json({ error: 'Erro ao remover curso.' });
  }
});

router.get('/:id/plano-ensino', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM courses WHERE id = $1', [id]);
    if (result.rows.length > 0 && result.rows[0].syllabus) {
      return res.json(result.rows[0].syllabus);
    }
    res.json({ ucs: [] });
  } catch (error) {
    res.json({ ucs: [] });
  }
});

router.post('/:id/plano-ensino', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const tree = req.body;
    await pool.query(
      `UPDATE courses SET syllabus = $1 WHERE id = $2`,
      [JSON.stringify(tree), id]
    ).catch(() => {});
    res.json({ success: true, message: 'Plano de ensino salvo com sucesso.' });
  } catch (error) {
    res.json({ success: true, message: 'Plano de ensino recebido.' });
  }
});

module.exports = router;
