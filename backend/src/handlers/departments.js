'use strict';
const { query } = require('../config/db');

/** GET /api/departments */
async function list(req, res) {
  try {
    const [rows] = await query(
      `SELECT d.*,
              COUNT(DISTINCT p.id) AS positions_count,
              COUNT(DISTINCT u.id) AS users_count
       FROM departments d
       LEFT JOIN positions p ON p.department_id = d.id AND p.is_active = 1
       LEFT JOIN users u     ON u.department_id = d.id AND u.is_active = 1
       WHERE d.is_active = 1
       GROUP BY d.id
       ORDER BY d.name`
    );
    res.json({ departments: rows });
  } catch (err) {
    console.error('[DEPARTMENTS] Error list:', err.message);
    res.status(500).json({ error: 'Error al listar departamentos' });
  }
}

/** GET /api/departments/:id */
async function getById(req, res) {
  try {
    const [rows] = await query(
      `SELECT d.*,
              COUNT(DISTINCT p.id) AS positions_count,
              COUNT(DISTINCT u.id) AS users_count
       FROM departments d
       LEFT JOIN positions p ON p.department_id = d.id AND p.is_active = 1
       LEFT JOIN users u     ON u.department_id = d.id AND u.is_active = 1
       WHERE d.id = ? AND d.is_active = 1
       GROUP BY d.id`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Departamento no encontrado' });
    }

    res.json({ department: rows[0] });
  } catch (err) {
    console.error('[DEPARTMENTS] Error getById:', err.message);
    res.status(500).json({ error: 'Error al obtener departamento' });
  }
}

/** POST /api/departments */
async function create(req, res) {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const [result] = await query(
      'INSERT INTO departments (name, description) VALUES (?, ?)',
      [name.trim(), description || null]
    );

    const [rows] = await query('SELECT * FROM departments WHERE id = ?', [result.insertId]);

    res.status(201).json({ department: rows[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un departamento con ese nombre' });
    }
    console.error('[DEPARTMENTS] Error create:', err.message);
    res.status(500).json({ error: 'Error al crear departamento' });
  }
}

/** PUT /api/departments/:id */
async function update(req, res) {
  try {
    const { name, description } = req.body;
    const { id } = req.params;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const [result] = await query(
      'UPDATE departments SET name = ?, description = ? WHERE id = ? AND is_active = 1',
      [name.trim(), description || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Departamento no encontrado' });
    }

    const [rows] = await query('SELECT * FROM departments WHERE id = ?', [id]);
    res.json({ department: rows[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un departamento con ese nombre' });
    }
    console.error('[DEPARTMENTS] Error update:', err.message);
    res.status(500).json({ error: 'Error al actualizar departamento' });
  }
}

/** DELETE /api/departments/:id (soft delete) */
async function remove(req, res) {
  try {
    const [result] = await query(
      'UPDATE departments SET is_active = 0 WHERE id = ? AND is_active = 1',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Departamento no encontrado' });
    }

    res.json({ message: 'Departamento eliminado' });
  } catch (err) {
    console.error('[DEPARTMENTS] Error remove:', err.message);
    res.status(500).json({ error: 'Error al eliminar departamento' });
  }
}

module.exports = { list, getById, create, update, remove };
