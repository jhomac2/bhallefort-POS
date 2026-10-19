/* =====================================================================
   PRODUCTOS e inventario: dueños, importación, ingreso de mercadería
   ===================================================================== */
VIEWS.productos = {
  title: 'Productos e inventario',
  render() {
    const ps = activeProducts();
    const own = S.owner;
    const invCost = r2(sum(ps, p => Math.max(0, p.stock || 0) * (p.cost || 0))), invPrice = r2(sum(ps, p => Math.max(0, p.stock || 0) * (p.price || 0)));
    return `<div class="toolbar">
      <input class="in" id="prod-q" data-in="prod-q" placeholder="Buscar por nombre, código o dueño" style="flex:1;min-width:220px" value="${esc(S.prodQ)}">
      <select class="in" id="prod-owner" data-ch="prod-owner" aria-label="Dueño"><option value="all">Todos los dueños</option>${owners().map(o => `<option value="${o.id}" ${S.prodOwner === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>
      <select class="in" id="prod-filter" data-ch="prod-filter" aria-label="Filtro">${[['all', 'Todos'], ['low', 'Stock bajo'], ['zero', 'Sin stock'], ['exp', 'Por vencer (30 días)'], ['quick', 'Acceso rápido'], ['nocost', 'Sin costo'], ['inactive', 'Desactivados']].map(([k, n]) => `<option value="${k}" ${S.prodFilter === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <button class="btn primary" data-act="prod-new">${ic('plus')} Nuevo producto</button>
      <button class="btn" data-act="stock-in">${ic('down')} Ingresar mercadería</button>
      <button class="btn" data-act="prod-import">${ic('up')} Importar</button>
      <button class="btn" data-act="prod-export">${ic('file')} Exportar</button>
    </div>
    <div class="row" style="margin-bottom:10px">
      <span class="chip">${ps.length} productos</span>
      ${lowStock().length ? `<span class="chip warn">${ic('alert', 'sm')} ${lowStock().length} con stock bajo</span>` : ''}
      ${expiringSoon(30).length ? `<span class="chip warn">${ic('clock', 'sm')} ${expiringSoon(30).length} por vencer</span>` : ''}
      ${own ? `<span class="chip">Inventario a costo <b class="num">${money(invCost)}</b></span><span class="chip">a precio <b class="num">${money(invPrice)}</b></span>` : ''}
      ${own && noCost().length ? `<span class="chip bad">${noCost().length} sin costo (la utilidad no será exacta)</span>` : ''}
    </div>
    <div id="prod-table"></div>`;
  },
  after() { drawProducts(); },
};
function filteredProducts() {
  const q = norm(S.prodQ);
  const toks = q.split(/\s+/).filter(Boolean);
  let arr = S.prodFilter === 'inactive' ? products().filter(p => p.active === false) : activeProducts();
  if (S.prodOwner !== 'all') arr = arr.filter(p => p.ownerId === S.prodOwner);
  const f = S.prodFilter;
  if (f === 'low') arr = arr.filter(p => p.trackStock !== false && (p.minStock || 0) > 0 && (p.stock || 0) <= p.minStock);
  if (f === 'zero') arr = arr.filter(p => p.trackStock !== false && (p.stock || 0) <= 0);
  if (f === 'exp') arr = arr.filter(p => p.expiry && p.expiry <= addDays(today(), 30));
  if (f === 'quick') arr = arr.filter(p => p.quick);
  if (f === 'nocost') arr = arr.filter(p => !p.cost);
  if (toks.length) arr = arr.filter(p => { const n = norm(`${p.name} ${p.barcode || ''} ${p.category || ''} ${ownerName(p.ownerId)}`); return toks.every(t => n.includes(t)); });
  return arr.sort((a, b) => a.name.localeCompare(b.name));
}
function drawProducts() {
  const el = $('#prod-table'); if (!el) return;
  const arr = filteredProducts();
  const own = S.owner;
  const shown = arr.slice(0, S.prodLimit);
  if (!arr.length) { el.innerHTML = `<div class="empty card">${ic('box')}<div style="font-weight:700">${products().length ? 'No hay productos con ese filtro.' : 'Aún no hay productos.'}</div><div>${products().length ? '' : 'Agrega el primero o importa tu inventario desde Excel (CSV).'}</div></div>`; return; }
  el.innerHTML = `<div class="tblwrap"><table class="tbl"><thead><tr><th>Producto</th><th class="hide-m">Código</th><th>Dueño</th>${own ? '<th class="r hide-m">Costo</th>' : ''}<th class="r">Precio</th>${own ? '<th class="r hide-m">Margen</th>' : ''}<th class="r">Stock</th><th class="hide-m">Vence</th></tr></thead><tbody>
    ${shown.map(p => {
      const low = p.trackStock !== false && (p.minStock || 0) > 0 && (p.stock || 0) <= p.minStock, zero = p.trackStock !== false && (p.stock || 0) <= 0;
      const mg = p.price > 0 && p.cost ? Math.round((p.price - p.cost) / p.price * 100) : null;
      const exp = p.expiry && p.expiry <= addDays(today(), 30);
      return `<tr class="click" data-act="prod-edit" data-id="${p.id}"><td><b>${esc(p.name)}</b>${p.quick ? ' <span class="badge info">rápido</span>' : ''}${p.active === false ? ' <span class="badge">inactivo</span>' : ''}<div class="xs muted">${esc(p.category || '')}${FRACTIONAL.has(p.unit) ? ' · por ' + UNITS[p.unit] : ''}</div></td>
      <td class="hide-m xs muted">${esc(p.barcode || '—')}</td><td>${ownerPill(p.ownerId)}</td>
      ${own ? `<td class="r hide-m">${p.cost ? money(p.cost) : '<span class="badge bad">falta</span>'}</td>` : ''}
      <td class="r num"><b>${money(p.price)}</b></td>${own ? `<td class="r hide-m">${mg === null ? '—' : mg + '%'}</td>` : ''}
      <td class="r"><span class="num" style="font-weight:800">${p.trackStock === false ? '—' : qtyFmt(p.stock || 0)}</span> ${zero ? '<span class="badge bad">0</span>' : low ? '<span class="badge warn">bajo</span>' : ''}</td>
      <td class="hide-m ${exp ? '' : 'muted'}">${p.expiry ? (exp ? `<span class="badge warn">${fmtDate(p.expiry)}</span>` : fmtDate(p.expiry)) : '—'}</td></tr>`;
    }).join('')}</tbody></table></div>
    ${arr.length > shown.length ? `<div class="center" style="margin-top:10px"><button class="btn" data-act="prod-more">Mostrar más (${arr.length - shown.length} restantes)</button></div>` : ''}`;
}
INP['prod-q'] = t => { S.prodQ = t.value; S.prodLimit = 150; drawProducts(); };
CHG['prod-owner'] = t => { S.prodOwner = t.value; S.prodLimit = 150; drawProducts(); };
CHG['prod-filter'] = t => { S.prodFilter = t.value; S.prodLimit = 150; drawProducts(); };
ACT['prod-more'] = () => { S.prodLimit += 300; drawProducts(); };
ACT['prod-new'] = () => openProductForm(null, {});
ACT['prod-edit'] = t => { const p = get('products', t.dataset.id); if (p) openProductForm(p, {}); };

/* --- Formulario de producto --- */
function openProductForm(p, opts = {}) {
  const edit = !!p;
  const own = S.owner;
  const quick = !!opts.quick && !edit;
  const d = p || { barcode: opts.barcode || '', name: opts.name || '', ownerId: cfg().lastOwnerId && get('owners', cfg().lastOwnerId) ? cfg().lastOwnerId : 'own', category: '', unit: 'u', cost: 0, price: 0, stock: 0, minStock: 0, expiry: '', quick: false, active: true, trackStock: true };
  const cats = Array.from(new Set(products().map(x => x.category).filter(Boolean))).sort();
  const ownerOpts = sel => owners().map(o => `<option value="${o.id}" ${o.id === sel ? 'selected' : ''}>${esc(o.name)}</option>`).join('');
  const h = modal({
    title: edit ? 'Editar producto' : (quick ? 'Producto nuevo' : 'Nuevo producto'), size: 'wide',
    html: `<div class="grid g2" style="gap:12px">
      <label class="f">Código de barras <span class="hint">Pasa el lector aquí o déjalo vacío para generar uno</span>
        <div class="row nowrap"><input class="in" id="pf-bc" value="${esc(d.barcode)}" data-key="pf-bc" autocomplete="off"><button class="btn" data-act="pf-gen" type="button">Generar</button></div></label>
      <label class="f">Nombre del producto *<input class="in" id="pf-name" value="${esc(d.name)}" ${quick ? 'autofocus' : ''} autocomplete="off"></label>
      <label class="f">Dueño del producto *<div class="row nowrap"><select class="in" id="pf-owner">${ownerOpts(d.ownerId)}</select><button class="btn" data-act="pf-newowner" type="button" title="Agregar dueño">${ic('plus')}</button></div></label>
      <label class="f">Precio de venta *<input class="in xl num-in" id="pf-price" inputmode="decimal" value="${d.price ? d.price.toFixed(2) : ''}" placeholder="0.00"></label>
      ${own || edit && own ? `<label class="f">Costo (lo que pagaste)<input class="in num-in" id="pf-cost" inputmode="decimal" value="${d.cost ? d.cost.toFixed(2) : ''}" placeholder="0.00"><span class="hint" id="pf-margin"></span></label>` : (!edit ? `<span></span>` : '')}
      <label class="f">${edit ? 'Stock actual' : 'Stock inicial'}<input class="in num-in" id="pf-stock" inputmode="decimal" value="${qtyFmt(d.stock || 0)}"></label>
      <label class="f">Se vende por<select class="in" id="pf-unit">${Object.keys(UNITS).map(k => `<option value="${k}" ${k === (d.unit || 'u') ? 'selected' : ''}>${UNITS[k]}</option>`).join('')}</select></label>
      ${quick ? '' : `<label class="f">Categoría<input class="in" id="pf-cat" list="pf-cats" value="${esc(d.category || '')}" placeholder="Ej.: Lácteos"><datalist id="pf-cats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
      <label class="f">Avisar si el stock baja de<input class="in num-in" id="pf-min" inputmode="decimal" value="${d.minStock ? qtyFmt(d.minStock) : ''}" placeholder="0"></label>
      <label class="f">Fecha de vencimiento<input class="in" id="pf-exp" type="date" value="${esc(d.expiry || '')}"></label>`}
      <div class="col" style="justify-content:end">
        <label class="chk"><input type="checkbox" id="pf-quick" ${d.quick ? 'checked' : ''}> Mostrar en accesos rápidos de Vender</label>
        <label class="chk"><input type="checkbox" id="pf-track" ${d.trackStock !== false ? 'checked' : ''}> Controlar stock de este producto</label>
        ${edit ? `<label class="chk"><input type="checkbox" id="pf-active" ${d.active !== false ? 'checked' : ''}> Producto activo (se puede vender)</label>` : ''}
      </div>
    </div>
    <div id="pf-err" class="alert bad" style="margin-top:10px" hidden></div>`,
    actions: [{ label: 'Cancelar' }, { label: edit ? 'Guardar cambios' : 'Guardar producto', cls: 'primary', id: 'pf-save', onClick: hh => saveProductForm(hh, p, opts) }],
    onOpen: hh => {
      const upd = () => { const m = $('#pf-margin', hh.el); if (!m) return; const pr = num($('#pf-price', hh.el).value), c = num($('#pf-cost', hh.el)?.value); m.textContent = pr > 0 && c > 0 ? `Ganancia por unidad ${money(pr - c)} (${Math.round((pr - c) / pr * 100)}%)` : ''; };
      hh.el.addEventListener('input', upd); upd();
      hh.el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.id !== 'pf-bc') { e.preventDefault(); $('#pf-save', hh.el).click(); } });
      if (!quick && !edit) $('#pf-bc', hh.el).focus();
      if (quick) { setTimeout(() => { const a = document.activeElement; if (a && a !== document.body && hh.el.contains(a)) return; $('#pf-name', hh.el).focus(); }, 40); }
    },
  });
}
KEY['pf-bc'] = (t, e) => { if (e.key === 'Enter') { e.preventDefault(); $('#pf-name').focus(); } };
ACT['pf-gen'] = () => { $('#pf-bc').value = genCode(); $('#pf-name').focus(); };
ACT['pf-newowner'] = async () => {
  const n = await askText({ title: 'Nuevo dueño de productos', label: 'Nombre del dueño', ok: 'Agregar' });
  if (!n || !n.trim()) return;
  if (allOwners().some(o => norm(o.name) === norm(n))) { toast('Ya existe un dueño con ese nombre', { type: 'warn' }); return; }
  const o = addOwner(n);
  const sel = $('#pf-owner');
  if (sel) { sel.innerHTML = owners().map(x => `<option value="${x.id}" ${x.id === o.id ? 'selected' : ''}>${esc(x.name)}</option>`).join(''); }
};
async function saveProductForm(h, p, opts) {
  const err = $('#pf-err', h.el); err.hidden = true;
  const fail = m => { err.textContent = m; err.hidden = false; return false; };
  const name = $('#pf-name', h.el).value.trim();
  const price = r2(num($('#pf-price', h.el).value));
  let bc = $('#pf-bc', h.el).value.trim();
  if (!name) return fail('Escribe el nombre del producto.');
  if (!(price > 0)) return fail('Escribe el precio de venta.');
  if (bc) { const ex = findByBarcode(bc); if (ex && (!p || ex.id !== p.id)) return fail(`Ese código ya pertenece a «${ex.name}».`); }
  else if (!p) bc = genCode();
  const costEl = $('#pf-cost', h.el);
  const data = {
    barcode: bc, name, ownerId: $('#pf-owner', h.el).value, price, unit: $('#pf-unit', h.el).value,
    stock: Math.round(num($('#pf-stock', h.el).value) * 1000) / 1000, quick: $('#pf-quick', h.el).checked, trackStock: $('#pf-track', h.el).checked,
    cost: costEl ? r2(num(costEl.value)) : (p ? p.cost : 0),
  };
  const cat = $('#pf-cat', h.el); if (cat) { data.category = cat.value.trim(); data.minStock = num($('#pf-min', h.el).value); data.expiry = $('#pf-exp', h.el).value || ''; }
  const act = $('#pf-active', h.el); if (act) data.active = act.checked; else if (!p) data.active = true;
  const cc = cfg(); cc.lastOwnerId = data.ownerId; saveCfg();
  const saved = saveProduct(data, p);
  toast(p ? 'Producto actualizado' : 'Producto guardado', { type: 'ok' });
  if (opts.addToCart) { await addProduct(saved, 1); }
  if (S.view === 'productos') { renderView(); } else if (S.view === 'vender') { renderQuick(); }
  renderTop();
  return true;
}

/* --- Ingresar mercadería --- */
ACT['stock-in'] = () => openStockIn();
function openStockIn() {
  let sel = null;
  const own = S.owner;
  const h = modal({
    title: 'Ingresar mercadería', size: 'wide',
    html: `<div class="col"><label class="f">Producto <span class="hint">Pasa el lector o escribe el nombre</span><input class="in lg" id="si-q" autocomplete="off" autofocus></label>
      <div id="si-res" class="mvlog"></div><div id="si-sel" class="alert ok" hidden></div>
      <div class="grid g2"><label class="f">Cantidad que llegó *<input class="in xl num-in" id="si-qty" inputmode="decimal" placeholder="0"></label>
      ${own ? `<label class="f">Costo por unidad (nuevo)<input class="in xl num-in" id="si-cost" inputmode="decimal" placeholder="Igual al anterior"></label>` : '<span></span>'}
      <label class="f">Proveedor (opcional)<input class="in" id="si-sup"></label>
      <label class="chk" style="align-self:end"><input type="checkbox" id="si-paid"> Lo pagué con efectivo de la caja</label></div></div>`,
    actions: [{ label: 'Cerrar' }, { label: 'Guardar y agregar otro', onClick: hh => saveStockIn(hh, sel, false), keep: true }, { label: 'Guardar', cls: 'primary', onClick: hh => saveStockIn(hh, sel, true) }],
    onOpen: hh => {
      const q = $('#si-q', hh.el);
      const pick = p => { sel = p; hh._sel = p; $('#si-sel', hh.el).hidden = false; $('#si-sel', hh.el).innerHTML = `${ic('check')}<span><b>${esc(p.name)}</b> · ${esc(ownerName(p.ownerId))} · stock actual ${qtyFmt(p.stock || 0)} · costo ${money(p.cost || 0)}</span>`; $('#si-res', hh.el).innerHTML = ''; q.value = p.name; $('#si-qty', hh.el).focus(); };
      hh._pick = pick;
      q.addEventListener('input', () => { const arr = searchProducts(q.value, 6); $('#si-res', hh.el).innerHTML = arr.map(p => `<button class="li" data-pid="${p.id}" style="border:0;text-align:left;width:100%;min-height:42px;cursor:pointer">${ownerDot(p.ownerId)}<b>${esc(p.name)}</b><span class="sp"></span><span class="muted xs">stock ${qtyFmt(p.stock || 0)}</span></button>`).join(''); });
      q.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return; e.preventDefault();
        const bc = findByBarcode(q.value.trim()); if (bc) return pick(bc);
        const arr = searchProducts(q.value, 1); if (arr[0]) pick(arr[0]); else toast('Producto no encontrado', { type: 'warn' });
      });
      $('#si-res', hh.el).addEventListener('click', e => { const b = e.target.closest('[data-pid]'); if (b) pick(get('products', b.dataset.pid)); });
      $('#si-qty', hh.el).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); hh.el.querySelector('footer .primary').click(); } });
    },
  });
}
function saveStockIn(h, sel, closeAfter) {
  sel = sel || h._sel;
  if (!sel) { toast('Elige el producto primero', { type: 'warn' }); return false; }
  const qty = num($('#si-qty', h.el).value);
  if (!(qty > 0)) { toast('Escribe la cantidad', { type: 'warn' }); $('#si-qty', h.el).focus(); return false; }
  const costEl = $('#si-cost', h.el);
  const newCost = costEl && costEl.value.trim() !== '' ? r2(num(costEl.value)) : null;
  const paid = $('#si-paid', h.el).checked;
  const p = get('products', sel.id);
  const ses = curSession();
  adjustStock(p.id, qty);
  const oldCost = p.cost;
  if (newCost !== null && newCost !== p.cost) { const pp = get('products', p.id); pp.cost = newCost; put('products', pp); }
  const unitCost = newCost !== null ? newCost : (oldCost || 0);
  put('purchases', { id: uid(), ts: new Date().toISOString(), date: ses ? ses.date : today(), sessionId: ses ? ses.id : null, supplier: $('#si-sup', h.el).value.trim(), pid: p.id, name: p.name, ownerId: p.ownerId, qty, cost: unitCost, total: r2(qty * unitCost), paidCash: paid });
  if (paid && ses && unitCost > 0) put('cashMoves', { id: uid(), ts: new Date().toISOString(), date: ses.date, sessionId: ses.id, scope: 'tienda', kind: 'out', category: 'compra', concept: `Compra de ${p.name}${$('#si-sup', h.el).value.trim() ? ' a ' + $('#si-sup', h.el).value.trim() : ''}`, amount: r2(qty * unitCost) });
  audit('Mercadería ingresada', `${qtyFmt(qty)} x ${p.name} (${ownerName(p.ownerId)})${newCost !== null && newCost !== oldCost ? `, costo ${money(oldCost || 0)} → ${money(newCost)}` : ''}`, { entity: 'product', entityId: p.id });
  toast(`${p.name}: +${qtyFmt(qty)} (stock ${qtyFmt(get('products', p.id).stock)})`, { type: 'ok' });
  if (S.view === 'productos') drawProducts();
  if (!closeAfter) {
    h._sel = null; $('#si-q', h.el).value = ''; $('#si-qty', h.el).value = ''; if (costEl) costEl.value = ''; $('#si-sel', h.el).hidden = true; $('#si-q', h.el).focus();
    return false;
  }
  return true;
}

/* --- Importar / exportar --- */
const CSV_HEAD = ['codigo', 'nombre', 'dueno', 'categoria', 'unidad', 'costo', 'precio', 'stock', 'minimo'];
ACT['prod-export'] = async () => {
  const rows = [['codigo', 'nombre', 'dueno', 'categoria', 'unidad', 'costo', 'precio', 'stock', 'minimo']];
  filteredProducts().forEach(p => rows.push([p.barcode || '', p.name, ownerName(p.ownerId), p.category || '', p.unit || 'u', S.owner ? (p.cost || 0) : '', p.price, p.stock || 0, p.minStock || 0]));
  const r = await saveFile(`productos-${today()}.csv`, toCSV(rows));
  if (r === 'saved') toast('Archivo listo', { type: 'ok' });
};
ACT['prod-import'] = () => {
  let parsed = null;
  const h = modal({
    title: 'Importar productos', size: 'wide',
    html: `<div class="col"><p class="muted" style="margin:0">Sube un archivo CSV (puedes guardar tu Excel como «CSV») o pega las filas. Columnas: <b>${CSV_HEAD.join(', ')}</b>. Los dueños que no existan se crean solos. Si el código ya existe, se actualizan sus datos y el stock.</p>
      <div class="row"><input type="file" id="im-file" accept=".csv,.txt,text/csv" class="in" style="max-width:320px"><button class="btn" data-act="im-tpl">${ic('down')} Plantilla de ejemplo</button></div>
      <textarea class="in" id="im-text" rows="6" placeholder="codigo,nombre,dueno,categoria,unidad,costo,precio,stock,minimo&#10;7861001,Leche entera 1L,Tienda,Lácteos,u,0.85,1.10,24,6"></textarea>
      <div id="im-prev"></div></div>`,
    actions: [{ label: 'Cancelar' }, { label: 'Revisar', onClick: hh => { review(hh); return false; }, keep: true }, { label: 'Importar', cls: 'primary', id: 'im-go', onClick: hh => doImport(hh, parsed) }],
    onOpen: hh => {
      $('#im-go', hh.el).disabled = true;
      $('#im-file', hh.el).addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { $('#im-text', hh.el).value = rd.result; review(hh); }; rd.readAsText(f, 'utf-8'); });
    },
  });
  function review(hh) {
    const rows = parseCSV($('#im-text', hh.el).value);
    if (rows.length < 2) { $('#im-prev', hh.el).innerHTML = '<div class="alert warn">Pega o sube al menos la fila de encabezados y un producto.</div>'; parsed = null; $('#im-go', hh.el).disabled = true; return; }
    const head = rows[0].map(x => norm(x).replace(/[^a-z]/g, ''));
    const idx = k => head.indexOf(k);
    const need = ['nombre', 'precio'];
    const miss = need.filter(k => idx(k) < 0);
    if (miss.length) { $('#im-prev', hh.el).innerHTML = `<div class="alert bad">Falta la columna: ${miss.join(', ')}</div>`; parsed = null; $('#im-go', hh.el).disabled = true; return; }
    const out = []; const bad = [];
    rows.slice(1).forEach((r, i) => {
      const g = k => idx(k) >= 0 ? String(r[idx(k)] ?? '').trim() : '';
      const name = g('nombre'), price = num(g('precio'));
      if (!name || !(price > 0)) { bad.push(i + 2); return; }
      out.push({ barcode: g('codigo'), name, owner: g('dueno') || 'Tienda', category: g('categoria'), unit: (Object.keys(UNITS).find(k => k === norm(g('unidad')) || norm(UNITS[k]) === norm(g('unidad')))) || 'u', cost: r2(num(g('costo'))), price: r2(price), stock: num(g('stock')), minStock: num(g('minimo')) });
    });
    parsed = out;
    const newOwners = Array.from(new Set(out.map(o => o.owner))).filter(n => !allOwners().some(o => norm(o.name) === norm(n)));
    const existing = out.filter(o => o.barcode && findByBarcode(o.barcode)).length;
    $('#im-prev', hh.el).innerHTML = `<div class="alert ${bad.length ? 'warn' : 'ok'}">${ic('info')}<span><b>${out.length}</b> productos listos (${existing} ya existen y se actualizarán).${newOwners.length ? ` Dueños nuevos: <b>${esc(newOwners.join(', '))}</b>.` : ''}${bad.length ? ` Filas con error (sin nombre o precio): ${bad.slice(0, 10).join(', ')}${bad.length > 10 ? '…' : ''}.` : ''}</span></div>`;
    $('#im-go', hh.el).disabled = !out.length;
  }
  function doImport(hh, list_) {
    if (!list_ || !list_.length) { toast('Primero pulsa «Revisar»', { type: 'warn' }); return false; }
    let created = 0, updated = 0;
    list_.forEach(o => {
      let ow = allOwners().find(x => norm(x.name) === norm(o.owner));
      if (!ow) ow = addOwner(o.owner);
      const ex = o.barcode ? findByBarcode(o.barcode) : null;
      const data = { barcode: o.barcode || (ex ? ex.barcode : genCode()), name: o.name, ownerId: ow.id, category: o.category, unit: o.unit, price: o.price, stock: o.stock, minStock: o.minStock, cost: S.owner ? o.cost : (ex ? ex.cost : o.cost), quick: ex ? ex.quick : false, trackStock: true, active: true, expiry: ex ? ex.expiry : '' };
      if (ex) { saveProduct(data, ex); updated++; } else { saveProduct(data, null); created++; }
    });
    audit('Importación de productos', `${created} nuevos, ${updated} actualizados`, { entity: 'product' });
    toast(`Importado: ${created} nuevos, ${updated} actualizados`, { type: 'ok' });
    renderAll();
    return true;
  }
};
ACT['im-tpl'] = async () => {
  const rows = [CSV_HEAD, ['7861001000011', 'Leche entera 1L', 'Tienda', 'Lácteos', 'u', '0.85', '1.10', '24', '6'], ['', 'Arroz por libra', 'Tienda', 'Granos', 'lb', '0.45', '0.60', '50', '10']];
  await saveFile('plantilla-productos.csv', toCSV(rows));
};
