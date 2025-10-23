// Simple real-time chat server
// - Express serves the static files in ./public
// - Socket.IO adds the live connection for messages/typing
// The goal is to keep this file beginner-friendly and easy to read.

const path = require('path');              // path helpers for serving ./public
const express = require('express');        // small web framework
const http = require('http');              // create an HTTP server for Socket.IO to attach to
const compression = require('compression');// gzip responses for speed
const helmet = require('helmet');          // security headers (safe defaults)
const { Server } = require('socket.io');   // websockets (with fallbacks)

const app = express();

// Basic middleware: security headers + compression + body parsers
// Note: we turn off Helmet's CSP here to keep setup simple for a single page app.
// If you enable CSP later, allow the Socket.IO script/connection.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create the actual HTTP server and attach Socket.IO to it
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// In-memory state (kept super small and simple)
const MAX_MESSAGES = 200;                 // keep only the last N messages
const users = new Map();                  // socketId -> { name, color }
const messages = [];                      // message objects we broadcast

// Small helpers
function colorFor(name) {
  // Make a stable color from the name string (deterministic but simple)
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360},70%,60%)`;
}
function nowIso() { return new Date().toISOString(); }
function safeText(s) {
  // Keep input safe and tidy: string -> collapse whitespace -> trim -> max length
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 2000);
}

// Serve the static client (index.html, styles.css, app.js)
app.use(express.static(path.join(__dirname, 'public')));
app.get('/healthz', (_, res) => res.json({ ok: true }));

io.on('connection', (socket) => {
  // When someone connects, give them a temporary guest name and color
  const name = `Guest-${socket.id.slice(0, 4)}`;
  const me = { name, color: colorFor(name) };
  users.set(socket.id, me);

  // Send initial state just to this socket, and update everyone’s user list
  socket.emit('init', { me, users: Array.from(users.values()), messages });
  io.emit('users:list', Array.from(users.values()));

  // Let a user rename themselves (client can send an "ack" callback for a result)
  socket.on('user:rename', (newName, ack) => {
    newName = safeText(newName).slice(0, 24);
    if (!newName) return ack && ack({ ok: false, error: 'empty' });
    const conflict = Array.from(users.values()).some(u => u.name.toLowerCase() === newName.toLowerCase());
    if (conflict) return ack && ack({ ok: false, error: 'taken' });
    const u = users.get(socket.id);
    if (!u) return ack && ack({ ok: false });
    u.name = newName; u.color = colorFor(newName);
    users.set(socket.id, u);
    io.emit('users:list', Array.from(users.values()));
    ack && ack({ ok: true, me: u });
  });

  // Typing indicator (tell everyone else that this user is typing or stopped)
  socket.on('typing', (flag) => {
    socket.broadcast.emit('typing', { name: users.get(socket.id)?.name || 'Someone', isTyping: !!flag });
  });

  // Send a chat message to everyone
  socket.on('message:send', (payload, ack) => {
    const u = users.get(socket.id);
    const text = safeText(payload && payload.text);
    if (!u || !text) return ack && ack({ ok: false, error: 'empty' });
    const msg = { id: `${Date.now()}-${socket.id}`, name: u.name, color: u.color, text, ts: nowIso() };
    messages.push(msg); if (messages.length > MAX_MESSAGES) messages.shift();
    // We already add a local "optimistic" message on the client.
    // Broadcast to others only to avoid showing duplicates for the sender.
    socket.broadcast.emit('message:new', msg);
    ack && ack({ ok: true, id: msg.id });
  });

  socket.on('disconnect', () => {
    users.delete(socket.id);
    io.emit('users:list', Array.from(users.values()));
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Chatroom listening at http://${HOST}:${PORT}`);
});
