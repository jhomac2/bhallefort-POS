/* =====================================================================
   HISTORIAL DE CAMBIOS y AJUSTES (respaldo, dueños, PIN, Mi Vecino)
   ===================================================================== */
S.audit.q = '';
VIEWS.cambios = {
  title: 'Historial de cambios',
  render() {
    const a = S.audit;
    const all = list('audit').filter(x => x.date >= a.from && x.date <= a.to && (a.only !== 'edits' || x.edit));
    const q = norm(a.q);
    const arr = all.filter(x => !q || norm(x.summary + ' ' + x.action).includes(q)).sort((x, y) => x.ts < y.ts ? 1 : -1);
    const edits = all.filter(x => x.edit).length;
    return `<div class="toolbar">
      <input class="in" type="date" data-ch="aud-from" value="${a.from}" style="max-width:160px" aria-label="Desde"><span>a</span><input class="in" type="date" data-ch="aud-to" value="${a.to}" style="max-width:160px" aria-label="Hasta">
      <button class="btn" data-act="aud-range" data-r="today">Hoy</button><button class="btn" data-act="aud-range" data-r="week">Semana</button><button class="btn" data-act="aud-range" data-r="month">Mes</button>
      <div class="seg"><button data-act="aud-only" data-o="edits" aria-pressed="${a.only === 'edits'}">Solo modificaciones</button><button data-act="aud-only" data-o="all" aria-pressed="${a.only === 'all'}">Todo</button></div>
      <input class="in" id="aud-q" data-in="aud-q" placeholder="Buscar" style="flex:1;min-width:140px" value="${esc(a.q)}">
      <button class="btn" data-act="aud-pdf">${ic('down')} PDF</button>
    </div>
    <div class="alert ${edits ? 'warn' : 'ok'}" style="margin-bottom:12px">${ic(edits ? 'alert' : 'check')}<span>${edits ? `<b>${edits}</b> modificación${edits > 1 ? 'es' : ''} en este período (precios, ventas corregidas o anuladas, movimientos eliminados).` : 'No hay modificaciones en este período.'} Aquí queda guardado quién cambió qué y a qué hora. No se puede borrar.</span></div>
    <div id="aud-table">${auditTable(arr)}</div>`;
  },
};
function auditTable(arr) {
  if (!arr.length) return `<div class="empty card">${ic('history')}<div>No hay registros con este filtro.</div></div>`;
  return `<div class="tblwrap"><table class="tbl"><thead><tr><th>Fecha y hora</th><th>Quién</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>${arr.slice(0, 300).map(x => `<tr><td class="nowrap">${fmtDT(x.ts)}</td><td>${esc(x.user)}</td><td>${x.edit ? '<span class="badge warn">Modificación</span>' : '<span class="badge">Registro</span>'}<div class="xs muted">${esc(x.action)}</div></td><td>${esc(x.summary)}</td></tr>`).join('')}</tbody></table></div>${arr.length > 300 ? `<p class="muted center">Se muestran 300 de ${arr.length}. Acorta el período para ver el resto.</p>` : ''}`;
}
CHG['aud-from'] = t => { if (t.value) { S.audit.from = t.value; if (S.audit.to < t.value) S.audit.to = t.value; renderView(); } };
CHG['aud-to'] = t => { if (t.value) { S.audit.to = t.value; if (S.audit.from > t.value) S.audit.from = t.value; renderView(); } };
INP['aud-q'] = t => { S.audit.q = t.value; const arr = list('audit').filter(x => x.date >= S.audit.from && x.date <= S.audit.to && (S.audit.only !== 'edits' || x.edit)); const q = norm(t.value); $('#aud-table').innerHTML = auditTable(arr.filter(x => !q || norm(x.summary + ' ' + x.action).includes(q)).sort((x, y) => x.ts < y.ts ? 1 : -1)); };
ACT['aud-only'] = t => { S.audit.only = t.dataset.o; renderView(); };
ACT['aud-range'] = t => { const r = t.dataset.r; const [a, b] = r === 'today' ? [today(), today()] : periodRange(r, today()); S.audit.from = a; S.audit.to = b; renderView(); };
ACT['aud-pdf'] = async () => {
  const a = S.audit; const arr = list('audit').filter(x => x.date >= a.from && x.date <= a.to && (a.only !== 'edits' || x.edit)).sort((x, y) => x.ts < y.ts ? -1 : 1);
  const m = { store: cfg().storeName, title: a.only === 'edits' ? 'Historial de modificaciones' : 'Historial de cambios', period: `Del ${fmtDate(a.from)} al ${fmtDate(a.to)}`, from: a.from, to: a.to, generated: new Date().toISOString(), filename: `historial-cambios-${a.from}_${a.to}.pdf`, sections: [{ title: `${arr.length} registros`, table: { head: ['Fecha y hora', 'Quién', 'Acción', 'Detalle'], align: ['l', 'l', 'l', 'l'], rows: arr.map(x => [fmtDT(x.ts), x.user, x.action, x.summary]) } }] };
  const r = await saveFile(m.filename, reportBlob(m)); if (r === 'saved') toast('PDF listo', { type: 'ok' });
};

/* ---------- Respaldo ---------- */
async function exportBackup() {
  const data = {}; STORES.forEach(s => { data[s] = list(s); });
  const payload = { app: 'bhalleffort', version: 1, exportedAt: new Date().toISOString(), data };
  const r = await saveFile(`bhalleffort-respaldo-${today()}.json`, JSON.stringify(payload));
  if (r === 'saved') { const c = cfg(); c.lastBackup = new Date().toISOString(); saveCfg(); toast('Respaldo guardado. Guárdalo en un lugar seguro.', { type: 'ok' }); renderTop(); }
}
function restoreBackup(text) {
  const p = JSON.parse(text);
  if (!p || p.app !== 'bhalleffort' || !p.data) throw new Error('Este archivo no es un respaldo de Bhalleffort');
  wipeAll();
  STORES.forEach(s => (p.data[s] || []).forEach(o => put(s, o)));
}

/* ---------- Ajustes ---------- */
VIEWS.ajustes = {
  title: 'Ajustes',
  render() {
    const c = cfg(); const mv = c.mv;
    const days = c.lastBackup ? Math.floor((Date.now() - new Date(c.lastBackup)) / 86400000) : null;
    const noData = !list('sales').length && !products().length;
    return `<div class="grid g2" style="align-items:start">
      <div class="col">
        <div class="card"><h3>Negocio</h3><div class="col">
          <label class="f">Nombre<input class="in" data-ch="set-store" value="${esc(c.storeName)}"></label>
          <div class="grid g2"><label class="f">WhatsApp del dueño de la tienda<input class="in" data-ch="set-ph" data-k="tienda" inputmode="tel" value="${esc(c.phones.tienda)}" placeholder="09XXXXXXXX"></label><label class="f">WhatsApp del dueño de Mi Vecino<input class="in" data-ch="set-ph" data-k="mv" inputmode="tel" value="${esc(c.phones.mv)}" placeholder="09XXXXXXXX"></label></div>
          <label class="f">Dueño que lleva la contabilidad<select class="in" data-ch="set-accowner">${owners().map(o => `<option value="${o.id}" ${o.id === c.accountingOwnerId ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label>
          <label class="chk"><input type="checkbox" data-ch="set-snd" ${c.sound !== false ? 'checked' : ''}> Sonido al pasar un producto por el lector</label>
          <label class="chk"><input type="checkbox" data-ch="set-inv" ${c.invoiceAsk ? 'checked' : ''}> Permitir anotar datos para factura del SRI en la venta</label>
          <p class="muted xs" style="margin:0">La factura electrónica del SRI se emite aparte en el portal del SRI (requiere firma electrónica). Aquí solo se guardan la cédula/RUC y el nombre del cliente junto a la venta.</p></div></div>
        <div class="card"><h3>Seguridad</h3><div class="col"><button class="btn" data-act="set-pin">${ic('lock')} Cambiar PIN del dueño</button>
          <label class="f">Bloquear el modo dueño tras (minutos sin usar)<input class="in" style="max-width:120px" inputmode="numeric" data-ch="set-lock" value="${c.lockMinutes}"></label></div></div>
        <div class="card"><h3>Mi Vecino</h3><p class="muted sm" style="margin:-4px 0 8px">Comisión que ganas por cada operación (déjala en 0 si no quieres registrarla).</p>
          <div class="tblwrap"><table class="tbl"><thead><tr><th></th><th class="r">Depósito</th><th class="r">Retiro</th><th class="r">Servicio</th><th class="r">Avisar si el saldo baja de</th></tr></thead><tbody>${['pichincha', 'guayaquil'].map(b => `<tr><td><b>${bankBadge(b)} ${BANKS[b].name}</b></td>${['deposito', 'retiro', 'servicio'].map(t => `<td><input class="in sm num-in" style="width:80px" data-ch="set-com" data-b="${b}" data-t="${t}" inputmode="decimal" value="${mv.commission[b][t].toFixed(2)}"></td>`).join('')}<td><input class="in sm num-in" style="width:90px" data-ch="set-low" data-b="${b}" inputmode="decimal" value="${mv.lowBank[b]}"></td></tr>`).join('')}</tbody></table></div>
          <label class="chk" style="margin-top:8px"><input type="checkbox" data-ch="set-comcash" ${mv.commissionInCash ? 'checked' : ''}> La comisión se cobra en efectivo al cliente (suma al efectivo de Mi Vecino)</label>
          <label class="f" style="margin-top:6px">Avisar si el efectivo de Mi Vecino pasa de<input class="in" style="max-width:140px" inputmode="decimal" data-ch="set-high" value="${mv.highCash}"></label></div>
      </div>
      <div class="col">
        <div class="card"><div class="row"><h3 style="margin:0">Dueños de productos</h3><span class="sp"></span><button class="btn primary sm" data-act="own-add">${ic('plus', 'sm')} Agregar dueño</button></div>
          <p class="muted sm" style="margin:4px 0 8px">Sin límite de dueños. Cada producto se asigna a su dueño y los reportes muestran las ventas y ganancias de cada uno.</p>
          <div class="tblwrap"><table class="tbl"><tbody>${allOwners().sort((a, b) => (b.isStore ? 1 : 0) - (a.isStore ? 1 : 0) || a.name.localeCompare(b.name)).map(o => { const n = products().filter(p => p.ownerId === o.id && p.active !== false).length; return `<tr><td>${ownerPill(o.id)}${o.isStore ? ' <span class="badge">la tienda</span>' : ''}${o.active === false ? ' <span class="badge bad">desactivado</span>' : ''}<div class="xs muted">${esc(o.phone || 'sin WhatsApp')}</div></td><td class="r">${n} producto${n === 1 ? '' : 's'}</td><td class="r nowrap"><button class="btn ghost sm" data-act="own-edit" data-id="${o.id}">${ic('edit', 'sm')}</button>${o.isStore ? '' : `<button class="btn ghost sm" data-act="own-off" data-id="${o.id}">${o.active === false ? 'Reactivar' : 'Desactivar'}</button>`}</td></tr>`; }).join('')}</tbody></table></div></div>
        <div class="card"><h3>Respaldo de los datos</h3>
          <div class="alert ${days === null || days >= 7 ? 'warn' : 'ok'}" style="margin-bottom:10px">${ic(days === null || days >= 7 ? 'alert' : 'check')}<span>${days === null ? 'Aún no has descargado un respaldo.' : days === 0 ? 'Último respaldo: hoy.' : `Último respaldo: hace ${days} día${days > 1 ? 's' : ''}.`} Los datos se guardan en este navegador; descarga un respaldo cada semana.</span></div>
          <div class="row"><button class="btn primary" data-act="bk-export">${ic('down')} Descargar respaldo</button><label class="btn" style="cursor:pointer">${ic('up')} Restaurar respaldo<input type="file" accept=".json,application/json" data-ch="bk-file" hidden></label></div></div>
        <div class="card"><h3>Datos</h3><div class="col">
          ${noData ? `<button class="btn" data-act="demo">Cargar datos de ejemplo (productos y 3 semanas de ventas)</button>` : ''}
          <button class="btn soft-danger" data-act="wipe">${ic('trash')} Borrar todos los datos</button></div></div>
        <div class="card flat tint"><b>${esc(CREDIT)}</b><div class="sm muted">Bhalleffort · sistema de ventas para tienda de abarrotes.</div><a href="${CREDIT_URL}" target="_blank" rel="noopener" class="btn sm" style="margin-top:8px">${ic('link', 'sm')} TikTok @mr_jhordy21</a></div>
      </div>
    </div>`;
  },
};
CHG['set-store'] = t => { const c = cfg(); c.storeName = t.value.trim().toUpperCase() || 'BHALLEFFORT'; saveCfg(); renderNav(); toast('Guardado', { type: 'ok', ms: 1200 }); };
CHG['set-ph'] = t => { const c = cfg(); c.phones[t.dataset.k] = t.value.trim(); saveCfg(); const o = get('owners', 'own'); if (t.dataset.k === 'tienda' && o) { o.phone = t.value.trim(); put('owners', o); } toast('Guardado', { type: 'ok', ms: 1200 }); };
CHG['set-accowner'] = t => { const c = cfg(); c.accountingOwnerId = t.value; saveCfg(); toast('Guardado', { type: 'ok', ms: 1200 }); };
CHG['set-snd'] = t => { const c = cfg(); c.sound = t.checked; saveCfg(); };
CHG['set-inv'] = t => { const c = cfg(); c.invoiceAsk = t.checked; saveCfg(); };
CHG['set-lock'] = t => { const c = cfg(); c.lockMinutes = clamp(Math.round(num(t.value)) || 10, 1, 240); saveCfg(); t.value = c.lockMinutes; toast('Guardado', { type: 'ok', ms: 1200 }); };
CHG['set-com'] = t => { const c = cfg(); c.mv.commission[t.dataset.b][t.dataset.t] = r2(Math.max(0, num(t.value))); saveCfg(); t.value = c.mv.commission[t.dataset.b][t.dataset.t].toFixed(2); toast('Guardado', { type: 'ok', ms: 1200 }); };
CHG['set-low'] = t => { const c = cfg(); c.mv.lowBank[t.dataset.b] = Math.max(0, num(t.value)); saveCfg(); renderMV(); toast('Guardado', { type: 'ok', ms: 1200 }); };
CHG['set-high'] = t => { const c = cfg(); c.mv.highCash = Math.max(0, num(t.value)); saveCfg(); renderMV(); toast('Guardado', { type: 'ok', ms: 1200 }); };
CHG['set-comcash'] = t => { const c = cfg(); c.mv.commissionInCash = t.checked; saveCfg(); };
ACT['set-pin'] = async () => {
  if (!(await askPin('PIN actual', 'Escribe tu PIN actual'))) return;
  modal({
    title: 'Nuevo PIN', size: 'narrow', html: `<div class="col"><label class="f">Nuevo PIN (4 a 8 números)<input class="in lg" id="np1" type="password" inputmode="numeric" maxlength="8" autofocus></label><label class="f">Repítelo<input class="in lg" id="np2" type="password" inputmode="numeric" maxlength="8"></label></div>`,
    actions: [{ label: 'Cancelar' }, { label: 'Cambiar PIN', cls: 'primary', onClick: async h => { const a = h.$('#np1').value, b = h.$('#np2').value; if (!/^\d{4,8}$/.test(a)) { toast('El PIN debe tener de 4 a 8 números', { type: 'warn' }); return false; } if (a !== b) { toast('Los PIN no son iguales', { type: 'warn' }); return false; } await setPin(a); audit('PIN cambiado', 'Se cambió el PIN del dueño', {}); toast('PIN cambiado', { type: 'ok' }); } }],
  });
};
function ownerForm(o) {
  const edit = !!o;
  const d = o || { name: '', phone: '', slot: nextSlot() };
  modal({
    title: edit ? `Editar a ${o.name}` : 'Agregar dueño de productos', size: 'narrow',
    html: `<div class="col"><label class="f">Nombre<input class="in lg" id="ow-n" value="${esc(d.name)}" autofocus></label><label class="f">WhatsApp (para enviarle su reporte)<input class="in" id="ow-p" inputmode="tel" value="${esc(d.phone || '')}"></label>
      <div class="f"><span>Color</span><div class="row">${[1, 2, 3, 4, 5, 6, 7, 8].map(i => `<label style="cursor:pointer"><input type="radio" name="ow-c" value="${i}" ${i === d.slot ? 'checked' : ''} hidden><span class="dot" style="width:28px;height:28px;background:var(--c${i});outline:${i === d.slot ? '3px solid var(--ink)' : '0'};outline-offset:2px" data-slot="${i}"></span></label>`).join('')}</div></div></div>`,
    actions: [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: h => {
      const n = h.$('#ow-n').value.trim(); if (!n) { toast('Escribe el nombre', { type: 'warn' }); return false; }
      if (allOwners().some(x => norm(x.name) === norm(n) && (!o || x.id !== o.id))) { toast('Ya existe un dueño con ese nombre', { type: 'warn' }); return false; }
      const slot = +(h.el.querySelector('input[name="ow-c"]:checked')?.value || d.slot);
      if (edit) { const old = o.name; o.name = n; o.phone = h.$('#ow-p').value.trim(); o.slot = slot; put('owners', o); audit('Dueño modificado', `${old}${old !== n ? ' → ' + n : ''}`, { entity: 'owner', entityId: o.id }); }
      else { const x = addOwner(n, h.$('#ow-p').value); x.slot = slot; put('owners', x); }
      toast('Guardado', { type: 'ok' }); renderView();
    } }],
    onOpen: h => { h.$('#ow-n').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); h.el.querySelector('footer .primary').click(); } }); h.el.addEventListener('click', e => { const s = e.target.closest('[data-slot]'); if (!s) return; $$('[data-slot]', h.el).forEach(x => { x.style.outline = x === s ? '3px solid var(--ink)' : '0'; }); h.el.querySelector(`input[name="ow-c"][value="${s.dataset.slot}"]`).checked = true; }); },
  });
}
ACT['own-add'] = () => ownerForm(null);
ACT['own-edit'] = t => ownerForm(get('owners', t.dataset.id));
ACT['own-off'] = t => {
  const o = get('owners', t.dataset.id); if (!o) return;
  if (o.active === false) { o.active = true; put('owners', o); renderView(); return; }
  const n = products().filter(p => p.ownerId === o.id && p.active !== false).length;
  if (n) { toast(`${o.name} tiene ${n} productos activos. Cámbialos de dueño o desactívalos primero.`, { type: 'warn', ms: 5000 }); return; }
  o.active = false; put('owners', o); audit('Dueño desactivado', o.name, { entity: 'owner', entityId: o.id }); renderView();
};
ACT['bk-export'] = () => exportBackup();
CHG['bk-file'] = async t => {
  const f = t.files[0]; if (!f) return;
  const txt = await f.text();
  try {
    JSON.parse(txt);
    if (!(await ask({ title: 'Restaurar respaldo', msg: 'Se reemplazarán TODOS los datos actuales por los del respaldo. ¿Continuar?', ok: 'Sí, restaurar', danger: true }))) { t.value = ''; return; }
    restoreBackup(txt);
    toast('Respaldo restaurado', { type: 'ok' });
    S.owner = false; S.cart = []; S.view = 'vender';
    if (!checkGates()) renderAll();
  } catch (e) { toast('No se pudo restaurar: ' + e.message, { type: 'bad', ms: 6000 }); }
  t.value = '';
};
ACT['demo'] = async () => { if (await ask({ title: 'Datos de ejemplo', msg: 'Se agregarán productos, dueños y 3 semanas de ventas de ejemplo para que pruebes el sistema. Luego puedes borrarlos con «Borrar todos los datos».', ok: 'Cargar' })) { loadDemo(); S.view = 'vender'; if (!checkGates()) renderAll(); toast('Datos de ejemplo cargados', { type: 'ok' }); } };
ACT['wipe'] = () => {
  modal({
    title: 'Borrar todos los datos', size: 'narrow',
    html: `<div class="alert bad">${ic('alert')}<span>Se borrarán productos, ventas, cajas, fiados y contabilidad. Esto no se puede deshacer. Descarga un respaldo antes.</span></div><label class="f" style="margin-top:10px">Escribe <b>BORRAR</b> para confirmar<input class="in lg" id="wp-t" autofocus autocomplete="off"></label>`,
    actions: [{ label: 'Cancelar' }, { label: 'Borrar todo', cls: 'danger', onClick: h => {
      if (h.$('#wp-t').value.trim().toUpperCase() !== 'BORRAR') { toast('Escribe BORRAR para confirmar', { type: 'warn' }); return false; }
      wipeAll(); S.owner = false; S.cart = []; S.held = []; persistCart(); S.view = 'vender';
      toast('Datos borrados'); if (!checkGates()) renderAll();
    } }],
  });
};
