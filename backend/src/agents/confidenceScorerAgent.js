// backend/src/agents/confidenceScorerAgent.js
// Agent 4: Confidence Scorer Agent
//
// Computes the final confidence score using a weighted combination of all
// validation and forgery signals. Applies penalty rules for critical failures.
// Outputs a structured ScoreCard used by the Checker UI.

const { logAgentExecution } = require('./auditLogger');

// Weights must sum to 1.0
const WEIGHTS = {
  identity_consistency:  0.25,  // old_name ↔ bride_name
  logical_consistency:   0.25,  // date ordering, validity
  field_integrity:       0.15,  // reg number, authority, place
  cross_field_validation: 0.15, // cross-field checks
  visual_integrity:      0.10,  // image tampering score
  metadata_integrity:    0.10,  // metadata risk score
};

// Penalty rules applied to fraud_score
const PENALTIES = {
  missing_critical_fields: 20,  // Added to fraud_score if critical fields absent
  name_mismatch:           30,  // Added to fraud_score if old_name ≠ bride_name (score < 0.3)
  impossible_dates:        15,  // Added if issue_date < marriage_date
  low_ocr_confidence:      10,  // Added if overall OCR confidence < 0.6
};

function getConfidenceLevel(score) {
  if (score >= 0.75) return 'HIGH';
  if (score >= 0.50) return 'MEDIUM';
  return 'LOW';
}

function getRecommendation(confidenceLevel, fraudScore) {
  if (confidenceLevel === 'HIGH' && fraudScore < 30)   return 'APPROVE';
  if (confidenceLevel === 'LOW'  || fraudScore >= 60)  return 'REJECT';
  return 'MANUAL_REVIEW';
}

async function confidenceScorerAgent(state) {
  const startTime = Date.now();
  const { request_id } = state.input_data;
  const vr   = state.validation_results?.scores || {};
  const fr   = state.fraud_results || {};
  const ef   = state.extracted_fields || {};

  // ── Weighted base score ──────────────────────────────────────────────────

  // Identity consistency = name_match score
  const identityScore    = vr.name_match          ?? 0;
  // Logical consistency = date validity
  const logicalScore     = vr.date_validity        ?? 0;
  // Field integrity = average of reg number + authority + place
  const fieldIntegrity   = ((vr.reg_number_validity ?? 0) + (vr.authority_validity ?? 0) + (vr.place_consistency ?? 0)) / 3;
  // Cross-field = cross_field score
  const crossField       = vr.cross_field          ?? 0;
  // Visual integrity = image_tampering_score (1 = clean)
  const visualIntegrity  = fr.image_tampering_score ?? 0.5;
  // Metadata integrity = metadata_risk_score
  const metaIntegrity    = fr.metadata_risk_score   ?? 0.5;

  const weightedScore =
    identityScore   * WEIGHTS.identity_consistency   +
    logicalScore    * WEIGHTS.logical_consistency    +
    fieldIntegrity  * WEIGHTS.field_integrity        +
    crossField      * WEIGHTS.cross_field_validation +
    visualIntegrity * WEIGHTS.visual_integrity       +
    metaIntegrity   * WEIGHTS.metadata_integrity;

  // ── Penalty accumulation ─────────────────────────────────────────────────

  let penaltyTotal = 0;
  const penaltiesApplied = [];

  // Missing critical fields
  const criticalFields = ['bride_name', 'marriage_date', 'registration_number', 'issuing_authority'];
  const missingCritical = criticalFields.filter(f => !ef[f]);
  if (missingCritical.length > 0) {
    penaltyTotal += PENALTIES.missing_critical_fields;
    penaltiesApplied.push({
      rule:     'missing_critical_fields',
      penalty:  PENALTIES.missing_critical_fields,
      detail:   `Missing: ${missingCritical.join(', ')}`,
    });
  }

  // Name mismatch
  if (identityScore < 0.3) {
    penaltyTotal += PENALTIES.name_mismatch;
    penaltiesApplied.push({
      rule:    'name_mismatch',
      penalty: PENALTIES.name_mismatch,
      detail:  `old_name/bride_name similarity too low (${(identityScore * 100).toFixed(1)}%)`,
    });
  }

  // Impossible dates (date_validity very low)
  if (logicalScore < 0.3) {
    penaltyTotal += PENALTIES.impossible_dates;
    penaltiesApplied.push({
      rule:    'impossible_dates',
      penalty: PENALTIES.impossible_dates,
      detail:  'Date logic validation failed severely',
    });
  }

  // Low OCR confidence
  if ((state.ocr_confidence_map?.overall ?? 1) < 0.6) {
    penaltyTotal += PENALTIES.low_ocr_confidence;
    penaltiesApplied.push({
      rule:    'low_ocr_confidence',
      penalty: PENALTIES.low_ocr_confidence,
      detail:  `OCR confidence: ${((state.ocr_confidence_map?.overall ?? 0) * 100).toFixed(1)}%`,
    });
  }

  // ── Final scores ─────────────────────────────────────────────────────────

  const overallScore      = Math.round(weightedScore * 100);  // 0-100
  const baseFraudScore    = Math.round((1 - weightedScore) * 100);
  const fraudScore        = Math.min(100, baseFraudScore + penaltyTotal);
  const confidenceLevel   = getConfidenceLevel(weightedScore);
  const recommendation    = getRecommendation(confidenceLevel, fraudScore);

  const score_card = {
    // Summary
    overall_score:     overallScore,
    fraud_score:       fraudScore,
    confidence_level:  confidenceLevel,
    recommendation,
    decision:          'AI_VERIFIED_PENDING_HUMAN',  // ALWAYS — AI never acts alone

    // Component breakdown
    components: {
      identity_consistency:  { score: Math.round(identityScore  * 100), weight: WEIGHTS.identity_consistency  },
      logical_consistency:   { score: Math.round(logicalScore   * 100), weight: WEIGHTS.logical_consistency   },
      field_integrity:       { score: Math.round(fieldIntegrity * 100), weight: WEIGHTS.field_integrity       },
      cross_field:           { score: Math.round(crossField     * 100), weight: WEIGHTS.cross_field_validation },
      visual_integrity:      { score: Math.round(visualIntegrity* 100), weight: WEIGHTS.visual_integrity      },
      metadata_integrity:    { score: Math.round(metaIntegrity  * 100), weight: WEIGHTS.metadata_integrity    },
    },

    // Penalties
    penalties_applied: penaltiesApplied,
    total_penalty:     penaltyTotal,

    // Weights reference
    weights: WEIGHTS,

    computed_at: new Date().toISOString(),
  };

  await logAgentExecution({
    request_id,
    agent_name:  'ConfidenceScorerAgent',
    input_data:  { validation_scores: vr, fraud_scores: { image: fr.image_tampering_score, meta: fr.metadata_risk_score } },
    output_data: { overall_score: overallScore, fraud_score: fraudScore, confidence_level: confidenceLevel },
    duration_ms: Date.now() - startTime,
    status:      'SUCCESS',
  });

  return { score_card };
}

module.exports = { confidenceScorerAgent };
