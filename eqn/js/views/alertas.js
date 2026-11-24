/* CENTRO DE ALERTAS */
(function () {
  const U = EQ.U, S = EQ.S, C = EQ.C;
  EQ.Views = EQ.Views || {};
  const V = {};

  V.render = root => {
    const st = EQ.App.state.alF || (EQ.App.state.alF = { vista: 'activas', prio: '', modulo: '', tipo: '', equipoId: '' });
    const all = C.alertas();
    const act = all.filter(a => !a.atendida);
    const hist = S.alertasAtendidas.slice().sort((a, b) => b.fecha > a.fecha ? 1 : -1);
    const base = st.vista === 'activas' ? act : all.filter(a => a.atendida);
    const rows = base.filter(a => (!st.prio || a.prioridad === st.prio) && (!st.modulo || a.modulo === st.modulo) && (!st.tipo || a.tipo === st.tipo) && (!st.equipoId || a.equipoId === st.equipoId));
    const tipos = [...new Set(all.map(a => a.tipo))].sort();
    const cnt = p => act.filter(a => a.prioridad === p).length;
    root.innerHTML = `
      <div class="kpis mb">
        ${['critica', 'alta', 'media', 'baja'].map(p => `<div class="kpi clickable ${p === 'critica' || p === 'alta' ? 'bad' : p === 'media' ? 'warn' : ''}" data-p="${p}"><div class="lbl">${C.PRIO_LBL[p]}</div><div class="val">${cnt(p)}</div></div>`).join('')}
        <div class="kpi gray"><div class="lbl">Atendidas (vigentes)</div><div class="val">${all.filter(a => a.atendida).length}</div></div>
      </div>
      <div class="selector-bar">
        <div class="tabs" style="margin:0;border:none"><button data-v="activas" class="${st.vista === 'activas' ? 'active' : ''}">Activas (${act.length})</button><button data-v="atendidas" class="${st.vista === 'atendidas' ? 'active' : ''}">Atendidas</button><button data-v="registro" class="${st.vista === 'registro' ? 'active' : ''}">Registro de acciones (${hist.length})</button></div>
        ${st.vista !== 'registro' ? `<select id="aP">${U.opts(['critica', 'alta', 'media', 'baja'].map(p => ({ v: p, t: C.PRIO_LBL[p] })), st.prio, 'Todas las prioridades')}</select>
        <select id="aM">${U.opts(['Engrase', 'Neumáticos'], st.modulo, 'Ambos módulos')}</select>
        <select id="aT">${U.opts(tipos, st.tipo, 'Todos los tipos')}</select>
        <select id="aE">${U.opts(C.equiposActivos().map(e => ({ v: e.id, t: e.codigo })), st.equipoId, 'Todos los equipos')}</select>
        <span class="spacer"></span><button class="btn btn-sm btn-outline" id="aX">Exportar Excel</button>` : ''}
      </div>
      <div id="aList"></div>`;
    const set = (k, v) => { st[k] = v; EQ.App.refresh(); };
    root.querySelectorAll('[data-p]').forEach(k => k.onclick = () => { st.vista = 'activas'; set('prio', k.dataset.p); });
    root.querySelectorAll('[data-v]').forEach(b => b.onclick = () => set('vista', b.dataset.v));
    if (st.vista === 'registro') {
      const box = root.querySelector('#aList'); box.className = 'card';
      U.table(box, { exportName: 'acciones_correctivas', rows: hist, cols: [
        { k: 'fecha', t: 'Fecha', fmt: v => U.fdatetime(v), text: r => r.fecha }, { k: 'prioridad', t: 'Prioridad', fmt: v => U.pill(v, C.PRIO_LBL[v] || v), text: r => r.prioridad },
        { k: 'tipo', t: 'Tipo' }, { k: 'titulo', t: 'Alerta' }, { k: 'accion', t: 'Acción correctiva' }, { k: 'responsable', t: 'Responsable' },
        { k: 'acc', t: '', nosort: true, noexport: true, fmt: (v, r) => `<button class="btn btn-ghost btn-sm" data-re="${r.id}" title="Reabrir">↺</button>` }] });
      box.addEventListener('click', async e => { const b = e.target.closest('[data-re]'); if (b && await U.confirm('¿Reabrir la alerta? El registro de la acción se elimina (queda en auditoría).')) { await EQ.DB.del('alertasAtendidas', b.dataset.re); EQ.App.refresh(); } });
      return;
    }
    ['aP:prio', 'aM:modulo', 'aT:tipo', 'aE:equipoId'].forEach(x => { const [id, k] = x.split(':'); root.querySelector('#' + id).onchange = e => set(k, e.target.value); });
    root.querySelector('#aX').onclick = () => U.downloadXLSX([{ name: 'Alertas', aoa: [['Prioridad', 'Módulo', 'Tipo', 'Equipo', 'Alerta', 'Detalle', 'Estado', 'Acción']].concat(rows.map(a => [C.PRIO_LBL[a.prioridad], a.modulo, a.tipo, a.eq ? a.eq.codigo : '', a.titulo, a.detalle, a.atendida ? 'Atendida' : 'Activa', a.atendida ? a.atendida.accion : ''])) }], `alertas_${U.today()}.xlsx`);
    const list = root.querySelector('#aList');
    if (!rows.length) { list.innerHTML = `<div class="card">${U.emptyState('✅', st.vista === 'activas' ? 'Sin alertas activas con estos filtros' : 'Sin alertas atendidas', '')}</div>`; return; }
    list.innerHTML = rows.slice(0, 400).map((a, i) => `<div class="alert-item ${a.prioridad}">
      <div>${U.pill(a.prioridad, C.PRIO_LBL[a.prioridad])}</div>
      <div><div class="ttl">${U.esc(a.titulo)}</div><div class="det">${U.esc(a.modulo)} · ${U.esc(a.tipo)}${a.detalle ? ' · ' + U.esc(a.detalle) : ''}</div>
      ${a.atendida ? `<div class="det" style="color:var(--ok)">✓ ${U.fdatetime(a.atendida.fecha)} · ${U.esc(a.atendida.responsable || '')}: ${U.esc(a.atendida.accion)}</div>` : ''}</div>
      <div class="act"><button class="btn btn-sm btn-outline" data-go="${i}">Ver</button>${!a.atendida && bk() ? `<button class="btn btn-sm btn-orange" data-bk="${i}" title="Crear un backlog con esta alerta">＋ Backlog</button>` : ''}${a.atendida ? `<button class="btn btn-sm btn-outline" data-re="${U.esc(a.key)}">Reabrir</button>` : `<button class="btn btn-sm btn-ok" data-at="${i}">Atender</button>`}</div></div>`).join('') + (rows.length > 400 ? `<div class="muted">Mostrando 400 de ${rows.length}. Use los filtros.</div>` : '');
    list.addEventListener('click', async e => {
      const g = e.target.closest('[data-go]'), at = e.target.closest('[data-at]'), re = e.target.closest('[data-re]'), nb = e.target.closest('[data-bk]');
      if (nb) aBacklog(rows[+nb.dataset.bk]);
      if (g) { const a = rows[+g.dataset.go]; ir(a); }
      if (at) atender(rows[+at.dataset.at]);
      if (re && await U.confirm('¿Reabrir la alerta?')) { await EQ.DB.del('alertasAtendidas', re.dataset.re); EQ.App.refresh(); }
    });
  };
  // Crear backlog en Mantify a partir de una alerta
  function bk() { try { const h = EQ.DB.host(); return h && typeof h.openBackPre === 'function' ? h : null; } catch (e) { return null; } }
  function aBacklog(a) {
    const h = bk(); if (!h) return;
    const neu = a.modulo === 'Neumáticos', n = a.neumaticoId ? S.neumaticos.find(x => x.id === a.neumaticoId) : null;
    h.openBackPre({
      code: a.eq ? a.eq.codigo : '',
      component: neu ? ('Neumático' + (n ? ' ' + n.codigo + (n.posicion ? ' (pos. ' + n.posicion + ')' : '') : '')) : (a.tipo || 'Engrase'),
      system: neu ? 'Neumáticos y aros' : 'Sistema de lubricación',
      description: `[Alerta ${C.PRIO_LBL[a.prioridad] || a.prioridad}] ${a.titulo}${a.detalle ? ' — ' + a.detalle : ''}`,
      sintoma: a.tipo || '',
      prio: { critica: 'P1', alta: 'P2', media: 'P3', baja: 'P4' }[a.prioridad] || 'P3'
    });
  }
  function ir(a) {
    const App = EQ.App;
    if (a.neumaticoId) { const n = S.neumaticos.find(x => x.id === a.neumaticoId); App.state.selPos = n && n.posicion; App.state.tab.neumaticos = 'diagrama'; App.go('neumaticos', { eqId: a.equipoId }); return; }
    if (a.modulo === 'Neumáticos') { App.state.tab.neumaticos = a.tipo === 'Inspección pendiente' ? 'inspeccion' : 'diagrama'; App.go('neumaticos', { eqId: a.equipoId }); return; }
    App.state.tab.engrase = a.tipo === 'Engrase vencido' || a.tipo === 'Engrase próximo' ? 'registro' : 'ficha'; App.go('engrase', { eqId: a.equipoId });
  }
  function atender(a) {
    const cfg = C.cfg();
    U.modal({ title: 'Registrar acción correctiva', body: `<div class="alert-item ${a.prioridad}" style="margin-bottom:14px"><div>${U.pill(a.prioridad, C.PRIO_LBL[a.prioridad])}</div><div><div class="ttl">${U.esc(a.titulo)}</div><div class="det">${U.esc(a.detalle || '')}</div></div></div>
      <form class="form-grid" id="fA">${U.field('accion', 'Acción correctiva', { type: 'textarea', req: true, cls: 'full' })}${U.field('responsable', 'Responsable', { type: 'datalist', options: cfg.responsables.concat(cfg.tecnicos), req: true })}</form>
      <div class="small muted mt">La alerta se marca como atendida. Si la condición persiste en un nuevo ciclo (nuevo engrase, nueva inspección), se generará una nueva alerta. Para resolver la causa registre el engrase o la inspección correspondiente.</div>`,
      buttons: [{ label: 'Cancelar', cls: 'btn-outline' }, { label: 'Marcar como atendida', cls: 'btn-ok', onClick: async m => {
        const f = m.querySelector('#fA'); const d = U.formData(f); U.requireFields(f, d, ['accion', 'responsable']);
        await EQ.DB.put('alertasAtendidas', { id: a.key, key: a.key, fecha: new Date().toISOString(), accion: d.accion, responsable: d.responsable, prioridad: a.prioridad, tipo: a.tipo, titulo: a.titulo, equipoId: a.equipoId });
        U.toast('Alerta atendida', 'ok'); EQ.App.refresh();
      } }] });
  }

  EQ.Views.alertas = V;
})();
