'use strict';
require('dotenv').config({ path: '../../.env' });
const { query, getConnection } = require('../config/db');
const bcrypt = require('bcryptjs');

async function run() {
  const conn = await getConnection();
  try {
    console.log('Iniciando carga de ejemplos premium...');
    await conn.beginTransaction();

    // 1. Crear Departamentos
    const [dRes1] = await conn.execute("INSERT IGNORE INTO departments (name, description) VALUES ('Ventas y Comercial', 'Equipo enfocado en crecimiento de revenue')");
    const [dRes2] = await conn.execute("INSERT IGNORE INTO departments (name, description) VALUES ('Tecnología e Ingeniería', 'Desarrollo de software e infraestructura')");
    const [dRes3] = await conn.execute("INSERT IGNORE INTO departments (name, description) VALUES ('Logística y Operaciones', 'Gestión de almacenes y entregas')");
    
    // Obtener IDs de departamentos
    const [[deptVentas]] = await conn.execute("SELECT id FROM departments WHERE name = 'Ventas y Comercial'");
    const [[deptTech]] = await conn.execute("SELECT id FROM departments WHERE name = 'Tecnología e Ingeniería'");
    const [[deptLog]] = await conn.execute("SELECT id FROM departments WHERE name = 'Logística y Operaciones'");

    // 2. Crear Puestos
    const [pRes1] = await conn.execute("INSERT IGNORE INTO positions (department_id, name) VALUES (?, 'Ejecutivo de Ventas Senior')", [deptVentas.id]);
    const [pRes2] = await conn.execute("INSERT IGNORE INTO positions (department_id, name) VALUES (?, 'Desarrollador Full-Stack')", [deptTech.id]);
    const [pRes3] = await conn.execute("INSERT IGNORE INTO positions (department_id, name) VALUES (?, 'Coordinador de Almacén')", [deptLog.id]);

    const [[posVentas]] = await conn.execute("SELECT id FROM positions WHERE name = 'Ejecutivo de Ventas Senior'");
    const [[posTech]] = await conn.execute("SELECT id FROM positions WHERE name = 'Desarrollador Full-Stack'");
    const [[posLog]] = await conn.execute("SELECT id FROM positions WHERE name = 'Coordinador de Almacén'");

    // 3. Obtener admin para autorías
    const [[admin]] = await conn.execute("SELECT id FROM users WHERE email = 'admin@prismo.local'");
    if (!admin) throw new Error("No se encontró admin@prismo.local");

    // 4. Crear Plantilla 1: Ventas (Muestra Cap_at_100 = false y reglas de comisiones)
    const [tRes1] = await conn.execute(
      "INSERT INTO evaluation_templates (position_id, name, description, created_by) VALUES (?, ?, ?, ?)",
      [posVentas.id, 'Evaluación Trimestral - Ventas (Comisiones Dinámicas)', 'Demuestra que se puede superar el 100% (Sin tope) y reglas por rangos de conversión.', admin.id]
    );
    const tId1 = tRes1.insertId;

    // Cat 1: Resultados Financieros (60%)
    const [c11] = await conn.execute("INSERT INTO template_categories (template_id, name, weight) VALUES (?, 'Resultados Financieros', 60.00)", [tId1]);
    await conn.execute(
      "INSERT INTO template_criteria (category_id, name, description, type, target_value, unit, weight, cap_at_100) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [c11.insertId, 'Ingresos Generados', 'Meta de ventas del trimestre. NO ESTÁ TOPADO AL 100%, si el agente vende más, recibirá puntos extra en su evaluación global.', 'measurable', 100000, 'USD', 60.00, 0] // 0 = false
    );
    await conn.execute(
      "INSERT INTO template_criteria (category_id, name, description, type, target_value, unit, weight, rules) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        c11.insertId, 'Cierre de Contratos', 'Ejemplo de regla por rangos. Tienes meta de 10. Si haces menos de 4 repruebas. Si haces 5-7 tienes 80%. Si haces 8-10 tienes 100%.', 
        'measurable', 10, 'contratos', 40.00, 
        JSON.stringify([{min:0, max:4, pct:0}, {min:5, max:7, pct:80}, {min:8, max:100, pct:100}])
      ]
    );

    // Cat 2: Calidad de Atención (40%)
    const [c12] = await conn.execute("INSERT INTO template_categories (template_id, name, weight) VALUES (?, 'Habilidades Blandas', 40.00)", [tId1]);
    await conn.execute(
      "INSERT INTO template_criteria (category_id, name, description, type, weight) VALUES (?, ?, ?, ?, ?)",
      [c12.insertId, 'Trabajo en equipo y liderazgo', 'Criterio subjetivo. El jefe evaluará del 0 al 100 la actitud del agente.', 'subjective', 100.00]
    );

    // 5. Crear Plantilla 2: Tecnología (Muestra penalizaciones y "menos es mejor")
    const [tRes2] = await conn.execute(
      "INSERT INTO evaluation_templates (position_id, name, description, created_by) VALUES (?, ?, ?, ?)",
      [posTech.id, 'Evaluación Devs - Calidad y Entregables', 'Usa las reglas para métricas inversas (donde menos puntos es mejor, ej: Bugs)', admin.id]
    );
    const tId2 = tRes2.insertId;

    // Cat 1: Productividad (50%)
    const [c21] = await conn.execute("INSERT INTO template_categories (template_id, name, weight) VALUES (?, 'Productividad', 50.00)", [tId2]);
    await conn.execute(
      "INSERT INTO template_criteria (category_id, name, description, type, target_value, unit, weight) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [c21.insertId, 'Story Points Completados', 'Puntos quemados en los sprints', 'measurable', 45, 'pts', 100.00]
    );

    // Cat 2: Calidad (50%)
    const [c22] = await conn.execute("INSERT INTO template_categories (template_id, name, weight) VALUES (?, 'Calidad de Código', 50.00)", [tId2]);
    await conn.execute(
      "INSERT INTO template_criteria (category_id, name, description, type, target_value, unit, weight, rules) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        c22.insertId, 'Bugs críticos en Producción', 'Métrica INVERSA: La meta es 0. Si hay 0 = 100%. Si hay 1 a 2 = 50%. Más de 3 = 0%.', 
        'measurable', 0, 'bugs', 100.00,
        JSON.stringify([{min:0, max:0, pct:100}, {min:1, max:2, pct:50}, {min:3, max:999, pct:0}])
      ]
    );

    // 6. Crear Plantilla 3: Logística (Muestra métricas binarias estrictas)
    const [tRes3] = await conn.execute(
      "INSERT INTO evaluation_templates (position_id, name, description, created_by) VALUES (?, ?, ?, ?)",
      [posLog.id, 'Auditoría Logística', 'Métricas estrictas: Cumples o no cumples. Todo o nada.', admin.id]
    );
    const tId3 = tRes3.insertId;

    const [c31] = await conn.execute("INSERT INTO template_categories (template_id, name, weight) VALUES (?, 'Seguridad Operativa', 100.00)", [tId3]);
    await conn.execute(
      "INSERT INTO template_criteria (category_id, name, description, type, target_value, unit, weight, rules) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        c31.insertId, 'Accidentes de Trabajo', 'Si hay 0 accidentes, aprueba. 1 o más, pierde todo el porcentaje de este rubro.', 
        'measurable', 0, 'accidentes', 100.00,
        JSON.stringify([{min:0, max:0, pct:100}, {min:1, max:999, pct:0}])
      ]
    );

    // 7. Período
    const [perRes] = await conn.execute("INSERT IGNORE INTO evaluation_periods (name, start_date, end_date, status, created_by) VALUES ('Q3 2026 - Demo', '2026-07-01', '2026-09-30', 'active', ?)", [admin.id]);
    const periodId = perRes.insertId || (await conn.execute("SELECT id FROM evaluation_periods WHERE name='Q3 2026 - Demo'"))[0][0].id;

    // 8. Crear Usuarios (Agentes)
    const hash = await bcrypt.hash('123456', 10);
    
    // User Ventas
    await conn.execute("INSERT IGNORE INTO users (email, password_hash, first_name, last_name, role, department_id, position_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['carlos.ventas@prismo.local', hash, 'Carlos', 'Comercial', 'agent', deptVentas.id, posVentas.id]);
    const [[userVentas]] = await conn.execute("SELECT id FROM users WHERE email='carlos.ventas@prismo.local'");

    // User Tech
    await conn.execute("INSERT IGNORE INTO users (email, password_hash, first_name, last_name, role, department_id, position_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['ana.dev@prismo.local', hash, 'Ana', 'Desarrolladora', 'agent', deptTech.id, posTech.id]);
    const [[userTech]] = await conn.execute("SELECT id FROM users WHERE email='ana.dev@prismo.local'");

    // User Logistica
    await conn.execute("INSERT IGNORE INTO users (email, password_hash, first_name, last_name, role, department_id, position_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['luis.log@prismo.local', hash, 'Luis', 'Operaciones', 'agent', deptLog.id, posLog.id]);
    const [[userLog]] = await conn.execute("SELECT id FROM users WHERE email='luis.log@prismo.local'");

    // 9. Crear Evaluaciones y Scores Demo

    // Helper para obtener criterios de un template
    const getCrits = async (tId) => {
      const [rows] = await conn.execute("SELECT id, type FROM template_criteria WHERE category_id IN (SELECT id FROM template_categories WHERE template_id = ?)", [tId]);
      return rows;
    };

    // --- Evaluación 1: Ventas (En Progreso) ---
    await conn.execute("INSERT IGNORE INTO evaluations (user_id, template_id, period_id, status) VALUES (?, ?, ?, 'in_progress')", [userVentas.id, tId1, periodId]);
    const [[eval1]] = await conn.execute("SELECT id FROM evaluations WHERE user_id=? AND template_id=? AND period_id=?", [userVentas.id, tId1, periodId]);
    const crits1 = await getCrits(tId1);
    for (const cr of crits1) {
      if (cr.type === 'measurable') {
        // Ponemos 120,000 en el primer criterio (overperformance) y 6 contratos en el segundo (regla 80%)
        const val = cr.id === crits1[0].id ? 120000 : 6;
        await conn.execute("INSERT IGNORE INTO evaluation_scores (evaluation_id, criterion_id, agent_value) VALUES (?, ?, ?)", [eval1.id, cr.id, val]);
      } else {
        await conn.execute("INSERT IGNORE INTO evaluation_scores (evaluation_id, criterion_id) VALUES (?, ?)", [eval1.id, cr.id]);
      }
    }

    // --- Evaluación 2: Tech (Completada y calificada) ---
    await conn.execute("INSERT IGNORE INTO evaluations (user_id, template_id, period_id, status, overall_score, evaluator_id) VALUES (?, ?, ?, 'completed', 85.50, ?)", [userTech.id, tId2, periodId, admin.id]);
    const [[eval2]] = await conn.execute("SELECT id FROM evaluations WHERE user_id=? AND template_id=? AND period_id=?", [userTech.id, tId2, periodId]);
    const crits2 = await getCrits(tId2);
    for (const cr of crits2) {
      if (cr.type === 'measurable') {
        // Cumple 45 pts, pero tuvo 1 bug (50% penalización)
        const val = cr.id === crits2[0].id ? 45 : 1;
        await conn.execute("INSERT IGNORE INTO evaluation_scores (evaluation_id, criterion_id, agent_value, calculated_score) VALUES (?, ?, ?, ?)", [eval2.id, cr.id, val, cr.id === crits2[0].id ? 100 : 50]);
      } else {
        await conn.execute("INSERT IGNORE INTO evaluation_scores (evaluation_id, criterion_id) VALUES (?, ?)", [eval2.id, cr.id]);
      }
    }

    // --- Evaluación 3: Logística (Pendiente) ---
    await conn.execute("INSERT IGNORE INTO evaluations (user_id, template_id, period_id, status) VALUES (?, ?, ?, 'pending')", [userLog.id, tId3, periodId]);
    
    await conn.commit();
    console.log('✅ Usuarios de prueba y evaluaciones generados con éxito!');
    process.exit(0);
  } catch (err) {
    await conn.rollback();
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
