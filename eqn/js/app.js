/* =========================================================================
   APLICACIÓN – enrutador e inicialización
   ========================================================================= */
(function () {
  const U = EQ.U, S = EQ.S, C = EQ.C;
  const TITLES = { engrase: 'Control de Engrase', neumaticos: 'Control de Neumáticos', equipos: 'Maestro de Equipos', programacion: 'Programación', alertas: 'Centro de Alertas', historial: 'Historial y Trazabilidad', reportes: 'Reportes', configuracion: 'Configuración' };
  const App = { state: { eqId: null, tab: {} }, route: 'engrase' };

  App.render = () => {
    const view = document.getElementById('view');
    const v = EQ.Views[App.route];
    U.destroyCharts();
    document.getElementById('viewTitle').textContent = TITLES[App.route] || '';
    document.querySelectorAll('#menu a').forEach(a => a.classList.toggle('active', a.dataset.route === App.route));
    try { view.innerHTML = ''; v.render(view); }
    catch (e) { console.error(e); view.innerHTML = `<div class="bad-box">Error al mostrar la vista: ${U.esc(e.message)}</div>`; }
    App.updateBadge();
  };
  App.refresh = () => { const y = window.scrollY; App.render(); window.scrollTo(0, y); };
  App.go = (route, params = {}) => {
    Object.assign(App.state, params);
    if (location.hash !== '#/' + route) location.hash = '#/' + route; else App.render();
  };
  App.updateBadge = () => {
    try {
      const n = C.alertas().filter(a => !a.atendida && (a.prioridad === 'critica' || a.prioridad === 'alta')).length;
      document.getElementById('badgeAlertas').textContent = n ? String(n) : '';
    } catch (e) { console.error(e); }
  };
  App.tab = (view, def) => App.state.tab[view] || def;
  App.setTab = (view, t) => { App.state.tab[view] = t; App.refresh(); };
  App.tabsHtml = (view, tabs, cur) => `<div class="tabs">${tabs.map(([k, t]) => `<button data-tab="${k}" class="${k === cur ? 'active' : ''}">${t}</button>`).join('')}</div>`;
  App.wireTabs = (root, view) => root.querySelectorAll('.tabs [data-tab]').forEach(b => b.onclick = () => App.setTab(view, b.dataset.tab));
  // opts.modulo: 'engrase' (solo equipos del plan de engrase) · 'neum' (solo equipos con medición de neumáticos)
  App.eqSelector = (root, opts = {}) => {
    const eqs = opts.modulo === 'engrase' ? C.equiposEngrase() : opts.modulo === 'neum' ? C.equiposNeum() : C.equiposActivos();
    if (!App.state.eqId || !eqs.some(e => e.id === App.state.eqId)) App.state.eqId = eqs.length ? eqs[0].id : null;
    return `<select id="eqSel">${eqs.map(e => `<option value="${e.id}" ${e.id === App.state.eqId ? 'selected' : ''}>${U.esc(C.eqLabel(e))} ${opts.badge ? '' : ''}</option>`).join('')}</select>`;
  };
  App.wireEqSelector = root => { const s = root.querySelector('#eqSel'); if (s) s.onchange = () => { App.state.eqId = s.value; App.refresh(); }; };

  async function init() {
    try {
      try { EQ.Bridge.theme(); } catch (e) { }
      document.getElementById('view').innerHTML = '<div class="info-box">Cargando datos de Engrase y Neumáticos…</div>';
      await EQ.DB.open();
      await EQ.DB.loadAll();
      if (!S.config.find(c => c.id === 'main')) await EQ.DB.put('config', JSON.parse(JSON.stringify(EQ.DEFAULT_CONFIG)), { noAudit: true });
    } catch (e) {
      document.getElementById('view').innerHTML = `<div class="bad-box">No se pudo abrir la base de datos: ${U.esc(e.message)}</div>`;
      try { const h = EQ.DB.host(); if (h && h.eqnSummary) h.eqnSummary(null, e.message); } catch (_) { }
      return;
    }
    const onHash = () => { const r = (location.hash || '#/engrase').replace('#/', '').split('?')[0]; App.route = EQ.Views[r] ? r : 'engrase'; App.render(); document.getElementById('sidebar').classList.remove('open'); };
    window.addEventListener('hashchange', onHash);
    onHash();
    document.getElementById('btnMenu').onclick = () => document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('btnBackupQuick').onclick = () => EQ.Views.configuracion.backup();
    const tick = () => { const d = new Date(); document.getElementById('clock').textContent = `${U.fdate(U.today())} ${U.pad(d.getHours())}:${U.pad(d.getMinutes())}`; };
    tick(); setInterval(tick, 30000);
    // búsqueda global
    const gs = document.getElementById('globalSearch'), sr = document.getElementById('searchResults');
    gs.addEventListener('input', () => {
      const q = gs.value.trim().toLowerCase();
      if (q.length < 2) { sr.classList.add('hidden'); return; }
      const eqs = S.equipos.filter(e => [e.codigo, e.descripcion, e.marca, e.modelo, e.serie, e.placa].some(x => String(x || '').toLowerCase().includes(q))).slice(0, 8);
      const ns = S.neumaticos.filter(n => [n.codigo, n.serie, n.marca].some(x => String(x || '').toLowerCase().includes(q))).slice(0, 8);
      sr.innerHTML = (eqs.map(e => `<div data-eq="${e.id}">🚜 <b>${U.esc(e.codigo)}</b> ${U.esc(e.descripcion || '')}<div class="small muted">${U.esc(e.familia || '')} · ${U.esc(e.marca || '')} ${U.esc(e.modelo || '')}</div></div>`).join('') +
        ns.map(n => `<div data-ne="${n.id}">◎ <b>${U.esc(n.codigo)}</b> serie ${U.esc(n.serie || '—')}<div class="small muted">${U.esc(n.estado)} · ${n.equipoId && C.eq(n.equipoId) ? U.esc(C.eq(n.equipoId).codigo) + ' ' + U.esc(n.posicion || '') : 'En almacén'}</div></div>`).join('')) || '<div class="muted">Sin resultados</div>';
      sr.classList.remove('hidden');
    });
    sr.addEventListener('click', e => {
      const d = e.target.closest('[data-eq],[data-ne]'); if (!d) return;
      sr.classList.add('hidden'); gs.value = '';
      if (d.dataset.eq) App.go('engrase', { eqId: d.dataset.eq });
      else { const n = S.neumaticos.find(x => x.id === d.dataset.ne); EQ.Views.neumaticos.fichaNeum(n); }
    });
    document.addEventListener('click', e => { if (!e.target.closest('.topbar-right')) sr.classList.add('hidden'); });
    window.__EQ_READY = true;
    EQ.Bridge.start();
  }

  EQ.App = App;
  document.addEventListener('DOMContentLoaded', init);
})();
