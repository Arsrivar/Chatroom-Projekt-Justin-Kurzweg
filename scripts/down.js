#!/usr/bin/env node
// Stop Nebula Chat server and ngrok if running (cross‑platform best effort)

const fs = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }
function readPid(p) { try { return String(fs.readFileSync(p)).trim(); } catch { return ''; } }

function killPid(pid) {
  if (!pid) return;
  try { process.platform === 'win32' ? spawnSync('taskkill', ['/PID', pid, '/T', '/F']) : process.kill(Number(pid)); } catch {}
}

function rm(p) { try { fs.rmSync(p, { force: true }); } catch {} }

const ngrokPidFile = '/tmp/ngrok.pid';
const serverPidFile = '/tmp/nebula-chat.pid';

console.log('[down] Stopping ngrok...');
const ngrokPid = exists(ngrokPidFile) ? readPid(ngrokPidFile) : '';
if (ngrokPid) killPid(ngrokPid);
if (process.platform === 'win32') {
  spawnSync('taskkill', ['/IM', 'ngrok.exe', '/F']);
} else {
  spawnSync('pkill', ['-x', 'ngrok']);
}
rm(ngrokPidFile);

console.log('[down] Stopping chat server...');
const serverPid = exists(serverPidFile) ? readPid(serverPidFile) : '';
if (serverPid) killPid(serverPid);
if (process.platform === 'win32') {
  // Try to terminate any node process whose command line includes server.js
  spawnSync('wmic', ['process', 'where', "CommandLine like '%server.js%'", 'call', 'terminate']);
} else {
  // Narrow kill by command line pattern
  spawnSync('pkill', ['-f', 'chatroom/server.js']);
}
rm(serverPidFile);

console.log('[down] Done.');

