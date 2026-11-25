/* =========================================================================
   MOTOR DE CÁLCULO – engrase, neumáticos, alertas, programación, KPIs
   ========================================================================= */
(function () {
  const U = EQ.U, S = EQ.S;
  const C = {};
  C.cfg = () => EQ.DB.getConfig();
  C.th = () => C.cfg().umbrales;
  C.eq = id => S.equipos.find(e => e.id === id);
  C.eqByCode = code => S.equipos.find(e => String(e.codigo).trim().toUpperCase() === String(code).trim().toUpperCase());
  C.unidad = eq => (eq && eq.unidad === 'km') ? 'km' : 'h';
  C.lecturaLbl = eq => C.unidad(eq) === 'km' ? 'Kilometraje' : 'Horómetro';
  C.equiposActivos = () => S.equipos.filter(e => e.activo !== false).sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true }));
  C.eqLabel = eq => eq ? `${eq.codigo} – ${eq.descripcion || ''}` : '—';
  // Alcance por módulo: un equipo puede quedar fuera del engrase y/o de la medición de neumáticos
  C.engraseAplica = eq => !!eq && eq.activo !== false && !eq.sinEngrase;
  C.neumAplica = eq => !!eq && eq.activo !== false && !eq.sinNeumaticos;
  C.equiposEngrase = () => C.equiposActivos().filter(C.engraseAplica);
  C.equiposNeum = () => C.equiposActivos().filter(C.neumAplica);
  C.grasa = nombre => C.cfg().tiposGrasa.find(g => g.nombre === nombre);
  // Precios de grasa: se ingresan en moneda local o en US$ (campo "moneda"); estas funciones devuelven moneda local
  C.monGrasa = nombre => { const g = C.grasa(nombre); return g && g.moneda === 'USD' ? 'USD' : 'LOC'; };
  C.precioGrasa = nombre => { const g = C.grasa(nombre); return g ? C.conv(Number(g.precioKg) || 0, g.moneda === 'USD' ? 'USD' : '', C.monBase()) : 0; };
  C.precioPunto = nombre => { const g = C.grasa(nombre); return g ? C.conv(Number(g.precioPunto) || 0, g.moneda === 'USD' ? 'USD' : '', C.monBase()) : 0; };
  C.precioGrasaUSD = nombre => C.precioGrasa(nombre) / C.tc();
  C.precioPuntoUSD = nombre => C.precioPunto(nombre) / C.tc();
  C.grasaEq = eq => (eq && eq.tipoGrasa && C.grasa(eq.tipoGrasa) ? eq.tipoGrasa : null) || (eq && (C.puntosEq(eq.id, true).find(p => p.tipoGrasa) || {}).tipoGrasa) || (C.cfg().tiposGrasa[0] || {}).nombre || '';
  // Técnicos del área
  C.tecnicosDet = () => C.cfg().tecnicosDet || [];
  C.tecnicos = esp => C.tecnicosDet().filter(t => t.activo !== false && (!esp || !t.especialidad || t.especialidad === esp || t.especialidad === 'Engrase y neumáticos')).map(t => t.nombre);
  C.asegurarTecnico = async (nombre, esp) => {
    nombre = String(nombre || '').trim(); if (!nombre) return;
    const cfg = C.cfg();
    if ((cfg.tecnicosDet || []).some(t => t.nombre.toLowerCase() === nombre.toLowerCase())) return;
    cfg.tecnicosDet = (cfg.tecnicosDet || []).concat([{ nombre, cargo: esp === 'Neumáticos' ? 'Técnico de neumáticos' : 'Lubricador', especialidad: esp || 'Engrase', codigo: '', telefono: '', activo: true }]);
    cfg.tecnicos = cfg.tecnicosDet.filter(t => t.activo !== false).map(t => t.nombre);
    await EQ.DB.put('config', cfg, { motivo: 'Técnico agregado desde registro' });
  };
  // Monedas (neumáticos en S/ o US$)
  C.monBase = () => C.cfg().moneda || 'S/';
  C.monUSD = () => C.cfg().monedaUSD || 'US$';
  C.tc = () => Number(C.cfg().tipoCambio) || 1;
  C.esUSD = m => !!m && (m === C.monUSD() || /^(US\$|USD|\$)$/i.test(m));
  C.conv = (v, de, a) => { v = Number(v) || 0; const d = C.esUSD(de) ? 'U' : 'B', t = C.esUSD(a) ? 'U' : 'B'; if (d === t) return v; return d === 'U' ? v * C.tc() : v / C.tc(); };
  C.monNeum = () => C.cfg().monedaNeum || C.monBase();
  C.monedas = () => [C.monBase(), C.monUSD()];

  // ---------- Uso diario promedio ----------
  C.usoDia = eq => {
    if (!eq) return null;
    if (eq.usoDiaManual > 0) return eq.usoDiaManual;
    const rd = S.horometros.filter(h => h.equipoId === eq.id && h.valor !== null).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
    const lim = U.addDays(U.today(), -90);
    const r = rd.filter(x => x.fecha >= lim);
    if (r.length >= 2) {
      const d = U.daysBetween(r[0].fecha, r[r.length - 1].fecha);
      const v = r[r.length - 1].valor - r[0].valor;
      if (d >= 1 && v > 0) return C.unidad(eq) === 'h' ? Math.min(24, v / d) : v / d;
    }
    return C.unidad(eq) === 'km' ? C.th().kmDiaDefault : C.th().horasDiaDefault;
  };

  // ---------- Actualización de horómetro con validación ----------
  C.ultimaLectura = eq => {
    let rd = S.horometros.filter(h => h.equipoId === eq.id);
    const corr = rd.filter(h => h.origen === 'corrección').sort((a, b) => a.creado > b.creado ? -1 : 1)[0];
    if (corr) return Math.max(corr.valor, ...rd.filter(h => h.creado > corr.creado).map(h => h.valor));
    let max = eq.horometro === null || eq.horometro === undefined ? null : Number(eq.horometro);
    rd.forEach(r => { if (max === null || r.valor > max) max = r.valor; });
    return max;
  };
  C.validarLectura = (eq, valor, permitirMenor) => {
    if (valor === null || valor === undefined || isNaN(valor)) throw new Error(`${C.lecturaLbl(eq)} inválido.`);
    if (valor < 0) throw new Error(`${C.lecturaLbl(eq)} negativo no permitido.`);
    const ult = C.ultimaLectura(eq);
    if (!permitirMenor && ult !== null && valor < ult) throw new Error(`${C.lecturaLbl(eq)} (${U.num(valor, 1)}) es inferior al último registro (${U.num(ult, 1)}). Use "Corregir lectura" si es una corrección justificada.`);
  };
  // Valida una lectura contra el historial según su fecha (lecturas anteriores ≤ valor ≤ lecturas posteriores)
  C.validarLecturaEnFecha = (eq, valor, fecha) => {
    if (valor === null || valor === undefined || isNaN(valor) || valor < 0) throw new Error(`${C.lecturaLbl(eq)} inválido o negativo.`);
    let rd = S.horometros.filter(h => h.equipoId === eq.id);
    const corr = rd.filter(h => h.origen === 'corrección').sort((a, b) => a.creado > b.creado ? -1 : 1)[0];
    if (corr) rd = rd.filter(h => h.creado >= corr.creado); // una corrección invalida las lecturas previas
    const antes = rd.filter(h => h.fecha <= fecha).reduce((m, h) => Math.max(m, h.valor), -Infinity);
    const desp = rd.filter(h => h.fecha > fecha).reduce((m, h) => Math.min(m, h.valor), Infinity);
    if (valor < antes) throw new Error(`${C.lecturaLbl(eq)} ${U.num(valor, 1)} es inferior a una lectura registrada en o antes del ${U.fdate(fecha)} (${U.num(antes, 1)}).`);
    if (C.unidad(eq) === 'h') {
      const prev = rd.filter(h => h.fecha < fecha).sort((x, y) => x.fecha < y.fecha ? 1 : -1)[0];
      const next = rd.filter(h => h.fecha > fecha).sort((x, y) => x.fecha > y.fecha ? 1 : -1)[0];
      if (prev && (valor - prev.valor) > 24 * U.daysBetween(prev.fecha, fecha) + 0.01) throw new Error(`Incremento imposible: ${U.num(valor - prev.valor, 1)} h en ${U.daysBetween(prev.fecha, fecha)} día(s) desde la lectura del ${U.fdate(prev.fecha)} (${U.num(prev.valor, 1)} h). Verifique fecha y horómetro.`);
      if (next && (next.valor - valor) > 24 * U.daysBetween(fecha, next.fecha) + 0.01) throw new Error(`Incremento imposible: la lectura del ${U.fdate(next.fecha)} (${U.num(next.valor, 1)} h) supera en más de 24 h/día a ${U.num(valor, 1)} h. Verifique fecha y horómetro.`);
    }
    if (valor > desp) throw new Error(`${C.lecturaLbl(eq)} ${U.num(valor, 1)} es mayor a una lectura posterior al ${U.fdate(fecha)} (${U.num(desp, 1)}). Verifique la fecha.`);
  };
  // Registra una lectura con fecha (actual o pasada) validada contra el historial
  C.registrarLecturaFecha = async (eq, valor, fecha, origen) => {
    C.validarLecturaEnFecha(eq, valor, fecha);
    if (fecha > U.today()) throw new Error('La fecha no puede ser futura.');
    const dup = S.horometros.find(h => h.equipoId === eq.id && h.fecha === fecha && Number(h.valor) === Number(valor));
    if (!dup) await EQ.DB.put('horometros', { equipoId: eq.id, fecha, valor, origen: origen || 'manual' });
    if (eq.horometro === null || eq.horometro === undefined || valor > Number(eq.horometro)) {
      eq.horometro = valor; eq.fechaHorometro = fecha;
      await EQ.DB.put('equipos', eq, { motivo: origen });
    }
  };
  C.registrarLectura = async (eq, valor, fecha, origen, motivo, permitirMenor = false) => {
    C.validarLectura(eq, valor, permitirMenor);
    if (fecha > U.today()) throw new Error('La fecha no puede ser futura.');
    await EQ.DB.put('horometros', { equipoId: eq.id, fecha, valor, origen: origen || 'manual', motivo: motivo || '' });
    const ult = C.ultimaLectura(eq);
    if (permitirMenor || eq.horometro === null || eq.horometro === undefined || valor >= eq.horometro) {
      eq.horometro = permitirMenor ? valor : Math.max(valor, ult || 0);
      eq.fechaHorometro = fecha;
      await EQ.DB.put('equipos', eq, { motivo: motivo || origen });
    }
  };

  // ======================= ENGRASE =======================
  C.puntosEq = (eqId, soloActivos = false) => S.puntos.filter(p => p.equipoId === eqId && (!soloActivos || p.activo !== false)).sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true }));

  C.estadoPunto = (p, eq) => {
    eq = eq || C.eq(p.equipoId);
    const th = C.th();
    const r = { estado: 'gris', motivo: '', proxHor: null, restantes: null, proxFecha: null, diasRest: null, label: 'Sin configuración' };
    if (p.activo === false) { r.estado = 'inactivo'; r.label = 'Inactivo'; return r; }
    const fh = Number(p.frecHoras) || 0, fd = Number(p.frecDias) || 0;
    if (!fh && !fd) { r.motivo = 'Sin frecuencia configurada'; return r; }
    const hasH = fh > 0 && p.ultimoHorometro !== null && p.ultimoHorometro !== undefined && p.ultimoHorometro !== '';
    const hasD = fd > 0 && p.ultimaFecha;
    if (!hasH && !hasD) { r.label = 'Sin línea base'; r.motivo = 'No tiene último engrase registrado'; return r; }
    let rojo = false, amar = false;
    if (hasH) {
      r.proxHor = Number(p.ultimoHorometro) + fh;
      if (eq && eq.horometro !== null && eq.horometro !== undefined) {
        r.restantes = r.proxHor - Number(eq.horometro);
        if (r.restantes <= 0) rojo = true;
        else if (r.restantes <= fh * th.engraseAmarilloPct / 100) amar = true;
      }
    }
    if (hasD) {
      r.proxFecha = U.addDays(p.ultimaFecha, fd);
      r.diasRest = U.daysBetween(U.today(), r.proxFecha);
      if (r.diasRest < 0) rojo = true;
      else if (r.diasRest <= th.engraseAmarilloDias) amar = true;
    }
    if (rojo) { r.estado = 'rojo'; r.label = 'Vencido'; }
    else if (amar) { r.estado = 'amarillo'; r.label = 'Próximo a vencer'; }
    else { r.estado = 'verde'; r.label = 'Dentro del intervalo'; }
    if (p.reprogramadoPara && p.reprogramadoPara >= U.today()) r.motivo = 'Reprogramado para ' + U.fdate(p.reprogramadoPara);
    // severidad de vencimiento
    r.sobrePct = 0;
    if (rojo) {
      const a = r.restantes !== null && fh ? (-r.restantes / fh) * 100 : 0;
      const b = r.diasRest !== null && fd ? (-r.diasRest / fd) * 100 : 0;
      r.sobrePct = Math.max(a, b);
    }
    return r;
  };
  C.ESTADO_PILL = { verde: 'verde', amarillo: 'amarillo', rojo: 'rojo', gris: 'gris', inactivo: 'gris' };
  C.pillPunto = st => U.pill(C.ESTADO_PILL[st.estado], st.label);

  C.resumenEngraseEq = eq => {
    const pts = C.puntosEq(eq.id, true);
    const res = { total: pts.length, verde: 0, amarillo: 0, rojo: 0, gris: 0 };
    pts.forEach(p => { res[C.estadoPunto(p, eq).estado]++; });
    res.peor = pts.length === 0 ? 'gris' : res.rojo ? 'rojo' : res.amarillo ? 'amarillo' : res.gris === pts.length ? 'gris' : 'verde';
    return res;
  };

  C.engrasesAplicados = () => S.engrases.filter(r => r.resultado === 'Ejecutado' || r.resultado === 'Parcial');
  C.consumo = ({ desde, hasta, equipoId } = {}) => {
    const rs = C.engrasesAplicados().filter(r => (!desde || r.fecha >= desde) && (!hasta || r.fecha <= hasta) && (!equipoId || r.equipoId === equipoId));
    const porEquipo = {}, porGrasa = {}, porMes = {}, porPunto = {};
    let totalG = 0, totalCosto = 0, totalUSD = 0;
    rs.forEach(r => {
      const g = Number(r.gramos) || 0, kg = g / 1000, costo = kg * (r.precioKg !== undefined && r.precioKg !== null ? Number(r.precioKg) : C.precioGrasa(r.tipoGrasa));
      const costoUSD = costo / (Number(r.tc) > 0 ? Number(r.tc) : C.tc());
      totalG += g; totalCosto += costo; totalUSD += costoUSD;
      const add = (o, k) => { if (!o[k]) o[k] = { g: 0, costo: 0, costoUSD: 0, n: 0 }; o[k].g += g; o[k].costo += costo; o[k].costoUSD += costoUSD; o[k].n++; };
      add(porEquipo, r.equipoId); add(porGrasa, r.tipoGrasa || 'Sin especificar'); add(porMes, U.monthKey(r.fecha)); add(porPunto, r.puntoId);
    });
    return { registros: rs, totalG, totalKg: totalG / 1000, totalCosto, totalUSD, porEquipo, porGrasa, porMes, porPunto };
  };
  C.cumplimientoMes = mk => {
    const rs = S.engrases.filter(r => U.monthKey(r.fecha) === mk);
    if (!rs.length) return null;
    const pts = rs.reduce((s, r) => s + (r.resultado === 'Ejecutado' ? 1 : r.resultado === 'Parcial' ? 0.5 : 0), 0);
    return pts / rs.length * 100;
  };

  // ======================= PROGRAMA DE ENGRASE MENSUAL =======================
  C.tiposEng = () => C.cfg().tiposEngrase || [];
  C.tipoEng = cod => C.tiposEng().find(t => t.codigo === cod) || { codigo: cod, nombre: cod, horas: 0 };
  C.movilizado = eq => !eq.estadoMov || !/DESMOV|PROCESO|BAJA|INOPERATIV|VENDID/i.test(eq.estadoMov);
  C.enPrograma = eq => eq.activo !== false && !eq.sinEngrase && C.movilizado(eq) && (eq.enPrograma === true || (eq.enPrograma !== false && !(C.cfg().familiasSinPrograma || []).includes(eq.familia)));
  C.equiposPrograma = () => C.equiposActivos().filter(C.enPrograma);
  C.planDefault = fam => { const p = C.cfg().planesEngrase || {}; return JSON.parse(JSON.stringify(p[fam] || p['Otros'] || { secuencia: ['EG'], intervalo: 7 })); };
  C.plan = eq => {
    const p = eq.planEngrase && eq.planEngrase.intervalo > 0 && (eq.planEngrase.secuencia || []).length ? eq.planEngrase : C.planDefault(eq.familia);
    return { secuencia: p.secuencia, intervalo: Math.max(1, Math.round(p.intervalo)), ancla: p.ancla || null };
  };
  C.planTexto = p => `${p.secuencia.join(' → ')} cada ${p.intervalo} día(s)`;
  C.mesDias = mes => { const [y, m] = mes.split('-').map(Number); const n = new Date(y, m, 0).getDate(); return Array.from({ length: n }, (_, i) => `${mes}-${U.pad(i + 1)}`); };
  C.mesDe = f => f.slice(0, 7);
  // Genera el programa de un mes a partir de los planes (ancla = fecha de un EG; si no hay, se escalona por ítem)
  C.generarDias = (eq, mes, idx = 0) => {
    const p = C.plan(eq);
    const ancla = p.ancla || U.addDays(mes + '-01', idx % p.intervalo);
    const out = {};
    C.mesDias(mes).forEach(d => {
      const k = U.daysBetween(ancla, d);
      if (((k % p.intervalo) + p.intervalo) % p.intervalo === 0) {
        const n = Math.floor(k / p.intervalo);
        out[d] = p.secuencia[((n % p.secuencia.length) + p.secuencia.length) % p.secuencia.length];
      }
    });
    return out;
  };
  C.programaGuardado = (mes, eqId) => S.programas.find(x => x.id === `${mes}|${eqId}`);
  C.excluidoMes = (mes, eqId) => { const g = C.programaGuardado(mes, eqId); return !!(g && g.excluido); };
  C.excluidosMes = mes => S.programas.filter(x => x.mes === mes && x.excluido).map(x => C.eq(x.equipoId)).filter(Boolean);
  C.programaMes = mes => {
    const eqs = C.equiposPrograma().filter(e => !C.excluidoMes(mes, e.id));
    // equipos con programa guardado (agregados manualmente) se incluyen aunque hoy no estén en programa
    S.programas.filter(x => x.mes === mes && !x.excluido && !eqs.find(e => e.id === x.equipoId)).forEach(x => { const e = C.eq(x.equipoId); if (e && (C.engraseAplica(e) || (mes < C.mesDe(U.today()) && x.dias && Object.keys(x.dias).length))) eqs.push(e); });
    const ord = e => { const g = C.programaGuardado(mes, e.id); return g && g.item ? g.item : (e.ordenPrograma || 9999); };
    eqs.sort((a, b) => ord(a) - ord(b) || String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true }));
    return eqs.map((eq, i) => {
      const g = C.programaGuardado(mes, eq.id);
      return { eq, item: i + 1, dias: g && !g.excluido ? g.dias : C.generarDias(eq, mes, i), guardado: !!(g && !g.excluido), manual: g ? !!g.manual : false };
    });
  };
  C.guardarProgramaMes = async (mes, sobrescribir = false) => {
    const filas = C.programaMes(mes);
    const recs = [];
    filas.forEach((f, i) => {
      if (f.guardado && !sobrescribir) return;
      recs.push({ id: `${mes}|${f.eq.id}`, mes, equipoId: f.eq.id, item: f.item, dias: sobrescribir ? C.generarDias(f.eq, mes, i) : f.dias, manual: false });
    });
    if (recs.length) await EQ.DB.bulkPut('programas', recs, { motivo: 'Programa ' + mes });
    return recs.length;
  };
  C.diarios = eqId => S.engrasesDiarios.filter(d => !eqId || d.equipoId === eqId).sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0);
  C.diarioEn = (eqId, fecha) => S.engrasesDiarios.find(d => d.equipoId === eqId && d.fecha === fecha);
  C.ultimoEngrase = eq => { const d = C.diarios(eq.id).filter(x => x.fecha <= U.today()); return d.length ? d[d.length - 1] : null; };
  C.diasSinEngrase = eq => {
    const u = C.ultimoEngrase(eq);
    const base = u ? u.fecha : (eq.fechaInicio || null);
    return base ? Math.max(0, U.daysBetween(base, U.today())) : null;
  };
  C.cumplimientoEq = (mes, eq, dias, hasta) => {
    hasta = hasta || C.mesDias(mes).slice(-1)[0];
    const r = { progEG: 0, progEP: 0, ejeEG: 0, ejeEP: 0, prog: 0, eje: 0, noEjec: 0, pct: null };
    Object.entries(dias || {}).forEach(([d, t]) => { if (d > hasta) return; r.prog++; if (t === 'EG') r.progEG++; else if (t === 'EP') r.progEP++; if (d < U.today() && !C.diarioEn(eq.id, d)) r.noEjec++; });
    S.engrasesDiarios.filter(x => x.equipoId === eq.id && C.mesDe(x.fecha) === mes && x.fecha <= hasta).forEach(x => { r.eje++; if (x.tipo === 'EG') r.ejeEG++; else if (x.tipo === 'EP') r.ejeEP++; });
    r.pct = r.prog ? Math.min(100, r.eje / r.prog * 100) : null;
    return r;
  };
  // Cumplimiento del mes: promedio por equipo (como AVERAGEIFS de la hoja CUMPLIMIENTO). aLaFecha: solo días hasta hoy
  C.cumplimientoMesPrograma = (mes, aLaFecha = true) => {
    const hasta = aLaFecha && mes === C.mesDe(U.today()) ? U.today() : null;
    const filas = C.programaMes(mes).map(f => Object.assign({ eq: f.eq }, C.cumplimientoEq(mes, f.eq, f.dias, hasta)));
    const v = filas.filter(f => f.pct !== null);
    return { filas, pct: v.length ? v.reduce((s, f) => s + f.pct, 0) / v.length : null, prog: filas.reduce((s, f) => s + f.prog, 0), eje: filas.reduce((s, f) => s + f.eje, 0) };
  };
  // Registro del CONTROL DIARIO: actualiza puntos (EG = todos, EP = los marcados "incluido en parcial")
  C.puntosDeTipo = (eq, tipo) => { const pts = C.puntosEq(eq.id, true); return tipo === 'EG' ? pts : pts.filter(p => p.enParcial); };
  // Costos de un registro: por punto engrasado y por kg de grasa usada (precio vigente guardado en el registro)
  C.costoDiario = d => {
    const g = d.tipoGrasa || C.grasaEq(C.eq(d.equipoId));
    const kg = (Number(d.gramos) || 0) / 1000, pts = Number(d.puntos) || 0;
    const pKg = d.precioKg !== undefined && d.precioKg !== null ? Number(d.precioKg) : C.precioGrasa(g);
    const pPt = d.precioPunto !== undefined && d.precioPunto !== null ? Number(d.precioPunto) : C.precioPunto(g);
    const cKg = kg * pKg, cPt = pts * pPt;
    const tc = Number(d.tc) > 0 ? Number(d.tc) : C.tc(); // tipo de cambio guardado en el registro (o el vigente)
    const pun = C.cfg().metodoCostoEngrase === 'puntos';
    return { grasa: g, kg, puntos: pts, precioKg: pKg, precioPunto: pPt, costoKg: cKg, costoPuntos: cPt, costo: pun ? cPt : cKg,
      tc, precioKgUSD: pKg / tc, precioPuntoUSD: pPt / tc, costoKgUSD: cKg / tc, costoPuntosUSD: cPt / tc, costoUSD: (pun ? cPt : cKg) / tc };
  };
  /* Registro del control diario de engrase.
     puntosSel: [{id, gramos}] puntos efectivamente engrasados (por defecto: EG = todos los activos, EP = los marcados).
     nPuntos / kg: cantidad de puntos y kg de grasa usados en el equipo (si se informan, prevalecen sobre la suma de puntos). */
  C.registrarDiario = async ({ eq, fecha, horometro, tipo, tecnico, observaciones, foto, gramosManual, kg, nPuntos, puntosSel, tipoGrasa, id: idFijo, extra }) => {
    if (!fecha || fecha > U.today()) throw new Error('Fecha incorrecta: no puede estar vacía ni ser futura.');
    if (!tipo) throw new Error('Indique el tipo de engrase.');
    if (!C.engraseAplica(eq)) throw new Error(`El equipo ${eq.codigo} está fuera del plan de engrase. Inclúyalo de nuevo para registrar.`);
    if (C.diarioEn(eq.id, fecha)) throw new Error(`Ya existe un engrase registrado para ${eq.codigo} el ${U.fdate(fecha)} (clave COD+FECHA única). Edite el registro existente.`);
    if (kg !== null && kg !== undefined && kg !== '') gramosManual = Number(kg) * 1000;
    if (gramosManual !== null && gramosManual !== undefined && gramosManual < 0) throw new Error('Cantidad de grasa negativa no permitida.');
    if (nPuntos !== null && nPuntos !== undefined && nPuntos < 0) throw new Error('Cantidad de puntos negativa no permitida.');
    if (horometro !== null && horometro !== undefined && horometro !== '') { if (horometro < 0) throw new Error('Horómetro negativo no permitido.'); await C.registrarLecturaFecha(eq, horometro, fecha, 'control diario de engrase'); }
    else horometro = null;
    const id = idFijo || EQ.DB.uid();
    let pts;
    if (Array.isArray(puntosSel)) pts = puntosSel.map(x => { const p = S.puntos.find(q => q.id === x.id); return p ? Object.assign({}, p, { _g: x.gramos !== null && x.gramos !== undefined ? Number(x.gramos) : Number(p.gramos) || 0 }) : null; }).filter(Boolean);
    else pts = C.puntosDeTipo(eq, tipo).map(p => Object.assign({}, p, { _g: Number(p.gramos) || 0 }));
    const grasa = tipoGrasa || (pts.find(p => p.tipoGrasa) || {}).tipoGrasa || C.grasaEq(eq);
    const recs = pts.map(p => ({ intervencionId: id, fecha, equipoId: eq.id, puntoId: p.id, codigoPunto: p.codigo, componente: p.componente, horometro, gramos: p._g, tipoGrasa: p.tipoGrasa || grasa, precioKg: C.precioGrasa(p.tipoGrasa || grasa), precioPunto: C.precioPunto(p.tipoGrasa || grasa), tecnico, resultado: 'Ejecutado', observaciones: C.tipoEng(tipo).nombre, tc: C.tc() }));
    if (!recs.length && gramosManual > 0) recs.push({ intervencionId: id, fecha, equipoId: eq.id, puntoId: null, codigoPunto: tipo, componente: C.tipoEng(tipo).nombre, horometro, gramos: gramosManual, tipoGrasa: grasa, precioKg: C.precioGrasa(grasa), precioPunto: C.precioPunto(grasa), tecnico, resultado: 'Ejecutado', observaciones: 'Cantidad total registrada', tc: C.tc() });
    if (recs.length && gramosManual > 0 && pts.length) { const tot = recs.reduce((s, r) => s + r.gramos, 0); recs.forEach(r => r.gramos = tot ? +(r.gramos * gramosManual / tot).toFixed(1) : +(gramosManual / recs.length).toFixed(1)); }
    const gr = gramosManual !== null && gramosManual !== undefined && gramosManual !== '' && !isNaN(gramosManual) ? Number(gramosManual) : recs.reduce((s, r) => s + r.gramos, 0);
    const np = nPuntos !== null && nPuntos !== undefined && nPuntos !== '' ? Math.round(nPuntos) : pts.length;
    const d = { id, fecha, equipoId: eq.id, horometro, tipo, tecnico: tecnico || '', observaciones: observaciones || '', foto: foto || null, gramos: +gr.toFixed(1), puntos: np, puntosIds: pts.map(p => p.id), tipoGrasa: grasa, precioKg: C.precioGrasa(grasa), precioPunto: C.precioPunto(grasa), tc: C.tc() };
    if (extra) Object.assign(d, extra);
    const c = C.costoDiario(d); d.costoKg = +c.costoKg.toFixed(2); d.costoPuntos = +c.costoPuntos.toFixed(2); d.costoKgUSD = +c.costoKgUSD.toFixed(2); d.costoPuntosUSD = +c.costoPuntosUSD.toFixed(2);
    await EQ.DB.put('engrasesDiarios', d);
    if (recs.length) await EQ.DB.bulkPut('engrases', recs, { noAudit: true });
    for (const q of pts) { const p = S.puntos.find(x => x.id === q.id); if (p && (!p.ultimaFecha || fecha >= p.ultimaFecha)) { p.ultimaFecha = fecha; if (horometro !== null) p.ultimoHorometro = horometro; p.reprogramadoPara = null; await EQ.DB.put('puntos', p, { noAudit: true }); } }
    if (tecnico) await C.asegurarTecnico(tecnico, 'Engrase');
    return { id, puntos: np, gramos: gr };
  };
  // Edición de un registro del control diario sin eliminarlo (tipo, técnico, puntos, kg, grasa, horómetro, observaciones)
  C.actualizarDiario = async (d, c, motivo) => {
    const eq = C.eq(d.equipoId);
    if (c.fecha && c.fecha !== d.fecha) {
      if (c.fecha > U.today()) throw new Error('Fecha incorrecta: no puede ser futura.');
      if (C.diarioEn(d.equipoId, c.fecha)) throw new Error(`Ya existe un engrase de ${eq ? eq.codigo : ''} el ${U.fdate(c.fecha)}.`);
    }
    if (c.horometro !== null && c.horometro !== undefined && c.horometro !== d.horometro) { if (c.horometro < 0) throw new Error('Horómetro negativo no permitido.'); await C.registrarLecturaFecha(eq, c.horometro, c.fecha || d.fecha, 'edición control diario'); }
    if (c.puntos !== undefined && c.puntos !== null && c.puntos < 0) throw new Error('Cantidad de puntos negativa no permitida.');
    if (c.kg !== undefined && c.kg !== null && c.kg < 0) throw new Error('Cantidad de grasa negativa no permitida.');
    const recs = S.engrases.filter(r => r.intervencionId === d.id);
    const nuevoG = c.kg !== undefined && c.kg !== null ? +(c.kg * 1000).toFixed(1) : d.gramos;
    const tot = recs.reduce((s, r) => s + (Number(r.gramos) || 0), 0);
    for (const r of recs) {
      if (c.fecha) r.fecha = c.fecha;
      if (c.tecnico !== undefined) r.tecnico = c.tecnico;
      if (c.horometro !== undefined) r.horometro = c.horometro;
      if (c.tipoGrasa) { r.tipoGrasa = c.tipoGrasa; if (c.actualizarPrecio) { r.precioKg = C.precioGrasa(c.tipoGrasa); r.precioPunto = C.precioPunto(c.tipoGrasa); r.tc = C.tc(); } }
      if (nuevoG !== d.gramos) r.gramos = tot ? +((Number(r.gramos) || 0) * nuevoG / tot).toFixed(1) : +(nuevoG / recs.length).toFixed(1);
      if (c.tipo) r.observaciones = C.tipoEng(c.tipo).nombre;
      await EQ.DB.put('engrases', r, { noAudit: true });
    }
    ['fecha', 'tipo', 'tecnico', 'observaciones', 'horometro', 'puntos', 'tipoGrasa'].forEach(k => { if (c[k] !== undefined) d[k] = c[k]; });
    d.gramos = nuevoG;
    if (c.actualizarPrecio || c.tipoGrasa) { d.precioKg = C.precioGrasa(d.tipoGrasa); d.precioPunto = C.precioPunto(d.tipoGrasa); d.tc = C.tc(); }
    if (c.tc > 0) d.tc = c.tc;
    const k = C.costoDiario(d); d.costoKg = +k.costoKg.toFixed(2); d.costoPuntos = +k.costoPuntos.toFixed(2); d.costoKgUSD = +k.costoKgUSD.toFixed(2); d.costoPuntosUSD = +k.costoPuntosUSD.toFixed(2);
    await EQ.DB.put('engrasesDiarios', d, { motivo: motivo || 'Edición del registro' });
    for (const p of C.puntosEq(d.equipoId)) if (EQ.Views.engrase && EQ.Views.engrase.recalcPunto) await EQ.Views.engrase.recalcPunto(p);
    if (c.tecnico) await C.asegurarTecnico(c.tecnico, 'Engrase');
    return d;
  };
  // Estatus de engrase: puntos engrasados, kg de grasa y costos por equipo / técnico / grasa / mes
  C.estatusEngrase = ({ desde, hasta, equipoId, tecnico } = {}) => {
    const ds = S.engrasesDiarios.filter(d => (!desde || d.fecha >= desde) && (!hasta || d.fecha <= hasta) && (!equipoId || d.equipoId === equipoId) && (!tecnico || d.tecnico === tecnico));
    const vac = () => ({ n: 0, eg: 0, ep: 0, otros: 0, puntos: 0, kg: 0, costoPuntos: 0, costoKg: 0, costo: 0, costoPuntosUSD: 0, costoKgUSD: 0, costoUSD: 0, ultimo: '' });
    const porEquipo = {}, porTecnico = {}, porGrasa = {}, porMes = {}, tot = vac();
    const add = (o, k, d, c) => { if (!o[k]) o[k] = vac(); const x = o[k]; x.n++; if (d.tipo === 'EG') x.eg++; else if (d.tipo === 'EP') x.ep++; else x.otros++; x.puntos += c.puntos; x.kg += c.kg; x.costoPuntos += c.costoPuntos; x.costoKg += c.costoKg; x.costo += c.costo; x.costoPuntosUSD += c.costoPuntosUSD; x.costoKgUSD += c.costoKgUSD; x.costoUSD += c.costoUSD; if (d.fecha > x.ultimo) x.ultimo = d.fecha; };
    ds.forEach(d => { const c = C.costoDiario(d); add(porEquipo, d.equipoId, d, c); add(porTecnico, d.tecnico || 'Sin técnico', d, c); add(porGrasa, c.grasa || 'Sin especificar', d, c); add(porMes, C.mesDe(d.fecha), d, c); tot.n++; if (d.tipo === 'EG') tot.eg++; else if (d.tipo === 'EP') tot.ep++; tot.puntos += c.puntos; tot.kg += c.kg; tot.costoPuntos += c.costoPuntos; tot.costoKg += c.costoKg; tot.costo += c.costo; tot.costoPuntosUSD += c.costoPuntosUSD; tot.costoKgUSD += c.costoKgUSD; tot.costoUSD += c.costoUSD; });
    return { registros: ds, tot, porEquipo, porTecnico, porGrasa, porMes };
  };
  C.eliminarDiario = async (d, motivo) => {
    for (const r of S.engrases.filter(x => x.intervencionId === d.id)) await EQ.DB.del('engrases', r.id, { noAudit: true });
    await EQ.DB.del('engrasesDiarios', d.id, { motivo });
    for (const p of C.puntosEq(d.equipoId)) if (EQ.Views.engrase && EQ.Views.engrase.recalcPunto) await EQ.Views.engrase.recalcPunto(p);
  };

  // ======================= NEUMÁTICOS =======================
  C.posiciones = layout => {
    const out = [];
    if (!layout) return out;
    let n = 1;
    (layout.ejes || []).forEach((e, i) => {
      const E = `E${i + 1}`;
      const sides = e.tipo === 'dual' ? [['IZQ-EXT', 'Izq. exterior'], ['IZQ-INT', 'Izq. interior'], ['DER-INT', 'Der. interior'], ['DER-EXT', 'Der. exterior']] : [['IZQ', 'Izquierda'], ['DER', 'Derecha']];
      sides.forEach(([s, t]) => out.push({ pos: `${E}-${s}`, num: n++, eje: i, ejeNombre: e.nombre, lado: s, label: `${e.nombre} · ${t}`, repuesto: false }));
    });
    for (let r = 1; r <= (Number(layout.repuestos) || 0); r++) out.push({ pos: `REP-${r}`, num: n++, eje: -1, ejeNombre: 'Repuesto', lado: 'REP', label: `Repuesto ${r}`, repuesto: true });
    return out;
  };
  C.posLabel = (eq, pos) => { if (!pos) return '—'; const p = C.posiciones(eq && eq.layoutNeum).find(x => x.pos === pos); return p ? `P${p.num} · ${pos}` : pos; };
  C.isRep = pos => String(pos || '').startsWith('REP');
  C.neumEnPos = (eqId, pos) => S.neumaticos.find(n => n.equipoId === eqId && n.posicion === pos);
  C.neumEq = eqId => S.neumaticos.filter(n => n.equipoId === eqId && n.posicion);
  C.tipoNeum = n => C.cfg().tiposNeumatico.find(t => t.nombre === n.tipo) || null;
  C.limites = n => {
    const t = C.tipoNeum(n) || {};
    return {
      profAlerta: n.profAlerta !== null && n.profAlerta !== undefined && n.profAlerta !== '' ? Number(n.profAlerta) : (t.profAlerta !== undefined ? Number(t.profAlerta) : null),
      profRetiro: n.profRetiro !== null && n.profRetiro !== undefined && n.profRetiro !== '' ? Number(n.profRetiro) : (t.profRetiro !== undefined ? Number(t.profRetiro) : null)
    };
  };
  C.tolPresion = (n, eq) => {
    if (n && n.tolPresion > 0) return Number(n.tolPresion);
    if (eq && eq.tolPresion > 0) return Number(eq.tolPresion);
    const t = n ? C.tipoNeum(n) : null;
    if (t && t.tolerancia > 0) return Number(t.tolerancia);
    return C.th().presionTolPct;
  };
  C.usoNeum = n => {
    let u = Number(n.usoAcumulado) || 0;
    if (n.equipoId && n.posicion && !C.isRep(n.posicion)) {
      const eq = C.eq(n.equipoId);
      if (eq && eq.horometro !== null && eq.horometro !== undefined && n.lecturaInstalacion !== null && n.lecturaInstalacion !== undefined) u += Math.max(0, Number(eq.horometro) - Number(n.lecturaInstalacion));
    }
    return u;
  };
  C.usoNeumEnLectura = (n, lectura) => {
    let u = Number(n.usoAcumulado) || 0;
    if (n.equipoId && n.posicion && !C.isRep(n.posicion) && lectura !== null && n.lecturaInstalacion !== null && n.lecturaInstalacion !== undefined) u += Math.max(0, Number(lectura) - Number(n.lecturaInstalacion));
    return u;
  };
  C.inspNeum = (n, soloCiclo = true) => S.inspecciones.filter(i => i.neumaticoId === n.id && (!soloCiclo || (i.ciclo || 0) === (n.ciclo || 0))).sort((a, b) => (a.fecha + (a.creado || '')) < (b.fecha + (b.creado || '')) ? -1 : 1);
  // Mediciones de remanente: lista libre (profs) o las 3 zonas clásicas
  C.medNombres = () => (C.cfg().medicionesCocada && C.cfg().medicionesCocada.length ? C.cfg().medicionesCocada : ['Interior', 'Central', 'Exterior']);
  const okv = x => x !== null && x !== undefined && x !== '' && !isNaN(x);
  C.profsOf = i => (Array.isArray(i.profs) ? i.profs : [i.profInt, i.profCen, i.profExt]).filter(okv).map(Number);
  C.profProm = i => { const v = C.profsOf(i); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  C.zonas = profs => { // interior / central / exterior derivadas de N mediciones
    const p = profs.filter(okv).map(Number);
    if (!p.length) return { profInt: null, profCen: null, profExt: null };
    if (p.length === 1) return { profInt: null, profCen: p[0], profExt: null };
    if (p.length === 2) return { profInt: p[0], profCen: null, profExt: p[1] };
    const mid = p.slice(1, -1);
    return { profInt: p[0], profCen: mid.reduce((a, b) => a + b, 0) / mid.length, profExt: p[p.length - 1] };
  };
  C.patrones = (i) => {
    const out = [];
    const th = C.th().desgasteIrregularMm;
    const z = C.zonas(C.profsOf(i));
    const A = z.profInt, B = z.profCen, Cc = z.profExt;
    if (A !== null && B !== null && Cc !== null) {
      if (B < Math.min(A, Cc) - th) out.push('Desgaste central');
      else if (A < B - th && Cc < B - th) out.push('Desgaste en ambos hombros');
      if (Math.abs(A - Cc) > th && !out.includes('Desgaste en ambos hombros')) out.push('Desgaste lateral');
      const all = C.profsOf(i);
      if (Math.max(...all) - Math.min(...all) > th * 2 && !out.length) out.push('Desgaste irregular');
    } else if (A !== null && Cc !== null && Math.abs(A - Cc) > th) out.push('Desgaste lateral');
    (i.condiciones || []).forEach(x => { if (x && x !== 'Sin novedad' && !out.includes(x)) out.push(x); });
    return out;
  };
  // Lectura estimada del equipo en una fecha (interpolación del historial de horómetro/km)
  C.lecturaEnFecha = (eq, fecha) => {
    if (!eq) return null;
    const rd = S.horometros.filter(h => h.equipoId === eq.id && okv(h.valor)).sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.valor - b.valor);
    if (!rd.length) return null;
    const prev = rd.filter(h => h.fecha <= fecha).pop(), next = rd.find(h => h.fecha > fecha);
    if (prev && prev.fecha === fecha) return prev.valor;
    if (prev && next) { const t = U.daysBetween(prev.fecha, next.fecha); return t ? prev.valor + (next.valor - prev.valor) * U.daysBetween(prev.fecha, fecha) / t : prev.valor; }
    // después de la última lectura: solo si es reciente (≤ 3 días); si no, no se estima (se proyecta por fechas)
    if (prev && U.daysBetween(prev.fecha, fecha) <= 3) return prev.valor + (C.usoDia(eq) || 0) * U.daysBetween(prev.fecha, fecha);
    return null;
  };
  // Uso acumulado del neumático en una fecha/lectura (null si no se puede determinar)
  C.usoNeumEnFecha = (n, fecha, lectura, equipoId) => {
    const base = Number(n.usoAcumulado) || 0;
    const instalado = n.equipoId && n.posicion && !C.isRep(n.posicion) && (!equipoId || equipoId === n.equipoId) && (!n.fechaInst || fecha >= n.fechaInst);
    if (!instalado) return n.posicion ? null : base;
    const eq = C.eq(n.equipoId);
    const lect = okv(lectura) ? Number(lectura) : C.lecturaEnFecha(eq, fecha);
    if (lect === null || !okv(n.lecturaInstalacion)) return null;
    return base + Math.max(0, lect - Number(n.lecturaInstalacion));
  };
  // Guarda una medición de remanente / presión (usada por la inspección por sesión y la carga libre)
  C.guardarMedicion = async ({ n, fecha, lectura, profs, presionMed, presionRec, condiciones, observaciones, inspector, fotos, posicion, equipoId, sesionId, registrarLectura = true }) => {
    if (!fecha || fecha > U.today()) throw new Error(`${n.codigo}: fecha vacía o futura.`);
    profs = (profs || []).map(x => okv(x) ? Number(x) : null);
    if (profs.some(x => x !== null && x < 0)) throw new Error(`${n.codigo}: remanente negativo.`);
    if (okv(presionMed) && (presionMed < 0 || presionMed > 300)) throw new Error(`${n.codigo}: presión inválida.`);
    const eqId = equipoId || n.equipoId || null;
    let nota = '';
    if (registrarLectura && okv(lectura) && eqId) { try { await C.registrarLecturaFecha(C.eq(eqId), Number(lectura), fecha, 'medición de neumáticos'); } catch (e) { nota = `Lectura no registrada en el equipo: ${e.message}`; } }
    const rec = Object.assign({ sesionId: sesionId || EQ.DB.uid(), fecha, equipoId: eqId, lectura: okv(lectura) ? Number(lectura) : null, neumaticoId: n.id, posicion: posicion || n.posicion || '', presionMed: okv(presionMed) ? Number(presionMed) : null, presionRec: okv(presionRec) ? Number(presionRec) : (n.presionRec || null), profs, condiciones: condiciones || [], observaciones: [observaciones, nota].filter(Boolean).join(' · '), inspector: inspector || '', fotos: fotos || [], ciclo: n.ciclo || 0, usoNeumatico: C.usoNeumEnFecha(n, fecha, lectura, eqId) }, C.zonas(profs));
    await EQ.DB.put('inspecciones', rec, { noAudit: true });
    return { rec, nota };
  };
  C.presionEstado = (med, rec, tol) => {
    if (med === null || med === undefined || med === '' || !rec) return { estado: 'Sin inspección', cls: 'gris', diff: null, pct: null };
    const diff = Number(med) - Number(rec), pct = diff / Number(rec) * 100;
    if (pct < -tol) return { estado: 'Presión baja', cls: 'rojo', diff, pct };
    if (pct > tol) return { estado: 'Presión alta', cls: 'amarillo', diff, pct };
    return { estado: 'Presión normal', cls: 'verde', diff, pct };
  };

  const memo = { rev: -1, day: '', neu: new Map(), alertas: null };
  const memoOk = () => { if (memo.rev !== EQ.DB.meta.rev || memo.day !== U.today()) { memo.rev = EQ.DB.meta.rev; memo.day = U.today(); memo.neu.clear(); memo.alertas = null; } };
  C.analisisNeum = n => {
    memoOk();
    const key = n.id + '|' + (n.actualizado || '') + '|' + (n.posicion || '') + '|' + (n.equipoId || '');
    if (memo.neu.has(key)) return memo.neu.get(key);
    const r = analisisNeum(n); memo.neu.set(key, r); return r;
  };
  const analisisNeum = n => {
    const th = C.th();
    const eq = n.equipoId ? C.eq(n.equipoId) : null;
    const lim = C.limites(n);
    const ins = C.inspNeum(n);
    const insConProf = ins.filter(i => C.profProm(i) !== null);
    const last = ins[ins.length - 1] || null;
    const lastP = insConProf[insConProf.length - 1] || null;
    const lastPres = [...ins].reverse().find(i => i.presionMed !== null && i.presionMed !== undefined && i.presionMed !== '') || null;
    const profIni = Number(n.profInicial) || null;
    const r = { eq, lim, inspecciones: ins, ultima: last, profInicial: profIni, profActual: lastP ? C.profProm(lastP) : profIni, desgMm: null, desgPct: null, tasa: null, vidaRest: null, vidaRestHoy: null, fechaReemplazo: null, suficiente: false, motivoInsuf: '', patrones: lastP ? C.patrones(lastP) : (last ? C.patrones(last) : []) };
    r.uso = C.usoNeum(n);
    r.usoCiclo = r.uso - (Number(n.usoInicioCiclo) || 0);
    r.unidad = n.unidadUso || C.unidad(eq);
    if (profIni && lastP) { r.desgMm = profIni - r.profActual; r.desgPct = r.desgMm / profIni * 100; }
    else if (profIni) { r.desgMm = 0; r.desgPct = 0; }
    // proyección
    r.unidadVida = r.unidad;
    if (!profIni) r.motivoInsuf = 'Falta profundidad inicial';
    else if (insConProf.length < th.minInspecciones) r.motivoInsuf = `Se requieren ≥ ${th.minInspecciones} mediciones de cocada (hay ${insConProf.length})`;
    else {
      const tieneUso = okv(lastP.usoNeumatico);
      const usoIns = (Number(lastP.usoNeumatico) || 0) - (Number(n.usoInicioCiclo) || 0);
      const fRef = n.fechaInicioCiclo || n.fechaInst || (insConProf[0] && insConProf[0].fecha);
      const dIns = fRef ? U.daysBetween(fRef, lastP.fecha) : 0;
      r.unidadVida = r.unidad;
      if (!(r.desgMm > 0)) r.motivoInsuf = 'Sin desgaste medible aún';
      else if (lim.profRetiro === null) r.motivoInsuf = 'Falta profundidad de retiro';
      else if ((!tieneUso || usoIns < th.minUsoProyeccion) && dIns >= 7) {
        // Proyección por calendario (remanentes cargados sin horómetro/km)
        r.suficiente = true; r.porDias = true; r.unidadVida = 'días';
        r.tasaDia = r.desgMm / dIns;
        r.vidaRest = Math.max(0, (r.profActual - lim.profRetiro) / r.tasaDia);
        r.vidaRestHoy = Math.max(0, r.vidaRest - Math.max(0, U.daysBetween(lastP.fecha, U.today())));
        r.vidaTotal = dIns + r.vidaRest;
        if (n.posicion && !C.isRep(n.posicion)) r.fechaReemplazo = U.addDays(lastP.fecha, r.vidaRest);
      }
      else if (!tieneUso || usoIns < th.minUsoProyeccion) r.motivoInsuf = tieneUso ? `Uso insuficiente (${U.num(usoIns)} ${r.unidad} < ${th.minUsoProyeccion})` : 'Sin horómetro/km ni fecha de instalación suficientes';
      else {
        r.suficiente = true;
        r.tasa = r.desgMm / usoIns;
        r.vidaRest = Math.max(0, (r.profActual - lim.profRetiro) / r.tasa);
        r.vidaRestHoy = Math.max(0, r.vidaRest - Math.max(0, r.usoCiclo - usoIns));
        r.vidaTotal = usoIns + r.vidaRest;
        if (eq && n.posicion && !C.isRep(n.posicion)) {
          const ud = C.usoDia(eq);
          if (ud > 0) r.fechaReemplazo = U.addDays(U.today(), r.vidaRestHoy / ud);
        }
      }
    }
    // presión
    const tol = C.tolPresion(n, eq);
    r.tol = tol;
    r.presion = lastPres ? C.presionEstado(lastPres.presionMed, lastPres.presionRec || n.presionRec, tol) : C.presionEstado(null, null, tol);
    r.diasSinInsp = last ? U.daysBetween(last.fecha, U.today()) : null;
    r.inspVencida = !!(n.posicion && (!last || r.diasSinInsp > th.inspeccionDias));
    // estado de desgaste
    const crit = C.cfg().condicionesCriticas || [];
    const hasCrit = r.patrones.some(p => crit.includes(p));
    if (!lastP && !last) r.estadoDesg = 'gris';
    else if ((lim.profRetiro !== null && r.profActual !== null && r.profActual <= lim.profRetiro) || (r.desgPct !== null && r.desgPct >= th.desgasteCriticoPct) || hasCrit) r.estadoDesg = 'rojo';
    else if ((lim.profAlerta !== null && r.profActual !== null && r.profActual <= lim.profAlerta) || r.patrones.length || n.estado === 'En observación') r.estadoDesg = 'amarillo';
    else r.estadoDesg = 'verde';
    r.critico = r.estadoDesg === 'rojo';
    r.irregular = r.patrones.length > 0;
    // costos
    const movs = S.movimientos.filter(m => m.neumaticoId === n.id);
    const mr = C.monNeum();
    r.moneda = mr;
    r.costoAdq = C.conv(n.costo, n.monedaCosto || C.monBase(), mr);
    r.costoMant = movs.reduce((s, m) => s + C.conv(m.costo, m.monedaCosto || C.monBase(), mr), 0);
    r.costoTotal = r.costoAdq + r.costoMant;
    r.costoUso = r.uso > 0 ? r.costoTotal / r.uso : null;
    r.proxReemplazo = !!(r.fechaReemplazo && U.daysBetween(U.today(), r.fechaReemplazo) <= th.diasProxReemplazo);
    return r;
  };
  C.DESG_LBL = { verde: 'Normal', amarillo: 'En observación', rojo: 'Crítico', gris: 'Sin inspección' };

  C.registrarMovimiento = (n, tipo, data) => EQ.DB.put('movimientos', Object.assign({ neumaticoId: n.id, tipo, fecha: U.today() }, data));

  // ======================= ALERTAS =======================
  C.alertas = () => {
    memoOk();
    if (memo.alertas) return memo.alertas.map(a => Object.assign({}, a, { atendida: (S.alertasAtendidas.find(x => x.key === a.key) || null) }));
    const out = [];
    const th = C.th();
    const add = a => out.push(a);
    const mesHoy = C.mesDe(U.today());
    const prog = new Map(C.programaMes(mesHoy).map(f => [f.eq.id, f.dias]));
    C.equiposActivos().filter(C.movilizado).forEach(eq => {
      const pts = C.puntosEq(eq.id, true);
      // --- Programa de engrase EG/EP (programa mensual / PRIORID-ENGR) ---
      const aplE = C.engraseAplica(eq), aplN = C.neumAplica(eq);
      if (C.enPrograma(eq)) {
        const ds = C.diasSinEngrase(eq), u = C.ultimoEngrase(eq), lim = th.diasSinEngrase;
        if (ds === null) add({ key: `ENG-SINREG|${eq.id}`, prioridad: 'media', modulo: 'Engrase', tipo: 'Sin engrase registrado', equipoId: eq.id, titulo: `${eq.codigo}: sin engrase registrado`, detalle: 'No hay registros en el control diario ni fecha de inicio/movilización.' });
        else if (ds > lim) add({ key: `ENG-DIAS|${eq.id}|${u ? u.fecha : 'ini'}`, prioridad: ds > lim * 2 ? 'critica' : 'alta', modulo: 'Engrase', tipo: 'Días sin engrase', equipoId: eq.id, titulo: `${eq.codigo}: ${ds} días sin engrase`, detalle: u ? `Último: ${C.tipoEng(u.tipo).nombre} el ${U.fdate(u.fecha)} · límite ${lim} días` : `SIN ENGRASAR desde el inicio (${U.fdate(eq.fechaInicio)}) · límite ${lim} días` });
        const dias = prog.get(eq.id) || {};
        const noEj = Object.entries(dias).filter(([d]) => d < U.today() && !C.diarioEn(eq.id, d));
        if (noEj.length) add({ key: `ENG-NOEJ|${eq.id}|${mesHoy}|${noEj.length}`, prioridad: 'alta', modulo: 'Engrase', tipo: 'Programado no ejecutado', equipoId: eq.id, titulo: `${eq.codigo}: ${noEj.length} engrase(s) programado(s) no ejecutado(s) este mes`, detalle: noEj.slice(-5).map(([d, t]) => `${t} ${U.fdate(d)}`).join(', ') });
        if (dias[U.today()] && !C.diarioEn(eq.id, U.today())) add({ key: `ENG-HOY|${eq.id}|${U.today()}`, prioridad: 'media', modulo: 'Engrase', tipo: 'Programado hoy', equipoId: eq.id, titulo: `${eq.codigo}: ${C.tipoEng(dias[U.today()]).nombre} programado hoy`, detalle: 'Pendiente de registro en el control diario.' });
        if (!pts.length) add({ key: `ENG-SINCFG|${eq.id}`, prioridad: 'baja', modulo: 'Engrase', tipo: 'Equipo sin configuración', equipoId: eq.id, titulo: `${eq.codigo}: sin puntos de engrase configurados`, detalle: 'Opcional: configure los puntos para calcular consumo de grasa por EG/EP.' });
      }
      // --- Alertas por punto (horas/días) opcionales ---
      let sinBase = 0, sinFrec = 0;
      if (th.alertasPorPunto && aplE) pts.forEach(p => {
        const st = C.estadoPunto(p, eq);
        const ul = C.unidad(eq);
        if (st.estado === 'rojo') {
          const det = [st.restantes !== null ? `Excedido ${U.num(-st.restantes, 1)} ${ul}` : '', st.diasRest !== null && st.diasRest < 0 ? `Vencido hace ${-st.diasRest} día(s)` : '', st.motivo].filter(Boolean).join(' · ');
          add({ key: `ENG-VENC|${p.id}|${p.ultimoHorometro}|${p.ultimaFecha}`, prioridad: st.sobrePct >= th.engraseCriticoPct ? 'critica' : 'alta', modulo: 'Engrase', tipo: 'Punto de engrase vencido', equipoId: eq.id, puntoId: p.id, titulo: `${eq.codigo} · ${p.codigo} ${p.componente}: engrase vencido`, detalle: det });
        } else if (st.estado === 'amarillo') {
          add({ key: `ENG-PROX|${p.id}|${p.ultimoHorometro}|${p.ultimaFecha}`, prioridad: 'media', modulo: 'Engrase', tipo: 'Punto de engrase próximo', equipoId: eq.id, puntoId: p.id, titulo: `${eq.codigo} · ${p.codigo} ${p.componente}: próximo a vencer`, detalle: [st.restantes !== null ? `Restan ${U.num(st.restantes, 1)} ${ul}` : '', st.diasRest !== null ? `${st.diasRest} día(s)` : ''].filter(Boolean).join(' · ') });
        } else if (st.estado === 'gris') { if (st.label === 'Sin línea base') sinBase++; else sinFrec++; }
      });
      if (sinBase) add({ key: `ENG-BASE|${eq.id}|${sinBase}`, prioridad: 'baja', modulo: 'Engrase', tipo: 'Equipo sin configuración', equipoId: eq.id, titulo: `${eq.codigo}: ${sinBase} punto(s) sin línea base`, detalle: 'Registre el primer engrase o establezca la línea base con el horómetro actual.' });
      if (sinFrec) add({ key: `ENG-FREC|${eq.id}|${sinFrec}`, prioridad: 'baja', modulo: 'Engrase', tipo: 'Equipo sin configuración', equipoId: eq.id, titulo: `${eq.codigo}: ${sinFrec} punto(s) sin frecuencia`, detalle: 'Configure la frecuencia en horas o días.' });
      if (!aplN) return;
      if (eq.layoutNeum === null || eq.layoutNeum === undefined) add({ key: `NEU-SINCFG|${eq.id}`, prioridad: 'baja', modulo: 'Neumáticos', tipo: 'Equipo sin configuración', equipoId: eq.id, titulo: `${eq.codigo}: distribución de neumáticos no configurada`, detalle: 'Defina ejes y posiciones en Control de Neumáticos.' });
      else {
        const posList = C.posiciones(eq.layoutNeum).filter(p => !p.repuesto);
        const vac = posList.filter(p => !C.neumEnPos(eq.id, p.pos)).length;
        if (vac && posList.length) add({ key: `NEU-VAC|${eq.id}|${vac}`, prioridad: 'baja', modulo: 'Neumáticos', tipo: 'Posiciones vacías', equipoId: eq.id, titulo: `${eq.codigo}: ${vac} posición(es) sin neumático registrado`, detalle: 'Instale o registre los neumáticos de esas posiciones.' });
      }
      let sinInsp = 0;
      C.neumEq(eq.id).forEach(n => {
        const a = C.analisisNeum(n);
        const ref = a.ultima ? a.ultima.id : 'x';
        if (a.critico) add({ key: `NEU-CRIT|${n.id}|${ref}`, prioridad: 'critica', modulo: 'Neumáticos', tipo: 'Desgaste crítico', equipoId: eq.id, neumaticoId: n.id, titulo: `${eq.codigo} · ${C.posLabel(eq, n.posicion)} · ${n.codigo}: neumático crítico`, detalle: `Cocada ${U.num(a.profActual, 1)} mm · desgaste ${U.num(a.desgPct, 0)}% ${a.patrones.length ? '· ' + a.patrones.join(', ') : ''}` });
        else if (a.irregular) add({ key: `NEU-IRR|${n.id}|${ref}`, prioridad: 'alta', modulo: 'Neumáticos', tipo: 'Desgaste irregular', equipoId: eq.id, neumaticoId: n.id, titulo: `${eq.codigo} · ${C.posLabel(eq, n.posicion)} · ${n.codigo}: desgaste anormal`, detalle: a.patrones.join(', ') });
        else if (a.estadoDesg === 'amarillo') add({ key: `NEU-OBS|${n.id}|${ref}`, prioridad: 'media', modulo: 'Neumáticos', tipo: 'Neumático en observación', equipoId: eq.id, neumaticoId: n.id, titulo: `${eq.codigo} · ${n.codigo}: en observación`, detalle: `Cocada ${U.num(a.profActual, 1)} mm` });
        if (a.proxReemplazo && !a.critico) add({ key: `NEU-REEMP|${n.id}|${ref}`, prioridad: 'alta', modulo: 'Neumáticos', tipo: 'Próximo a reemplazo', equipoId: eq.id, neumaticoId: n.id, titulo: `${eq.codigo} · ${n.codigo}: reemplazo estimado ${U.fdate(a.fechaReemplazo)}`, detalle: `Vida restante ${U.num(a.vidaRestHoy, 0)} ${a.unidadVida}` });
        if (a.presion.cls === 'rojo' || a.presion.cls === 'amarillo') add({ key: `NEU-PRES|${n.id}|${ref}`, prioridad: Math.abs(a.presion.pct) >= th.presionCriticaPct ? 'alta' : 'media', modulo: 'Neumáticos', tipo: 'Presión fuera de rango', equipoId: eq.id, neumaticoId: n.id, titulo: `${eq.codigo} · ${C.posLabel(eq, n.posicion)} · ${n.codigo}: ${a.presion.estado.toLowerCase()}`, detalle: `Diferencia ${a.presion.diff > 0 ? '+' : ''}${U.num(a.presion.diff, 1)} PSI (${U.num(a.presion.pct, 1)}%, tolerancia ±${a.tol}%)` });
        if (a.inspVencida && !C.isRep(n.posicion)) sinInsp++;
      });
      if (sinInsp) add({ key: `NEU-INSP|${eq.id}|${sinInsp}|${U.today()}`, prioridad: 'baja', modulo: 'Neumáticos', tipo: 'Inspección pendiente', equipoId: eq.id, titulo: `${eq.codigo}: ${sinInsp} neumático(s) con inspección pendiente`, detalle: `Sin inspección en los últimos ${th.inspeccionDias} días.` });
    });
    const att = new Map(S.alertasAtendidas.map(a => [a.key, a]));
    out.forEach(a => { a.atendida = att.get(a.key) || null; a.eq = C.eq(a.equipoId); });
    const ord = { critica: 0, alta: 1, media: 2, baja: 3 };
    out.sort((a, b) => ord[a.prioridad] - ord[b.prioridad] || String(a.titulo).localeCompare(b.titulo));
    memo.alertas = out;
    return out.map(a => Object.assign({}, a));
  };
  C.PRIO_LBL = { critica: 'Crítica', alta: 'Alta', media: 'Media', baja: 'Baja' };

  // ======================= PROGRAMACIÓN =======================
  C.programacion = (desde, hasta) => {
    const ev = [];
    const sinBase = [];
    const th = C.th();
    const meses = []; for (let m = C.mesDe(desde); m <= C.mesDe(hasta); m = C.mesDe(U.addDays(m + '-28', 5))) meses.push(m);
    const progs = new Map(meses.map(m => [m, new Map(C.programaMes(m).map(f => [f.eq.id, f.dias]))]));
    C.equiposActivos().filter(C.movilizado).forEach(eq => {
      meses.forEach(m => {
        const dias = progs.get(m).get(eq.id) || {};
        Object.entries(dias).forEach(([d, t]) => {
          if (d < desde || d > hasta) return;
          const ej = C.diarioEn(eq.id, d);
          ev.push({ fecha: d, tipo: 'engrase', eq, tipoEng: t, ejecutado: !!ej, vencido: d < U.today() && !ej, horas: C.tipoEng(t).horas || 0, gramos: C.puntosDeTipo(eq, t).reduce((s, p) => s + (Number(p.gramos) || 0), 0) });
        });
      });
      const tires = C.neumAplica(eq) ? C.neumEq(eq.id).filter(n => !C.isRep(n.posicion)) : [];
      if (tires.length) {
        let last = null;
        tires.forEach(n => { const i = C.inspNeum(n, false); const l = i.length ? i[i.length - 1].fecha : null; if (!l) last = '0000-00-00'; else if (last === null || l < last) last = l; });
        let d = last === '0000-00-00' || !last ? U.today() : U.addDays(last, th.inspeccionDias);
        const venc = d < U.today();
        if (d < U.today()) d = U.today();
        let k = 0;
        while (d <= hasta && k < 60) {
          if (d >= desde) ev.push({ fecha: d, tipo: 'inspeccion', eq, cantidad: tires.length, vencido: k === 0 && venc });
          d = U.addDays(d, th.inspeccionDias); k++;
        }
      }
    });
    ev.sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : String(a.eq.codigo).localeCompare(String(b.eq.codigo)));
    return { eventos: ev, sinBase };
  };

  // ======================= KPIs =======================
  C.kpis = () => {
    const mk = U.monthKey(U.today());
    const eqs = C.equiposActivos();
    const k = { puntos: 0, verde: 0, amarillo: 0, rojo: 0, gris: 0, ejecutadosMes: 0, cumplimiento: null, consumoMesKg: 0, equiposCriticos: 0,
      neumInstalados: 0, neumOperativos: 0, neumObservacion: 0, neumCriticos: 0, presionFuera: 0, desgProm: null, costoNeum: 0, proxReemplazo: 0, neumTotal: S.neumaticos.length };
    const critEq = new Set();
    eqs.filter(C.engraseAplica).forEach(eq => {
      C.puntosEq(eq.id, true).forEach(p => { k.puntos++; const st = C.estadoPunto(p, eq); k[st.estado]++; if (st.estado === 'rojo' && C.th().alertasPorPunto) critEq.add(eq.id); });
    });
    const ejec = new Set(S.engrases.filter(r => U.monthKey(r.fecha) === mk && r.resultado === 'Ejecutado').map(r => r.puntoId));
    k.ejecutadosMes = ejec.size;
    const base = k.verde + k.amarillo + k.rojo;
    k.cumplimiento = base ? (k.verde + k.amarillo) / base * 100 : null;
    k.consumoMesKg = C.consumo({ desde: mk + '-01', hasta: mk + '-31' }).totalKg;
    const desg = [];
    S.neumaticos.forEach(n => {
      const a = C.analisisNeum(n);
      k.costoNeum += a.costoTotal;
      if (n.equipoId && n.posicion && n.estado !== 'Baja definitiva' && C.neumAplica(C.eq(n.equipoId))) {
        k.neumInstalados++;
        if (a.critico) { k.neumCriticos++; critEq.add(n.equipoId); }
        else if (a.estadoDesg === 'amarillo' || n.estado === 'En observación') k.neumObservacion++;
        if (!a.critico && n.estado !== 'En reparación') k.neumOperativos++;
        if (a.presion.cls === 'rojo' || a.presion.cls === 'amarillo') k.presionFuera++;
        if (a.desgPct !== null && a.ultima) desg.push(a.desgPct);
        if (a.proxReemplazo || a.critico) k.proxReemplazo++;
      }
    });
    k.desgProm = desg.length ? desg.reduce((a, b) => a + b, 0) / desg.length : null;
    // programa EG/EP
    const cm = C.cumplimientoMesPrograma(mk, true);
    k.cumplimientoProg = cm.pct; k.progMes = cm.prog; k.ejecMes = cm.eje;
    const dm = S.engrasesDiarios.filter(d => U.monthKey(d.fecha) === mk);
    k.egMes = dm.filter(d => d.tipo === 'EG').length; k.epMes = dm.filter(d => d.tipo === 'EP').length;
    const hoy = C.programaMes(mk);
    k.pendHoy = hoy.filter(f => f.dias[U.today()] && !C.diarioEn(f.eq.id, U.today())).length;
    k.progHoy = hoy.filter(f => f.dias[U.today()]).length;
    k.excedidos = 0; k.equiposPrograma = C.equiposPrograma().length;
    C.equiposPrograma().forEach(eq => { const d = C.diasSinEngrase(eq); if (d !== null && d > C.th().diasSinEngrase) { k.excedidos++; critEq.add(eq.id); } });
    k.equiposCriticos = [...critEq].filter(id => C.eq(id) && C.eq(id).activo !== false).length;
    k.critEq = critEq;
    return k;
  };

  C.prioridadEquipos = (alertas) => {
    alertas = alertas || C.alertas().filter(a => !a.atendida);
    const w = { critica: 10, alta: 5, media: 2, baja: 0.5 };
    const m = {};
    alertas.forEach(a => { if (!a.equipoId) return; if (!m[a.equipoId]) m[a.equipoId] = { eq: a.eq, score: 0, n: { critica: 0, alta: 0, media: 0, baja: 0 }, motivos: new Set() }; m[a.equipoId].score += w[a.prioridad]; m[a.equipoId].n[a.prioridad]++; if (a.prioridad !== 'baja') m[a.equipoId].motivos.add(a.tipo); });
    return Object.values(m).filter(x => x.score >= 2).sort((a, b) => b.score - a.score);
  };

  EQ.C = C;
})();
