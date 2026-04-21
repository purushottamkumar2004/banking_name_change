// backend/src/agents/auditLogger.js
// Shared helper used by all agents to write to the audit_logs table.
// Every agent input/output is recorded for full auditability.

const pool = require('../db/pool');

/**
 * Logs a single agent execution to audit_logs.
 * Called at the end of every agent node — success or failure.
 *
 * @param {Object} opts
 * @param {string} opts.request_id
 * @param {string} opts.agent_name
 * @param {any}    opts.input_data
 * @param {any}    opts.output_data
 * @param {number} opts.duration_ms
 * @param {'SUCCESS'|'ERROR'} opts.status
 * @param {string} [opts.error_message]
 */
async function logAgentExecution({ request_id, agent_name, input_data, output_data, duration_ms, status, error_message }) {
  try {
    await pool.execute(
      `INSERT INTO audit_logs
         (request_id, agent_name, input_data, output_data, duration_ms, status, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        request_id,
        agent_name,
        input_data  ? JSON.stringify(sanitizeForLog(input_data))  : null,
        output_data ? JSON.stringify(sanitizeForLog(output_data)) : null,
        duration_ms || 0,
        status,
        error_message || null,
      ]
    );
  } catch (err) {
    // Logging failure should never crash the pipeline
    console.error(`[AuditLogger] Failed to log ${agent_name} for ${request_id}:`, err.message);
  }
}

/**
 * Removes large binary buffers from objects before JSON serialisation.
 * Keeps the log table readable and prevents bloat.
 */
function sanitizeForLog(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (Buffer.isBuffer(value)) {
      clean[key] = `[Buffer ${value.length} bytes]`;
    } else if (key === 'buffer') {
      clean[key] = `[Buffer]`;
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeForLog(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

module.exports = { logAgentExecution };
