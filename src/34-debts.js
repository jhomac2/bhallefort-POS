/* =====================================================================
   FIADOS: deudas de clientes y cobros (el fiado NO suma a la caja hasta cobrarlo)
   ===================================================================== */
S.debtAll = false;
VIEWS.fiados = {
  title: 'Fiados',
  render() {
    const tot = totalDebt();
    const withDebt = customers().filter(c => customerDebt(c.id) > 0);
    return `<div class="grid g3" style="margin-bottom:12px">
      <div class="card kpi hero"><span class="l">Saldo de deudas por cobrar</span><span class="v">${money(tot)}</span><span class="d eq">No está sumado al efectivo de la caja</span></div>
      <div class="card kpi"><span class="l">Clientes que deben</span><span class="v">${withDebt.length}</span></div>
      <div class="card kpi"><span class="l">Cobrado hoy de fiados</span><span class="v">${money(curSession() ? sessionSummary(curSession().id).debtCollected : 0)}</span><span class="d eq">Sí entra al efectivo de hoy</span></div>
    </div>
    <div class="toolbar"><input class="in" id="debt-q" data-in="debt-q" placeholder="Buscar cliente" style="flex:1;min-width:200px" value="${esc(S.debtQ)}">
      <label class="chk"><input type="checkbox" data-ch="debt-all" ${S.debtAll ? 'checked' : ''}> Mostrar también los que no deben</label>
      <button class="btn primary" data-act="cust-new">${ic('plus')} Nuevo cliente</button></div>
    <div id="debt-table"></div>`;
  },
  after() { drawDebts(); },
};
function drawDebts() {
  const el = $('#debt-table'); if (!el) return;
  const q = norm(S.debtQ);
  const arr = customers().map(c => ({ c, d: customerDebt(c.id) })).filter(x => (S.debtAll || x.d > 0) && (!q || norm(x.c.name).includes(q))).sort((a, b) => b.d - a.d);
  if (!arr.length) { el.innerHTML = `<div class="empty card">${ic('users')}<div style="font-weight:700">${customers().length ? 'No hay clientes con deuda.' : 'Aún no hay clientes.'}</div><div>Los clientes se crean al vender a fiado en la pantalla Vender.</div></div>`; return; }
  el.innerHTML = `<div class="tblwrap"><table class="tbl"><thead><tr><th>Cliente</th><th class="hide-m">Teléfono</th><th class="hide-m">Compra más antigua sin pagar</th><th class="r">Debe</th><th></th></tr></thead><tbody>${arr.map(({ c, d }) => {
    const old = fiadoSalesOf(c.id).filter(s => saleDebt(s) > 0).sort((a, b) => a.ts < b.ts ? -1 : 1)[0];
    return `<tr><td><b>${esc(c.name)}</b></td><td class="hide-m">${esc(c.phone || '—')}</td><td class="hide-m">${old ? fmtDate(old.date) : '—'}</td><td class="r num"><b style="font-size:17px;${d > 0 ? 'color:var(--danger)' : ''}">${money(d)}</b></td>
      <td class="r nowrap"><button class="btn sm primary" data-act="debt-pay" data-id="${c.id}" ${d > 0 ? '' : 'disabled'}>${ic('cash', 'sm')} Cobrar</button> <button class="btn sm" data-act="debt-view" data-id="${c.id}">Ver</button></td></tr>`;
  }).join('')}</tbody></table></div>`;
}
INP['debt-q'] = t => { S.debtQ = t.value; drawDebts(); };
CHG['debt-all'] = t => { S.debtAll = t.checked; drawDebts(); };
ACT['cust-new'] = () => {
  modal({
    title: 'Cliente nuevo', size: 'narrow', html: `<div class="col"><label class="f">Nombre<input class="in lg" id="cn-n" autofocus></label><label class="f">Teléfono (opcional)<input class="in" id="cn-t" inputmode="tel"></label></div>`,
    actions: [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: h => { const n = h.$('#cn-n').value.trim(); if (!n) { toast('Escribe el nombre', { type: 'warn' }); return false; } addCustomer(n, h.$('#cn-t').value); if (S.view === 'fiados') renderView(); } }],
  });
};
ACT['debt-pay'] = t => {
  const c = get('customers', t.dataset.id); if (!c) return;
  if (!curSession()) { toast('Abre la caja para cobrar', { type: 'bad' }); return; }
  const d = customerDebt(c.id);
  modal({
    title: `Cobrar a ${c.name}`, size: 'narrow',
    html: `<div class="col"><div class="alert warn">${ic('coin')}<span>Debe <b class="num">${money(d)}</b></span></div>
      <label class="f">¿Cuánto paga ahora?<input class="in xl num-in" id="dp-amt" inputmode="decimal" value="${d.toFixed(2)}" autofocus></label>
      <p class="muted sm" style="margin:0">Este dinero entra al efectivo de la caja de hoy. Si paga menos, queda el resto como deuda.</p></div>`,
    actions: [{ label: 'Cancelar' }, { label: 'Registrar cobro', cls: 'primary', onClick: h => {
      const a = r2(num(h.$('#dp-amt').value));
      if (!(a > 0)) { toast('Escribe el monto', { type: 'warn' }); return false; }
      if (a > d) { toast(`No puede pagar más de lo que debe (${money(d)})`, { type: 'warn' }); return false; }
      payDebt(c.id, a); toast(`Cobro registrado: ${money(a)}`, { type: 'ok' }); renderTop(); if (S.view === 'fiados') renderView(); if (S.view === 'caja') renderView();
    } }],
    onOpen: h => h.$('#dp-amt').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); h.el.querySelector('footer .primary').click(); } }),
  });
};
ACT['debt-view'] = t => {
  const c = get('customers', t.dataset.id); if (!c) return;
  const sales = fiadoSalesOf(c.id).sort((a, b) => a.ts < b.ts ? 1 : -1);
  const pays = list('debtPayments').filter(p => p.customerId === c.id).sort((a, b) => a.ts < b.ts ? 1 : -1);
  const d = customerDebt(c.id);
  const msg = `Hola ${c.name}, te recordamos que tienes un saldo pendiente de ${money(d)} en ${cfg().storeName}. ¡Gracias!`;
  const ph = normPhone(c.phone);
  modal({
    title: `${c.name} · debe ${money(d)}`, size: 'wide',
    html: `<div class="row" style="margin-bottom:8px">${ph ? `<a class="btn" href="https://wa.me/${ph}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${ic('chat')} Recordar por WhatsApp</a>` : '<span class="muted sm">Sin teléfono registrado.</span>'}<button class="btn" data-act="cust-edit" data-id="${c.id}">${ic('edit', 'sm')} Editar datos</button></div>
      <h3 style="font-size:15px;margin:6px 0">Compras a fiado</h3>
      <div class="tblwrap"><table class="tbl"><thead><tr><th>Fecha</th><th>N°</th><th>Productos</th><th class="r">Total</th><th class="r">Pagado</th><th class="r">Debe</th></tr></thead><tbody>${sales.map(s => `<tr class="click" data-act="sale-open" data-id="${s.id}"><td>${fmtDate(s.date)}</td><td>#${s.no}</td><td>${esc(s.items.slice(0, 3).map(l => qtyFmt(l.qty) + ' ' + l.name).join(', '))}</td><td class="r num">${money(s.total)}</td><td class="r num">${money(s.paid || 0)}</td><td class="r num"><b>${money(saleDebt(s))}</b></td></tr>`).join('') || '<tr><td colspan="6" class="muted center">Sin compras a fiado.</td></tr>'}</tbody></table></div>
      <h3 style="font-size:15px;margin:14px 0 6px">Cobros</h3>
      <div class="tblwrap"><table class="tbl"><thead><tr><th>Fecha</th><th class="r">Monto</th><th></th></tr></thead><tbody>${pays.map(p => `<tr class="${p.void ? 'void' : ''}"><td>${fmtDT(p.ts)}</td><td class="r num"><b>${money(p.amount)}</b></td><td class="r">${p.void ? '<span class="badge bad">Anulado</span>' : `<button class="btn sm ghost" data-act="debt-undo" data-id="${p.id}">${ic('undo', 'sm')} Anular cobro</button>`}</td></tr>`).join('') || '<tr><td colspan="3" class="muted center">Sin cobros.</td></tr>'}</tbody></table></div>`,
    actions: [{ label: 'Cerrar', cls: 'primary' }],
  });
};
ACT['cust-edit'] = async t => {
  const c = get('customers', t.dataset.id); if (!c) return;
  const n = await askText({ title: 'Nombre del cliente', label: 'Nombre', value: c.name });
  if (n === null || !n.trim()) return;
  const ph = await askText({ title: 'Teléfono del cliente', label: 'Teléfono (WhatsApp)', value: c.phone || '', type: 'tel' });
  if (ph === null) return;
  c.name = n.trim(); c.phone = ph.trim(); put('customers', c);
  audit('Cliente modificado', `Datos de "${c.name}" actualizados`, { entity: 'customer', entityId: c.id });
  if (S.view === 'fiados') renderView();
  toast('Cliente actualizado', { type: 'ok' });
};
ACT['debt-undo'] = async t => {
  const p = get('debtPayments', t.dataset.id); if (!p || p.void) return;
  if (!(await ask({ title: 'Anular cobro', msg: `¿Anular el cobro de ${money(p.amount)}? La deuda vuelve a aparecer y el efectivo baja. Queda anotado en el historial.`, ok: 'Anular cobro', danger: true }))) return;
  undoDebtPayment(p); toast('Cobro anulado', { type: 'warn' }); closeTopModal(); renderTop(); if (S.view === 'fiados') renderView();
};
