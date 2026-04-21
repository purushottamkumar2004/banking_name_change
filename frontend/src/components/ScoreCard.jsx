// frontend/src/components/ScoreCard.jsx
// Renders the full Confidence Score Card as an interactive visual breakdown.
// Shows component scores as horizontal bars with weight annotations.

import React from 'react';

const COMPONENT_LABELS = {
  identity_consistency:  'Identity match',
  logical_consistency:   'Date logic',
  field_integrity:       'Field integrity',
  cross_field:           'Cross-field',
  visual_integrity:      'Visual integrity',
  metadata_integrity:    'Metadata integrity',
};

function Bar({ score, weight }) {
  const pct = score ?? 0;
  const color = pct >= 70 ? '#177a4e' : pct >= 40 ? '#b45309' : '#c0392b';
  const bgColor = pct >= 70 ? '#d6f0e4' : pct >= 40 ? '#fef3c7' : '#fde8e6';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 8, background: '#f4f5f8', borderRadius: 100, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: color, borderRadius: 100,
          transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '0.8125rem',
        fontWeight: 600, color, minWidth: 34, textAlign: 'right',
      }}>
        {pct}
      </span>
      <span style={{
        fontSize: '0.7rem', color: '#a0a4b0',
        minWidth: 28, textAlign: 'right',
        fontFamily: 'var(--font-mono)',
      }}>
        ×{weight}
      </span>
    </div>
  );
}

export default function ScoreCard({ scoreCard, penalties }) {
  if (!scoreCard) return null;

  const { overall_score, fraud_score, confidence_level, recommendation, components, penalties_applied } = scoreCard;
  const appliedPenalties = penalties_applied || penalties || [];

  const confColors = {
    HIGH:   { bg: '#d6f0e4', text: '#177a4e' },
    MEDIUM: { bg: '#fef3c7', text: '#b45309' },
    LOW:    { bg: '#fde8e6', text: '#c0392b' },
  };
  const cc = confColors[confidence_level] || confColors.LOW;

  const recColors = {
    APPROVE:       '#177a4e',
    REJECT:        '#c0392b',
    MANUAL_REVIEW: '#b45309',
  };

  return (
    <div>
      {/* Summary row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Overall score dial */}
        <div style={{
          flex: '1 1 100px', padding: '16px 12px', textAlign: 'center',
          background: '#f4f5f8', borderRadius: 10,
        }}>
          <div style={{
            fontSize: '2.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)',
            color: overall_score >= 70 ? '#177a4e' : overall_score >= 40 ? '#b45309' : '#c0392b',
            lineHeight: 1,
          }}>
            {overall_score ?? '—'}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#a0a4b0', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Score
          </div>
        </div>

        {/* Fraud score */}
        <div style={{ flex: '1 1 100px', padding: '16px 12px', textAlign: 'center', background: '#f4f5f8', borderRadius: 10 }}>
          <div style={{
            fontSize: '2.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)',
            color: (fraud_score || 0) > 50 ? '#c0392b' : (fraud_score || 0) > 25 ? '#b45309' : '#177a4e',
            lineHeight: 1,
          }}>
            {fraud_score ?? '—'}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#a0a4b0', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Fraud Score
          </div>
        </div>

        {/* Confidence level */}
        <div style={{ flex: '1 1 100px', padding: '16px 12px', textAlign: 'center', background: cc.bg, borderRadius: 10 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: cc.text, lineHeight: 1 }}>
            {confidence_level || '—'}
          </div>
          <div style={{ fontSize: '0.7rem', color: cc.text, opacity: 0.7, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Confidence
          </div>
        </div>
      </div>

      {/* Component breakdown */}
      {components && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#a0a4b0', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
            Score Breakdown
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(components).map(([key, val]) => (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: '0.8125rem', color: '#5c6070' }}>{COMPONENT_LABELS[key] || key}</span>
                </div>
                <Bar score={val.score} weight={val.weight} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI recommendation */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderRadius: 8,
        background: recommendation === 'APPROVE' ? '#f0faf6' : recommendation === 'REJECT' ? '#fff5f4' : '#fffbeb',
        border: `1px solid ${recommendation === 'APPROVE' ? '#d6f0e4' : recommendation === 'REJECT' ? '#fde8e6' : '#fef3c7'}`,
        marginBottom: appliedPenalties.length > 0 ? 12 : 0,
      }}>
        <span style={{ fontSize: '0.8125rem', color: '#5c6070' }}>AI Recommendation</span>
        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: recColors[recommendation] || '#5c6070' }}>
          {recommendation || '—'}
        </span>
      </div>

      {/* Penalties */}
      {appliedPenalties.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#a0a4b0', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
            Penalties Applied
          </div>
          {appliedPenalties.map((p, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              padding: '6px 0', borderBottom: i < appliedPenalties.length - 1 ? '1px solid #f4f5f8' : 'none',
            }}>
              <span style={{ fontSize: '0.8125rem', color: '#5c6070', flex: 1 }}>{p.detail}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 600, color: '#c0392b', marginLeft: 8, whiteSpace: 'nowrap' }}>
                +{p.penalty}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
