// backend/src/agents/summaryAgent.js
// Agent 5: Summary Agent
// Uses gemini-1.5-flash (fast, no thinking overhead) for text-only summaries.
// gemini-2.5-flash is reserved for documentProcessorAgent where reasoning helps.
// Falls back to a template-based summary if Gemini is unavailable.

const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { logAgentExecution } = require('./auditLogger');

function getGemini() {
  return new ChatGoogleGenerativeAI({
    model:       'gemini-1.5-flash',   // fast non-reasoning model — ideal for text summarisation
    apiKey:      process.env.GEMINI_API_KEY || 'not-set',
    temperature: 0,
    maxOutputTokens: 300,              // summary needs ~150 tokens max; cap prevents runaway latency
  });
}

async function summaryAgent(state) {
  const startTime = Date.now();
  const { request_id, old_name, new_name, customer_id } = state.input_data;
  const ef = state.extracted_fields  || {};
  const vr = state.validation_results || {};
  const fr = state.fraud_results     || {};
  const sc = state.score_card        || {};

  const systemPrompt = `You are a document verification assistant for a bank.
Write a concise, factual summary (3-5 sentences) for a human checker reviewing a name change request.
Be direct and specific. Mention key findings — both positive and concerning.
End with the AI recommendation (APPROVE / REJECT / MANUAL_REVIEW).
Do not use technical jargon. Write in plain English.`;

  const userPrompt = `
Customer ID: ${customer_id}
Requested name change: "${old_name}" → "${new_name}"

Extraction results:
- Bride name on certificate: ${ef.bride_name || 'NOT FOUND'}
- Groom name: ${ef.groom_name || 'NOT FOUND'}
- Marriage date: ${ef.marriage_date || 'NOT FOUND'}
- Registration number: ${ef.registration_number || 'NOT FOUND'}
- Issuing authority: ${ef.issuing_authority || 'NOT FOUND'}
- Place of registration: ${ef.place_of_registration || 'NOT FOUND'}

Validation findings:
- Name match score: ${((vr.scores?.name_match ?? 0) * 100).toFixed(0)}%
- Date validity: ${((vr.scores?.date_validity ?? 0) * 100).toFixed(0)}%
- Registration validity: ${((vr.scores?.reg_number_validity ?? 0) * 100).toFixed(0)}%

Forgery signals:
- OCR anomaly score: ${((fr.ocr_anomaly_score ?? 1) * 100).toFixed(0)}% clean
- Metadata risk: ${((fr.metadata_risk_score ?? 1) * 100).toFixed(0)}% clean
- Image integrity: ${((fr.image_tampering_score ?? 1) * 100).toFixed(0)}% clean
- Active signals: ${fr.signals?.map(s => s.detail).join('; ') || 'None'}

Overall confidence: ${sc.overall_score ?? 0}% (${sc.confidence_level ?? 'UNKNOWN'})
Fraud score: ${sc.fraud_score ?? 0}/100
Penalties: ${sc.penalties_applied?.map(p => p.detail).join('; ') || 'None'}
AI recommendation: ${sc.recommendation ?? 'MANUAL_REVIEW'}

Write the checker summary now:`;

  let summary;
  try {
    const response = await getGemini().invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);
    summary = response.content.trim();
  } catch (err) {
    console.warn('[SummaryAgent] Gemini unavailable, using fallback:', err.message);
    summary = generateFallbackSummary(state);
  }

  await logAgentExecution({
    request_id,
    agent_name:  'SummaryAgent',
    input_data:  { overall_score: sc.overall_score, recommendation: sc.recommendation },
    output_data: { summary },
    duration_ms: Date.now() - startTime,
    status:      'SUCCESS',
  });

  return { summary };
}

function generateFallbackSummary(state) {
  const { old_name, new_name } = state.input_data;
  const ef = state.extracted_fields || {};
  const sc = state.score_card || {};

  const nameMatchScore = sc.components?.identity_consistency?.score ?? 0;
  const nameMatchOk    = nameMatchScore >= 70;

  const nameStatus = nameMatchOk
    ? `Old name "${old_name}" matches bride name "${ef.bride_name}" on the certificate (${nameMatchScore}% match).`
    : `Name mismatch detected: old name "${old_name}" does not clearly match bride name "${ef.bride_name}" on the certificate.`;

  const signals = state.fraud_results?.signals || [];
  const fraudNote = signals.length > 0
    ? `${signals.length} fraud signal(s) detected: ${signals.slice(0, 2).map(s => s.detail).join('; ')}.`
    : 'No significant fraud signals detected.';

  return `Marriage certificate submitted for name change from "${old_name}" to "${new_name}". ${nameStatus} ${fraudNote} Overall confidence: ${sc.overall_score ?? 0}%. AI Recommendation: ${sc.recommendation ?? 'MANUAL_REVIEW'}.`;
}

module.exports = { summaryAgent };