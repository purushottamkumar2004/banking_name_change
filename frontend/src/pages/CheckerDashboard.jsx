import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRequests } from '../api/client';
import MetricsDashboard from '../components/MetricsDashboard';

const STATUS_COLORS = {
  PROCESSING:               { bg: 'var(--amber-50)',  text: 'var(--amber-600)', dot: '#f59e0b' },
  AI_VERIFIED_PENDING_HUMAN:{ bg: 'var(--blue-50)',   text: 'var(--blue-700)',  dot: '#3b82f6' },
  APPROVED:                 { bg: 'var(--green-50)',  text: 'var(--green-600)', dot: '#10b981' },
  REJECTED:                 { bg: 'var(--red-50)',    text: 'var(--red-600)',   dot: '#ef4444' },
  FAILED:                   { bg: 'var(--ink-50)',    text: 'var(--ink-500)',   dot: '#9ca3af' },
};

const STATUS_LABELS = {
  PROCESSING:                'Processing',
  AI_VERIFIED_PENDING_HUMAN: 'Pending Review',
  APPROVED:                  'Approved',
  REJECTED:                  'Rejected',
  FAILED:                    'Failed',
};

const CONFIDENCE_COLORS = {
  HIGH:   'var(--green-600)',
  MEDIUM: 'var(--amber-600)',
  LOW:    'var(--red-600)',
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.FAILED;
  return (
    <span style={{
      background: c.bg,
      color: c.text,
      fontSize: '0.75rem',
      fontWeight: 500,
      padding: '3px 10px',
      borderRadius: 100,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, display: 'inline-block' }} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function ScorePill({ score, level }) {
  if (score == null) return <span style={{ color: 'var(--ink-300)', fontSize: '0.8125rem' }}>—</span>;
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '0.8125rem',
      fontWeight: 500,
      color: CONFIDENCE_COLORS[level] || 'var(--ink-500)',
    }}>
      {score}%
    </span>
  );
}

const FILTERS = ['ALL', 'AI_VERIFIED_PENDING_HUMAN', 'APPROVED', 'REJECTED', 'PROCESSING'];

export default function CheckerDashboard() {
  const navigate = useNavigate();

  const [data, setData]       = useState({ requests: [], total: 0 });
  const [filter, setFilter]   = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (filter !== 'ALL') params.status = filter;
      const result = await getRequests(params);
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 5s to pick up PROCESSING → PENDING transitions
  useEffect(() => {
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div style={{ maxWidth: 1000, margin: '40px auto', padding: '0 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 600, color: 'var(--ink-900)', letterSpacing: '-0.02em' }}>
            Checker Dashboard
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--ink-500)', marginTop: 2 }}>
            {data.total} total request{data.total !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          style={{
            padding: '8px 16px', fontSize: '0.8125rem', fontWeight: 500,
            background: 'var(--ink-50)', border: '1px solid var(--ink-100)',
            borderRadius: 'var(--radius-sm)', color: 'var(--ink-700)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
          onClick={load}
        >
          ↻ Refresh
        </button>
      </div>

      <MetricsDashboard />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            style={{
              padding: '6px 14px',
              fontSize: '0.8125rem',
              fontWeight: 500,
              borderRadius: 100,
              border: filter === f ? '1.5px solid var(--blue-500)' : '1.5px solid var(--ink-100)',
              background: filter === f ? 'var(--blue-50)' : '#fff',
              color: filter === f ? 'var(--blue-700)' : 'var(--ink-500)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {f === 'ALL' ? 'All' : STATUS_LABELS[f] || f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{
        background: '#fff',
        border: '1px solid var(--ink-100)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
      }}>
        {loading && data.requests.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-300)' }}>Loading…</div>
        ) : data.requests.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-300)' }}>No requests found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--ink-100)' }}>
                {['Customer ID', 'Name Change', 'Status', 'Score', 'Submitted', ''].map(h => (
                  <th key={h} style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--ink-300)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    background: 'var(--ink-50)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.requests.map((req, i) => (
                <tr
                  key={req.id}
                  style={{
                    borderBottom: i < data.requests.length - 1 ? '1px solid var(--ink-50)' : 'none',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-50)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                  onClick={() => navigate(`/checker/${req.id}`)}
                >
                  <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--ink-700)' }}>
                    {req.customer_id}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--ink-700)', fontWeight: 500 }}>
                      {req.old_name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--ink-400)', marginTop: 2 }}>
                      → {req.new_name}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <StatusBadge status={req.status} />
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <ScorePill score={req.overall_score} level={req.confidence_level} />
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '0.8125rem', color: 'var(--ink-400)' }}>
                    {new Date(req.created_at).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--blue-500)' }}>Review →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data.total > 20 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--ink-100)', background: '#fff', color: page === 1 ? 'var(--ink-300)' : 'var(--ink-700)', cursor: page === 1 ? 'default' : 'pointer' }}
          >
            ← Prev
          </button>
          <span style={{ padding: '8px 12px', fontSize: '0.875rem', color: 'var(--ink-500)' }}>
            Page {page} of {Math.ceil(data.total / 20)}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(data.total / 20)}
            style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--ink-100)', background: '#fff', color: 'var(--ink-700)', cursor: 'pointer' }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
