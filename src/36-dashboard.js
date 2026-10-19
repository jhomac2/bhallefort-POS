/* =====================================================================
   RESUMEN (dashboard del dueño): utilidad por día / semana / mes / año / rango
   ===================================================================== */
S.dash.table = false;
const KINDS = [['day', 'Día'], ['week', 'Semana'], ['month', 'Mes'], ['year', 'Año'], ['range', 'Rango']];
function dashRange() { const d = S.dash; return periodRange(d.kind, d.anchor, d.from, d.to); }
function deltaTxt(cur, prev, upGood = true) {
  if (!prev) return cur ? { t: 'Nuevo', c: 'eq' } : { t: '—', c: 'eq' };
  const p = Math.round((cur - prev) / Math.abs(prev) * 100);
  if (p === 0) return { t: 'Igual que antes', c: 'eq' };
  const up = p > 0;
  return { t: `${up ? '▲' : '▼'} ${Math.abs(p)}% vs período anterior`, c: (up === upGood) ? 'up' : 'down' };
}
function kpi(label, value, d, cls = '') { const vc = cls === 'hero' ? (String(value).length > 10 ? 'xlong' : String(value).length > 8 ? 'long' : '') : ''; return `<div class="card kpi ${cls}"><span class="l">${label}</span><span class="v ${vc}">${value}</span>${d ? `<span class="d ${d.c}">${d.t}</span>` : ''}</div>`; }

VIEWS.resumen = {
  title: 'Resumen y utilidad',
  render() {
    const d = S.dash;
    const [from, to] = dashRange();
    const oid = d.owner;
    const a = aggregate(from, to, { ownerId: oid });
    const [pf, pt] = prevRange(d.kind, d.anchor, d.from, d.to);
    const pa = aggregate(pf, pt, { ownerId: oid });
    const all = oid === 'all';
    const gastos = all ? expensesIn(from, to, 'tienda') : 0, pgastos = all ? expensesIn(pf, pt, 'tienda') : 0;
    const net = r2(a.profit - gastos), pnet = r2(pa.profit - pgastos);
    const st = mvStats(from, to), pst = mvStats(pf, pt);
    const label = periodLabel(d.kind, from, to);
    const ses = curSession(); const sm = ses ? sessionSummary(ses.id) : null;
    const nc = noCost().length;
    return `<div class="toolbar">
      <div class="seg" role="group" aria-label="Período">${KINDS.map(([k, n]) => `<button data-act="dash-kind" data-k="${k}" aria-pressed="${d.kind === k}">${n}</button>`).join('')}</div>
      ${d.kind !== 'range' ? `<button class="btn icon" data-act="dash-shift" data-d="-1" aria-label="Anterior">‹</button><b style="min-width:170px;text-align:center;font-size:16px">${esc(label)}</b><button class="btn icon" data-act="dash-shift" data-d="1" aria-label="Siguiente">›</button><button class="btn" data-act="dash-now">Hoy</button>`
        : `<input class="in" type="date" data-ch="dash-from" value="${d.from}" style="max-width:160px" aria-label="Desde"><span>a</span><input class="in" type="date" data-ch="dash-to" value="${d.to}" style="max-width:160px" aria-label="Hasta">`}
      <span class="sp"></span>
      <select class="in" data-ch="dash-owner" aria-label="Dueño" style="max-width:220px"><option value="all">Todos los dueños</option>${owners().map(o => `<option value="${o.id}" ${oid === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>
    </div>
    ${nc ? `<div class="alert warn" style="margin-bottom:12px">${ic('alert')}<span><b>${nc} productos no tienen costo.</b> Mientras falte, la utilidad se calcula como si costaran $0. Agrégalos en Productos (filtro «Sin costo»).</span></div>` : ''}
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(210px,1fr))">
      ${kpi(all ? 'Utilidad neta' : `Ganancia de ${esc(ownerName(oid))}`, money(all ? net : a.profit), deltaTxt(all ? net : a.profit, all ? pnet : pa.profit), 'hero')}
      ${kpi('Ventas', money(a.rev), deltaTxt(a.rev, pa.rev))}
      ${kpi('Utilidad bruta', money(a.profit), deltaTxt(a.profit, pa.profit))}
      ${kpi('Costo de lo vendido', money(a.cost), deltaTxt(a.cost, pa.cost, false))}
      ${all ? kpi('Gastos del negocio', money(gastos), deltaTxt(gastos, pgastos, false)) : ''}
      ${kpi('N° de ventas', String(a.count), deltaTxt(a.count, pa.count))}
      ${kpi('Venta promedio', money(a.avg), deltaTxt(a.avg, pa.avg))}
      ${kpi('Fiado sin cobrar', money(a.fiadoPend), null)}
    </div>
    <div class="card" style="margin-top:14px"><div class="row"><h3 style="margin:0">${S.dash.metric === 'profit' ? 'Utilidad' : 'Ventas'} ${d.kind === 'day' ? 'por hora' : d.kind === 'year' ? 'por mes' : 'por día'}</h3><span class="sp"></span>
      <div class="seg" role="group"><button data-act="dash-metric" data-m="rev" aria-pressed="${d.metric === 'rev'}">Ventas</button><button data-act="dash-metric" data-m="profit" aria-pressed="${d.metric === 'profit'}">Utilidad</button></div>
      <button class="btn sm" data-act="dash-table">${d.table ? 'Ver gráfico' : 'Ver como tabla'}</button></div>
      <div id="dash-chart" class="chart" style="margin-top:8px"></div></div>
    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h3>Por dueño de producto</h3>${ownerTable(a)}</div>
      <div class="card"><h3>Productos más vendidos</h3>${topList(a, 'rev')}<h3 style="margin-top:14px">Los que más ganancia dejan</h3>${topList(a, 'profit')}</div>
    </div>
    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h3>${ic('bank')} Mi Vecino en este período</h3>${mvCard(st, pst)}</div>
      <div class="card"><h3>Saldos de hoy</h3>${sm ? `${line('Efectivo tienda (debería haber)', money(sm.tiendaExpected), { bold: true })}${line('Efectivo Mi Vecino', money(sm.mvCash), { bold: true })}${line(`${bankBadge('pichincha')} Cuenta Pichincha`, money(sm.bankBal.pichincha), { bold: true })}${line(`${bankBadge('guayaquil')} Cuenta Guayaquil`, money(sm.bankBal.guayaquil), { bold: true })}` : '<div class="muted">La caja está cerrada.</div>'}
        ${line('Deudas por cobrar (fiados)', money(totalDebt()), { bold: true, top: true, color: 'var(--danger)' })}
        <h3 style="margin-top:14px">Atención</h3>${alertsList()}</div>
    </div>`;
  },
  after() { drawChart(); },
};
function ownerTable(a) {
  const rows = Array.from(a.byOwner.entries()).sort((x, y) => y[1].rev - x[1].rev);
  if (!rows.length) return '<div class="empty">Sin ventas en este período.</div>';
  const tot = a.rev || 1;
  return `<div class="tblwrap"><table class="tbl"><thead><tr><th>Dueño</th><th class="r">Ventas</th><th class="r">Ganancia</th><th class="r">%</th></tr></thead><tbody>${rows.map(([id, x]) => `<tr><td>${ownerPill(id)}</td><td class="r num">${money(r2(x.rev))}</td><td class="r num"><b>${money(r2(x.rev - x.cost))}</b></td><td class="r">${Math.round(x.rev / tot * 100)}%</td></tr>`).join('')}</tbody><tfoot><tr><td>Total</td><td class="r num">${money(a.rev)}</td><td class="r num">${money(a.profit)}</td><td></td></tr></tfoot></table></div>`;
}
function topList(a, by) {
  const arr = Array.from(a.byProduct.values()).map(p => ({ ...p, v: by === 'profit' ? r2(p.rev - p.cost) : r2(p.rev) })).sort((x, y) => y.v - x.v).slice(0, 8);
  if (!arr.length || arr[0].v <= 0) return '<div class="muted sm">Sin datos en este período.</div>';
  const mx = arr[0].v;
  return arr.map(p => `<div class="hbar"><span class="nm" title="${esc(p.name)}">${esc(p.name)}</span><span class="track"><span class="fill" style="width:${Math.max(2, p.v / mx * 100)}%"></span></span><span class="vv">${money(p.v)}</span></div>`).join('');
}
function mvCard(st, pst) {
  if (!st.count) return '<div class="empty">Sin operaciones en este período.</div>';
  const rowsT = Object.keys(OPS).filter(t => st.all[t].n);
  return `<div class="grid g2" style="margin-bottom:8px"><div class="kpi"><span class="l">Operaciones</span><span class="v" style="font-size:24px">${st.count}</span><span class="d ${deltaTxt(st.count, pst.count).c}">${deltaTxt(st.count, pst.count).t}</span></div><div class="kpi"><span class="l">Comisiones ganadas</span><span class="v" style="font-size:24px">${money(st.commissions)}</span></div></div>
    <div class="tblwrap"><table class="tbl"><thead><tr><th>Operación</th><th class="r">Pichincha</th><th class="r">Guayaquil</th></tr></thead><tbody>${rowsT.map(t => `<tr><td>${OPS[t].label}</td><td class="r num">${st.pichincha[t].n ? `${st.pichincha[t].n} · <b>${money(st.pichincha[t].total)}</b>` : '—'}</td><td class="r num">${st.guayaquil[t].n ? `${st.guayaquil[t].n} · <b>${money(st.guayaquil[t].total)}</b>` : '—'}</td></tr>`).join('')}</tbody></table></div>`;
}
function alertsList() {
  const low = lowStock().slice(0, 5), ex = expiringSoon(30).slice(0, 5);
  const out = [];
  if (low.length) out.push(`<div class="sm" style="font-weight:700;margin-top:4px">${ic('alert', 'sm')} Stock bajo (${lowStock().length})</div>` + low.map(p => `<div class="row nowrap sm"><span class="grow">${esc(p.name)}</span><span class="badge warn">${qtyFmt(p.stock || 0)} / mín ${qtyFmt(p.minStock)}</span></div>`).join(''));
  if (ex.length) out.push(`<div class="sm" style="font-weight:700;margin-top:8px">${ic('clock', 'sm')} Por vencer (${expiringSoon(30).length})</div>` + ex.map(p => `<div class="row nowrap sm"><span class="grow">${esc(p.name)}</span><span class="badge ${p.expiry < today() ? 'bad' : 'warn'}">${fmtDate(p.expiry)}</span></div>`).join(''));
  return out.join('') || '<div class="muted sm">Todo en orden: sin stock bajo ni productos por vencer.</div>';
}
ACT['dash-kind'] = t => { const d = S.dash; d.kind = t.dataset.k; if (d.kind === 'range') { const [f, to] = periodRange(d.kind === 'range' ? 'month' : d.kind, d.anchor); d.from = f; d.to = to; } renderView(); };
ACT['dash-shift'] = t => { S.dash.anchor = shiftAnchor(S.dash.kind, S.dash.anchor, +t.dataset.d); renderView(); };
ACT['dash-now'] = () => { S.dash.anchor = today(); renderView(); };
ACT['dash-metric'] = t => { S.dash.metric = t.dataset.m; renderView(); };
ACT['dash-table'] = () => { S.dash.table = !S.dash.table; renderView(); };
CHG['dash-from'] = t => { if (t.value) { S.dash.from = t.value; if (S.dash.to < t.value) S.dash.to = t.value; renderView(); } };
CHG['dash-to'] = t => { if (t.value) { S.dash.to = t.value; if (S.dash.from > t.value) S.dash.from = t.value; renderView(); } };
CHG['dash-owner'] = t => { S.dash.owner = t.value; renderView(); };

/* --- Gráfico de barras (SVG, una sola escala) --- */
function niceStep(max, n = 4) {
  if (max <= 0) return 1;
  const raw = max / n; const p = Math.pow(10, Math.floor(Math.log10(raw))); const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}
const compact = n => { const a = Math.abs(n); return a >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M' : a >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'K' : String(Math.round(n * 100) / 100); };
function dashBuckets() {
  const d = S.dash; const [from, to] = dashRange();
  const a = aggregate(from, to, { ownerId: d.owner });
  const val = x => d.metric === 'profit' ? r2(x.rev - x.cost) : r2(x.rev);
  const out = [];
  if (d.kind === 'day') {
    let lo = 6, hi = 21;
    a.byHour.forEach((x, h) => { if (x.n) { lo = Math.min(lo, h); hi = Math.max(hi, h); } });
    for (let h = lo; h <= hi; h++) out.push({ label: `${h}h`, full: `${pad(h)}:00 a ${pad(h)}:59`, v: val(a.byHour[h]), n: a.byHour[h].n });
    return out;
  }
  const days = Math.round((parseD(to) - parseD(from)) / 86400000) + 1;
  if (d.kind === 'year' || (d.kind === 'range' && days > 92)) {
    let cur = parseD(from); cur.setDate(1);
    while (dstr(cur) <= to) {
      const key = dstr(cur).slice(0, 7); const x = { rev: 0, cost: 0, n: 0 };
      a.byDay.forEach((v, k) => { if (k.startsWith(key)) { x.rev += v.rev; x.cost += v.cost; x.n += v.n; } });
      out.push({ label: MESES[cur.getMonth()].slice(0, 3), full: `${MESES[cur.getMonth()]} ${cur.getFullYear()}`, v: val(x), n: x.n });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    return out;
  }
  for (let i = 0; i < days; i++) {
    const k = addDays(from, i); const x = a.byDay.get(k) || { rev: 0, cost: 0, n: 0 };
    out.push({ label: d.kind === 'week' ? DIAS[parseD(k).getDay()].slice(0, 3) : String(parseD(k).getDate()), full: dayName(k), v: val(x), n: x.n });
  }
  return out;
}
function drawChart() {
  const el = $('#dash-chart'); if (!el) return;
  const b = dashBuckets();
  const total = r2(sum(b, x => x.v));
  if (S.dash.table) {
    el.innerHTML = `<div class="tblwrap" style="max-height:340px;overflow:auto"><table class="tbl"><thead><tr><th>Período</th><th class="r">N° ventas</th><th class="r">${S.dash.metric === 'profit' ? 'Utilidad' : 'Ventas'}</th></tr></thead><tbody>${b.map(x => `<tr><td>${esc(x.full)}</td><td class="r">${x.n}</td><td class="r num"><b>${money(x.v)}</b></td></tr>`).join('')}</tbody><tfoot><tr><td>Total</td><td class="r">${sum(b, x => x.n)}</td><td class="r num">${money(total)}</td></tr></tfoot></table></div>`;
    return;
  }
  if (!b.length || b.every(x => x.v === 0)) { el.innerHTML = `<div class="empty">${ic('chart')}<div>Sin ventas en este período.</div></div>`; return; }
  const W = Math.max(300, el.clientWidth || 700), H = 250, ml = 46, mr = 8, mt = 14, mb = 28;
  const maxV = Math.max(0, ...b.map(x => x.v)), minV = Math.min(0, ...b.map(x => x.v));
  const step = niceStep(Math.max(maxV, -minV), 4);
  const top = Math.ceil(maxV / step) * step || step, bot = Math.floor(minV / step) * step;
  const y = v => mt + (H - mt - mb) * (1 - (v - bot) / (top - bot));
  const iw = W - ml - mr, bw = iw / b.length, barW = Math.min(24, bw * 0.68);
  let g = '';
  for (let v = bot; v <= top + 1e-9; v += step) g += `<line class="grid" x1="${ml}" x2="${W - mr}" y1="${y(v)}" y2="${y(v)}"/><text x="${ml - 6}" y="${y(v) + 4}" text-anchor="end">${v < 0 ? '-' : ''}$${compact(Math.abs(v))}</text>`;
  const every = Math.ceil(b.length / Math.max(1, Math.floor(iw / 38)));
  const bars = b.map((x, i) => {
    const cx = ml + bw * i + bw / 2, y0 = y(0), yv = y(x.v);
    const h = Math.abs(yv - y0);
    const r = Math.min(4, h / 2);
    const px = cx - barW / 2;
    const path = x.v >= 0
      ? `M${px},${y0} V${yv + r} Q${px},${yv} ${px + r},${yv} H${px + barW - r} Q${px + barW},${yv} ${px + barW},${yv + r} V${y0} Z`
      : `M${px},${y0} V${yv - r} Q${px},${yv} ${px + r},${yv} H${px + barW - r} Q${px + barW},${yv} ${px + barW},${yv - r} V${y0} Z`;
    return `${x.v !== 0 ? `<path class="bar ${x.v < 0 ? 'neg' : ''}" d="${path}"/>` : ''}<rect x="${cx - bw / 2}" y="${mt}" width="${bw}" height="${H - mt - mb}" fill="transparent" data-i="${i}" data-cx="${cx}" data-top="${Math.min(y0, yv)}"/>${i % every === 0 ? `<text x="${cx}" y="${H - 9}" text-anchor="middle">${esc(x.label)}</text>` : ''}`;
  }).join('');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Gráfico de barras">${g}<line x1="${ml}" x2="${W - mr}" y1="${y(0)}" y2="${y(0)}" stroke="var(--ink-3)" stroke-width="1"/>${bars}</svg><div class="tip" id="dash-tip" hidden></div>
    <div class="xs muted" style="margin-top:2px">Total del período: <b class="num">${money(total)}</b></div>`;
  const tip = $('#dash-tip', el);
  el.querySelector('svg').addEventListener('mousemove', e => {
    const r = e.target.closest('rect[data-i]');
    if (!r) { tip.hidden = true; return; }
    const x = b[+r.dataset.i];
    tip.hidden = false; tip.innerHTML = `${esc(x.full)}<br><b>${money(x.v)}</b> · ${x.n} venta${x.n === 1 ? '' : 's'}`;
    tip.style.left = r.dataset.cx + 'px'; tip.style.top = (+r.dataset.top + 6) + 'px';
  });
  el.querySelector('svg').addEventListener('mouseleave', () => { tip.hidden = true; });
}
window.addEventListener('resize', debounce(() => { if (S.view === 'resumen') drawChart(); }, 150));
