/* HISTORIAL CRONOLÓGICO Y TRAZABILIDAD */
(function () {
  const U = EQ.U, S = EQ.S, C = EQ.C;
  EQ.Views = EQ.Views || {};
  const V = {};

  V.eventosEquipo = (eq, desde, hasta) => {
    const ev = [];
    const inR = f => (!desde || f >= desde) && (!hasta || f <= hasta + 'T99');
    const ints = {};
    const dIds = new Set(S.engrasesDiarios.map(d => d.id));
    S.engrasesDiarios.filter(d => d.equipoId === eq.id && inR(d.fecha)).forEach(d => {
      const rs = S.engrases.filter(r => r.intervencionId === d.id);
      ev.push({ fecha: d.fecha, orden: d.creado, cls: 'eng', titulo: `${C.tipoEng(d.tipo).nombre} (${d.tipo})`, det: [d.horometro !== null && d.horometro !== undefined ? `${C.lecturaLbl(eq)} ${U.num(d.horometro, 1)}` : '', `${d.puntos || 0} punto(s)`, `${U.num((d.gramos || 0) / 1000, 3)} kg`, d.tecnico, d.observaciones].filter(Boolean).join(' · '), extra: rs.map(r => `${r.codigoPunto} ${r.componente} (${r.gramos} g)`).join('; '), foto: d.foto });
    });
    S.engrases.filter(r => r.equipoId === eq.id && inR(r.fecha) && !dIds.has(r.intervencionId)).forEach(r => { (ints[r.intervencionId] = ints[r.intervencionId] || []).push(r); });
    Object.values(ints).forEach(rs => {
      const r0 = rs[0]; const g = rs.reduce((s, r) => s + (Number(r.gramos) || 0), 0);
      const cnt = {}; rs.forEach(r => cnt[r.resultado] = (cnt[r.resultado] || 0) + 1);
      ev.push({ fecha: r0.fecha, orden: r0.creado, cls: 'eng', titulo: r0.resultado === 'Línea base' ? 'Línea base de engrase' : 'Intervención de engrase', det: `${rs.length} punto(s) · ${Object.entries(cnt).map(([k, v]) => `${k}: ${v}`).join(', ')} · ${U.num(g / 1000, 3)} kg · ${C.lecturaLbl(eq)} ${U.num(r0.horometro, 1)} · ${r0.tecnico || ''}`, extra: rs.map(r => `${r.codigoPunto} ${r.componente} (${r.resultado}${r.gramos ? ', ' + r.gramos + ' g' : ''})`).join('; '), foto: (rs.find(r => r.foto) || {}).foto });
    });
    const ses = {};
    S.inspecciones.filter(i => i.equipoId === eq.id && inR(i.fecha)).forEach(i => (ses[i.sesionId] = ses[i.sesionId] || []).push(i));
    Object.values(ses).forEach(is => {
      const i0 = is[0];
      const crit = is.filter(i => C.patrones(i).length).length;
      ev.push({ fecha: i0.fecha, orden: i0.creado, cls: 'ins', titulo: 'Inspección de neumáticos', det: `${is.length} neumático(s) · ${C.lecturaLbl(eq)} ${U.num(i0.lectura, 1)} · Inspector: ${i0.inspector || ''}${crit ? ` · ${crit} con observaciones` : ''}`, extra: is.map(i => { const n = S.neumaticos.find(x => x.id === i.neumaticoId) || {}; return `${i.posicion} ${n.codigo || ''}: ${i.presionMed !== null && i.presionMed !== undefined ? i.presionMed + ' PSI' : ''} ${C.profProm(i) !== null ? U.num(C.profProm(i), 1) + ' mm' : ''} ${C.patrones(i).join(', ')}`; }).join('; ') });
    });
    S.movimientos.filter(m => m.equipoId === eq.id && inR(m.fecha) && m.tipo !== 'Alta').forEach(m => { const n = S.neumaticos.find(x => x.id === m.neumaticoId) || {}; ev.push({ fecha: m.fecha, orden: m.creado, cls: 'mov', titulo: `${m.tipo} de neumático ${n.codigo || ''}`, det: [m.posAnterior ? `De ${m.posAnterior}` : '', m.posNueva ? `a ${m.posNueva}` : '', m.lectura !== undefined && m.lectura !== null ? `@ ${U.num(m.lectura, 1)}` : '', m.motivo, m.responsable, m.costo ? U.moneyC(m.costo, C.esUSD(m.monedaCosto) ? C.monUSD() : C.monBase()) : ''].filter(Boolean).join(' · ') }); });
    S.horometros.filter(h => h.equipoId === eq.id && inR(h.fecha)).forEach(h => ev.push({ fecha: h.fecha, orden: h.creado, cls: 'aud', titulo: `Lectura de ${C.lecturaLbl(eq).toLowerCase()}: ${U.num(h.valor, 1)} ${C.unidad(eq)}`, det: `Origen: ${h.origen}${h.motivo ? ' · ' + h.motivo : ''}` }));
    S.alertasAtendidas.filter(a => a.equipoId === eq.id && inR(a.fecha)).forEach(a => ev.push({ fecha: a.fecha.slice(0, 10), orden: a.fecha, cls: 'aud', titulo: `Alerta atendida: ${a.titulo}`, det: `${a.responsable}: ${a.accion}` }));
    const ptIds = new Set(S.puntos.filter(p => p.equipoId === eq.id).map(p => p.id));
    S.auditoria.filter(x => (x.entidadId === eq.id || (x.entidad === 'puntos' && ptIds.has(x.entidadId))) && inR(x.fecha)).forEach(x => ev.push({ fecha: x.fecha.slice(0, 10), orden: x.fecha, cls: 'aud', titulo: `${x.accion} · ${x.entidad === 'puntos' ? 'punto de engrase' : 'equipo'}`, det: `${x.detalle}${x.motivo ? ' · Motivo: ' + x.motivo : ''}` }));
    return ev.sort((a, b) => (b.fecha + (b.orden || '')) > (a.fecha + (a.orden || '')) ? 1 : -1);
  };
  V.eventosNeum = (n, desde, hasta) => {
    const ev = [];
    const inR = f => (!desde || f >= desde) && (!hasta || f <= hasta + 'T99');
    S.movimientos.filter(m => m.neumaticoId === n.id && inR(m.fecha)).forEach(m => ev.push({ fecha: m.fecha, orden: m.creado, cls: 'mov', titulo: m.tipo, det: [(C.eq(m.equipoId) || {}).codigo, m.posAnterior ? `De ${m.posAnterior}` : '', m.posNueva ? `a ${m.posNueva}` : '', m.lectura !== undefined && m.lectura !== null ? `@ ${U.num(m.lectura, 1)}` : '', m.usoPeriodo ? `Uso periodo ${U.num(m.usoPeriodo, 0)}` : '', m.motivo, m.responsable, m.costo ? U.moneyC(m.costo, C.esUSD(m.monedaCosto) ? C.monUSD() : C.monBase()) : '', m.observaciones].filter(Boolean).join(' · ') }));
    S.inspecciones.filter(i => i.neumaticoId === n.id && inR(i.fecha)).forEach(i => ev.push({ fecha: i.fecha, orden: i.creado, cls: 'ins', titulo: `Inspección (ciclo ${i.ciclo || 0})`, det: [(C.eq(i.equipoId) || {}).codigo + ' ' + (i.posicion || ''), i.presionMed !== null && i.presionMed !== undefined ? `${i.presionMed}/${i.presionRec} PSI` : '', C.profProm(i) !== null ? `Remanentes ${C.profsOf(i).map(x => U.num(x, 1)).join('/')} mm` : '', C.patrones(i).join(', '), i.inspector, i.observaciones].filter(Boolean).join(' · '), foto: (i.fotos || [])[0] }));
    S.auditoria.filter(x => x.entidadId === n.id && inR(x.fecha)).forEach(x => ev.push({ fecha: x.fecha.slice(0, 10), orden: x.fecha, cls: 'aud', titulo: `${x.accion} de ficha`, det: `${x.detalle}${x.motivo ? ' · Motivo: ' + x.motivo : ''}` }));
    return ev.sort((a, b) => (b.fecha + (b.orden || '')) > (a.fecha + (a.orden || '')) ? 1 : -1);
  };

  V.render = root => {
    const st = EQ.App.state.hist || (EQ.App.state.hist = { modo: 'equipo', id: '', desde: '', hasta: '', ent: '' });
    const eqs = C.equiposActivos();
    if (st.modo === 'equipo' && !C.eq(st.id)) st.id = EQ.App.state.eqId || (eqs[0] || {}).id || '';
    if (st.modo === 'neumatico' && !S.neumaticos.find(n => n.id === st.id)) st.id = (S.neumaticos[0] || {}).id || '';
    root.innerHTML = `<div class="selector-bar">
      <div class="tabs" style="margin:0;border:none">${[['equipo', 'Por equipo'], ['neumatico', 'Por neumático'], ['auditoria', 'Auditoría de modificaciones']].map(([k, t]) => `<button data-m="${k}" class="${st.modo === k ? 'active' : ''}">${t}</button>`).join('')}</div>
      ${st.modo === 'equipo' ? `<select id="hId">${U.opts(eqs.map(e => ({ v: e.id, t: C.eqLabel(e) })), st.id)}</select>` : st.modo === 'neumatico' ? `<select id="hId">${U.opts(S.neumaticos.map(n => ({ v: n.id, t: `${n.codigo} · ${n.serie} · ${n.estado}` })), st.id)}</select>` : `<select id="hEnt">${U.opts(Object.keys(EQ.DB.STORES).concat(['sistema']), st.ent, 'Todas las entidades')}</select>`}
      <input type="date" id="hD" value="${st.desde}" title="Desde"> <input type="date" id="hH" value="${st.hasta}" title="Hasta"><span class="spacer"></span><button class="btn btn-sm btn-outline" id="hX">Exportar Excel</button></div><div id="hBody"></div>`;
    const set = (k, v) => { st[k] = v; EQ.App.refresh(); };
    root.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { st.id = ''; set('modo', b.dataset.m); });
    const hid = root.querySelector('#hId'); if (hid) hid.onchange = e => set('id', e.target.value);
    const he = root.querySelector('#hEnt'); if (he) he.onchange = e => set('ent', e.target.value);
    root.querySelector('#hD').onchange = e => set('desde', e.target.value);
    root.querySelector('#hH').onchange = e => set('hasta', e.target.value);
    const body = root.querySelector('#hBody');
    if (st.modo === 'auditoria') {
      const rows = S.auditoria.filter(a => (!st.ent || a.entidad === st.ent) && (!st.desde || a.fecha >= st.desde) && (!st.hasta || a.fecha <= st.hasta + 'T99')).sort((a, b) => b.fecha > a.fecha ? 1 : -1);
      body.className = 'card';
      const t = U.table(body, { rows, exportName: 'auditoria', cols: [{ k: 'fecha', t: 'Fecha y hora', fmt: v => U.fdatetime(v), text: r => r.fecha }, { k: 'entidad', t: 'Entidad' }, { k: 'accion', t: 'Acción' }, { k: 'ref', t: 'Referencia', sort: r => ref(r), fmt: (v, r) => U.esc(ref(r)), text: r => ref(r) }, { k: 'detalle', t: 'Detalle', fmt: v => `<span class="small">${U.esc(v)}</span>` , text: r => r.detalle }, { k: 'motivo', t: 'Motivo' }] });
      root.querySelector('#hX').onclick = () => body.querySelector('[data-x=xlsx]').click();
      return;
    }
    if (!st.id) { body.innerHTML = `<div class="card">${U.emptyState('🕘', 'Sin datos', 'No hay registros para mostrar.')}</div>`; return; }
    const ev = st.modo === 'equipo' ? V.eventosEquipo(C.eq(st.id), st.desde, st.hasta) : V.eventosNeum(S.neumaticos.find(n => n.id === st.id), st.desde, st.hasta);
    body.innerHTML = `<div class="card"><h3>Historial cronológico (${ev.length} eventos) <span class="right legend-inline"><span>🟠 Engrase</span><span>🔵 Inspección</span><span>🟢 Movimiento</span><span>⚪ Lecturas / auditoría</span></span></h3>
      ${ev.length ? `<div class="timeline">${ev.slice(0, 500).map(e => `<div class="tl-item ${e.cls}"><div class="tl-date">${U.fdate(e.fecha)}</div><div class="tl-title">${U.esc(e.titulo)}</div><div class="tl-det">${U.esc(e.det)}</div>${e.extra ? `<details><summary class="small" style="cursor:pointer;color:var(--info)">Detalle</summary><div class="small">${U.esc(e.extra)}</div></details>` : ''}${e.foto ? `<img class="photo-thumb mt-s" src="${e.foto}">` : ''}</div>`).join('')}</div>` : '<div class="muted">Sin eventos en el periodo.</div>'}</div>`;
    body.querySelectorAll('.photo-thumb').forEach(i => i.onclick = () => U.showPhoto(i.src));
    root.querySelector('#hX').onclick = () => U.downloadXLSX([{ name: 'Historial', aoa: [['Fecha', 'Tipo', 'Evento', 'Detalle', 'Puntos / neumáticos']].concat(ev.map(e => [e.fecha, { eng: 'Engrase', ins: 'Inspección', mov: 'Movimiento', aud: 'Lectura/Auditoría' }[e.cls], e.titulo, e.det, e.extra || ''])) }], `historial_${st.modo}_${U.today()}.xlsx`);
  };
  function ref(r) {
    const st = EQ.S[r.entidad];
    const o = st && st.find(x => x.id === r.entidadId);
    if (!o) return r.entidadId === '*' ? '(varios)' : '';
    if (r.entidad === 'equipos') return o.codigo;
    if (r.entidad === 'puntos') return `${(C.eq(o.equipoId) || {}).codigo || ''} ${o.codigo}`;
    if (r.entidad === 'neumaticos') return o.codigo;
    if (r.entidad === 'engrases') return `${(C.eq(o.equipoId) || {}).codigo || ''} ${o.codigoPunto}`;
    return '';
  }

  EQ.Views.historial = V;
})();
