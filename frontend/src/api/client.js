// frontend/src/api/client.js
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// ── Requests ──────────────────────────────────────────────────────────────────

export async function submitRequest(formData) {
  // formData is a FormData object with customer_id, old_name, new_name, document
  const { data } = await api.post('/requests', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function getRequests(params = {}) {
  const { data } = await api.get('/requests', { params });
  return data;
}

export async function getRequest(id) {
  const { data } = await api.get(`/requests/${id}`);
  return data;
}

export async function getDocumentUrl(id) {
  const { data } = await api.get(`/requests/${id}/document`);
  return data.url;
}

export async function approveRequest(id, { checker_id, notes }) {
  const { data } = await api.post(`/requests/${id}/approve`, { checker_id, notes });
  return data;
}

export async function rejectRequest(id, { checker_id, reason }) {
  const { data } = await api.post(`/requests/${id}/reject`, { checker_id, reason });
  return data;
}

export async function getScoreCard(id) {
  const { data } = await api.get(`/requests/${id}/scorecard`);
  return data.score_card;
}
