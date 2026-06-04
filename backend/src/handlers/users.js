'use strict';
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { logAction } = require('../utils/logger');

/** GET /api/users */
async function list(req, res) {
  try {
    const { department_id, role, search } = req.query;
    let sql = `
      SELECT u.id, u.email, u.first_name, u.last_name, u.role,
             u.department_id, u.position_id, u.avatar_url, u.is_active,
             u.created_at, u.updated_at,
             d.name AS department_name,
             p.name AS position_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN positions p   ON u.position_id = p.id
      WHERE u.is_active = 1
    `;
    const params = [];

    if (department_id) {
      sql += ' AND u.department_id = ?';
      params.push(department_id);
    }
    
    // Department filter for department_head role (Security override)
    if (req.user.role === 'department_head' && req.user.department_id) {
      sql += ' AND u.department_id = ?';
      params.push(req.user.department_id);
    }
    if (role) {
      sql += ' AND u.role = ?';
      params.push(role);
    }
    if (search) {
      sql += ' AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY u.first_name, u.last_name';

    const [rows] = await query(sql, params);
    res.json({ users: rows });
  } catch (err) {
    console.error('[USERS] Error list:', err.message);
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
}

/** GET /api/users/:id */
async function getById(req, res) {
  try {
    const [rows] = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role,
              u.department_id, u.position_id, u.avatar_url, u.is_active,
              u.created_at, u.updated_at,
              d.name AS department_name,
              p.name AS position_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN positions p   ON u.position_id = p.id
       WHERE u.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ user: rows[0] });
  } catch (err) {
    console.error('[USERS] Error getById:', err.message);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
}

/** POST /api/users */
async function create(req, res) {
  try {
    const { email, password, first_name, last_name, role, department_id, position_id } = req.body;

    // Validaciones
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'El email es requerido' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    if (!first_name || !first_name.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    if (!last_name || !last_name.trim()) {
      return res.status(400).json({ error: 'El apellido es requerido' });
    }
    if (!['admin', 'department_head', 'agent'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const [result] = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, department_id, position_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [email.trim(), password_hash, first_name.trim(), last_name.trim(), role,
       department_id || null, position_id || null]
    );

    // Fetch the created user (without password)
    const [rows] = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role,
              u.department_id, u.position_id, u.avatar_url, u.is_active,
              u.created_at,
              d.name AS department_name,
              p.name AS position_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN positions p   ON u.position_id = p.id
       WHERE u.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ user: rows[0] });

    await logAction(req.user.id, 'CREATE_USER', 'user', result.insertId, { email: email.trim(), name: `${first_name.trim()} ${last_name.trim()}` });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }
    console.error('[USERS] Error create:', err.message);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
}

/** PUT /api/users/:id */
async function update(req, res) {
  try {
    const { email, password, first_name, last_name, role, department_id, position_id } = req.body;
    const { id } = req.params;

    // Build dynamic update
    const updates = [];
    const params = [];

    if (email) {
      updates.push('email = ?');
      params.push(email.trim());
    }
    if (first_name) {
      updates.push('first_name = ?');
      params.push(first_name.trim());
    }
    if (last_name) {
      updates.push('last_name = ?');
      params.push(last_name.trim());
    }
    if (role && ['admin', 'department_head', 'agent'].includes(role)) {
      updates.push('role = ?');
      params.push(role);
    }
    if (password && password.length >= 6) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      updates.push('password_hash = ?');
      params.push(hash);
    }

    // Allow setting to null
    updates.push('department_id = ?');
    params.push(department_id || null);
    updates.push('position_id = ?');
    params.push(position_id || null);

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
    }

    params.push(id);

    const [result] = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const [rows] = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role,
              u.department_id, u.position_id, u.avatar_url, u.is_active,
              u.created_at, u.updated_at,
              d.name AS department_name,
              p.name AS position_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN positions p   ON u.position_id = p.id
       WHERE u.id = ?`,
      [id]
    );

    res.json({ user: rows[0] });

    await logAction(req.user.id, 'UPDATE_USER', 'user', id, { email: rows[0].email, name: `${rows[0].first_name} ${rows[0].last_name}` });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }
    console.error('[USERS] Error update:', err.message);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
}

/** DELETE /api/users/:id (soft delete) */
async function remove(req, res) {
  try {
    // Don't allow deleting yourself
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
    }

    const [result] = await query(
      'UPDATE users SET is_active = 0 WHERE id = ? AND is_active = 1',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ message: 'Usuario eliminado' });

    await logAction(req.user.id, 'DELETE_USER', 'user', req.params.id);
  } catch (err) {
    console.error('[USERS] Error remove:', err.message);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
}

module.exports = { list, getById, create, update, remove };
