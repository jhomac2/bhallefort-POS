/* =====================================================================
   Lógica del negocio: caja, ventas, stock, fiado, Mi Vecino, agregados
   ===================================================================== */

/* ---------- Sesiones de caja ---------- */
function curSession() {
  for (const s of M.sessions.values()) if (s.status === 'open') return s;
  return null;
}
const sessionsSorted = () => list('sessions').sort((a, b) => (a.openedAt < b.openedAt ? -1 : 1));
function lastClosedSession() {
  const c = sessionsSorted().filter(s => s.status === 'closed');
  return c[c.length - 1] || null;
}

/* ---------- Productos ---------- */
const products = () => list('products');
const activeProducts = () => memo('actprod', ['products'], () => products().filter(p => p.active !== false));
const prodIndex = () => memo('pidx', ['products', 'owners'], () => activeProducts().map(p => ({ p, n: norm(`${p.name} ${p.barcode || ''} ${p.category || ''} ${ownerName(p.ownerId)}`) })));
const barcodeMap = () => memo('bcmap', ['products'], () => { const m = new Map(); products().forEach(p => { if (p.barcode) m.set(String(p.barcode).trim(), p); }); return m; });
const findByBarcode = code => barcodeMap().get(String(code).trim()) || null;
function searchProducts(q, limit = 8) {
  const toks = norm(q).split(/\s+/).filter(Boolean);
  if (!toks.length) return [];
  const out = [];
  for (const it of prodIndex()) {
    if (toks.every(t => it.n.includes(t))) {
      const nm = norm(it.p.name);
      out.push({ p: it.p, rank: nm.startsWith(toks[0]) ? 0 : nm.includes(toks[0]) ? 1 : 2 });
    }
  }
  out.sort((a, b) => a.rank - b.rank || a.p.name.localeCompare(b.p.name));
  return out.slice(0, limit).map(x => x.p);
}
function adjustStock(pid, delta) {
  const p = get('products', pid);
  if (!p || p.trackStock === false || !delta) return;
  p.stock = Math.round(((p.stock || 0) + delta) * 1000) / 1000;
  put('products', p);
}
const lowStock = () => activeProducts().filter(p => p.trackStock !== false && (p.minStock || 0) > 0 && (p.stock || 0) <= p.minStock);
const expiringSoon = (days = 30) => activeProducts().filter(p => p.expiry && p.expiry <= addDays(today(), days) && (p.stock || 0) > 0).sort((a, b) => a.expiry < b.expiry ? -1 : 1);
const noCost = () => activeProducts().filter(p => !p.cost);
function genCode() {
  let n = 1;
  list('products').forEach(p => { const m = /^BH(\d+)$/.exec(p.barcode || ''); if (m) n = Math.max(n, +m[1] + 1); });
  return 'BH' + String(n).padStart(6, '0');
}
function saveProduct(data, existing) {
  const before = existing ? JSON.parse(JSON.stringify(existing)) : null;
  const p = existing || { id: uid(), createdAt: new Date().toISOString(), stock: 0 };
  Object.assign(p, data, { updatedAt: new Date().toISOString() });
  put('products', p);
  if (!existing) {
    audit('Producto creado', `Producto "${p.name}" (${ownerName(p.ownerId)}) a ${money(p.price)}`, { entity: 'product', entityId: p.id });
  } else {
    const ch = [];
    if (before.price !== p.price) ch.push(`precio ${money(before.price)} → ${money(p.price)}`);
    if (before.cost !== p.cost) ch.push(`costo ${money(before.cost)} → ${money(p.cost)}`);
    if (before.stock !== p.stock) ch.push(`stock ${qtyFmt(before.stock)} → ${qtyFmt(p.stock)}`);
    if (before.name !== p.name) ch.push(`nombre "${before.name}" → "${p.name}"`);
    if (before.ownerId !== p.ownerId) ch.push(`dueño ${ownerName(before.ownerId)} → ${ownerName(p.ownerId)}`);
    if (ch.length) audit('Producto modificado', `${p.name}: ${ch.join('; ')}`, { entity: 'product', entityId: p.id, before: { price: before.price, cost: before.cost, stock: before.stock }, after: { price: p.price, cost: p.cost, stock: p.stock }, edit: true });
  }
  return p;
}

/* ---------- Ventas ---------- */
const allSales = () => memo('sales', ['sales'], () => list('sales').sort((a, b) => (a.ts < b.ts ? -1 : 1)));
const lineTotal = l => r2(l.qty * l.price);
const saleItemsTotal = items => r2(sum(items, lineTotal));
const saleCost = s => r2(sum(s.items, l => l.qty * (l.cost || 0)));
const saleDebt = s => (s.payType === 'fiado' && s.status !== 'void') ? r2(s.total - (s.paid || 0)) : 0;
const salesOnDate = d => allSales().filter(s => s.date === d);

function createSale({ items, payType = 'efectivo', customerId = null, received = null, invoice = null }) {
  const ses = curSession();
  if (!ses) throw new Error('La caja está cerrada');
  const c = cfg();
  const no = c.nextSaleNo++;
  saveCfg();
  const lines = items.map(it => ({ pid: it.pid, name: it.name, ownerId: it.ownerId, qty: it.qty, price: it.price, cost: it.cost || 0, unit: it.unit || 'u', listPrice: it.listPrice ?? it.price }));
  const total = saleItemsTotal(lines);
  const sale = {
    id: uid(), no, ts: new Date().toISOString(), date: ses.date, sessionId: ses.id, items: lines, total,
    paid: payType === 'efectivo' ? total : 0, payType, customerId, received: received != null ? r2(received) : null,
    change: payType === 'efectivo' && received != null ? r2(received - total) : null, status: 'ok', invoice, edited: false,
  };
  put('sales', sale);
  lines.forEach(l => adjustStock(l.pid, -l.qty));
  return sale;
}

function describeSaleDiff(a, b) {
  const out = [];
  const am = new Map(a.items.map(l => [l.pid, l])), bm = new Map(b.items.map(l => [l.pid, l]));
  for (const [pid, l] of am) {
    const n = bm.get(pid);
    if (!n) { out.push(`quitó ${qtyFmt(l.qty)} x ${l.name}`); continue; }
    if (n.price !== l.price) out.push(`${l.name}: precio ${money(l.price)} → ${money(n.price)}`);
    if (n.qty !== l.qty) out.push(`${l.name}: cantidad ${qtyFmt(l.qty)} → ${qtyFmt(n.qty)}`);
  }
  for (const [pid, l] of bm) if (!am.has(pid)) out.push(`agregó ${qtyFmt(l.qty)} x ${l.name} a ${money(l.price)}`);
  if (a.payType !== b.payType) out.push(`pago ${a.payType} → ${b.payType}`);
  if (a.total !== b.total) out.push(`total ${money(a.total)} → ${money(b.total)}`);
  return out;
}
function applySaleEdit(sale, newItems, newPayType, newCustomerId, updateProducts) {
  const before = JSON.parse(JSON.stringify(sale));
  const delta = new Map();
  sale.items.forEach(l => delta.set(l.pid, (delta.get(l.pid) || 0) + l.qty));
  newItems.forEach(l => delta.set(l.pid, (delta.get(l.pid) || 0) - l.qty));
  delta.forEach((d, pid) => { if (d) adjustStock(pid, d); });
  sale.items = newItems;
  sale.total = saleItemsTotal(newItems);
  if (newPayType === 'efectivo') sale.paid = sale.total;
  else if (sale.payType === 'efectivo') sale.paid = 0;
  sale.payType = newPayType;
  sale.customerId = newPayType === 'fiado' ? newCustomerId : null;
  sale.edited = true;
  sale.editedAt = new Date().toISOString();
  if (sale.received != null) sale.change = sale.payType === 'efectivo' ? r2(sale.received - sale.total) : null;
  put('sales', sale);
  if (updateProducts) newItems.forEach(l => { const p = get('products', l.pid); if (p && p.price !== l.price) { const old = p.price; p.price = l.price; put('products', p); audit('Precio de producto cambiado', `${p.name}: ${money(old)} → ${money(p.price)} (desde la venta #${sale.no})`, { entity: 'product', entityId: p.id, edit: true }); } });
  const diffs = describeSaleDiff(before, sale);
  const ses = get('sessions', sale.sessionId);
  const late = ses && ses.status === 'closed' ? ' (caja ya cerrada)' : '';
  audit('Venta modificada', `Venta #${sale.no}${late}: ${diffs.join('; ') || 'sin cambios de valores'}`, { entity: 'sale', entityId: sale.id, before: { total: before.total, items: before.items }, after: { total: sale.total, items: sale.items }, edit: true });
  return diffs;
}
function voidSale(sale, reason) {
  sale.items.forEach(l => adjustStock(l.pid, l.qty));
  sale.status = 'void';
  sale.voidReason = reason || '';
  sale.voidAt = new Date().toISOString();
  put('sales', sale);
  const ses = get('sessions', sale.sessionId);
  audit('Venta anulada', `Venta #${sale.no} por ${money(sale.total)} anulada${reason ? ': ' + reason : ''}${ses && ses.status === 'closed' ? ' (caja ya cerrada)' : ''}`, { entity: 'sale', entityId: sale.id, before: { total: sale.total }, edit: true });
}

/* ---------- Clientes y fiado ---------- */
const customers = () => list('customers').sort((a, b) => a.name.localeCompare(b.name));
const fiadoSalesOf = cid => allSales().filter(s => s.payType === 'fiado' && s.status !== 'void' && s.customerId === cid);
const customerDebt = cid => r2(sum(fiadoSalesOf(cid), saleDebt));
const totalDebt = () => r2(sum(allSales().filter(s => s.payType === 'fiado' && s.status !== 'void'), saleDebt));
function addCustomer(name, phone = '') {
  const c = put('customers', { id: uid(), name: name.trim(), phone: phone.trim(), createdAt: new Date().toISOString() });
  audit('Cliente agregado', `Cliente "${c.name}"`, { entity: 'customer', entityId: c.id });
  return c;
}
function payDebt(cid, amount) {
  const ses = curSession();
  if (!ses) throw new Error('La caja está cerrada');
  let left = r2(amount);
  const allocs = [];
  for (const s of fiadoSalesOf(cid).sort((a, b) => (a.ts < b.ts ? -1 : 1))) {
    const d = saleDebt(s);
    if (d <= 0 || left <= 0) continue;
    const take = Math.min(d, left);
    s.paid = r2((s.paid || 0) + take);
    put('sales', s);
    allocs.push({ saleId: s.id, amount: r2(take) });
    left = r2(left - take);
  }
  const used = r2(amount - left);
  const p = put('debtPayments', { id: uid(), ts: new Date().toISOString(), date: ses.date, sessionId: ses.id, customerId: cid, amount: used, allocs, void: false });
  audit('Cobro de fiado', `${get('customers', cid)?.name || 'Cliente'} pagó ${money(used)}`, { entity: 'debtPayment', entityId: p.id });
  return p;
}
function undoDebtPayment(p) {
  p.allocs.forEach(a => { const s = get('sales', a.saleId); if (s) { s.paid = r2((s.paid || 0) - a.amount); put('sales', s); } });
  p.void = true;
  put('debtPayments', p);
  audit('Cobro de fiado anulado', `Se anuló el cobro de ${money(p.amount)} de ${get('customers', p.customerId)?.name || 'cliente'}`, { entity: 'debtPayment', entityId: p.id, edit: true });
}

/* ---------- Mi Vecino (corresponsal bancario) ---------- */
const BANKS = { pichincha: { name: 'Pichincha', full: 'Mi Vecino · Pichincha', color: '#f2c200' }, guayaquil: { name: 'Guayaquil', full: 'Banco Guayaquil', color: '#d6176c' } };
const OPS = {
  deposito: { label: 'Depósito', short: 'Depósito', cash: 1, bank: -1, hint: 'El cliente deja efectivo' },
  retiro: { label: 'Retiro', short: 'Retiro', cash: -1, bank: 1, hint: 'El cliente se lleva efectivo' },
  servicio: { label: 'Pago de servicio', short: 'Servicio', cash: 1, bank: -1, hint: 'Luz, agua, teléfono…' },
  cargar: { label: 'Cargar saldo al banco', short: 'Cargar saldo', cash: -1, bank: 1, hint: 'Yo deposito mi efectivo al banco' },
  sacar: { label: 'Sacar saldo del banco', short: 'Sacar saldo', cash: 1, bank: -1, hint: 'Paso saldo del banco a efectivo' },
};
const opEffect = op => { const d = OPS[op.type]; return { cash: d.cash * op.amount + (op.commissionCash ? (op.commission || 0) : 0), bank: d.bank * op.amount }; };
function addBankOp(bank, type, amount) {
  const ses = curSession();
  if (!ses) throw new Error('La caja está cerrada');
  const c = cfg().mv;
  const commission = type === 'deposito' || type === 'retiro' || type === 'servicio' ? r2(c.commission[bank][type] || 0) : 0;
  const op = put('bankOps', { id: uid(), ts: new Date().toISOString(), date: ses.date, sessionId: ses.id, bank, type, amount: r2(amount), commission, commissionCash: !!c.commissionInCash && commission > 0, void: false, note: '' });
  return op;
}
function removeBankOp(op, why = 'Movimiento eliminado') {
  op.void = true;
  put('bankOps', op);
  audit('Movimiento de Mi Vecino eliminado', `${OPS[op.type].label} ${money(op.amount)} en ${BANKS[op.bank].name} (${fmtTime(op.ts)})`, { entity: 'bankOp', entityId: op.id, before: { amount: op.amount, type: op.type, bank: op.bank }, edit: true });
}
function editBankOp(op, amount, type) {
  const b = { amount: op.amount, type: op.type };
  op.amount = r2(amount); op.type = type;
  put('bankOps', op);
  audit('Movimiento de Mi Vecino modificado', `${BANKS[op.bank].name}: ${OPS[b.type].label} ${money(b.amount)} → ${OPS[type].label} ${money(op.amount)}`, { entity: 'bankOp', entityId: op.id, before: b, after: { amount: op.amount, type }, edit: true });
}

/* ---------- Resumen de una caja ---------- */
function sessionSummary(sid) {
  const s = get('sessions', sid);
  if (!s) return null;
  const sales = allSales().filter(x => x.sessionId === sid && x.status !== 'void');
  const voided = allSales().filter(x => x.sessionId === sid && x.status === 'void');
  const cashSales = r2(sum(sales.filter(x => x.payType === 'efectivo'), x => x.total));
  const fiadoSalesAmt = r2(sum(sales.filter(x => x.payType === 'fiado'), x => x.total));
  const pays = list('debtPayments').filter(p => p.sessionId === sid && !p.void);
  const debtCollected = r2(sum(pays, p => p.amount));
  const moves = list('cashMoves').filter(m => m.sessionId === sid);
  const tIn = r2(sum(moves.filter(m => m.scope === 'tienda' && m.kind === 'in'), m => m.amount));
  const tOut = r2(sum(moves.filter(m => m.scope === 'tienda' && m.kind === 'out'), m => m.amount));
  const mIn = r2(sum(moves.filter(m => m.scope === 'mv' && m.kind === 'in'), m => m.amount));
  const mOut = r2(sum(moves.filter(m => m.scope === 'mv' && m.kind === 'out'), m => m.amount));
  const ops = list('bankOps').filter(o => o.sessionId === sid && !o.void).sort((a, b) => (a.ts < b.ts ? -1 : 1));
  const bankBal = { pichincha: s.opening.pichincha || 0, guayaquil: s.opening.guayaquil || 0 };
  let mvCash = s.opening.mvCash || 0, commissions = 0;
  ops.forEach(o => { const e = opEffect(o); mvCash += e.cash; bankBal[o.bank] += e.bank; commissions += o.commission || 0; });
  mvCash = r2(mvCash + mIn - mOut);
  bankBal.pichincha = r2(bankBal.pichincha); bankBal.guayaquil = r2(bankBal.guayaquil);
  const tiendaExpected = r2((s.opening.tienda || 0) + cashSales + debtCollected + tIn - tOut);
  return {
    session: s, sales, voided, count: sales.length, cashSales, fiadoSales: fiadoSalesAmt, totalSales: r2(cashSales + fiadoSalesAmt), debtCollected, pays, moves, tIn, tOut, mIn, mOut,
    tiendaExpected, mvCash, bankBal, ops, commissions: r2(commissions),
  };
}
const liveSummary = () => { const s = curSession(); return s ? sessionSummary(s.id) : null; };
function sessionEdits(sid) { return list('audit').filter(a => a.sessionId === sid && a.edit).sort((a, b) => (a.ts < b.ts ? -1 : 1)); }
function sessionLabel(s) {
  return `${fmtDate(s.date)} · ${fmtTime(s.openedAt)}${s.closedAt ? '–' + fmtTime(s.closedAt) : ''}`;
}

/* ---------- Periodos ---------- */
function weekStart(s) { const d = parseD(s); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return dstr(d); }
function periodRange(kind, anchor, from, to) {
  const d = parseD(anchor);
  if (kind === 'day') return [anchor, anchor];
  if (kind === 'week') { const a = weekStart(anchor); return [a, addDays(a, 6)]; }
  if (kind === 'month') return [dstr(new Date(d.getFullYear(), d.getMonth(), 1)), dstr(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
  if (kind === 'year') return [`${d.getFullYear()}-01-01`, `${d.getFullYear()}-12-31`];
  return [from, to];
}
function shiftAnchor(kind, anchor, dir) {
  const d = parseD(anchor);
  if (kind === 'day') return addDays(anchor, dir);
  if (kind === 'week') return addDays(anchor, 7 * dir);
  if (kind === 'month') return dstr(new Date(d.getFullYear(), d.getMonth() + dir, 1));
  if (kind === 'year') return dstr(new Date(d.getFullYear() + dir, 0, 1));
  return anchor;
}
function prevRange(kind, anchor, from, to) {
  if (kind === 'range') {
    const days = Math.round((parseD(to) - parseD(from)) / 86400000) + 1;
    return [addDays(from, -days), addDays(from, -1)];
  }
  return periodRange(kind, shiftAnchor(kind, anchor, -1));
}
function periodLabel(kind, from, to) {
  if (kind === 'day') return fmtDateLong(from);
  if (kind === 'month') { const d = parseD(from); return `${MESES[d.getMonth()][0].toUpperCase()}${MESES[d.getMonth()].slice(1)} ${d.getFullYear()}`; }
  if (kind === 'year') return `Año ${parseD(from).getFullYear()}`;
  return from === to ? fmtDateLong(from) : `${fmtDate(from)} al ${fmtDate(to)}`;
}

/* ---------- Agregados de ventas ---------- */
function aggregate(from, to, { ownerId = 'all' } = {}) {
  const sales = allSales().filter(s => s.status !== 'void' && s.date >= from && s.date <= to);
  const byDay = new Map(), byOwner = new Map(), byProduct = new Map(), byHour = Array.from({ length: 24 }, () => ({ rev: 0, cost: 0, n: 0 }));
  let rev = 0, cost = 0, count = 0, fiadoPend = 0, cashRev = 0, fiadoRev = 0;
  for (const s of sales) {
    let sRev = 0, sCost = 0;
    const pendRatio = s.total > 0 ? Math.max(0, s.total - (s.paid || 0)) / s.total : 0;
    for (const l of s.items) {
      if (ownerId !== 'all' && l.ownerId !== ownerId) continue;
      const lr = lineTotal(l), lc = r2(l.qty * (l.cost || 0));
      sRev += lr; sCost += lc;
      const o = byOwner.get(l.ownerId) || { rev: 0, cost: 0, pend: 0, units: 0 };
      o.rev += lr; o.cost += lc; o.units += l.qty; o.pend += s.payType === 'fiado' ? lr * pendRatio : 0;
      byOwner.set(l.ownerId, o);
      const k = l.pid || l.name;
      const p = byProduct.get(k) || { pid: l.pid, name: l.name, ownerId: l.ownerId, unit: l.unit, qty: 0, rev: 0, cost: 0 };
      p.qty += l.qty; p.rev += lr; p.cost += lc;
      byProduct.set(k, p);
    }
    if (ownerId !== 'all' && sRev === 0 && sCost === 0) continue;
    count++; rev += sRev; cost += sCost;
    if (s.payType === 'fiado') { fiadoRev += sRev; fiadoPend += sRev * pendRatio; } else cashRev += sRev;
    const dd = byDay.get(s.date) || { rev: 0, cost: 0, n: 0 };
    dd.rev += sRev; dd.cost += sCost; dd.n++;
    byDay.set(s.date, dd);
    const hr = new Date(s.ts).getHours();
    byHour[hr].rev += sRev; byHour[hr].cost += sCost; byHour[hr].n++;
  }
  rev = r2(rev); cost = r2(cost);
  return { sales, count, rev, cost, profit: r2(rev - cost), fiadoPend: r2(fiadoPend), cashRev: r2(cashRev), fiadoRev: r2(fiadoRev), avg: count ? r2(rev / count) : 0, byDay, byOwner, byProduct, byHour };
}
function expensesIn(from, to, scope = 'tienda') {
  return r2(sum(list('cashMoves').filter(m => m.scope === scope && m.kind === 'out' && m.category === 'gasto' && m.date >= from && m.date <= to), m => m.amount));
}
function mvStats(from, to) {
  const ops = list('bankOps').filter(o => !o.void && o.date >= from && o.date <= to);
  const mk = () => ({ n: 0, total: 0 });
  const res = { pichincha: {}, guayaquil: {}, all: {}, commissions: 0, count: ops.length, byDay: new Map() };
  for (const b of ['pichincha', 'guayaquil', 'all']) for (const t in OPS) res[b][t] = mk();
  for (const o of ops) {
    for (const b of [o.bank, 'all']) { res[b][o.type].n++; res[b][o.type].total = r2(res[b][o.type].total + o.amount); }
    res.commissions = r2(res.commissions + (o.commission || 0));
    const d = res.byDay.get(o.date) || { n: 0, dep: 0, ret: 0, com: 0 };
    d.n++;
    if (OPS[o.type].cash > 0) d.dep = r2(d.dep + o.amount); else d.ret = r2(d.ret + o.amount);
    d.com = r2(d.com + (o.commission || 0));
    res.byDay.set(o.date, d);
  }
  res.ops = ops.sort((a, b) => (a.ts < b.ts ? -1 : 1));
  return res;
}

/* ---------- Contabilidad ---------- */
const accEntries = (ownerId, from, to) => list('accounting').filter(e => (!ownerId || e.ownerId === ownerId) && e.date >= from && e.date <= to).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.ts < b.ts ? -1 : 1);
function addAccounting(e) { return put('accounting', Object.assign({ id: uid(), ts: new Date().toISOString(), source: 'manual', sales: 0, cost: 0, expense: 0 }, e)); }
function ownerDayFigures(ownerId, sid) {
  let rev = 0, cost = 0, pend = 0;
  allSales().filter(s => s.sessionId === sid && s.status !== 'void').forEach(s => {
    const ratio = s.total > 0 ? Math.max(0, s.total - (s.paid || 0)) / s.total : 0;
    s.items.filter(l => l.ownerId === ownerId).forEach(l => { rev += lineTotal(l); cost += r2(l.qty * (l.cost || 0)); if (s.payType === 'fiado') pend += lineTotal(l) * ratio; });
  });
  return { rev: r2(rev), cost: r2(cost), profit: r2(rev - cost), pend: r2(pend) };
}

/* ---------- Teléfono / WhatsApp ---------- */
function normPhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('593')) return d;
  if (d.startsWith('0')) return '593' + d.slice(1);
  if (d.length === 9) return '593' + d;
  return d;
}
