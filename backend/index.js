'use strict';
require('dotenv').config();

const express = require('express');
const cors    = require('cors');

// Routes
const authRouter        = require('./src/routes/auth');
const departmentsRouter = require('./src/routes/departments');
const positionsRouter   = require('./src/routes/positions');
const usersRouter       = require('./src/routes/users');
const templatesRouter   = require('./src/routes/templates');
const periodsRouter     = require('./src/routes/periods');
const evaluationsRouter = require('./src/routes/evaluations');
const dashboardRouter   = require('./src/routes/dashboard');
const auditRouter       = require('./src/routes/audit');
const reportsRouter     = require('./src/routes/reports');
const { runMonthlyAssigner } = require('./src/utils/autoAssigner');

const app = express();
app.use(cors());
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',        authRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/positions',   positionsRouter);
app.use('/api/users',       usersRouter);
app.use('/api/templates',   templatesRouter);
app.use('/api/periods',     periodsRouter);
app.use('/api/evaluations', evaluationsRouter);
app.use('/api/dashboard',   dashboardRouter);
app.use('/api/audit',       auditRouter);
app.use('/api/reports',     reportsRouter);

// Health check
app.get('/', (_req, res) => res.json({ ok: true, service: 'prismo-kpi', version: '1.0.0' }));

// ── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ── Error handler ───────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[SERVER] Error:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ── Start ───────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT) || 3010;
app.listen(PORT, () => {
  console.log(`[PRISMO] ✓ API server → http://localhost:${PORT}`);
  
  // Start the background worker for recurring evaluations
  setTimeout(runMonthlyAssigner, 5000); // 5 seconds after startup
  setInterval(runMonthlyAssigner, 12 * 60 * 60 * 1000); // Every 12 hours
});
