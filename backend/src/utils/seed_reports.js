'use strict';
require('dotenv').config({ path: '../../.env' });
const { query, getConnection } = require('../config/db');
const bcrypt = require('bcryptjs');

async function run() {
  const conn = await getConnection();
  try {
    console.log('Iniciando generador de datos masivos para reportes...');
    await conn.beginTransaction();

    const [[admin]] = await conn.execute("SELECT id FROM users WHERE email = 'admin@prismo.local'");
    if (!admin) throw new Error("Ejecuta primero seed_examples.js");

    const hash = await bcrypt.hash('123456', 10);

    // Crear 6 periodos mensuales históricos (Ene - Jun)
    const periods = [];
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'];
    for (let i = 0; i < 6; i++) {
      const name = `${months[i]} 2026`;
      const [ex] = await conn.execute("SELECT id FROM evaluation_periods WHERE name = ?", [name]);
      let pid;
      if (ex.length > 0) {
        pid = ex[0].id;
      } else {
        const d = new Date(2026, i, 1);
        const start = d.toISOString().split('T')[0];
        const dEnd = new Date(2026, i + 1, 0);
        const end = dEnd.toISOString().split('T')[0];
        const [res] = await conn.execute(
          "INSERT INTO evaluation_periods (name, start_date, end_date, created_by, status) VALUES (?, ?, ?, ?, 'closed')",
          [name, start, end, admin.id]
        );
        pid = res.insertId;
      }
      periods.push(pid);
    }
    // Asegurar que el último mes esté activo
    await conn.execute("UPDATE evaluation_periods SET status = 'active' WHERE id = ?", [periods[5]]);

    const deptsToSeed = [
      { deptName: 'Ventas y Comercial', posName: 'Ejecutivo de Ventas Senior', prefix: 'ventas', label: 'Vendedor' },
      { deptName: 'Tecnología e Ingeniería', posName: 'Desarrollador Full-Stack', prefix: 'dev', label: 'Dev' },
      { deptName: 'Logística y Operaciones', posName: 'Coordinador de Almacén', prefix: 'logistica', label: 'Operador' }
    ];

    for (const config of deptsToSeed) {
      console.log(`Sembrando departamento: ${config.deptName}`);
      const [[dept]] = await conn.execute("SELECT id FROM departments WHERE name = ?", [config.deptName]);
      const [[pos]] = await conn.execute("SELECT id FROM positions WHERE name = ? AND department_id = ?", [config.posName, dept.id]);
      
      const agents = [];
      for (let i = 1; i <= 10; i++) {
        const email = `${config.prefix}${i}@prismo.local`;
        const fname = config.label;
        const lname = `Pro ${i}`;
        
        const [ex] = await conn.execute("SELECT id FROM users WHERE email = ?", [email]);
        let agentId;
        if (ex.length > 0) {
          agentId = ex[0].id;
        } else {
          const [res] = await conn.execute(
            "INSERT INTO users (email, password_hash, first_name, last_name, role, department_id, position_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
            [email, hash, fname, lname, 'agent', dept.id, pos.id]
          );
          agentId = res.insertId;
        }
        agents.push(agentId);
      }

      // Obtener la plantilla
      const [[template]] = await conn.execute("SELECT id FROM evaluation_templates WHERE position_id = ? LIMIT 1", [pos.id]);
      if (!template) continue;
      
      const [categories] = await conn.execute("SELECT id, name FROM template_categories WHERE template_id = ?", [template.id]);
      const criteria = [];
      for (const c of categories) {
        const [crits] = await conn.execute("SELECT id, type, target_value FROM template_criteria WHERE category_id = ?", [c.id]);
        criteria.push(...crits);
      }

      let baseScoreMultipler = 0.6; 
      for (let pIdx = 0; pIdx < periods.length; pIdx++) {
        const pid = periods[pIdx];
        baseScoreMultipler += 0.05; 
        
        for (let aIdx = 0; aIdx < agents.length; aIdx++) {
          const agentId = agents[aIdx];
          
          let agentSkill = 1.0;
          if (aIdx === 0) agentSkill = 1.3;
          if (aIdx === 9) agentSkill = 0.5;

          const scoreBase = baseScoreMultipler * agentSkill;
          
          // Verificar si ya existe para no duplicar si se corre dos veces
          const [existingEv] = await conn.execute("SELECT id FROM evaluations WHERE user_id = ? AND period_id = ?", [agentId, pid]);
          if (existingEv.length > 0) continue;

          const [evRes] = await conn.execute(
            "INSERT INTO evaluations (user_id, template_id, period_id, status, evaluator_id, overall_score, created_at) VALUES (?, ?, ?, 'completed', ?, 0, ?)",
            [agentId, template.id, pid, admin.id, `2026-0${pIdx+1}-15 10:00:00`]
          );
          const evId = evRes.insertId;

          for (const cr of criteria) {
            const rand = 0.8 + (Math.random() * 0.4);
            let finalPerf = scoreBase * rand;
            if (finalPerf > 1.2) finalPerf = 1.2;
            
            let agentVal = null;
            let evalVal = null;
            
            if (cr.type === 'measurable') {
              agentVal = cr.target_value * finalPerf;
              await conn.execute(
                "INSERT INTO evaluation_scores (evaluation_id, criterion_id, agent_value) VALUES (?, ?, ?)",
                [evId, cr.id, agentVal]
              );
            } else {
              evalVal = 100 * finalPerf;
              if (evalVal > 100) evalVal = 100;
              await conn.execute(
                "INSERT INTO evaluation_scores (evaluation_id, criterion_id, evaluator_score) VALUES (?, ?, ?)",
                [evId, cr.id, evalVal]
              );
            }
          }
          
          const finalOverall = Math.min(100, Math.round(scoreBase * 100));
          await conn.execute("UPDATE evaluations SET overall_score = ? WHERE id = ?", [finalOverall, evId]);
        }
      }
    }

    await conn.commit();
    console.log('✅ Datos masivos creados exitosamente en todos los departamentos.');
    process.exit(0);
  } catch (err) {
    await conn.rollback();
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

run();
