// Vercel catch-all function exposing the existing Express API.
// Vercel may strip the filesystem route prefix; normalize so Express
// continues to receive URLs mounted at /api as in local development.
import app from '../backend/app.js';

export default function handler(req, res) {
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return app(req, res);
}
