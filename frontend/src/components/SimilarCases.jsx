// frontend/src/components/SimilarCases.jsx
// Displays similar historical verification cases fetched from Chroma.
// Helps the human checker make consistent decisions.

import React from 'react';

const DECISION_STYLE = {
  APPROVED: { color: '#177a4e', bg: '#f0faf6', icon: '✓' },
  REJECTED: { color: '#c0392b', bg: '#fff5f4', icon: '✗' },
};

export default function SimilarCases({ cases, summary }) {
  if (!cases?.length) return null;

  return (
    <div>
      {summary && (
        <div style={{
          fontSize: '0.875rem', color: '#2d3142', marginBottom: 14,
          padding: '10px 12px', background: '#f0f3ff',
          borderRadius: 8, borderLeft: '3px solid #2d5be3',
        }}>
          {summary}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {cases.map((c, i) => {
          const ds = DECISION_STYLE[c.human_decision] || DECISION_STYLE.REJECTED;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8,
              border: '1px solid #e8eaf0', background: '#fff',
            }}>
              {/* Decision badge */}
              <span style={{
                width: 22, height: 22, borderRadius: '50%',
                background: ds.bg, color: ds.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
              }}>
                {ds.icon}
              </span>

              {/* Scores */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontSize: '0.75rem', color: '#a0a4b0' }}>Score</span>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#2d3142' }}>
                    {c.overall_score ?? '—'}%
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#a0a4b0' }}>Fraud</span>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#2d3142' }}>
                    {c.fraud_score ?? '—'}
                  </span>
                </div>
              </div>

              {/* Similarity */}
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  fontSize: '0.7rem', fontFamily: 'var(--font-mono)',
                  color: '#a0a4b0', background: '#f4f5f8',
                  padding: '2px 6px', borderRadius: 4,
                }}>
                  {c.similarity_pct}% similar
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
