// backend/src/agents/state.js
// Defines the shared state object passed across all LangGraph nodes.
// Every agent reads from and writes to this object — never mutates directly,
// always returns a partial update which LangGraph merges.

/**
 * @typedef {Object} AgentState
 *
 * @property {Object}  input_data          - Raw input from the API request
 * @property {string}  input_data.request_id
 * @property {string}  input_data.customer_id
 * @property {string}  input_data.old_name
 * @property {string}  input_data.new_name
 *
 * @property {Object}  document            - Raw document info
 * @property {string}  document.s3_key     - S3 path of uploaded file
 * @property {Buffer}  document.buffer     - Raw file bytes for OCR
 * @property {string}  document.mime_type
 *
 * @property {Object}  extracted_fields    - Structured fields from Document AI + Gemini
 * @property {string}  extracted_fields.bride_name
 * @property {string}  extracted_fields.groom_name
 * @property {string}  extracted_fields.marriage_date
 * @property {string}  extracted_fields.registration_number
 * @property {string}  extracted_fields.issuing_authority
 * @property {string}  extracted_fields.place_of_registration
 * @property {string}  extracted_fields.issue_date
 * @property {string}  extracted_fields.married_name
 *
 * @property {Object}  ocr_confidence_map  - Per-field OCR confidence (0-1)
 * @property {Object}  validation_results  - Output of Field Validation Agent
 * @property {Object}  fraud_results       - Output of Forgery Detection Agent
 * @property {Object}  score_card          - Output of Confidence Scorer Agent
 * @property {string}  summary             - Human-readable summary from Summary Agent
 * @property {string}  error               - Set if any agent throws a non-fatal error
 */

/**
 * Returns the initial empty state for a new pipeline run.
 * LangGraph uses this as the annotation schema.
 */
function createInitialState(requestId, customerData, documentBuffer, s3Key, mimeType) {
  return {
    input_data: {
      request_id:  requestId,
      customer_id: customerData.customer_id,
      old_name:    customerData.old_name,
      new_name:    customerData.new_name,
    },
    document: {
      s3_key:    s3Key,
      buffer:    documentBuffer,
      mime_type: mimeType,
    },
    extracted_fields:   null,
    ocr_confidence_map: null,
    bank_customer:      null,
    validation_results: null,
    fraud_results:      null,
    score_card:         null,
    summary:            null,
    error:              null,
  };
}

// LangGraph state annotation — describes how to merge partial updates.
// Using the "last write wins" strategy for all fields.
const StateAnnotation = {
  input_data:         { reducer: (_, next) => next },
  document:           { reducer: (_, next) => next },
  extracted_fields:   { reducer: (_, next) => next },
  ocr_confidence_map: { reducer: (_, next) => next },
  bank_customer:      { reducer: (_, next) => next },
  validation_results: { reducer: (_, next) => next },
  fraud_results:      { reducer: (_, next) => next },
  score_card:         { reducer: (_, next) => next },
  summary:            { reducer: (_, next) => next },
  error:              { reducer: (_, next) => next },
};

module.exports = { createInitialState, StateAnnotation };
