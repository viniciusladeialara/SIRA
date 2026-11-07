const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * GET /api/usuarios
 * Retorna todos os usuários (Apenas Admin / Coordenador)
 */
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'COORDENADOR'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.unit_id, u.email, u.name, u.role, u.is_active, u.created_at,
             un.name as unit_name
      FROM users u
      LEFT JOIN units un ON u.unit_id = un.id
      ORDER BY u.name ASC
    `);
    const users = result.rows.map(row => ({
      ...row,
      unitIds: row.unit_id ? [row.unit_id] : []
    }));
    res.json(users);
  } catch (error) {
    console.error('Erro ao buscar lista de usuários:', error);
    res.status(500).json({ error: 'Erro ao buscar lista de usuários.' });
  }
});

/**
 * POST /api/usuarios
 * Cadastra um novo usuário com senha criptografada em bcrypt
 */
router.post('/', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  const { email, password, name, role, unit_id, unitIds, unit_ids } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'E-mail, senha e nome são obrigatórios.' });
  }

  const validRoles = ['ADMIN', 'PROFESSOR', 'USER', 'COORDENADOR', 'PARTNER_SCHOOL'];
  const userRole = validRoles.includes(role) ? role : 'USER';

  const unitMapping = {
    'caceres': '11111111-1111-1111-1111-111111111111',
    'cac': '11111111-1111-1111-1111-111111111111',
    'barra-do-bugres': '22222222-2222-2222-2222-222222222222',
    'bb': '22222222-2222-2222-2222-222222222222',
    'varzea-grande': '33333333-3333-3333-3333-333333333333',
    'vg': '33333333-3333-3333-3333-333333333333',
    'cuiaba': '33333333-3333-3333-3333-333333333333'
  };

  const rawUnitList = Array.isArray(unitIds) && unitIds.length > 0 ? unitIds 
    : (Array.isArray(unit_ids) && unit_ids.length > 0 ? unit_ids 
    : (unit_id ? [unit_id] : []));

  const resolvedUnitIds = rawUnitList.map(u => unitMapping[u] || u);
  const primaryUnitId = resolvedUnitIds[0] || unitMapping[unit_id] || unit_id || '11111111-1111-1111-1111-111111111111';

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name, role, unit_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, unit_id, email, name, role, is_active',
      [email.toLowerCase().trim(), passwordHash, name, userRole, primaryUnitId]
    );

    res.status(201).json({ ...result.rows[0], unitIds: resolvedUnitIds });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Já existe um usuário com este e-mail.' });
    }
    console.error("Erro no POST /api/usuarios:", error);
    res.status(500).json({ error: 'Erro ao cadastrar usuário.' });
  }
});

/**
 * PUT /api/usuarios/:id
 * Atualiza dados, perfil ou ativa/inativa um usuário
 */
router.put('/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { name, role, is_active, password, unit_id, unitIds } = req.body;

  const unitMapping = {
    'caceres': '11111111-1111-1111-1111-111111111111',
    'barra-do-bugres': '22222222-2222-2222-2222-222222222222',
    'varzea-grande': '33333333-3333-3333-3333-333333333333'
  };

  const primaryUnitId = (unitIds && unitIds[0]) ? (unitMapping[unitIds[0]] || unitIds[0]) 
    : (unit_id ? (unitMapping[unit_id] || unit_id) : null);

  try {
    let passwordHash = null;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password, salt);
    }

    const result = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           role = COALESCE($2, role),
           is_active = COALESCE($3, is_active),
           password_hash = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE password_hash END,
           unit_id = COALESCE($5, unit_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id, unit_id, email, name, role, is_active`,
      [name, role, is_active, passwordHash, primaryUnitId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro ao atualizar dados do usuário.' });
  }
});

/**
 * DELETE /api/usuarios/:id
 */
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  const { id } = req.params;
  try {
    const checkUser = await pool.query('SELECT email FROM users WHERE id = $1', [id]);
    if (checkUser.rows.length > 0) {
      const targetEmail = checkUser.rows[0].email;
      if (targetEmail === 'viniciusladeiala@gmail.com' || targetEmail === 'viniciusladeialara@gmail.com') {
        return res.status(403).json({ error: 'O usuário Super Admin principal não pode ser excluído.' });
      }
    }

    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    res.json({ message: 'Usuário removido com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    try {
      await pool.query('UPDATE users SET is_active = false WHERE id = $1', [id]);
      res.json({ message: 'Usuário inativado devido a registros associados.' });
    } catch (err2) {
      res.status(500).json({ error: 'Erro ao excluir usuário.' });
    }
  }
});

module.exports = router;
