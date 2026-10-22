/**
 * Server entry point.
 *
 * Starts the HTTP server and checks the MySQL connection once, so that
 * a misconfigured database is reported clearly in the terminal instead
 * of failing later with a confusing error.
 */
import app from './app.js';
import config from './config.js';
import { healthCheck, pool } from './db/pool.js';

const server = app.listen(config.port, async () => {
  console.log('');
  console.log('  Staywise - Hotel Booking and Reservation Management System');
  console.log(`  App      : http://localhost:${config.port}`);
  console.log(`  Database : ${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database}`);
  console.log('');

  try {
    const info = await healthCheck();
    console.log(`  [ok] Connected to MySQL ${info.version} (server time ${info.server_time})`);
  } catch (error) {
    console.error(`  [FAIL] Could not connect to MySQL: ${error.message}`);
    console.error('         Start the database and check your .env file.');
  }
  console.log('');
});

const shutdown = async (signal) => {
  console.log(`\n${signal} received, closing the server.`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default server;
