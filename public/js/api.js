/* ============================================================
   api.js — Fetch wrapper for all /api/* endpoints
   ============================================================ */

import { showToast } from './toast.js';

const BASE = '/api';

/** Generic fetch helper with error handling */
async function request(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(`${BASE}${path}`, opts);
  } catch (networkErr) {
    showToast('error', 'Network Error', 'Cannot reach the server. Is it running?');
    throw networkErr;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errMsg = data.errors ? data.errors.join('\n') : (data.error || 'Unknown error');
    if (res.status !== 404) {
      showToast('error', `Error ${res.status}`, errMsg);
    }
    const err = new Error(errMsg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

// ─── VPN endpoints ────────────────────────────────────────────

/** List all VPNs, optionally filtering by status and search text */
export async function getVPNs({ status = 'all', search = '' } = {}) {
  const params = new URLSearchParams();
  if (status && status !== 'all') params.set('status', status);
  if (search) params.set('search', search);
  const qs = params.toString();
  return request('GET', `/vpns${qs ? '?' + qs : ''}`);
}

/** Get a single VPN by ID */
export async function getVPN(id) {
  return request('GET', `/vpns/${id}`);
}

/** Create a new VPN */
export async function createVPN(data) {
  return request('POST', '/vpns', data);
}

/** Update an existing VPN */
export async function updateVPN(id, data) {
  return request('PUT', `/vpns/${id}`, data);
}

/** Delete a VPN */
export async function deleteVPN(id) {
  return request('DELETE', `/vpns/${id}`);
}

/** Trigger a manual health check for one VPN */
export async function checkVPN(id) {
  return request('POST', `/vpns/${id}/check`);
}

/** Update only the health status fields */
export async function updateVPNStatus(id, statusData) {
  return request('PATCH', `/vpns/${id}/status`, statusData);
}
