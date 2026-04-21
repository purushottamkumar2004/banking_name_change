import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: 420, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>404</div>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--ink-900)', marginBottom: 8 }}>
        Page not found
      </h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--ink-500)', marginBottom: 24 }}>
        The page you're looking for doesn't exist or was moved.
      </p>
      <button
        onClick={() => navigate('/')}
        style={{
          padding: '10px 24px', fontSize: '0.875rem', fontWeight: 600,
          color: '#fff', background: 'var(--blue-500)', border: 'none',
          borderRadius: 'var(--radius-sm)', cursor: 'pointer',
        }}
      >
        Go home
      </button>
    </div>
  );
}
