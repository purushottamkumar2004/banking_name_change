// backend/src/agents/tracing.js
// LangSmith tracing helpers.
// Wraps individual agent functions so each appears as a named run in LangSmith
// with structured inputs, outputs, and timing.
//
// Usage:
//   const { tracedAgent } = require('./tracing');
//   const myAgent = tracedAgent('MyAgent', async (state) => { ... });

const { Client } = require('langsmith');
const { traceable } = require('langsmith/traceable');

const TRACING_ENABLED = process.env.LANGCHAIN_TRACING_V2 === 'true' && !!process.env.LANGCHAIN_API_KEY;

/**
 * Wraps an agent function with LangSmith tracing if configured.
 * If tracing is disabled, returns the original function unchanged.
 *
 * @param {string}   agentName  - Display name in LangSmith UI
 * @param {Function} agentFn    - The agent async function (state) => partial state
 */
function tracedAgent(agentName, agentFn) {
  if (!TRACING_ENABLED) return agentFn;

  return traceable(agentFn, {
    name: agentName,
    run_type: 'chain',
    tags: ['agent', 'name-change-verification'],
    metadata: { system: 'name-change-verification', agent: agentName },
  });
}

/**
 * Creates a LangSmith run for the full pipeline execution.
 * Returns a runId that can be used to link all agent sub-runs.
 */
async function createPipelineRun(requestId, customerData) {
  if (!TRACING_ENABLED) return null;

  try {
    const client = new Client();
    const run = await client.createRun({
      name: `name-change-${requestId}`,
      run_type: 'chain',
      inputs: {
        request_id:  requestId,
        customer_id: customerData.customer_id,
        old_name:    customerData.old_name,
        new_name:    customerData.new_name,
      },
      tags: ['name-change', 'full-pipeline'],
      extra: { metadata: { request_id: requestId } },
    });
    return run.id;
  } catch (err) {
    console.warn('[LangSmith] Failed to create pipeline run:', err.message);
    return null;
  }
}

/**
 * Updates a pipeline run with final results.
 */
async function completePipelineRun(runId, scoreCard, error = null) {
  if (!TRACING_ENABLED || !runId) return;

  try {
    const client = new Client();
    await client.updateRun(runId, {
      outputs: {
        overall_score:    scoreCard?.overall_score,
        fraud_score:      scoreCard?.fraud_score,
        confidence_level: scoreCard?.confidence_level,
        recommendation:   scoreCard?.recommendation,
        decision:         scoreCard?.decision,
      },
      error:     error?.message || null,
      end_time:  Date.now() / 1000,
    });
  } catch (err) {
    console.warn('[LangSmith] Failed to complete pipeline run:', err.message);
  }
}

module.exports = { tracedAgent, createPipelineRun, completePipelineRun, TRACING_ENABLED };
