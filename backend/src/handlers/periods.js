'use strict';
const { query } = require('../config/db');

/** GET /api/periods */
async function list(req, res) {
  try {
    const { status } = req.query;
    let sql = `
      SELECT ep.*,
             u.first_name AS creator_first_name,
             u.last_name AS creator_last_name,
             COUNT(DISTINCT e.id) AS evaluations_count
      FROM evaluation_periods ep
      JOIN users u ON ep.created_by = u.id
      LEFT JOIN evaluations e ON e.period_id = ep.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND ep.status = ?';
      params.push(status);
    }

    sql += ' GROUP BY ep.id ORDER BY ep.start_date DESC';

    const [rows] = await query(sql, params);
    res.json({ periods: rows });
  } catch (err) {
    console.error('[PERIODS] Error list:', err.message);
    res.status(500).json({ error: 'Error al listar períodos' });
  }
}

/** GET /api/periods/:id */
async function getById(req, res) {
  try {
    const [rows] = await query(
      `SELECT ep.*,
              u.first_name AS creator_first_name,
              u.last_name AS creator_last_name
       FROM evaluation_periods ep
       JOIN users u ON ep.created_by = u.id
       WHERE ep.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Período no encontrado' });
    }

    res.json({ period: rows[0] });
  } catch (err) {
    console.error('[PERIODS] Error getById:', err.message);
    res.status(500).json({ error: 'Error al obtener período' });
  }
}

/** POST /api/periods */
async function create(req, res) {
  try {
    const { name, start_date, end_date } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    if (!start_date) return res.status(400).json({ error: 'La fecha de inicio es requerida' });
    if (!end_date) return res.status(400).json({ error: 'La fecha de fin es requerida' });
    if (new Date(end_date) <= new Date(start_date)) {
      return res.status(400).json({ error: 'La fecha de fin debe ser posterior a la de inicio' });
    }

    const [result] = await query(
      `INSERT INTO evaluation_periods (name, start_date, end_date, created_by)
       VALUES (?, ?, ?, ?)`,
      [name.trim(), start_date, end_date, req.user.id]
    );

    const [rows] = await query('SELECT * FROM evaluation_periods WHERE id = ?', [result.insertId]);
    res.status(201).json({ period: rows[0] });
  } catch (err) {
    console.error('[PERIODS] Error create:', err.message);
    res.status(500).json({ error: 'Error al crear período' });
  }
}

/** PUT /api/periods/:id */
async function update(req, res) {
  try {
    const { name, start_date, end_date } = req.body;
    const { id } = req.params;

    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });

    const [result] = await query(
      `UPDATE evaluation_periods SET name = ?, start_date = ?, end_date = ? WHERE id = ?`,
      [name.trim(), start_date, end_date, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Período no encontrado' });
    }

    const [rows] = await query('SELECT * FROM evaluation_periods WHERE id = ?', [id]);
    res.json({ period: rows[0] });
  } catch (err) {
    console.error('[PERIODS] Error update:', err.message);
    res.status(500).json({ error: 'Error al actualizar período' });
  }
}

/** PATCH /api/periods/:id/status */
async function updateStatus(req, res) {
  try {
    const { status } = req.body;
    const validTransitions = {
      draft: ['active'],
      active: ['closed'],
      closed: [],
    };

    const [existing] = await query('SELECT status FROM evaluation_periods WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Período no encontrado' });

    const currentStatus = existing[0].status;
    if (!validTransitions[currentStatus]?.includes(status)) {
      return res.status(400).json({
        error: `No se puede cambiar de "${currentStatus}" a "${status}"`,
      });
    }

    await query('UPDATE evaluation_periods SET status = ? WHERE id = ?', [status, req.params.id]);

    const [rows] = await query('SELECT * FROM evaluation_periods WHERE id = ?', [req.params.id]);
    res.json({ period: rows[0] });
  } catch (err) {
    console.error('[PERIODS] Error updateStatus:', err.message);
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
}

/** DELETE /api/periods/:id */
async function remove(req, res) {
  try {
    // Only delete draft periods
    const [result] = await query(
      "DELETE FROM evaluation_periods WHERE id = ? AND status = 'draft'",
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ error: 'Solo se pueden eliminar períodos en estado borrador' });
    }

    res.json({ message: 'Período eliminado' });
  } catch (err) {
    console.error('[PERIODS] Error remove:', err.message);
    res.status(500).json({ error: 'Error al eliminar período' });
  }
}

module.exports = { list, getById, create, update, updateStatus, remove };
