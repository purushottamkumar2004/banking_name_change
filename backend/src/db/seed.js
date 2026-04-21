// backend/src/db/seed.js
// Populates the database with realistic test data for development.
// Run: node src/db/seed.js
//
// Creates 10 verification requests in various states so you can test
// the full Checker UI without submitting real documents.

require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const pool = require('./pool');
const { generateMockResult } = require('../agents/mockPipeline');

const TEST_CASES = [
  { customer_id: 'CIF001234', old_name: 'Priya Mehta',       new_name: 'Priya Sharma',     status: 'AI_VERIFIED_PENDING_HUMAN' },
  { customer_id: 'CIF002345', old_name: 'Anjali Verma',      new_name: 'Anjali Gupta',     status: 'APPROVED',  checker_id: 'CHK001' },
  { customer_id: 'CIF003456', old_name: 'Sunita Patel',      new_name: 'Sunita Joshi',     status: 'REJECTED',  checker_id: 'CHK002', reason: 'Name mismatch on certificate' },
  { customer_id: 'CIF004567', old_name: 'Kavya Nair',        new_name: 'Kavya Krishnan',   status: 'AI_VERIFIED_PENDING_HUMAN' },
  { customer_id: 'CIF005678', old_name: 'Reena Das',         new_name: 'Reena Roy',        status: 'AI_VERIFIED_PENDING_HUMAN' },
  { customer_id: 'CIF006789', old_name: 'Pooja Singh',       new_name: 'Pooja Kumar',      status: 'APPROVED',  checker_id: 'CHK001' },
  { customer_id: 'CIF007890', old_name: 'Meena Iyer',        new_name: 'Meena Subramaniam',status: 'PROCESSING' },
  { customer_id: 'CIF008901', old_name: 'Lakshmi Reddy',     new_name: 'Lakshmi Rao',      status: 'AI_VERIFIED_PENDING_HUMAN' },
  { customer_id: 'CIF009012', old_name: 'Divya Pillai',      new_name: 'Divya Menon',      status: 'REJECTED',  checker_id: 'CHK003', reason: 'Low OCR confidence — document unclear' },
  { customer_id: 'CIF010123', old_name: 'Neha Agarwal',      new_name: 'Neha Bansal',      status: 'APPROVED',  checker_id: 'CHK001' },
];

// Matching customer bank records for each test case
const CUSTOMERS = [
  { customer_id: 'CIF001234', full_name: 'Priya Mehta',        account_no: 'ACC001234', branch: 'Mumbai Main' },
  { customer_id: 'CIF002345', full_name: 'Anjali Verma',       account_no: 'ACC002345', branch: 'Delhi Central' },
  { customer_id: 'CIF003456', full_name: 'Sunita Patel',       account_no: 'ACC003456', branch: 'Ahmedabad East' },
  { customer_id: 'CIF004567', full_name: 'Kavya Nair',         account_no: 'ACC004567', branch: 'Kochi Branch' },
  { customer_id: 'CIF005678', full_name: 'Reena Das',          account_no: 'ACC005678', branch: 'Kolkata North' },
  { customer_id: 'CIF006789', full_name: 'Pooja Singh',        account_no: 'ACC006789', branch: 'Lucknow Main' },
  { customer_id: 'CIF007890', full_name: 'Meena Iyer',         account_no: 'ACC007890', branch: 'Chennai Central' },
  { customer_id: 'CIF008901', full_name: 'Lakshmi Reddy',      account_no: 'ACC008901', branch: 'Hyderabad West' },
  { customer_id: 'CIF009012', full_name: 'Divya Pillai',       account_no: 'ACC009012', branch: 'Trivandrum Main' },
  { customer_id: 'CIF010123', full_name: 'Sarita Devi',       account_no: 'ACC099001', branch: 'Pune Central' },
  { customer_id: 'CIF011234', full_name: 'Rohit Kumar',        account_no: 'ACC011234', branch: 'Karnal Branch' },
];

async function seed() {
  console.log('Seeding test data...\n');

  // Seed customers first (bank records)
  for (const c of CUSTOMERS) {
    await pool.query(
      `INSERT INTO customers (customer_id, full_name, account_no, branch)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE full_name=VALUES(full_name)`,
      [c.customer_id, c.full_name, c.account_no, c.branch]
    );
  }
  console.log(`  ✓ Seeded ${CUSTOMERS.length} customer bank records\n`);

  for (const tc of TEST_CASES) {
    const requestId = uuidv4();
    const mock = generateMockResult(requestId, tc);
    const sc = mock.score_card;
    const vr = mock.validation_results;
    const fr = mock.fraud_results;
    const ef = mock.extracted_fields;

    // Adjust score to match status for realism
    let overallScore = sc.overall_score;
    let confidenceLevel = sc.confidence_level;
    if (tc.status === 'REJECTED') { overallScore = Math.floor(Math.random() * 30 + 20); confidenceLevel = 'LOW'; }
    if (tc.status === 'APPROVED') { overallScore = Math.floor(Math.random() * 20 + 78); confidenceLevel = 'HIGH'; }

    const fraudScore = Math.round((1 - overallScore / 100) * 100);

    // Insert request
    const now = new Date();
    const createdAt = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);

    await pool.execute(
      `INSERT INTO verification_requests
         (id, customer_id, old_name, new_name, status, overall_score, fraud_score,
          confidence_level, ai_summary, recommendation, action_by, action_at, rejection_reason,
          score_card_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        requestId, tc.customer_id, tc.old_name, tc.new_name, tc.status,
        overallScore, fraudScore, confidenceLevel, mock.summary,
        sc.recommendation,
        tc.checker_id || null,
        tc.checker_id ? new Date(createdAt.getTime() + 3600000) : null,
        tc.reason || null,
        JSON.stringify({
          overall_score: overallScore, fraud_score: fraudScore,
          confidence_level: confidenceLevel, recommendation: sc.recommendation,
          decision: 'AI_VERIFIED_PENDING_HUMAN',
          components: sc.components, penalties_applied: sc.penalties_applied || [],
          weights: sc.weights,
        }),
        createdAt, new Date(createdAt.getTime() + 5000),
      ]
    );

    // Insert field scores
    const fields = [
      { field: 'bride_name',            value: ef.bride_name,            score: vr.scores.name_match },
      { field: 'groom_name',            value: ef.groom_name,            score: null },
      { field: 'marriage_date',         value: ef.marriage_date,         score: vr.scores.date_validity },
      { field: 'registration_number',   value: ef.registration_number,   score: vr.scores.reg_number_validity },
      { field: 'issuing_authority',     value: ef.issuing_authority,     score: vr.scores.authority_validity },
      { field: 'place_of_registration', value: ef.place_of_registration, score: vr.scores.place_consistency },
    ];

    for (const f of fields) {
      const status = f.score == null ? 'WARN' : f.score >= 0.7 ? 'PASS' : f.score >= 0.4 ? 'WARN' : 'FAIL';
      await pool.execute(
        `INSERT INTO field_scores (request_id, field_name, extracted_value, score, status) VALUES (?,?,?,?,?)`,
        [requestId, f.field, f.value || null, f.score != null ? Math.round(f.score * 100) : null, status]
      );
    }

    // Insert audit logs for completed cases
    if (tc.status !== 'PROCESSING') {
      const agents = ['IntakeValidationAgent','DocumentProcessorAgent','FieldValidationAgent','ForgeryDetectionAgent','ConfidenceScorerAgent','SummaryAgent'];
      for (const agent of agents) {
        await pool.execute(
          `INSERT INTO audit_logs (request_id, agent_name, status, duration_ms, timestamp) VALUES (?,?,'SUCCESS',?,?)`,
          [requestId, agent, Math.floor(Math.random() * 2000 + 300), createdAt]
        );
      }
    }

    console.log(`  ✓ ${tc.customer_id} | ${tc.old_name} → ${tc.new_name} | ${tc.status} | Score: ${overallScore}`);
  }

  console.log('\nSeed complete. Open http://localhost:5173/checker to browse.');
  await pool.end();
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
