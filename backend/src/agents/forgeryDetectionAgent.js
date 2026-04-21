// backend/src/agents/forgeryDetectionAgent.js
// Agent 3b: Forgery Detection Agent (runs in PARALLEL with field validation)
//
// Performs weak-signal forensic analysis without heavy ML models.
// Three signal categories:
//   1. OCR Confidence Anomaly — unusually low confidence in specific regions
//   2. Metadata Risk — analysed via buffer header inspection
//   3. Image Consistency — pixel-level checks (basic heuristics)
//
// IMPORTANT: These are heuristic signals, not ground truth.
// Low scores raise flags; final decision is always human.

const { logAgentExecution } = require('./auditLogger');

// ── 1. OCR Confidence Anomaly Detection ──────────────────────────────────────

/**
 * Analyses the OCR confidence map for anomalous patterns.
 * A legitimate document typically has uniform high confidence across all tokens.
 * Localised drops may indicate altered regions.
 */
function analyseOCRConfidence(ocrConfidenceMap) {
  const signals = [];
  let score = 1.0;  // 1.0 = clean, lower = more suspicious

  if (!ocrConfidenceMap) {
    return { score: 0.5, signals: ['OCR confidence data unavailable'] };
  }

  const { overall, minimum, low_confidence_ratio, total_tokens } = ocrConfidenceMap;

  // Overall confidence below threshold
  if (overall < 0.75) {
    score -= 0.3;
    signals.push(`Low overall OCR confidence: ${(overall * 100).toFixed(1)}%`);
  } else if (overall < 0.85) {
    score -= 0.1;
    signals.push(`Moderate OCR confidence: ${(overall * 100).toFixed(1)}%`);
  }

  // Unusually low minimum confidence (single very bad region)
  if (minimum < 0.4) {
    score -= 0.3;
    signals.push(`Very low minimum token confidence (${(minimum * 100).toFixed(1)}%) — possible altered region`);
  } else if (minimum < 0.6) {
    score -= 0.1;
    signals.push(`Low minimum confidence in at least one region (${(minimum * 100).toFixed(1)}%)`);
  }

  // High proportion of low-confidence tokens
  if (low_confidence_ratio > 0.2) {
    score -= 0.25;
    signals.push(`${(low_confidence_ratio * 100).toFixed(1)}% of tokens have low confidence — document may be low quality or tampered`);
  } else if (low_confidence_ratio > 0.1) {
    score -= 0.1;
    signals.push(`${(low_confidence_ratio * 100).toFixed(1)}% of tokens have below-threshold confidence`);
  }

  // Very few tokens (partial document, torn, or obscured)
  if (total_tokens < 20) {
    score -= 0.2;
    signals.push(`Very few OCR tokens detected (${total_tokens}) — document may be partially visible`);
  }

  return { score: Math.max(0, score), signals };
}

// ── 2. Metadata Risk Analysis ─────────────────────────────────────────────────

/**
 * Inspects file buffer for metadata anomalies.
 * Checks EXIF/JPEG markers, PDF version headers, and modification indicators.
 * This is a heuristic — not a full forensic tool.
 */
function analyseMetadata(buffer, mimeType) {
  const signals = [];
  let score = 1.0;

  if (!buffer) {
    return { score: 0.5, signals: ['Document buffer unavailable for metadata analysis'] };
  }

  const header = buffer.slice(0, 16).toString('hex').toUpperCase();

  if (mimeType === 'application/pdf' || mimeType?.includes('pdf')) {
    const pdfHeader = buffer.slice(0, 8).toString('ascii');
    if (!pdfHeader.startsWith('%PDF')) {
      score -= 0.4;
      signals.push('File does not start with valid PDF header — possible format mismatch');
    }

    // Check for JavaScript in PDF (common in forgery tools)
    const pdfText = buffer.toString('latin1');
    if (pdfText.includes('/JavaScript') || pdfText.includes('/JS ')) {
      score -= 0.3;
      signals.push('PDF contains JavaScript — unusual for government certificates');
    }

    // Check for multiple versions (incremental updates = possible editing)
    const versionMatches = (pdfText.match(/%%EOF/g) || []).length;
    if (versionMatches > 1) {
      score -= 0.2;
      signals.push(`PDF has ${versionMatches} revisions (%%EOF markers) — document may have been edited`);
    }

    // Check for known editing tool signatures
    const editingTools = ['Adobe Acrobat', 'iLovePDF', 'Smallpdf', 'PDFescape', 'DocHub'];
    const foundTool = editingTools.find(t => pdfText.includes(t));
    if (foundTool) {
      // Not inherently fraudulent but worth flagging
      signals.push(`PDF was processed by "${foundTool}" — minor risk flag`);
      score -= 0.05;
    }
  }

  if (mimeType === 'image/jpeg' || mimeType?.includes('jpeg') || mimeType?.includes('jpg')) {
    // JPEG should start with FFD8FF
    if (!header.startsWith('FFD8FF')) {
      score -= 0.3;
      signals.push('JPEG magic bytes invalid — file may be misrepresented');
    }
  }

  if (mimeType === 'image/png' || mimeType?.includes('png')) {
    // PNG should start with 89504E47
    if (!header.startsWith('89504E47')) {
      score -= 0.3;
      signals.push('PNG magic bytes invalid');
    }
  }

  return { score: Math.max(0, score), signals };
}

// ── 3. Image Consistency Check ────────────────────────────────────────────────

/**
 * Basic image consistency heuristics without heavy image processing libraries.
 * In production, this could use sharp or opencv4nodejs for deeper analysis.
 */
function analyseImageConsistency(buffer, mimeType) {
  const signals = [];
  let score = 1.0;

  if (!buffer) {
    return { score: 0.5, signals: ['Buffer unavailable for image analysis'] };
  }

  // File size heuristic: extremely small files for "images" are suspicious
  const sizeKB = buffer.length / 1024;

  if (mimeType?.includes('pdf')) {
    if (sizeKB < 10) {
      score -= 0.2;
      signals.push(`PDF is unusually small (${sizeKB.toFixed(1)} KB) — may be a generated/altered document`);
    }
  } else if (mimeType?.startsWith('image/')) {
    if (sizeKB < 20) {
      score -= 0.3;
      signals.push(`Image is very small (${sizeKB.toFixed(1)} KB) — may be low quality or screenshot`);
    } else if (sizeKB > 15000) {
      // Extremely large files are usually fine but worth noting
      signals.push(`Image is unusually large (${(sizeKB / 1024).toFixed(1)} MB)`);
    }
  }

  // Look for suspicious byte patterns common in copy-paste forgeries
  // (repeating 0x00 blocks in image data can indicate areas of solid color replacement)
  const nullBlockSize = 512;
  let nullBlocks = 0;
  for (let i = 1000; i < Math.min(buffer.length - nullBlockSize, 50000); i += 1000) {
    const block = buffer.slice(i, i + nullBlockSize);
    if (block.every(b => b === 0x00)) nullBlocks++;
  }

  if (nullBlocks > 3) {
    score -= 0.15;
    signals.push(`Detected ${nullBlocks} null byte blocks in image data — possible area erasure`);
  }

  return { score: Math.max(0, score), signals };
}

// ── Main Agent ────────────────────────────────────────────────────────────────

async function forgeryDetectionAgent(state) {
  const startTime = Date.now();
  const { request_id } = state.input_data;
  const { buffer, mime_type } = state.document;

  const ocrAnalysis   = analyseOCRConfidence(state.ocr_confidence_map);
  const metaAnalysis  = analyseMetadata(buffer, mime_type);
  const imageAnalysis = analyseImageConsistency(buffer, mime_type);

  const fraud_results = {
    ocr_anomaly_score:    ocrAnalysis.score,
    metadata_risk_score:  metaAnalysis.score,
    image_tampering_score: imageAnalysis.score,

    signals: [
      ...ocrAnalysis.signals.map(s   => ({ type: 'OCR_ANOMALY',    detail: s, score: ocrAnalysis.score })),
      ...metaAnalysis.signals.map(s  => ({ type: 'METADATA_RISK',  detail: s, score: metaAnalysis.score })),
      ...imageAnalysis.signals.map(s => ({ type: 'IMAGE_TAMPER',   detail: s, score: imageAnalysis.score })),
    ],

    // Composite: worst-case wins (minimum of all three)
    composite_integrity_score: Math.min(
      ocrAnalysis.score,
      metaAnalysis.score,
      imageAnalysis.score,
    ),
  };

  await logAgentExecution({
    request_id,
    agent_name:  'ForgeryDetectionAgent',
    input_data:  { ocr_confidence_map: state.ocr_confidence_map, mime_type },
    output_data: fraud_results,
    duration_ms: Date.now() - startTime,
    status:      'SUCCESS',
  });

  return { fraud_results };
}

module.exports = { forgeryDetectionAgent };
