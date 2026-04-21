// backend/src/agents/fieldValidationAgent.js
// Agent 3a: Field Validation Agent (runs in PARALLEL with forgery detection)
//
// UNIVERSAL VALIDATION LOGIC — no document template dependency.
// Works on any Indian marriage certificate regardless of state or format.
//
// Checks:
// A. Identity Consistency — old_name ↔ bride_name
// B. Logical Consistency — date ordering, age constraints
// C. Registration Number — structure and year
// D. Authority Validation — must contain valid designation
// E. Place Consistency — place aligns with authority
// F. Cross-field Consistency — names consistent, date formats uniform

const { logAgentExecution } = require('./auditLogger');

// ── A. Identity Consistency ──────────────────────────────────────────────────

/**
 * Fuzzy name matching: normalise and check overlap.
 * Returns a score 0-1. Accounts for partial name matches (e.g. "Priya Sharma" vs "Priya R. Sharma").
 */
function nameSimilarity(a, b) {
  if (!a || !b) return 0;

  const normalize = (s) => s
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')   // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();

  const na = normalize(a);
  const nb = normalize(b);

  if (na === nb) return 1.0;

  // Token-level overlap
  const tokensA = new Set(na.split(' '));
  const tokensB = new Set(nb.split(' '));
  const intersection = [...tokensA].filter(t => tokensB.has(t)).length;
  const union        = new Set([...tokensA, ...tokensB]).size;

  return union > 0 ? intersection / union : 0;
}

function checkIdentityConsistency(state) {
  const { old_name, new_name } = state.input_data;
  const { bride_name, married_name } = state.extracted_fields;

  const oldVsBride  = nameSimilarity(old_name, bride_name);
  const newVsMarried = married_name ? nameSimilarity(new_name, married_name) : null;

  let score  = 0;
  const reasons = [];

  if (oldVsBride >= 0.8) {
    score += 1.0;
  } else if (oldVsBride >= 0.5) {
    score += 0.5;
    reasons.push(`Partial old_name match with bride_name (similarity: ${oldVsBride.toFixed(2)})`);
  } else {
    reasons.push(`old_name "${old_name}" does not match bride_name "${bride_name}" (similarity: ${oldVsBride.toFixed(2)})`);
  }

  if (newVsMarried !== null) {
    if (newVsMarried >= 0.8) {
      score = Math.min(score, 1.0);  // cap bonus
    } else if (newVsMarried < 0.4) {
      reasons.push(`new_name does not match married_name on certificate (similarity: ${newVsMarried.toFixed(2)})`);
    }
  }

  return {
    score:   Math.min(score, 1.0),
    detail:  { old_vs_bride: oldVsBride, new_vs_married: newVsMarried },
    reasons,
  };
}

// ── B. Logical Consistency ───────────────────────────────────────────────────

function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function checkLogicalConsistency(fields) {
  const marriage = parseDate(fields.marriage_date);
  const issue    = parseDate(fields.issue_date);
  const now      = new Date();
  const reasons  = [];
  let score      = 1.0;

  if (!marriage) {
    reasons.push('marriage_date is missing or unparseable');
    score -= 0.4;
  } else if (marriage > now) {
    reasons.push('marriage_date is in the future');
    score -= 0.5;
  }

  if (!issue) {
    reasons.push('issue_date is missing or unparseable');
    score -= 0.2;
  } else {
    if (issue > now) {
      reasons.push('issue_date is in the future');
      score -= 0.4;
    }
    if (marriage && issue < marriage) {
      reasons.push('issue_date is before marriage_date (logically impossible)');
      score -= 0.5;
    }
  }

  // Basic sanity: marriage should not be before 1950 (no modern Indian certificates before that)
  if (marriage && marriage.getFullYear() < 1950) {
    reasons.push('marriage_date year seems unrealistic (before 1950)');
    score -= 0.2;
  }

  return { score: Math.max(0, score), reasons };
}

// ── C. Registration Number ───────────────────────────────────────────────────

function checkRegistrationNumber(regNo, marriageDate) {
  const reasons = [];

  if (!regNo) {
    return { score: 0.2, reasons: ['Registration number is missing'] };
  }

  // Common Indian marriage certificate patterns:
  // e.g. "MCD/2023/001234", "REG/MH/2022/4567", "BDRS-2021-00456"
  const hasYear   = /\b(19|20)\d{2}\b/.test(regNo);
  const hasDigits = /\d{3,}/.test(regNo);

  let score = 0.4;

  if (hasYear && hasDigits) {
    score = 1.0;
    // Year in reg number should match marriage year
    const regYearMatch = regNo.match(/\b(19|20)\d{2}\b/);
    if (regYearMatch && marriageDate) {
      const regYear       = parseInt(regYearMatch[0]);
      const marriageYear  = parseDate(marriageDate)?.getFullYear();
      if (marriageYear && Math.abs(regYear - marriageYear) > 2) {
        reasons.push(`Year in reg number (${regYear}) inconsistent with marriage year (${marriageYear})`);
        score -= 0.3;
      }
    }
  } else if (hasDigits) {
    score = 0.6;
    reasons.push('Registration number lacks year component');
  } else {
    reasons.push('Registration number format seems unusual');
  }

  return { score: Math.max(0, score), reasons };
}

// ── D. Authority Validation ──────────────────────────────────────────────────

const VALID_DESIGNATIONS = [
  'registrar', 'sub-registrar', 'sub registrar',
  'marriage officer', 'municipal corporation',
  'nagar palika', 'gram panchayat', 'tehsildar',
  'district registrar', 'joint registrar',
  'additional registrar', 'mandal officer',
];

function checkAuthorityValidity(authority) {
  if (!authority) {
    return { score: 0.2, reasons: ['Issuing authority is missing'] };
  }

  const lower = authority.toLowerCase();
  const hasValidDesignation = VALID_DESIGNATIONS.some(d => lower.includes(d));

  if (hasValidDesignation) {
    return { score: 1.0, reasons: [] };
  }

  return {
    score:   0.4,
    reasons: [`Authority "${authority}" does not contain a recognised designation (Registrar etc.)`],
  };
}

// ── E. Place Consistency ─────────────────────────────────────────────────────

function checkPlaceConsistency(place, authority) {
  if (!place) {
    return { score: 0.3, reasons: ['Place of registration is missing'] };
  }

  // If authority contains a geographic reference, check it appears in place or vice versa
  if (authority) {
    const placeWords     = place.toLowerCase().split(/[\s,]+/);
    const authorityWords = authority.toLowerCase().split(/[\s,]+/);
    const overlap        = placeWords.filter(w => w.length > 3 && authorityWords.includes(w));
    if (overlap.length > 0) {
      return { score: 1.0, reasons: [] };
    }
  }

  // Place exists but no cross-reference possible — mild warning
  return { score: 0.7, reasons: ['Place of registration could not be cross-verified with authority'] };
}

// ── F. Cross-field Consistency ───────────────────────────────────────────────

function checkCrossFieldConsistency(fields) {
  const reasons = [];
  let score = 1.0;

  // Check date format consistency
  const dates = [fields.marriage_date, fields.issue_date].filter(Boolean);
  if (dates.length === 2) {
    const allISO = dates.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (!allISO) {
      reasons.push('Date fields have inconsistent formats (should be YYYY-MM-DD)');
      score -= 0.1;
    }
  }

  // Bride and groom names should both be present
  if (!fields.bride_name) { reasons.push('bride_name is missing'); score -= 0.2; }
  if (!fields.groom_name) { reasons.push('groom_name is missing'); score -= 0.1; }

  // Names should not be identical to each other
  if (fields.bride_name && fields.groom_name &&
      fields.bride_name.toLowerCase().trim() === fields.groom_name.toLowerCase().trim()) {
    reasons.push('bride_name and groom_name are identical — likely extraction error');
    score -= 0.4;
  }

  return { score: Math.max(0, score), reasons };
}

// ── Main Agent ───────────────────────────────────────────────────────────────

async function fieldValidationAgent(state) {
  const startTime = Date.now();
  const { request_id } = state.input_data;
  const fields = state.extracted_fields || {};

  const identity      = checkIdentityConsistency(state);
  const logical       = checkLogicalConsistency(fields);
  const regNumber     = checkRegistrationNumber(fields.registration_number, fields.marriage_date);
  const authority     = checkAuthorityValidity(fields.issuing_authority);
  const place         = checkPlaceConsistency(fields.place_of_registration, fields.issuing_authority);
  const crossField    = checkCrossFieldConsistency(fields);

  const validation_results = {
    name_match:          { score: identity.score,   reasons: identity.reasons,   detail: identity.detail },
    date_validity:       { score: logical.score,    reasons: logical.reasons },
    reg_number_validity: { score: regNumber.score,  reasons: regNumber.reasons },
    authority_validity:  { score: authority.score,  reasons: authority.reasons },
    place_consistency:   { score: place.score,      reasons: place.reasons },
    cross_field:         { score: crossField.score, reasons: crossField.reasons },

    // Flattened scores for Confidence Scorer
    scores: {
      name_match:          identity.score,
      date_validity:       logical.score,
      reg_number_validity: regNumber.score,
      authority_validity:  authority.score,
      place_consistency:   place.score,
      cross_field:         crossField.score,
    },
  };

  await logAgentExecution({
    request_id,
    agent_name:  'FieldValidationAgent',
    input_data:  { extracted_fields: fields, input_data: state.input_data },
    output_data: validation_results,
    duration_ms: Date.now() - startTime,
    status:      'SUCCESS',
  });

  return { validation_results };
}

module.exports = { fieldValidationAgent };
