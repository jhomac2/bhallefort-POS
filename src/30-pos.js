/* =====================================================================
   Pantalla de VENDER (lector de códigos, carrito, solo efectivo, fiado)
   ===================================================================== */
let actx = null;
function beep(kind = 'ok') {
  if (cfg().sound === false) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.connect(g); g.connect(actx.destination);
    o.type = kind === 'ok' ? 'sine' : 'square';
    o.frequency.value = kind === 'ok' ? 1250 : 200;
    g.gain.value = kind === 'ok' ? .07 : .05;
    o.start(); o.stop(actx.currentTime + (kind === 'ok' ? .07 : .28));
  } catch (e) { }
}
function persistCart() { try { localStorage.setItem('bh_cart', JSON.stringify({ cart: S.cart, held: S.held })); } catch (e) { } }
function restoreCart() { try { const d = JSON.parse(localStorage.getItem('bh_cart') || 'null'); if (d) { S.cart = d.cart || []; S.held = d.held || []; } } catch (e) { } }

const cartTotal = () => saleItemsTotal(S.cart);
let lastAddAt = 0;
let resSel = -1;
let resList = [];

VIEWS.vender = {
  title: 'Vender',
  render() {
    return `<div class="pos">
      <div class="pos-left">
        <div class="scanbox">${ic('barcode')}
          <input id="scan" class="in xl" placeholder="Escanea el código o escribe el nombre" autocomplete="off" autocapitalize="off" spellcheck="false" data-key="scan" data-in="scan-in" aria-label="Código o nombre del producto">
          <div class="results" id="results" hidden></div>
        </div>
        <div class="held" id="held"></div>
        <div class="cart" id="cart"></div>
        <div class="paybar" id="paybar"></div>
      </div>
      <div class="pos-right">
        <div class="row"><h3 style="font-size:16px;font-weight:800">Accesos rápidos</h3><span class="sp"></span><span class="kbdhint hide-m"><kbd>F12</kbd> cobrar · <kbd>F9</kbd> fiado · <kbd>*</kbd> cantidad (3*código)</span></div>
        <div class="quick" id="quick"></div>
        <div id="lastsales"></div>
      </div>
    </div>`;
  },
  after() { renderCart(); renderQuick(); renderLastSales(); setTimeout(focusScan, 20); },
};

function renderHeld() {
  const el = $('#held'); if (!el) return;
  el.innerHTML = S.held.map((h, i) => `<button data-act="held-open" data-i="${i}" title="Volver a esta venta">${ic('pause', 'sm')} En espera ${i + 1} · ${h.cart.length} prod · ${money(saleItemsTotal(h.cart))}</button>`).join('');
}
function renderCart() {
  persistCart();
  renderHeld();
  const el = $('#cart'), pb = $('#paybar');
  if (!el || !pb) return;
  if (!S.cart.length) {
    el.innerHTML = `<div class="cartempty">${ic('cart')}<div style="font-size:18px;font-weight:700;margin-top:6px">La venta está vacía</div><div>Pasa un producto por el lector o búscalo por nombre.</div></div>`;
  } else {
    el.innerHTML = `<table><thead><tr><th>Producto</th><th>Cantidad</th><th class="right">Precio</th><th class="right hide-m">Subtotal</th><th></th></tr></thead><tbody>${S.cart.map(l => {
      const changed = l.price !== l.listPrice;
      return `<tr data-key-row="${l.key}" id="row-${l.key}"><td><div class="pname">${esc(l.name)}</div><div class="sub-m num">${money(lineTotal(l))}</div><div class="xs muted hide-m">${ownerPill(l.ownerId)}${FRACTIONAL.has(l.unit) ? ' · por ' + UNITS[l.unit] : ''}</div></td>
      <td><div class="qty"><button data-act="cart-dec" data-k="${l.key}" aria-label="Menos">−</button><input data-ch="cart-qty" data-k="${l.key}" value="${qtyFmt(l.qty)}" inputmode="decimal" aria-label="Cantidad"><button data-act="cart-inc" data-k="${l.key}" aria-label="Más">+</button></div></td>
      <td class="right"><input class="price-in ${changed ? 'changed' : ''}" data-ch="cart-price" data-k="${l.key}" value="${l.price.toFixed(2)}" inputmode="decimal" aria-label="Precio" title="${changed ? 'Precio original ' + money(l.listPrice) : 'Toca para cambiar el precio'}"></td>
      <td class="right num hide-m" style="font-weight:800;font-size:17px">${money(lineTotal(l))}</td>
      <td class="right"><button class="btn ghost sm icon" data-act="cart-del" data-k="${l.key}" aria-label="Quitar">${ic('x', 'sm')}</button></td></tr>`;
    }).join('')}</tbody></table>`;
  }
  const total = cartTotal();
  const n = S.cart.length;
  pb.innerHTML = `<div class="pb-top"><div style="min-width:0"><div class="tl">Total · ${n} producto${n === 1 ? '' : 's'}</div><div class="total num" id="ptotal">${money(total)}</div></div>
      <button class="btn xl primary" data-act="pos-cobrar" ${n ? '' : 'disabled'} title="Cobrar en efectivo (F12)">${ic('check')} COBRAR</button></div>
    <div class="pb-bot">
      <label class="row nowrap" style="gap:6px"><span class="sm muted" style="font-weight:700">Paga con</span><input class="in num-in" id="recv" style="width:104px" inputmode="decimal" placeholder="$ monto" data-in="recv" value="${esc(S.recv || '')}"></label>
      <div class="bills">${[1, 5, 10, 20, 50].map(b => `<button data-act="bill" data-b="${b}">$${b}</button>`).join('')}<button data-act="bill" data-b="exact">Justo</button></div>
      <span class="change" id="chg"></span><span class="sp"></span>
      ${cfg().invoiceAsk ? `<label class="chk sm"><input type="checkbox" id="inv-chk" data-ch="inv-toggle" ${S.invoice ? 'checked' : ''}> Factura SRI</label>` : ''}
      ${n ? `<button class="btn ghost" data-act="cart-clear" title="Vaciar la venta" aria-label="Vaciar la venta">${ic('trash')}</button><button class="btn" data-act="pos-hold" title="Dejar esta venta en espera">${ic('pause')}<span class="hide-m">En espera</span></button>` : ''}
      <button class="btn" data-act="pos-fiado" ${n ? '' : 'disabled'} title="Fiado (F9)">${ic('users')} Fiado</button>
    </div>`;
  updateChange();
}
function updateChange() {
  const el = $('#chg'); if (!el) return;
  const v = S.recv;
  if (v === '' || v == null) { el.textContent = ''; el.className = 'change'; return; }
  const ch = r2(num(v) - cartTotal());
  el.className = 'change ' + (ch < 0 ? 'neg' : 'pos');
  el.textContent = ch < 0 ? `Faltan ${money(-ch)}` : `Vuelto ${money(ch)}`;
}
INP['recv'] = t => { S.recv = t.value; updateChange(); };
ACT['bill'] = t => { S.recv = t.dataset.b === 'exact' ? cartTotal().toFixed(2) : String(t.dataset.b); const i = $('#recv'); if (i) i.value = S.recv; updateChange(); };
CHG['inv-toggle'] = async t => {
  if (!t.checked) { S.invoice = null; return; }
  const h = await invoiceModal();
  if (!h) { t.checked = false; S.invoice = null; } else S.invoice = h;
};
function invoiceModal() {
  return new Promise(res => {
    modal({
      title: 'Datos para la factura (SRI)',
      html: `<p class="muted sm" style="margin:0 0 8px">Se guardan con la venta. La factura se emite aparte en el portal del SRI.</p><div class="col"><label class="f">Cédula o RUC<input class="in lg" id="iv-id" inputmode="numeric" autofocus></label><label class="f">Nombre o razón social<input class="in" id="iv-nm"></label><label class="f">Correo<input class="in" id="iv-em" type="email"></label></div>`,
      actions: [{ label: 'Cancelar', value: null }, { label: 'Guardar', cls: 'primary', onClick: h => { const id = h.$('#iv-id').value.trim(); if (!id) { toast('Escribe la cédula o RUC', { type: 'warn' }); return false; } h.close({ id, name: h.$('#iv-nm').value.trim(), email: h.$('#iv-em').value.trim() }); return false; } }],
      onClose: v => res(v || null),
    });
  });
}

/* --- Accesos rápidos y últimas ventas --- */
function renderQuick() {
  const el = $('#quick'); if (!el) return;
  const q = activeProducts().filter(p => p.quick).sort((a, b) => a.name.localeCompare(b.name));
  el.innerHTML = q.length ? q.map(p => `<button data-act="quick-add" data-pid="${p.id}"><i class="qo" style="background:${ownerColor(p.ownerId)}"></i><span class="qn">${esc(p.name)}</span><span class="qp">${money(p.price)}${FRACTIONAL.has(p.unit) ? `<span class="xs muted"> /${p.unit}</span>` : ''}</span></button>`).join('')
    : `<div class="empty card flat" style="grid-column:1/-1">${ic('star')}<div>Aquí aparecen los productos de <b>acceso rápido</b> (pan, huevos, fundas…).<br>Márcalos en <b>Productos</b>.</div></div>`;
}
function renderLastSales() {
  const el = $('#lastsales'); if (!el) return;
  const ses = curSession(); if (!ses) { el.innerHTML = ''; return; }
  const last = allSales().filter(s => s.sessionId === ses.id).slice(-4).reverse();
  el.innerHTML = last.length ? `<h3 style="font-size:14px;font-weight:800;margin:6px 0 4px">Últimas ventas</h3><div class="mvlog">${last.map(s => `<button class="li" data-act="sale-open" data-id="${s.id}" style="border:0;text-align:left;width:100%;${s.status === 'void' ? 'opacity:.5;text-decoration:line-through' : ''}"><span class="muted">#${s.no} ${fmtTime(s.ts)}</span><span class="sp"></span>${s.payType === 'fiado' ? '<span class="badge warn">Fiado</span>' : ''}${s.edited ? '<span class="badge info">Editada</span>' : ''}<b>${money(s.total)}</b></button>`).join('')}</div>` : '';
}

/* --- Agregar productos --- */
const newKey = () => 'k' + Math.random().toString(36).slice(2, 8);
function addLine(p, qty, price) {
  price = price ?? p.price;
  const ex = S.cart.find(l => l.pid === p.id && l.price === price);
  let line;
  if (ex) { ex.qty = Math.round((ex.qty + qty) * 1000) / 1000; line = ex; }
  else { line = { key: newKey(), pid: p.id, name: p.name, ownerId: p.ownerId, qty, price, cost: p.cost || 0, unit: p.unit || 'u', listPrice: p.price }; S.cart.push(line); }
  lastAddAt = Date.now();
  if (p.trackStock !== false && (p.stock || 0) - line.qty < 0) toast(`${p.name}: el stock registrado es ${qtyFmt(p.stock || 0)}`, { type: 'warn', ms: 2200 });
  renderCart();
  const row = $('#row-' + line.key);
  if (row) { row.scrollIntoView({ block: 'nearest' }); row.style.background = 'var(--brand-soft)'; setTimeout(() => { row.style.background = ''; }, 500); }
  beep('ok');
}
async function addProduct(p, qty = 1) {
  if (FRACTIONAL.has(p.unit) && qty === 1) {
    const r = await askQtyModal(p);
    if (!r) return;
    addLine(p, r);
  } else addLine(p, qty);
  const sc = $('#scan'); if (sc) { sc.value = ''; sc.focus(); }
  hideResults();
}
function askQtyModal(p) {
  return new Promise(res => {
    const u = UNITS[p.unit] || 'unidad';
    modal({
      title: `${p.name}`, size: 'narrow',
      html: `<p class="muted" style="margin:0 0 8px">Precio: ${money(p.price)} por ${u}</p><div class="col">
        <label class="f">Cantidad (${u}s)<input class="in xl num-in" id="aq-q" inputmode="decimal" placeholder="1" autofocus></label>
        <div class="center muted sm">o</div>
        <label class="f">Monto en dólares<input class="in xl num-in" id="aq-m" inputmode="decimal" placeholder="$0.00"></label></div>`,
      actions: [{ label: 'Cancelar', value: null }, { label: 'Agregar', cls: 'primary', id: 'aq-ok', onClick: h => { const q = num(h.$('#aq-q').value); if (q <= 0) { toast('Escribe la cantidad o el monto', { type: 'warn' }); return false; } h.close(q); return false; } }],
      onClose: v => res(v || null),
      onOpen: h => {
        const q = h.$('#aq-q'), m = h.$('#aq-m');
        q.addEventListener('input', () => { m.value = q.value ? r2(num(q.value) * p.price).toFixed(2) : ''; });
        m.addEventListener('input', () => { q.value = m.value && p.price ? String(Math.round(num(m.value) / p.price * 1000) / 1000) : ''; });
        [q, m].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); h.$('#aq-ok').click(); } }));
      },
    });
  });
}
ACT['quick-add'] = t => { const p = get('products', t.dataset.pid); if (p) addProduct(p); };

/* --- Búsqueda y lector --- */
function hideResults() { const r = $('#results'); if (r) { r.hidden = true; r.innerHTML = ''; } resSel = -1; resList = []; }
INP['scan-in'] = t => {
  const q = t.value.trim();
  const m = /^(\d+(?:[.,]\d+)?)\s*[*xX]\s*(.*)$/.exec(q);
  const term = m ? m[2] : q;
  if (!term) return hideResults();
  resList = searchProducts(term, 8);
  resSel = resList.length ? 0 : -1;
  const r = $('#results');
  if (!resList.length) { r.hidden = !(term.length >= 3 && !/^\d+$/.test(term)); r.innerHTML = `<div class="empty">No hay productos con «${esc(term)}». <button class="btn sm primary" data-act="new-from-search">Crear producto</button></div>`; return; }
  r.hidden = false;
  r.innerHTML = resList.map((p, i) => `<button class="${i === resSel ? 'sel' : ''}" data-act="pick" data-pid="${p.id}">${ownerDot(p.ownerId)}<span class="nm">${esc(p.name)}<div class="xs muted">${esc(ownerName(p.ownerId))}${p.barcode ? ' · ' + esc(p.barcode) : ''} · stock ${qtyFmt(p.stock || 0)}</div></span><b class="num">${money(p.price)}</b></button>`).join('');
};
ACT['pick'] = t => {
  const m = /^(\d+(?:[.,]\d+)?)\s*[*xX]/.exec($('#scan')?.value || '');
  const p = get('products', t.dataset.pid); if (p) addProduct(p, m ? num(m[1]) : 1);
};
ACT['new-from-search'] = () => { const v = ($('#scan')?.value || '').trim(); hideResults(); openProductForm(null, { name: v, quick: true, addToCart: true }); };
KEY['scan'] = (t, e) => {
  const r = $('#results');
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!resList.length) return;
    e.preventDefault();
    resSel = (resSel + (e.key === 'ArrowDown' ? 1 : -1) + resList.length) % resList.length;
    $$('button', r).forEach((b, i) => b.classList.toggle('sel', i === resSel));
    return;
  }
  if (e.key === 'Escape') { t.value = ''; hideResults(); return; }
  if (e.key !== 'Enter') return;
  e.preventDefault();
  let v = t.value.trim();
  if (!v) { if (S.cart.length && Date.now() - lastAddAt > 700) ACT['pos-cobrar'](); return; }
  let qty = 1;
  const m = /^(\d+(?:[.,]\d+)?)\s*[*xX]\s*(.+)$/.exec(v);
  if (m) { qty = num(m[1]) || 1; v = m[2].trim(); }
  const bc = findByBarcode(v);
  if (bc) { addProduct(bc, qty); return; }
  const found = resList.length ? resList : searchProducts(v, 8);
  if (found.length) { addProduct(found[Math.max(0, resSel)] || found[0], qty); return; }
  beep('err');
  if (/^[\dA-Za-z\-]{4,}$/.test(v) && /\d/.test(v)) {
    hideResults(); t.value = '';
    toast(`El código ${v} no está registrado. Créalo ahora.`, { type: 'warn' });
    openProductForm(null, { barcode: v, quick: true, addToCart: true });
  } else toast(`No encontré «${v}»`, { type: 'warn' });
};

/* --- Líneas del carrito --- */
const lineByKey = k => S.cart.find(l => l.key === k);
ACT['cart-inc'] = t => { const l = lineByKey(t.dataset.k); if (l) { l.qty = Math.round((l.qty + 1) * 1000) / 1000; renderCart(); } };
ACT['cart-dec'] = t => { const l = lineByKey(t.dataset.k); if (l) { l.qty = Math.round((l.qty - 1) * 1000) / 1000; if (l.qty <= 0) S.cart = S.cart.filter(x => x !== l); renderCart(); } };
ACT['cart-del'] = t => { S.cart = S.cart.filter(l => l.key !== t.dataset.k); renderCart(); focusScan(); };
CHG['cart-qty'] = t => { const l = lineByKey(t.dataset.k); const q = num(t.value); if (l) { if (q <= 0) S.cart = S.cart.filter(x => x !== l); else l.qty = q; renderCart(); focusScan(); } };
CHG['cart-price'] = t => { const l = lineByKey(t.dataset.k); const p = num(t.value); if (l && p >= 0) { l.price = r2(p); renderCart(); focusScan(); } };
ACT['cart-clear'] = async () => { if (await ask({ title: 'Vaciar la venta', msg: '¿Quitar todos los productos de esta venta?', ok: 'Vaciar', danger: true })) { S.cart = []; S.recv = ''; renderCart(); focusScan(); } };
ACT['pos-hold'] = () => { if (!S.cart.length) return; S.held.push({ cart: S.cart, ts: Date.now() }); S.cart = []; S.recv = ''; renderCart(); focusScan(); toast('Venta en espera. Atiende al siguiente cliente.'); };
ACT['held-open'] = t => {
  const i = +t.dataset.i; const h = S.held[i]; if (!h) return;
  S.held.splice(i, 1);
  if (S.cart.length) S.held.splice(i, 0, { cart: S.cart, ts: Date.now() });
  S.cart = h.cart; renderCart(); focusScan();
};

/* --- Cobrar --- */
function bigChange(ch, no, total) {
  toast(`<div>Venta #${no} · ${money(total)}</div><div>Vuelto <span class="num">${money(ch)}</span></div>`, { html: true, type: 'ok', cls: 'vuelto', ms: 7000 });
}
async function posSell(payType, customerId) {
  const total = cartTotal();
  const received = S.recv !== '' && S.recv != null && payType === 'efectivo' ? num(S.recv) : null;
  if (received !== null && r2(received) < total) { toast(`El cliente paga ${money(received)} y el total es ${money(total)}. Corrige el monto.`, { type: 'bad' }); $('#recv')?.focus(); return; }
  const items = S.cart.map(l => ({ ...l }));
  const sale = createSale({ items, payType, customerId, received, invoice: S.invoice || null });
  S.cart = []; S.recv = ''; S.invoice = null;
  renderCart(); renderTop(); renderMV(); renderLastSales();
  focusScan();
  const undo = { label: 'Deshacer', fn: () => {
    const s = get('sales', sale.id);
    if (!s || s.status === 'void') return;
    if (s.payType === 'fiado' && (s.paid || 0) > 0) { toast('Esa venta ya tiene abonos', { type: 'bad' }); return; }
    voidSale(s, 'Deshecha justo después de cobrar');
    S.cart = s.items.map(l => ({ key: newKey(), pid: l.pid, name: l.name, ownerId: l.ownerId, qty: l.qty, price: l.price, cost: l.cost, unit: l.unit, listPrice: l.listPrice ?? l.price }));
    renderCart(); renderTop(); renderLastSales(); toast('Venta deshecha. Los productos volvieron a la lista.');
  } };
  if (payType === 'efectivo' && received !== null && sale.change > 0) bigChange(sale.change, sale.no, total);
  else toast(`Venta #${sale.no} guardada · ${money(total)}${payType === 'fiado' ? ' (fiado)' : ''}`, { type: 'ok', action: undo, ms: 5000 });
}
ACT['pos-cobrar'] = () => {
  if (!S.cart.length) { toast('Agrega productos primero', { type: 'warn' }); return; }
  if (!curSession()) { toast('La caja está cerrada', { type: 'bad' }); return; }
  return posSell('efectivo', null);
};

/* --- Fiado --- */
function ACT_fiadoModal() {
  const total = cartTotal();
  const h = modal({
    title: `Fiado · ${money(total)}`,
    html: `<div class="col"><input class="in lg" id="fi-q" placeholder="Buscar cliente por nombre" autofocus autocomplete="off"><div id="fi-list" class="mvlog" style="max-height:260px;overflow:auto"></div>
      <hr><div class="t" style="font-weight:800">Cliente nuevo</div>
      <div class="grid g2"><label class="f">Nombre<input class="in" id="fi-n"></label><label class="f">Teléfono (opcional)<input class="in" id="fi-t" inputmode="tel"></label></div></div>`,
    actions: [{ label: 'Cancelar' }, { label: 'Guardar cliente y fiar', cls: 'primary', onClick: async hh => { const n = hh.$('#fi-n').value.trim(); if (!n) { toast('Escribe el nombre del cliente nuevo', { type: 'warn' }); return false; } const c = addCustomer(n, hh.$('#fi-t').value); hh.close(); await posSell('fiado', c.id); return false; } }],
    onOpen: hh => {
      const draw = () => {
        const q = norm(hh.$('#fi-q').value);
        const cs = customers().filter(c => !q || norm(c.name).includes(q)).slice(0, 30);
        hh.$('#fi-list').innerHTML = cs.length ? cs.map(c => { const d = customerDebt(c.id); return `<button class="li" data-cid="${c.id}" style="border:0;text-align:left;width:100%;min-height:46px;cursor:pointer"><b>${esc(c.name)}</b><span class="sp"></span>${d > 0 ? `<span class="badge warn">Debe ${money(d)}</span>` : '<span class="badge ok">Al día</span>'}</button>`; }).join('') : '<div class="muted sm">No hay clientes con ese nombre. Crea uno abajo.</div>';
      };
      draw();
      hh.$('#fi-q').addEventListener('input', draw);
      hh.$('#fi-list').addEventListener('click', async e => { const b = e.target.closest('[data-cid]'); if (!b) return; hh.close(); await posSell('fiado', b.dataset.cid); });
    },
  });
}
ACT['pos-fiado'] = () => {
  if (!S.cart.length) { toast('Agrega productos primero', { type: 'warn' }); return; }
  ACT_fiadoModal();
};
