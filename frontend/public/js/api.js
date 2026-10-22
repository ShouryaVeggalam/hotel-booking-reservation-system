/* =====================================================================
   api.js - the only place where the frontend talks to the backend.
   Every call uses fetch() with the JSON envelope that backend/app.js
   produces: { success, data, error }.

   The API address comes from js/config.js, so moving the backend to a
   different host needs one edit and nothing else.
   ===================================================================== */
import './config.js';

const BASE = window.STAYWISE_API_BASE || '/api';

async function request(path, { method = 'GET', body, query } = {}) {
  let url = `${BASE}${path}`;

  if (query) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params.append(key, value);
    });
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch (networkError) {
    throw new Error('The server could not be reached. Is the backend running on port 3000?');
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok || payload.success === false) {
    const message = (payload.error && payload.error.message) || `Request failed (${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    error.code = payload.error && payload.error.code;
    error.details = payload.error && payload.error.details;
    throw error;
  }

  return payload;
}

export const api = {
  get: (path, query) => request(path, { query }),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
};

export default api;
