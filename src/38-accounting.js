/* =====================================================================
   CONTABILIDAD (un solo dueño la lleva; cada noche se le suma el saldo de ventas)
   ===================================================================== */
S.acc = { owner: null, kind: 'month', anchor: today(), from: today(), to: today() };
const ACC_TYPES = { ventas: 'Ventas del día', ingreso: 'Otro ingreso', gasto: 'Gasto', compra: 'Compra de mercadería' };
function accOwnerId() { return S.acc.owner || cfg().accountingOwnerId || (owners()[0] || {}).id; }
function accRows(oid, from, to) {
  let cum = 0;
  return accEntries(oid, from, to).map(e => { const u = r2((e.sales || 0) - (e.cost || 0) - (e.expense || 0)); cum = r2(cum + u); return { e, u, cum }; });
}
function accTotals(rows) { return { sales: r2(sum(rows, x => x.e.sales || 0)), cost: r2(sum(rows, x => x.e.cost || 0)), expense: r2(sum(rows, x => x.e.expense || 0)), profit: r2(sum(rows, x => x.u)) }; }
VIEWS.contab = {
  title: 'Contabilidad',
  render() {
    const a = S.acc; const oid = accOwnerId();
    const [from, to] = periodRange(a.kind, a.anchor, a.from, a.to);
    const rows = accRows(oid, from, to), t = accTotals(rows);
    const allT = accTotals(accRows(oid, '2000-01-01', '2999-12-31'));
    return `<div class="toolbar">
      <label class="row nowrap"><span class="sm muted" style="font-weight:700">Contabilidad de</span><select class="in" data-ch="acc-owner" style="min-width:180px">${owners().map(o => `<option value="${o.id}" ${o.id === oid ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label>
      <div class="seg">${[['month', 'Mes'], ['year', 'Año'], ['range', 'Rango']].map(([k, n]) => `<button data-act="acc-kind" data-k="${k}" aria-pressed="${a.kind === k}">${n}</button>`).join('')}</div>
      ${a.kind !== 'range' ? `<button class="btn icon" data-act="acc-shift" data-d="-1" aria-label="Anterior">‹</button><b style="min-width:150px;text-align:center">${esc(periodLabel(a.kind, from, to))}</b><button class="btn icon" data-act="acc-shift" data-d="1" aria-label="Siguiente">›</button>`
        : `<input class="in" type="date" data-ch="acc-from" value="${a.from}" style="max-width:155px"><span>a</span><input class="in" type="date" data-ch="acc-to" value="${a.to}" style="max-width:155px">`}
      <span class="sp"></span>
      <button class="btn" data-act="acc-day">${ic('cal')} Sumar un día de ventas</button>
      <button class="btn primary" data-act="acc-new">${ic('plus')} Registrar</button>
      <button class="btn" data-act="acc-pdf">${ic('down')} PDF</button>
    </div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr));margin-bottom:12px">
      ${kpi('Ventas', money(t.sales), null)}${kpi('Costo de mercadería', money(t.cost), null)}${kpi('Gastos', money(t.expense), null)}${kpi('Utilidad del período', money(t.profit), null, 'hero')}${kpi('Utilidad acumulada total', money(allT.profit), null)}
    </div>
    ${rows.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Concepto</th><th class="r">Ventas</th><th class="r">Costo</th><th class="r">Gastos</th><th class="r">Utilidad</th><th class="r hide-m">Acumulado</th><th></th></tr></thead><tbody>${rows.map(({ e, u, cum }) => `<tr><td>${fmtDate(e.date)}</td><td>${esc(e.concept)}<div class="xs muted">${ACC_TYPES[e.type] || ''}${e.source === 'cierre' ? ' · desde el cierre de caja' : ''}</div></td><td class="r num">${e.sales ? money(e.sales) : '—'}</td><td class="r num">${e.cost ? money(e.cost) : '—'}</td><td class="r num">${e.expense ? money(e.expense) : '—'}</td><td class="r num"><b style="color:${u < 0 ? 'var(--danger)' : 'inherit'}">${money(u)}</b></td><td class="r num hide-m muted">${money(cum)}</td><td class="r nowrap"><button class="btn ghost sm icon" data-act="acc-edit" data-id="${e.id}" aria-label="Editar">${ic('edit', 'sm')}</button><button class="btn ghost sm icon" data-act="acc-del" data-id="${e.id}" aria-label="Eliminar">${ic('trash', 'sm')}</button></td></tr>`).join('')}</tbody><tfoot><tr><td colspan="2">Total</td><td class="r num">${money(t.sales)}</td><td class="r num">${money(t.cost)}</td><td class="r num">${money(t.expense)}</td><td class="r num">${money(t.profit)}</td><td class="hide-m"></td><td></td></tr></tfoot></table></div>`
        : `<div class="empty card">${ic('book')}<div style="font-weight:700">No hay registros en este período para ${esc(ownerName(oid))}.</div><div>Al cerrar la caja cada noche, el sistema pregunta si se suma el saldo de ventas de un dueño.</div></div>`}`;
  },
};
CHG['acc-owner'] = t => { S.acc.owner = t.value; cfg().accountingOwnerId = t.value; saveCfg(); renderView(); };
ACT['acc-kind'] = t => { S.acc.kind = t.dataset.k; if (S.acc.kind === 'range') { const [f, to] = periodRange('month', S.acc.anchor); S.acc.from = f; S.acc.to = to; } renderView(); };
ACT['acc-shift'] = t => { S.acc.anchor = shiftAnchor(S.acc.kind, S.acc.anchor, +t.dataset.d); renderView(); };
CHG['acc-from'] = t => { if (t.value) { S.acc.from = t.value; renderView(); } };
CHG['acc-to'] = t => { if (t.value) { S.acc.to = t.value; renderView(); } };
function accForm(e) {
  const edit = !!e;
  const d = e || { date: today(), type: 'gasto', concept: '', sales: 0, cost: 0, expense: 0 };
  const amount = d.type === 'gasto' ? d.expense : d.type === 'compra' ? d.cost : d.sales;
  modal({
    title: edit ? 'Editar registro' : 'Registrar en contabilidad', size: '',
    html: `<div class="col"><label class="f">Tipo<select class="in" id="ac-type">${[['ingreso', 'Ingreso (venta u otro ingreso)'], ['gasto', 'Gasto'], ['compra', 'Compra de mercadería'], ['ventas', 'Ventas del día (con costo)']].map(([k, n]) => `<option value="${k}" ${d.type === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="f">Fecha<input class="in" type="date" id="ac-date" value="${d.date}"></label>
      <label class="f">Concepto<input class="in" id="ac-concept" value="${esc(d.concept)}" placeholder="Ej.: pago de luz" autofocus></label>
      <div class="grid g2"><label class="f" id="ac-w1">Monto<input class="in xl num-in" id="ac-amt" inputmode="decimal" value="${amount ? amount.toFixed(2) : ''}"></label>
      <label class="f" id="ac-w2" hidden>Costo de esas ventas<input class="in num-in" id="ac-cost" inputmode="decimal" value="${d.cost ? d.cost.toFixed(2) : ''}"></label></div></div>`,
    actions: [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: h => {
      const type = h.$('#ac-type').value, amt = r2(num(h.$('#ac-amt').value)), concept = h.$('#ac-concept').value.trim();
      if (!concept) { toast('Escribe el concepto', { type: 'warn' }); return false; }
      if (!(amt > 0)) { toast('Escribe el monto', { type: 'warn' }); return false; }
      const f = { date: h.$('#ac-date').value || today(), type, concept, sales: 0, cost: 0, expense: 0, ownerId: edit ? d.ownerId : accOwnerId() };
      if (type === 'gasto') f.expense = amt; else if (type === 'compra') f.cost = amt; else { f.sales = amt; if (type === 'ventas') f.cost = r2(num(h.$('#ac-cost').value)); }
      if (edit) { const before = JSON.parse(JSON.stringify(e)); Object.assign(e, f); put('accounting', e); audit('Contabilidad modificada', `${concept}: ${money(before.sales - before.cost - before.expense)} → ${money(f.sales - f.cost - f.expense)}`, { entity: 'accounting', entityId: e.id, edit: true }); }
      else { addAccounting(f); audit('Contabilidad', `Registro "${concept}" para ${ownerName(f.ownerId)}`, { entity: 'accounting' }); }
      toast('Guardado', { type: 'ok' }); renderView();
    } }],
    onOpen: h => {
      const upd = () => { const t = h.$('#ac-type').value; h.$('#ac-w2').hidden = t !== 'ventas'; h.$('#ac-w1').firstChild.textContent = t === 'gasto' ? 'Monto del gasto' : t === 'compra' ? 'Monto de la compra' : 'Monto de ventas / ingreso'; };
      h.$('#ac-type').addEventListener('change', upd); upd();
    },
  });
}
ACT['acc-new'] = () => accForm(null);
ACT['acc-edit'] = t => { const e = get('accounting', t.dataset.id); if (e) accForm(e); };
ACT['acc-del'] = async t => {
  const e = get('accounting', t.dataset.id); if (!e) return;
  if (!(await ask({ title: 'Eliminar registro', msg: `¿Eliminar «${e.concept}»? Queda anotado en el historial de cambios.`, ok: 'Eliminar', danger: true }))) return;
  del('accounting', e.id);
  audit('Contabilidad eliminada', `Se eliminó "${e.concept}" (${money(e.sales - e.cost - e.expense)})`, { entity: 'accounting', entityId: e.id, edit: true });
  renderView();
};
ACT['acc-day'] = () => {
  const oid = accOwnerId();
  const ss = sessionsSorted().filter(s => s.status === 'closed').reverse().slice(0, 60);
  if (!ss.length) { toast('Aún no hay cajas cerradas', { type: 'warn' }); return; }
  modal({
    title: `Sumar ventas de un día · ${ownerName(oid)}`, size: '',
    html: `<p class="muted" style="margin:0 0 8px">Útil si un día no se añadió al cerrar la caja.</p><label class="f">Día<select class="in" id="ad-ses">${ss.map(s => { const f = ownerDayFigures(oid, s.id); const done = accEntries(oid, s.date, s.date).some(e => e.sessionId === s.id && e.source === 'cierre'); return `<option value="${s.id}">${fmtDate(s.date)} · ${money(f.rev)}${done ? ' (ya añadido)' : ''}</option>`; }).join('')}</select></label>`,
    actions: [{ label: 'Cancelar' }, { label: 'Añadir', cls: 'primary', onClick: h => {
      const s = get('sessions', h.$('#ad-ses').value); const f = ownerDayFigures(oid, s.id);
      if (accEntries(oid, s.date, s.date).some(e => e.sessionId === s.id && e.source === 'cierre')) { toast('Ese día ya está en la contabilidad de este dueño', { type: 'warn' }); return false; }
      addAccounting({ date: s.date, ownerId: oid, type: 'ventas', concept: `Ventas del día ${fmtDate(s.date)}`, sales: f.rev, cost: f.cost, sessionId: s.id, source: 'cierre' });
      audit('Contabilidad', `Se añadieron las ventas del ${fmtDate(s.date)} (${money(f.rev)}) a ${ownerName(oid)}`, { entity: 'accounting' });
      toast('Día añadido', { type: 'ok' }); renderView();
    } }],
  });
};
ACT['acc-pdf'] = async () => {
  const a = S.acc; const oid = accOwnerId(); const [from, to] = periodRange(a.kind, a.anchor, a.from, a.to);
  const rows = accRows(oid, from, to), t = accTotals(rows);
  const m = {
    store: cfg().storeName, title: `Contabilidad de ${ownerName(oid)}`, period: from === to ? fmtDateLong(from) : `Del ${fmtDate(from)} al ${fmtDate(to)}`, from, to, generated: new Date().toISOString(), filename: `contabilidad-${slug(ownerName(oid))}-${from}_${to}.pdf`,
    sections: [{ title: 'Resumen', kv: [['Ventas', money(t.sales)], ['Costo de mercadería', money(t.cost)], ['Gastos', money(t.expense)], ['Utilidad del período', money(t.profit), true]] },
      { title: 'Registros', table: { head: ['Fecha', 'Concepto', 'Ventas', 'Costo', 'Gastos', 'Utilidad'], align: ['l', 'l', 'r', 'r', 'r', 'r'], rows: rows.map(({ e, u }) => [fmtDate(e.date), e.concept, e.sales ? money(e.sales) : '—', e.cost ? money(e.cost) : '—', e.expense ? money(e.expense) : '—', money(u)]), foot: ['Total', '', money(t.sales), money(t.cost), money(t.expense), money(t.profit)] } }],
  };
  const r = await saveFile(m.filename, reportBlob(m));
  if (r === 'saved') toast('PDF listo', { type: 'ok' });
};
