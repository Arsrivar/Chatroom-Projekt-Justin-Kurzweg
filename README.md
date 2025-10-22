Simple Chatroom (Express + Socket.IO)
====================================

This is a small, beginner‑friendly real‑time chat. The server is a single `server.js` file and the client lives in `public/`.

Run locally
-----------

1. Install Node.js 18+.
2. Install dependencies: `npm install`
3. Start the app: `npm start`
4. Open http://localhost:3000

What you get
------------

- Live messages powered by Socket.IO
- Online users list and typing indicator
- Pick a display name (Change name button)
- Last 200 messages kept in memory

How it works (quick tour)
-------------------------

- `server.js` — Express serves static files from `public/` and attaches Socket.IO. It keeps a tiny in‑memory list of users and messages. Events: user rename, typing, and send message.
- `public/index.html` — Page shell that loads the Socket.IO client and your app script.
- `public/app.js` — Connects with `io()`, renders messages/users, and wires the form.

Configuration
-------------

- `PORT` (default `3000`) and `HOST` (default `0.0.0.0`).

Notes
-----

- This demo stores everything in memory. If you restart the server, history resets.
- `helmet` adds common security headers; CSP is disabled here to keep setup simple for a single‑file client. You can enable a CSP later.
