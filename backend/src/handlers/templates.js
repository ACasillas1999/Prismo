'use strict';
const { query, getConnection } = require('../config/db');
const { logAction } = require('../utils/logger');

/** GET /api/templates */
async function list(req, res) {
  try {
    const { position_id, department_id } = req.query;
    let sql = `
      SELECT t.*, p.name AS position_name, d.name AS department_name,
             u.first_name AS creator_first_name, u.last_name AS creator_last_name,
             COUNT(DISTINCT tc.id) AS categories_count
      FROM evaluation_templates t
      JOIN positions p ON t.position_id = p.id
      JOIN departments d ON p.department_id = d.id
      JOIN users u ON t.created_by = u.id
      LEFT JOIN template_categories tc ON tc.template_id = t.id
      WHERE t.is_active = 1
    `;
    const params = [];

    if (position_id) {
      sql += ' AND t.position_id = ?';
      params.push(position_id);
    }

    if (department_id) {
      sql += ' AND p.department_id = ?';
      params.push(department_id);
    }

    // Department filter for department_head role
    if (req.user.role === 'department_head' && req.user.department_id) {
      sql += ' AND p.department_id = ?';
      params.push(req.user.department_id);
    }

    sql += ' GROUP BY t.id ORDER BY t.updated_at DESC';

    const [rows] = await query(sql, params);
    res.json({ templates: rows });
  } catch (err) {
    console.error('[TEMPLATES] Error list:', err.message);
    res.status(500).json({ error: 'Error al listar plantillas' });
  }
}

/** GET /api/templates/:id — Full detail with categories and criteria */
async function getById(req, res) {
  try {
    const [templates] = await query(
      `SELECT t.*, p.name AS position_name, d.name AS department_name,
              p.department_id
       FROM evaluation_templates t
       JOIN positions p ON t.position_id = p.id
       JOIN departments d ON p.department_id = d.id
       WHERE t.id = ? AND t.is_active = 1`,
      [req.params.id]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    const template = templates[0];

    // Fetch categories
    const [categories] = await query(
      `SELECT * FROM template_categories WHERE template_id = ? AND is_active = 1 ORDER BY sort_order, id`,
      [template.id]
    );

    // Fetch criteria for each category
    for (const cat of categories) {
      const [criteria] = await query(
        `SELECT * FROM template_criteria WHERE category_id = ? AND is_active = 1 ORDER BY sort_order, id`,
        [cat.id]
      );
      cat.criteria = criteria;
    }

    template.categories = categories;

    res.json({ template });
  } catch (err) {
    console.error('[TEMPLATES] Error getById:', err.message);
    res.status(500).json({ error: 'Error al obtener plantilla' });
  }
}

/**
 * POST /api/templates — Create template with nested categories and criteria.
 * Body: {
 *   position_id, name, description,
 *   categories: [
 *     { name, description, weight, sort_order, criteria: [
 *       { name, description, type, target_value, unit, weight, sort_order }
 *     ]}
 *   ]
 * }
 */
async function create(req, res) {
  const conn = await getConnection();

  try {
    const { position_id, name, description, frequency, categories, is_draft } = req.body;
    const isDraft = is_draft === true;

    // Validations
    if (!position_id) return res.status(400).json({ error: 'El puesto es requerido' });
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    if (!isDraft && (!categories || categories.length === 0)) {
      return res.status(400).json({ error: 'Debe incluir al menos una categoría' });
    }

    const safeCategories = categories || [];

    if (!isDraft) {
      // Validate category weights sum to 100
      const catWeightSum = categories.reduce((sum, c) => sum + parseFloat(c.weight || 0), 0);
      if (Math.abs(catWeightSum - 100) > 0.01) {
      return res.status(400).json({
        error: `Los pesos de las categorías deben sumar 100% (actualmente: ${catWeightSum.toFixed(2)}%)`,
      });
    }

    // Validate criteria weights within each category
    for (const cat of categories) {
      if (!cat.criteria || cat.criteria.length === 0) {
        return res.status(400).json({
          error: `La categoría "${cat.name}" debe tener al menos un criterio`,
        });
      }
      const critWeightSum = cat.criteria.reduce((sum, cr) => sum + parseFloat(cr.weight || 0), 0);
      if (Math.abs(critWeightSum - 100) > 0.01) {
        return res.status(400).json({
          error: `Los criterios de "${cat.name}" deben sumar 100% (actualmente: ${critWeightSum.toFixed(2)}%)`,
        });
      }
    }
    }

    await conn.beginTransaction();

    // Insert template
    const [templateResult] = await conn.execute(
      `INSERT INTO evaluation_templates (position_id, name, description, frequency, is_draft, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [position_id, name.trim(), description || null, frequency || 'manual', isDraft ? 1 : 0, req.user.id]
    );
    const templateId = templateResult.insertId;

    // Insert categories and criteria
    for (let i = 0; i < safeCategories.length; i++) {
      const cat = safeCategories[i];
      const [catResult] = await conn.execute(
        `INSERT INTO template_categories (template_id, name, description, weight, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [templateId, cat.name, cat.description || null, cat.weight, cat.sort_order ?? i]
      );
      const categoryId = catResult.insertId;

        for (let j = 0; j < cat.criteria.length; j++) {
          const cr = cat.criteria[j];
          await conn.execute(
            `INSERT INTO template_criteria (category_id, name, description, type, target_value, unit, weight, cap_at_100, rules, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [categoryId, cr.name, cr.description || null, cr.type || 'subjective',
             cr.target_value || null, cr.unit || null, cr.weight, cr.cap_at_100 !== false ? 1 : 0, cr.rules ? JSON.stringify(cr.rules) : null, cr.sort_order ?? j]
          );
        }
    }

    await conn.commit();

    // Fetch full template
    req.params = { id: templateId };
    await getById(req, res);

    await logAction(req.user.id, 'CREATE_TEMPLATE', 'template', templateId, { name: name.trim() });
  } catch (err) {
    await conn.rollback();
    console.error('[TEMPLATES] Error create:', err.message);
    res.status(500).json({ error: 'Error al crear plantilla' });
  } finally {
    conn.release();
  }
}

/** PUT /api/templates/:id — Full replace of categories/criteria */
async function update(req, res) {
  const conn = await getConnection();

  try {
    const { id } = req.params;
    const { name, description, position_id, frequency, categories, is_draft } = req.body;
    const isDraft = is_draft === true;
    const safeCategories = categories || [];

    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });

    if (!isDraft && safeCategories.length === 0) {
      return res.status(400).json({ error: 'Debe incluir al menos una categoría' });
    }

    if (safeCategories.length > 0 && !isDraft) {
      // Validate weights
      const catWeightSum = categories.reduce((sum, c) => sum + parseFloat(c.weight || 0), 0);
      if (Math.abs(catWeightSum - 100) > 0.01) {
        return res.status(400).json({
          error: `Los pesos de las categorías deben sumar 100% (actualmente: ${catWeightSum.toFixed(2)}%)`,
        });
      }
      for (const cat of categories) {
        if (!cat.criteria || cat.criteria.length === 0) {
          return res.status(400).json({
            error: `La categoría "${cat.name}" debe tener al menos un criterio`,
          });
        }
        const critWeightSum = cat.criteria.reduce((sum, cr) => sum + parseFloat(cr.weight || 0), 0);
        if (Math.abs(critWeightSum - 100) > 0.01) {
          return res.status(400).json({
            error: `Los criterios de "${cat.name}" deben sumar 100% (actualmente: ${critWeightSum.toFixed(2)}%)`,
          });
        }
      }
    }

    await conn.beginTransaction();

    // Check if in use
    const [evals] = await conn.execute('SELECT id FROM evaluations WHERE template_id = ? LIMIT 1', [id]);
    const isInUse = evals.length > 0;

    // Update template (name, description, frequency, is_draft, position)
    const updates = ['name = ?', 'description = ?', 'frequency = ?', 'is_draft = ?'];
    const params = [name.trim(), description || null, frequency || 'manual', isDraft ? 1 : 0];
    if (position_id) {
      updates.push('position_id = ?');
      params.push(position_id);
    }
    params.push(id);

    await conn.execute(
      `UPDATE evaluation_templates SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (safeCategories) {
      const [existingCats] = await conn.execute('SELECT id FROM template_categories WHERE template_id = ? AND is_active = 1', [id]);
      const [existingCrits] = await conn.execute('SELECT c.id FROM template_criteria c JOIN template_categories tc ON c.category_id = tc.id WHERE tc.template_id = ? AND c.is_active = 1', [id]);

      const reqCatIds = new Set();
      const reqCritIds = new Set();

      for (let i = 0; i < safeCategories.length; i++) {
        const cat = safeCategories[i];
        let categoryId = cat.id;

        if (categoryId) {
          reqCatIds.add(categoryId);
          await conn.execute(
            `UPDATE template_categories SET name=?, description=?, weight=?, sort_order=? WHERE id=?`,
            [cat.name, cat.description || null, cat.weight, cat.sort_order ?? i, categoryId]
          );
        } else {
          const [catResult] = await conn.execute(
            `INSERT INTO template_categories (template_id, name, description, weight, sort_order) VALUES (?, ?, ?, ?, ?)`,
            [id, cat.name, cat.description || null, cat.weight, cat.sort_order ?? i]
          );
          categoryId = catResult.insertId;
        }

        for (let j = 0; j < (cat.criteria || []).length; j++) {
          const cr = cat.criteria[j];
          let criterionId = cr.id;

          if (criterionId) {
            reqCritIds.add(criterionId);
            await conn.execute(
              `UPDATE template_criteria SET name=?, description=?, type=?, target_value=?, unit=?, weight=?, cap_at_100=?, rules=?, sort_order=? WHERE id=?`,
              [cr.name, cr.description || null, cr.type || 'subjective', cr.target_value || null, cr.unit || null, cr.weight, cr.cap_at_100 !== false ? 1 : 0, cr.rules ? JSON.stringify(cr.rules) : null, cr.sort_order ?? j, criterionId]
            );
          } else {
            const [crResult] = await conn.execute(
              `INSERT INTO template_criteria (category_id, name, description, type, target_value, unit, weight, cap_at_100, rules, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [categoryId, cr.name, cr.description || null, cr.type || 'subjective', cr.target_value || null, cr.unit || null, cr.weight, cr.cap_at_100 !== false ? 1 : 0, cr.rules ? JSON.stringify(cr.rules) : null, cr.sort_order ?? j]
            );
            criterionId = crResult.insertId;

            if (isInUse) {
              const [evalsToUpdate] = await conn.execute(`SELECT id FROM evaluations WHERE template_id = ? AND status != 'completed'`, [id]);
              for (const e of evalsToUpdate) {
                await conn.execute(`INSERT IGNORE INTO evaluation_scores (evaluation_id, criterion_id) VALUES (?, ?)`, [e.id, criterionId]);
              }
            }
          }
        }
      }

      for (const eCat of existingCats) {
        if (!reqCatIds.has(eCat.id)) {
          await conn.execute(`UPDATE template_categories SET is_active = 0 WHERE id = ?`, [eCat.id]);
        }
      }
      for (const eCrit of existingCrits) {
        if (!reqCritIds.has(eCrit.id)) {
          await conn.execute(`UPDATE template_criteria SET is_active = 0 WHERE id = ?`, [eCrit.id]);
          await conn.execute(`
            DELETE es FROM evaluation_scores es
            JOIN evaluations e ON es.evaluation_id = e.id
            WHERE es.criterion_id = ? AND e.status != 'completed'
          `, [eCrit.id]);
        }
      }
    }

    await conn.commit();

    req.params = { id };
    await getById(req, res);

    await logAction(req.user.id, 'UPDATE_TEMPLATE', 'template', id, { name: name.trim() });
  } catch (err) {
    await conn.rollback();
    console.error('[TEMPLATES] Error update:', err.message);
    res.status(500).json({ error: 'Error al actualizar plantilla' });
  } finally {
    conn.release();
  }
}

/** DELETE /api/templates/:id */
async function remove(req, res) {
  try {
    const [result] = await query(
      'UPDATE evaluation_templates SET is_active = 0 WHERE id = ? AND is_active = 1',
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }
    res.json({ message: 'Plantilla eliminada' });
    await logAction(req.user.id, 'DELETE_TEMPLATE', 'template', req.params.id);
  } catch (err) {
    console.error('[TEMPLATES] Error remove:', err.message);
    res.status(500).json({ error: 'Error al eliminar plantilla' });
  }
}

module.exports = { list, getById, create, update, remove };
