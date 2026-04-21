// backend/src/server.js
require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors    = require('cors');
const pool    = require('./db/pool');
const { rateLimit, securityHeaders } = require('./middleware/security');
const requestsRouter = require('./routes/requests');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(securityHeaders);
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173', methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api/requests', rateLimit({ windowMs: 60_000, max: 60 }));
app.use((req, _res, next) => { console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`); next(); });

app.use('/api/requests', requestsRouter);

app.get('/health', async (_req, res) => {
  let dbOk = false;
  try { await pool.execute('SELECT 1'); dbOk = true; } catch {}
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded', db: dbOk ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(), uptime_s: Math.floor(process.uptime()),
  });
});

app.get('/metrics', async (_req, res) => {
  try {
    const [[stats]] = await pool.execute(`
      SELECT COUNT(*) as total,
        SUM(status='PROCESSING') as processing,
        SUM(status='AI_VERIFIED_PENDING_HUMAN') as pending_review,
        SUM(status='APPROVED') as approved,
        SUM(status='REJECTED') as rejected,
        SUM(status='FAILED') as failed,
        ROUND(AVG(overall_score),1) as avg_score,
        ROUND(AVG(fraud_score),1) as avg_fraud_score
      FROM verification_requests`);
    const [[today]] = await pool.execute(
      `SELECT COUNT(*) as count FROM verification_requests WHERE DATE(created_at) = CURDATE()`
    );
    res.json({ ...stats, today: today.count, generated_at: new Date().toISOString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use((err, req, res, _next) => {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large. Max 20 MB.' });
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n[Server] http://localhost:${PORT}`);
  console.log(`[Server] Env: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[Server] LangSmith: ${process.env.LANGCHAIN_TRACING_V2 === 'true' ? 'ON' : 'OFF'}\n`);
});

module.exports = app;
