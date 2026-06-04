'use strict';
const { query } = require('../config/db');

/**
 * Registra una acción en el historial de auditoría
 * @param {number|null} userId - ID del usuario que realizó la acción (null si es sistema/cron)
 * @param {string} action - Acción realizada (ej: 'CREATE_USER', 'DELETE_USER', 'COMPLETE_EVALUATION')
 * @param {string} entityType - Tipo de entidad afectada ('user', 'template', 'evaluation', 'period')
 * @param {number} entityId - ID de la entidad afectada
 * @param {object} detailsObj - Objeto con detalles extra (opcional)
 */
async function logAction(userId, action, entityType, entityId, detailsObj = null) {
  try {
    const detailsStr = detailsObj ? JSON.stringify(detailsObj) : null;
    
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      [userId || null, action, entityType, entityId, detailsStr]
    );
  } catch (err) {
    console.error('[AUDIT LOG ERROR] No se pudo guardar el registro:', err.message);
  }
}

module.exports = { logAction };
