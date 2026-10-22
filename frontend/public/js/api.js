/* =====================================================================
   api.js - the only place where the frontend talks to the backend.
   Every call uses fetch() with the JSON envelope that backend/app.js
   produces: { success, data, error }.

   The API address comes from js/config.js, so moving the backend to a
   different host needs one edit and nothing else.

   Every request has a timeout. Without one a call to an unreachable
   backend would keep the page spinning forever, which is exactly what
   happens when the free tier of the database or of the API is asleep.
   ===================================================================== */
import './config.js';

const BASE = window.STAYWISE_API_BASE || '/api';

/** The normal timeout for a data request, in milliseconds. */
const DEFAULT_TIMEOUT = Number(window.STAYWISE_API_TIMEOUT) || 30_000;

/** The timeout for the health check. It may have to wake a sleeping
 *  free tier service up first, so it is given much more time. */
export const HEALTH_TIMEOUT = Number(window.STAYWISE_API_HEALTH_TIMEOUT) || 90_000;

async function request(path, { method = 'GET', body, query, timeout = DEFAULT_TIMEOUT } = {}) {
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

  // A timeout turns "the server never answers" into a clear error.
  const controller = new AbortController();
  options.signal = controller.signal;
  const timer = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch(url, options);
  } catch (networkError) {
    if (networkError.name === 'AbortError') {
      const error = new Error(
        `The API did not answer within ${Math.round(timeout / 1000)} seconds. It may be starting up - please try again in a moment.`,
      );
      error.code = 'TIMEOUT';
      throw error;
    }
    throw new Error(
      `The API could not be reached at ${BASE}. Please check that the backend is running.`,
    );
  } finally {
    clearTimeout(timer);
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
  get: (path, query, options) => request(path, { ...options, query }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  del: (path, options) => request(path, { ...options, method: 'DELETE' }),
};

export default api;
