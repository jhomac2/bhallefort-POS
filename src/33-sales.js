/* =====================================================================
   VENTAS: historial del día y edición (corregir precios, cantidades, anular)
   ===================================================================== */
VIEWS.ventas = {
  title: 'Ventas',
  render() {
    const d = S.salesDate;
    const all = salesOnDate(d);
    const ok = all.filter(s => s.status !== 'void');
    const tot = r2(sum(ok, s => s.total)), cash = r2(sum(ok.filter(s => s.payType === 'efectivo'), s => s.total)), fiado = r2(sum(ok.filter(s => s.payType === 'fiado'), s => s.total));
    return `<div class="toolbar">
      <button class="btn icon" data-act="sales-day" data-d="-1" aria-label="Día anterior">‹</button>
      <input class="in" type="date" id="sales-date" data-ch="sales-date" value="${d}" style="max-width:170px">
      <button class="btn icon" data-act="sales-day" data-d="1" aria-label="Día siguiente">›</button>
      <button class="btn" data-act="sales-today">Hoy</button>
      <input class="in" id="sales-q" data-in="sales-q" placeholder="Buscar por número o producto" style="flex:1;min-width:200px" value="${esc(S.salesQ)}">
      <button class="btn" data-act="sales-report">${ic('file')} Reporte de este día</button>
    </div>
    <div class="grid g4" style="margin-bottom:12px">
      <div class="card kpi"><span class="l">Ventas del día</span><span class="v">${money(tot)}</span><span class="d eq">${ok.length} venta${ok.length === 1 ? '' : 's'}</span></div>
      <div class="card kpi"><span class="l">En efectivo</span><span class="v">${money(cash)}</span></div>
      <div class="card kpi"><span class="l">A fiado (no entra a caja)</span><span class="v">${money(fiado)}</span></div>
      <div class="card kpi"><span class="l">Anuladas</span><span class="v">${all.length - ok.length}</span></div>
    </div>
    <div id="sales-table"></div>`;
  },
  after() { drawSales(); },
};
function drawSales() {
  const el = $('#sales-table'); if (!el) return;
  let arr = salesOnDate(S.salesDate).slice().reverse();
  const q = norm(S.salesQ);
  if (q) arr = arr.filter(s => String(s.no) === q.replace('#', '') || s.items.some(l => norm(l.name).includes(q)) || (s.customerId && norm(get('customers', s.customerId)?.name).includes(q)));
  if (!arr.length) { el.innerHTML = `<div class="empty card">${ic('receipt')}<div>No hay ventas ${q ? 'con esa búsqueda' : 'en este día'}.</div></div>`; return; }
  el.innerHTML = `<div class="tblwrap"><table class="tbl"><thead><tr><th>N°</th><th>Hora</th><th>Productos</th><th>Pago</th><th class="r">Total</th></tr></thead><tbody>${arr.map(s => {
    const first = s.items.slice(0, 3).map(l => `${qtyFmt(l.qty)} ${esc(l.name)}`).join(', ') + (s.items.length > 3 ? ` +${s.items.length - 3} más` : '');
    const cust = s.customerId ? get('customers', s.customerId) : null;
    return `<tr class="click ${s.status === 'void' ? 'void' : ''}" data-act="sale-open" data-id="${s.id}"><td><b>#${s.no}</b></td><td>${fmtTime(s.ts)}</td><td>${first}${cust ? `<div class="xs muted">Cliente: ${esc(cust.name)}</div>` : ''}</td>
      <td>${s.payType === 'fiado' ? `<span class="badge warn">Fiado${saleDebt(s) > 0 ? ' · debe ' + money(saleDebt(s)) : ' · pagado'}</span>` : '<span class="badge ok">Efectivo</span>'} ${s.edited ? '<span class="badge info">Editada</span>' : ''} ${s.status === 'void' ? '<span class="badge bad">Anulada</span>' : ''} ${s.invoice ? '<span class="badge">Factura SRI</span>' : ''}</td>
      <td class="r num"><b>${money(s.total)}</b></td></tr>`;
  }).join('')}</tbody></table></div>`;
}
CHG['sales-date'] = t => { if (t.value) { S.salesDate = t.value; renderView(); } };
INP['sales-q'] = t => { S.salesQ = t.value; drawSales(); };
ACT['sales-day'] = t => { S.salesDate = addDays(S.salesDate, +t.dataset.d); renderView(); };
ACT['sales-today'] = () => { S.salesDate = today(); renderView(); };
ACT['sales-report'] = () => { S.rep.who = 'tienda'; S.rep.from = S.salesDate; S.rep.to = S.salesDate; S.rep.model = null; go('reportes'); };
ACT['sale-open'] = t => openSaleEditor(t.dataset.id);

/* --- Editor de una venta --- */
function openSaleEditor(id) {
  const sale = get('sales', id);
  if (!sale) return;
  const ses = get('sessions', sale.sessionId);
  const closed = !!(ses && ses.status === 'closed');
  const voided = sale.status === 'void';
  let canEdit = !voided && (!closed || S.owner);
  const w = { items: JSON.parse(JSON.stringify(sale.items)), payType: sale.payType, customerId: sale.customerId, upd: false };
  const cust = sale.customerId ? get('customers', sale.customerId) : null;
  const custOptions = sel => customers().map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');

  const html = () => `
    <div class="row" style="margin-bottom:8px"><span class="chip">${fmtDT(sale.ts)}</span>${closed ? '<span class="chip warn">Caja ya cerrada</span>' : '<span class="chip ok">Caja de hoy</span>'}${sale.edited ? '<span class="badge info">Editada antes</span>' : ''}${voided ? `<span class="badge bad">Anulada${sale.voidReason ? ': ' + esc(sale.voidReason) : ''}</span>` : ''}${sale.invoice ? `<span class="badge">Factura: ${esc(sale.invoice.id)} ${esc(sale.invoice.name || '')}</span>` : ''}</div>
    ${!canEdit && closed && !voided ? `<div class="alert warn" style="margin-bottom:10px">${ic('lock')}<span style="flex:1">Esta venta es de una caja ya cerrada. Solo el dueño puede modificarla.</span><button class="btn sm" data-act="se-owner">Entrar como dueño</button></div>` : ''}
    <div class="tblwrap"><table class="tbl"><thead><tr><th>Producto</th><th style="width:110px">Cantidad</th><th style="width:120px" class="r">Precio</th><th class="r" style="width:100px">Subtotal</th><th style="width:44px"></th></tr></thead><tbody id="se-body"></tbody></table></div>
    ${canEdit ? `<div class="row nowrap" style="margin-top:10px;position:relative"><input class="in" id="se-add" placeholder="Agregar otro producto (nombre o código)" autocomplete="off"><div class="results" id="se-res" hidden style="bottom:100%;top:auto;margin:0 0 4px"></div></div>` : ''}
    <div class="row" style="margin-top:12px">
      <div class="seg" role="group" aria-label="Tipo de pago"><button data-act="se-pay" data-p="efectivo" aria-pressed="${w.payType === 'efectivo'}" ${canEdit ? '' : 'disabled'}>Efectivo</button><button data-act="se-pay" data-p="fiado" aria-pressed="${w.payType === 'fiado'}" ${canEdit ? '' : 'disabled'}>Fiado</button></div>
      <div id="se-cust" class="row nowrap" ${w.payType === 'fiado' ? '' : 'hidden'}><select class="in" id="se-custsel" style="min-width:200px" ${canEdit ? '' : 'disabled'}><option value="">— Cliente —</option>${custOptions(w.customerId)}</select>${canEdit ? `<button class="btn" data-act="se-newcust">${ic('plus')}</button>` : ''}</div>
      <span class="sp"></span>
      <div class="right"><div class="xs muted" id="se-orig"></div><div class="num" style="font-size:30px;font-weight:800" id="se-total"></div></div>
    </div>
    ${canEdit ? `<label class="chk" id="se-updwrap" hidden style="margin-top:6px"><input type="checkbox" id="se-upd"> Cambiar también el precio de estos productos en el inventario</label>` : ''}`;

  const h = modal({
    title: `Venta #${sale.no}`, size: 'wide', html: html(),
    actions: [{ label: 'Cerrar' }].concat(canEdit ? [
      { label: `${ic('trash', 'sm')} Anular venta`, cls: 'soft-danger', onClick: async hh => { if (!(await voidFlow(sale))) return false; hh.close(); } , keep: true },
      { label: 'Guardar cambios', cls: 'primary', id: 'se-save', onClick: hh => saveSaleEditor(hh, sale, w) },
    ] : []),
    onOpen: hh => {
      const body = $('#se-body', hh.el);
      const draw = () => {
        body.innerHTML = w.items.map((l, i) => `<tr><td><b>${esc(l.name)}</b><div class="xs muted">${esc(ownerName(l.ownerId))}</div></td>
          <td><input class="in sm num-in" data-f="qty" data-i="${i}" value="${qtyFmt(l.qty)}" inputmode="decimal" ${canEdit ? '' : 'disabled'}></td>
          <td class="r"><input class="in sm num-in" data-f="price" data-i="${i}" value="${l.price.toFixed(2)}" inputmode="decimal" ${canEdit ? '' : 'disabled'}></td>
          <td class="r num" id="se-sub-${i}"><b>${money(lineTotal(l))}</b></td>
          <td class="r">${canEdit ? `<button class="btn ghost sm icon" data-act="se-del" data-i="${i}" aria-label="Quitar">${ic('x', 'sm')}</button>` : ''}</td></tr>`).join('');
        totals();
      };
      const totals = () => {
        const t = saleItemsTotal(w.items);
        $('#se-total', hh.el).textContent = money(t);
        $('#se-orig', hh.el).textContent = t !== sale.total ? `Antes: ${money(sale.total)} (${t > sale.total ? '+' : ''}${money(t - sale.total)})` : '';
        const diffPrice = w.items.some(l => { const p = get('products', l.pid); return p && p.price !== l.price; });
        const uw = $('#se-updwrap', hh.el); if (uw) uw.hidden = !diffPrice;
      };
      hh._draw = draw;
      draw();
      hh.el.addEventListener('input', e => {
        const t = e.target; if (!t.dataset.f) return;
        const l = w.items[+t.dataset.i]; if (!l) return;
        if (t.dataset.f === 'qty') l.qty = num(t.value); else l.price = r2(num(t.value));
        const c = $('#se-sub-' + t.dataset.i, hh.el); if (c) c.innerHTML = `<b>${money(lineTotal(l))}</b>`;
        totals();
      });
      hh.el.addEventListener('click', async e => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        const a = b.dataset.act;
        if (a === 'se-del') { w.items.splice(+b.dataset.i, 1); draw(); }
        else if (a === 'se-pay') { w.payType = b.dataset.p; $$('[data-act="se-pay"]', hh.el).forEach(x => x.setAttribute('aria-pressed', x.dataset.p === w.payType)); $('#se-cust', hh.el).hidden = w.payType !== 'fiado'; }
        else if (a === 'se-newcust') {
          const n = await askText({ title: 'Cliente nuevo', label: 'Nombre del cliente', ok: 'Agregar' });
          if (n && n.trim()) { const c = addCustomer(n); $('#se-custsel', hh.el).innerHTML = '<option value="">— Cliente —</option>' + custOptions(c.id); w.customerId = c.id; }
        } else if (a === 'se-owner') { if (await requireOwner('Escribe el PIN del dueño para modificar una caja cerrada.')) { hh.close(); openSaleEditor(id); } }
      });
      const cs = $('#se-custsel', hh.el); if (cs) cs.addEventListener('change', () => { w.customerId = cs.value || null; });
      const upd = $('#se-upd', hh.el); if (upd) upd.addEventListener('change', () => { w.upd = upd.checked; });
      const add = $('#se-add', hh.el);
      if (add) {
        const res = $('#se-res', hh.el);
        const pick = p => {
          const ex = w.items.find(l => l.pid === p.id && l.price === p.price);
          if (ex) ex.qty = Math.round((ex.qty + 1) * 1000) / 1000; else w.items.push({ pid: p.id, name: p.name, ownerId: p.ownerId, qty: 1, price: p.price, cost: p.cost || 0, unit: p.unit || 'u', listPrice: p.price });
          add.value = ''; res.hidden = true; draw(); add.focus();
        };
        add.addEventListener('input', () => { const arr = searchProducts(add.value, 6); res.hidden = !arr.length; res.innerHTML = arr.map(p => `<button data-pid="${p.id}">${ownerDot(p.ownerId)}<span class="nm">${esc(p.name)}</span><b class="num">${money(p.price)}</b></button>`).join(''); });
        res.addEventListener('click', e => { const b = e.target.closest('[data-pid]'); if (b) pick(get('products', b.dataset.pid)); });
        add.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const bc = findByBarcode(add.value.trim()); const p = bc || searchProducts(add.value, 1)[0]; if (p) pick(p); } });
      }
    },
  });
}
async function voidFlow(sale) {
  if (sale.payType === 'fiado' && (sale.paid || 0) > 0) { toast('Esta venta fiada ya tiene abonos. Primero anula los cobros en Fiados.', { type: 'bad', ms: 5000 }); return false; }
  const reason = await askText({ title: `Anular venta #${sale.no}`, label: 'Motivo de la anulación', value: 'Error al cobrar', ok: 'Anular venta', hint: 'Se devuelve el stock y queda anotado en el historial de cambios.' });
  if (reason === null) return false;
  voidSale(sale, reason.trim());
  toast(`Venta #${sale.no} anulada`, { type: 'warn' });
  refreshAfterSaleChange();
  return true;
}
function saveSaleEditor(h, sale, w) {
  if (!w.items.length) { toast('La venta no tiene productos. Si quieres cancelarla, usa «Anular venta».', { type: 'warn', ms: 4500 }); return false; }
  if (w.items.some(l => !(l.qty > 0))) { toast('Hay una cantidad en cero. Corrígela o quita ese producto.', { type: 'warn' }); return false; }
  if (w.items.some(l => l.price < 0)) { toast('Hay un precio inválido.', { type: 'warn' }); return false; }
  if (w.payType === 'fiado' && !w.customerId) { toast('Elige el cliente del fiado.', { type: 'warn' }); return false; }
  const newTotal = saleItemsTotal(w.items);
  if (w.payType === 'fiado' && sale.payType === 'fiado' && newTotal < (sale.paid || 0)) { toast(`El total no puede ser menor a lo ya abonado (${money(sale.paid)}).`, { type: 'bad' }); return false; }
  if (w.payType === 'efectivo' && sale.payType === 'fiado' && (sale.paid || 0) > 0) { toast('Esta venta fiada ya tiene abonos; no se puede pasar a efectivo.', { type: 'bad' }); return false; }
  const items = w.items.map(l => ({ ...l, qty: Math.round(l.qty * 1000) / 1000 }));
  const diffs = describeSaleDiff(sale, { items, payType: w.payType, total: newTotal });
  if (!diffs.length && !(w.payType === 'fiado' && w.customerId !== sale.customerId)) { toast('No hay cambios para guardar.'); return false; }
  applySaleEdit(sale, items, w.payType, w.customerId, w.upd);
  toast(`Venta #${sale.no} corregida. Quedó anotado en el historial.`, { type: 'ok' });
  refreshAfterSaleChange();
  return true;
}
function refreshAfterSaleChange() {
  renderTop(); renderMV();
  if (S.view === 'ventas' || S.view === 'caja' || S.view === 'fiados' || S.view === 'resumen') renderView();
  if (S.view === 'vender') renderLastSales();
}
