#!/usr/bin/env node
/* =====================================================================
   provision_aiven.mjs

   Creates everything the deployment needs on Aiven for MySQL 8:

     1. finds the project (or uses the one you name)
     2. finds an existing MySQL service, or creates a free tier one
     3. waits until the service is RUNNING
     4. reads the connection information (host, port, database, CA)
     5. creates the RESTRICTED application user with exactly the
        privileges the API needs
     6. writes .env.render - the file with the environment variables
        that Render needs, ready to be copied into the dashboard

   Nothing is ever dropped. The script only creates what does not
   exist yet.

   Usage
     AIVEN_TOKEN=aivenv1_xxx node scripts/provision_aiven.mjs
     AIVEN_TOKEN=aivenv1_xxx AIVEN_PROJECT=my-project \
       AIVEN_SERVICE=staywise-mysql AIVEN_DB_USER=staywise_app \
       AIVEN_DB_PASSWORD='a strong password' \
       node scripts/provision_aiven.mjs

   The token is created at
     aiven.io -> Account -> Access tokens -> Create token
   It is never written to a file by this script and never printed.
   ===================================================================== */

const TOKEN = process.env.AIVEN_TOKEN;
const API = 'https://api.aiven.io/v1';

if (!TOKEN) {
  console.error('AIVEN_TOKEN is missing.');
  console.error('Create a token at aiven.io -> Account -> Access tokens, then run');
  console.error('  AIVEN_TOKEN=aivenv1_xxx node scripts/provision_aiven.mjs');
  process.exit(1);
}

const SERVICE_NAME = process.env.AIVEN_SERVICE || 'staywise-mysql';
const DB_USER = process.env.AIVEN_DB_USER || 'staywise_app';
const DB_PASSWORD = process.env.AIVEN_DB_PASSWORD || '';

/** The exact privileges the API needs - nothing more. */
const APP_GRANTS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'EXECUTE'];

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const message = json?.errors?.[0]?.message || json?.message || text;
    const error = new Error(`Aiven API ${method} ${path} failed (${res.status}): ${message}`);
    error.status = res.status;
    error.body = json;
    throw error;
  }
  return json;
}

const log = (...args) => console.log(...args);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  log('====================================================================');
  log(' Aiven for MySQL 8 - provisioning');
  log('====================================================================');
  log('');

  /* -- 1. the project ------------------------------------------------ */
  let project = process.env.AIVEN_PROJECT || null;

  if (!project) {
    const list = await api('/project');
    const projects = list?.projects || [];
    if (projects.length === 0) {
      throw new Error('This token does not see any Aiven project. Create one in the console first.');
    }
    project = projects[0].project_name;
    log(`Project        : ${project}  (taken from the first project of the token)`);
  } else {
    log(`Project        : ${project}`);
  }

  /* -- 2. an existing MySQL service ---------------------------------- */
  const services = (await api(`/project/${project}/service`))?.services || [];
  let service = services.find((s) => s.service_type === 'mysql' && s.service_name === SERVICE_NAME);
  if (!service) {
    service = services.find((s) => s.service_type === 'mysql');
  }

  if (service) {
    log(`Service        : ${service.service_name}  (already exists, state: ${service.state})`);
  } else {
    log(`Service        : ${SERVICE_NAME}  (does not exist yet - creating it)`);
    service = await createFreeService(project, SERVICE_NAME);
  }

  /* -- 3. wait until it is running ----------------------------------- */
  if (service.state !== 'RUNNING') {
    log('Waiting for the service to become RUNNING');
    for (let i = 0; i < 90; i += 1) {
      await sleep(10_000);
      service = await api(`/project/${project}/service/${SERVICE_NAME}`);
      log(`  ${service.state}`);
      if (service.state === 'RUNNING') break;
      if (['ERROR', 'DELETED'].includes(service.state)) {
        throw new Error(`The service ended in the state ${service.state}.`);
      }
    }
    if (service.state !== 'RUNNING') {
      throw new Error('The service did not become RUNNING within 15 minutes.');
    }
  }
  log(`Service state  : ${service.state}`);

  /* -- 4. the connection information --------------------------------- */
  const info = await api(`/project/${project}/service/${SERVICE_NAME}/connection_info`);
  const conn = info?.connection_info || {};
  const host = conn.host;
  const port = conn.port;
  const dbName = conn.dbname || conn.database;
  const adminUser = conn.user;
  const adminPassword = conn.password;
  const caCert = conn.ssl_params?.ca || conn.ssl_params?.certificate || '';

  log(`Host           : ${host}`);
  log(`Port           : ${port}`);
  log(`Database       : ${dbName}`);
  log(`Admin user     : ${adminUser}`);

  if (!host || !dbName) {
    throw new Error('The service did not return complete connection information.');
  }

  /* -- 5. the restricted application user ---------------------------- */
  const users = (await api(`/project/${project}/service/${SERVICE_NAME}/user`))?.users || [];
  const existing = users.find((u) => u.username === DB_USER);
  if (existing) {
    log(`App user       : ${DB_USER}  (already exists)`);
  } else {
    const body = { username: DB_USER, type: 'normal' };
    if (DB_PASSWORD) body.password = DB_PASSWORD;
    body.mysql_grants = APP_GRANTS;
    try {
      await api(`/project/${project}/service/${SERVICE_NAME}/user`, { method: 'POST', body });
      log(`App user       : ${DB_USER}  (created with ${APP_GRANTS.join(', ')})`);
    } catch (error) {
      log(`App user       : could not be created through the API (${error.message}).`);
      log('                Create it in the console instead: Aiven -> the service -> Users.');
    }
  }

  /* -- 6. the file with the Render environment variables -------------- */
  const env = [
    '# Render environment variables for the Staywise API.',
    '# Generated by scripts/provision_aiven.mjs - do not commit this file.',
    '',
    `DB_HOST=${host}`,
    `DB_PORT=${port}`,
    `DB_NAME=${dbName}`,
    `DB_USER=${DB_USER}`,
    `DB_PASSWORD=${DB_PASSWORD || '<the password of the application user>'}`,
    'DB_CONNECTION_LIMIT=5',
    'DB_SSL=true',
    'DB_SSL_REJECT_UNAUTHORIZED=true',
    `DB_SSL_CA=${JSON.stringify(caCert)}`,
    'CORS_ORIGIN=https://staywise-dbms.vercel.app',
    '',
    '# --- the administrative account, only needed for the one time setup ---',
    `ADMIN_DB_USER=${adminUser}`,
    `ADMIN_DB_PASSWORD=${adminPassword}`,
    '',
  ].join('\n');

  const { writeFileSync } = await import('node:fs');
  writeFileSync('.env.render', env, { mode: 0o600 });
  log('');
  log('Wrote .env.render (mode 600, listed in .gitignore).');
  log('Copy the values from it into the Render environment variables.');
  log('');
  log('Next steps');
  log('  1. Apply the schema:');
  log('       DB_HOST=... DB_PORT=... DB_NAME=... DB_USER=$ADMIN_DB_USER \\');
  log('       DB_PASSWORD=$ADMIN_DB_PASSWORD DB_SSL=true DB_SSL_CA=<ca.crt> \\');
  log('       bash database/deploy/apply_remote.sh \\');
  log('         SEED_FILE=database/deploy/08_demo_data.sql');
  log('  2. Verify it:');
  log('       bash database/deploy/verify_remote.sh');
}

/**
 * Create a free tier MySQL service.
 *
 * The free plan is looked up from the plans the account may use, so
 * that the script does not depend on a hard coded plan name.
 */
async function createFreeService(project, serviceName) {
  const plans = await findMySqlPlans(project);

  const free = plans.find((p) => {
    const price = p.price ?? p.price_hour ?? p.price_month;
    return String(price) === '0' || /free/i.test(p.plan || p.name || '');
  });

  if (!free) {
    console.error('');
    console.error('The free MySQL plan could not be found through the API.');
    console.error('Create the service in the console instead:');
    console.error('  aiven.io -> your project -> Services -> Create service');
    console.error('  -> MySQL -> tier Free -> name it "' + serviceName + '" -> Create service');
    console.error('Then run this script again - it will find the service and continue.');
    process.exit(3);
  }

  const plan = free.plan || free.name;
  const cloud = free.cloud || 'digitalocean';
  const region = free.cloud_region || free.region;

  log(`Plan           : ${plan} (free)`);
  log(`Cloud          : ${cloud}${region ? ` / ${region}` : ''}`);

  const body = {
    service_name: serviceName,
    service_type: 'mysql',
    plan,
    cloud,
    node_count: 1,
    node_cpu: 1,
    node_memory: 1024,
    node_disk: 1024,
    project,
  };
  if (region) body.cloud_region = region;

  const created = await api(`/project/${project}/service`, { method: 'POST', body });
  return created?.service || { service_name: serviceName, state: 'REBUILDING' };
}

/** Try the endpoints that list the plans this account may use. */
async function findMySqlPlans(project) {
  const candidates = [
    `/project/${project}/service/available_service_types`,
    `/project/${project}/available_service_plans`,
    `/project/${project}/service_plans`,
    '/service_plans',
  ];

  for (const path of candidates) {
    try {
      const data = await api(path);
      const plans = collectPlans(data);
      const mysql = plans.filter((p) => (p.service_type === 'mysql' || p.serviceType === 'mysql'));
      if (mysql.length > 0) return mysql;
    } catch {
      // try the next endpoint
    }
  }
  return [];
}

/** Pull the plan objects out of whatever shape the API returned. */
function collectPlans(data) {
  if (!data || typeof data !== 'object') return [];
  const out = [];
  const walk = (node) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (node.service_type || node.serviceType) {
      out.push({
        service_type: node.service_type || node.serviceType,
        plan: node.plan || node.plan_identifier || node.name,
        name: node.name,
        price: node.price ?? node.price_hour ?? node.price_month,
        cloud: node.cloud || node.cloud_name,
        cloud_region: node.cloud_region || node.region,
      });
    }
    Object.values(node).forEach(walk);
  };
  walk(data);
  return out;
}

main().catch((error) => {
  console.error('');
  console.error('Provisioning failed:');
  console.error(`  ${error.message}`);
  if (error.body?.errors?.[0]?.message) {
    console.error(`  Aiven said: ${error.body.errors[0].message}`);
  }
  process.exit(1);
});
