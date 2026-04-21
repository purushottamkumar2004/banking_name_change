// backend/src/agents/pipeline.js
// Activates mock mode automatically when MOCK_PIPELINE=true or NODE_ENV=test.
//
// NOTE ON PARALLELISM:
// LangGraph JS v0.2 does not reliably support fan-out/fan-in via addEdge alone —
// the second node to write state overwrites the first, so one of validation_results
// or fraud_results ends up null at the confidenceScorer step (hence 0ms duration).
//
// Fix: a single 'parallelAnalysis' node runs fieldValidation + forgeryDetection
// concurrently via Promise.all, then merges both results into state atomically.
// This guarantees confidenceScorer always has both inputs populated.

const { StateGraph, END } = require('@langchain/langgraph');
const { StateAnnotation }        = require('./state');
const { intakeValidationAgent }      = require('./intakeValidationAgent');
const { customerVerificationAgent }  = require('./customerVerificationAgent');
const { documentProcessorAgent }     = require('./documentProcessorAgent');
const { fieldValidationAgent }   = require('./fieldValidationAgent');
const { forgeryDetectionAgent }  = require('./forgeryDetectionAgent');
const { confidenceScorerAgent }  = require('./confidenceScorerAgent');
const { summaryAgent }           = require('./summaryAgent');
const { runMockPipeline }        = require('./mockPipeline');

const USE_MOCK = process.env.MOCK_PIPELINE === 'true' || process.env.NODE_ENV === 'test';

// Combined parallel node: runs field validation and forgery detection at the
// same time, then merges both outputs into state in a single atomic write.
async function parallelAnalysisNode(state) {
  const [validationUpdate, forgeryUpdate] = await Promise.all([
    fieldValidationAgent(state),
    forgeryDetectionAgent(state),
  ]);
  return {
    ...validationUpdate,  // { validation_results }
    ...forgeryUpdate,     // { fraud_results }
  };
}

const workflow = new StateGraph({ channels: StateAnnotation });

workflow.addNode('intakeValidation',     intakeValidationAgent);
workflow.addNode('customerVerification', customerVerificationAgent);
workflow.addNode('documentProcessor',    documentProcessorAgent);
workflow.addNode('parallelAnalysis',     parallelAnalysisNode);
workflow.addNode('confidenceScorer',     confidenceScorerAgent);
workflow.addNode('summaryAgent',         summaryAgent);

workflow.addEdge('__start__',            'intakeValidation');
workflow.addEdge('intakeValidation',     'customerVerification');
workflow.addEdge('customerVerification', 'documentProcessor');
workflow.addEdge('documentProcessor',    'parallelAnalysis');
workflow.addEdge('parallelAnalysis',     'confidenceScorer');
workflow.addEdge('confidenceScorer',     'summaryAgent');
workflow.addEdge('summaryAgent',          END);

const app = workflow.compile();

async function runPipeline(initialState) {
  if (USE_MOCK) {
    console.log(`[Pipeline] MOCK — ${initialState.input_data.request_id}`);
    return runMockPipeline(initialState);
  }
  console.log(`[Pipeline] Live — ${initialState.input_data.request_id}`);
  const config = {
    runName:  `name-change-${initialState.input_data.request_id}`,
    metadata: { customer_id: initialState.input_data.customer_id, request_id: initialState.input_data.request_id },
    tags: ['name-change', 'marriage-certificate'],
  };
  const finalState = await app.invoke(initialState, config);
  console.log(`[Pipeline] Done. Score: ${finalState.score_card?.overall_score} | ${finalState.score_card?.confidence_level}`);
  return finalState;
}

module.exports = { runPipeline };