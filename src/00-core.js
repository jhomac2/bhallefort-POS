'use strict';
/* =====================================================================
   BHALLEFFORT · Sistema de ventas para tienda de abarrotes
   Diseñado por Jhordy Cabascango · https://www.tiktok.com/@mr_jhordy21
   ===================================================================== */

/* ---------- Utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const money = n => {
  n = r2(n || 0);
  const neg = n < 0;
  return (neg ? '-' : '') + '$' + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};
const num = v => {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const x = parseFloat(String(v ?? '').replace(/\$/g, '').replace(/\s/g, '').replace(',', '.'));
  return isFinite(x) ? x : 0;
};
const qtyFmt = n => {
  n = Math.round(n * 1000) / 1000;
  return Number.isInteger(n) ? String(n) : String(n);
};
const pad = n => String(n).padStart(2, '0');
const dstr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => dstr(new Date());
const parseD = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return dstr(d); };
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const fmtDate = s => { if (!s) return '—'; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
const fmtDateLong = s => { const d = parseD(s); return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`; };
const fmtTime = iso => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtDT = iso => { const d = new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const sum = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const UNITS = { u: 'unidad', lb: 'libra', kg: 'kilo', l: 'litro', g: 'gramo', m: 'metro', pq: 'paquete' };
const FRACTIONAL = new Set(['lb', 'kg', 'l', 'g', 'm']);

/* ---------- Iconos ---------- */
const IC = {
  cart: '<circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M2.5 3.5h3l2.3 11h10.4l2-8H6.3"/>',
  receipt: '<path d="M6 2.5h12v19l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.3c1.8.8 3 2.6 3 4.7"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 10h18M16 15h2"/><path d="M5 6l11-3v3"/>',
  file: '<path d="M6 2.5h8l5 5V21.5H6z"/><path d="M14 2.5v5h5M9 13h6M9 17h6"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  book: '<path d="M5 3.5h11a3 3 0 0 1 3 3V20.5H8a3 3 0 0 1-3-3z"/><path d="M5 17.5a3 3 0 0 1 3-3h11"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4v4.5H8M12 7.5V12l3 2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  unlock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 7.6-1.7"/>',
  bank: '<path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20.5h18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  barcode: '<path d="M4 5v14M7 5v14M11 5v14M14 5v14M17 5v14M20 5v14"/><path d="M9 5v14" stroke-width="3"/>',
  send: '<path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5z"/>',
  chat: '<path d="M4 5h16v11H9.5L5 20v-4H4z"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  down: '<path d="M12 3.5v12M7 11l5 5 5-5M4 20.5h16"/>',
  up: '<path d="M12 20.5v-12M7 13l5-5 5 5M4 3.5h16"/>',
  alert: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.4v.1"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  cash: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v.1M18 14.5v.1"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1"/>',
  eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.1"/>',
  star: '<path d="m12 3.5 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.9l6.1-.8z"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4"/>',
  print: '<path d="M7 9V3.5h10V9M7 17H4.5v-8h15v8H17M7 14h10v6.5H7z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.4 0-2.5.7-2.5 1.8 0 2.6 5.2 1.2 5.2 3.8 0 1.2-1.2 1.9-2.7 1.9-1.1 0-2.1-.5-2.6-1.3M12 6.5V8M12 16v1.5"/>',
};
const ic = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;

/* ---------- Base de datos local (IndexedDB) ---------- */
const STORES = ['settings', 'owners', 'products', 'customers', 'sales', 'debtPayments', 'sessions', 'bankOps', 'cashMoves', 'purchases', 'accounting', 'audit'];
const M = {};
STORES.forEach(s => { M[s] = new Map(); });
let idb = null;
let dbOK = false;
let dbWarned = false;

function openDB() {
  return new Promise(res => {
    try {
      const rq = indexedDB.open('bhalleffort-pos', 1);
      rq.onupgradeneeded = () => {
        const db = rq.result;
        STORES.forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); });
      };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => res(null);
      rq.onblocked = () => res(null);
    } catch (e) { res(null); }
  });
}
function loadAll() {
  return new Promise(res => {
    if (!idb) return res();
    let pending = STORES.length;
    STORES.forEach(s => {
      try {
        const rq = idb.transaction(s, 'readonly').objectStore(s).getAll();
        rq.onsuccess = () => { rq.result.forEach(o => M[s].set(o.id, o)); if (--pending === 0) res(); };
        rq.onerror = () => { if (--pending === 0) res(); };
      } catch (e) { if (--pending === 0) res(); }
    });
  });
}
function dbFail() {
  if (dbWarned) return;
  dbWarned = true;
  toast('No se pudo guardar en este navegador. Descarga un respaldo desde Ajustes.', { type: 'bad', ms: 8000 });
}
function wr(store, op, arg) {
  if (!idb) return;
  try {
    const tx = idb.transaction(store, 'readwrite');
    tx.objectStore(store)[op](arg);
    tx.onerror = tx.onabort = dbFail;
  } catch (e) { dbFail(); }
}
const VER = {};
STORES.forEach(s => { VER[s] = 0; });
const list = store => Array.from(M[store].values());
const get = (store, id) => M[store].get(id);
function put(store, obj) { M[store].set(obj.id, obj); VER[store]++; wr(store, 'put', obj); return obj; }
function del(store, id) { M[store].delete(id); VER[store]++; wr(store, 'delete', id); }
function wipeAll() {
  STORES.forEach(s => { M[s].clear(); VER[s]++; if (idb) { try { idb.transaction(s, 'readwrite').objectStore(s).clear(); } catch (e) { } } });
}
const _memo = {};
function memo(key, stores, fn) {
  const v = stores.map(s => VER[s]).join('.');
  const c = _memo[key];
  if (c && c.v === v) return c.val;
  const val = fn();
  _memo[key] = { v, val };
  return val;
}

/* ---------- Configuración ---------- */
const DEF_CFG = {
  id: 'main', setupDone: false, storeName: 'BHALLEFFORT', pinHash: '', salt: '', nextSaleNo: 1, lockMinutes: 10,
  accountingOwnerId: null, phones: { tienda: '', mv: '' }, lastBackup: null, lastOwnerId: null, demo: false, invoiceAsk: false,
  mv: {
    commission: { pichincha: { deposito: 0, retiro: 0, servicio: 0 }, guayaquil: { deposito: 0, retiro: 0, servicio: 0 } },
    commissionInCash: false, lowBank: { pichincha: 50, guayaquil: 50 }, highCash: 1500,
  },
};
function cfg() {
  let c = M.settings.get('main');
  if (!c) { c = JSON.parse(JSON.stringify(DEF_CFG)); M.settings.set('main', c); }
  // completa campos nuevos sin perder los guardados
  const fill = (a, b) => { for (const k in b) { if (a[k] === undefined) a[k] = JSON.parse(JSON.stringify(b[k])); else if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) fill(a[k], b[k]); } };
  fill(c, DEF_CFG);
  return c;
}
const saveCfg = () => put('settings', cfg());

/* ---------- Dueños ---------- */
const owners = () => list('owners').filter(o => o.active !== false).sort((a, b) => (b.isStore ? 1 : 0) - (a.isStore ? 1 : 0) || a.name.localeCompare(b.name));
const allOwners = () => list('owners');
const ownerName = id => (get('owners', id) || { name: '(sin dueño)' }).name;
const ownerColor = id => { const o = get('owners', id); return `var(--c${(o && o.slot) || 1})`; };
const ownerDot = id => `<span class="dot" style="background:${ownerColor(id)}"></span>`;
const ownerPill = id => `<span class="pill-owner">${ownerDot(id)}${esc(ownerName(id))}</span>`;
function nextSlot() {
  const used = allOwners().map(o => o.slot);
  for (let i = 1; i <= 8; i++) if (!used.includes(i)) return i;
  return (allOwners().length % 8) + 1;
}
function addOwner(name, phone = '') {
  const o = put('owners', { id: uid(), name: name.trim(), phone: phone.trim(), slot: nextSlot(), isStore: false, active: true });
  audit('Dueño agregado', `Se agregó el dueño "${o.name}"`, { entity: 'owner', entityId: o.id });
  return o;
}

/* ---------- Estado de ejecución ---------- */
const S = {
  view: 'vender', owner: false, lastAct: Date.now(), cart: [], held: [], heldIdx: -1, mvOpen: false,
  mv: { bank: null, op: null, amount: '', undo: null }, dash: { kind: 'month', anchor: today(), from: today(), to: today(), metric: 'rev', owner: 'all' },
  salesDate: today(), salesQ: '', prodQ: '', prodOwner: 'all', prodFilter: 'all', prodLimit: 150, debtQ: '',
  cajaTab: 'hoy', acc: { owner: null, month: today().slice(0, 7) }, audit: { from: today(), to: today(), only: 'all' },
  rep: { who: 'tienda', ownerId: null, from: today(), to: today(), phone: '', detail: false, model: null },
};
const isOwner = () => S.owner;
const roleName = () => (S.owner ? 'Dueño' : 'Cajera');

/* ---------- Historial de cambios ---------- */
function audit(action, summary, o = {}) {
  const ses = curSession();
  return put('audit', {
    id: uid(), ts: new Date().toISOString(), date: ses ? ses.date : today(), sessionId: ses ? ses.id : null, user: roleName(),
    action, summary, entity: o.entity || '', entityId: o.entityId || '', before: o.before ?? null, after: o.after ?? null, edit: !!o.edit,
  });
}

/* ---------- Avisos y ventanas ---------- */
function toast(msg, o = {}) {
  const box = $('#toasts');
  if (!box) return;
  const t = document.createElement('div');
  t.className = 'toast ' + (o.type || '') + (o.cls ? ' ' + o.cls : '');
  t.setAttribute('role', 'status');
  t.innerHTML = `<span>${o.html ? msg : esc(msg)}</span>`;
  if (o.action) {
    const b = document.createElement('button');
    b.textContent = o.action.label;
    b.onclick = () => { o.action.fn(); t.remove(); };
    t.appendChild(b);
  }
  if (o.cls && o.cls.includes('vuelto')) box.innerHTML = '';
  [...box.children].forEach(c => { if (c.firstChild && c.firstChild.textContent === t.firstChild.textContent) c.remove(); });
  while (box.children.length >= 3) box.firstChild.remove();
  box.appendChild(t);
  setTimeout(() => t.remove(), o.ms || 3200);
}

const modalStack = [];
function modal({ title, html = '', actions = [], size = '', onOpen, closable = true, onClose }) {
  const ovl = document.createElement('div');
  ovl.className = 'ovl';
  ovl.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header><h2>${esc(title)}</h2>${closable ? `<button class="btn ghost icon" data-act="modal-close" aria-label="Cerrar">${ic('x')}</button>` : ''}</header>
    <div class="mbody">${html}</div>${actions.length ? '<footer></footer>' : ''}</div>`;
  let resolveFn;
  const done = new Promise(r => { resolveFn = r; });
  const h = {
    el: ovl, body: ovl.querySelector('.mbody'), done, closable,
    $: s => ovl.querySelector(s), $$: s => Array.from(ovl.querySelectorAll(s)),
    close(val) {
      const i = modalStack.indexOf(h);
      if (i >= 0) modalStack.splice(i, 1);
      ovl.remove();
      if (onClose) onClose(val);
      resolveFn(val);
      if (!modalStack.length) afterModalsClosed();
    },
    setHTML(x) { h.body.innerHTML = x; },
  };
  const foot = ovl.querySelector('footer');
  actions.forEach(a => {
    const b = document.createElement('button');
    b.className = 'btn ' + (a.cls || '');
    b.innerHTML = a.label;
    if (a.id) b.id = a.id;
    b.onclick = async () => {
      if (b.disabled) return;
      if (a.onClick) {
        const r = await a.onClick(h);
        if (r === false) return;
      }
      if (!a.keep) h.close(a.value);
    };
    foot.appendChild(b);
  });
  ovl.addEventListener('mousedown', e => { if (e.target === ovl && closable && size !== 'locked') { /* no cierra al tocar fuera para no perder datos */ } });
  $('#modals').appendChild(ovl);
  modalStack.push(h);
  if (onOpen) onOpen(h);
  const f = ovl.querySelector('[autofocus]') || ovl.querySelector('input:not([type=checkbox]):not([type=radio]),select,textarea');
  if (f) setTimeout(() => { const a = document.activeElement; if (a && a !== document.body && ovl.contains(a)) return; f.focus(); if (f.select && f.type !== 'date') f.select(); }, 30);
  return h;
}
function afterModalsClosed() { focusScan(); }
function closeTopModal() { const h = modalStack[modalStack.length - 1]; if (h && h.closable) h.close(); }
function ask({ title = 'Confirmar', msg = '', ok = 'Aceptar', cancel = 'Cancelar', danger = false, html = '' }) {
  return new Promise(res => {
    modal({
      title, html: html || `<p style="font-size:16px;margin:6px 0">${esc(msg)}</p>`,
      actions: [{ label: cancel, value: false, cls: '' }, { label: ok, value: true, cls: danger ? 'danger' : 'primary' }],
      onClose: v => res(!!v),
    });
  });
}
function askText({ title, label, value = '', type = 'text', ok = 'Guardar', hint = '', placeholder = '' }) {
  return new Promise(res => {
    const m = modal({
      title, html: `<label class="f">${esc(label)}${hint ? `<span class="hint">${esc(hint)}</span>` : ''}<input class="in lg" id="ask-in" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" autofocus></label>`,
      actions: [{ label: 'Cancelar', value: null }, { label: ok, cls: 'primary', onClick: h => { h.close(h.$('#ask-in').value); return false; } }],
      onClose: v => res(v === undefined ? null : v),
      onOpen: h => h.$('#ask-in').addEventListener('keydown', e => { if (e.key === 'Enter') h.close(h.$('#ask-in').value); }),
    });
  });
}
function info(title, html) { return modal({ title, html, actions: [{ label: 'Entendido', cls: 'primary' }] }); }

/* ---------- Archivos ---------- */
async function saveFile(filename, data) {
  try {
    if (window.claude && window.claude.use) {
      const d = await window.claude.use('downloads');
      if (d) { await d.save({ filename, data }); return 'saved'; }
    }
  } catch (e) { if (e && e.code === 'declined') return 'declined'; }
  try {
    const blob = data instanceof Blob ? data : new Blob([data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return 'saved';
  } catch (e) { return 'error'; }
}
function csvEscape(v) { v = String(v ?? ''); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function toCSV(rows) { return '﻿' + rows.map(r => r.map(csvEscape).join(',')).join('\r\n'); }
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/)[0] || '';
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : (first.includes('\t') ? '\t' : ',');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}

/* ---------- PIN del dueño ---------- */
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}
async function hashPin(pin, salt) {
  try {
    const b = new TextEncoder().encode(salt + ':' + pin);
    const h = await crypto.subtle.digest('SHA-256', b);
    return Array.from(new Uint8Array(h)).map(x => x.toString(16).padStart(2, '0')).join('');
  } catch (e) { return 'c' + cyrb53(salt + ':' + pin); }
}
async function setPin(pin) {
  const c = cfg();
  c.salt = uid() + uid();
  c.pinHash = await hashPin(pin, c.salt);
  saveCfg();
}
async function checkPin(pin) { const c = cfg(); return !!c.pinHash && (await hashPin(pin, c.salt)) === c.pinHash; }

function askPin(title = 'Modo dueño', hint = 'Escribe tu PIN') {
  return new Promise(res => {
    let val = '';
    const h = modal({
      title, size: 'narrow',
      html: `<p class="muted" style="margin:0 0 8px">${esc(hint)}</p><div class="pad" id="pin-show" aria-live="polite">&nbsp;</div><div id="pin-err" class="center sm" style="color:var(--danger);min-height:20px;font-weight:700"></div>
      <div class="keypad" style="margin-top:6px">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-pk="${n}">${n}</button>`).join('')}<button data-pk="back" aria-label="Borrar">⌫</button><button data-pk="0">0</button><button data-pk="ok" style="background:var(--brand);color:var(--brand-ink)">OK</button></div>`,
      onClose: v => res(v === true),
      onOpen: hh => {
        const show = () => { hh.$('#pin-show').textContent = val ? '●'.repeat(val.length) : ' '; };
        const submit = async () => {
          if (!val) return;
          if (await checkPin(val)) { hh.close(true); }
          else { val = ''; show(); hh.$('#pin-err').textContent = 'PIN incorrecto'; }
        };
        hh.el.addEventListener('click', e => {
          const b = e.target.closest('[data-pk]'); if (!b) return;
          const k = b.dataset.pk;
          if (k === 'back') val = val.slice(0, -1); else if (k === 'ok') return submit(); else if (val.length < 8) val += k;
          hh.$('#pin-err').textContent = ''; show();
        });
        hh.el.addEventListener('keydown', e => {
          if (/^\d$/.test(e.key) && val.length < 8) { val += e.key; show(); hh.$('#pin-err').textContent = ''; e.preventDefault(); }
          else if (e.key === 'Backspace') { val = val.slice(0, -1); show(); }
          else if (e.key === 'Enter') { e.preventDefault(); submit(); }
        });
        hh.el.setAttribute('tabindex', '-1'); hh.el.focus();
      },
    });
  });
}
async function requireOwner(reason) {
  if (S.owner) return true;
  const ok = await askPin('Modo dueño', reason || 'Esta opción es solo para el dueño. Escribe tu PIN.');
  if (ok) { S.owner = true; S.lastAct = Date.now(); renderAll(); return true; }
  return false;
}

/* ---------- Acciones por atributos (delegación de eventos) ---------- */
const ACT = {};   // data-act="nombre"  (clic)
const INP = {};   // data-in="nombre"   (escribir)
const CHG = {};   // data-ch="nombre"   (cambiar)
const KEY = {};   // data-key="nombre"  (teclas)
document.addEventListener('click', e => {
  S.lastAct = Date.now();
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const f = ACT[t.dataset.act];
  if (f) { e.preventDefault?.(); const r = f(t, e); if (r && r.catch) r.catch(err => { console.error(err); toast('Ocurrió un error: ' + err.message, { type: 'bad' }); }); }
});
document.addEventListener('input', e => { S.lastAct = Date.now(); const t = e.target.closest('[data-in]'); if (t && INP[t.dataset.in]) INP[t.dataset.in](t, e); });
document.addEventListener('change', e => { S.lastAct = Date.now(); const t = e.target.closest('[data-ch]'); if (t && CHG[t.dataset.ch]) CHG[t.dataset.ch](t, e); });
document.addEventListener('keydown', e => {
  S.lastAct = Date.now();
  const t = e.target.closest && e.target.closest('[data-key]');
  if (t && KEY[t.dataset.key]) KEY[t.dataset.key](t, e);
  if (e.key === 'Escape') closeTopModal();
});
ACT['modal-close'] = () => closeTopModal();
