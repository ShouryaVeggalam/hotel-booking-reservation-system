/**
 * Application configuration.
 *
 * Every value is read from an environment variable so that no
 * credential is ever written into the source code. The .env file is
 * loaded automatically if it exists.
 *
 * The same code runs locally (`.env` file) and in production (Render
 * environment variables). Nothing is hard coded for a particular host.
 */
import fs from 'node:fs';
import 'dotenv/config';

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

/**
 * Build the TLS options for the MySQL connection.
 *
 * A managed MySQL host such as Aiven requires an encrypted connection.
 * The certificate authority can be supplied in two ways:
 *
 *   DB_SSL_CA=/path/to/ca.crt     a path to the PEM file
 *   DB_SSL_CA="-----BEGIN CERTIFICATE-----\n..."   the PEM text itself
 *
 * When DB_SSL is on and no CA is supplied, the system trust store is
 * used (which is correct for hosts with a publicly trusted certificate).
 */
function buildSslOptions() {
  const enabled = toBool(process.env.DB_SSL, false);
  if (!enabled) return undefined;

  const rejectUnauthorized = toBool(process.env.DB_SSL_REJECT_UNAUTHORIZED, true);
  const raw = (process.env.DB_SSL_CA || '').trim();

  const options = {
    minVersion: 'TLSv1.2',
    rejectUnauthorized,
  };

  if (raw) {
    if (raw.includes('BEGIN CERTIFICATE')) {
      // The PEM text was supplied inline. Undo the escaping that a
      // dashboard or a shell usually applies to a multi line value.
      options.ca = raw.replace(/\\n/g, '\n');
    } else {
      try {
        options.ca = fs.readFileSync(raw, 'utf8');
      } catch (error) {
        console.error(`[config] DB_SSL_CA could not be read from "${raw}": ${error.message}`);
        throw error;
      }
    }
  }

  return options;
}

/**
 * The list of browser origins that may call the API.
 *
 * CORS_ORIGIN accepts a comma separated list, or "*" to allow any
 * origin. In production the exact Vercel URL is set, so that a page
 * served from any other site cannot drive the API.
 */
function parseOrigins() {
  const raw = (process.env.CORS_ORIGIN || '*').trim();
  if (raw === '*') return '*';
  return raw
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 3000),

  cors: {
    origins: parseOrigins(),
  },

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: toInt(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME || 'hotel_booking_db',
    connectionLimit: toInt(process.env.DB_CONNECTION_LIMIT, 10),
    ssl: buildSslOptions(),
  },
};

export default config;
