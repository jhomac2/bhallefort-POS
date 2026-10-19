/* =====================================================================
   Panel MI VECINO (derecha): depósitos y retiros Pichincha / Guayaquil
   ===================================================================== */
S.mv.bank = 'pichincha';
S.mv.more = false;

function bankBadge(b) { return `<span class="dot" style="background:${BANKS[b].color}"></span>`; }
function renderMV() {
  const aside = $('#mv');
  if (!aside) return;
  const ses = curSession();
  if (!ses) { aside.innerHTML = `<div class="mvp"><h2>${ic('bank')} Mi Vecino</h2><div class="empty">Abre la caja para registrar depósitos y retiros.</div></div>`; return; }
  const sm = sessionSummary(ses.id);
  const c = cfg().mv;
  const lowP = sm.bankBal.pichincha < c.lowBank.pichincha, lowG = sm.bankBal.guayaquil < c.lowBank.guayaquil;
  const ins = sm.ops.filter(o => OPS[o.type].cash > 0), outs = sm.ops.filter(o => OPS[o.type].cash < 0);
  const m = S.mv;
  const hasOp = !!m.op;
  aside.innerHTML = `<div class="mvp">
    <h2>${ic('bank')} Mi Vecino<span class="sp"></span><button class="btn ghost sm icon hide-d" data-act="mv-toggle" aria-label="Cerrar panel">${ic('x', 'sm')}</button></h2>
    <div class="balances">
      <div class="bal"><span class="bn">${ic('cash', 'sm')} Efectivo Mi Vecino</span><span class="bv">${money(sm.mvCash)}</span></div>
      <div class="bal ${lowP ? 'low' : ''}"><span class="bn">${bankBadge('pichincha')} Cuenta Pichincha</span><span class="bv">${money(sm.bankBal.pichincha)}</span></div>
      <div class="bal ${lowG ? 'low' : ''}"><span class="bn">${bankBadge('guayaquil')} Cuenta Guayaquil</span><span class="bv">${money(sm.bankBal.guayaquil)}</span></div>
    </div>
    ${lowP || lowG ? `<div class="alert bad sm">${ic('alert', 'sm')}<span>Saldo bajo en ${[lowP && 'Pichincha', lowG && 'Guayaquil'].filter(Boolean).join(' y ')}. Recarga la cuenta para poder recibir depósitos.</span></div>` : ''}
    ${sm.mvCash > c.highCash ? `<div class="alert warn sm">${ic('alert', 'sm')}<span>Hay mucho efectivo de Mi Vecino (${money(sm.mvCash)}). Considera depositarlo en el banco.</span></div>` : ''}
    <div>
      <div class="sm" style="font-weight:800;margin-bottom:5px;color:var(--ink-2)">1 · Banco</div>
      <div class="bank-pick">${['pichincha', 'guayaquil'].map(b => `<button data-act="mv-bank" data-b="${b}" aria-pressed="${m.bank === b}"><span class="bk" style="background:${BANKS[b].color}"></span>${BANKS[b].name}</button>`).join('')}</div>
    </div>
    ${hasOp ? mvAmountHTML() : `<div>
      <div class="sm" style="font-weight:800;margin-bottom:5px;color:var(--ink-2)">2 · Operación</div>
      <div class="op-pick"><button class="op-dep" data-act="mv-op" data-o="deposito">${ic('down', 'lg')}DEPÓSITO</button><button class="op-ret" data-act="mv-op" data-o="retiro">${ic('up', 'lg')}RETIRO</button></div>
      <div class="mv-more" style="margin-top:8px"><span class="xs muted" style="align-self:center">Otras:</span>${['servicio', 'cargar', 'sacar'].map(o => `<button data-act="mv-op" data-o="${o}" title="${esc(OPS[o].hint)}">${OPS[o].short}</button>`).join('')}</div>
    </div>`}
    <div>
      <div class="row" style="margin-bottom:4px"><b class="sm">Hoy</b><span class="sp"></span><span class="xs muted">${sm.ops.length} operaciones</span></div>
      <div class="grid g2" style="gap:6px">
        <div class="bal" style="padding:6px 10px"><span class="bn xs">Depósitos (${ins.length})</span><b class="num">${money(sum(ins, o => o.amount))}</b></div>
        <div class="bal" style="padding:6px 10px"><span class="bn xs">Retiros (${outs.length})</span><b class="num">${money(sum(outs, o => o.amount))}</b></div>
      </div>
    </div>
    <div class="mvlog">${sm.ops.slice(-5).reverse().map(o => `<div class="li">${bankBadge(o.bank)}<span class="muted xs">${fmtTime(o.ts)}</span><button data-act="mv-edit" data-id="${o.id}" style="border:0;background:none;text-align:left;flex:1;padding:4px 0;font-weight:600">${OPS[o.type].short}</button><b>${money(o.amount)}</b><button class="btn ghost sm icon" data-act="mv-del" data-id="${o.id}" aria-label="Eliminar" style="min-height:28px;width:28px">${ic('trash', 'sm')}</button></div>`).join('') || '<div class="muted sm center">Aún no hay operaciones hoy.</div>'}
      ${sm.ops.length > 5 ? `<button class="btn sm ghost" data-act="mv-all">Ver las ${sm.ops.length} de hoy</button>` : ''}
    </div>
  </div>`;
}
function mvAmountHTML() {
  const m = S.mv, d = OPS[m.op];
  const dep = d.cash > 0;
  return `<div>
    <div class="sm" style="font-weight:800;margin-bottom:5px;color:var(--ink-2)">3 · Monto</div>
    <div class="amount-line ${dep ? 'dep' : 'ret'}"><div class="sm">${d.label.toUpperCase()} · ${BANKS[m.bank].name}</div><div class="big num" id="mv-big">${money(num(m.amount))}</div></div>
    <input class="in xl num-in" id="mv-amt" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${esc(m.amount)}" data-in="mv-amt" data-key="mv-amt" style="margin-top:8px" aria-label="Monto">
    <div class="bills" style="margin-top:7px">${[5, 10, 20, 50, 100, 200].map(v => `<button data-act="mv-quick" data-v="${v}">$${v}</button>`).join('')}</div>
    <div class="keypad" style="margin-top:8px">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, 'back'].map(k => `<button data-act="mv-key" data-k="${k}" ${k === 'back' ? 'aria-label="Borrar"' : ''}>${k === 'back' ? '⌫' : k}</button>`).join('')}</div>
    <div class="row nowrap" style="margin-top:8px"><button class="btn lg" data-act="mv-cancel" style="flex:1">Cancelar</button><button class="btn lg primary" data-act="mv-save" style="flex:2">${ic('check')} GUARDAR</button></div>
  </div>`;
}
function mvRefreshAmount() {
  const b = $('#mv-big'); if (b) b.textContent = money(num(S.mv.amount));
  const i = $('#mv-amt'); if (i && i.value !== S.mv.amount) i.value = S.mv.amount;
}
ACT['mv-bank'] = t => { S.mv.bank = t.dataset.b; renderMV(); if (S.mv.op) $('#mv-amt')?.focus(); };
ACT['mv-op'] = t => { S.mv.op = t.dataset.o; S.mv.amount = ''; renderMV(); const i = $('#mv-amt'); if (i) i.focus(); };
ACT['mv-cancel'] = () => { S.mv.op = null; S.mv.amount = ''; renderMV(); focusScan(); };
ACT['mv-quick'] = t => { S.mv.amount = String(t.dataset.v); mvRefreshAmount(); $('#mv-amt')?.focus(); };
ACT['mv-key'] = t => {
  const k = t.dataset.k; let a = S.mv.amount;
  if (k === 'back') a = a.slice(0, -1);
  else if (k === '.') { if (!a.includes('.')) a = (a || '0') + '.'; }
  else if (!(a.includes('.') && a.split('.')[1].length >= 2) && a.length < 9) a += k;
  S.mv.amount = a; mvRefreshAmount();
};
INP['mv-amt'] = t => { t.value = t.value.replace(',', '.').replace(/[^\d.]/g, ''); S.mv.amount = t.value; mvRefreshAmount(); };
KEY['mv-amt'] = (t, e) => { if (e.key === 'Enter') { e.preventDefault(); ACT['mv-save'](); } if (e.key === 'Escape') ACT['mv-cancel'](); };
ACT['mv-save'] = () => {
  const amt = r2(num(S.mv.amount));
  if (!(amt > 0)) { toast('Escribe el monto', { type: 'warn' }); $('#mv-amt')?.focus(); return; }
  const ses = curSession(); if (!ses) return;
  const sm = sessionSummary(ses.id);
  const d = OPS[S.mv.op];
  if (d.bank < 0 && sm.bankBal[S.mv.bank] < amt) toast(`Atención: la cuenta ${BANKS[S.mv.bank].name} tiene ${money(sm.bankBal[S.mv.bank])} y la operación es de ${money(amt)}.`, { type: 'warn', ms: 5000 });
  if (d.cash < 0 && sm.mvCash < amt) toast(`Atención: el efectivo de Mi Vecino es ${money(sm.mvCash)} y vas a entregar ${money(amt)}.`, { type: 'warn', ms: 5000 });
  const op = addBankOp(S.mv.bank, S.mv.op, amt);
  const label = `${d.label} ${money(amt)} · ${BANKS[S.mv.bank].name}`;
  S.mv.op = null; S.mv.amount = '';
  renderMV(); renderTop();
  beep('ok');
  toast(`Guardado: ${label}`, { type: 'ok', ms: 4500, action: { label: 'Deshacer', fn: () => { removeBankOp(op); renderMV(); renderTop(); toast('Movimiento deshecho'); } } });
  focusScan();
};
ACT['mv-del'] = async t => {
  const op = get('bankOps', t.dataset.id); if (!op) return;
  if (await ask({ title: 'Eliminar movimiento', msg: `¿Eliminar ${OPS[op.type].label} de ${money(op.amount)} en ${BANKS[op.bank].name}? Quedará anotado en el historial de cambios.`, ok: 'Eliminar', danger: true })) { removeBankOp(op); renderMV(); renderTop(); if (S.view === 'caja') renderView(); }
};
ACT['mv-edit'] = t => { const op = get('bankOps', t.dataset.id); if (op) openBankOpEditor(op); };
function openBankOpEditor(op) {
  modal({
    title: `Corregir movimiento · ${BANKS[op.bank].name}`, size: 'narrow',
    html: `<div class="col"><label class="f">Operación<select class="in" id="bo-type">${Object.keys(OPS).map(k => `<option value="${k}" ${k === op.type ? 'selected' : ''}>${OPS[k].label}</option>`).join('')}</select></label>
    <label class="f">Monto<input class="in xl num-in" id="bo-amt" inputmode="decimal" value="${op.amount.toFixed(2)}" autofocus></label>
    <p class="muted sm" style="margin:0">Hora: ${fmtTime(op.ts)}. El cambio queda anotado en el historial.</p></div>`,
    actions: [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: h => { const a = num(h.$('#bo-amt').value); if (!(a > 0)) { toast('Escribe un monto válido', { type: 'warn' }); return false; } editBankOp(op, a, h.$('#bo-type').value); renderMV(); renderTop(); if (S.view === 'caja') renderView(); } }],
  });
}
ACT['mv-all'] = () => {
  const ses = curSession(); if (!ses) return;
  const sm = sessionSummary(ses.id);
  modal({ title: 'Movimientos de Mi Vecino de hoy', size: 'wide', html: bankOpsTable(sm.ops, true), actions: [{ label: 'Cerrar', cls: 'primary' }] });
};
function bankOpsTable(ops, actions = false) {
  if (!ops.length) return '<div class="empty">Sin movimientos.</div>';
  return `<div class="tblwrap"><table class="tbl"><thead><tr><th>Hora</th><th>Banco</th><th>Operación</th><th class="r">Monto</th><th class="r">Comisión</th>${actions ? '<th></th>' : ''}</tr></thead><tbody>${ops.map(o => `<tr><td>${fmtTime(o.ts)}</td><td>${bankBadge(o.bank)} ${BANKS[o.bank].name}</td><td>${OPS[o.type].label}</td><td class="r num"><b>${money(o.amount)}</b></td><td class="r">${o.commission ? money(o.commission) : '—'}</td>${actions ? `<td class="r"><button class="btn ghost sm" data-act="mv-edit" data-id="${o.id}">${ic('edit', 'sm')}</button><button class="btn ghost sm" data-act="mv-del" data-id="${o.id}">${ic('trash', 'sm')}</button></td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}
