#!/usr/bin/env node
/*
 * Start Nebula Chat server and ngrok tunnel with one command.
 * Usage:
 *   npm run up -- [--port 3000] [--host 0.0.0.0] [--no-ngrok]
 */

const { spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const i = args.indexOf(name);
  if (i !== -1 && args[i + 1]) return args[i + 1];
  return fallback;
}
const PORT = parseInt(getArg('--port', process.env.PORT || '3000'), 10);
const HOST = getArg('--host', process.env.HOST || '0.0.0.0');
const ADMIN_PASS = getArg('--admin-pass', process.env.ADMIN_PASSWORD || '');
const USE_NGROK = !args.includes('--no-ngrok');

// Ensure we run from project root
const root = path.resolve(__dirname, '..');
process.chdir(root);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function httpOk(url) {
  try {
    const res = await fetch(url, { method: 'GET' });
    return res.ok;
  } catch (_) {
    return false;
  }
}

async function waitFor(url, { timeoutMs = 15000, intervalMs = 400 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await httpOk(url)) return true;
    await sleep(intervalMs);
  }
  return false;
}

(async () => {
  const serverUrl = `http://127.0.0.1:${PORT}`;
  let serverProc = null;
  let startedServer = false;

  if (await httpOk(serverUrl)) {
    console.log(`[ok] Server already responding at ${serverUrl}`);
  } else {
    console.log(`[start] Starting server on ${HOST}:${PORT} ...`);
    const env = { ...process.env, HOST: String(HOST), PORT: String(PORT) };
    if (ADMIN_PASS) env.ADMIN_PASSWORD = ADMIN_PASS;
    serverProc = spawn(process.execPath, ['server.js'], {
      env,
      stdio: 'inherit',
    });
    startedServer = true;
    serverProc.on('exit', (code) => {
      console.log(`[server] exited with code ${code}`);
      // If ngrok isn't running, exit as well
    });
    const up = await waitFor(serverUrl, { timeoutMs: 15000, intervalMs: 300 });
    if (!up) {
      console.error('[error] Server did not become ready within 15s.');
      process.exit(1);
    }
  }

  let ngrokProc = null;
  let publicUrl = null;
  if (USE_NGROK) {
    console.log('[start] Starting ngrok tunnel...');
    ngrokProc = spawn('ngrok', ['http', String(PORT)], { stdio: 'pipe' });
    ngrokProc.stdout.on('data', (d) => {
      const s = d.toString();
      if (s.toLowerCase().includes('err') || s.toLowerCase().includes('fail')) {
        process.stdout.write(`[ngrok] ${s}`);
      }
    });
    ngrokProc.stderr.on('data', (d) => process.stderr.write(`[ngrok] ${d}`));

    // Wait for the local API to be available and extract the https public URL
    const apiReady = await waitFor('http://127.0.0.1:4040/api/tunnels', { timeoutMs: 15000, intervalMs: 500 });
    if (apiReady) {
      try {
        const res = await fetch('http://127.0.0.1:4040/api/tunnels');
        const j = await res.json();
        const t = (j.tunnels || []).find(x => x.proto === 'https');
        publicUrl = t && t.public_url;
      } catch (e) {
        // ignore and show generic message below
      }
    }
  }

  console.log('------------------------------');
  console.log(`Local:   ${serverUrl}`);
  if (USE_NGROK) {
    if (publicUrl) console.log(`Public:  ${publicUrl}`);
    else console.log('Public:  <waiting or failed — ensure ngrok authtoken is set>');
  }
  console.log('Press Ctrl+C to stop.');

  function cleanup() {
    console.log('\n[stop] Shutting down...');
    if (ngrokProc && !ngrokProc.killed) {
      try { ngrokProc.kill(); } catch (_) {}
    }
    if (startedServer && serverProc && !serverProc.killed) {
      try { serverProc.kill(); } catch (_) {}
    }
    process.exit(0);
  }
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
})();
