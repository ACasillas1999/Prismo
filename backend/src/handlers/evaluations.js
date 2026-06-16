'use strict';
const { query, getConnection } = require('../config/db');
const { calculateDetailedScores } = require('../utils/scoring');
const { logAction } = require('../utils/logger');

/** Helper: get full template structure with categories and criteria */
async function getTemplateStructure(templateId, evaluationId = null) {
  let catSql = 'SELECT * FROM template_categories WHERE template_id = ?';
  let catParams = [templateId];
  if (!evaluationId) {
    catSql += ' AND is_active = 1';
  } else {
    catSql += ` AND (is_active = 1 OR id IN (
      SELECT c.category_id FROM template_criteria c
      JOIN evaluation_scores es ON c.id = es.criterion_id
      WHERE es.evaluation_id = ?
    ))`;
    catParams.push(evaluationId);
  }
  catSql += ' ORDER BY sort_order, id';

  const [categories] = await query(catSql, catParams);

  for (const cat of categories) {
    let crSql = 'SELECT * FROM template_criteria WHERE category_id = ?';
    let crParams = [cat.id];
    if (!evaluationId) {
      crSql += ' AND is_active = 1';
    } else {
      crSql += ` AND (is_active = 1 OR id IN (
        SELECT criterion_id FROM evaluation_scores WHERE evaluation_id = ?
      ))`;
      crParams.push(evaluationId);
    }
    crSql += ' ORDER BY sort_order, id';

    const [criteria] = await query(crSql, crParams);
    cat.criteria = criteria;
  }
  
  if (evaluationId) {
    return categories.filter(c => c.criteria.length > 0);
  }
  return categories;
}

/** Helper: get scores map for an evaluation { criterion_id: score_record } */
async function getScoresMap(evaluationId) {
  const [scores] = await query(
    'SELECT * FROM evaluation_scores WHERE evaluation_id = ?',
    [evaluationId]
  );
  const map = {};
  for (const s of scores) {
    map[s.criterion_id] = s;
  }
  return map;
}

/** Helper: recalculate and update overall score */
async function recalculate(evaluationId, templateId) {
  const categories = await getTemplateStructure(templateId, evaluationId);
  const scoresMap = await getScoresMap(evaluationId);
  const result = calculateDetailedScores(categories, scoresMap);

  // Update individual criterion scores
  for (const cat of result.categories) {
    for (const cr of cat.criteria) {
      const scoreRecord = scoresMap[cr.id];
      if (scoreRecord) {
        await query(
          'UPDATE evaluation_scores SET calculated_score = ? WHERE id = ?',
          [cr.score, scoreRecord.id]
        );
      }
    }
  }

  // Update overall score
  await query(
    'UPDATE evaluations SET overall_score = ? WHERE id = ?',
    [result.overall, evaluationId]
  );

  return result;
}

/** GET /api/evaluations */
async function list(req, res) {
  try {
    const { period_id, department_id, status, user_id, start_date, end_date } = req.query;
    let sql = `
      SELECT e.*, 
             u.first_name, u.last_name, u.email,
             t.name AS template_name,
             ep.name AS period_name,
             d.name AS department_name,
             ev.first_name AS evaluator_first_name,
             ev.last_name AS evaluator_last_name
      FROM evaluations e
      JOIN users u ON e.user_id = u.id
      JOIN evaluation_templates t ON e.template_id = t.id
      JOIN evaluation_periods ep ON e.period_id = ep.id
      JOIN positions p ON t.position_id = p.id
      JOIN departments d ON p.department_id = d.id
      LEFT JOIN users ev ON e.evaluator_id = ev.id
      WHERE 1=1
    `;
    const params = [];

    if (period_id) { sql += ' AND e.period_id = ?'; params.push(period_id); }
    if (department_id) { sql += ' AND p.department_id = ?'; params.push(department_id); }
    if (status) {
      if (status === 'active') {
        sql += " AND e.status != 'completed'";
      } else {
        sql += ' AND e.status = ?';
        params.push(status);
      }
    }
    if (user_id) { sql += ' AND e.user_id = ?'; params.push(user_id); }
    if (start_date) { sql += ' AND e.created_at >= ?'; params.push(start_date + ' 00:00:00'); }
    if (end_date) { sql += ' AND e.created_at <= ?'; params.push(end_date + ' 23:59:59'); }

    // Department head can only see their department
    if (req.user.role === 'department_head' && req.user.department_id) {
      sql += ' AND p.department_id = ?';
      params.push(req.user.department_id);
    }

    sql += ' ORDER BY e.created_at DESC';
    const [rows] = await query(sql, params);
    res.json({ evaluations: rows });
  } catch (err) {
    console.error('[EVALUATIONS] Error list:', err.message);
    res.status(500).json({ error: 'Error al listar evaluaciones' });
  }
}

/** GET /api/evaluations/my — Agent's own evaluations */
async function myEvaluations(req, res) {
  try {
    const [rows] = await query(
      `SELECT e.*,
              t.name AS template_name,
              ep.name AS period_name, ep.start_date, ep.end_date,
              ev.first_name AS evaluator_first_name,
              ev.last_name AS evaluator_last_name
       FROM evaluations e
       JOIN evaluation_templates t ON e.template_id = t.id
       JOIN evaluation_periods ep ON e.period_id = ep.id
       LEFT JOIN users ev ON e.evaluator_id = ev.id
       WHERE e.user_id = ?
       ORDER BY e.created_at DESC`,
      [req.user.id]
    );
    res.json({ evaluations: rows });
  } catch (err) {
    console.error('[EVALUATIONS] Error myEvaluations:', err.message);
    res.status(500).json({ error: 'Error al obtener evaluaciones' });
  }
}

/** GET /api/evaluations/:id — Full detail with scores */
async function getById(req, res) {
  try {
    const [evals] = await query(
      `SELECT e.*,
              u.first_name, u.last_name, u.email,
              t.name AS template_name, t.position_id,
              ep.name AS period_name, ep.start_date, ep.end_date, ep.status AS period_status,
              d.name AS department_name,
              p.name AS position_name,
              ev.first_name AS evaluator_first_name,
              ev.last_name AS evaluator_last_name
       FROM evaluations e
       JOIN users u ON e.user_id = u.id
       JOIN evaluation_templates t ON e.template_id = t.id
       JOIN evaluation_periods ep ON e.period_id = ep.id
       JOIN positions p ON t.position_id = p.id
       JOIN departments d ON p.department_id = d.id
       LEFT JOIN users ev ON e.evaluator_id = ev.id
       WHERE e.id = ?`,
      [req.params.id]
    );

    if (evals.length === 0) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }

    const evaluation = evals[0];

    // Access control
    if (req.user.role === 'agent' && evaluation.user_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes acceso a esta evaluación' });
    }

    // Get template structure + scores
    const categories = await getTemplateStructure(evaluation.template_id, evaluation.id);
    const scoresMap = await getScoresMap(evaluation.id);
    const detailed = calculateDetailedScores(categories, scoresMap);

    // Merge scores with template structure
    evaluation.categories = categories.map(cat => ({
      ...cat,
      weight: parseFloat(cat.weight),
      score: detailed.categories.find(c => c.id === cat.id)?.score || 0,
      weighted_contribution: detailed.categories.find(c => c.id === cat.id)?.weighted_contribution || 0,
      criteria: cat.criteria.map(cr => {
        const scoreRecord = scoresMap[cr.id];
        const detailedCr = detailed.categories
          .find(c => c.id === cat.id)?.criteria
          .find(c => c.id === cr.id);
        return {
          ...cr,
          weight: parseFloat(cr.weight),
          target_value: cr.target_value ? parseFloat(cr.target_value) : null,
          agent_value: scoreRecord?.agent_value != null ? parseFloat(scoreRecord.agent_value) : null,
          agent_comment: scoreRecord?.agent_comment || null,
          evaluator_score: scoreRecord?.evaluator_score != null ? parseFloat(scoreRecord.evaluator_score) : null,
          evaluator_comment: scoreRecord?.evaluator_comment || null,
          calculated_score: detailedCr?.score || 0,
        };
      }),
    }));

    evaluation.overall_score = detailed.overall;

    res.json({ evaluation });
  } catch (err) {
    console.error('[EVALUATIONS] Error getById:', err.message);
    res.status(500).json({ error: 'Error al obtener evaluación' });
  }
}

/** GET /api/evaluations/bulk-details — Fetch full details for multiple filtered evaluations */
async function bulkDetails(req, res) {
  try {
    const { period_id, department_id, status } = req.query;
    let sql = `
      SELECT e.id
      FROM evaluations e
      JOIN evaluation_templates t ON e.template_id = t.id
      JOIN positions p ON t.position_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (period_id) { sql += ' AND e.period_id = ?'; params.push(period_id); }
    if (department_id) { sql += ' AND p.department_id = ?'; params.push(department_id); }
    if (status) { sql += ' AND e.status = ?'; params.push(status); }

    // Department head can only see their department
    if (req.user.role === 'department_head' && req.user.department_id) {
      sql += ' AND p.department_id = ?';
      params.push(req.user.department_id);
    }

    sql += ' ORDER BY e.created_at DESC';
    const [rows] = await query(sql, params);

    // Reuse getById logic for each matched evaluation
    const detailedEvaluations = [];
    for (const row of rows) {
      // Mock the req object for getById logic
      const mockReq = { params: { id: row.id }, user: req.user };
      let evalData = null;
      const mockRes = {
        json: (data) => { evalData = data.evaluation; },
        status: () => ({ json: () => {} })
      };
      await getById(mockReq, mockRes);
      if (evalData) {
        detailedEvaluations.push(evalData);
      }
    }

    res.json({ evaluations: detailedEvaluations });
  } catch (err) {
    console.error('[EVALUATIONS] Error bulkDetails:', err.message);
    res.status(500).json({ error: 'Error al obtener evaluaciones masivas' });
  }
}

/** POST /api/evaluations — Create evaluation and initialize scores */
async function create(req, res) {
  const conn = await getConnection();
  try {
    const { user_id, template_id, period_id, evaluator_id } = req.body;

    if (!user_id || !template_id || !period_id) {
      return res.status(400).json({ error: 'user_id, template_id y period_id son requeridos' });
    }

    const [template] = await conn.execute('SELECT id FROM evaluation_templates WHERE id = ? AND is_draft = 0', [template_id]);
    if (template.length === 0) return res.status(400).json({ error: 'Plantilla no válida o es un borrador' });

    await conn.beginTransaction();

    const [result] = await conn.execute(
      `INSERT INTO evaluations (user_id, template_id, period_id, evaluator_id)
       VALUES (?, ?, ?, ?)`,
      [user_id, template_id, period_id, evaluator_id || req.user.id]
    );
    const evalId = result.insertId;

    // Initialize score rows for all criteria
    const categories = await getTemplateStructure(template_id);
    for (const cat of categories) {
      for (const cr of cat.criteria) {
        await conn.execute(
          'INSERT INTO evaluation_scores (evaluation_id, criterion_id) VALUES (?, ?)',
          [evalId, cr.id]
        );
      }
    }

    await conn.commit();

    req.params = { id: evalId };
    await getById(req, res);

    await logAction(req.user.id, 'CREATE_EVALUATION', 'evaluation', evalId, { user_id, template_id });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe una evaluación para este usuario en este período con esta plantilla' });
    }
    console.error('[EVALUATIONS] Error create:', err.message);
    res.status(500).json({ error: 'Error al crear evaluación' });
  } finally {
    conn.release();
  }
}

/** POST /api/evaluations/bulk — Create evaluations for all agents in a department */
async function bulkCreate(req, res) {
  const conn = await getConnection();
  try {
    const { template_id, period_id, department_id } = req.body;

    if (!template_id || !period_id || !department_id) {
      return res.status(400).json({ error: 'template_id, period_id y department_id son requeridos' });
    }

    // Get all active agents in the department with the template's position
    const [template] = await query('SELECT position_id FROM evaluation_templates WHERE id = ? AND is_draft = 0', [template_id]);
    if (template.length === 0) return res.status(404).json({ error: 'Plantilla no válida o es un borrador' });

    const [agents] = await query(
      `SELECT id FROM users 
       WHERE department_id = ? AND position_id = ? AND role = 'agent' AND is_active = 1`,
      [department_id, template[0].position_id]
    );

    if (agents.length === 0) {
      return res.status(400).json({ error: 'No hay agentes con ese puesto en este departamento' });
    }

    await conn.beginTransaction();

    const categories = await getTemplateStructure(template_id);
    const created = [];
    const skipped = [];

    for (const agent of agents) {
      try {
        const [result] = await conn.execute(
          `INSERT INTO evaluations (user_id, template_id, period_id, evaluator_id)
           VALUES (?, ?, ?, ?)`,
          [agent.id, template_id, period_id, req.user.id]
        );

        // Initialize scores
        for (const cat of categories) {
          for (const cr of cat.criteria) {
            await conn.execute(
              'INSERT INTO evaluation_scores (evaluation_id, criterion_id) VALUES (?, ?)',
              [result.insertId, cr.id]
            );
          }
        }
        created.push(agent.id);
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
          skipped.push(agent.id);
        } else {
          throw e;
        }
      }
    }

    await conn.commit();

    res.status(201).json({
      message: `${created.length} evaluaciones creadas, ${skipped.length} omitidas (ya existían)`,
      created_count: created.length,
      skipped_count: skipped.length,
    });
  } catch (err) {
    await conn.rollback();
    console.error('[EVALUATIONS] Error bulkCreate:', err.message);
    res.status(500).json({ error: 'Error al crear evaluaciones en lote' });
  } finally {
    conn.release();
  }
}

/** PATCH /api/evaluations/:id/agent-scores — Agent reports progress */
async function updateAgentScores(req, res) {
  try {
    const { id } = req.params;
    const { scores } = req.body; // [{ criterion_id, value, comment }]

    // Verify ownership
    const [evals] = await query('SELECT user_id, template_id, status FROM evaluations WHERE id = ?', [id]);
    if (evals.length === 0) return res.status(404).json({ error: 'Evaluación no encontrada' });
    
    const isOwner = evals[0].user_id === req.user.id;
    const isAuthorized = isOwner || req.user.role === 'admin' || req.user.role === 'department_head';
    if (!isAuthorized) return res.status(403).json({ error: 'No tienes permiso para actualizar el avance' });
    if (['completed', 'reviewed'].includes(evals[0].status)) {
      return res.status(400).json({ error: 'Esta evaluación ya fue completada' });
    }

    // Update scores
    for (const s of scores) {
      await query(
        `UPDATE evaluation_scores 
         SET agent_value = ?, agent_comment = ?
         WHERE evaluation_id = ? AND criterion_id = ?`,
        [s.value ?? null, s.comment ?? null, id, s.criterion_id]
      );
    }

    // Update status
    if (evals[0].status === 'pending') {
      await query("UPDATE evaluations SET status = 'in_progress' WHERE id = ?", [id]);
    }

    // Recalculate
    await recalculate(id, evals[0].template_id);

    req.params = { id };
    await getById(req, res);
  } catch (err) {
    console.error('[EVALUATIONS] Error updateAgentScores:', err.message);
    res.status(500).json({ error: 'Error al actualizar avance' });
  }
}

/** PATCH /api/evaluations/:id/evaluator-scores — Department head scores */
async function updateEvaluatorScores(req, res) {
  try {
    const { id } = req.params;
    const { scores, comments } = req.body; // scores: [{ criterion_id, score, comment }]

    const [evals] = await query('SELECT template_id, status FROM evaluations WHERE id = ?', [id]);
    if (evals.length === 0) return res.status(404).json({ error: 'Evaluación no encontrada' });

    for (const s of scores) {
      await query(
        `UPDATE evaluation_scores 
         SET evaluator_score = ?, evaluator_comment = ?
         WHERE evaluation_id = ? AND criterion_id = ?`,
        [s.score ?? null, s.comment ?? null, id, s.criterion_id]
      );
    }

    // Update evaluator info
    const updateFields = ['evaluator_id = ?'];
    const updateParams = [req.user.id];
    if (comments) {
      updateFields.push('evaluator_comments = ?');
      updateParams.push(comments);
    }
    updateParams.push(id);
    await query(`UPDATE evaluations SET ${updateFields.join(', ')} WHERE id = ?`, updateParams);

    // Recalculate
    await recalculate(id, evals[0].template_id);

    req.params = { id };
    await getById(req, res);
  } catch (err) {
    console.error('[EVALUATIONS] Error updateEvaluatorScores:', err.message);
    res.status(500).json({ error: 'Error al calificar' });
  }
}

/** PATCH /api/evaluations/:id/submit — Agent submits for review */
async function submit(req, res) {
  try {
    const { id } = req.params;
    const [evals] = await query('SELECT user_id, status FROM evaluations WHERE id = ?', [id]);
    if (evals.length === 0) return res.status(404).json({ error: 'Evaluación no encontrada' });
    if (evals[0].user_id !== req.user.id) return res.status(403).json({ error: 'No es tu evaluación' });

    await query(
      "UPDATE evaluations SET status = 'submitted', submitted_at = NOW() WHERE id = ?",
      [id]
    );

    req.params = { id };
    await getById(req, res);
  } catch (err) {
    console.error('[EVALUATIONS] Error submit:', err.message);
    res.status(500).json({ error: 'Error al enviar evaluación' });
  }
}

/** PATCH /api/evaluations/:id/complete — Evaluator marks as complete */
async function complete(req, res) {
  try {
    const { id } = req.params;
    const [evals] = await query('SELECT template_id FROM evaluations WHERE id = ?', [id]);
    if (evals.length === 0) return res.status(404).json({ error: 'Evaluación no encontrada' });

    // Final recalculation
    const result = await recalculate(id, evals[0].template_id);

    await query(
      `UPDATE evaluations 
       SET status = 'completed', reviewed_at = NOW(), evaluator_id = ?, overall_score = ?
       WHERE id = ?`,
      [req.user.id, result.overall, id]
    );

    req.params = { id };
    await getById(req, res);

    await logAction(req.user.id, 'COMPLETE_EVALUATION', 'evaluation', id, { overall_score: result.overall });
  } catch (err) {
    console.error('[EVALUATIONS] Error complete:', err.message);
    res.status(500).json({ error: 'Error al completar evaluación' });
  }
}

/** DELETE /api/evaluations/:id — Delete evaluation */
async function remove(req, res) {
  const conn = await getConnection();
  try {
    const { id } = req.params;
    
    // Check if the evaluation exists and get department
    const [evals] = await query(`
      SELECT e.*, p.department_id 
      FROM evaluations e
      JOIN evaluation_templates t ON e.template_id = t.id
      JOIN positions p ON t.position_id = p.id
      WHERE e.id = ?
    `, [id]);
    
    if (evals.length === 0) return res.status(404).json({ error: 'Evaluación no encontrada' });
    
    const evaluation = evals[0];
    
    // Department head can only delete evaluations of their department
    if (req.user.role === 'department_head' && req.user.department_id && evaluation.department_id !== req.user.department_id) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar evaluaciones de otro departamento' });
    }
    
    await conn.beginTransaction();
    
    // Delete scores
    await conn.execute('DELETE FROM evaluation_scores WHERE evaluation_id = ?', [id]);
    
    // Delete evaluation
    await conn.execute('DELETE FROM evaluations WHERE id = ?', [id]);
    
    await conn.commit();
    
    await logAction(req.user.id, 'DELETE_EVALUATION', 'evaluation', id, { 
      user_id: evaluation.user_id, 
      template_id: evaluation.template_id 
    });
    
    res.json({ message: 'Evaluación eliminada correctamente' });
  } catch (err) {
    await conn.rollback();
    console.error('[EVALUATIONS] Error delete:', err.message);
    res.status(500).json({ error: 'Error al eliminar evaluación' });
  } finally {
    conn.release();
  }
}

module.exports = {
  list, myEvaluations, getById, bulkDetails, create, bulkCreate,
  updateAgentScores, updateEvaluatorScores, submit, complete, remove,
};
