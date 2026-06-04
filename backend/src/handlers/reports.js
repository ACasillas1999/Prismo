'use strict';
const { query } = require('../config/db');
const { calculateDetailedScores } = require('../utils/scoring');

async function getTemplateStructure(templateId) {
  const [categories] = await query('SELECT * FROM template_categories WHERE template_id = ?', [templateId]);
  for (const cat of categories) {
    const [criteria] = await query('SELECT * FROM template_criteria WHERE category_id = ?', [cat.id]);
    cat.criteria = criteria;
  }
  return categories;
}

async function getScoresMap(evaluationId) {
  const [scores] = await query('SELECT * FROM evaluation_scores WHERE evaluation_id = ?', [evaluationId]);
  const map = {};
  for (const s of scores) { map[s.criterion_id] = s; }
  return map;
}

/** GET /api/reports/dashboard */
async function getDashboard(req, res) {
  try {
    let deptId = req.query.department_id || null;

    // Jefes solo ven su propio departamento
    if (req.user.role === 'department_head') {
      deptId = req.user.department_id;
    }

    if (!deptId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Debes especificar un departamento o ser admin' });
    }

    const { start_date, end_date } = req.query;

    let dateFilter = '';
    const dateParams = [];
    if (start_date) {
      dateFilter += ' AND e.created_at >= ?';
      dateParams.push(start_date + ' 00:00:00');
    }
    if (end_date) {
      dateFilter += ' AND e.created_at <= ?';
      dateParams.push(end_date + ' 23:59:59');
    }

    const deptFilter = deptId ? 'AND u.department_id = ?' : '';
    const baseParams = deptId ? [deptId, ...dateParams] : [...dateParams];

    // 1. Trend Data (Promedio histórico por periodo)
    const trendSql = `
      SELECT ep.name as period, AVG(e.overall_score) as avg_score
      FROM evaluations e
      JOIN evaluation_periods ep ON e.period_id = ep.id
      JOIN users u ON e.user_id = u.id
      WHERE e.status IN ('completed', 'reviewed')
        ${deptFilter}
        ${dateFilter}
      GROUP BY ep.id
      ORDER BY ep.start_date ASC
      LIMIT 12
    `;
    const [trendRows] = await query(trendSql, baseParams);

    // 2. Ranking (Top 5 y Bottom 3 del último periodo activo/reciente)
    const latestPeriodSql = `
      SELECT e.period_id 
      FROM evaluations e
      JOIN users u ON e.user_id = u.id
      WHERE e.status IN ('completed', 'reviewed') ${deptFilter} ${dateFilter}
      ORDER BY e.created_at DESC LIMIT 1
    `;
    const [latestPeriodRes] = await query(latestPeriodSql, baseParams);
    const latestPeriodId = latestPeriodRes.length > 0 ? latestPeriodRes[0].period_id : null;

    let topPerformers = [];
    let bottomPerformers = [];
    let fullRanking = [];
    let categoryAverages = [];

    if (latestPeriodId) {
      // Si enviaron filtro de fecha, mostramos el top/bottom de todas las evaluaciones en ese rango, 
      // de lo contrario, solo del último periodo
      const periodFilter = (start_date || end_date) ? '' : 'AND e.period_id = ?';
      const params2 = (start_date || end_date) 
        ? (deptId ? [deptId, ...dateParams] : [...dateParams]) 
        : (deptId ? [latestPeriodId, deptId] : [latestPeriodId]);
        
      const rankingSql = `
        SELECT u.first_name, u.last_name, u.avatar_url, AVG(e.overall_score) as overall_score, p.name as position_name, MAX(ev.first_name) as evaluator_first, MAX(ev.last_name) as evaluator_last
        FROM evaluations e
        JOIN users u ON e.user_id = u.id
        JOIN evaluation_templates t ON e.template_id = t.id
        JOIN positions p ON t.position_id = p.id
        LEFT JOIN users ev ON e.evaluator_id = ev.id
        WHERE e.status IN ('completed', 'reviewed')
          ${periodFilter}
          ${deptId ? 'AND u.department_id = ?' : ''}
          ${dateFilter}
        GROUP BY u.id, p.name
      `;

      // Full ranking
      const [allAgents] = await query(rankingSql + ' ORDER BY overall_score DESC', params2);
      fullRanking = allAgents;
      topPerformers = allAgents.slice(0, 5);
      bottomPerformers = [...allAgents].sort((a, b) => a.overall_score - b.overall_score).slice(0, 3);

      // 3. Category Data (Calcular en Node.js las evaluaciones del último periodo)
      const evalsSql = `
        SELECT e.id, e.template_id
        FROM evaluations e
        JOIN users u ON e.user_id = u.id
        WHERE e.status IN ('completed', 'reviewed')
          ${periodFilter}
          ${deptId ? 'AND u.department_id = ?' : ''}
          ${dateFilter}
      `;
      const [evalsList] = await query(evalsSql, params2);
      
      const categorySums = {}; // { 'Nombre Categoria': { sum: 0, count: 0 } }
      
      for (const ev of evalsList) {
        const categories = await getTemplateStructure(ev.template_id);
        const scoresMap = await getScoresMap(ev.id);
        const detailed = calculateDetailedScores(categories, scoresMap);
        
        for (const cat of detailed.categories) {
          if (!categorySums[cat.name]) categorySums[cat.name] = { sum: 0, count: 0 };
          categorySums[cat.name].sum += cat.score;
          categorySums[cat.name].count += 1;
        }
      }

      categoryAverages = Object.keys(categorySums).map(name => ({
        subject: name,
        A: categorySums[name].count > 0 ? (categorySums[name].sum / categorySums[name].count).toFixed(1) : 0,
        fullMark: 100
      }));
    }

    res.json({
      trendData: trendRows.map(r => ({ name: r.period, score: parseFloat(r.avg_score).toFixed(1) })),
      topPerformers,
      bottomPerformers,
      fullRanking,
      categoryAverages
    });
  } catch (err) {
    console.error('[REPORTS] Error:', err.message);
    res.status(500).json({ error: 'Error al generar reporte' });
  }
}

module.exports = { getDashboard };
