'use strict';
const { query } = require('../config/db');

/** GET /api/notifications — Retrieve notifications for authenticated user */
async function list(req, res) {
  try {
    const [notifications] = await query(
      `SELECT * FROM notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [req.user.id]
    );
    res.json({ notifications });
  } catch (err) {
    console.error('[NOTIFICATIONS] Error list:', err.message);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
}

/** PATCH /api/notifications/:id/read — Mark a notification as read */
async function markAsRead(req, res) {
  try {
    const { id } = req.params;
    await query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    res.json({ message: 'Notificación marcada como leída' });
  } catch (err) {
    console.error('[NOTIFICATIONS] Error markAsRead:', err.message);
    res.status(500).json({ error: 'Error al marcar la notificación como leída' });
  }
}

/** PATCH /api/notifications/read-all — Mark all notifications as read */
async function markAllAsRead(req, res) {
  try {
    await query(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (err) {
    console.error('[NOTIFICATIONS] Error markAllAsRead:', err.message);
    res.status(500).json({ error: 'Error al marcar todas las notificaciones' });
  }
}

module.exports = {
  list,
  markAsRead,
  markAllAsRead
};
