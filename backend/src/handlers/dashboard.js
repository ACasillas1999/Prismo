'use strict';
const { query } = require('../config/db');

/** GET /api/dashboard/stats */
async function getStats(req, res) {
  try {
    const { role, department_id } = req.user;

    // Filters for role
    let deptFilter = '';
    const params = [];
    if (role === 'department_head' && department_id) {
      deptFilter = 'AND u.department_id = ?';
      params.push(department_id);
    }

    // 1. Departments count (only admin sees total, dept head sees 1)
    let departmentsCount = 1;
    if (role === 'admin') {
      const [deptRes] = await query('SELECT COUNT(*) as count FROM departments WHERE is_active = 1');
      departmentsCount = deptRes[0].count;
    }

    if (role === 'agent') {
      // 1. Pending count
      const [pendingRes] = await query(`
        SELECT COUNT(*) as count FROM evaluations 
        WHERE user_id = ? AND status != 'completed'
      `, [req.user.id]);
      const pendingCount = pendingRes[0].count;

      // 2. Completed count
      const [completedRes] = await query(`
        SELECT COUNT(*) as count FROM evaluations 
        WHERE user_id = ? AND status = 'completed'
      `, [req.user.id]);
      const completedCount = completedRes[0].count;

      // 3. Average
      const [avgRes] = await query(`
        SELECT AVG(overall_score) as average FROM evaluations 
        WHERE user_id = ? AND status = 'completed' AND overall_score IS NOT NULL
      `, [req.user.id]);
      const generalAverage = avgRes[0].average ? parseFloat(avgRes[0].average).toFixed(1) : 0;

      // 4. Pending (Calendar)
      const [calPendingRes] = await query(`
        SELECT e.id, e.status, 
               u.first_name, u.last_name, 
               t.name AS template_name,
               ep.end_date as deadline
        FROM evaluations e
        JOIN users u ON e.user_id = u.id
        JOIN evaluation_templates t ON e.template_id = t.id
        JOIN evaluation_periods ep ON e.period_id = ep.id
        WHERE e.user_id = ? AND e.status != 'completed'
      `, [req.user.id]);

      return res.json({
        pendingCount,
        completedCount,
        generalAverage,
        pendingEvaluations: calPendingRes
      });
    }

    // 2. Active Agents Count
    let agentsSql = `
      SELECT COUNT(*) as count 
      FROM users u
      LEFT JOIN positions p ON u.position_id = p.id
      WHERE u.role = 'agent' AND u.is_active = 1
    `;
    if (deptFilter) agentsSql += ` ${deptFilter}`;
    const [agentsRes] = await query(agentsSql, params);
    const activeAgentsCount = agentsRes[0].count;

    // 3. Active Evaluations Count (in current active period)
    let evalsSql = `
      SELECT COUNT(*) as count 
      FROM evaluations e
      JOIN evaluation_periods ep ON e.period_id = ep.id
      JOIN users u ON e.user_id = u.id
      WHERE ep.status = 'active'
    `;
    if (deptFilter) evalsSql += ` ${deptFilter}`;
    const [evalsRes] = await query(evalsSql, params);
    const activeEvaluationsCount = evalsRes[0].count;

    // 4. General Average (completed evaluations)
    let avgSql = `
      SELECT AVG(e.overall_score) as average 
      FROM evaluations e
      JOIN users u ON e.user_id = u.id
      WHERE e.status = 'completed' AND e.overall_score IS NOT NULL
    `;
    if (deptFilter) avgSql += ` ${deptFilter}`;
    const [avgRes] = await query(avgSql, params);
    const generalAverage = avgRes[0].average ? parseFloat(avgRes[0].average).toFixed(1) : 0;

    // 5. Recent Evaluations
    let recentSql = `
      SELECT e.id, e.status, e.overall_score, e.created_at,
             u.first_name, u.last_name,
             t.name AS template_name,
             ep.name AS period_name
      FROM evaluations e
      JOIN users u ON e.user_id = u.id
      JOIN evaluation_templates t ON e.template_id = t.id
      JOIN evaluation_periods ep ON e.period_id = ep.id
      WHERE 1=1
    `;
    if (deptFilter) recentSql += ` ${deptFilter}`;
    recentSql += ` ORDER BY e.created_at DESC LIMIT 5`;
    const [recentRes] = await query(recentSql, params);

    // 6. Performance by Department (Only for Admin, or just their own for Dept Head)
    let deptPerfSql = `
      SELECT d.name as department_name, AVG(e.overall_score) as average
      FROM evaluations e
      JOIN users u ON e.user_id = u.id
      JOIN departments d ON u.department_id = d.id
      WHERE e.status = 'completed' AND e.overall_score IS NOT NULL
    `;
    if (deptFilter) deptPerfSql += ` AND u.department_id = ?`;
    deptPerfSql += ` GROUP BY d.id ORDER BY average DESC`;
    
    // Create new params array since deptPerfSql might need the param again
    const deptPerfParams = deptFilter ? [department_id] : [];
    const [deptPerfRes] = await query(deptPerfSql, deptPerfParams);

    const performanceByDept = deptPerfRes.map(row => ({
      name: row.department_name,
      average: parseFloat(row.average).toFixed(1)
    }));

    // 7. Pending Evaluations (For Calendar)
    let pendingSql = `
      SELECT e.id, e.status, 
             u.first_name, u.last_name, 
             t.name AS template_name,
             ep.end_date as deadline
      FROM evaluations e
      JOIN users u ON e.user_id = u.id
      JOIN evaluation_templates t ON e.template_id = t.id
      JOIN evaluation_periods ep ON e.period_id = ep.id
      WHERE e.status != 'completed'
    `;
    if (deptFilter) pendingSql += ` AND u.department_id = ?`;
    const [pendingRes] = await query(pendingSql, deptPerfParams);

    res.json({
      departmentsCount,
      activeAgentsCount,
      activeEvaluationsCount,
      generalAverage,
      recentEvaluations: recentRes,
      performanceByDept,
      pendingEvaluations: pendingRes
    });

  } catch (err) {
    console.error('[DASHBOARD] Error stats:', err.message);
    res.status(500).json({ error: 'Error al obtener estadísticas del dashboard' });
  }
}

module.exports = { getStats };
