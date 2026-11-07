const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/units - Lista todas as unidades
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM units ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar unidades:', err);
    res.status(500).json({ error: 'Erro ao buscar unidades' });
  }
});

// POST /api/units - Cria nova unidade (Super Admin)
router.post('/', async (req, res) => {
  const { id, code, name, city, state } = req.body;
  try {
    const unitId = id || name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const unitCode = (code || name.substring(0, 3)).toUpperCase();
    
    const result = await pool.query(
      `INSERT INTO units (id, code, name, city, state, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = true
       RETURNING *`,
      [unitId, unitCode, name, city || 'Mato Grosso', state || 'MT']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao criar unidade:', err);
    res.status(500).json({ error: err.message || 'Erro ao criar unidade' });
  }
});

// DELETE /api/units/:id - Deleta unidade
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM units WHERE id = $1', [id]);
    res.json({ message: 'Unidade excluída com sucesso' });
  } catch (err) {
    console.error('Erro ao excluir unidade:', err);
    res.status(500).json({ error: 'Erro ao excluir unidade' });
  }
});

module.exports = router;
