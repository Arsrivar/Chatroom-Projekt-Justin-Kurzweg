Simple Chatroom — Code Walkthrough
=================================

Overview
- One server file (`server.js`) and a tiny client (`public/`).
- Socket.IO handles the live connection so messages appear instantly.

Server (`server.js`)
- Imports: Express (web), http (server), helmet (security headers), compression (gzip), and Socket.IO.
- Middleware:
  - `helmet({ contentSecurityPolicy: false })` — safe defaults; CSP is off to keep setup simple.
  - `compression()` — compresses HTTP responses.
  - `express.json()` / `express.urlencoded()` — request body parsers (future‑proofing; not heavily used here).
- Static files: `app.use(express.static(path.join(__dirname, 'public')))` serves `index.html`, CSS, and JS.
- Socket.IO: `const io = new Server(server)` and `io.on('connection', ...)` to handle events.
- In‑memory state:
  - `users: Map<socketId, {name,color}>`
  - `messages: Array<{id,name,color,text,ts}>` (capped to last 200)
- Events:
  - `init` (server → client): send current users and recent messages.
  - `user:rename` (client → server): change display name; replies via “ack” callback.
  - `typing` (client → server): broadcast a short typing hint to others.
  - `message:send` (client → server): validate text and broadcast `message:new` to everyone.

Client (`public/app.js`)
- Connects with `io()` and listens for: `init`, `users:list`, `message:new`, `typing`.
- Renders messages into the `#messages` container and keeps the view scrolled to the bottom while you chat.
- Sends `typing` while you type and emits `message:send` on submit.
- Rename uses an “ack” callback: `socket.emit('user:rename', name, (res) => { ... })`.

What is “ack”?
- If you pass a function as the last argument to `socket.emit(...)`, Socket.IO gives it to the server handler as the last parameter (commonly called `ack`).
- The server calls `ack(result)` to send a direct response back to just that client.

Next steps (if you want to extend)
- Persist messages to a file or database instead of memory.
- Add basic rooms (e.g. `general`, `announcements`) using Socket.IO rooms.
- Add simple rate limiting to prevent spam.
