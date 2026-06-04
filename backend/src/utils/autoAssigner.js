'use strict';
const { query, getConnection } = require('../config/db');
const { logAction } = require('./logger');

/**
 * Runs the automated monthly evaluation generation.
 * Generates evaluations for users with active templates set to 'monthly'.
 */
async function runMonthlyAssigner() {
  const conn = await getConnection();
  try {
    console.log('[AUTO-ASSIGNER] Starting monthly evaluation generation...');
    const now = new Date();
    
    // Check if it's the 1st of the month (optional, since we check for existing evaluations anyway,
    // we can run this every day safely, but logically we only care about the current month).
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const periodName = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    const startStr = startOfMonth.toISOString().split('T')[0];
    const endStr = endOfMonth.toISOString().split('T')[0];

    await conn.beginTransaction();

    // 1. Get all monthly templates that are active
    const [templates] = await conn.execute(
      `SELECT t.id, t.position_id, t.created_by 
       FROM evaluation_templates t 
       WHERE t.frequency = 'monthly' AND t.is_active = 1`
    );

    if (templates.length === 0) {
      console.log('[AUTO-ASSIGNER] No monthly templates found.');
      await conn.commit();
      return;
    }

    // 2. Ensure period exists for this month
    let [periods] = await conn.execute(
      `SELECT id FROM evaluation_periods WHERE name = ? AND start_date = ? LIMIT 1`,
      [periodName, startStr]
    );

    let periodId;
    if (periods.length === 0) {
      // Find admin to be creator
      const [[admin]] = await conn.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
      const adminId = admin ? admin.id : 1;

      const [insertPeriod] = await conn.execute(
        `INSERT INTO evaluation_periods (name, start_date, end_date, status, created_by)
         VALUES (?, ?, ?, 'active', ?)`,
        [periodName, startStr, endStr, adminId]
      );
      periodId = insertPeriod.insertId;
      console.log(`[AUTO-ASSIGNER] Created new period: ${periodName}`);
    } else {
      periodId = periods[0].id;
    }

    // 3. For each template, find active users and assign
    let assignedCount = 0;
    for (const t of templates) {
      // Get active users for this position
      const [users] = await conn.execute(
        `SELECT id FROM users WHERE position_id = ? AND is_active = 1`,
        [t.position_id]
      );

      for (const u of users) {
        // Check if evaluation already exists
        const [existing] = await conn.execute(
          `SELECT id FROM evaluations WHERE user_id = ? AND template_id = ? AND period_id = ? LIMIT 1`,
          [u.id, t.id, periodId]
        );

        if (existing.length === 0) {
          await conn.execute(
            `INSERT INTO evaluations (user_id, template_id, period_id, status)
             VALUES (?, ?, ?, 'pending')`,
            [u.id, t.id, periodId]
          );
          assignedCount++;
        }
      }
    }

    await conn.commit();
    console.log(`[AUTO-ASSIGNER] Finished. Created ${assignedCount} new evaluations for ${periodName}.`);

    if (assignedCount > 0) {
      await logAction(null, 'AUTO_GENERATED_EVALUATIONS', 'system', 0, { period: periodName, count: assignedCount });
    }
  } catch (err) {
    await conn.rollback();
    console.error('[AUTO-ASSIGNER] Error:', err.message);
  } finally {
    conn.release();
  }
}

module.exports = { runMonthlyAssigner };
