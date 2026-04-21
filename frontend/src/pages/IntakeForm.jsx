import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { submitRequest } from '../api/client';

const s = {
  page: {
    maxWidth: 560,
    margin: '48px auto',
    padding: '0 24px',
  },
  heading: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: 'var(--ink-900)',
    letterSpacing: '-0.02em',
    marginBottom: 4,
  },
  sub: {
    fontSize: '0.875rem',
    color: 'var(--ink-500)',
    marginBottom: 32,
  },
  card: {
    background: '#fff',
    border: '1px solid var(--ink-100)',
    borderRadius: 'var(--radius-lg)',
    padding: '32px',
    boxShadow: 'var(--shadow-sm)',
  },
  label: {
    display: 'block',
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: 'var(--ink-700)',
    marginBottom: 6,
    letterSpacing: '0.01em',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    fontSize: '0.9375rem',
    border: '1.5px solid var(--ink-100)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--ink-50)',
    color: 'var(--ink-900)',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    outline: 'none',
  },
  fieldGroup: { marginBottom: 20 },
  divider: {
    height: 1,
    background: 'var(--ink-100)',
    margin: '24px 0',
  },
  dropzone: (active, hasFile) => ({
    border: `2px dashed ${active ? 'var(--blue-500)' : hasFile ? 'var(--green-600)' : 'var(--ink-200)'}`,
    borderRadius: 'var(--radius-md)',
    padding: '32px 24px',
    textAlign: 'center',
    cursor: 'pointer',
    background: active ? 'var(--blue-50)' : hasFile ? 'var(--green-50)' : 'var(--ink-50)',
    transition: 'all 0.2s',
  }),
  dropIcon: { fontSize: 28, marginBottom: 8 },
  dropText: { fontSize: '0.875rem', color: 'var(--ink-500)', marginBottom: 4 },
  dropHint: { fontSize: '0.75rem', color: 'var(--ink-300)' },
  fileName: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--green-600)',
    marginTop: 8,
    fontFamily: 'var(--font-mono)',
  },
  btn: {
    width: '100%',
    padding: '12px',
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: '#fff',
    background: 'var(--blue-500)',
    borderRadius: 'var(--radius-sm)',
    marginTop: 24,
    transition: 'background 0.15s, opacity 0.15s',
    cursor: 'pointer',
    border: 'none',
  },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  errorBox: {
    background: 'var(--red-50)',
    border: '1px solid var(--red-100)',
    borderRadius: 'var(--radius-sm)',
    padding: '12px 16px',
    fontSize: '0.875rem',
    color: 'var(--red-600)',
    marginTop: 16,
  },
  successBox: {
    background: 'var(--green-50)',
    border: '1px solid var(--green-100)',
    borderRadius: 'var(--radius-md)',
    padding: '24px',
    textAlign: 'center',
    marginTop: 24,
  },
};

export default function IntakeForm() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ customer_id: '', old_name: '', new_name: '' });
  const [file, setFile]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [submitted, setSubmitted] = useState(null);

  const onDrop = useCallback(accepted => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': [], 'image/jpeg': [], 'image/png': [] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  });

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const isValid = form.customer_id && form.old_name && form.new_name && file;

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append('customer_id', form.customer_id.trim());
      fd.append('old_name',    form.old_name.trim());
      fd.append('new_name',    form.new_name.trim());
      fd.append('document',    file);

      const result = await submitRequest(fd);
      setSubmitted(result);
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.successBox}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: 6 }}>Request Submitted</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--ink-500)', marginBottom: 16 }}>
              Your request is being processed by the AI pipeline.
            </div>
            <div style={{
              background: 'var(--ink-50)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8125rem',
              color: 'var(--ink-700)',
              display: 'inline-block',
              marginBottom: 20,
            }}>
              ID: {submitted.request_id}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                style={{ ...s.btn, width: 'auto', padding: '10px 24px', fontSize: '0.875rem' }}
                onClick={() => navigate(`/checker/${submitted.request_id}`)}
              >
                View in Checker
              </button>
              <button
                style={{
                  ...s.btn, width: 'auto', padding: '10px 24px',
                  fontSize: '0.875rem', background: 'var(--ink-100)', color: 'var(--ink-700)',
                }}
                onClick={() => { setSubmitted(null); setForm({ customer_id: '', old_name: '', new_name: '' }); setFile(null); }}
              >
                New Request
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <h1 style={s.heading}>Name Change Request</h1>
      <p style={s.sub}>Submit a marriage certificate to process a customer name change.</p>

      <div style={s.card}>
        {/* Customer Details */}
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-300)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
          Customer Details
        </div>

        <div style={s.fieldGroup}>
          <label style={s.label}>Customer ID</label>
          <input
            style={s.input}
            name="customer_id"
            placeholder="e.g. CIF001234"
            value={form.customer_id}
            onChange={handleChange}
            onFocus={e => e.target.style.borderColor = 'var(--blue-500)'}
            onBlur={e => e.target.style.borderColor = 'var(--ink-100)'}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={s.fieldGroup}>
            <label style={s.label}>Current Name</label>
            <input
              style={s.input}
              name="old_name"
              placeholder="Name as in records"
              value={form.old_name}
              onChange={handleChange}
              onFocus={e => e.target.style.borderColor = 'var(--blue-500)'}
              onBlur={e => e.target.style.borderColor = 'var(--ink-100)'}
            />
          </div>
          <div style={s.fieldGroup}>
            <label style={s.label}>New Name</label>
            <input
              style={s.input}
              name="new_name"
              placeholder="Name to change to"
              value={form.new_name}
              onChange={handleChange}
              onFocus={e => e.target.style.borderColor = 'var(--blue-500)'}
              onBlur={e => e.target.style.borderColor = 'var(--ink-100)'}
            />
          </div>
        </div>

        <div style={s.divider} />

        {/* Document Upload */}
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-300)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
          Marriage Certificate
        </div>

        <div {...getRootProps()} style={s.dropzone(isDragActive, !!file)}>
          <input {...getInputProps()} />
          <div style={s.dropIcon}>{file ? '📄' : '⬆️'}</div>
          {file ? (
            <>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--green-600)' }}>
                Document attached
              </div>
              <div style={s.fileName}>{file.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--ink-300)', marginTop: 4 }}>
                {(file.size / 1024).toFixed(0)} KB
              </div>
            </>
          ) : (
            <>
              <div style={s.dropText}>
                {isDragActive ? 'Drop the file here' : 'Drag & drop or click to upload'}
              </div>
              <div style={s.dropHint}>PDF, JPEG or PNG · Max 20 MB</div>
            </>
          )}
        </div>

        {error && <div style={s.errorBox}>{error}</div>}

        <button
          style={{ ...s.btn, ...((!isValid || loading) ? s.btnDisabled : {}) }}
          onClick={handleSubmit}
          disabled={!isValid || loading}
        >
          {loading ? 'Submitting...' : 'Submit for Verification'}
        </button>
      </div>
    </div>
  );
}
