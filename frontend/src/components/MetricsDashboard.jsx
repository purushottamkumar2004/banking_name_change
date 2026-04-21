// frontend/src/components/MetricsDashboard.jsx
// Displays live operational metrics from /metrics endpoint.
// Shown as a compact stat bar at the top of the Checker Dashboard.

import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function MetricsDashboard() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await axios.get('/metrics');
        setMetrics(data);
      } catch { /* metrics are non-critical */ }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  if (!metrics) return null;

  const stats = [
    { label: 'Today',          value: metrics.today,         color: 'var(--ink-700)' },
    { label: 'Pending Review', value: metrics.pending_review, color: 'var(--blue-700)',  bold: true },
    { label: 'Approved',       value: metrics.approved,       color: 'var(--green-600)' },
    { label: 'Rejected',       value: metrics.rejected,       color: 'var(--red-600)' },
    { label: 'Avg Score',      value: metrics.avg_score != null ? `${metrics.avg_score}%` : '—', color: 'var(--ink-500)' },
    { label: 'Avg Fraud',      value: metrics.avg_fraud_score != null ? metrics.avg_fraud_score : '—', color: 'var(--ink-500)' },
  ];

  return (
    <div style={{
      display: 'flex', gap: 0,
      background: '#fff',
      border: '1px solid var(--ink-100)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
      marginBottom: 20,
    }}>
      {stats.map((s, i) => (
        <div key={s.label} style={{
          flex: 1, padding: '14px 16px', textAlign: 'center',
          borderRight: i < stats.length - 1 ? '1px solid var(--ink-50)' : 'none',
        }}>
          <div style={{
            fontSize: '1.375rem', fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: s.color,
            lineHeight: 1,
          }}>
            {s.value ?? '—'}
          </div>
          <div style={{
            fontSize: '0.7rem', color: 'var(--ink-400)',
            marginTop: 4, letterSpacing: '0.04em',
          }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}
