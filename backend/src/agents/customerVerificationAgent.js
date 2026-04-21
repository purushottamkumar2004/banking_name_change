// backend/src/agents/customerVerificationAgent.js
// Agent 1b: Customer Verification Agent
//
// Runs after intake validation. Checks:
//   1. Does this customer_id exist in the bank's DB?
//   2. Does the submitted old_name match the bank's records?
//   3. Does the new_name surname match the groom's surname on the certificate?
//
// This is the bank DB cross-check — ensures the name change request
// is genuinely for an existing customer whose name we can verify.

const pool = require('../db/pool');
const { logAgentExecution } = require('./auditLogger');

/**
 * Fuzzy name similarity (same logic as fieldValidationAgent).
 * Returns 0-1. Handles partial matches like "Priya R. Mehta" vs "Priya Mehta".
 */
function nameSimilarity(a, b) {
  if (!a || !b) return 0;
  const normalize = s => s.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1.0;
  const tokensA = new Set(na.split(' '));
  const tokensB = new Set(nb.split(' '));
  const intersection = [...tokensA].filter(t => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Extracts the last word (surname) from a full name string.
 */
function getSurname(fullName) {
  if (!fullName) return null;
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1].toLowerCase();
}

async function customerVerificationAgent(state) {
  const startTime = Date.now();
  const { request_id, customer_id, old_name, new_name } = state.input_data;
  const ef = state.extracted_fields || {};

  const errors = [];
  const warnings = [];
  let bank_customer = null;

  try {
    // ── 1. Check customer exists in bank DB ──────────────────────────────────
    const [[customer]] = await pool.query(
      'SELECT * FROM customers WHERE customer_id = ?',
      [customer_id]
    );

    if (!customer) {
      // Hard stop — customer not found in bank records
      throw new Error(`Customer ID "${customer_id}" does not exist in bank records. Cannot process name change.`);
    }

    bank_customer = customer;

    // ── 2. Check old_name matches bank records ───────────────────────────────
    const bankNameScore = nameSimilarity(old_name, customer.full_name);

    if (bankNameScore < 0.5) {
      // Hard stop — the name submitted doesn't match what the bank has
      throw new Error(
        `Name mismatch with bank records: submitted "${old_name}" but bank has "${customer.full_name}" for ${customer_id}.`
      );
    }

    if (bankNameScore < 0.8) {
      warnings.push(`Partial name match with bank records: "${old_name}" vs "${customer.full_name}" (${(bankNameScore * 100).toFixed(0)}% match)`);
    }

    // ── 3. Cross-check groom surname on certificate with new_name ────────────
    // Only runs if document has already been processed (extracted_fields available)
    if (ef.groom_name) {
      const groomSurname   = getSurname(ef.groom_name);
      const newNameSurname = getSurname(new_name);

      if (groomSurname && newNameSurname) {
        if (groomSurname !== newNameSurname) {
          warnings.push(
            `New name surname "${newNameSurname}" does not match groom's surname "${groomSurname}" on certificate. ` +
            `Expected new name to end with "${ef.groom_name.split(' ').pop()}".`
          );
        }
      }
    }

    const output = {
      status:           errors.length === 0 ? 'PASS' : 'FAIL',
      warnings,
      bank_name_match:  bankNameScore,
      bank_record:      { full_name: customer.full_name, account_no: customer.account_no, branch: customer.branch },
      verified_at:      new Date().toISOString(),
    };

    await logAgentExecution({
      request_id,
      agent_name:   'CustomerVerificationAgent',
      input_data:   { customer_id, old_name, new_name },
      output_data:  output,
      duration_ms:  Date.now() - startTime,
      status:       'SUCCESS',
    });

    // Pass bank_customer into state so fieldValidationAgent can use it
    return { bank_customer: output.bank_record };

  } catch (err) {
    await logAgentExecution({
      request_id,
      agent_name:    'CustomerVerificationAgent',
      input_data:    { customer_id, old_name, new_name },
      output_data:   null,
      duration_ms:   Date.now() - startTime,
      status:        'ERROR',
      error_message: err.message,
    });
    throw err;
  }
}

module.exports = { customerVerificationAgent };
