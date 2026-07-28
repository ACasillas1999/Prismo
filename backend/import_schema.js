'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query } = require('./src/config/db');

async function importSchema() {
  console.log('[SCHEMA] Iniciando importación del esquema en la base de datos remota...');
  
  const sqlPath = path.join(__dirname, 'sql', 'schema.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error(`[SCHEMA] ✗ No se encontró el archivo schema.sql en: ${sqlPath}`);
    process.exit(1);
  }

  const sqlFile = fs.readFileSync(sqlPath, 'utf8');

  // Separar consultas por punto y coma, limpiando comentarios y espacios
  const queries = sqlFile
    .split(';')
    .map(q => q.trim())
    .filter(q => q.length > 0 && !q.startsWith('--') && !q.startsWith('/*'));

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    try {
      // Omitimos CREATE DATABASE IF NOT EXISTS prismo_db si no somos root o ya estamos conectados a ella.
      if (q.toUpperCase().startsWith('CREATE DATABASE') || q.toUpperCase().startsWith('USE ')) {
        continue;
      }
      await query(q);
    } catch (err) {
      console.warn(`[SCHEMA] ⚠ Error ejecutando consulta #${i + 1}: ${q.substring(0, 50)}...`);
      console.warn(`         Detalle: ${err.message}`);
    }
  }

  console.log('[SCHEMA] ✓ Importación de tablas completada con éxito.');
  process.exit(0);
}

importSchema().catch(err => {
  console.error('[SCHEMA] ✗ Error crítico:', err.message);
  process.exit(1);
});
