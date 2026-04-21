// backend/tests/integration.test.js
// End-to-end integration test for the full verification pipeline.
// Uses mock pipeline and an in-memory SQLite-like approach — no real DB needed.
//
// Run: MOCK_PIPELINE=true node tests/integration.test.js

require('dotenv').config();
process.env.MOCK_PIPELINE = 'true';

const assert = require('assert');
const { generateMockResult } = require('../src/agents/mockPipeline');
const { createInitialState } = require('../src/agents/state');

// ── Colour helpers ────────────────────────────────────────────────────────────
const GREEN  = s => `\x1b[32m${s}\x1b[0m`;
const RED    = s => `\x1b[31m${s}\x1b[0m`;
const YELLOW = s => `\x1b[33m${s}\x1b[0m`;
const BOLD   = s => `\x1b[1m${s}\x1b[0m`;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(GREEN(`  ✓ ${name}`));
    passed++;
  } catch (err) {
    console.log(RED(`  ✗ ${name}`));
    console.log(RED(`    ${err.message}`));
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(GREEN(`  ✓ ${name}`));
    passed++;
  } catch (err) {
    console.log(RED(`  ✗ ${name}`));
    console.log(RED(`    ${err.message}`));
    failed++;
  }
}

// ── Test suites ───────────────────────────────────────────────────────────────

console.log(BOLD('\n── State Object Tests ──────────────────────────────────────\n'));

test('createInitialState returns correct structure', () => {
  const state = createInitialState('req-001', { customer_id: 'CIF001', old_name: 'Priya Mehta', new_name: 'Priya Sharma' }, Buffer.from('test'), 'docs/test.pdf', 'application/pdf');
  assert.strictEqual(state.input_data.request_id, 'req-001');
  assert.strictEqual(state.input_data.old_name, 'Priya Mehta');
  assert.ok(Buffer.isBuffer(state.document.buffer));
  assert.strictEqual(state.extracted_fields, null);
  assert.strictEqual(state.score_card, null);
});

test('createInitialState handles Unicode names', () => {
  const state = createInitialState('req-002', { customer_id: 'CIF002', old_name: 'प्रिया मेहता', new_name: 'प्रिया शर्मा' }, Buffer.alloc(0), null, 'application/pdf');
  assert.strictEqual(state.input_data.old_name, 'प्रिया मेहता');
});

console.log(BOLD('\n── Mock Pipeline Tests ─────────────────────────────────────\n'));

test('generateMockResult returns all required fields', () => {
  const result = generateMockResult('req-003', { customer_id: 'CIF003', old_name: 'Anjali Verma', new_name: 'Anjali Gupta' });
  assert.ok(result.extracted_fields, 'extracted_fields missing');
  assert.ok(result.validation_results, 'validation_results missing');
  assert.ok(result.fraud_results, 'fraud_results missing');
  assert.ok(result.score_card, 'score_card missing');
  assert.ok(result.summary, 'summary missing');
  assert.ok(typeof result.summary === 'string', 'summary should be string');
});

test('score_card has correct structure', () => {
  const { score_card } = generateMockResult('req-004', { customer_id: 'CIF004', old_name: 'Sunita Patel', new_name: 'Sunita Joshi' });
  assert.ok(typeof score_card.overall_score === 'number', 'overall_score should be number');
  assert.ok(score_card.overall_score >= 0 && score_card.overall_score <= 100, 'overall_score out of range');
  assert.ok(score_card.fraud_score >= 0 && score_card.fraud_score <= 100, 'fraud_score out of range');
  assert.ok(['HIGH','MEDIUM','LOW'].includes(score_card.confidence_level), 'invalid confidence_level');
  assert.ok(['APPROVE','REJECT','MANUAL_REVIEW'].includes(score_card.recommendation), 'invalid recommendation');
  assert.strictEqual(score_card.decision, 'AI_VERIFIED_PENDING_HUMAN', 'AI must never self-approve');
});

test('HITL enforcement — decision is always AI_VERIFIED_PENDING_HUMAN', () => {
  // Run 5 times to verify it never changes
  for (let i = 0; i < 5; i++) {
    const { score_card } = generateMockResult(`req-00${i}`, { customer_id: `CIF00${i}`, old_name: 'Test Name', new_name: 'Test New' });
    assert.strictEqual(score_card.decision, 'AI_VERIFIED_PENDING_HUMAN',
      `Run ${i}: AI set decision to ${score_card.decision} — HITL violated!`);
  }
});

test('score weights sum to 1.0', () => {
  const { score_card } = generateMockResult('req-010', { customer_id: 'CIF010', old_name: 'Kavya Nair', new_name: 'Kavya Krishnan' });
  const weightSum = Object.values(score_card.weights).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(weightSum - 1.0) < 0.001, `Weights sum to ${weightSum}, not 1.0`);
});

test('extracted_fields contains all required fields', () => {
  const { extracted_fields: ef } = generateMockResult('req-011', { customer_id: 'CIF011', old_name: 'Reena Das', new_name: 'Reena Roy' });
  const required = ['bride_name', 'groom_name', 'marriage_date', 'registration_number', 'issuing_authority', 'place_of_registration'];
  for (const field of required) {
    assert.ok(ef[field] != null, `Missing required field: ${field}`);
  }
});

test('dates are valid ISO format', () => {
  const { extracted_fields: ef } = generateMockResult('req-012', { customer_id: 'CIF012', old_name: 'Meena Iyer', new_name: 'Meena Sub' });
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  assert.ok(dateRegex.test(ef.marriage_date), `marriage_date format invalid: ${ef.marriage_date}`);
  assert.ok(dateRegex.test(ef.issue_date),    `issue_date format invalid: ${ef.issue_date}`);
});

test('marriage_date is before issue_date', () => {
  const { extracted_fields: ef } = generateMockResult('req-013', { customer_id: 'CIF013', old_name: 'Lakshmi Reddy', new_name: 'Lakshmi Rao' });
  assert.ok(new Date(ef.marriage_date) <= new Date(ef.issue_date),
    `marriage_date (${ef.marriage_date}) is after issue_date (${ef.issue_date})`);
});

test('registration_number contains year', () => {
  const { extracted_fields: ef } = generateMockResult('req-014', { customer_id: 'CIF014', old_name: 'Pooja Singh', new_name: 'Pooja Kumar' });
  assert.ok(/\d{4}/.test(ef.registration_number), `registration_number has no year: ${ef.registration_number}`);
});

console.log(BOLD('\n── Validation Logic Tests ──────────────────────────────────\n'));

const { intakeValidationAgent } = require('../src/agents/intakeValidationAgent');

asyncTest('intake validation passes with valid data', async () => {
  const state = createInitialState('req-020', { customer_id: 'CIF020', old_name: 'Valid Name', new_name: 'New Valid Name' }, Buffer.alloc(0), null, 'application/pdf');
  await intakeValidationAgent(state);  // should not throw
});

asyncTest('intake validation rejects empty customer_id', async () => {
  const state = createInitialState('req-021', { customer_id: '', old_name: 'Valid Name', new_name: 'New Name' }, Buffer.alloc(0), null, 'application/pdf');
  let threw = false;
  try { await intakeValidationAgent(state); } catch { threw = true; }
  assert.ok(threw, 'Should have thrown for empty customer_id');
});

asyncTest('intake validation rejects identical names', async () => {
  const state = createInitialState('req-022', { customer_id: 'CIF022', old_name: 'Same Name', new_name: 'Same Name' }, Buffer.alloc(0), null, 'application/pdf');
  let threw = false;
  try { await intakeValidationAgent(state); } catch { threw = true; }
  assert.ok(threw, 'Should have thrown for identical names');
});

asyncTest('intake validation accepts Unicode names', async () => {
  const state = createInitialState('req-023', { customer_id: 'CIF023', old_name: 'प्रिया मेहता', new_name: 'प्रिया शर्मा' }, Buffer.alloc(0), null, 'application/pdf');
  await intakeValidationAgent(state);  // should not throw
});

console.log(BOLD('\n── Confidence Scorer Tests ─────────────────────────────────\n'));

asyncTest('confidence scorer computes correct weighted score', async () => {
  const { confidenceScorerAgent } = require('../src/agents/confidenceScorerAgent');

  const state = {
    input_data: { request_id: 'req-030' },
    validation_results: {
      scores: { name_match: 0.9, date_validity: 0.95, reg_number_validity: 0.88, authority_validity: 0.95, place_consistency: 0.85, cross_field: 0.92 },
    },
    fraud_results: { image_tampering_score: 0.90, metadata_risk_score: 0.95, signals: [] },
    extracted_fields: { bride_name: 'Test', marriage_date: '2024-01-01', registration_number: 'MCD/2024/001', issuing_authority: 'Registrar', place_of_registration: 'Delhi' },
    ocr_confidence_map: { overall: 0.90 },
  };

  const result = await confidenceScorerAgent(state);
  assert.ok(result.score_card.overall_score >= 80, `Score too low: ${result.score_card.overall_score}`);
  assert.strictEqual(result.score_card.confidence_level, 'HIGH');
  assert.strictEqual(result.score_card.decision, 'AI_VERIFIED_PENDING_HUMAN');
});

asyncTest('penalty applied when name mismatch', async () => {
  const { confidenceScorerAgent } = require('../src/agents/confidenceScorerAgent');

  const state = {
    input_data: { request_id: 'req-031' },
    validation_results: {
      scores: { name_match: 0.1, date_validity: 0.9, reg_number_validity: 0.85, authority_validity: 0.9, place_consistency: 0.8, cross_field: 0.9 },
    },
    fraud_results: { image_tampering_score: 0.9, metadata_risk_score: 0.9, signals: [] },
    extracted_fields: { bride_name: 'Different Name', marriage_date: '2024-01-01', registration_number: 'MCD/2024/001', issuing_authority: 'Registrar', place_of_registration: 'Delhi' },
    ocr_confidence_map: { overall: 0.85 },
  };

  const result = await confidenceScorerAgent(state);
  const penalties = result.score_card.penalties_applied;
  assert.ok(penalties.some(p => p.rule === 'name_mismatch'), 'name_mismatch penalty not applied');
  assert.ok(result.score_card.fraud_score > 40, `Fraud score too low after name mismatch: ${result.score_card.fraud_score}`);
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(60));
console.log(`\n  ${GREEN(`${passed} passed`)}  ${failed > 0 ? RED(`${failed} failed`) : ''}  ${YELLOW(`${passed + failed} total`)}\n`);

if (failed > 0) process.exit(1);
