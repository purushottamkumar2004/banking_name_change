// backend/src/routes/requests.js
// All REST API routes. Includes Zod validation, UUID checks, Chroma similar-case lookup.

const express    = require('express');
const multer     = require('multer');
const { v4: uuidv4 } = require('uuid');
const pool       = require('../db/pool');
const { uploadDocument, uploadExtractedJSON, getPresignedUrl } = require('../storage/s3');
const { runPipeline }    = require('../agents/pipeline');
const { createInitialState } = require('../agents/state');
const { mockCoreBankingUpdate } = require('./coreBanking');
const { validateFormFields, validateBody, validateQuery, schemas } = require('../middleware/validate');
const { validateUUID } = require('../middleware/security');
const { storeCase, findSimilarCases, summariseSimilarCases } = require('../db/chroma');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Only PDF, JPEG, PNG accepted'));
  },
});

// ── POST /api/requests ────────────────────────────────────────────────────────

router.post('/', upload.single('document'), validateFormFields(schemas.submitRequest), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Document file is required' });

  const { customer_id, old_name, new_name } = req.validatedBody;
  const requestId = uuidv4();

  await pool.execute(
    `INSERT INTO verification_requests (id, customer_id, old_name, new_name, status) VALUES (?, ?, ?, ?, 'PROCESSING')`,
    [requestId, customer_id, old_name, new_name]
  );

  let s3Key;
  try {
    s3Key = await uploadDocument(requestId, req.file.buffer, req.file.originalname, req.file.mimetype);
    await pool.execute('UPDATE verification_requests SET document_url = ? WHERE id = ?', [s3Key, requestId]);
  } catch (err) { console.error('[S3] Upload failed:', err.message); }

  res.status(202).json({ request_id: requestId, status: 'PROCESSING', message: 'Request accepted.' });

  runPipelineAsync(requestId, { customer_id, old_name, new_name }, req.file.buffer, s3Key, req.file.mimetype);
});

async function runPipelineAsync(requestId, customerData, buffer, s3Key, mimeType) {
  try {
    const finalState = await runPipeline(createInitialState(requestId, customerData, buffer, s3Key, mimeType));
    const sc = finalState.score_card || {};
    const vr = finalState.validation_results || {};
    const fr = finalState.fraud_results || {};
    const ef = finalState.extracted_fields || {};

    let jsonKey;
    try { jsonKey = await uploadExtractedJSON(requestId, { extracted_fields: ef, validation_results: vr, fraud_results: fr, score_card: sc }); } catch {}

    await pool.execute(
      `UPDATE verification_requests SET status='AI_VERIFIED_PENDING_HUMAN', overall_score=?, fraud_score=?,
       confidence_level=?, ai_summary=?, recommendation=?, extracted_json_url=?, score_card_json=?, updated_at=NOW() WHERE id=?`,
      [sc.overall_score ?? null, sc.fraud_score ?? null, sc.confidence_level ?? null,
       finalState.summary ?? null, sc.recommendation ?? null, jsonKey ?? null,
       JSON.stringify(sc), requestId]
    );

    const sm = vr.scores || {};
    const fields = [
      { field: 'bride_name',            value: ef.bride_name,            score: sm.name_match,          reasons: vr.name_match?.reasons },
      { field: 'groom_name',            value: ef.groom_name,            score: null,                   reasons: [] },
      { field: 'marriage_date',         value: ef.marriage_date,         score: sm.date_validity,       reasons: vr.date_validity?.reasons },
      { field: 'registration_number',   value: ef.registration_number,   score: sm.reg_number_validity, reasons: vr.reg_number_validity?.reasons },
      { field: 'issuing_authority',     value: ef.issuing_authority,     score: sm.authority_validity,  reasons: vr.authority_validity?.reasons },
      { field: 'place_of_registration', value: ef.place_of_registration, score: sm.place_consistency,   reasons: vr.place_consistency?.reasons },
    ];

    for (const e of fields) {
      const status = e.score == null ? 'WARN' : e.score >= 0.7 ? 'PASS' : e.score >= 0.4 ? 'WARN' : 'FAIL';
      await pool.execute(
        `INSERT INTO field_scores (request_id, field_name, extracted_value, score, status, reason) VALUES (?,?,?,?,?,?)`,
        [requestId, e.field, e.value || null, e.score != null ? Math.round(e.score * 100) : null, status, (e.reasons || []).join('; ') || null]
      );
    }

    for (const sig of (fr.signals || [])) {
      const severity = sig.score < 0.4 ? 'HIGH' : sig.score < 0.7 ? 'MEDIUM' : 'LOW';
      await pool.execute(
        `INSERT INTO fraud_signals (request_id, signal_type, score, severity, deatails) VALUES (?,?,?,?,?)`,
        [requestId, sig.type, sig.score != null ? Math.round(sig.score * 100) : null, severity, sig.detail]
      );
    }

    console.log(`[Pipeline] Done: ${requestId} | Score: ${sc.overall_score} | ${sc.confidence_level}`);
  } catch (err) {
    console.error(`[Pipeline] Failed ${requestId}:`, err.message);
    await pool.execute(`UPDATE verification_requests SET status='FAILED', updated_at=NOW() WHERE id=?`, [requestId]).catch(() => {});
  }
}

// ── GET /api/requests ─────────────────────────────────────────────────────────

router.get('/', validateQuery(schemas.listQuery), async (req, res) => {
  const { page, limit, status } = req.query;
  const limitInt  = parseInt(limit, 10);
  const offsetInt = parseInt((page - 1) * limit, 10);
  const where  = status ? 'WHERE status = ?' : '';

  // Use pool.query() (not pool.execute()) for LIMIT/OFFSET — mysql2 v3.x
  // prepared statements (execute) reject numeric LIMIT/OFFSET bindings.
  const [rows] = await pool.query(
    `SELECT id, customer_id, old_name, new_name, status, overall_score, fraud_score,
            confidence_level, recommendation, created_at, updated_at
     FROM verification_requests ${where} ORDER BY created_at DESC LIMIT ${limitInt} OFFSET ${offsetInt}`,
    status ? [status] : []
  );
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) as total FROM verification_requests ${where}`,
    status ? [status] : []
  );

  res.json({ requests: rows, total, page, limit });
});

// ── GET /api/requests/:id ─────────────────────────────────────────────────────

router.get('/:id', validateUUID('id'), async (req, res) => {
  const { id } = req.params;
  const [[request]] = await pool.execute('SELECT * FROM verification_requests WHERE id = ?', [id]);
  if (!request) return res.status(404).json({ error: 'Request not found' });

  const [fieldScores]  = await pool.execute('SELECT * FROM field_scores  WHERE request_id=? ORDER BY id', [id]);
  const [fraudSignals] = await pool.execute('SELECT * FROM fraud_signals WHERE request_id=? ORDER BY severity DESC', [id]);
  const [auditLogs]    = await pool.execute(
    'SELECT agent_name, status, duration_ms, timestamp, error_message FROM audit_logs WHERE request_id=? ORDER BY timestamp', [id]
  );

  // Chroma similar cases (non-blocking, fails gracefully)
  let similarCases = [], similarCasesSummary = null;
  try {
    similarCases = await findSimilarCases({ request_id: id, confidence_level: request.confidence_level, overall_score: request.overall_score, fraud_score: request.fraud_score, recommendation: request.recommendation }, 5);
    similarCasesSummary = summariseSimilarCases(similarCases);
  } catch {}

  res.json({ request, field_scores: fieldScores, fraud_signals: fraudSignals, audit_logs: auditLogs, similar_cases: similarCases, similar_cases_summary: similarCasesSummary });
});

// ── GET /api/requests/:id/document ───────────────────────────────────────────

router.get('/:id/document', validateUUID('id'), async (req, res) => {
  const [[req_]] = await pool.execute('SELECT document_url FROM verification_requests WHERE id=?', [req.params.id]);
  if (!req_?.document_url) return res.status(404).json({ error: 'Document not found' });
  res.json({ url: await getPresignedUrl(req_.document_url) });
});

// ── POST /api/requests/:id/approve ───────────────────────────────────────────

router.post('/:id/approve', validateUUID('id'), validateBody(schemas.approve), async (req, res) => {
  const { id } = req.params;
  const { checker_id, notes } = req.body;

  const [[request]] = await pool.execute('SELECT * FROM verification_requests WHERE id=?', [id]);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status !== 'AI_VERIFIED_PENDING_HUMAN') {
    return res.status(409).json({ error: `Cannot approve: status is "${request.status}"` });
  }

  await pool.execute(
    `UPDATE verification_requests SET status='APPROVED', action_by=?, action_at=NOW(), updated_at=NOW() WHERE id=?`,
    [checker_id, id]
  );
  await pool.execute(
    `INSERT INTO audit_logs (request_id, agent_name, input_data, output_data, status) VALUES (?, 'HumanChecker', ?, ?, 'SUCCESS')`,
    [id, JSON.stringify({ action: 'APPROVE', checker_id, notes: notes || null }), JSON.stringify({ new_status: 'APPROVED' })]
  );

  // Store in Chroma for future similarity lookup
  const [fs] = await pool.execute('SELECT * FROM field_scores  WHERE request_id=?', [id]);
  const [ss] = await pool.execute('SELECT * FROM fraud_signals WHERE request_id=?', [id]);
  storeCase(id, { confidence_level: request.confidence_level, recommendation: request.recommendation, overall_score: request.overall_score, fraud_score: request.fraud_score, field_scores: fs, fraud_signals: ss }, 'APPROVED').catch(() => {});

  // HITL gate: only call core banking after human approval
  const bankingResult = await mockCoreBankingUpdate({ customer_id: request.customer_id, old_name: request.old_name, new_name: request.new_name, request_id: id, approved_by: checker_id });

  res.json({ success: true, status: 'APPROVED', banking_result: bankingResult, message: `Approved by ${checker_id}. Core banking updated.` });
});

// ── POST /api/requests/:id/reject ─────────────────────────────────────────────

router.post('/:id/reject', validateUUID('id'), validateBody(schemas.reject), async (req, res) => {
  const { id } = req.params;
  const { checker_id, reason } = req.body;

  const [[request]] = await pool.execute('SELECT * FROM verification_requests WHERE id=?', [id]);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (!['AI_VERIFIED_PENDING_HUMAN', 'PROCESSING'].includes(request.status)) {
    return res.status(409).json({ error: `Cannot reject: status is "${request.status}"` });
  }

  await pool.execute(
    `UPDATE verification_requests SET status='REJECTED', action_by=?, action_at=NOW(), rejection_reason=?, updated_at=NOW() WHERE id=?`,
    [checker_id, reason, id]
  );
  await pool.execute(
    `INSERT INTO audit_logs (request_id, agent_name, input_data, output_data, status) VALUES (?, 'HumanChecker', ?, ?, 'SUCCESS')`,
    [id, JSON.stringify({ action: 'REJECT', checker_id, reason }), JSON.stringify({ new_status: 'REJECTED' })]
  );

  const [fs] = await pool.execute('SELECT * FROM field_scores  WHERE request_id=?', [id]);
  const [ss] = await pool.execute('SELECT * FROM fraud_signals WHERE request_id=?', [id]);
  storeCase(id, { confidence_level: request.confidence_level, recommendation: request.recommendation, overall_score: request.overall_score, fraud_score: request.fraud_score, field_scores: fs, fraud_signals: ss }, 'REJECTED').catch(() => {});

  res.json({ success: true, status: 'REJECTED', message: 'Request rejected.' });
});


// ── GET /api/requests/:id/scorecard ──────────────────────────────────────────
// Returns the full score_card JSON including component breakdown.
// Used by the frontend ScoreCard component for the detailed score visualizer.

router.get('/:id/scorecard', validateUUID('id'), async (req, res) => {
  const { id } = req.params;
  const [[row]] = await pool.execute(
    'SELECT score_card_json, overall_score, fraud_score, confidence_level, recommendation FROM verification_requests WHERE id = ?',
    [id]
  );
  if (!row) return res.status(404).json({ error: 'Request not found' });

  // If full JSON is stored, return it; otherwise build from flat columns
  if (row.score_card_json) {
    const sc = typeof row.score_card_json === 'string'
      ? JSON.parse(row.score_card_json)
      : row.score_card_json;
    return res.json({ score_card: sc });
  }

  // Fallback: return flat data without component breakdown
  res.json({
    score_card: {
      overall_score:    row.overall_score,
      fraud_score:      row.fraud_score,
      confidence_level: row.confidence_level,
      recommendation:   row.recommendation,
      decision:         'AI_VERIFIED_PENDING_HUMAN',
      components:       null,
    },
  });
});

module.exports = router;
