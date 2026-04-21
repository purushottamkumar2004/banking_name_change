// backend/src/agents/mockPipeline.js
// Mock pipeline for development/testing when Google Document AI and Gemini
// are not configured. Generates realistic synthetic data so you can test
// the full flow end-to-end without API keys.
//
// Activated when NODE_ENV=test or MOCK_PIPELINE=true in .env

/**
 * Returns a synthetic pipeline result that looks like a real one.
 * Randomises scores slightly for variety across test runs.
 */
function generateMockResult(requestId, customerData) {
  const { old_name, new_name } = customerData;

  // Simulate realistic extraction
  const nameParts     = old_name.trim().split(/\s+/);
  const brideName     = old_name;
  const groomSurname  = 'Sharma';  // mock
  const groomName     = `Rajesh ${groomSurname}`;

  const today    = new Date();
  const marriageDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);  // 3 months ago
  const issueDate    = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);  // 1 month ago

  const fmt = d => d.toISOString().split('T')[0];

  const extracted_fields = {
    bride_name:            brideName,
    groom_name:            groomName,
    marriage_date:         fmt(marriageDate),
    registration_number:   `MCD/${today.getFullYear()}/00${Math.floor(Math.random() * 9000 + 1000)}`,
    issuing_authority:     'Sub-Registrar, South Delhi Municipal Corporation',
    place_of_registration: 'South Delhi, Delhi',
    issue_date:            fmt(issueDate),
    married_name:          `${nameParts[0]} ${groomSurname}`,
    document_language:     'english',
    missing_fields:        [],
  };

  const ocr_confidence_map = {
    overall:              0.92 + (Math.random() * 0.06),
    minimum:              0.78 + (Math.random() * 0.1),
    low_confidence_ratio: 0.02 + (Math.random() * 0.05),
    total_tokens:         Math.floor(Math.random() * 200 + 100),
  };

  const nameMatchScore  = 0.85 + (Math.random() * 0.14);
  const dateScore       = 0.90 + (Math.random() * 0.09);
  const regScore        = 0.88 + (Math.random() * 0.10);
  const authScore       = 0.95 + (Math.random() * 0.04);
  const placeScore      = 0.80 + (Math.random() * 0.15);
  const crossScore      = 0.92 + (Math.random() * 0.07);

  const validation_results = {
    name_match:          { score: nameMatchScore,  reasons: [], detail: { old_vs_bride: nameMatchScore } },
    date_validity:       { score: dateScore,        reasons: [] },
    reg_number_validity: { score: regScore,         reasons: [] },
    authority_validity:  { score: authScore,        reasons: [] },
    place_consistency:   { score: placeScore,       reasons: [] },
    cross_field:         { score: crossScore,       reasons: [] },
    scores: {
      name_match:          nameMatchScore,
      date_validity:       dateScore,
      reg_number_validity: regScore,
      authority_validity:  authScore,
      place_consistency:   placeScore,
      cross_field:         crossScore,
    },
  };

  const fraud_results = {
    ocr_anomaly_score:     0.90 + (Math.random() * 0.08),
    metadata_risk_score:   0.95 + (Math.random() * 0.04),
    image_tampering_score: 0.88 + (Math.random() * 0.10),
    signals:               [],
    composite_integrity_score: 0.88,
  };

  // Weighted score calculation (mirrors confidenceScorerAgent)
  const weighted =
    nameMatchScore * 0.25 + dateScore * 0.25 + ((regScore + authScore + placeScore) / 3) * 0.15 +
    crossScore * 0.15 + fraud_results.image_tampering_score * 0.10 + fraud_results.metadata_risk_score * 0.10;

  const overallScore   = Math.round(weighted * 100);
  const fraudScore     = Math.round((1 - weighted) * 100);
  const confidenceLevel = overallScore >= 75 ? 'HIGH' : overallScore >= 50 ? 'MEDIUM' : 'LOW';
  const recommendation  = confidenceLevel === 'HIGH' && fraudScore < 30 ? 'APPROVE' : confidenceLevel === 'LOW' ? 'REJECT' : 'MANUAL_REVIEW';

  const score_card = {
    overall_score:    overallScore,
    fraud_score:      fraudScore,
    confidence_level: confidenceLevel,
    recommendation,
    decision:         'AI_VERIFIED_PENDING_HUMAN',
    components: {
      identity_consistency:  { score: Math.round(nameMatchScore * 100), weight: 0.25 },
      logical_consistency:   { score: Math.round(dateScore * 100),      weight: 0.25 },
      field_integrity:       { score: Math.round(((regScore + authScore + placeScore) / 3) * 100), weight: 0.15 },
      cross_field:           { score: Math.round(crossScore * 100),     weight: 0.15 },
      visual_integrity:      { score: Math.round(fraud_results.image_tampering_score * 100), weight: 0.10 },
      metadata_integrity:    { score: Math.round(fraud_results.metadata_risk_score * 100),   weight: 0.10 },
    },
    penalties_applied: [],
    total_penalty:     0,
    weights:           { identity_consistency: 0.25, logical_consistency: 0.25, field_integrity: 0.15, cross_field_validation: 0.15, visual_integrity: 0.10, metadata_integrity: 0.10 },
    computed_at:       new Date().toISOString(),
  };

  const summary = `Marriage certificate for ${old_name} verified successfully. Old name matches bride name on certificate (${Math.round(nameMatchScore * 100)}% match). Registration number ${extracted_fields.registration_number} is valid for ${today.getFullYear()}. No significant fraud signals detected — OCR confidence ${Math.round(ocr_confidence_map.overall * 100)}%, metadata clean. Overall confidence: ${overallScore}%. AI Recommendation: ${recommendation}.`;

  return {
    input_data: { request_id: requestId, ...customerData },
    extracted_fields,
    ocr_confidence_map,
    validation_results,
    fraud_results,
    score_card,
    summary,
    error: null,
  };
}

/**
 * Mock pipeline runner — drop-in replacement for runPipeline() in test mode.
 * Simulates a 2-3 second processing delay for realism.
 */
async function runMockPipeline(initialState) {
  const delay = 2000 + Math.random() * 1000;
  await new Promise(r => setTimeout(r, delay));
  return generateMockResult(initialState.input_data.request_id, initialState.input_data);
}

module.exports = { runMockPipeline, generateMockResult };
