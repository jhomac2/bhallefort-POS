/* =====================================================================
   Datos de ejemplo (productos, dueños y 3 semanas de ventas) para probar el sistema
   ===================================================================== */
function loadDemo() {
  let seed = 20261018;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const mk = (name, slot) => list('owners').find(o => o.name === name) || put('owners', { id: uid(), name, phone: '', slot, isStore: false, active: true });
  if (!get('owners', 'own')) put('owners', { id: 'own', name: 'Tienda', phone: cfg().phones.tienda || '', slot: 1, isStore: true, active: true });
  const carmen = mk('Doña Carmen', 2), luis = mk('Sr. Luis', 3), mercedes = mk('Mercedes', 4);
  const O = { t: 'own', c: carmen.id, l: luis.id, m: mercedes.id };
  // [nombre, dueño, categoría, unidad, costo, precio, mínimo, rápido, peso]
  const catalog = [
    ['Arroz por libra', 't', 'Granos', 'lb', 0.45, 0.60, 20, 1, 9], ['Azúcar por libra', 't', 'Granos', 'lb', 0.55, 0.70, 20, 1, 7], ['Aceite 1 litro', 't', 'Despensa', 'u', 1.85, 2.30, 6, 0, 4],
    ['Fideos 400 g', 't', 'Despensa', 'u', 0.60, 0.85, 10, 0, 6], ['Atún en lata', 't', 'Despensa', 'u', 1.05, 1.40, 8, 0, 5], ['Sal 1 kg', 't', 'Despensa', 'u', 0.40, 0.60, 6, 0, 3],
    ['Huevos (unidad)', 't', 'Frescos', 'u', 0.12, 0.16, 60, 1, 14], ['Pan de agua', 't', 'Panadería', 'u', 0.10, 0.15, 40, 1, 16], ['Leche entera 1 L', 't', 'Lácteos', 'u', 0.85, 1.10, 12, 0, 9],
    ['Café molido 100 g', 't', 'Despensa', 'u', 1.80, 2.40, 4, 0, 2], ['Galletas Ricas', 't', 'Snacks', 'u', 0.25, 0.40, 15, 0, 7], ['Gaseosa 500 ml', 't', 'Bebidas', 'u', 0.55, 0.80, 12, 0, 10],
    ['Agua 600 ml', 't', 'Bebidas', 'u', 0.35, 0.60, 12, 0, 8], ['Jabón de tocador', 't', 'Aseo', 'u', 0.45, 0.70, 8, 0, 3], ['Papel higiénico x4', 't', 'Aseo', 'u', 1.20, 1.65, 6, 0, 3],
    ['Tomate por libra', 'c', 'Verduras', 'lb', 0.35, 0.50, 10, 1, 6], ['Cebolla paiteña por libra', 'c', 'Verduras', 'lb', 0.40, 0.60, 10, 1, 5], ['Papa por libra', 'c', 'Verduras', 'lb', 0.20, 0.30, 15, 1, 6],
    ['Plátano verde', 'c', 'Frutas', 'u', 0.12, 0.20, 30, 0, 5], ['Choclo', 'c', 'Verduras', 'u', 0.30, 0.50, 12, 0, 3], ['Limones (funda)', 'c', 'Frutas', 'u', 0.35, 0.50, 8, 0, 3],
    ['Queso fresco', 'l', 'Lácteos', 'u', 0.95, 1.40, 6, 0, 5], ['Yogurt 1 L', 'l', 'Lácteos', 'u', 1.20, 1.65, 6, 0, 4], ['Mortadela por libra', 'l', 'Embutidos', 'lb', 1.60, 2.20, 4, 0, 3], ['Mantequilla', 'l', 'Lácteos', 'u', 0.80, 1.10, 5, 0, 2],
    ['Chifles', 'm', 'Snacks', 'u', 0.35, 0.60, 10, 1, 8], ['Caramelos', 'm', 'Golosinas', 'u', 0.03, 0.05, 80, 1, 12], ['Chocolate', 'm', 'Golosinas', 'u', 0.40, 0.65, 10, 0, 5], ['Helado de agua', 'm', 'Golosinas', 'u', 0.30, 0.50, 10, 0, 5],
    ['Papas fritas', 'm', 'Snacks', 'u', 0.45, 0.75, 10, 0, 6], ['Chicles', 'm', 'Golosinas', 'u', 0.10, 0.20, 40, 0, 4],
  ];
  const prods = [], weights = [];
  catalog.forEach((r, i) => {
    const p = put('products', { id: uid(), barcode: r[0].includes('por libra') || r[0].includes('(unidad)') || r[0] === 'Pan de agua' || r[0] === 'Caramelos' ? 'BH' + String(i + 1).padStart(6, '0') : '7861' + String(100000 + i * 137).padStart(9, '0'), name: r[0], ownerId: O[r[1]], category: r[2], unit: r[3], cost: r[4], price: r[5], stock: 3000, minStock: r[6], expiry: '', quick: !!r[7], trackStock: true, active: true, createdAt: new Date().toISOString() });
    prods.push(p); for (let k = 0; k < r[8]; k++) weights.push(p);
  });
  const custs = ['Sra. Rosa Tipán', 'Don Pedro Cando', 'Familia Chiliquinga', 'Sra. María Toapanta'].map((n, i) => put('customers', { id: uid(), name: n, phone: i === 0 ? '0991234567' : '', createdAt: new Date().toISOString() }));
  const at = (date, h, m) => { const [y, mo, d] = date.split('-').map(Number); return new Date(y, mo - 1, d, h, m, Math.floor(rnd() * 59)).toISOString(); };
  let open = { tienda: 40, mvCash: 220, pichincha: 380, guayaquil: 260 };
  const DAYS = 21;
  for (let i = DAYS; i >= 1; i--) {
    const date = addDays(today(), -i);
    const dow = parseD(date).getDay();
    const s = put('sessions', { id: uid(), date, openedAt: at(date, 7, 25), status: 'open', opening: { ...open }, openedBy: 'Cajera', closing: null });
    const n = (dow === 0 ? 14 : 24) + Math.floor(rnd() * 20);
    for (let k = 0; k < n; k++) {
      const items = [];
      const cnt = 1 + Math.floor(rnd() * 4);
      for (let j = 0; j < cnt; j++) {
        const p = pick(weights);
        if (items.some(x => x.pid === p.id)) continue;
        const frac = FRACTIONAL.has(p.unit);
        const qty = frac ? pick([0.5, 1, 1, 2, 3]) : (p.price < 0.2 ? pick([2, 3, 4, 6, 10]) : pick([1, 1, 1, 2, 3]));
        items.push({ pid: p.id, name: p.name, ownerId: p.ownerId, qty, price: p.price, cost: p.cost, unit: p.unit, listPrice: p.price });
      }
      if (!items.length) continue;
      const fiado = rnd() < 0.07;
      const sale = createSale({ items, payType: fiado ? 'fiado' : 'efectivo', customerId: fiado ? pick(custs).id : null });
      sale.ts = at(date, 7 + Math.floor(rnd() * 13), Math.floor(rnd() * 59)); put('sales', sale);
    }
    if (i < DAYS - 2 && rnd() < 0.35) {
      const owing = custs.filter(c => customerDebt(c.id) > 0);
      if (owing.length) { const c = pick(owing); payDebt(c.id, Math.min(customerDebt(c.id), pick([2, 3, 5]))); }
    }
    const nops = 9 + Math.floor(rnd() * 14);
    for (let k = 0; k < nops; k++) {
      const r = rnd();
      const op = addBankOp(rnd() < 0.62 ? 'pichincha' : 'guayaquil', r < 0.55 ? 'deposito' : r < 0.9 ? 'retiro' : 'servicio', pick([5, 10, 10, 15, 20, 20, 25, 30, 40, 50, 60, 80, 100, 150]));
      op.ts = at(date, 7 + Math.floor(rnd() * 13), Math.floor(rnd() * 59)); put('bankOps', op);
    }
    // recarga de las cuentas y retiro del dueño, para mantener saldos realistas
    let sm0 = sessionSummary(s.id);
    ['pichincha', 'guayaquil'].forEach(b => {
      if (sm0.bankBal[b] < 250) { const a = Math.ceil((600 - sm0.bankBal[b]) / 50) * 50; const op = addBankOp(b, 'cargar', a); op.ts = at(date, 19, 30); put('bankOps', op); }
    });
    sm0 = sessionSummary(s.id);
    if (sm0.mvCash < 100) put('cashMoves', { id: uid(), ts: at(date, 19, 40), date, sessionId: s.id, scope: 'mv', kind: 'in', category: 'aporte', concept: 'Aporte del dueño de Mi Vecino', amount: Math.ceil((300 - sm0.mvCash) / 50) * 50 });
    else if (sm0.mvCash > 900) put('cashMoves', { id: uid(), ts: at(date, 19, 40), date, sessionId: s.id, scope: 'mv', kind: 'out', category: 'retiro', concept: 'Retiro del dueño de Mi Vecino', amount: Math.floor((sm0.mvCash - 400) / 50) * 50 });
    if (sm0.tiendaExpected > 200) put('cashMoves', { id: uid(), ts: at(date, 20, 0), date, sessionId: s.id, scope: 'tienda', kind: 'out', category: 'retiro', concept: 'Retiro del dueño', amount: Math.floor((sm0.tiendaExpected - 150) / 10) * 10 });
    if (rnd() < 0.3) put('cashMoves', { id: uid(), ts: at(date, 12, 10), date, sessionId: s.id, scope: 'tienda', kind: 'out', category: 'gasto', concept: pick(['Fundas', 'Pago de luz', 'Transporte', 'Limpieza']), amount: pick([3, 4.5, 6, 12]) });
    const sm = sessionSummary(s.id);
    const exp = expectedFor(sm);
    const counted = { ...exp };
    if (rnd() < 0.12) counted.tienda = r2(exp.tienda + pick([-0.25, 0.5, -1]));
    const diff = {}; Object.keys(exp).forEach(k => { diff[k] = r2(counted[k] - exp[k]); });
    const f = ownerDayFigures('own', s.id);
    const acc = addAccounting({ date, ownerId: 'own', type: 'ventas', concept: `Ventas del día ${fmtDate(date)}`, sales: f.rev, cost: f.cost, sessionId: s.id, source: 'cierre' });
    s.status = 'closed'; s.closedAt = at(date, 20, 40);
    s.closing = { counted, expected: exp, diff, notes: '', editCount: 0, editIds: [], closedBy: 'Cajera', accounting: { ownerId: 'own', entryId: acc.id, sales: f.rev, cost: f.cost }, totals: { sales: sm.totalSales, cash: sm.cashSales, fiado: sm.fiadoSales, debtCollected: sm.debtCollected } };
    put('sessions', s);
    open = { ...counted };
  }
  // existencias realistas al final, algunos productos con poco stock y uno por vencer (para ver las alertas)
  prods.forEach(p => { p.stock = FRACTIONAL.has(p.unit) ? 30 + Math.floor(rnd() * 70) : 12 + Math.floor(rnd() * 70); put('products', p); });
  [[8, 5], [12, 3], [20, 4]].forEach(([i, st]) => { prods[i].stock = st; put('products', prods[i]); });
  prods[22].expiry = addDays(today(), 12); put('products', prods[22]);
  const c = cfg(); c.demo = true; c.accountingOwnerId = 'own'; saveCfg();
  // limpia el carrito y los avisos de la generación
  list('audit').filter(a => !a.edit).forEach(a => del('audit', a.id));
}
