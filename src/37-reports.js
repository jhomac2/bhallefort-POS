/* =====================================================================
   REPORTES: un solo documento (PDF) por reporte, vista previa y envío por WhatsApp
   ===================================================================== */
const dayName = d => DIAS[parseD(d).getDay()].slice(0, 3) + ' ' + fmtDate(d);
const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ---------- Constructores de contenido ---------- */
function repTienda(o) {
  const { from, to, showProfit } = o;
  const a = aggregate(from, to);
  const gastos = expensesIn(from, to, 'tienda');
  const cobrado = r2(sum(list('debtPayments').filter(p => !p.void && p.date >= from && p.date <= to), p => p.amount));
  const sec = [];
  const kv = [['Ventas totales', `${money(a.rev)}  (${a.count} ventas)`, true], ['Vendido en efectivo', money(a.cashRev)], ['Vendido a fiado', money(a.fiadoRev)], ['Del fiado de este período, aún por cobrar', money(a.fiadoPend)], ['Cobros de fiados recibidos en el período', money(cobrado)], ['Venta promedio por cliente', money(a.avg)]];
  if (showProfit) kv.push(['Costo de lo vendido', money(a.cost)], ['Utilidad bruta (ventas − costo)', money(a.profit), true], ['Gastos del negocio', money(gastos)], ['Utilidad neta', money(r2(a.profit - gastos)), true]);
  sec.push({ title: 'Resumen de ventas', kv });
  const days = Array.from(a.byDay.keys()).sort();
  if (days.length) {
    const head = ['Día', 'N° ventas', 'Ventas'].concat(showProfit ? ['Costo', 'Ganancia'] : []);
    sec.push({
      title: 'Ventas por día', table: {
        head, align: ['l', 'r', 'r', 'r', 'r'], rows: days.map(d => { const x = a.byDay.get(d); return [dayName(d), x.n, money(x.rev)].concat(showProfit ? [money(x.cost), money(r2(x.rev - x.cost))] : []); }),
        foot: ['Total', a.count, money(a.rev)].concat(showProfit ? [money(a.cost), money(a.profit)] : []),
      },
    });
  }
  if (a.byOwner.size) {
    const rows = Array.from(a.byOwner.entries()).sort((x, y) => y[1].rev - x[1].rev);
    sec.push({
      title: 'Ventas por dueño de producto', table: {
        head: ['Dueño', 'Ventas'].concat(showProfit ? ['Costo', 'Ganancia'] : []).concat(['Fiado por cobrar']), align: ['l', 'r', 'r', 'r', 'r'],
        rows: rows.map(([id, x]) => [ownerName(id), money(r2(x.rev))].concat(showProfit ? [money(r2(x.cost)), money(r2(x.rev - x.cost))] : []).concat([money(r2(x.pend))])),
        foot: ['Total', money(a.rev)].concat(showProfit ? [money(a.cost), money(a.profit)] : []).concat([money(a.fiadoPend)]),
      },
    });
  }
  const top = Array.from(a.byProduct.values()).sort((x, y) => y.rev - x.rev).slice(0, 20);
  if (top.length) sec.push({
    title: 'Productos más vendidos', table: {
      head: ['Producto', 'Dueño', 'Cantidad', 'Ventas'].concat(showProfit ? ['Ganancia'] : []), align: ['l', 'l', 'r', 'r', 'r'],
      rows: top.map(p => [p.name, ownerName(p.ownerId), `${qtyFmt(p.qty)} ${p.unit && p.unit !== 'u' ? p.unit : ''}`.trim(), money(r2(p.rev))].concat(showProfit ? [money(r2(p.rev - p.cost))] : [])),
    },
  });
  const ses = sessionsSorted().filter(s => s.date >= from && s.date <= to && s.status === 'closed');
  if (ses.length) sec.push({
    title: 'Cierres de caja', table: {
      head: ['Fecha', 'Caja inicial', 'Debía haber', 'Se contó', 'Resultado', 'Modif.'], align: ['l', 'r', 'r', 'r', 'r', 'r'],
      rows: ses.map(s => { const c = s.closing; const d = c.diff.tienda; return [fmtDate(s.date), money(s.opening.tienda), money(c.expected.tienda), money(c.counted.tienda), d === 0 ? 'Cuadra' : (d > 0 ? 'Sobra ' : 'Falta ') + money(Math.abs(d)), c.editCount]; }),
    },
  });
  const deb = customers().map(c => ({ c, d: customerDebt(c.id) })).filter(x => x.d > 0).sort((x, y) => y.d - x.d);
  if (deb.length) sec.push({ title: 'Deudas por cobrar (hoy)', kv: [['Total de deudas', money(totalDebt()), true]], table: { head: ['Cliente', 'Debe'], align: ['l', 'r'], rows: deb.slice(0, 20).map(x => [x.c.name, money(x.d)]) } });
  const edits = list('audit').filter(x => x.edit && x.date >= from && x.date <= to).sort((x, y) => x.ts < y.ts ? -1 : 1);
  sec.push(edits.length ? { title: `Modificaciones registradas (${edits.length})`, table: { head: ['Fecha y hora', 'Quién', 'Qué se cambió'], align: ['l', 'l', 'l'], rows: edits.slice(0, 25).map(x => [fmtDT(x.ts), x.user, x.summary]) }, note: edits.length > 25 ? `Se muestran las primeras 25 de ${edits.length}. El detalle completo está en el historial de cambios.` : '' } : { title: 'Modificaciones registradas', note: 'No hubo modificaciones de ventas, precios ni movimientos en este período.' });
  const wa = [`Ventas: ${money(a.rev)} (${a.count} ventas)`, `Efectivo: ${money(a.cashRev)} · Fiado: ${money(a.fiadoRev)}`];
  if (showProfit) wa.push(`Utilidad bruta: ${money(a.profit)}`, `Utilidad neta: ${money(r2(a.profit - gastos))}`);
  return { sections: sec, wa };
}
function sessionEndBalances(s) {
  if (s.closing) return s.closing.counted;
  const sm = sessionSummary(s.id);
  return { tienda: sm.tiendaExpected, mvCash: sm.mvCash, pichincha: sm.bankBal.pichincha, guayaquil: sm.bankBal.guayaquil };
}
function repMV(o) {
  const { from, to } = o;
  const st = mvStats(from, to);
  const sec = [];
  const types = Object.keys(OPS).filter(t => st.all[t].n > 0);
  const cell = x => x.n ? `${x.n} · ${money(x.total)}` : '—';
  const ins = r2(sum(types.filter(t => OPS[t].cash > 0), t => st.all[t].total)), outs = r2(sum(types.filter(t => OPS[t].cash < 0), t => st.all[t].total));
  const gastos = expensesIn(from, to, 'mv');
  sec.push({ title: 'Resumen de Mi Vecino', kv: [['Operaciones realizadas', String(st.count), true], ['Efectivo recibido (depósitos y servicios)', money(ins)], ['Efectivo entregado (retiros)', money(outs)], ['Comisiones ganadas', money(st.commissions), true]].concat(gastos ? [['Gastos de Mi Vecino', money(gastos)]] : []) });
  if (types.length) sec.push({ title: 'Operaciones por banco (cantidad · monto)', table: { head: ['Operación', 'Pichincha', 'Guayaquil', 'Total'], align: ['l', 'r', 'r', 'r'], rows: types.map(t => [OPS[t].label, cell(st.pichincha[t]), cell(st.guayaquil[t]), cell(st.all[t])]) } });
  const days = Array.from(st.byDay.keys()).sort();
  if (days.length > 1) sec.push({ title: 'Movimiento por día', table: { head: ['Día', 'Operaciones', 'Efectivo recibido', 'Efectivo entregado', 'Comisión'], align: ['l', 'r', 'r', 'r', 'r'], rows: days.map(d => { const x = st.byDay.get(d); return [dayName(d), x.n, money(x.dep), money(x.ret), money(x.com)]; }) } });
  const ses = sessionsSorted().filter(s => s.date >= from && s.date <= to);
  if (ses.length) sec.push({
    title: 'Saldos por día', table: {
      head: ['Fecha', 'Efectivo inicio', 'Efectivo fin', 'Pichincha inicio', 'Pichincha fin', 'Guayaquil inicio', 'Guayaquil fin'], align: ['l', 'r', 'r', 'r', 'r', 'r', 'r'],
      rows: ses.map(s => { const e = sessionEndBalances(s); return [fmtDate(s.date) + (s.status === 'open' ? ' (abierta)' : ''), money(s.opening.mvCash), money(e.mvCash), money(s.opening.pichincha), money(e.pichincha), money(s.opening.guayaquil), money(e.guayaquil)]; }),
    },
  });
  if (o.detail || from === to) sec.push(st.ops.length ? { title: 'Detalle de movimientos', table: { head: ['Fecha y hora', 'Banco', 'Operación', 'Monto', 'Comisión'], align: ['l', 'l', 'l', 'r', 'r'], rows: st.ops.slice(0, 400).map(x => [fmtDT(x.ts), BANKS[x.bank].name, OPS[x.type].label, money(x.amount), x.commission ? money(x.commission) : '—']) } } : { title: 'Detalle de movimientos', note: 'No hubo movimientos en este período.' });
  const last = ses[ses.length - 1];
  const wa = [`Operaciones: ${st.count}`, `Recibido: ${money(ins)} · Entregado: ${money(outs)}`];
  if (st.commissions) wa.push(`Comisiones: ${money(st.commissions)}`);
  if (last) { const e = sessionEndBalances(last); wa.push(`Saldos al final: Efectivo ${money(e.mvCash)} · Pichincha ${money(e.pichincha)} · Guayaquil ${money(e.guayaquil)}`); }
  return { sections: sec, wa };
}
function repOwner(o) {
  const { from, to, showProfit, ownerId } = o;
  const a = aggregate(from, to, { ownerId });
  const x = a.byOwner.get(ownerId) || { rev: 0, cost: 0, pend: 0, units: 0 };
  const sec = [];
  sec.push({ title: `Ventas de ${ownerName(ownerId)}`, kv: [['Total vendido de sus productos', money(a.rev), true], ['Vendido en efectivo', money(a.cashRev)], ['Vendido a fiado', money(a.fiadoRev)], ['Del fiado, aún por cobrar', money(r2(x.pend))]].concat(showProfit ? [['Costo de lo vendido', money(a.cost)], ['Ganancia', money(a.profit), true]] : []) });
  const days = Array.from(a.byDay.keys()).sort();
  if (days.length) sec.push({ title: 'Ventas por día', table: { head: ['Día', 'Ventas'].concat(showProfit ? ['Costo', 'Ganancia'] : []), align: ['l', 'r', 'r', 'r'], rows: days.map(d => { const y = a.byDay.get(d); return [dayName(d), money(r2(y.rev))].concat(showProfit ? [money(r2(y.cost)), money(r2(y.rev - y.cost))] : []); }), foot: ['Total', money(a.rev)].concat(showProfit ? [money(a.cost), money(a.profit)] : []) } });
  const prods = Array.from(a.byProduct.values()).sort((p, q) => q.rev - p.rev);
  if (prods.length) sec.push({ title: 'Productos vendidos', table: { head: ['Producto', 'Cantidad', 'Ventas'].concat(showProfit ? ['Ganancia'] : []), align: ['l', 'r', 'r', 'r'], rows: prods.slice(0, 60).map(p => [p.name, `${qtyFmt(p.qty)} ${p.unit && p.unit !== 'u' ? p.unit : ''}`.trim(), money(r2(p.rev))].concat(showProfit ? [money(r2(p.rev - p.cost))] : [])) } });
  const low = activeProducts().filter(p => p.ownerId === ownerId && p.trackStock !== false && (p.minStock || 0) > 0 && (p.stock || 0) <= p.minStock);
  if (low.length) sec.push({ title: 'Productos con poco stock', table: { head: ['Producto', 'Stock', 'Mínimo'], align: ['l', 'r', 'r'], rows: low.map(p => [p.name, qtyFmt(p.stock || 0), qtyFmt(p.minStock)]) } });
  const wa = [`Vendido: ${money(a.rev)}`].concat(showProfit ? [`Ganancia: ${money(a.profit)}`] : []);
  return { sections: sec, wa };
}
function repCierre(o) {
  const s = get('sessions', o.sessionId);
  if (!s) return { sections: [{ title: 'Sin datos', note: 'No hay una caja seleccionada.' }], wa: [] };
  const sm = sessionSummary(s.id);
  const c = s.closing;
  const sec = [];
  sec.push({ title: 'Resumen del día', kv: [['Caja abierta', `${fmtTime(s.openedAt)}${s.closedAt ? ' · cerrada ' + fmtTime(s.closedAt) : ' · aún abierta'}`], ['Ventas totales', `${money(sm.totalSales)}  (${sm.count} ventas)`, true], ['En efectivo', money(sm.cashSales)], ['A fiado (no suma a la caja)', money(sm.fiadoSales)], ['Cobros de fiados', money(sm.debtCollected)], ['Anuladas', String(sm.voided.length)]] });
  const exp = c ? c.expected : expectedFor(sm), cnt = c ? c.counted : null;
  sec.push({
    title: 'Conteo de caja', table: {
      head: ['Concepto', 'Inicio', 'Debía haber', 'Se contó', 'Resultado'], align: ['l', 'r', 'r', 'r', 'r'],
      rows: COUNT_ROWS.map(([k, n]) => { const d = c ? c.diff[k] : null; return [n, money(s.opening[k]), money(exp[k]), cnt ? money(cnt[k]) : '—', d === null ? 'Sin cerrar' : d === 0 ? 'Cuadra' : (d > 0 ? 'Sobra ' : 'Falta ') + money(Math.abs(d))]; }),
    },
  });
  const f = owners().map(ow => ({ ow, ...ownerDayFigures(ow.id, s.id) })).filter(x => x.rev > 0);
  if (f.length) sec.push({ title: 'Ventas por dueño', table: { head: ['Dueño', 'Ventas'].concat(o.showProfit ? ['Ganancia'] : []), align: ['l', 'r', 'r'], rows: f.map(x => [x.ow.name, money(x.rev)].concat(o.showProfit ? [money(x.profit)] : [])), foot: ['Total', money(r2(sum(f, x => x.rev)))].concat(o.showProfit ? [money(r2(sum(f, x => x.profit)))] : []) } });
  const bk = Object.keys(OPS).filter(t => sm.ops.some(x => x.type === t));
  sec.push({ title: 'Mi Vecino del día', kv: [['Operaciones', String(sm.ops.length), true], ['Efectivo recibido', money(sum(sm.ops.filter(x => OPS[x.type].cash > 0), x => x.amount))], ['Efectivo entregado', money(sum(sm.ops.filter(x => OPS[x.type].cash < 0), x => x.amount))], ['Comisiones', money(sm.commissions)]], table: bk.length ? { head: ['Operación', 'Pichincha', 'Guayaquil'], align: ['l', 'r', 'r'], rows: bk.map(t => { const g = b => { const z = sm.ops.filter(x => x.type === t && x.bank === b); return z.length ? `${z.length} · ${money(sum(z, x => x.amount))}` : '—'; }; return [OPS[t].label, g('pichincha'), g('guayaquil')]; }) } : null });
  if (sm.moves.length) sec.push({ title: 'Ingresos y egresos de efectivo', table: { head: ['Dónde', 'Concepto', 'Monto'], align: ['l', 'l', 'r'], rows: sm.moves.map(m => [m.scope === 'mv' ? 'Mi Vecino' : 'Tienda', m.concept, (m.kind === 'in' ? '+' : '-') + money(m.amount)]) } });
  const edits = sessionEdits(s.id);
  sec.push(edits.length ? { title: `Modificaciones del día (${edits.length})`, table: { head: ['Hora', 'Quién', 'Qué se cambió'], align: ['l', 'l', 'l'], rows: edits.map(x => [fmtTime(x.ts), x.user, x.summary]) } } : { title: 'Modificaciones del día', note: 'No hubo modificaciones.' });
  if (c && c.notes) sec.push({ title: 'Nota del cierre', note: c.notes });
  const wa = [`Ventas: ${money(sm.totalSales)} (${sm.count})`, `Efectivo: ${money(sm.cashSales)} · Fiado: ${money(sm.fiadoSales)}`];
  if (c) wa.push(`Tienda: ${c.diff.tienda === 0 ? 'cuadra' : (c.diff.tienda > 0 ? 'sobra ' : 'falta ') + money(Math.abs(c.diff.tienda))}`);
  wa.push(`Mi Vecino: ${sm.ops.length} operaciones`);
  return { sections: sec, wa };
}
function buildReport(o) {
  o = Object.assign({ showProfit: S.owner }, o);
  const store = cfg().storeName;
  let title, from = o.from, to = o.to, body;
  if (o.who === 'cierre') {
    const s = get('sessions', o.sessionId);
    from = to = s ? s.date : today();
    title = 'Cierre de caja'; body = repCierre(o);
  } else if (o.who === 'tienda') { title = 'Reporte de la tienda'; body = repTienda(o); }
  else if (o.who === 'mv') { title = 'Reporte de Mi Vecino'; body = repMV(o); }
  else if (o.who === 'owner') { title = `Reporte de ${ownerName(o.ownerId)}`; body = repOwner(o); }
  else {
    title = 'Reporte completo: tienda y Mi Vecino';
    const t = repTienda(o), m = repMV(o);
    body = { sections: [{ divider: 'TIENDA' }].concat(t.sections, [{ divider: 'MI VECINO' }], m.sections), wa: t.wa.concat(['—'], m.wa) };
  }
  const period = o.who === 'cierre' ? fmtDateLong(from) : (from === to ? fmtDateLong(from) : `Del ${fmtDate(from)} al ${fmtDate(to)}`);
  return { store, title, period, from, to, who: o.who, sections: body.sections, wa: body.wa, filename: `${slug(store)}-${slug(title)}-${from}${to !== from ? '_' + to : ''}.pdf`, generated: new Date().toISOString() };
}

/* ---------- Vista previa (HTML) ---------- */
function reportHTML(m) {
  return `<div class="report-prev"><div class="row" style="align-items:baseline"><h3 style="font-size:20px;font-weight:800">${esc(m.title)}</h3><span class="muted">${esc(m.period)}</span></div>
  ${m.sections.map(s => {
    if (s.divider) return `<div style="margin:22px 0 4px;padding:8px 12px;background:var(--brand);color:var(--brand-ink);border-radius:8px;font-family:var(--font-display);font-weight:800;letter-spacing:.12em">${esc(s.divider)}</div>`;
    let h = `<h4>${esc(s.title)}</h4>`;
    if (s.kv) h += `<table class="kv"><tbody>${s.kv.map(r => `<tr><td>${esc(r[0])}</td><td ${r[2] ? 'style="font-size:15px"' : ''}>${esc(r[1])}</td></tr>`).join('')}</tbody></table>`;
    if (s.table) h += `<div style="overflow-x:auto"><table><thead><tr>${s.table.head.map((x, i) => `<th class="${s.table.align[i] === 'r' ? 'r' : ''}">${esc(x)}</th>`).join('')}</tr></thead><tbody>${s.table.rows.map(r => `<tr>${r.map((x, i) => `<td class="${s.table.align[i] === 'r' ? 'r' : ''}">${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody>${s.table.foot ? `<tfoot><tr>${s.table.foot.map((x, i) => `<td class="${s.table.align[i] === 'r' ? 'r' : ''}" style="font-weight:800">${esc(x)}</td>`).join('')}</tr></tfoot>` : ''}</table></div>`;
    if (s.note) h += `<p class="muted" style="margin:6px 0">${esc(s.note)}</p>`;
    return h;
  }).join('')}</div>`;
}

/* ---------- PDF ---------- */
function pdfSafe(s) {
  return String(s ?? '').replace(/→/g, '->').replace(/−/g, '-').replace(/[^\x20-\x7E -ÿ€…‘’“”•–—]/g, '');
}
function reportPDF(m) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, ML = 14, MR = 14;
  const green = [15, 107, 79], ink = [18, 35, 28], grey = [100, 116, 108], light = [238, 244, 240];
  doc.setFillColor(...green); doc.rect(0, 0, W, 27, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(pdfSafe(m.store), ML, 12);
  doc.setFontSize(11.5); doc.setFont('helvetica', 'normal'); doc.text(pdfSafe(m.title), ML, 20);
  doc.setFontSize(8.5); doc.text('Generado: ' + fmtDT(m.generated), W - MR, 12, { align: 'right' });
  doc.setFontSize(9.5); doc.text(pdfSafe(m.period), W - MR, 20, { align: 'right' });
  let y = 36;
  const ensure = need => { if (y + need > 270) { doc.addPage(); y = 18; } };
  for (const s of m.sections) {
    if (s.divider) {
      ensure(24); doc.setFillColor(...green); doc.roundedRect(ML, y, W - ML - MR, 9, 1.5, 1.5, 'F'); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(pdfSafe(s.divider), ML + 4, y + 6.2); y += 15; continue;
    }
    ensure(24);
    doc.setTextColor(...green); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(pdfSafe(s.title), ML, y);
    doc.setDrawColor(...green); doc.setLineWidth(0.5); doc.line(ML, y + 1.6, W - MR, y + 1.6);
    y += 5;
    if (s.kv) {
      doc.autoTable({ startY: y, body: s.kv.map(r => [pdfSafe(r[0]), pdfSafe(r[1])]), theme: 'plain', margin: { left: ML, right: MR, top: 18, bottom: 20 }, styles: { fontSize: 9.5, cellPadding: { top: 1.4, bottom: 1.4, left: 2, right: 2 }, textColor: ink }, columnStyles: { 0: { cellWidth: 110 }, 1: { halign: 'right', fontStyle: 'bold' } }, didParseCell: d => { if (d.section === 'body' && s.kv[d.row.index][2]) d.cell.styles.fontSize = 11; } });
      y = doc.lastAutoTable.finalY + 2;
    }
    if (s.table) {
      const cs = {}; s.table.align.forEach((a, i) => { if (a === 'r') cs[i] = { halign: 'right' }; });
      doc.autoTable({
        startY: y, head: [s.table.head.map(pdfSafe)], body: s.table.rows.map(r => r.map(pdfSafe)), foot: s.table.foot ? [s.table.foot.map(pdfSafe)] : undefined, showFoot: 'lastPage',
        theme: 'striped', margin: { left: ML, right: MR, top: 18, bottom: 20 }, styles: { fontSize: 8.5, cellPadding: 1.8, textColor: ink, overflow: 'linebreak' },
        headStyles: { fillColor: green, textColor: 255, fontStyle: 'bold' }, footStyles: { fillColor: light, textColor: ink, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [247, 250, 248] }, columnStyles: cs,
        didParseCell: d => { if (d.section === 'head' && s.table.align[d.column.index] === 'r') d.cell.styles.halign = 'right'; if (d.section === 'foot' && s.table.align[d.column.index] === 'r') d.cell.styles.halign = 'right'; },
      });
      y = doc.lastAutoTable.finalY + 2;
    }
    if (s.note) { ensure(14); doc.setTextColor(...grey); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); const lines = doc.splitTextToSize(pdfSafe(s.note), W - ML - MR); doc.text(lines, ML, y + 4); y += lines.length * 4.6 + 3; }
    y += 7;
  }
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    if (i > 1) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...grey); doc.text(pdfSafe(`${m.store} · ${m.title} · ${m.period}`), ML, 10); }
    doc.setDrawColor(200, 210, 204); doc.setLineWidth(0.3); doc.line(ML, 282, W - MR, 282);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...grey);
    doc.text(CREDIT + ' · ', ML, 287);
    const w1 = doc.getTextWidth(CREDIT + ' · ');
    doc.setTextColor(36, 104, 201); doc.textWithLink('tiktok.com/@mr_jhordy21', ML + w1, 287, { url: CREDIT_URL });
    doc.setTextColor(...grey); doc.text(`Página ${i} de ${n}`, W - MR, 287, { align: 'right' });
  }
  return doc;
}
const reportBlob = m => reportPDF(m).output('blob');

/* ---------- Pantalla de Reportes ---------- */
const REP_WHO = [['tienda', 'Tienda', 'Ventas, ganancias por dueño, cajas y fiados', 'box'], ['mv', 'Mi Vecino', 'Depósitos, retiros y saldos de bancos', 'bank'], ['owner', 'Dueño de productos', 'Lo que vendió cada dueño', 'users'], ['todo', 'Tienda + Mi Vecino', 'Todo junto en un solo documento', 'file'], ['cierre', 'Cierre de caja', 'Un día: conteo y modificaciones', 'wallet']];
function repPhoneFor(who, ownerId) {
  const c = cfg();
  if (who === 'mv') return c.phones.mv || '';
  if (who === 'owner') return (get('owners', ownerId) || {}).phone || '';
  return c.phones.tienda || '';
}
function repDefaultSession() { const c = curSession(); if (c) return c.id; const l = lastClosedSession(); return l ? l.id : null; }
VIEWS.reportes = {
  title: 'Reportes',
  render() {
    const r = S.rep;
    if (!r.ownerId) r.ownerId = (owners().find(o => !o.isStore) || owners()[0] || {}).id;
    if (!r.sessionId || !get('sessions', r.sessionId)) r.sessionId = repDefaultSession();
    if (r.phone === undefined || r.phone === null) r.phone = repPhoneFor(r.who, r.ownerId);
    const chips = [['today', 'Hoy'], ['yesterday', 'Ayer'], ['week', 'Esta semana'], ['month', 'Este mes'], ['lastmonth', 'Mes pasado'], ['year', 'Este año']];
    return `<div class="grid rep-grid">
      <div class="col">
        <div class="card"><h3>1 · ¿De quién es el reporte?</h3><div class="col" style="gap:6px">${REP_WHO.map(([k, n, d, ico]) => `<button class="bigfield" data-act="rep-who" data-w="${k}" style="flex-direction:row;align-items:center;text-align:left;cursor:pointer;padding:10px 12px;${r.who === k ? 'border-color:var(--brand);background:var(--brand-soft)' : ''}">${ic(ico)}<span><b>${n}</b><div class="xs muted">${d}</div></span></button>`).join('')}</div>
          ${r.who === 'owner' ? `<label class="f" style="margin-top:8px">Dueño<select class="in" id="rep-owner" data-ch="rep-owner">${owners().map(o => `<option value="${o.id}" ${o.id === r.ownerId ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label>` : ''}</div>
        <div class="card"><h3>2 · ${r.who === 'cierre' ? 'Caja' : 'Período'}</h3>
          ${r.who === 'cierre' ? `<select class="in" id="rep-session" data-ch="rep-session">${sessionsSorted().reverse().map(s => `<option value="${s.id}" ${s.id === r.sessionId ? 'selected' : ''}>${fmtDate(s.date)} · ${fmtTime(s.openedAt)}${s.status === 'open' ? ' (abierta)' : ''}</option>`).join('')}</select>`
        : `<div class="bills" style="margin-bottom:8px">${chips.map(([k, n]) => `<button data-act="rep-range" data-r="${k}">${n}</button>`).join('')}</div>
          <div class="grid g2"><label class="f">Desde<input class="in" type="date" id="rep-from" data-ch="rep-from" value="${r.from}"></label><label class="f">Hasta<input class="in" type="date" id="rep-to" data-ch="rep-to" value="${r.to}"></label></div>
          ${r.who === 'mv' || r.who === 'todo' ? `<label class="chk" style="margin-top:6px"><input type="checkbox" data-ch="rep-detail" ${r.detail ? 'checked' : ''}> Incluir cada movimiento uno por uno</label>` : ''}`}</div>
        <div class="card"><h3>3 · Enviar</h3>
          <label class="f">Número de WhatsApp<input class="in lg" id="rep-phone" data-in="rep-phone" inputmode="tel" placeholder="09XXXXXXXX" value="${esc(r.phone || '')}"></label>
          <label class="chk"><input type="checkbox" id="rep-savephone"> Guardar este número para ${r.who === 'owner' ? esc(ownerName(r.ownerId)) : r.who === 'mv' ? 'Mi Vecino' : 'la tienda'}</label>
          <div class="col" style="margin-top:6px"><button class="btn lg primary" data-act="rep-send">${ic('send')} Enviar por WhatsApp</button><button class="btn lg" data-act="rep-pdf">${ic('down')} Descargar PDF</button></div>
          <p class="muted xs" style="margin:8px 0 0">Se envía <b>un solo documento PDF</b>. WhatsApp no permite adjuntar archivos automáticamente: el PDF se guarda y se abre el chat con el mensaje listo; solo tienes que adjuntarlo.</p></div>
      </div>
      <div class="card" id="rep-preview" style="min-height:300px"></div>
    </div>`;
  },
  after() { refreshReport(); },
};
function refreshReport() {
  const el = $('#rep-preview'); if (!el) return;
  const r = S.rep;
  try {
    r.model = buildReport({ who: r.who, ownerId: r.ownerId, from: r.from, to: r.to, detail: r.detail, sessionId: r.sessionId });
    el.innerHTML = reportHTML(r.model);
  } catch (e) { console.error(e); el.innerHTML = `<div class="alert bad">No se pudo preparar el reporte: ${esc(e.message)}</div>`; }
}
ACT['rep-who'] = t => { S.rep.who = t.dataset.w; S.rep.phone = repPhoneFor(S.rep.who, S.rep.ownerId); renderView(); };
CHG['rep-owner'] = t => { S.rep.ownerId = t.value; S.rep.phone = repPhoneFor('owner', t.value); renderView(); };
CHG['rep-session'] = t => { S.rep.sessionId = t.value; refreshReport(); };
CHG['rep-from'] = t => { if (t.value) { S.rep.from = t.value; if (S.rep.to < t.value) S.rep.to = t.value; renderView(); } };
CHG['rep-to'] = t => { if (t.value) { S.rep.to = t.value; if (S.rep.from > t.value) S.rep.from = t.value; renderView(); } };
CHG['rep-detail'] = t => { S.rep.detail = t.checked; refreshReport(); };
INP['rep-phone'] = t => { S.rep.phone = t.value; };
ACT['rep-range'] = t => {
  const k = t.dataset.r, td = today(), d = parseD(td);
  let a = td, b = td;
  if (k === 'yesterday') a = b = addDays(td, -1);
  else if (k === 'week') [a, b] = periodRange('week', td);
  else if (k === 'month') [a, b] = periodRange('month', td);
  else if (k === 'lastmonth') [a, b] = periodRange('month', dstr(new Date(d.getFullYear(), d.getMonth() - 1, 1)));
  else if (k === 'year') [a, b] = periodRange('year', td);
  S.rep.from = a; S.rep.to = b; renderView();
};
async function makePdf() {
  if (!S.rep.model) refreshReport();
  const m = S.rep.model;
  if (!window.jspdf) throw new Error('No se cargó la librería de PDF');
  return { m, blob: reportBlob(m) };
}
ACT['rep-pdf'] = async () => {
  const { m, blob } = await makePdf();
  const r = await saveFile(m.filename, blob);
  if (r === 'saved') toast('PDF listo', { type: 'ok' });
};
ACT['rep-send'] = async () => {
  const r = S.rep;
  const ph = normPhone(r.phone);
  if (ph.length < 11) { toast('Escribe el número de WhatsApp (ej.: 0991234567)', { type: 'warn' }); $('#rep-phone')?.focus(); return; }
  if ($('#rep-savephone')?.checked) {
    const c = cfg();
    if (r.who === 'owner') { const o = get('owners', r.ownerId); if (o) { o.phone = r.phone; put('owners', o); } }
    else if (r.who === 'mv') c.phones.mv = r.phone; else c.phones.tienda = r.phone;
    saveCfg();
  }
  const { m, blob } = await makePdf();
  const msg = `*${m.store}* · ${m.title}\n${m.period}\n\n${m.wa.join('\n')}\n\n(Te envío el reporte completo en PDF)\n— ${CREDIT}`;
  const file = (typeof File === 'function') ? new File([blob], m.filename, { type: 'application/pdf' }) : null;
  try {
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: msg, title: m.title }); toast('Elige WhatsApp para enviarlo', { type: 'ok' }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const saved = await saveFile(m.filename, blob);
  const url = `https://wa.me/${ph}?text=${encodeURIComponent(msg)}`;
  modal({
    title: 'Reporte listo para enviar',
    html: `<ol class="steps" style="padding:0;margin:0 0 6px"><li><span><b>PDF ${saved === 'saved' ? 'guardado' : 'sin guardar'}:</b> <span class="muted">${esc(m.filename)}</span>${saved === 'saved' ? '' : ' <button class="btn sm" data-act="rep-pdf">Guardar PDF</button>'}</span></li>
      <li><span><b>Abre el chat de WhatsApp</b> con el número <b>+${esc(ph)}</b>. El mensaje con el resumen ya está escrito.</span></li>
      <li><span><b>Adjunta el PDF</b> (botón del clip) y envía.</span></li></ol>
      <a class="btn lg primary" href="${url}" target="_blank" rel="noopener" style="width:100%;margin-top:8px">${ic('chat')} Abrir WhatsApp</a>
      <div class="row" style="margin-top:8px"><button class="btn sm" data-act="rep-copy">Copiar mensaje</button><button class="btn sm" data-act="rep-pdf">${ic('down', 'sm')} Guardar PDF otra vez</button></div>`,
    actions: [{ label: 'Listo', cls: 'primary' }],
  });
  S.rep._msg = msg;
};
ACT['rep-copy'] = async () => {
  try { await navigator.clipboard.writeText(S.rep._msg || ''); toast('Mensaje copiado', { type: 'ok' }); } catch (e) { toast('No se pudo copiar. Selecciona el texto manualmente.', { type: 'warn' }); }
};
