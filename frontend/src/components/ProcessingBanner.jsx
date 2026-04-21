// frontend/src/components/ProcessingBanner.jsx
// Shows animated pipeline stage progress while the request is PROCESSING.
// Gives the checker real-time feedback on which agent is running.

import React, { useState, useEffect } from 'react';

const STAGES = [
  { id: 'intake',    label: 'Intake validation',      icon: '✓', ms: 500  },
  { id: 'ocr',       label: 'Document OCR',            icon: '📄', ms: 3000 },
  { id: 'extract',   label: 'Field extraction',        icon: '🔍', ms: 5000 },
  { id: 'validate',  label: 'Field validation',        icon: '⚖',  ms: 7000 },
  { id: 'forgery',   label: 'Forgery detection',       icon: '🛡',  ms: 7000 },
  { id: 'score',     label: 'Confidence scoring',      icon: '📊', ms: 9000 },
  { id: 'summary',   label: 'Generating summary',      icon: '💬', ms: 11000 },
];

export default function ProcessingBanner({ startedAt }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = startedAt ? new Date(startedAt).getTime() : Date.now();
    const t = setInterval(() => setElapsed(Date.now() - start), 300);
    return () => clearInterval(t);
  }, [startedAt]);

  return (
    <div style={{
      background: '#f0f3ff',
      border: '1px solid #c7d2fe',
      borderRadius: 'var(--radius-md)',
      padding: '16px 20px',
      marginBottom: 20,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 14,
      }}>
        <span style={{
          display: 'inline-block', width: 8, height: 8,
          borderRadius: '50%', background: 'var(--blue-500)',
          animation: 'pulse 1.2s ease-in-out infinite',
        }} />
        <style>{`@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.4)} }`}</style>
        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--blue-700)' }}>
          AI pipeline running — {(elapsed / 1000).toFixed(1)}s
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {STAGES.map((stage) => {
          const done    = elapsed > stage.ms;
          const active  = !done && elapsed > stage.ms - 2000;

          return (
            <div key={stage.id} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 100,
              fontSize: '0.75rem', fontWeight: 500,
              background: done ? '#d6f0e4' : active ? '#e6ebff' : '#f4f5f8',
              color: done ? '#177a4e' : active ? '#1a3fcc' : '#a0a4b0',
              transition: 'all 0.3s',
              border: active ? '1px solid #c7d2fe' : '1px solid transparent',
            }}>
              {done ? '✓' : active ? '⋯' : stage.icon}
              {stage.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
