/**
 * Express application.
 *
 * The API is mounted under /api. The frontend is served as static
 * files from frontend/public, so a single process runs the whole
 * application locally.
 *
 * In production the frontend is hosted separately (Vercel) and this
 * process only serves the API. The CORS policy below is what allows
 * the browser on the Vercel origin to call this API.
 */
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import apiRoutes from './routes/index.js';
import config from './config.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'frontend', 'public');

const app = express();

// Disable the "X-Powered-By" header.
app.disable('x-powered-by');

// Render (and most proxies) terminate TLS in front of the app. This
// makes Express trust the X-Forwarded-* headers.
app.set('trust proxy', true);

// Parse JSON request bodies with a sensible size limit.
app.use(express.json({ limit: '256kb' }));

/* ------------------------------- CORS ------------------------------ */
/**
 * Only the configured frontend origin may call the API.
 *
 * CORS_ORIGIN is a comma separated allow list, for example
 *   CORS_ORIGIN=https://my-project.vercel.app
 * The default "*" keeps the local development workflow simple.
 * Credentials are never used, so the wildcard is safe here: the API
 * has no cookie based authentication.
 */
app.use(cors({
  origin: config.cors.origins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

/* --------------------------- request log --------------------------- */
// Small request log - useful while demonstrating the project.
app.use((req, res, next) => {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms.toFixed(1)} ms)`);
  });
  next();
});

// Basic hardening headers. The API never renders HTML, so a strict
// policy is safe here.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// REST API.
app.use('/api', apiRoutes);

// Static frontend (used when the whole app is served by one process).
app.use(express.static(publicDir));

// Unknown API routes must return JSON, not the static handler.
app.use('/api', notFoundHandler);

// Anything else falls back to the SPA entry page.
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use(errorHandler);

export default app;
