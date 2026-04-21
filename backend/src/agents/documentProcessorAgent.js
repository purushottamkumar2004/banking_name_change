// backend/src/agents/documentProcessorAgent.js
// Agent 2: Document Processor Agent
//
// Step 1: Send document buffer to Google Document AI for OCR extraction.
//         Captures per-token confidence scores to build the confidence map.
// Step 2: Send raw OCR text to Gemini 1.5 Pro for structured field extraction.
//         Gemini interprets the text into a standardised JSON schema.

const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { logAgentExecution } = require('./auditLogger');

const DOC_AI_LOCATION = process.env.GOOGLE_DOCUMENT_AI_LOCATION || 'us';

// The client MUST use the regional API endpoint that matches where the processor
// was created. Without this, requests always go to the default US endpoint and
// Google returns INVALID_ARGUMENT for processors in any other region (e.g. asia-southeast1).
const docAIClient = new DocumentProcessorServiceClient({
  apiEndpoint: `${DOC_AI_LOCATION}-documentai.googleapis.com`,
});

const PROCESSOR_NAME = `projects/${process.env.GOOGLE_DOCUMENT_AI_PROJECT_ID}/locations/${DOC_AI_LOCATION}/processors/${process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID}`;

console.log(`[DocumentAI] Endpoint : ${DOC_AI_LOCATION}-documentai.googleapis.com`);
console.log(`[DocumentAI] Processor: ${PROCESSOR_NAME}`);

function getGemini() {
  return new ChatGoogleGenerativeAI({
    model:       'gemini-2.5-flash',
    apiKey:      process.env.GEMINI_API_KEY || 'not-set',
    temperature: 0,
  });
}

/**
 * Converts a Google Document AI Document proto into a flat text string
 * and builds a per-field confidence map based on token-level scores.
 */
function extractOCRData(document) {
  const text = document.text || '';

  // Build confidence map by scanning all blocks/paragraphs/tokens
  const confidenceScores = [];

  for (const page of document.pages || []) {
    for (const block of page.blocks || []) {
      const conf = block.layout?.confidence;
      if (conf !== undefined && conf !== null) {
        confidenceScores.push(conf);
      }
    }
    for (const token of page.tokens || []) {
      const conf = token.layout?.confidence;
      if (conf !== undefined && conf !== null) {
        confidenceScores.push(conf);
      }
    }
  }

  const avgConfidence = confidenceScores.length > 0
    ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
    : 0;

  const minConfidence = confidenceScores.length > 0
    ? Math.min(...confidenceScores)
    : 0;

  // Flag any significant low-confidence regions (potential tampering signal)
  const lowConfidenceRegions = confidenceScores.filter(s => s < 0.7).length;
  const lowConfidenceRatio    = confidenceScores.length > 0
    ? lowConfidenceRegions / confidenceScores.length
    : 0;

  return {
    raw_text:              text,
    avg_confidence:        avgConfidence,
    min_confidence:        minConfidence,
    low_confidence_ratio:  lowConfidenceRatio,
    total_tokens:          confidenceScores.length,
  };
}

/**
 * Prompts Gemini 1.5 Pro to extract structured fields from raw OCR text.
 * Uses a strict JSON-only output instruction.
 * Handles both English and bilingual (Hindi/Marathi + English) certificates.
 */
async function extractFieldsWithGemini(rawText, mimeType, documentBuffer) {
  const systemPrompt = `You are a document information extraction specialist for Indian government documents.
Extract the following fields from the marriage certificate text provided.
Return ONLY a valid JSON object with exactly these keys — no preamble, no explanation, no markdown:
{
  "bride_name": string or null,
  "groom_name": string or null,
  "marriage_date": "YYYY-MM-DD" or null,
  "registration_number": string or null,
  "issuing_authority": string or null,
  "place_of_registration": string or null,
  "issue_date": "YYYY-MM-DD" or null,
  "married_name": string or null,
  "document_language": "english" | "hindi" | "marathi" | "bilingual",
  "missing_fields": [array of field names that are absent or illegible]
}

Rules:
- married_name is the name the bride takes after marriage (may match groom's surname).
- Normalize all dates to YYYY-MM-DD format regardless of original format.
- If a field is absent or illegible, use null.
- For bilingual documents extract from the English portion preferring official text.
- Do NOT invent or hallucinate values. If uncertain, use null.`;

  // For image/PDF documents, pass both text and image to Gemini for better accuracy
  const userContent = [];

  if (documentBuffer && (mimeType === 'image/jpeg' || mimeType === 'image/png')) {
    userContent.push({
      type:  'image_url',
      image_url: {
        url: `data:${mimeType};base64,${documentBuffer.toString('base64')}`,
      },
    });
  }

  userContent.push({
    type: 'text',
    text: `Extract fields from this marriage certificate.\n\nOCR Text:\n${rawText}`,
  });

  const response = await getGemini().invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage({ content: userContent }),
  ]);

  // Parse Gemini's JSON response safely
  let extracted;
  try {
    const cleaned = response.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    extracted = JSON.parse(cleaned);
  } catch {
    throw new Error(`Gemini returned unparseable JSON: ${response.content.slice(0, 200)}`);
  }

  return extracted;
}

/**
 * Document Processor Agent node for LangGraph.
 */
async function documentProcessorAgent(state) {
  const startTime = Date.now();
  const { request_id } = state.input_data;
  const { buffer, mime_type } = state.document;

  let ocrData;
  let extractedFields;

  try {
    // Step 1: Google Document AI OCR
    const encodedContent = buffer.toString('base64');

    const [result] = await docAIClient.processDocument({
      name:     PROCESSOR_NAME,
      rawDocument: {
        content:  encodedContent,
        mimeType: mime_type || 'application/pdf',
      },
    });

    ocrData = extractOCRData(result.document);

    // Step 2: Gemini structured extraction
    extractedFields = await extractFieldsWithGemini(
      ocrData.raw_text,
      mime_type,
      buffer
    );
  } catch (err) {
    await logAgentExecution({
      request_id,
      agent_name:    'DocumentProcessorAgent',
      input_data:    { mime_type, buffer_size: buffer?.length },
      output_data:   null,
      duration_ms:   Date.now() - startTime,
      status:        'ERROR',
      error_message: err.message,
    });
    throw err;
  }

  const output = { extracted_fields: extractedFields, ocr_data: ocrData };

  await logAgentExecution({
    request_id,
    agent_name:   'DocumentProcessorAgent',
    input_data:   { mime_type, buffer_size: buffer?.length },
    output_data:  output,
    duration_ms:  Date.now() - startTime,
    status:       'SUCCESS',
  });

  // Build the OCR confidence map (passed to Forgery Detection Agent)
  const ocrConfidenceMap = {
    overall:              ocrData.avg_confidence,
    minimum:              ocrData.min_confidence,
    low_confidence_ratio: ocrData.low_confidence_ratio,
    total_tokens:         ocrData.total_tokens,
  };

  return {
    extracted_fields:   extractedFields,
    ocr_confidence_map: ocrConfidenceMap,
  };
}

module.exports = { documentProcessorAgent };