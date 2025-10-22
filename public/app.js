// Very small front-end for the chat
// - Connects to the Socket.IO server
// - Renders messages and the online list
// - Handles typing indicator and rename

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const els = {
  me: $('#me-name'),
  onlineCount: $('#online-count'),
  userList: $('#user-list'),
  messages: $('#messages'),
  typing: $('#typing'),
  composer: $('#composer'),
  input: $('#message-input'),
  rename: $('#rename'),
  toast: $('#toast')
};

let socket = null;                           // Socket.IO connection
let me = { name: 'Guest', color: '#888' };   // Who we are (updated on init/rename)
let autoScroll = true;                       // Keep view pinned to bottom while chatting

function connect() {
  // Open the live connection
  socket = io();
  socket.on('connect', () => showToast('Connected'));
  socket.on('disconnect', () => showToast('Disconnected — retrying…'));

  // Receive initial state: who we are, who’s online, and recent messages
  socket.on('init', ({ me: self, users, messages }) => {
    setMe(self);
    renderUsers(users);
    els.messages.innerHTML = '';
    messages.forEach(addMessage);
    scrollToBottom(true);
  });

  // Live updates
  socket.on('users:list', (users) => renderUsers(users));
  socket.on('message:new', (msg) => { addMessage(msg); smartScroll(); });

  // Show a small typing hint for a moment
  socket.on('typing', ({ name, isTyping }) => {
    if (!isTyping) { els.typing.hidden = true; return; }
    els.typing.textContent = `${name} is typing…`;
    els.typing.hidden = false;
    clearTimeout(window._typingHide);
    window._typingHide = setTimeout(() => { els.typing.hidden = true; }, 1200);
  });
}

function setMe(user) {
  me = user;
  els.me.textContent = user.name;
}

function renderUsers(list) {
  els.onlineCount.textContent = list.length;
  els.userList.innerHTML = '';
  list.forEach(u => {
    const li = document.createElement('li');
    const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = u.color;
    const name = document.createElement('span'); name.className = 'name'; name.textContent = u.name;
    li.append(dot, name);
    els.userList.append(li);
  });
}

function addMessage(msg) {
  const wrap = document.createElement('div'); wrap.className = 'msg' + (msg.name === me.name ? ' me' : '');
  const avatar = document.createElement('div'); avatar.className = 'avatar'; avatar.style.background = msg.color;
  const bubble = document.createElement('div'); bubble.className = 'bubble';
  const meta = document.createElement('div'); meta.className = 'meta';
  const who = document.createElement('span'); who.className = 'who'; who.textContent = msg.name; who.style.color = msg.color;
  const time = document.createElement('span'); time.className = 'time'; time.textContent = formatTime(msg.ts);
  meta.append(who, time);
  const text = document.createElement('div'); text.className = 'text'; text.textContent = msg.text || '';
  bubble.append(meta, text);
  if (msg.name === me.name) { bubble.after(avatar); wrap.append(bubble, avatar); } else { wrap.append(avatar, bubble); }
  els.messages.append(wrap);
}

function formatTime(iso) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).format(d);
}

function smartScroll() { if (autoScroll) scrollToBottom(); }
function scrollToBottom(immediate=false) { els.messages.scrollTo({ top: els.messages.scrollHeight, behavior: immediate? 'auto':'smooth' }); }

// Compose: send messages and emit a short "typing" signal
let typingTimer = null;
els.input.addEventListener('input', () => {
  if (!socket) return;
  socket.emit('typing', true);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => socket.emit('typing', false), 900);
});
els.messages.addEventListener('scroll', () => {
  const el = els.messages; autoScroll = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
});
els.composer.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = els.input.value.trim(); if (!text) return;
  // Optimistic echo so the message appears instantly
  const local = { id: `local-${Date.now()}`, name: me.name, color: me.color, text, ts: new Date().toISOString() };
  addMessage(local); smartScroll();
  const payload = { text };
  // Include an acknowledgement callback; the server can tell us if it failed
  socket.emit('message:send', payload, (res) => { if (!res || !res.ok) showToast('Failed to send'); });
  els.input.value = '';
});

// Rename
els.rename.addEventListener('click', async () => {
  const next = prompt('Pick a display name (max 24 chars):', me.name);
  if (!next || next.trim() === me.name) return;
  socket.emit('user:rename', next.trim(), (res) => {
    if (res && res.ok && res.me) setMe(res.me); else showToast(res && res.error === 'taken' ? 'Name in use' : 'Failed to rename');
  });
});

function showToast(text) {
  els.toast.textContent = text; els.toast.hidden = false; clearTimeout(window._toastHide); window._toastHide = setTimeout(()=>{ els.toast.hidden = true; }, 2000);
}

connect();
