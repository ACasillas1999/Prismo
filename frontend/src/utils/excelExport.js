import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/**
 * Agrega una hoja (Pestaña) al libro de Excel con la evaluación completa y fórmulas.
 */
export const buildEvaluationSheet = (wb, data, sheetName, agentEdits = {}, evalEdits = {}) => {
  // Limpiar caracteres inválidos para nombres de hoja
  const safeName = sheetName.replace(/[*?:/\\[\]]/g, '').substring(0, 28);
  
  // Asegurar nombre único
  let finalName = safeName;
  let counter = 1;
  while (wb.getWorksheet(finalName)) {
    finalName = `${safeName.substring(0, 25)} (${counter})`;
    counter++;
  }

  const ws = wb.addWorksheet(finalName);

  // Estilos globales
  ws.getColumn(1).width = 40; // Nombre del Criterio
  ws.getColumn(2).width = 15; // Tipo
  ws.getColumn(3).width = 15; // Meta
  ws.getColumn(4).width = 15; // Avance / Calif
  ws.getColumn(5).width = 15; // Peso
  ws.getColumn(6).width = 20; // Resultado (%)

  // Encabezado principal
  ws.addRow(['Evaluación de Desempeño']);
  ws.getCell('A1').font = { size: 16, bold: true };
  ws.addRow(['Agente:', `${data.first_name} ${data.last_name}`]);
  ws.addRow(['Puesto:', data.position_name]);
  ws.addRow(['Período:', data.period_name]);
  ws.addRow(['Departamento:', data.department_name]);
  ws.addRow([]); // Espacio

  let currentRow = 7;
  let catScoreFormulas = [];

  // Recorrer categorías
  data.categories.forEach((cat) => {
    // Header de categoría
    const catRow = ws.addRow([cat.name, '', '', '', `Peso: ${cat.weight}%`, '0']);
    catRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    catRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }; // Azul primary
    
    const catHeaderRowIdx = currentRow;
    const catWeight = parseFloat(cat.weight) || 0;
    catScoreFormulas.push(`(F${catHeaderRowIdx}*${catWeight/100})`);
    currentRow++;

    // Header de tabla
    ws.addRow(['Criterio', 'Tipo', 'Meta', 'Avance o Calif.', 'Peso (%)', 'Resultado (%)']);
    ws.getRow(currentRow).font = { bold: true };
    currentRow++;

    const criteriaStartRow = currentRow;

    cat.criteria.forEach((cr) => {
      const meta = parseFloat(cr.target_value) || 0;
      const peso = parseFloat(cr.weight) || 0;
      
      let valActual = '';
      if (cr.type === 'measurable') {
        valActual = agentEdits[cr.id]?.value !== undefined ? agentEdits[cr.id].value : (cr.agent_value || 0);
      } else {
        valActual = evalEdits[cr.id]?.score !== undefined ? evalEdits[cr.id].score : (cr.evaluator_score || 0);
      }

      const row = ws.addRow([
        cr.name,
        cr.type === 'measurable' ? 'Medible' : 'Subjetivo',
        cr.type === 'measurable' ? meta : 'N/A',
        valActual,
        peso,
        0 // Placeholder
      ]);
      
      const resCell = row.getCell(6);
      const hasCap = cr.cap_at_100 !== false && cr.cap_at_100 !== 0 && cr.cap_at_100 !== '0';

      if (cr.type === 'measurable') {
        let rules = cr.rules;
        if (typeof rules === 'string') {
           try { rules = JSON.parse(rules); } catch(e){ rules = []; }
        }
        if (rules && rules.length > 0) {
          let fallbackFormula = `(D${currentRow}/C${currentRow})*100`;
          if (hasCap) fallbackFormula = `MIN(100, ${fallbackFormula})`;

          let ifChain = fallbackFormula;
          [...rules].reverse().forEach(r => {
            ifChain = `IF(AND(D${currentRow}>=${r.min}, D${currentRow}<=${r.max}), ${r.pct}, ${ifChain})`;
          });
          resCell.value = { formula: ifChain };
        } else {
          let f = `(D${currentRow}/C${currentRow})*100`;
          if (hasCap) f = `MIN(100, ${f})`;
          resCell.value = { formula: f };
        }
      } else {
        let f = `D${currentRow}`;
        if (hasCap) f = `MIN(100, D${currentRow})`;
        resCell.value = { formula: f };
      }

      row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }; // Celda amarilla editable
      currentRow++;
    });

    const criteriaEndRow = currentRow - 1;

    // Sumaproducto para la categoría: =SUMPRODUCT(F7:F10, E7:E10)/100
    if (criteriaEndRow >= criteriaStartRow) {
      const sumFormula = `SUMPRODUCT(F${criteriaStartRow}:F${criteriaEndRow}, E${criteriaStartRow}:E${criteriaEndRow})/100`;
      ws.getCell(`F${catHeaderRowIdx}`).value = { formula: sumFormula };
    } else {
      ws.getCell(`F${catHeaderRowIdx}`).value = 0;
    }
    
    ws.addRow([]); // Espacio
    currentRow++;
  });

  // Fila final
  const totalRow = ws.addRow(['', '', '', '', 'Puntaje Final:', 0]);
  totalRow.font = { bold: true, size: 14 };
  
  if (catScoreFormulas.length > 0) {
    ws.getCell(`F${currentRow}`).value = { formula: catScoreFormulas.join('+') };
  }
};

/**
 * Exporta una sola evaluación
 */
export const exportSingleExcel = async (data, agentEdits = {}, evalEdits = {}) => {
  const wb = new ExcelJS.Workbook();
  buildEvaluationSheet(wb, data, 'Evaluacion', agentEdits, evalEdits);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Evaluacion_${data.first_name}_${data.last_name}.xlsx`);
};

/**
 * Exporta múltiples evaluaciones en un solo archivo con una pestaña por empleado
 */
export const exportBulkExcel = async (dataArray, filename = 'Evaluaciones_Prismo.xlsx') => {
  const wb = new ExcelJS.Workbook();
  
  if (dataArray.length === 0) {
    wb.addWorksheet('Sin Datos');
  } else {
    dataArray.forEach((data) => {
      const sheetName = `${data.first_name} ${data.last_name}`;
      buildEvaluationSheet(wb, data, sheetName);
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, filename);
};

/**
 * Exporta el reporte general (dashboard) a Excel con 2 pestañas
 */
export const exportDashboardExcel = async (data, deptName = 'General', filename = 'Reporte_Dashboard.xlsx') => {
  const wb = new ExcelJS.Workbook();
  
  // Pestaña 1: Resumen y Categorías
  const ws1 = wb.addWorksheet('Resumen de Rendimiento');
  ws1.getColumn(1).width = 30;
  ws1.getColumn(2).width = 20;
  ws1.getColumn(3).width = 20;
  
  ws1.addRow(['Reporte de Rendimiento - ' + deptName]);
  ws1.getCell('A1').font = { size: 16, bold: true };
  ws1.addRow([]);

  ws1.addRow(['Categoría Evaluada', 'Promedio Obtenido', 'Meta']);
  ws1.getRow(3).font = { bold: true };
  ws1.getRow(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  ws1.getRow(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  if (data.categoryAverages && data.categoryAverages.length > 0) {
    data.categoryAverages.forEach(cat => {
      ws1.addRow([cat.subject, `${cat.A}%`, '100%']);
    });
  } else {
    ws1.addRow(['Sin datos', '-', '-']);
  }

  // Pestaña 2: Ranking
  const ws2 = wb.addWorksheet('Ranking Completo');
  ws2.getColumn(1).width = 10;
  ws2.getColumn(2).width = 30;
  ws2.getColumn(3).width = 30;
  ws2.getColumn(4).width = 25;
  ws2.getColumn(5).width = 15;

  ws2.addRow(['#', 'Agente', 'Puesto', 'Evaluador', 'Calificación']);
  ws2.getRow(1).font = { bold: true };
  ws2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  ws2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  if (data.fullRanking && data.fullRanking.length > 0) {
    data.fullRanking.forEach((agent, index) => {
      ws2.addRow([
        index + 1,
        `${agent.first_name} ${agent.last_name}`,
        agent.position_name,
        agent.evaluator_first ? `${agent.evaluator_first} ${agent.evaluator_last}` : 'Autoasignado',
        `${parseFloat(agent.overall_score).toFixed(1)}%`
      ]);
    });
  } else {
    ws2.addRow(['-', 'Sin datos', '-', '-', '-']);
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, filename);
};
