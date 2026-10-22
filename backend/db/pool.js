/**
 * MySQL connection pool.
 *
 * mysql2/promise gives an async API. The pool keeps a small number of
 * connections open and reuses them, which is what a hotel dashboard
 * needs: many short queries from many browser tabs.
 *
 * Every statement sent through this module uses parameter binding
 * ( `?` placeholders ). No user input is ever concatenated into SQL.
 */
import mysql from 'mysql2/promise';
import config from '../config.js';

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
  charset: 'utf8mb4',
  dateStrings: ['DATE'],
  // Return DECIMAL values as JS numbers. The project never handles
  // amounts above 2^53, so precision loss is not a risk.
  decimalNumbers: true,
  // TLS is enabled for a managed MySQL host (Aiven). It stays undefined
  // for the local development server, which runs without TLS.
  ssl: config.db.ssl,
  // Keep the connection alive so that a free tier proxy in front of
  // the database does not silently drop an idle pooled connection.
  enableKeepAlive: true,
  keepAliveInitialDelay: 10_000,
});

/**
 * Run a query and return the rows.
 * @param {string} sql    parameterised SQL statement
 * @param {Array}  params values for the `?` placeholders
 */
export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * Run a query that returns exactly one row (or null).
 */
export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length ? rows[0] : null;
}

/**
 * Run a statement and return the driver result (insertId, affectedRows).
 */
export async function execute(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

/**
 * Run a stored procedure that returns a single result set.
 *
 * mysql2 returns the output of a CALL as [resultSets, fields], where
 * resultSets is an array and the first element holds the rows that the
 * procedure selected. `pool.query` is used instead of `pool.execute`
 * because MySQL handles the multi-result protocol of CALL more
 * predictably that way. The values are still escaped by the driver,
 * so no user input is concatenated into the SQL text.
 */
export async function callProcedure(name, params = []) {
  const [result] = await pool.query(`CALL ${name}(${params.map(() => '?').join(', ')})`, params);
  if (!Array.isArray(result)) return [];
  const firstSet = result.find((set) => Array.isArray(set) && set.length) || [];
  return firstSet;
}

/** Verify that the database is reachable. */
export async function healthCheck() {
  const row = await queryOne('SELECT VERSION() AS version, DATABASE() AS db, NOW() AS server_time');
  return row;
}

export default pool;
