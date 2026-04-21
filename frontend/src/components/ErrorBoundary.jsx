import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          maxWidth: 480, margin: '60px auto', padding: '32px 24px',
          background: '#fff', border: '1px solid var(--ink-100)',
          borderRadius: 'var(--radius-lg)', textAlign: 'center',
          boxShadow: 'var(--shadow-md)',
        }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--ink-900)', marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--ink-500)', marginBottom: 20 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{
              padding: '9px 20px', fontSize: '0.875rem', fontWeight: 600,
              color: '#fff', background: 'var(--blue-500)',
              border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
