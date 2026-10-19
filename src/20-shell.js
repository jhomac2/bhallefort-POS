/* =====================================================================
   Estructura de la app: navegación, barra superior, pantallas de inicio
   ===================================================================== */
const VIEWS = {};
const NAV = [
  ['vender', 'Vender', 'cart', false], ['ventas', 'Ventas', 'receipt', false], ['productos', 'Productos', 'box', false],
  ['fiados', 'Fiados', 'users', false], ['caja', 'Caja', 'wallet', false], ['reportes', 'Reportes', 'file', false],
  ['resumen', 'Resumen', 'chart', true], ['contab', 'Contabilidad', 'book', true], ['cambios', 'Cambios', 'history', false], ['ajustes', 'Ajustes', 'gear', true],
];
const NO_SESSION_OK = new Set(['reportes', 'cambios', 'caja', 'ventas', 'resumen', 'contab', 'productos', 'fiados', 'ajustes']);
const CREDIT_URL = 'https://www.tiktok.com/@mr_jhordy21';
const CREDIT = 'Diseñado por Jhordy Cabascango';

function renderNav() {
  const nav = $('#nav');
  nav.innerHTML = `<div class="brandmark"><b>B</b>${esc(cfg().storeName.slice(0, 12))}</div>` + NAV.map(([id, label, icon, locked], i) =>
    `<button data-act="nav" data-v="${id}" ${S.view === id ? 'aria-current="page"' : ''} title="${label}">${ic(icon)}<span>${label}</span>${locked && !S.owner ? ic('lock', 'lockdot') : ''}</button>` + (i === 0 ? `<button class="nav-mv" data-act="mv-toggle" title="Mi Vecino">${ic('bank')}<span>Mi Vecino</span></button>` : '')).join('') +
    `<div class="nav-sp"></div>`;
}
function renderTop() {
  const v = VIEWS[S.view] || { title: '' };
  const ses = curSession();
  const sum_ = ses ? sessionSummary(ses.id) : null;
  const edits = ses ? sessionEdits(ses.id).length : 0;
  const c = cfg();
  const days = c.lastBackup ? Math.floor((Date.now() - new Date(c.lastBackup)) / 86400000) : null;
  $('#top').innerHTML = `<h1>${esc(typeof v.title === 'function' ? v.title() : v.title)}</h1><span class="sp"></span>
    ${ses ? `<button class="chip ok hide-m" data-act="nav" data-v="caja" title="Ver la caja">${ic('wallet', 'sm')} Caja abierta ${fmtTime(ses.openedAt)}</button>
      <span class="chip hide-m" title="Efectivo que debería haber en la tienda">${ic('cash', 'sm')} Tienda <b class="num">${money(sum_.tiendaExpected)}</b></span>` : ''}
    ${edits ? `<button class="chip warn" data-act="go-changes" title="Ver las modificaciones de hoy">${ic('alert', 'sm')} ${edits} modificación${edits > 1 ? 'es' : ''} hoy</button>` : ''}
    ${S.owner && (days === null ? list('sales').length > 20 : days >= 7) ? `<button class="chip bad" data-act="nav" data-v="ajustes">${ic('down', 'sm')} Falta respaldo</button>` : ''}
    <button class="chip ${S.owner ? 'info' : ''}" data-act="toggle-owner" title="${S.owner ? 'Volver a modo cajera' : 'Entrar al modo dueño'}">${ic(S.owner ? 'unlock' : 'lock', 'sm')} ${S.owner ? 'Dueño' : 'Cajera'}</button>
    ${ses ? `<button class="btn sm soft-danger" data-act="nav" data-v="cierre">Cerrar caja</button>` : `<button class="btn sm primary" data-act="open-gate">Abrir caja</button>`}`;
}
function renderView() {
  const v = VIEWS[S.view];
  const root = $('#view');
  if (!v) { root.innerHTML = ''; return; }
  root.innerHTML = v.render();
  if (v.after) v.after();
}
function renderAll() {
  renderNav(); renderTop(); renderView(); if (typeof renderMV === 'function') renderMV();
  const fab = $('#mvFab'); if (fab) fab.hidden = !curSession();
}
function go(view) {
  S.view = view;
  document.body.classList.remove('mv-open');
  if (checkGates()) return;
  renderAll();
  const vw = $('#view'); if (vw) vw.scrollTop = 0;
  focusScan();
}
function focusScan() {
  if (S.view !== 'vender' || modalStack.length || !$('#gate').hidden) return;
  const el = $('#scan');
  if (el && document.activeElement !== el) el.focus();
}
ACT['nav'] = async t => {
  const id = t.dataset.v;
  const locked = (NAV.find(n => n[0] === id) || [])[3];
  if (locked && !S.owner) { if (!(await requireOwner('Esta sección es solo para el dueño. Escribe tu PIN.'))) return; }
  go(id);
};
ACT['toggle-owner'] = async () => {
  if (S.owner) {
    S.owner = false;
    if (NAV.find(n => n[0] === S.view && n[3])) S.view = 'vender';
    renderAll(); toast('Modo cajera');
  } else await requireOwner('Escribe tu PIN para entrar al modo dueño.');
};
ACT['go-changes'] = () => { const s = curSession(); S.audit = { from: s ? s.date : today(), to: s ? s.date : today(), only: 'edits' }; go('cambios'); };
ACT['mv-toggle'] = () => { document.body.classList.toggle('mv-open'); };

/* Bloqueo automático del modo dueño */
setInterval(() => {
  if (S.owner && cfg().lockMinutes > 0 && Date.now() - S.lastAct > cfg().lockMinutes * 60000) {
    S.owner = false;
    if (NAV.find(n => n[0] === S.view && n[3])) S.view = 'vender';
    renderAll(); toast('Modo dueño bloqueado por inactividad', { type: 'warn' });
  }
}, 20000);

/* ---------- Pantallas obligatorias (puertas) ---------- */
function showGate(html) { const g = $('#gate'); g.innerHTML = `<div class="gate-in">${html}</div>`; g.hidden = false; }
function hideGate() { const g = $('#gate'); g.hidden = true; g.innerHTML = ''; }
function checkGates() {
  const c = cfg();
  if (!c.setupDone) { renderSetup(); return true; }
  const ses = curSession();
  if (!ses) {
    if (S.skipOpen && NO_SESSION_OK.has(S.view)) { if (!$('#gate').hidden) hideGate(); return false; }
    S.skipOpen = false; renderOpenGate(); return true;
  }
  if (ses.date < today() && S.view !== 'cierre') { renderStaleGate(ses); return true; }
  if (!$('#gate').hidden) hideGate();
  return false;
}
const creditHTML = () => `<div class="center xs muted" style="margin-top:6px">${CREDIT} · <a href="${CREDIT_URL}" target="_blank" rel="noopener">TikTok @mr_jhordy21</a></div>`;

/* --- Primera vez --- */
let setupOwners = [];
function setupOwnersHTML() {
  return setupOwners.map((n, i) => `<span class="chip">${esc(n)} <button class="btn ghost sm icon" data-act="st-del" data-i="${i}" aria-label="Quitar" style="min-height:22px;width:22px">${ic('x', 'sm')}</button></span>`).join('') || '<span class="muted sm">Aún no agregas dueños de productos.</span>';
}
function renderSetup() {
  if (!$('#gate').hidden && $('#st-name')) return;
  setupOwners = [];
  showGate(`<div><h1>Bienvenido a Bhalleffort</h1><p class="muted" style="margin:4px 0 0">Sistema de ventas para tienda de abarrotes. Solo se hace una vez.</p></div>
    <div class="bigfield"><label class="f">Nombre del negocio<input class="in lg" id="st-name" value="BHALLEFFORT"></label></div>
    <div class="bigfield"><div class="t">${ic('lock')} PIN del dueño</div><div class="h">Con este PIN se entra al modo dueño (resumen, contabilidad, ajustes). Solo números, mínimo 4.</div>
      <div class="grid g2"><label class="f">PIN<input class="in lg" id="st-pin" type="password" inputmode="numeric" maxlength="8" autocomplete="off"></label>
      <label class="f">Repite el PIN<input class="in lg" id="st-pin2" type="password" inputmode="numeric" maxlength="8" autocomplete="off"></label></div></div>
    <div class="bigfield"><div class="t">${ic('users')} Dueños de los productos</div><div class="h">La tienda ya está incluida. Agrega a cada persona que tenga productos en tu tienda (puedes agregar más después, sin límite).</div>
      <div class="row nowrap"><input class="in lg" id="st-owner" placeholder="Nombre del dueño" data-key="st-owner"><button class="btn lg primary" data-act="st-add">${ic('plus')} Agregar</button></div>
      <div class="row" id="st-owners">${setupOwnersHTML()}</div></div>
    <div class="bigfield"><div class="t">${ic('chat')} WhatsApp para reportes (opcional)</div>
      <div class="grid g2"><label class="f">Dueño de la tienda<input class="in" id="st-ph1" inputmode="tel" placeholder="09XXXXXXXX"></label><label class="f">Dueño de Mi Vecino<input class="in" id="st-ph2" inputmode="tel" placeholder="09XXXXXXXX"></label></div></div>
    <label class="chk"><input type="checkbox" id="st-demo"> Cargar productos de ejemplo para probar (se pueden borrar en Ajustes)</label>
    <div id="st-err" class="alert bad" hidden></div>
    <button class="btn xl primary" data-act="st-go">Empezar</button>${creditHTML()}`);
  setTimeout(() => $('#st-name')?.focus(), 50);
}
ACT['st-add'] = () => {
  const i = $('#st-owner'); const n = i.value.trim();
  if (n && !setupOwners.some(x => norm(x) === norm(n)) && norm(n) !== 'tienda') { setupOwners.push(n); $('#st-owners').innerHTML = setupOwnersHTML(); }
  i.value = ''; i.focus();
};
KEY['st-owner'] = (t, e) => { if (e.key === 'Enter') { e.preventDefault(); ACT['st-add'](); } };
ACT['st-del'] = t => { setupOwners.splice(+t.dataset.i, 1); $('#st-owners').innerHTML = setupOwnersHTML(); };
ACT['st-go'] = async () => {
  const err = $('#st-err'); err.hidden = true;
  const pin = $('#st-pin').value.trim(), pin2 = $('#st-pin2').value.trim();
  const fail = m => { err.textContent = m; err.hidden = false; err.scrollIntoView({ block: 'center' }); };
  if (!$('#st-name').value.trim()) return fail('Escribe el nombre del negocio.');
  if (!/^\d{4,8}$/.test(pin)) return fail('El PIN debe tener de 4 a 8 números.');
  if (pin !== pin2) return fail('Los dos PIN no son iguales.');
  const pend = $('#st-owner').value.trim();
  if (pend) { ACT['st-add'](); }
  const c = cfg();
  c.storeName = $('#st-name').value.trim().toUpperCase();
  c.phones = { tienda: $('#st-ph1').value.trim(), mv: $('#st-ph2').value.trim() };
  await setPin(pin);
  put('owners', { id: 'own', name: 'Tienda', phone: c.phones.tienda, slot: 1, isStore: true, active: true });
  setupOwners.forEach(n => addOwner(n));
  c.accountingOwnerId = 'own';
  c.setupDone = true;
  saveCfg();
  if ($('#st-demo').checked) loadDemo();
  audit('Configuración inicial', 'Se configuró el sistema', {});
  hideGate();
  checkGates();
};

/* --- Abrir caja (obligatorio cada día) --- */
function renderOpenGate() {
  if (!$('#gate').hidden && $('#og-t')) return;
  const prev = lastClosedSession();
  const pc = prev ? prev.closing.counted : null;
  const hint = k => pc ? `Cerró ${prev.date === today() ? 'hoy' : fmtDate(prev.date)} con ${money(pc[k])}` : 'Cuenta lo que hay ahora y escríbelo';
  const val = k => pc ? pc[k].toFixed(2) : '';
  const field = (id, ico, title, k) => `<div class="bigfield"><div class="t">${ic(ico)} ${title}</div><div class="h">${hint(k)}</div>
    <div class="row nowrap"><span class="num" style="font-size:28px;font-weight:800">$</span><input class="in xl num-in" id="${id}" inputmode="decimal" value="${val(k)}" placeholder="0.00" data-key="og-next"></div></div>`;
  const hr = new Date().getHours();
  showGate(`<div><h1 id="og-t">${hr < 12 ? 'Buenos días' : hr < 19 ? 'Buenas tardes' : 'Buenas noches'}. Abre la caja para vender</h1>
    <p class="muted" style="margin:4px 0 0">${esc(fmtDateLong(today()))}. Cuenta el dinero y confirma. ${pc ? 'Los valores vienen del último cierre; corrígelos si no coinciden.' : ''}</p></div>
    <div class="muted sm" style="font-weight:700">LA TIENDA</div>
    ${field('og-tienda', 'cash', 'Efectivo de la tienda', 'tienda')}
    <div class="muted sm" style="font-weight:700">MI VECINO</div>
    ${field('og-mvcash', 'cash', 'Efectivo de Mi Vecino', 'mvCash')}
    <div class="grid g2">${field('og-pich', 'bank', 'Saldo cuenta Pichincha', 'pichincha')}${field('og-guay', 'bank', 'Saldo cuenta Guayaquil', 'guayaquil')}</div>
    <div id="og-err" class="alert bad" hidden></div>
    <button class="btn xl primary" data-act="og-go" id="og-btn">ABRIR CAJA E INICIAR</button>
    ${prev ? `<button class="btn" data-act="og-skip">Ver reportes y datos sin abrir la caja todavía</button>` : ''}${creditHTML()}`);
  setTimeout(() => { const f = $('#og-tienda'); f?.focus(); f?.select(); }, 60);
}
ACT['og-skip'] = () => { S.skipOpen = true; S.view = 'reportes'; hideGate(); renderAll(); };
ACT['open-gate'] = () => { S.skipOpen = false; S.view = 'vender'; checkGates(); };
KEY['og-next'] = (t, e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const ids = ['og-tienda', 'og-mvcash', 'og-pich', 'og-guay'];
  const i = ids.indexOf(t.id);
  if (i < ids.length - 1) { const n = $('#' + ids[i + 1]); n.focus(); n.select(); } else ACT['og-go']();
};
ACT['og-go'] = () => {
  const ids = ['og-tienda', 'og-mvcash', 'og-pich', 'og-guay'];
  const err = $('#og-err'); err.hidden = true;
  for (const id of ids) {
    const raw = $('#' + id).value.trim();
    if (raw === '' || isNaN(parseFloat(raw.replace(',', '.'))) || num(raw) < 0) {
      err.textContent = 'Escribe un valor en todos los campos (si no hay dinero, escribe 0).'; err.hidden = false; $('#' + id).focus(); return;
    }
  }
  const opening = { tienda: r2(num($('#og-tienda').value)), mvCash: r2(num($('#og-mvcash').value)), pichincha: r2(num($('#og-pich').value)), guayaquil: r2(num($('#og-guay').value)) };
  const prev = lastClosedSession();
  const s = put('sessions', { id: uid(), date: today(), openedAt: new Date().toISOString(), status: 'open', opening, openedBy: roleName(), closing: null });
  const diffs = [];
  if (prev) {
    const pc = prev.closing.counted;
    [['tienda', 'Efectivo tienda'], ['mvCash', 'Efectivo Mi Vecino'], ['pichincha', 'Saldo Pichincha'], ['guayaquil', 'Saldo Guayaquil']].forEach(([k, n]) => { if (r2(opening[k]) !== r2(pc[k])) diffs.push(`${n}: cierre ${money(pc[k])} → apertura ${money(opening[k])}`); });
  }
  audit('Caja abierta', `Apertura: tienda ${money(opening.tienda)}, Mi Vecino efectivo ${money(opening.mvCash)}, Pichincha ${money(opening.pichincha)}, Guayaquil ${money(opening.guayaquil)}${diffs.length ? '. Diferencias con el último cierre: ' + diffs.join('; ') : ''}`, { entity: 'session', entityId: s.id, edit: diffs.length > 0 });
  hideGate();
  S.view = 'vender';
  renderAll();
  toast(`Caja abierta. ¡Buen día de ventas!`, { type: 'ok' });
  focusScan();
};

/* --- Caja de un día anterior sin cerrar --- */
function renderStaleGate(ses) {
  showGate(`<div><h1>Falta cerrar la caja del ${esc(fmtDate(ses.date))}</h1><p class="muted" style="margin:4px 0 0">Para empezar un día nuevo, primero se cierra la caja que quedó abierta. Así los reportes de cada día quedan correctos.</p></div>
    <div class="alert warn">${ic('alert')}<span>Caja abierta el ${esc(fmtDateLong(ses.date))} a las ${fmtTime(ses.openedAt)}.</span></div>
    <button class="btn xl primary" data-act="stale-close">CERRAR CAJA DE ${esc(fmtDate(ses.date))}</button>${creditHTML()}`);
}
ACT['stale-close'] = () => { hideGate(); S.view = 'cierre'; renderAll(); };

/* ---------- Teclado global (lector de códigos) ---------- */
document.addEventListener('keydown', e => {
  if (S.view !== 'vender' || modalStack.length || !$('#gate').hidden) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tg = e.target;
  const typing = tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable);
  if (!typing && e.key.length === 1) { const el = $('#scan'); if (el) el.focus(); }
  if (e.key === 'F9') { e.preventDefault(); ACT['pos-fiado']?.(); }
  if (e.key === 'F12') { e.preventDefault(); ACT['pos-cobrar']?.(); }
  if (e.key === 'F2') { e.preventDefault(); $('#scan')?.focus(); }
});
