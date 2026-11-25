/* =========================================================================
   PUENTE CON MANTIFY
   - Equipos: se toman de la flota de Mantify (colección fleet) por código.
   - Horómetro: lo mayor entre Mantify y este módulo se comparte en ambos.
   - Datos del módulo anterior de Mantify (grease / tires) y los engrases
     que se registran desde el reporte de mantenimiento entran solos.
   - Publica un resumen (estado de engrase y neumáticos por equipo) para el
     inicio, los pendientes y la ficha del equipo de Mantify.
   - Roles: técnico, supervisor y planner (admin) de Mantify.
   ========================================================================= */
(function () {
  const U = EQ.U, S = EQ.S, C = EQ.C;
  const B = {};
  const host = () => EQ.DB.host();
  const M = () => { try { return host() && host().MANTIFY; } catch (e) { return null; } };
  B.me = () => (M() && M().me) || null;
  B.role = () => (B.me() || {}).role || 'tecnico';
  B.isAdmin = () => B.role() === 'admin';
  B.isSup = () => B.role() === 'admin' || B.role() === 'supervisor';
  const modOn = (f, k) => !(Array.isArray(f.off) && f.off.includes(k));
  const KM_CATS = ['Camioneta', 'Minibús', 'Camioneta 4x4'];
  const famDe = cat => {
    const c = String(cat || '');
    if (/perfor/i.test(c)) return C.cfg().familias.includes('Otros') ? 'Otros' : c;
    return EQ.Backlog.familiaSugerida(c);
  };

  // ---------------- Equipos desde la flota de Mantify ----------------
  let syncing = false, syncAgain = false;
  B.syncFleet = async () => {
    if (syncing) { syncAgain = true; return; }
    const m = M(); if (!m) return;
    const fleet = (m.fleet || []).filter(f => f && f.id && f.code);
    if (!fleet.length) return;
    syncing = true;
    try {
      const cfg = C.cfg(), hoy = U.today();
      const elim = (cfg.codigosEliminados || []).map(c => String(c).toUpperCase());
      for (const f of fleet) {
        const code = String(f.code).trim().toUpperCase();
        const offSig = (modOn(f, 'gr') ? 'G' : '-') + (modOn(f, 'tr') ? 'T' : '-');
        const hrs = Number(f.hours);
        let eq = S.equipos.find(e => e.fleetId === f.id) || C.eqByCode(code);
        if (!eq) {
          if (elim.includes(code)) continue;
          const fam = famDe(f.category);
          eq = { id: 'F_' + f.id, codigo: code, descripcion: [f.category, f.brand, f.model].filter(Boolean).join(' '), marca: f.brand || '', modelo: f.model || '', serie: f.serialNumber || '', placa: f.plate || '', familia: fam, familiaBacklog: f.category || '', ubicacion: f.location || '',
            horometro: hrs >= 0 && !isNaN(hrs) ? hrs : null, unidad: KM_CATS.includes(f.category) || ['Camioneta 4x4', 'Minibús'].includes(fam) ? 'km' : 'h', origen: 'Mantify', activo: true, estadoMov: 'MOVILIZADO', sistemaLubricacion: 'Manual',
            layoutNeum: cfg.layoutsNeum[fam] !== undefined ? JSON.parse(JSON.stringify(cfg.layoutsNeum[fam])) : null, fleetId: f.id, sinEngrase: !modOn(f, 'gr'), sinNeumaticos: !modOn(f, 'tr'), offSig, fechaInicio: hoy, fechaSync: new Date().toISOString() };
          await EQ.DB.put('equipos', eq, { noAudit: true });
          if (eq.horometro !== null) await EQ.DB.put('horometros', { id: 'HF_' + f.id + '_' + hoy, equipoId: eq.id, fecha: hoy, valor: eq.horometro, origen: 'Mantify' });
          continue;
        }
        let ch = false;
        const set = (k, v) => { if (v !== undefined && v !== null && v !== '' && String(eq[k] ?? '') !== String(v)) { eq[k] = v; ch = true; } };
        set('fleetId', f.id); set('codigo', code); set('marca', f.brand); set('modelo', f.model); set('serie', f.serialNumber); set('placa', f.plate); set('ubicacion', f.location); set('familiaBacklog', f.category);
        if (eq.activo === false && eq.bajaMantify) { eq.activo = true; eq.bajaMantify = false; ch = true; }
        if (eq.offSig !== offSig) { // el planner cambió los apartados del equipo en Mantify
          if (eq.offSig !== undefined) { eq.sinEngrase = !modOn(f, 'gr'); eq.sinNeumaticos = !modOn(f, 'tr'); }
          eq.offSig = offSig; ch = true;
        }
        if (ch) { eq.fechaSync = new Date().toISOString(); await EQ.DB.put('equipos', eq, { noAudit: true }); }
        if (hrs > 0) {
          const ult = C.ultimaLectura(eq);
          if (ult === null || hrs > ult) {
            await EQ.DB.put('horometros', { id: 'HF_' + f.id + '_' + hoy, equipoId: eq.id, fecha: hoy, valor: hrs, origen: 'Mantify' });
            eq.horometro = hrs; eq.fechaHorometro = hoy; await EQ.DB.put('equipos', eq, { noAudit: true });
          }
        }
      }
      // equipos borrados de la flota de Mantify: quedan inactivos (se conserva el historial)
      const ids = new Set(fleet.map(f => f.id));
      for (const eq of S.equipos.filter(e => e.fleetId && !ids.has(e.fleetId) && e.activo !== false)) {
        eq.activo = false; eq.bajaMantify = true; await EQ.DB.put('equipos', eq, { motivo: 'Equipo eliminado de la flota de Mantify' });
      }
      await B.migrar();
      B.refresh();
    } catch (e) { console.error('Sincronización con Mantify', e); }
    finally { syncing = false; if (syncAgain) { syncAgain = false; setTimeout(B.syncFleet, 300); } }
  };

  // Lo que se registra aquí (horómetro mayor) también actualiza la flota de Mantify
  const putOrig = EQ.DB.put;
  EQ.DB.put = async (store, obj, opts) => {
    const r = await putOrig(store, obj, opts);
    if (store === 'horometros' && r && r.origen !== 'Mantify' && r.origen !== 'corrección') B.subirHorometro(r);
    return r;
  };
  B.subirHorometro = h => {
    try {
      const eq = C.eq(h.equipoId); if (!eq) return;
      const m = M(); if (!m) return;
      const f = (m.fleet || []).find(x => x.id === eq.fleetId) || (m.fleet || []).find(x => String(x.code).toUpperCase() === String(eq.codigo).toUpperCase());
      if (!f || !(Number(h.valor) > (Number(f.hours) || 0))) return;
      host().firebase.firestore().collection('fleet').doc(f.id).update(host().JSON.parse(JSON.stringify({ hours: Number(h.valor), updatedAt: Date.now(), updatedBy: (B.me() || {}).name || '' }))).catch(e => console.warn('Horómetro en Mantify', e));
    } catch (e) { console.warn(e); }
  };

  // Eliminar registros: solo supervisor o planner (igual que en el resto de Mantify)
  const delOrig = EQ.DB.del;
  EQ.DB.del = async (store, id, opts) => {
    if (!B.isSup() && !['alertasAtendidas', 'programas', 'migracion'].includes(store)) throw new Error('Solo el supervisor o el planner pueden eliminar registros.');
    return delOrig(store, id, opts);
  };

  // Restaurar un respaldo de la versión anterior (sin conexión): los equipos y neumáticos que ya existen
  // con el mismo código se unen al existente, para no duplicarlos.
  const impOrig = EQ.DB.importAll;
  EQ.DB.importAll = async (data, mode) => {
    if (mode !== 'replace' && data && data.stores) {
      const st = data.stores;
      const remap = (store, field, keyOf) => {
        const map = {};
        (st[store] || []).forEach(o => {
          if (!o || !o.id) return;
          const ex = S[store].find(x => x.id !== o.id && String(keyOf(x) || '').toUpperCase() === String(keyOf(o) || '').toUpperCase() && keyOf(o));
          if (!ex) return;
          map[o.id] = ex.id;
          const keep = { id: ex.id, fleetId: ex.fleetId, offSig: ex.offSig };
          Object.keys(keep).forEach(k => { if (keep[k] === undefined) delete keep[k]; });
          Object.assign(o, keep);
        });
        if (!Object.keys(map).length) return;
        Object.keys(st).forEach(k => (st[k] || []).forEach(r => { if (r && map[r[field]]) r[field] = map[r[field]]; }));
      };
      remap('equipos', 'equipoId', x => x.codigo);
      remap('neumaticos', 'neumaticoId', x => x.codigo);
    }
    return impOrig(data, mode);
  };

  // ---------------- Datos del módulo anterior de Mantify ----------------
  const yaMigrado = id => S.migracion.some(x => x.id === id);
  const marcar = id => EQ.DB.put('migracion', { id, fecha: U.today() }, { noAudit: true });
  let migrando = false;
  B.migrar = async () => {
    if (migrando) return; migrando = true;
    try { await migrar(); } catch (e) { console.error('Migración', e); } finally { migrando = false; }
  };
  const migrar = async () => {
    const m = M(); if (!m) return;
    // Engrases (incluye los que se registran desde el reporte de mantenimiento)
    for (const g of (m.grease || [])) {
      if (!g || !g.id || !g.fleetId || !g.date || yaMigrado('g:' + g.id)) continue;
      const eq = S.equipos.find(e => e.fleetId === g.fleetId); if (!eq) continue;
      const ex = C.diarioEn(eq.id, g.date);
      if (!ex) {
        const vacio = v => v === '' || v === null || v === undefined;
        // tipo: el del registro; si no viene, el programado ese día (como el Control diario)
        const fila = C.programaMes(C.mesDe(g.date)).find(f => f.eq.id === eq.id);
        const tipos = C.tiposEng().map(t => t.codigo);
        const tipo = tipos.includes(g.tipo) ? g.tipo : ((fila && fila.dias[g.date]) || 'EG');
        const pts = C.puntosDeTipo(eq, tipo);
        const desdeRD = g.origin === 'intervencion' && g.tipo !== undefined; // registros nuevos del registro de intervenciones
        const grasa = g.grease && C.grasa(g.grease) ? g.grease : (g.grease || C.grasaEq(eq));
        const origen = g.origin === 'intervencion' ? `Desde el registro de intervenciones${g.stopNum ? ' ' + g.stopNum : ''}` : 'Importado del módulo anterior';
        const obs = [g.notes && g.notes !== 'Registrado desde el reporte de mantenimiento.' ? g.notes : '', origen, g.qty && g.unit && g.unit !== 'kg' && g.unit !== 'g' ? `${g.qty} ${g.unit}` : ''].filter(Boolean).join(' · ');
        const hor = Number(g.hours) > 0 ? Number(g.hours) : null;
        let hecho = false;
        if (desdeRD && C.engraseAplica(eq)) { // igual que el Control diario: actualiza puntos, horómetro y costos
          try {
            await C.registrarDiario({ eq, fecha: g.date, horometro: hor, tipo, tecnico: g.tech || '', observaciones: obs, tipoGrasa: grasa, kg: g.unit === 'kg' && !vacio(g.qty) ? Number(g.qty) : null, nPuntos: vacio(g.done) ? null : Number(g.done), id: 'G_' + g.id, extra: { origenMantify: g.id, stopId: g.stopId || '' } });
            hecho = true;
          } catch (e) { console.warn('Engrase desde intervención', e); }
        }
        if (!hecho) {
          const qty = Number(g.qty);
          let gramos = !vacio(g.qty) && !isNaN(qty) && qty >= 0 ? (g.unit === 'g' ? qty : g.unit === 'kg' ? qty * 1000 : 0) : null;
          if (gramos === null) gramos = desdeRD ? pts.reduce((s2, p) => s2 + (Number(p.gramos) || 0), 0) : 0;
          const puntos = !vacio(g.done) ? Number(g.done) || 0 : (desdeRD ? pts.length : 0);
          const d = { id: 'G_' + g.id, fecha: g.date, equipoId: eq.id, horometro: hor, tipo, tecnico: g.tech || '', observaciones: obs,
            foto: null, gramos: +Number(gramos).toFixed(1), puntos, puntosIds: [], tipoGrasa: grasa, precioKg: C.precioGrasa(grasa), precioPunto: C.precioPunto(grasa), tc: C.tc(), origenMantify: g.id, stopId: g.stopId || '' };
          const c = C.costoDiario(d); d.costoKg = +c.costoKg.toFixed(2); d.costoPuntos = +c.costoPuntos.toFixed(2); d.costoKgUSD = +c.costoKgUSD.toFixed(2); d.costoPuntosUSD = +c.costoPuntosUSD.toFixed(2);
          await EQ.DB.put('engrasesDiarios', d, { motivo: 'Desde Mantify' });
        }
        if (g.tech) await C.asegurarTecnico(g.tech, 'Engrase');
      }
      await marcar('g:' + g.id);
    }
    // Neumáticos del módulo anterior: pasan al inventario (almacén) con su historial resumido
    const cfg = C.cfg();
    for (const t of (m.tires || [])) {
      if (!t || !t.id || !t.code || yaMigrado('t:' + t.id)) continue;
      if (!S.neumaticos.some(n => String(n.codigo).toUpperCase() === String(t.code).toUpperCase())) {
        const otr = /R(2[4-9]|3\d|4\d|5\d)\b|^(1[6-9]|2\d|3\d)\.\d/i.test(String(t.size || ''));
        const tipo = cfg.tiposNeumatico.find(x => otr ? /OTR/i.test(x.nombre) : /camión/i.test(x.nombre)) || cfg.tiposNeumatico[0];
        const eqAnt = t.status === 'MONTADO' ? ((M().fleet || []).find(f => f.id === t.fleetId) || {}).code : '';
        const estado = t.status === 'DESCARTADO' ? 'Baja definitiva' : t.status === 'RECAPADO' ? 'En reparación' : t.type === 'RECAPADO' ? 'Reencauchado' : 'Nuevo';
        const n = { id: 'T_' + t.id, codigo: String(t.code).toUpperCase(), serie: String(t.code).toUpperCase(), marca: t.brand || '', medida: t.size || '', diseno: t.design || '', tipo: tipo ? tipo.nombre : '', profInicial: Number(t.cocadaInit) || (tipo ? tipo.profNueva : null), presionRec: tipo ? tipo.presionRec : null,
          costo: Number(t.cost) || 0, monedaCosto: 'USD', fechaAdq: t.buyDate || '', estado, equipoId: null, posicion: null, ciclo: Number(t.retreads) || 0, reencauches: Number(t.retreads) || 0, usoInicioCiclo: 0, usoAcumulado: Number(t.hoursRun) || 0,
          observaciones: [t.notes, 'Importado del módulo anterior de Mantify', eqAnt ? `Estaba montado en ${eqAnt} posición ${t.pos || '—'}: instálalo en el diagrama` : '', t.lastCocada !== undefined && t.lastCocada !== '' && t.lastCocada !== null ? `Última cocada ${t.lastCocada} mm${t.lastReadDate ? ' (' + U.fdate(t.lastReadDate) + ')' : ''}` : ''].filter(Boolean).join(' · ') };
        await EQ.DB.put('neumaticos', n, { motivo: 'Importado del módulo anterior de Mantify' });
        await C.registrarMovimiento(n, 'Alta', { motivo: 'Importado de Mantify', costo: 0, observaciones: `Estado ${estado}` });
      }
      await marcar('t:' + t.id);
    }
  };

  // ---------------- Resumen para Mantify ----------------
  const KMAP = { verde: 'AL_DIA', amarillo: 'PROXIMO', rojo: 'VENCIDO', gris: 'SINREG' };
  B.summary = () => {
    const out = { at: Date.now(), gr: {}, tr: {} };
    const lim = Number(C.th().diasSinEngrase) || 4;
    C.equiposActivos().forEach(eq => {
      const code = String(eq.codigo).toUpperCase();
      // Engrase
      let g;
      if (!C.engraseAplica(eq)) g = { k: 'SINPLAN', lines: ['Fuera del plan de engrase'] };
      else {
        const u = C.ultimoEngrase(eq), ds = C.diasSinEngrase(eq);
        let k = u ? 'AL_DIA' : 'SINREG';
        try { const r = C.resumenEngraseEq(eq); if (r.total && KMAP[r.peor] && r.peor !== 'gris') k = KMAP[r.peor]; } catch (e) { }
        if (u && ds !== null) { if (ds > lim) k = 'VENCIDO'; else if (ds >= lim - 1 && k === 'AL_DIA') k = 'PROXIMO'; }
        const lines = [];
        if (u) lines.push(`Último engrase ${U.fdate(u.fecha)} (${u.tipo})${u.horometro !== null && u.horometro !== undefined ? ' a ' + U.num(u.horometro, 1) + ' ' + C.unidad(eq) : ''}`);
        if (!u) lines.push('Sin engrases registrados');
        else if (ds !== null) lines.push(ds > lim ? `${ds} días sin engrase (límite ${lim}): excedido ${ds - lim} día(s)` : `${ds} día(s) sin engrase · límite ${lim}`);
        g = { k, lines };
      }
      g.last = C.diarios(eq.id).slice(-8).reverse().map(d => ({ date: d.fecha, hours: d.horometro, by: d.tecnico || '', tipo: d.tipo }));
      // costos y eventos de los últimos 12 meses, para la ficha del equipo en Mantify
      try {
        const desde = U.addDays(U.today(), -365), mb = C.cfg().moneda || 'S/';
        const dd = C.diarios(eq.id).filter(d => d.fecha >= desde);
        g.cost12 = Math.round(dd.reduce((s, d) => s + (C.costoDiario(d).costo || 0), 0) * 100) / 100; g.n12 = dd.length; g.mon = mb;
        const mv = S.movimientos.filter(m => m.equipoId === eq.id && (m.fecha || '') >= desde);
        g.neuCost12 = Math.round(mv.reduce((s, m) => s + (C.conv(m.costo, m.monedaCosto || C.monBase(), C.monNeum()) || 0), 0) * 100) / 100; g.neuMon = C.monNeum();
        const nn = id => (S.neumaticos.find(x => x.id === id) || {}).codigo || '';
        g.neuEv = mv.map(m => ({ date: (m.fecha || '').slice(0, 10), t: `${m.tipo} ${nn(m.neumaticoId)}${m.posNueva || m.posAnterior ? ' · pos. ' + (m.posNueva || m.posAnterior) : ''}${m.motivo ? ' — ' + m.motivo : ''}` }))
          .concat([...new Set(S.inspecciones.filter(i => i.equipoId === eq.id && (i.fecha || '') >= desde).map(i => (i.fecha || '').slice(0, 10)))].map(f => ({ date: f, t: 'Medición de neumáticos' })))
          .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25);
      } catch (e) { }
      out.gr[code] = g;
      // Neumáticos
      if (C.neumAplica(eq)) {
        const pos = C.posiciones(eq.layoutNeum);
        const mounted = C.neumEq(eq.id).map(n => {
          const a = C.analisisNeum(n), l = a.lim || {};
          const mm = a.ultima && a.profActual !== null && a.profActual !== undefined ? Math.round(a.profActual * 10) / 10 : null;
          const k = mm === null ? 'SINMED' : (l.profRetiro !== null && l.profRetiro !== undefined && mm <= l.profRetiro) ? 'CAMBIO' : (l.profAlerta !== null && l.profAlerta !== undefined && mm <= l.profAlerta) ? 'ALERTA' : 'OK';
          const p = pos.find(x => x.pos === n.posicion);
          return { pos: n.posicion, num: p ? p.num : 99, code: n.codigo, k, c: mm };
        }).sort((a, b) => a.num - b.num);
        out.tr[code] = { pos: pos.length, mounted };
      }
    });
    // Indicadores del Dashboard del módulo, para el Dashboard principal de Mantify
    try {
      const k = C.kpis(), al = C.alertas().filter(a => !a.atendida);
      out.kpi = {
        cumplimientoProg: k.cumplimientoProg, progMes: k.progMes, ejecMes: k.ejecMes, egMes: k.egMes, epMes: k.epMes,
        progHoy: k.progHoy, pendHoy: k.pendHoy, excedidos: k.excedidos, equiposPrograma: k.equiposPrograma,
        consumoMesKg: k.consumoMesKg, puntos: k.puntos, rojo: k.rojo, amarillo: k.amarillo,
        neumInstalados: k.neumInstalados, neumOperativos: k.neumOperativos, neumObservacion: k.neumObservacion, neumCriticos: k.neumCriticos,
        presionFuera: k.presionFuera, desgProm: k.desgProm, proxReemplazo: k.proxReemplazo, neumTotal: k.neumTotal, costoNeum: k.costoNeum,
        equiposCriticos: k.equiposCriticos, alertas: al.length, alertasCriticas: al.filter(a => a.prioridad === 'critica').length, moneda: C.cfg().monedaNeum || 'S/'
      };
      // Agenda para la planificación de Mantify: engrases EG/EP del programa e inspecciones de neumáticos
      const ag = C.programacion(U.addDays(U.today(), -45), U.addDays(U.today(), 56)).eventos;
      out.agenda = ag.filter(e => !e.ejecutado || e.fecha >= U.addDays(U.today(), -14)).map(e => ({ d: e.fecha, code: String(e.eq.codigo).toUpperCase(), k: e.tipo, t: e.tipoEng || '', h: e.tipo === 'engrase' ? (Number(e.horas) || 0) : 0, n: e.cantidad || 0, done: !!e.ejecutado, venc: !!e.vencido }));
      out.uso = {}; C.equiposActivos().forEach(eq => { const u = C.usoDia(eq); if (u) out.uso[String(eq.codigo).toUpperCase()] = { u: Math.round(u * 10) / 10, un: C.unidad(eq) }; });
      out.top = C.prioridadEquipos(al).slice(0, 5).map(x => ({ code: x.eq.codigo, score: Math.round(x.score), motivos: [...x.motivos].slice(0, 3) }));
      // Respuestas rápidas para el planner (antes en el Dashboard General del módulo)
      const hoy = U.today(), mk = U.monthKey(hoy), lim = Number(C.th().diasSinEngrase) || 4;
      const progMes = C.programaMes(mk);
      const pendEq = C.equiposPrograma().filter(e => { const d = C.diasSinEngrase(e); const f = progMes.find(x => x.eq.id === e.id); return (d !== null && d > lim) || (f && f.dias[hoy] && !C.diarioEn(e.id, hoy)); });
      const noEjMes = progMes.reduce((s, f) => s + Object.keys(f.dias).filter(d => d < hoy && !C.diarioEn(f.eq.id, d)).length, 0);
      const est30 = C.estatusEngrase({ desde: U.addDays(hoy, -30), hasta: hoy }).tot;
      const neum = S.neumaticos.filter(n => n.posicion).map(n => Object.assign({ n }, C.analisisNeum(n))).filter(x => x.eq);
      const irr = neum.filter(x => x.irregular);
      const proxR = neum.filter(x => x.fechaReemplazo).sort((a, b) => a.fechaReemplazo < b.fechaReemplazo ? -1 : 1);
      const prog7 = C.programacion(hoy, U.addDays(hoy, 7)).eventos.filter(e => !e.ejecutado);
      const neumMes = S.movimientos.filter(m => U.monthKey(m.fecha) === mk).reduce((s, m) => s + C.conv(m.costo, m.monedaCosto, C.monNeum()), 0) + S.neumaticos.filter(n => U.monthKey(n.fechaAdq) === mk).reduce((s, n) => s + C.conv(n.costo, n.monedaCosto, C.monNeum()), 0);
      const lista = (a, n) => a.length ? a.slice(0, n).join(', ') + (a.length > n ? ` (+${a.length - n})` : '') : '';
      out.kpi.noEjMes = noEjMes; out.kpi.lim = lim;
      out.rap = {
        pend: lista(pendEq.map(e => e.codigo), 6), nPend: pendEq.length,
        venc: `${noEjMes} engrase(s) · ${k.excedidos} equipo(s) con más de ${lim} días sin engrase`, nVenc: noEjMes + (k.excedidos || 0),
        cons: `${U.num(est30.kg, 2)} kg · ${U.num(est30.puntos)} puntos · ${U.money(est30.costo)} · ${U.usd(est30.costoUSD)}`,
        irr: lista(irr.map(x => `${x.eq.codigo}/${x.n.posicion}`), 4), nIrr: irr.length,
        prox: proxR.length ? `${proxR[0].n.codigo} (${proxR[0].eq.codigo}) · ${U.fdate(proxR[0].fechaReemplazo)}` : '',
        costo: `${U.moneyN(k.costoNeum)} / ${U.moneyN(neumMes)}`,
        prog7: `${prog7.filter(e => e.tipo === 'engrase').length} engrases (EG ${prog7.filter(e => e.tipoEng === 'EG').length} / EP ${prog7.filter(e => e.tipoEng === 'EP').length}) · ${prog7.filter(e => e.tipo === 'inspeccion').length} inspecciones`,
        prio: lista(C.prioridadEquipos(al).map(p => p.eq.codigo), 5)
      };
    } catch (e) { console.warn(e); }
    return out;
  };
  let sumT = null;
  B.publish = () => {
    clearTimeout(sumT);
    sumT = setTimeout(() => { try { const h = host(); if (h && h.eqnSummary) h.eqnSummary(B.summary()); } catch (e) { console.warn(e); } }, 400);
  };

  // ---------------- Interfaz dentro de Mantify ----------------
  B.theme = () => {
    let light = false;
    try { light = host() ? host().document.documentElement.classList.contains('light') : localStorage.getItem('theme') === 'light'; } catch (e) { }
    document.documentElement.classList.toggle('dark', !light);
  };
  B.applyRole = () => {
    const sup = B.isSup(), admin = B.isAdmin();
    const cfgLink = document.querySelector('#menu a[data-route="configuracion"]');
    if (cfgLink) cfgLink.style.display = sup ? '' : 'none';
    const bk = document.getElementById('btnBackupQuick'); if (bk) bk.style.display = sup ? '' : 'none';
    document.documentElement.classList.toggle('rol-tec', !sup);
    document.documentElement.classList.toggle('rol-admin', admin);
    const st = document.getElementById('dbStatus'); if (st) st.textContent = 'Nube de Mantify · ' + ((B.me() || {}).name || '');
  };
  // Abre un equipo en una vista (lo usa Mantify desde la ficha, el inicio y los pendientes)
  B.open = (route, code) => {
    if (code) { const eq = C.eqByCode(code); if (eq) EQ.App.state.eqId = eq.id; }
    let [r, t] = String(route || 'engrase').split(':');
    if (!EQ.Views[r] || !EQ.Views[r].render) r = 'engrase';
    if (t) EQ.App.state.tab[r] = t;
    EQ.App.go(r);
  };
  let refT = null;
  B.refresh = () => { clearTimeout(refT); refT = setTimeout(() => { const busy = document.querySelector('#modalRoot > *'); if (busy) { B.publish(); return; } try { EQ.App.refresh(); } catch (e) { B.publish(); } }, 300); };
  // Botones "Ir a Equipos de Mantify" (data-mfleet) dentro del módulo
  document.addEventListener('click', e => { const a = e.target.closest('[data-mfleet]'); if (!a) return; e.preventDefault(); try { host().tab('fleet'); } catch (_) { } });
  B.onFleet = () => { if (window.__EQ_READY) B.syncFleet(); };
  B.onOld = () => { if (window.__EQ_READY) B.migrar().then(B.refresh); };

  B.start = () => {
    B.theme(); B.applyRole();
    // cada vez que se dibuja una vista, Mantify recibe el resumen actualizado
    const r0 = EQ.App.render;
    EQ.App.render = () => {
      if (EQ.App.route === 'configuracion' && !B.isSup()) { EQ.App.route = 'engrase'; location.hash = '#/engrase'; }
      r0(); B.publish();
    };
    B.publish();
    setTimeout(B.syncFleet, 500);
  };

  window.addEventListener('unhandledrejection', e => { const m = e.reason && e.reason.message; if (m && /^Solo el supervisor/.test(m)) U.toast(m, 'bad'); });
  EQ.Bridge = B;
})();
