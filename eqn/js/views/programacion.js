/* PROGRAMACIÓN – diaria, semanal y mensual */
(function () {
  const U = EQ.U, S = EQ.S, C = EQ.C;
  EQ.Views = EQ.Views || {};
  const V = {};
  const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  function rango(st) {
    const d = U.parseDate(st.fecha);
    if (st.modo === 'dia') return [st.fecha, st.fecha];
    if (st.modo === 'semana') { const dw = (d.getDay() + 6) % 7; const ini = U.addDays(st.fecha, -dw); return [ini, U.addDays(ini, 6)]; }
    const ini = `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}-01`; const fin = U.toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0)); return [ini, fin];
  }

  V.render = root => {
    const st = EQ.App.state.prog || (EQ.App.state.prog = { modo: 'semana', fecha: U.today(), tipo: '', equipoId: '' });
    const [ini, fin] = rango(st);
    const desde = ini < U.today() ? U.today() : ini;
    const pr = C.programacion(U.today(), fin);
    let ev = pr.eventos.filter(e => e.fecha >= ini && e.fecha <= fin && (!st.tipo || e.tipo === st.tipo) && (!st.equipoId || e.eq.id === st.equipoId));
    const byDay = {}; ev.forEach(e => (byDay[e.fecha] = byDay[e.fecha] || []).push(e));
    const gramos = ev.filter(e => e.tipo === 'engrase').reduce((s, e) => s + e.gramos, 0);
    root.innerHTML = `
      <div class="selector-bar">
        <div class="tabs" style="margin:0;border:none">${[['dia', 'Diaria'], ['semana', 'Semanal'], ['mes', 'Mensual']].map(([k, t]) => `<button data-m="${k}" class="${st.modo === k ? 'active' : ''}">${t}</button>`).join('')}</div>
        <button class="btn btn-outline btn-sm" id="pPrev">◀</button><input type="date" id="pF" value="${st.fecha}"><button class="btn btn-outline btn-sm" id="pNext">▶</button><button class="btn btn-outline btn-sm" id="pHoy">Hoy</button>
        <select id="pT">${U.opts([{ v: 'engrase', t: 'Solo engrases' }, { v: 'inspeccion', t: 'Solo inspecciones de neumáticos' }], st.tipo, 'Engrases e inspecciones')}</select>
        <select id="pE">${U.opts(C.equiposActivos().map(e => ({ v: e.id, t: C.eqLabel(e) })), st.equipoId, 'Todos los equipos')}</select>
        <span class="spacer"></span><button class="btn btn-sm btn-outline" id="pX">Excel</button><button class="btn btn-sm btn-outline" id="pC">CSV</button><button class="btn btn-sm btn-outline" id="pP">PDF</button>
      </div>
      <div class="kpis mb">
        <div class="kpi"><div class="lbl">Periodo</div><div class="val" style="font-size:16px">${U.fdate(ini)} – ${U.fdate(fin)}</div></div>
        <div class="kpi orange"><div class="lbl">Engrases programados</div><div class="val">${ev.filter(e => e.tipo === 'engrase').length}</div><div class="sub">${U.num(gramos / 1000, 2)} kg estimados (según puntos)</div></div>
        <div class="kpi"><div class="lbl">Horas-hombre de engrase</div><div class="val">${U.num(ev.filter(e => e.tipo === 'engrase').reduce((s, e) => s + (e.horas || 0), 0), 1)}</div><div class="sub">EG ${ev.filter(e => e.tipoEng === 'EG').length} · EP ${ev.filter(e => e.tipoEng === 'EP').length}</div></div>
        <div class="kpi"><div class="lbl">Inspecciones de neumáticos</div><div class="val">${ev.filter(e => e.tipo === 'inspeccion').length}</div></div>
        <div class="kpi ok"><div class="lbl">Ya ejecutados</div><div class="val">${ev.filter(e => e.ejecutado).length}</div></div>
      </div>
      ${st.modo !== 'dia' ? `<div class="card mb"><div class="cal">${DOW.map(d => `<div class="dh">${d}</div>`).join('')}${calCells(st, ini, fin, byDay)}</div></div>` : ''}
      <div class="card"><h3>Detalle de actividades</h3><div id="pList"></div></div>
      <div class="small muted mt">Los engrases salen del programa mensual EG/EP de cada equipo: guardado/importado, o generado con su plan. Las inspecciones de neumáticos según el intervalo configurado. Solo se muestran fechas desde hoy.</div>`;
    const set = (k, v) => { st[k] = v; EQ.App.refresh(); };
    root.querySelectorAll('[data-m]').forEach(b => b.onclick = () => set('modo', b.dataset.m));
    root.querySelector('#pF').onchange = e => e.target.value && set('fecha', e.target.value);
    const step = st.modo === 'dia' ? 1 : st.modo === 'semana' ? 7 : 31;
    root.querySelector('#pPrev').onclick = () => set('fecha', st.modo === 'mes' ? shiftMonth(st.fecha, -1) : U.addDays(st.fecha, -step));
    root.querySelector('#pNext').onclick = () => set('fecha', st.modo === 'mes' ? shiftMonth(st.fecha, 1) : U.addDays(st.fecha, step));
    root.querySelector('#pHoy').onclick = () => set('fecha', U.today());
    root.querySelector('#pT').onchange = e => set('tipo', e.target.value);
    root.querySelector('#pE').onchange = e => set('equipoId', e.target.value);
    root.querySelectorAll('.cal .day[data-d]').forEach(d => d.onclick = () => { st.modo = 'dia'; st.fecha = d.dataset.d; EQ.App.refresh(); });
    // Agrupado por día y equipo
    const grp = [];
    Object.keys(byDay).sort().forEach(d => {
      const m = {};
      byDay[d].forEach(e => { const k = e.eq.id + '|' + e.tipo; (m[k] = m[k] || { fecha: d, eq: e.eq, tipo: e.tipo, items: [], venc: 0, g: 0, cant: e.cantidad || 0, ejec: 0, horas: 0 }); m[k].items.push(e); if (e.vencido) m[k].venc++; if (e.ejecutado) m[k].ejec++; m[k].g += e.gramos || 0; m[k].horas += e.horas || 0; });
      Object.values(m).forEach(x => grp.push(x));
    });
    U.table(root.querySelector('#pList'), { rows: grp, empty: 'Sin actividades programadas en el periodo', cols: [
      { k: 'fecha', t: 'Fecha', fmt: v => `<b>${U.fdate(v)}</b> <span class="muted small">${DOW[(U.parseDate(v).getDay() + 6) % 7]}</span>`, text: r => r.fecha },
      { k: 'eq', t: 'Equipo', sort: r => r.eq.codigo, fmt: v => `<b>${U.esc(v.codigo)}</b> <span class="small muted">${U.esc(v.descripcion || '')}</span>`, text: r => r.eq.codigo },
      { k: 'tipo', t: 'Actividad', fmt: v => v === 'engrase' ? U.pill('info', 'Engrase') : U.pill('gris', 'Inspección neumáticos'), text: r => r.tipo },
      { k: 'det', t: 'Detalle', nosort: true, fmt: (v, r) => r.tipo === 'engrase' ? r.items.map(e => `${U.pill(e.tipoEng === 'EG' ? 'info' : 'amarillo', e.tipoEng)} ${U.esc(C.tipoEng(e.tipoEng).nombre)} <span class="small muted">(${U.num(e.horas, 2)} h)</span>`).join(' ') : `${r.cant} neumático(s)`, text: r => r.tipo === 'engrase' ? r.items.map(e => C.tipoEng(e.tipoEng).nombre).join('; ') : `${r.cant} neumáticos` },
      { k: 'g', t: 'Grasa (kg)', num: true, fmt: (v, r) => r.tipo === 'engrase' ? U.num(v / 1000, 3) : '', text: r => r.tipo === 'engrase' ? +(r.g / 1000).toFixed(3) : '' },
      { k: 'venc', t: 'Estado', fmt: (v, r) => r.ejec ? U.pill('verde', 'Ejecutado') : v ? U.pill('rojo', `${v} vencido(s)`) : U.pill('info', 'Programado'), text: r => r.ejec ? 'Ejecutado' : r.venc ? 'Vencido' : 'Programado' },
      { k: 'acc', t: '', nosort: true, fmt: (v, r) => r.ejec ? '' : `<button class="btn btn-sm btn-outline" data-eq="${r.eq.id}" data-t="${r.tipo}" data-f="${r.fecha}" data-te="${r.tipo === 'engrase' ? r.items[0].tipoEng : ''}">${r.tipo === 'engrase' ? 'Registrar engrase' : 'Inspeccionar'}</button>` }] });
    root.querySelector('#pList').addEventListener('click', e => { const b = e.target.closest('[data-eq]'); if (!b) return; if (b.dataset.t === 'engrase') { if (b.dataset.f > U.today()) { U.toast('Fecha futura: el registro se habilita el día programado.', ''); return; } EQ.EngProg.registrarDialog(C.eq(b.dataset.eq), b.dataset.f, b.dataset.te); } else EQ.App.state.tab.neumaticos = 'inspeccion', EQ.App.go('neumaticos', { eqId: b.dataset.eq }); });
    const aoa = () => [['Fecha', 'Equipo', 'Placa', 'Descripción', 'Actividad', 'Tipo', 'Detalle', 'Horas', 'Grasa (g)', 'Estado']].concat(ev.map(e => [e.fecha, e.eq.codigo, e.eq.placa || '', e.eq.descripcion || '', e.tipo === 'engrase' ? 'Engrase' : 'Inspección neumáticos', e.tipo === 'engrase' ? e.tipoEng : '', e.tipo === 'engrase' ? C.tipoEng(e.tipoEng).nombre : `${e.cantidad} neumáticos`, e.horas || '', e.gramos || '', e.ejecutado ? 'Ejecutado' : e.vencido ? 'Vencido' : 'Programado']));
    root.querySelector('#pX').onclick = () => U.downloadXLSX([{ name: 'Programación', aoa: aoa() }], `programacion_${ini}_${fin}.xlsx`);
    root.querySelector('#pC').onclick = () => U.downloadCSV(aoa(), `programacion_${ini}_${fin}.csv`);
    root.querySelector('#pP').onclick = () => EQ.Views.reportes.pdf({ titulo: `Programación ${U.fdate(ini)} – ${U.fdate(fin)}`, kpis: [['Engrases', ev.filter(e => e.tipo === 'engrase').length], ['Grasa estimada (kg)', U.num(gramos / 1000, 2)], ['Vencidos', ev.filter(e => e.vencido).length], ['Inspecciones', ev.filter(e => e.tipo === 'inspeccion').length]], secciones: [{ titulo: 'Actividades programadas', aoa: aoa() }] }, `programacion_${ini}_${fin}.pdf`);
  };
  function shiftMonth(s, n) { const d = U.parseDate(s); return U.toISODate(new Date(d.getFullYear(), d.getMonth() + n, 1)); }
  function calCells(st, ini, fin, byDay) {
    let start = ini, end = fin;
    const dw = (U.parseDate(ini).getDay() + 6) % 7; start = U.addDays(ini, -dw);
    const dwe = (U.parseDate(fin).getDay() + 6) % 7; end = U.addDays(fin, 6 - dwe);
    let out = '', d = start;
    while (d <= end) {
      const evs = byDay[d] || [];
      const eqs = {}; evs.forEach(e => { const k = e.eq.codigo + e.tipo; (eqs[k] = eqs[k] || { c: e.eq.codigo, t: e.tipo, n: 0, v: false, te: e.tipoEng || '' }); eqs[k].n++; if (e.vencido) eqs[k].v = true; });
      const list = Object.values(eqs);
      out += `<div class="day ${d < ini || d > fin ? 'out' : ''} ${d === U.today() ? 'today' : ''}" data-d="${d}"><div class="dn">${+d.slice(8)}</div>${list.slice(0, 4).map(x => `<div class="ev ${x.v ? 'v' : x.t === 'inspeccion' ? 'n' : ''}" title="${U.esc(x.c)}">${x.t === 'inspeccion' ? '◎' : '⛽'} ${U.esc(x.c)} ${x.te}</div>`).join('')}${list.length > 4 ? `<div class="small muted">+${list.length - 4} más</div>` : ''}</div>`;
      d = U.addDays(d, 1);
    }
    return out;
  }

  EQ.Views.programacion = V;
})();
