// backend/src/db/chroma.js
// Chroma vector DB integration.
// Stores embeddings of past verification results so the system can surface
// similar historical cases to the human checker — improves consistency.
//
// Use case:
//   "3 similar cases were processed this month — 2 approved, 1 rejected."
//   This gives the checker context without requiring manual search.

const { ChromaClient, OpenAIEmbeddingFunction } = require('chromadb');

const COLLECTION_NAME = 'verification_cases';

let client = null;
let collection = null;

/**
 * Lazily initialise the Chroma client and get/create the collection.
 * Chroma must be running locally (docker run -p 8000:8000 chromadb/chroma).
 */
async function getCollection() {
  if (collection) return collection;

  try {
    client = new ChromaClient({
      path: process.env.CHROMA_URL || 'http://localhost:8000',
    });

    // Use a simple embedding function based on the text content of the case.
    // In production swap for a proper embedding model (text-embedding-ada-002 etc.)
    const embeddingFn = {
      generate: async (texts) => {
        // Naive bag-of-words hash embedding for local dev — replace with real embeddings
        return texts.map(text => {
          const words = text.toLowerCase().split(/\s+/);
          const vec = new Array(128).fill(0);
          for (const word of words) {
            let h = 0;
            for (let i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) % 128;
            vec[Math.abs(h)] += 1;
          }
          // Normalise
          const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
          return vec.map(v => v / mag);
        });
      },
    };

    collection = await client.getOrCreateCollection({
      name: COLLECTION_NAME,
      embeddingFunction: embeddingFn,
      metadata: { 'hnsw:space': 'cosine' },
    });

    console.log('[Chroma] Collection ready:', COLLECTION_NAME);
    return collection;
  } catch (err) {
    console.warn('[Chroma] Not available:', err.message, '— similar case lookup disabled');
    return null;
  }
}

/**
 * Builds a text representation of a verification case for embedding.
 * Captures the key signals without including PII that shouldn't be in vector search.
 */
function buildCaseText(requestData) {
  const {
    confidence_level, recommendation, overall_score, fraud_score,
    field_scores = [], fraud_signals = [],
  } = requestData;

  const fieldSummary = field_scores
    .map(f => `${f.field_name}:${f.status}`)
    .join(' ');

  const fraudSummary = fraud_signals
    .map(s => `${s.signal_type}:${s.severity}`)
    .join(' ') || 'no_fraud_signals';

  return [
    `confidence:${confidence_level || 'UNKNOWN'}`,
    `score:${overall_score || 0}`,
    `fraud:${fraud_score || 0}`,
    `recommendation:${recommendation || 'UNKNOWN'}`,
    fieldSummary,
    fraudSummary,
  ].join(' ');
}

/**
 * Store a completed verification case in Chroma after human decision.
 * Called when a request is approved or rejected.
 */
async function storeCase(requestId, requestData, humanDecision) {
  const coll = await getCollection();
  if (!coll) return;  // Chroma unavailable — skip silently

  try {
    const text = buildCaseText(requestData);

    await coll.upsert({
      ids:       [requestId],
      documents: [text],
      metadatas: [{
        request_id:       requestId,
        human_decision:   humanDecision,          // 'APPROVED' | 'REJECTED'
        ai_recommendation: requestData.recommendation || 'UNKNOWN',
        confidence_level:  requestData.confidence_level || 'UNKNOWN',
        overall_score:     requestData.overall_score || 0,
        fraud_score:       requestData.fraud_score || 0,
        created_at:        new Date().toISOString(),
      }],
    });

    console.log(`[Chroma] Stored case ${requestId} (decision: ${humanDecision})`);
  } catch (err) {
    console.warn('[Chroma] Failed to store case:', err.message);
  }
}

/**
 * Find the N most similar historical cases to the current request.
 * Returns an array of similar cases with their human decisions.
 *
 * @param {Object} requestData  - Current request's score data
 * @param {number} n            - Number of similar cases to return (default 5)
 */
async function findSimilarCases(requestData, n = 5) {
  const coll = await getCollection();
  if (!coll) return [];

  try {
    const queryText = buildCaseText(requestData);

    const results = await coll.query({
      queryTexts:     [queryText],
      nResults:       Math.min(n, 10),
      include:        ['metadatas', 'distances'],
    });

    if (!results.ids?.[0]?.length) return [];

    // Build response — exclude the current request from results
    const similar = [];
    for (let i = 0; i < results.ids[0].length; i++) {
      const meta     = results.metadatas[0][i];
      const distance = results.distances[0][i];
      const similarity = Math.round((1 - distance) * 100);

      if (meta.request_id === requestData.request_id) continue;
      if (similarity < 40) continue;  // Too dissimilar — not useful

      similar.push({
        request_id:        meta.request_id,
        human_decision:    meta.human_decision,
        ai_recommendation: meta.ai_recommendation,
        confidence_level:  meta.confidence_level,
        overall_score:     meta.overall_score,
        fraud_score:       meta.fraud_score,
        similarity_pct:    similarity,
      });
    }

    return similar;
  } catch (err) {
    console.warn('[Chroma] Query failed:', err.message);
    return [];
  }
}

/**
 * Summarise similar cases into a human-readable insight string.
 * e.g. "4 similar cases: 3 approved (75%), 1 rejected (25%)."
 */
function summariseSimilarCases(cases) {
  if (!cases.length) return null;

  const approved  = cases.filter(c => c.human_decision === 'APPROVED').length;
  const rejected  = cases.filter(c => c.human_decision === 'REJECTED').length;
  const total     = cases.length;

  const parts = [];
  if (approved > 0) parts.push(`${approved} approved`);
  if (rejected > 0) parts.push(`${rejected} rejected`);

  const avgScore = Math.round(cases.reduce((s, c) => s + (c.overall_score || 0), 0) / total);

  return `${total} similar case${total > 1 ? 's' : ''} found: ${parts.join(', ')}. Average score: ${avgScore}%.`;
}

module.exports = { storeCase, findSimilarCases, summariseSimilarCases };
