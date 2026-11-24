/* REPORTES – Excel, PDF y CSV */
(function () {
  const U = EQ.U, S = EQ.S, C = EQ.C;
  EQ.Views = EQ.Views || {};
  const V = {};
  const TIPOS = [['equipo', 'Por equipo'], ['componente', 'Por componente (engrase)'], ['neumatico', 'Por neumático'], ['posicion', 'Por posición de neumático'], ['periodo', 'Consolidado por periodo'], ['alertas', 'Alertas activas']];

  const inR = (f, st) => (!st.desde || f >= st.desde) && (!st.hasta || f <= st.hasta);

  function build(st) {
    const cfg = C.cfg();
    const per = `${st.desde ? U.fdate(st.desde) : 'inicio'} – ${st.hasta ? U.fdate(st.hasta) : 'hoy'}`;
    if (st.tipo === 'equipo') {
      const eq = C.eq(st.ref); if (!eq) return null;
      const un = C.unidad(eq);
      const pts = C.puntosEq(eq.id, true);
      const cons = C.consumo({ desde: st.desde, hasta: st.hasta, equipoId: eq.id });
      const res = C.resumenEngraseEq(eq);
      const tires = C.neumEq(eq.id).map(n => ({ n, a: C.analisisNeum(n) }));
      const ins = S.inspecciones.filter(i => i.equipoId === eq.id && inR(i.fecha, st));
      const movs = S.movimientos.filter(m => m.equipoId === eq.id && inR(m.fecha, st));
      const regs = S.engrases.filter(r => r.equipoId === eq.id && inR(r.fecha, st)).sort((a, b) => a.fecha < b.fecha ? 1 : -1);
      const meses = U.lastMonths(12);
      const cm = C.consumo({ equipoId: eq.id });
      return { titulo: `Reporte de equipo ${eq.codigo}`, subtitulo: `${eq.descripcion || ''} · ${eq.marca || ''} ${eq.modelo || ''} · Periodo ${per}`,
        kpis: [['En programa EG/EP', C.enPrograma(eq) ? C.planTexto(C.plan(eq)) : 'No'], ['Días sin engrase', C.enPrograma(eq) ? (C.diasSinEngrase(eq) ?? '—') : 'NA'], ['Engrases en el periodo', S.engrasesDiarios.filter(d => d.equipoId === eq.id && inR(d.fecha, st)).length], ['Puntos de engrase', pts.length], ...(() => { const e = C.estatusEngrase({ desde: st.desde, hasta: st.hasta, equipoId: eq.id }).tot; return [['Puntos engrasados', U.num(e.puntos)], ['Grasa usada (kg)', U.num(e.kg, 2)], ['Costo por puntos', U.money(e.costoPuntos)], ['Costo por kg', U.money(e.costoKg)], [`Costo por puntos (${C.monUSD()})`, U.usd(e.costoPuntosUSD)], [`Costo por kg (${C.monUSD()})`, U.usd(e.costoKgUSD)]]; })(), ['Neumáticos instalados', tires.length], ['Neumáticos críticos', tires.filter(t => t.a.critico).length], ['Costo neumáticos instalados', U.moneyN(tires.reduce((s, t) => s + t.a.costoTotal, 0))]],
        chart: { titulo: 'Consumo mensual de grasa (kg)', type: 'bar', labels: meses.map(U.monthName), datasets: [{ label: 'kg', data: meses.map(m => +(((cm.porMes[m] || {}).g || 0) / 1000).toFixed(3)) }] },
        secciones: [
          { titulo: 'Ficha del equipo', aoa: [['Campo', 'Valor'], ['Código', eq.codigo], ['Descripción', eq.descripcion], ['Marca', eq.marca], ['Modelo', eq.modelo], ['Serie', eq.serie], ['Familia', eq.familia], ['Ubicación', eq.ubicacion], [C.lecturaLbl(eq), `${U.num(eq.horometro, 1)} ${un}`], ['Uso diario', `${U.num(C.usoDia(eq), 1)} ${un}/día`], ['Sistema de lubricación', eq.sistemaLubricacion]] },
          { titulo: 'Puntos de engrase', aoa: [['Código', 'Componente', 'Grasa', 'g', `Frec ${un}`, 'Frec días', 'Último', `Último ${un}`, `Próximo ${un}`, 'Restan', 'Próx. fecha', 'Estado']].concat(pts.map(p => { const s = C.estadoPunto(p, eq); return [p.codigo, p.componente, p.tipoGrasa, p.gramos, p.frecHoras, p.frecDias, U.fdate(p.ultimaFecha), p.ultimoHorometro, s.proxHor, s.restantes === null ? '' : +s.restantes.toFixed(1), U.fdate(s.proxFecha), s.label]; })) },
          { titulo: 'Control diario de engrase (EG/EP) del periodo', aoa: [['Fecha', 'Tipo', 'Horómetro', 'Técnico', 'Puntos', 'Grasa (kg)', 'Observaciones']].concat(S.engrasesDiarios.filter(d => d.equipoId === eq.id && inR(d.fecha, st)).sort((a, b) => a.fecha < b.fecha ? 1 : -1).map(d => [U.fdate(d.fecha), C.tipoEng(d.tipo).nombre, d.horometro === null ? '' : d.horometro, d.tecnico, d.puntos, +((d.gramos || 0) / 1000).toFixed(3), d.observaciones || ''])) },
          { titulo: 'Detalle por punto del periodo', aoa: [['Fecha', 'Punto', 'Componente', un, 'g', 'Grasa', 'Técnico', 'Resultado', 'Observaciones']].concat(regs.map(r => [U.fdate(r.fecha), r.codigoPunto, r.componente, r.horometro, r.gramos, r.tipoGrasa, r.tecnico, r.resultado, r.observaciones || ''])) },
          { titulo: 'Neumáticos instalados', aoa: [['Posición', 'Código', 'Marca', 'Medida', 'Cocada ini', 'Cocada act', 'Desg %', 'Condición', 'Presión', 'Vida restante', 'Reemplazo est.', 'Costo total']].concat(tires.map(({ n, a }) => [n.posicion, n.codigo, n.marca, n.medida, a.profInicial, a.profActual === null ? '' : +a.profActual.toFixed(1), a.ultima ? +a.desgPct.toFixed(1) : '', (a.patrones.join(', ') || C.DESG_LBL[a.estadoDesg]), a.presion.estado, a.suficiente ? `${Math.round(a.vidaRestHoy)} ${a.unidadVida}` : 'Información insuficiente', U.fdate(a.fechaReemplazo), +a.costoTotal.toFixed(2)])) },
          { titulo: 'Inspecciones del periodo', aoa: [['Fecha', 'Posición', 'Neumático', 'PSI med', 'PSI rec', 'Remanentes (mm)', 'Prom. mm', 'Condición', 'Inspector']].concat(ins.map(i => [U.fdate(i.fecha), i.posicion, (S.neumaticos.find(n => n.id === i.neumaticoId) || {}).codigo, i.presionMed, i.presionRec, C.profsOf(i).join(' / '), C.profProm(i) === null ? '' : +C.profProm(i).toFixed(1), C.patrones(i).join(', '), i.inspector])) },
          { titulo: 'Movimientos de neumáticos del periodo', aoa: [['Fecha', 'Tipo', 'Neumático', 'Pos. anterior', 'Pos. nueva', 'Lectura', 'Motivo', 'Responsable', 'Costo']].concat(movs.map(m => [U.fdate(m.fecha), m.tipo, (S.neumaticos.find(n => n.id === m.neumaticoId) || {}).codigo, m.posAnterior, m.posNueva, m.lectura, m.motivo, m.responsable, m.costo || ''])) }] };
    }
    if (st.tipo === 'componente') {
      const q = (st.ref || '').toLowerCase();
      const match = p => p && (!q || String(p.componente || '').toLowerCase().includes(q) || String(p.tipoComponente || '').toLowerCase() === q);
      const pts = S.puntos.filter(p => p.activo !== false && match(p));
      const ids = new Set(pts.map(p => p.id));
      const regs = S.engrases.filter(r => ids.has(r.puntoId) && inR(r.fecha, st));
      const cons = C.consumo({ desde: st.desde, hasta: st.hasta }); const g = regs.filter(r => r.resultado === 'Ejecutado' || r.resultado === 'Parcial').reduce((s, r) => s + (Number(r.gramos) || 0), 0);
      const pe = {}; regs.forEach(r => { const k = (C.eq(r.equipoId) || {}).codigo || '—'; pe[k] = (pe[k] || 0) + (Number(r.gramos) || 0); });
      return { titulo: `Reporte por componente: ${st.ref || 'todos'}`, subtitulo: `Periodo ${per}`,
        kpis: [['Puntos', pts.length], ['Vencidos', pts.filter(p => C.estadoPunto(p).estado === 'rojo').length], ['Registros', regs.length], ['Grasa aplicada (kg)', U.num(g / 1000, 2)], ['% del consumo total', cons.totalG ? U.num(g / cons.totalG * 100, 1) + '%' : '—']],
        chart: { titulo: 'Grasa por equipo (kg)', type: 'bar', labels: Object.keys(pe), datasets: [{ label: 'kg', data: Object.values(pe).map(v => +(v / 1000).toFixed(3)) }] },
        secciones: [
          { titulo: 'Puntos', aoa: [['Equipo', 'Código', 'Componente', 'Tipo', 'Grasa', 'g', 'Frec h/km', 'Frec días', 'Último', 'Estado']].concat(pts.map(p => [(C.eq(p.equipoId) || {}).codigo, p.codigo, p.componente, p.tipoComponente, p.tipoGrasa, p.gramos, p.frecHoras, p.frecDias, U.fdate(p.ultimaFecha), C.estadoPunto(p).label])) },
          { titulo: 'Registros', aoa: [['Fecha', 'Equipo', 'Punto', 'Componente', 'Lectura', 'g', 'Resultado', 'Técnico']].concat(regs.map(r => [U.fdate(r.fecha), (C.eq(r.equipoId) || {}).codigo, r.codigoPunto, r.componente, r.horometro, r.gramos, r.resultado, r.tecnico])) }] };
    }
    if (st.tipo === 'neumatico') {
      const n = S.neumaticos.find(x => x.id === st.ref); if (!n) return null;
      const a = C.analisisNeum(n);
      const ins = C.inspNeum(n, false).filter(i => inR(i.fecha, st));
      const movs = S.movimientos.filter(m => m.neumaticoId === n.id && inR(m.fecha, st));
      const insP = ins.filter(i => C.profProm(i) !== null);
      return { titulo: `Reporte de neumático ${n.codigo}`, subtitulo: `Serie ${n.serie} · ${n.marca} ${n.modelo || ''} ${n.medida} · Periodo ${per}`,
        kpis: [['Estado', n.estado], ['Ubicación', a.eq ? `${a.eq.codigo} ${n.posicion}` : 'Almacén'], ['Cocada actual (mm)', U.num(a.profActual, 1)], ['Desgaste', `${U.num(a.desgPct, 1)}%`], ['Uso acumulado', `${U.num(a.uso, 0)} ${a.unidad}`], ['Vida restante', a.suficiente ? `${U.num(a.vidaRestHoy, 0)} ${a.unidadVida}` : 'Información insuficiente'], ['Reemplazo estimado', U.fdate(a.fechaReemplazo)], ['Costo total', U.moneyN(a.costoTotal)], ['Costo por uso', a.costoUso ? U.moneyN(a.costoUso) : '—']],
        chart: { titulo: 'Evolución de cocada (mm)', type: 'line', labels: insP.map(i => U.fdate(i.fecha)), datasets: [{ label: 'Cocada promedio', data: insP.map(i => +C.profProm(i).toFixed(2)) }] },
        secciones: [
          { titulo: 'Inspecciones', aoa: [['Fecha', 'Ciclo', 'Equipo', 'Posición', 'Uso', 'PSI med', 'PSI rec', 'Remanentes (mm)', 'Prom', 'Condición', 'Inspector']].concat(ins.map(i => [U.fdate(i.fecha), i.ciclo || 0, (C.eq(i.equipoId) || {}).codigo, i.posicion, i.usoNeumatico, i.presionMed, i.presionRec, C.profsOf(i).join(' / '), C.profProm(i) === null ? '' : +C.profProm(i).toFixed(1), C.patrones(i).join(', '), i.inspector])) },
          { titulo: 'Historial de movimientos', aoa: [['Fecha', 'Tipo', 'Equipo', 'Pos. anterior', 'Pos. nueva', 'Lectura', 'Motivo', 'Responsable', 'Costo', 'Observaciones']].concat(movs.map(m => [U.fdate(m.fecha), m.tipo, (C.eq(m.equipoId) || {}).codigo || '', m.posAnterior, m.posNueva, m.lectura, m.motivo, m.responsable, m.costo || '', m.observaciones || ''])) }] };
    }
    if (st.tipo === 'posicion') {
      const pos = st.ref;
      const ins = S.inspecciones.filter(i => i.posicion === pos && inR(i.fecha, st));
      const act = S.neumaticos.filter(n => n.posicion === pos).map(n => ({ n, a: C.analisisNeum(n) }));
      const with_ = act.filter(x => x.a.ultima);
      return { titulo: `Reporte por posición ${pos}`, subtitulo: `Todos los equipos · Periodo ${per}`,
        kpis: [['Neumáticos en la posición', act.length], ['Desgaste promedio', with_.length ? U.num(with_.reduce((s, x) => s + x.a.desgPct, 0) / with_.length, 1) + '%' : '—'], ['Críticos', act.filter(x => x.a.critico).length], ['Desgaste anormal', act.filter(x => x.a.irregular).length], ['Inspecciones', ins.length]],
        chart: { titulo: 'Desgaste por equipo en la posición (%)', type: 'bar', labels: with_.map(x => x.a.eq.codigo), datasets: [{ label: '%', data: with_.map(x => +x.a.desgPct.toFixed(1)) }] },
        secciones: [
          { titulo: 'Neumáticos actuales', aoa: [['Equipo', 'Neumático', 'Marca', 'Medida', 'Cocada', 'Desg %', 'Condición', 'Presión', 'Reemplazo est.']].concat(act.map(({ n, a }) => [(a.eq || {}).codigo, n.codigo, n.marca, n.medida, a.profActual === null ? '' : +a.profActual.toFixed(1), a.ultima ? +a.desgPct.toFixed(1) : '', a.patrones.join(', ') || C.DESG_LBL[a.estadoDesg], a.presion.estado, U.fdate(a.fechaReemplazo)])) },
          { titulo: 'Inspecciones en la posición', aoa: [['Fecha', 'Equipo', 'Neumático', 'PSI med', 'PSI rec', 'Remanentes (mm)', 'Prom. mm', 'Condición']].concat(ins.map(i => [U.fdate(i.fecha), (C.eq(i.equipoId) || {}).codigo, (S.neumaticos.find(n => n.id === i.neumaticoId) || {}).codigo, i.presionMed, i.presionRec, C.profsOf(i).join(' / '), C.profProm(i) === null ? '' : +C.profProm(i).toFixed(1), C.patrones(i).join(', ')])) }] };
    }
    if (st.tipo === 'periodo') {
      const cons = C.consumo({ desde: st.desde, hasta: st.hasta });
      const regs = S.engrasesDiarios.filter(r => inR(r.fecha, st));
      const ins = S.inspecciones.filter(i => inR(i.fecha, st));
      const movs = S.movimientos.filter(m => inR(m.fecha, st));
      const costoN = movs.reduce((s, m) => s + C.conv(m.costo, m.monedaCosto, C.monNeum()), 0) + S.neumaticos.filter(n => n.fechaAdq && inR(n.fechaAdq, st)).reduce((s, n) => s + C.conv(n.costo, n.monedaCosto, C.monNeum()), 0);
      const k = C.kpis();
      const es = C.estatusEngrase({ desde: st.desde, hasta: st.hasta });
      const pe = Object.entries(es.porEquipo).map(([id, v]) => [(C.eq(id) || {}).codigo || '—', v]).sort((a, b) => b[1].kg - a[1].kg);
      return { titulo: 'Reporte consolidado de engrase y neumáticos', subtitulo: `Periodo ${per}`,
        kpis: [['Engrases ejecutados', regs.length], ['Engrases generales (EG)', regs.filter(r => r.tipo === 'EG').length], ['Engrases parciales (EP)', regs.filter(r => r.tipo === 'EP').length], ['Cumplimiento programa (mes actual)', (() => { const c = C.cumplimientoMesPrograma(U.today().slice(0, 7), true).pct; return c === null ? '—' : U.num(c, 1) + '%'; })()], ['Equipos > límite días sin engrase', k.excedidos], ['Puntos engrasados', U.num(es.tot.puntos)], ['Grasa usada (kg)', U.num(es.tot.kg, 2)], ['Costo por puntos', U.money(es.tot.costoPuntos)], ['Costo por kg', U.money(es.tot.costoKg)], [`Costo por puntos (${C.monUSD()})`, U.usd(es.tot.costoPuntosUSD)], [`Costo por kg (${C.monUSD()})`, U.usd(es.tot.costoKgUSD)], ['Inspecciones', ins.length], ['Movimientos neumáticos', movs.length], ['Costo neumáticos periodo', U.moneyN(costoN)], ['Neumáticos críticos (hoy)', k.neumCriticos], ['Presiones fuera de rango (hoy)', k.presionFuera]],
        chart: { titulo: 'Grasa usada por equipo (kg)', type: 'bar', labels: pe.slice(0, 20).map(x => x[0]), datasets: [{ label: 'kg', data: pe.slice(0, 20).map(x => +x[1].kg.toFixed(3)) }] },
        secciones: [
          { titulo: 'Cumplimiento del programa EG/EP por mes', aoa: [['Mes', 'Programados', 'Ejecutados', 'Cumplimiento %']].concat((() => { const ms = []; let m = (st.desde || U.addDays(U.today(), -30)).slice(0, 7); const h = (st.hasta || U.today()).slice(0, 7); while (m <= h && ms.length < 24) { ms.push(m); m = U.addDays(m + '-28', 5).slice(0, 7); } return ms.map(x => { const c = C.cumplimientoMesPrograma(x, true); return [x, c.prog, c.eje, c.pct === null ? '' : +c.pct.toFixed(1)]; }); })()) },
          { titulo: 'Prioridad – días sin engrase (hoy)', aoa: [['Código', 'Placa', 'Equipo', 'Último engrase', 'Tipo', 'Días sin engrase', 'Días excedidos']].concat(EQ.EngProg.filasPrioridad().filter(r => r.aplica).map(r => [r.eq.codigo, r.eq.placa || '', r.eq.descripcion || '', U.fdate(r.ultFecha), r.ultTipo, r.dias === null ? '' : r.dias, r.exceso === null ? '' : r.exceso])) },
          { titulo: 'Estatus de engrase por equipo (puntos, kg y costos)', aoa: [['Equipo', 'Engrases', 'EG', 'EP', 'Puntos engrasados', 'Grasa (kg)', `Costo por puntos (${C.monBase()})`, `Costo por kg (${C.monBase()})`, `Costo por puntos (${C.monUSD()})`, `Costo por kg (${C.monUSD()})`, 'Último']].concat(pe.map(([c, v]) => [c, v.n, v.eg, v.ep, v.puntos, +v.kg.toFixed(3), +v.costoPuntos.toFixed(2), +v.costoKg.toFixed(2), +v.costoPuntosUSD.toFixed(2), +v.costoKgUSD.toFixed(2), U.fdate(v.ultimo)])) },
          { titulo: 'Por técnico', aoa: [['Técnico', 'Engrases', 'Puntos', 'Kg', 'Costo por puntos', 'Costo por kg']].concat(Object.entries(es.porTecnico).map(([t, v]) => [t, v.n, v.puntos, +v.kg.toFixed(3), +v.costoPuntos.toFixed(2), +v.costoKg.toFixed(2)])) },
          { titulo: 'Por tipo de grasa', aoa: [['Grasa', 'Precio/kg', 'Precio/punto', 'Puntos', 'Kg', 'Costo por puntos', 'Costo por kg']].concat(Object.entries(es.porGrasa).map(([g, v]) => [g, C.precioGrasa(g), C.precioPunto(g), v.puntos, +v.kg.toFixed(3), +v.costoPuntos.toFixed(2), +v.costoKg.toFixed(2)])) },
          { titulo: 'Estado de engrase por equipo (hoy)', aoa: [['Equipo', 'Puntos', 'Vencidos', 'Próximos', 'Al día', 'Sin base']].concat(C.equiposEngrase().map(e => { const r = C.resumenEngraseEq(e); return [e.codigo, r.total, r.rojo, r.amarillo, r.verde, r.gris]; }).filter(r => r[1])) },
          { titulo: 'Movimientos de neumáticos', aoa: [['Fecha', 'Tipo', 'Neumático', 'Equipo', 'Pos. ant.', 'Pos. nueva', 'Motivo', 'Costo']].concat(movs.map(m => [U.fdate(m.fecha), m.tipo, (S.neumaticos.find(n => n.id === m.neumaticoId) || {}).codigo, (C.eq(m.equipoId) || {}).codigo || '', m.posAnterior, m.posNueva, m.motivo, m.costo ? `${C.esUSD(m.monedaCosto) ? C.monUSD() : C.monBase()} ${m.costo}` : ''])) }] };
    }
    if (st.tipo === 'alertas') {
      const al = C.alertas().filter(a => !a.atendida);
      const by = p => al.filter(a => a.prioridad === p).length;
      return { titulo: 'Reporte de alertas activas', subtitulo: 'Estado actual',
        kpis: [['Críticas', by('critica')], ['Altas', by('alta')], ['Medias', by('media')], ['Bajas', by('baja')]],
        chart: { titulo: 'Alertas por prioridad', type: 'bar', labels: ['Crítica', 'Alta', 'Media', 'Baja'], datasets: [{ label: 'Alertas', data: [by('critica'), by('alta'), by('media'), by('baja')] }] },
        secciones: [{ titulo: 'Alertas', aoa: [['Prioridad', 'Módulo', 'Tipo', 'Equipo', 'Alerta', 'Detalle']].concat(al.map(a => [C.PRIO_LBL[a.prioridad], a.modulo, a.tipo, a.eq ? a.eq.codigo : '', a.titulo, a.detalle])) }] };
    }
    return null;
  }

  V.render = root => {
    const st = EQ.App.state.rep || (EQ.App.state.rep = { tipo: 'periodo', ref: '', desde: U.addDays(U.today(), -30), hasta: U.today() });
    const comps = [...new Set(S.puntos.map(p => p.componente).filter(Boolean))].sort();
    const posis = [...new Set(S.inspecciones.map(i => i.posicion).concat(S.neumaticos.map(n => n.posicion)).filter(Boolean))].sort();
    let refSel = '';
    if (st.tipo === 'equipo') { if (!C.eq(st.ref)) st.ref = EQ.App.state.eqId || (C.equiposActivos()[0] || {}).id || ''; refSel = `<select id="rRef">${U.opts(C.equiposActivos().map(e => ({ v: e.id, t: C.eqLabel(e) })), st.ref)}</select>`; }
    if (st.tipo === 'neumatico') { if (!S.neumaticos.find(n => n.id === st.ref)) st.ref = (S.neumaticos[0] || {}).id || ''; refSel = `<select id="rRef">${U.opts(S.neumaticos.map(n => ({ v: n.id, t: `${n.codigo} · ${n.serie}` })), st.ref)}</select>`; }
    if (st.tipo === 'componente') refSel = `<input id="rRef" list="dlComp" placeholder="Componente o tipo (vacío = todos)" value="${U.esc(st.ref)}"><datalist id="dlComp">${comps.concat(C.cfg().tiposComponente).map(c => `<option value="${U.esc(c)}">`).join('')}</datalist>`;
    if (st.tipo === 'posicion') { if (!posis.includes(st.ref)) st.ref = posis[0] || ''; refSel = `<select id="rRef">${U.opts(posis, st.ref)}</select>`; }
    root.innerHTML = `<div class="selector-bar"><b>Reporte:</b><select id="rT">${U.opts(TIPOS.map(([v, t]) => ({ v, t })), st.tipo)}</select>${refSel}
      ${st.tipo !== 'alertas' ? `<span>Desde</span><input type="date" id="rD" value="${st.desde}"><span>Hasta</span><input type="date" id="rH" value="${st.hasta}">` : ''}
      <span class="spacer"></span><button class="btn btn-orange btn-sm" id="rXl">⭳ Excel</button><button class="btn btn-sm" id="rPdf">⭳ PDF</button><button class="btn btn-outline btn-sm" id="rCsv">⭳ CSV</button></div><div id="rBody"></div>`;
    const set = (k, v) => { st[k] = v; EQ.App.refresh(); };
    root.querySelector('#rT').onchange = e => { st.ref = ''; set('tipo', e.target.value); };
    const rr = root.querySelector('#rRef'); if (rr) rr.onchange = e => set('ref', e.target.value);
    const rd = root.querySelector('#rD'); if (rd) { rd.onchange = e => set('desde', e.target.value); root.querySelector('#rH').onchange = e => set('hasta', e.target.value); }
    const b = root.querySelector('#rBody');
    if (st.desde && st.hasta && st.desde > st.hasta) { b.innerHTML = '<div class="bad-box">Fechas incorrectas: "Desde" es posterior a "Hasta".</div>'; return; }
    const rep = build(st);
    if (!rep) { b.innerHTML = `<div class="card">${U.emptyState('📄', 'Sin datos para el reporte', 'Seleccione un elemento válido.')}</div>`; return; }
    rep.generado = new Date();
    b.innerHTML = `<div class="card"><div class="flex"><div><h2 style="margin:0;color:var(--navy)">${U.esc(rep.titulo)}</h2><div class="muted">${U.esc(rep.subtitulo)}</div></div><span class="spacer"></span><div class="small muted">Generado: ${U.fdatetime(rep.generado.toISOString())}</div></div>
      <div class="kpis mt">${rep.kpis.map(([k, v]) => `<div class="kpi"><div class="lbl">${U.esc(k)}</div><div class="val" style="font-size:18px">${U.esc(v)}</div></div>`).join('')}</div>
      ${rep.chart && rep.chart.labels.length ? `<div class="mt"><h3>${U.esc(rep.chart.titulo)}</h3><div class="chart-box"><canvas id="rChart"></canvas></div></div>` : ''}
      ${rep.secciones.map(s => `<div class="section-title">${U.esc(s.titulo)} (${s.aoa.length - 1})</div><div class="tbl-wrap" style="max-height:320px"><table class="tbl"><thead><tr>${s.aoa[0].map(h => `<th class="nosort">${U.esc(h)}</th>`).join('')}</tr></thead><tbody>${s.aoa.slice(1, 301).map(r => `<tr>${r.map(c => `<td>${U.esc(c === null || c === undefined ? '' : c)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${s.aoa[0].length}" class="muted">Sin registros</td></tr>`}</tbody></table></div>`).join('')}</div>`;
    if (rep.chart && rep.chart.labels.length) U.chart('rChart', { type: rep.chart.type, data: { labels: rep.chart.labels, datasets: rep.chart.datasets.map((d, i) => Object.assign({ backgroundColor: U.PALETTE[i], borderColor: U.PALETTE[i] }, d)) }, options: { animation: false } });
    const fname = `${rep.titulo.replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]/g, '').replace(/\s+/g, '_')}_${U.today()}`;
    root.querySelector('#rXl').onclick = () => V.excel(rep, fname + '.xlsx');
    root.querySelector('#rCsv').onclick = () => V.csv(rep, fname + '.csv');
    root.querySelector('#rPdf').onclick = () => V.pdf(rep, fname + '.pdf', document.getElementById('rChart'));
  };

  V.excel = (rep, name) => {
    const gen = U.fdatetime((rep.generado || new Date()).toISOString());
    const sheets = [{ name: 'Resumen', aoa: [[rep.titulo], [rep.subtitulo || ''], ['Fecha de generación', gen], [], ['Indicador', 'Valor']].concat(rep.kpis) }];
    if (rep.chart && rep.chart.labels.length) sheets.push({ name: 'Datos gráfico', aoa: [[rep.chart.titulo], ['Categoría'].concat(rep.chart.datasets.map(d => d.label))].concat(rep.chart.labels.map((l, i) => [l].concat(rep.chart.datasets.map(d => d.data[i])))) });
    rep.secciones.forEach(s => sheets.push({ name: s.titulo, aoa: s.aoa }));
    U.downloadXLSX(sheets, name);
  };
  V.csv = (rep, name) => {
    const gen = U.fdatetime((rep.generado || new Date()).toISOString());
    let aoa = [[rep.titulo], [rep.subtitulo || ''], ['Fecha de generación', gen], [], ['Indicador', 'Valor']].concat(rep.kpis);
    rep.secciones.forEach(s => { aoa = aoa.concat([[], [s.titulo]], s.aoa); });
    U.downloadCSV(aoa, name);
  };
  const pdfTxt = v => String(v === null || v === undefined ? '' : v).replace(/[→⇄]/g, '->').replace(/[^\x00-\xFF–—‘’“”•…€]/g, '');
  V.pdf = (rep, name, canvas) => {
    if (!window.jspdf) { U.toast('Librería PDF no disponible', 'bad'); return; }
    const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const gen = U.fdatetime((rep.generado || new Date()).toISOString());
    doc.setFillColor(15, 39, 66); doc.rect(0, 0, W, 18, 'F');
    doc.setFillColor(240, 123, 29); doc.rect(0, 18, W, 1.2, 'F');
    doc.setTextColor(255); doc.setFontSize(14); doc.text(pdfTxt(rep.titulo), 10, 11.5);
    doc.setFontSize(8); doc.text(pdfTxt('Control de Engrase y Neumáticos · Generado: ' + gen), W - 10, 11.5, { align: 'right' });
    doc.setTextColor(40); doc.setFontSize(9); doc.text(pdfTxt(rep.subtitulo || ''), 10, 26);
    doc.autoTable({ startY: 30, head: [['Indicador', 'Valor', 'Indicador', 'Valor']], body: pairRows(rep.kpis).map(r => r.map(pdfTxt)), theme: 'grid', styles: { fontSize: 8, cellPadding: 1.6 }, headStyles: { fillColor: [30, 69, 115] }, margin: { left: 10, right: 10 } });
    let y = doc.lastAutoTable.finalY + 6;
    if (canvas && rep.chart && rep.chart.labels.length) {
      try {
        const img = canvas.toDataURL('image/png', 1);
        const h = 70, w = Math.min(W - 20, h * canvas.width / canvas.height);
        if (y + h + 8 > doc.internal.pageSize.getHeight()) { doc.addPage(); y = 15; }
        doc.setFontSize(10); doc.text(pdfTxt(rep.chart.titulo), 10, y); doc.addImage(img, 'PNG', 10, y + 2, w, h); y += h + 8;
      } catch (e) { console.warn(e); }
    }
    rep.secciones.forEach(s => {
      if (y > doc.internal.pageSize.getHeight() - 30) { doc.addPage(); y = 15; }
      doc.setFontSize(10); doc.setTextColor(15, 39, 66); doc.text(pdfTxt(`${s.titulo} (${s.aoa.length - 1})`), 10, y); doc.setTextColor(40);
      doc.autoTable({ startY: y + 2, head: [s.aoa[0].map(pdfTxt)], body: s.aoa.length > 1 ? s.aoa.slice(1).map(r => r.map(pdfTxt)) : [[{ content: 'Sin registros', colSpan: s.aoa[0].length }]], theme: 'striped', styles: { fontSize: 7, cellPadding: 1.2, overflow: 'linebreak' }, headStyles: { fillColor: [30, 69, 115], fontSize: 7 }, margin: { left: 10, right: 10 } });
      y = doc.lastAutoTable.finalY + 8;
    });
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.setFontSize(7); doc.setTextColor(120); doc.text(`Página ${i} de ${pages} · ${pdfTxt(gen)}`, W - 10, doc.internal.pageSize.getHeight() - 5, { align: 'right' }); }
    doc.save(name);
  };
  function pairRows(k) { const out = []; for (let i = 0; i < k.length; i += 2) out.push([k[i][0], k[i][1], k[i + 1] ? k[i + 1][0] : '', k[i + 1] ? k[i + 1][1] : '']); return out; }

  EQ.Views.reportes = V;
})();
