'use strict';
const { query } = require('../config/db');

/** GET /api/audit */
async function getLogs(req, res) {
  try {
    // Solo administradores pueden acceder
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
    }

    const { limit = 100, offset = 0 } = req.query;

    const sql = `
      SELECT a.*, 
             u.first_name, u.last_name, u.email
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await query(sql, [parseInt(limit), parseInt(offset)]);
    res.json({ logs: rows });
  } catch (err) {
    console.error('[AUDIT] Error list:', err.message);
    res.status(500).json({ error: 'Error al obtener historial de auditoría' });
  }
}

module.exports = { getLogs };
