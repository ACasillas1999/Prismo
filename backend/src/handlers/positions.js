'use strict';
const { query } = require('../config/db');

/** GET /api/positions */
async function list(req, res) {
  try {
    const { department_id } = req.query;
    let sql = `
      SELECT p.*, d.name AS department_name,
             COUNT(DISTINCT u.id) AS users_count
      FROM positions p
      JOIN departments d ON p.department_id = d.id
      LEFT JOIN users u ON u.position_id = p.id AND u.is_active = 1
      WHERE p.is_active = 1
    `;
    const params = [];

    if (department_id) {
      sql += ' AND p.department_id = ?';
      params.push(department_id);
    }
    
    // Security override for department_head
    if (req.user.role === 'department_head' && req.user.department_id) {
      sql += ' AND p.department_id = ?';
      params.push(req.user.department_id);
    }

    sql += ' GROUP BY p.id ORDER BY d.name, p.name';

    const [rows] = await query(sql, params);
    res.json({ positions: rows });
  } catch (err) {
    console.error('[POSITIONS] Error list:', err.message);
    res.status(500).json({ error: 'Error al listar puestos' });
  }
}

/** GET /api/positions/:id */
async function getById(req, res) {
  try {
    const [rows] = await query(
      `SELECT p.*, d.name AS department_name
       FROM positions p
       JOIN departments d ON p.department_id = d.id
       WHERE p.id = ? AND p.is_active = 1`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Puesto no encontrado' });
    }

    res.json({ position: rows[0] });
  } catch (err) {
    console.error('[POSITIONS] Error getById:', err.message);
    res.status(500).json({ error: 'Error al obtener puesto' });
  }
}

/** POST /api/positions */
async function create(req, res) {
  try {
    const { department_id, name, description } = req.body;

    if (!department_id) {
      return res.status(400).json({ error: 'El departamento es requerido' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const [result] = await query(
      'INSERT INTO positions (department_id, name, description) VALUES (?, ?, ?)',
      [department_id, name.trim(), description || null]
    );

    const [rows] = await query(
      `SELECT p.*, d.name AS department_name
       FROM positions p
       JOIN departments d ON p.department_id = d.id
       WHERE p.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ position: rows[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un puesto con ese nombre en este departamento' });
    }
    console.error('[POSITIONS] Error create:', err.message);
    res.status(500).json({ error: 'Error al crear puesto' });
  }
}

/** PUT /api/positions/:id */
async function update(req, res) {
  try {
    const { department_id, name, description } = req.body;
    const { id } = req.params;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const updates = ['name = ?', 'description = ?'];
    const params = [name.trim(), description || null];

    if (department_id) {
      updates.push('department_id = ?');
      params.push(department_id);
    }

    params.push(id);

    const [result] = await query(
      `UPDATE positions SET ${updates.join(', ')} WHERE id = ? AND is_active = 1`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Puesto no encontrado' });
    }

    const [rows] = await query(
      `SELECT p.*, d.name AS department_name
       FROM positions p
       JOIN departments d ON p.department_id = d.id
       WHERE p.id = ?`,
      [id]
    );

    res.json({ position: rows[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un puesto con ese nombre en este departamento' });
    }
    console.error('[POSITIONS] Error update:', err.message);
    res.status(500).json({ error: 'Error al actualizar puesto' });
  }
}

/** DELETE /api/positions/:id (soft delete) */
async function remove(req, res) {
  try {
    const [result] = await query(
      'UPDATE positions SET is_active = 0 WHERE id = ? AND is_active = 1',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Puesto no encontrado' });
    }

    res.json({ message: 'Puesto eliminado' });
  } catch (err) {
    console.error('[POSITIONS] Error remove:', err.message);
    res.status(500).json({ error: 'Error al eliminar puesto' });
  }
}

module.exports = { list, getById, create, update, remove };
