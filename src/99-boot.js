/* =====================================================================
   Arranque
   ===================================================================== */
S.rep.phone = null; S.rep.sessionId = null;
(async function boot() {
  idb = await openDB();
  dbOK = !!idb;
  await loadAll();
  cfg();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
  restoreCart();
  const fab = $('#mvFab'); if (fab) fab.innerHTML = ic('bank') + ' Mi Vecino';
  if (!dbOK) { const w = $('#dbwarn'); if (w) w.hidden = false; }
  S.view = 'vender';
  if (!checkGates()) renderAll();
  else { renderNav(); renderTop(); }
  window.__bh = { S, M, cfg, get, list, put, createSale, sessionSummary, aggregate, buildReport, reportBlob };
})();
