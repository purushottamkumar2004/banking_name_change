import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRequest, getDocumentUrl, approveRequest, rejectRequest, getScoreCard } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import ScoreCard from '../components/ScoreCard';
import SimilarCases from '../components/SimilarCases';
import ProcessingBanner from '../components/ProcessingBanner';

// ── Small reusable pieces ─────────────────────────────────────────────────────

function Section({ title, action, children }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--ink-100)',
      borderRadius: 'var(--radius-lg)', padding: 24,
      boxShadow: 'var(--shadow-sm)', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--ink-300)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ status }) {
  const MAP = {
    PROCESSING:                { bg: 'var(--amber-50)',  text: 'var(--amber-600)',  label: 'Processing' },
    AI_VERIFIED_PENDING_HUMAN: { bg: 'var(--blue-50)',   text: 'var(--blue-700)',   label: 'Pending Review' },
    APPROVED:                  { bg: 'var(--green-50)',  text: 'var(--green-600)',  label: 'Approved' },
    REJECTED:                  { bg: 'var(--red-50)',    text: 'var(--red-600)',    label: 'Rejected' },
    FAILED:                    { bg: 'var(--ink-50)',    text: 'var(--ink-500)',    label: 'Failed' },
  };
  const s = MAP[status] || MAP.FAILED;
  return (
    <span style={{ background: s.bg, color: s.text, fontSize: '0.8125rem', fontWeight: 600, padding: '5px 14px', borderRadius: 100 }}>
      {s.label}
    </span>
  );
}

function ScoreBar({ score }) {
  const pct = score ?? 0;
  const color = pct >= 70 ? '#177a4e' : pct >= 40 ? '#b45309' : '#c0392b';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--ink-100)', borderRadius: 100, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 100, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600, color, minWidth: 28, textAlign: 'right' }}>
        {pct}
      </span>
    </div>
  );
}

function FieldRow({ field_name, extracted_value, score, status, reason }) {
  const statusColor = status === 'PASS' ? '#177a4e' : status === 'FAIL' ? '#c0392b' : '#b45309';
  const statusIcon  = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '150px 1fr 130px 20px',
      gap: 12, alignItems: 'start', padding: '10px 0',
      borderBottom: '1px solid var(--ink-50)',
    }}>
      <div style={{ fontSize: '0.8125rem', color: 'var(--ink-500)', paddingTop: 1 }}>
        {field_name?.replace(/_/g, ' ')}
      </div>
      <div>
        <div style={{ fontSize: '0.875rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-800)', wordBreak: 'break-all' }}>
          {extracted_value || <span style={{ color: 'var(--ink-300)', fontFamily: 'var(--font-sans)' }}>Not found</span>}
        </div>
        {reason && (
          <div style={{ fontSize: '0.75rem', color: 'var(--ink-400)', marginTop: 3, lineHeight: 1.4 }}>{reason}</div>
        )}
      </div>
      <ScoreBar score={score} />
      <div style={{ textAlign: 'center', fontWeight: 700, color: statusColor, paddingTop: 1 }}>{statusIcon}</div>
    </div>
  );
}

function FraudRow({ signal_type, severity, details, score }) {
  const sevMap = {
    HIGH:   { color: '#c0392b', bg: '#fde8e6' },
    MEDIUM: { color: '#b45309', bg: '#fef3c7' },
    LOW:    { color: '#5c6070', bg: 'var(--ink-50)' },
  };
  const sc = sevMap[severity] || sevMap.LOW;
  return (
    <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--ink-50)', alignItems: 'flex-start' }}>
      <span style={{
        fontSize: '0.7rem', fontWeight: 700, color: sc.color, background: sc.bg,
        padding: '2px 8px', borderRadius: 100, marginTop: 2, whiteSpace: 'nowrap',
      }}>
        {severity}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-500)', marginBottom: 2 }}>
          {signal_type?.replace(/_/g, ' ')}
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--ink-700)' }}>{details}</div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function RequestDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();

  // Poll the API — stops automatically on terminal status
  const fetcher = useCallback(() => getRequest(id), [id]);
  const { data, loading, error: pollError, refresh } = usePolling(fetcher, 3000, 80);

  const [docUrl, setDocUrl]           = useState(null);
  const [scoreCard, setScoreCard]     = useState(null);
  const [docLoading, setDocLoading]   = useState(false);
  const [action, setAction]           = useState(null);
  const [checkerId, setCheckerId]     = useState('');
  const [notes, setNotes]             = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Fetch full scorecard (with component breakdown) when detail is loaded
  React.useEffect(() => {
    if (data?.request?.status && data.request.status !== 'PROCESSING') {
      getScoreCard(id).then(setScoreCard).catch(() => {});
    }
  }, [data?.request?.status, id]);

  const loadDoc = async () => {
    if (docUrl) return;
    setDocLoading(true);
    try { setDocUrl(await getDocumentUrl(id)); } catch {} finally { setDocLoading(false); }
  };

  const handleApprove = async () => {
    if (!checkerId.trim()) return setActionError('Checker ID is required');
    setActionLoading(true); setActionError(null);
    try {
      await approveRequest(id, { checker_id: checkerId.trim(), notes: notes.trim() });
      refresh(); setAction(null);
    } catch (err) { setActionError(err.response?.data?.error || 'Action failed'); }
    finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    if (!checkerId.trim())    return setActionError('Checker ID is required');
    if (!rejectReason.trim()) return setActionError('Rejection reason is required');
    setActionLoading(true); setActionError(null);
    try {
      await rejectRequest(id, { checker_id: checkerId.trim(), reason: rejectReason.trim() });
      refresh(); setAction(null);
    } catch (err) { setActionError(err.response?.data?.error || 'Action failed'); }
    finally { setActionLoading(false); }
  };

  if (loading) return (
    <div style={{ padding: 64, textAlign: 'center', color: 'var(--ink-300)', fontSize: '0.875rem' }}>
      Loading request…
    </div>
  );

  if (pollError && !data) return (
    <div style={{ padding: 64, textAlign: 'center', color: 'var(--red-600)', fontSize: '0.875rem' }}>
      Error: {pollError}
    </div>
  );

  const { request, field_scores = [], fraud_signals = [], audit_logs = [], similar_cases = [], similar_cases_summary } = data || {};
  if (!request) return null;

  const isPending    = request.status === 'AI_VERIFIED_PENDING_HUMAN';
  const isProcessing = request.status === 'PROCESSING';
  const isActioned   = request.status === 'APPROVED' || request.status === 'REJECTED';

  // Use fetched scoreCard (with component breakdown) or fall back to flat columns
  const displayScoreCard = scoreCard || (request.overall_score != null ? {
    overall_score:    request.overall_score,
    fraud_score:      request.fraud_score,
    confidence_level: request.confidence_level,
    recommendation:   request.recommendation,
  } : null);

  const inp = { padding: '9px 12px', fontSize: '0.875rem', border: '1.5px solid var(--ink-100)', borderRadius: 'var(--radius-sm)', background: 'var(--ink-50)', width: '100%', outline: 'none', fontFamily: 'var(--font-sans)' };

  return (
    <div style={{ maxWidth: 980, margin: '32px auto', padding: '0 24px' }}>

      {/* Back */}
      <button onClick={() => navigate('/checker')} style={{ background: 'none', border: 'none', color: 'var(--blue-500)', fontSize: '0.875rem', cursor: 'pointer', marginBottom: 20, padding: 0 }}>
        ← Back to Dashboard
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--ink-900)', letterSpacing: '-0.02em', marginBottom: 4 }}>
            {request.old_name} <span style={{ color: 'var(--ink-300)', fontWeight: 400 }}>→</span> {request.new_name}
          </h1>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--ink-500)', fontFamily: 'var(--font-mono)' }}>{request.customer_id}</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--ink-300)' }}>·</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--ink-400)', fontFamily: 'var(--font-mono)' }}>{id.slice(0, 8)}…</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--ink-300)' }}>·</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--ink-400)' }}>
              {new Date(request.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
        <StatusBadge status={request.status} />
      </div>

      {/* Processing banner */}
      {isProcessing && <ProcessingBanner startedAt={request.created_at} />}

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>

        {/* ── LEFT ─────────────────────────────────────────────────────────── */}
        <div>

          {/* AI Summary */}
          {request.ai_summary && (
            <Section title="AI Summary">
              <p style={{ fontSize: '0.9375rem', color: 'var(--ink-700)', lineHeight: 1.7, margin: 0 }}>
                {request.ai_summary}
              </p>
            </Section>
          )}

          {/* Extracted Fields */}
          {field_scores.length > 0 && (
            <Section title={`Extracted Fields (${field_scores.length})`}>
              {field_scores.map(fs => <FieldRow key={fs.id} {...fs} />)}
            </Section>
          )}

          {/* Fraud Signals */}
          <Section title={`Fraud & Integrity Signals${fraud_signals.length ? ` · ${fraud_signals.length} found` : ''}`}>
            {fraud_signals.length > 0
              ? fraud_signals.map(s => <FraudRow key={s.id} {...s} />)
              : <div style={{ fontSize: '0.875rem', color: 'var(--green-600)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>✓</span> No significant fraud signals detected
                </div>
            }
          </Section>

          {/* Similar Cases (Chroma) */}
          {similar_cases.length > 0 && (
            <Section title="Similar Historical Cases">
              <SimilarCases cases={similar_cases} summary={similar_cases_summary} />
            </Section>
          )}

          {/* Agent Audit Trail */}
          {audit_logs.length > 0 && (
            <Section title="Agent Execution Trail">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {audit_logs.map((log, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0', borderBottom: i < audit_logs.length - 1 ? '1px solid var(--ink-50)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, color: log.status === 'SUCCESS' ? '#177a4e' : '#c0392b' }}>●</span>
                      <span style={{ fontSize: '0.875rem', color: 'var(--ink-700)' }}>{log.agent_name}</span>
                      {log.error_message && (
                        <span style={{ fontSize: '0.75rem', color: '#c0392b' }}>{log.error_message}</span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--ink-400)', fontFamily: 'var(--font-mono)' }}>
                      {log.duration_ms != null ? `${log.duration_ms}ms` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* ── RIGHT ────────────────────────────────────────────────────────── */}
        <div style={{ position: 'sticky', top: 72 }}>

          {/* Score Card */}
          {displayScoreCard && (
            <Section title="Confidence Score Card">
              <ScoreCard scoreCard={displayScoreCard} />
            </Section>
          )}

          {/* Document Preview */}
          <Section title="Document" action={
            !docUrl && (
              <button onClick={loadDoc} style={{ fontSize: '0.75rem', color: 'var(--blue-500)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {docLoading ? 'Loading…' : 'Load preview'}
              </button>
            )
          }>
            {docUrl
              ? <a href={docUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--ink-50)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', color: 'var(--blue-500)', textDecoration: 'none' }}>
                  <span>📄</span> Open document ↗
                </a>
              : <div style={{ fontSize: '0.8125rem', color: 'var(--ink-300)', textAlign: 'center', padding: '12px 0' }}>
                  Click "Load preview" to fetch document URL
                </div>
            }
          </Section>

          {/* ── HITL ACTION PANEL ────────────────────────────────────────── */}
          {isPending && (
            <Section title="Checker Decision">
              <p style={{ fontSize: '0.8125rem', color: 'var(--ink-500)', marginBottom: 16, lineHeight: 1.6 }}>
                Review all evidence carefully. This action is final, logged, and auditable.
              </p>

              {/* Checker ID — always visible */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--ink-700)', marginBottom: 5 }}>Your Checker ID *</label>
                <input value={checkerId} onChange={e => setCheckerId(e.target.value)} placeholder="e.g. CHK001" style={inp} />
              </div>

              {/* Conditional fields based on chosen action */}
              {action === 'approve' && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--ink-700)', marginBottom: 5 }}>Notes (optional)</label>
                  <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any observations…" style={inp} />
                </div>
              )}

              {action === 'reject' && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--ink-700)', marginBottom: 5 }}>Rejection Reason *</label>
                  <textarea
                    value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                    placeholder="Explain why this request is being rejected…"
                    rows={3}
                    style={{ ...inp, resize: 'vertical' }}
                  />
                </div>
              )}

              {actionError && (
                <div style={{ background: 'var(--red-50)', color: 'var(--red-600)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', marginBottom: 12 }}>
                  {actionError}
                </div>
              )}

              {/* Action buttons */}
              {!action ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setAction('approve'); setActionError(null); }} style={{ flex: 1, padding: '10px', fontWeight: 600, fontSize: '0.875rem', color: '#177a4e', background: 'var(--green-50)', border: '1.5px solid var(--green-100)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                    ✓ Approve
                  </button>
                  <button onClick={() => { setAction('reject'); setActionError(null); }} style={{ flex: 1, padding: '10px', fontWeight: 600, fontSize: '0.875rem', color: '#c0392b', background: 'var(--red-50)', border: '1.5px solid var(--red-100)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                    ✗ Reject
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={action === 'approve' ? handleApprove : handleReject}
                    disabled={actionLoading}
                    style={{
                      flex: 1, padding: '10px', fontWeight: 600, fontSize: '0.875rem', color: '#fff',
                      background: action === 'approve' ? '#177a4e' : '#c0392b',
                      border: 'none', borderRadius: 'var(--radius-sm)',
                      cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.7 : 1,
                    }}
                  >
                    {actionLoading ? '…' : action === 'approve' ? '✓ Confirm Approve' : '✗ Confirm Reject'}
                  </button>
                  <button onClick={() => { setAction(null); setActionError(null); }} style={{ padding: '10px 14px', fontSize: '0.875rem', background: 'var(--ink-50)', border: '1px solid var(--ink-100)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--ink-500)' }}>
                    Cancel
                  </button>
                </div>
              )}
            </Section>
          )}

          {/* Final decision display */}
          {isActioned && (
            <Section title="Decision">
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{request.status === 'APPROVED' ? '✅' : '❌'}</div>
                <div style={{ fontWeight: 600, fontSize: '1rem', color: request.status === 'APPROVED' ? '#177a4e' : '#c0392b' }}>
                  {request.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                </div>
                {request.action_by && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--ink-500)', marginTop: 6 }}>
                    by <strong>{request.action_by}</strong>
                    {request.action_at && <> · {new Date(request.action_at).toLocaleDateString('en-IN')}</>}
                  </div>
                )}
                {request.rejection_reason && (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--red-50)', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', color: '#c0392b', fontStyle: 'italic' }}>
                    "{request.rejection_reason}"
                  </div>
                )}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
