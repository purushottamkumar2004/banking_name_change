// backend/src/agents/intakeValidationAgent.js
// Agent 1: Intake Validation Agent
// Validates that all required input fields are present, non-empty, and sensible.
// This is the gate — if validation fails, the pipeline stops early.

const { logAgentExecution } = require('./auditLogger');

/**
 * Validates name strings: non-empty, alphabetic + spaces/hyphens/dots, 2-100 chars.
 */
function validateName(name) {
  if (!name || typeof name !== 'string') return { valid: false, reason: 'Name is missing or not a string' };
  const trimmed = name.trim();
  if (trimmed.length < 2)   return { valid: false, reason: 'Name too short (minimum 2 characters)' };
  if (trimmed.length > 100) return { valid: false, reason: 'Name too long (maximum 100 characters)' };
  // Allow Unicode letters (covers Hindi/Marathi names), spaces, hyphens, dots
  if (/[<>{}|!@#$%^*+=\[\]\\0-9]/.test(trimmed)) {
    return { valid: false, reason: 'Name contains invalid characters' };
  }
  return { valid: true };
}

/**
 * Validates customer_id: alphanumeric, 3-50 chars.
 */
function validateCustomerId(id) {
  if (!id || typeof id !== 'string') return { valid: false, reason: 'Customer ID is missing' };
  const trimmed = id.trim();
  if (!/^[A-Za-z0-9_\-]{3,50}$/.test(trimmed)) {
    return { valid: false, reason: 'Customer ID must be 3-50 alphanumeric characters' };
  }
  return { valid: true };
}

/**
 * Intake Validation Agent node for LangGraph.
 * Throws an error (halts pipeline) if validation fails.
 */
async function intakeValidationAgent(state) {
  const startTime = Date.now();
  const { request_id, customer_id, old_name, new_name } = state.input_data;

  const errors = [];

  const cidCheck = validateCustomerId(customer_id);
  if (!cidCheck.valid) errors.push(`customer_id: ${cidCheck.reason}`);

  const oldNameCheck = validateName(old_name);
  if (!oldNameCheck.valid) errors.push(`old_name: ${oldNameCheck.reason}`);

  const newNameCheck = validateName(new_name);
  if (!newNameCheck.valid) errors.push(`new_name: ${newNameCheck.reason}`);

  // Names must differ
  if (old_name && new_name && old_name.trim().toLowerCase() === new_name.trim().toLowerCase()) {
    errors.push('old_name and new_name cannot be the same');
  }

  const output = {
    status:       errors.length === 0 ? 'PASS' : 'FAIL',
    errors,
    validated_at: new Date().toISOString(),
  };

  // Log to audit_logs table
  await logAgentExecution({
    request_id,
    agent_name:   'IntakeValidationAgent',
    input_data:   state.input_data,
    output_data:  output,
    duration_ms:  Date.now() - startTime,
    status:       errors.length === 0 ? 'SUCCESS' : 'ERROR',
    error_message: errors.length > 0 ? errors.join('; ') : null,
  });

  if (errors.length > 0) {
    throw new Error(`Intake validation failed: ${errors.join('; ')}`);
  }

  // No state mutation needed — just passes through
  return {};
}

module.exports = { intakeValidationAgent };
