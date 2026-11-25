/* IMPORTACIÓN / EXPORTACIÓN DEL EXCEL "PROGRAMA DE ENGRASE"
   Hojas reconocidas: MAESTRO · hoja del programa mensual EG/EP · CONTROL DIARIO · (CUMPLIMIENTO y PRIORID-ENGR se recalculan)
   La exportación genera el mismo libro con los datos de la aplicación. */
(function () {
  const U = EQ.U, S = EQ.S, C = EQ.C;
  const X = {};
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  X.toISO = v => {
    if (v === null || v === undefined || v === '') return '';
    if (v instanceof Date) return U.xlDate(v);
    return EQ.Backlog.toDate(v);
  };
  const aoaOf = ws => XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });

  // ---------- Lectura del libro ----------
  X.parse = async file => {
    const wb = XLSX.read(await U.readFileBuffer(file), { type: 'array', cellDates: true });
    const out = { file: file.name, maestro: null, programa: null, control: null, empresa: '', warnings: [] };
    // MAESTRO
    const ms = wb.SheetNames.map(n => ({ n, r: EQ.Backlog.sheetRows(wb.Sheets[n]) })).filter(x => x.r.rows.length).sort((a, b) => (b.r.score + (/maestro/i.test(b.n) ? 5 : 0)) - (a.r.score + (/maestro/i.test(a.n) ? 5 : 0)));
    const m = ms.find(x => /maestro/i.test(x.n)) || (ms[0] && ms[0].r.score >= 4 ? ms[0] : null);
    if (m) {
      const map = EQ.Backlog.autoMap(m.r.keys);
      if (map.codigo) out.maestro = { hoja: m.n, map, filas: EQ.Backlog.mapRows(m.r.rows, map) };
    }
    // PROGRAMA MENSUAL EG/EP
    for (const n of wb.SheetNames) {
      const aoa = aoaOf(wb.Sheets[n]);
      const hi = aoa.findIndex(r => r.some(c => norm(c) === 'cod') && r.some(c => norm(c).startsWith('totaleg')));
      if (hi < 0) continue;
      const head = aoa[hi];
      const cCod = head.findIndex(c => norm(c) === 'cod'), cTot = head.findIndex(c => norm(c).startsWith('totaleg'));
      let fd = null, fc = -1;
      for (let r = hi - 1; r >= Math.max(0, hi - 4) && fc < 0; r--) for (let c = cCod + 1; c < cTot; c++) { const v = aoa[r][c]; if (v instanceof Date || (typeof v === 'number' && v > 40000 && v < 80000)) { fd = X.toISO(v); fc = c; break; } }
      if (fc < 0) { out.warnings.push(`Hoja ${n}: no se encontró la fila de fechas del programa.`); continue; }
      const mes = fd.slice(0, 7);
      const filas = [];
      for (let r = hi + 1; r < aoa.length; r++) {
        const cod = String(aoa[r][cCod] || '').trim();
        if (!cod || /leyenda|nota/i.test(cod) || C.tiposEng().some(x => x.codigo === cod.toUpperCase())) continue;
        const dias = {};
        for (let c = fc; c < cTot; c++) { const t = String(aoa[r][c] || '').trim().toUpperCase(); if (!t) continue; const d = U.addDays(fd, c - fc); if (d.slice(0, 7) !== mes) continue; if (C.tiposEng().some(x => x.codigo === t)) dias[d] = t; }
        filas.push({ cod, dias });
      }
      const empresa = aoa.slice(0, hi).flat().find(v => typeof v === 'string' && /SISTEMA|GESTI/i.test(v));
      out.empresa = empresa || '';
      out.programa = { hoja: n, mes, filas: filas.filter(f => Object.keys(f.dias).length || true) };
      break;
    }
    // CONTROL DIARIO
    for (const n of wb.SheetNames) {
      const aoa = aoaOf(wb.Sheets[n]);
      const hi = aoa.findIndex(r => r.some(c => norm(c).startsWith('fecha')) && r.some(c => norm(c).includes('tipodeengrase') || norm(c) === 'tipo') && r.some(c => ['cod', 'codigo', 'codint', 'codigointerno'].includes(norm(c))));
      if (hi < 0) continue;
      const h = aoa[hi].map(norm);
      const ci = h.findIndex(x => ['cod', 'codigo', 'codint', 'codigointerno'].includes(x)), fi = h.findIndex(x => x.startsWith('fecha')), hoi = h.findIndex(x => x.startsWith('horo') || x === 'km' || x.startsWith('hrkm')), ti = h.findIndex(x => x.includes('tipodeengrase') || x === 'tipo'), tci = h.findIndex(x => x.startsWith('tecnico')), oi = h.findIndex(x => x.startsWith('observ'));
      const regs = [];
      aoa.slice(hi + 1).forEach(r => {
        const cod = String(r[ci] || '').trim(), f = X.toISO(r[fi]), tt = String(r[ti] || '').toUpperCase();
        if (!cod || !f) return;
        const tipo = /GENERAL/.test(tt) ? 'EG' : /PARCIAL/.test(tt) ? 'EP' : (C.tiposEng().find(x => x.codigo === tt.trim()) || {}).codigo || '';
        regs.push({ cod, fecha: f, horometro: U.toNum(r[hoi]), tipo, tecnico: tci >= 0 ? String(r[tci] || '') : '', observaciones: oi >= 0 ? String(r[oi] || '') : '' });
      });
      out.control = { hoja: n, regs };
      break;
    }
    return out;
  };

  // Deduce el plan (secuencia, intervalo, ancla) a partir de las marcas de un mes
  X.inferirPlan = dias => {
    const ds = Object.keys(dias).sort();
    if (!ds.length) return null;
    const tipos = ds.map(d => dias[d]);
    let intervalo = 7;
    if (ds.length >= 2) {
      const diffs = ds.slice(1).map((d, i) => U.daysBetween(ds[i], d));
      const freq = {}; diffs.forEach(x => freq[x] = (freq[x] || 0) + 1);
      const top = Object.entries(freq).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
      intervalo = top[1] > 1 || diffs.length === 1 ? +top[0] : Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
    }
    let per = tipos.length;
    for (let p = 1; p <= Math.min(4, tipos.length); p++) if (tipos.every((t, i) => t === tipos[i % p])) { per = p; break; }
    return { secuencia: tipos.slice(0, Math.min(per, 4)), intervalo, ancla: ds[0] };
  };

  // ---------- Diálogo de importación ----------
  X.importarDialog = async () => {
    const f = await U.pickFile('.xlsx,.xlsm,.xls');
    if (!f) return;
    let d;
    try { d = await X.parse(f); } catch (e) { U.toast('No se pudo leer el Excel: ' + e.message, 'bad'); return; }
    if (EQ.DB.host()) d.maestro = null; // un solo maestro: Mantify → Equipos
    if (!d.maestro && !d.programa && !d.control) { U.toast('El archivo no tiene hojas MAESTRO, PROGRAMA ni CONTROL DIARIO reconocibles.', 'bad'); return; }
    const pm = d.maestro ? EQ.Backlog.previewMerge(d.maestro.filas) : null;
    const codeOk = cod => C.eqByCode(cod) || (d.maestro && d.maestro.filas.some(o => o.codigo.toUpperCase() === String(cod).toUpperCase()));
    const progF = d.programa ? d.programa.filas : [];
    const ctrl = d.control ? d.control.regs : [];
    const marks = progF.reduce((s, x) => s + Object.keys(x.dias).length, 0);
    U.modal({ title: `Importar ${d.file}`, size: 'lg', body: `
      ${d.maestro ? `<label class="flex mb"><input type="checkbox" id="iM" checked> <b>MAESTRO</b> (hoja ${U.esc(d.maestro.hoja)}): ${d.maestro.filas.length} equipos · ${pm.nuevos.length} nuevos · ${pm.actualiza.length} a actualizar · ${pm.dup.length} duplicados omitidos</label>
        <div class="small muted mb" style="margin-left:24px">Columnas: ${Object.entries(d.maestro.map).map(([k, v]) => `${k} ← "${U.esc(String(v).replace(/\n/g, ' '))}"`).join(' · ')}</div>` : '<div class="muted mb">Sin hoja MAESTRO.</div>'}
      ${d.programa ? `<label class="flex mb"><input type="checkbox" id="iP" checked> <b>PROGRAMA ${U.esc(EQ.EngProg.nombreMes(d.programa.mes))}</b> (hoja ${U.esc(d.programa.hoja)}): ${progF.length} equipos · ${marks} marcas EG/EP${progF.filter(x => !codeOk(x.cod)).length ? ` · <span style="color:var(--bad)">${progF.filter(x => !codeOk(x.cod)).length} códigos no encontrados</span>` : ''}</label>
        <label class="flex mb" style="margin-left:24px"><input type="checkbox" id="iPl" checked> Deducir el plan de cada equipo (secuencia e intervalo) para generar los meses siguientes</label>` : '<div class="muted mb">Sin hoja de programa.</div>'}
      <label class="flex mb"><input type="checkbox" id="iTp"> Crear puntos de engrase desde las plantillas por familia en equipos sin puntos (opcional, para calcular consumo de grasa por EG/EP)</label>
      ${d.control ? `<label class="flex mb"><input type="checkbox" id="iC" checked> <b>CONTROL DIARIO</b>: ${ctrl.length} registros${ctrl.filter(x => !codeOk(x.cod)).length ? ` · ${ctrl.filter(x => !codeOk(x.cod)).length} con código no encontrado` : ''}</label>` : '<div class="muted mb">Sin hoja CONTROL DIARIO.</div>'}
      ${d.warnings.length ? `<div class="warn-box">${d.warnings.map(U.esc).join('<br>')}</div>` : ''}
      <div class="info-box mt">Los equipos se sincronizan por CÓDIGO INTERNO (no se duplican). El programa importado se guarda tal cual para ese mes. Los registros del control diario ya existentes (mismo código y fecha) se omiten.</div>`,
      buttons: [{ label: 'Cancelar', cls: 'btn-outline' }, { label: 'Importar', cls: 'btn-orange', onClick: async m => {
        const res = [];
        const cfg = C.cfg();
        if (d.empresa) { cfg.formato = Object.assign({}, cfg.formato, { empresa: d.empresa }); await EQ.DB.put('config', cfg, { noAudit: true }); }
        if (d.maestro && m.querySelector('#iM').checked) { const r = await EQ.Backlog.applyImport(d.maestro.filas, 'Excel ' + d.file); res.push(`Maestro: ${r.nuevos} nuevos, ${r.actualizados} actualizados`); }
        if (d.programa && m.querySelector('#iP').checked) {
          const recs = []; let np = 0, miss = [];
          let item = 0;
          for (const fila of progF) {
            const eq = C.eqByCode(fila.cod); if (!eq) { miss.push(fila.cod); continue; }
            item++;
            recs.push({ id: `${d.programa.mes}|${eq.id}`, mes: d.programa.mes, equipoId: eq.id, item, dias: fila.dias, manual: true, origen: 'Excel' });
            let ch = eq.ordenPrograma !== item; eq.ordenPrograma = item;
            if (!C.enPrograma(eq)) { eq.enPrograma = true; ch = true; }
            if (m.querySelector('#iPl').checked) { const pl = X.inferirPlan(fila.dias); if (pl) { eq.planEngrase = pl; ch = true; np++; } }
            if (ch) await EQ.DB.put('equipos', eq, { motivo: 'Importación programa de engrase' });
          }
          if (recs.length) await EQ.DB.bulkPut('programas', recs, { motivo: 'Importación programa ' + d.programa.mes });
          EQ.App.state.prog2 = Object.assign(EQ.App.state.prog2 || {}, { mes: d.programa.mes });
          res.push(`Programa ${d.programa.mes}: ${recs.length} equipos, ${np} planes deducidos${miss.length ? `, no encontrados: ${miss.join(', ')}` : ''}`);
        }
        if (m.querySelector('#iTp').checked) { let n = 0; for (const e of C.equiposActivos().filter(e => !S.puntos.some(p => p.equipoId === e.id))) n += await EQ.Views.engrase.aplicarPlantilla(e, e.familia, true); res.push(`${n} puntos de engrase creados desde plantillas`); }
        if (d.control && m.querySelector('#iC').checked) {
          let ok = 0, dup = 0, err = 0; const errs = [];
          for (const r of ctrl.sort((a, b) => a.fecha < b.fecha ? -1 : 1)) {
            const eq = C.eqByCode(r.cod); if (!eq) { err++; errs.push(`${r.cod}: código no encontrado`); continue; }
            if (C.diarioEn(eq.id, r.fecha)) { dup++; continue; }
            if (!r.tipo) { err++; errs.push(`${r.cod} ${r.fecha}: tipo de engrase no reconocido`); continue; }
            try { await C.registrarDiario({ eq, fecha: r.fecha, horometro: r.horometro, tipo: r.tipo, tecnico: r.tecnico, observaciones: r.observaciones }); ok++; }
            catch (e) { try { await C.registrarDiario({ eq, fecha: r.fecha, horometro: null, tipo: r.tipo, tecnico: r.tecnico, observaciones: [r.observaciones, `Horómetro ${r.horometro} no registrado: ${e.message}`].filter(Boolean).join(' · ') }); ok++; errs.push(`${r.cod} ${U.fdate(r.fecha)}: horómetro omitido (${e.message})`); } catch (e2) { err++; errs.push(`${r.cod} ${r.fecha}: ${e2.message}`); } }
          }
          res.push(`Control diario: ${ok} registrados, ${dup} ya existían, ${err} con error`);
          if (errs.length) setTimeout(() => U.modal({ title: 'Observaciones de la importación', body: `<ul class="small">${errs.slice(0, 100).map(e => `<li>${U.esc(e)}</li>`).join('')}</ul>`, buttons: [{ label: 'Cerrar', cls: 'btn-outline' }] }), 300);
        }
        await EQ.DB.audit('sistema', '*', 'Importación Excel programa de engrase', res.join(' | '));
        U.toast(res.join(' · '), 'ok');
        EQ.App.state.tab.engrase = 'programa'; EQ.App.go('engrase');
      } }] });
  };

  // ---------- Exportación en el formato del libro ----------
  const cell = (v, z) => (v instanceof Date ? { t: 'd', v, z: z || 'dd/mm/yyyy' } : v);
  const dt = s => U.parseDate(s) || '';
  const colL = i => XLSX.utils.encode_col(i);
  X.exportar = mes => {
    const cfg = C.cfg(), fmt = cfg.formato || {};
    const filas = C.programaMes(mes), dias = C.mesDias(mes), nD = dias.length;
    const c0 = 6; // columna G
    const last = c0 + nD + 3;
    const wb = XLSX.utils.book_new();
    // --- PROGRAMA ---
    const A = [];
    A[0] = [fmt.empresa || 'SISTEMA INTEGRADO DE GESTIÓN']; if (fmt.codigo) A[0][last - 1] = 'CODIGO: ' + fmt.codigo;
    A[1] = ['PROGRAMA DE ENGRASE']; A[1][last - 1] = 'VERSION: ' + (fmt.version || '01');
    A[2] = []; A[2][last - 1] = 'PAGINA:  1 DE 1';
    A[3] = [];
    A[4] = ['PROGRAMA DE ENGRASE MENSUAL DE ' + EQ.EngProg.nombreMes(mes).split(' ')[0]];
    A[5] = []; dias.forEach((d, i) => A[5][c0 + i] = cell(dt(d), 'dd'));
    A[6] = ['ITEM', 'COD.', 'PLACA', 'DESCRIPCION DE ACTIVO', 'Tipo de OT', 'T. Ejec'].concat(dias.map(d => ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][U.parseDate(d).getDay()])).concat(['TOTAL (EG)', 'TOTAL (EP)', 'ESTADO', 'CLASE']);
    const r0 = 7;
    filas.forEach((f, k) => {
      const row = [f.item, f.eq.codigo, f.eq.placa || '', f.eq.descripcion || '', 'MP', C.tipoEng('EG').horas].concat(dias.map(d => f.dias[d] || ''));
      const R = r0 + k + 1, rng = `${colL(c0)}${R}:${colL(c0 + nD - 1)}${R}`;
      row.push({ f: `COUNTIF(${rng},"EG")`, v: Object.values(f.dias).filter(x => x === 'EG').length }, { f: `COUNTIF(${rng},"EP")`, v: Object.values(f.dias).filter(x => x === 'EP').length }, f.eq.estadoMov || 'MOVILIZADO', f.eq.clase || '');
      A.push(row);
    });
    const tr = []; tr[c0 - 1] = 'TOTAL'; dias.forEach((d, i) => { const col = colL(c0 + i); tr[c0 + i] = { f: `COUNTA(${col}${r0 + 1}:${col}${r0 + filas.length})`, v: filas.filter(f => f.dias[d]).length }; });
    A.push(tr, [], ['LEYENDA'], ['EP', C.tipoEng('EP').nombre + ' PROGR.'], ['EG', C.tipoEng('EG').nombre + ' PROGR.'], [], [`NOTA: * TIEMPO APROXIMADO DE EJECUCION PARA EL ${C.tipoEng('EG').nombre} ES DE ${C.tipoEng('EG').horas} HR / ${C.tipoEng('EP').nombre} ${C.tipoEng('EP').horas} HR`]);
    const ws = XLSX.utils.aoa_to_sheet(A, { cellDates: true });
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: last - 2 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: last - 2 } }, { s: { r: 4, c: 0 }, e: { r: 4, c: last } }];
    ws['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 14 }, { wch: 26 }, { wch: 8 }, { wch: 6 }].concat(dias.map(() => ({ wch: 4 }))).concat([{ wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 20 }]);
    XLSX.utils.book_append_sheet(wb, ws, (fmt.codigo || 'PROGRAMA').slice(0, 31));
    // --- CONTROL DIARIO ---
    const ctrl = C.diarios().map((d, i) => { const eq = C.eq(d.equipoId) || {}; return [(eq.codigo || '') + U.fdate(d.fecha), i + 1, eq.codigo || '', cell(dt(d.fecha)), d.horometro === null ? '' : d.horometro, C.tipoEng(d.tipo).nombre, Math.max(0, U.daysBetween(d.fecha, U.today()) - 1), d.tecnico || '', d.observaciones || ''].concat((() => { const c = C.costoDiario(d); return [c.puntos, +c.kg.toFixed(3), c.grasa, c.precioPunto, c.precioKg, +c.costoPuntos.toFixed(2), +c.costoKg.toFixed(2), +c.tc.toFixed(3), +c.costoPuntosUSD.toFixed(2), +c.costoKgUSD.toFixed(2)]; })()); });
    const wc = XLSX.utils.aoa_to_sheet([[], ['CONTROL DIARIO DE ENGRASE'], [], ['KEY', 'ID', 'COD', 'FECHA REAL.', 'HORO.', 'TIPO DE ENGRASE', 'DIAS SIN ENGRASE', 'TECNICO', 'OBSERVACIONES', 'PUNTOS ENGRASADOS', 'GRASA (KG)', 'TIPO DE GRASA', 'PRECIO/PUNTO', 'PRECIO/KG', 'COSTO POR PUNTOS', 'COSTO POR KG', 'TIPO DE CAMBIO', 'COSTO POR PUNTOS US$', 'COSTO POR KG US$']].concat(ctrl), { cellDates: true });
    wc['!cols'] = [{ wch: 22 }, { wch: 6 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 18 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 24 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wc, 'CONTROL DIARIO');
    // --- CUMPLIMIENTO ---
    const hasta = mes === C.mesDe(U.today()) ? U.today() : null;
    const cum = filas.map(f => { const r = C.cumplimientoEq(mes, f.eq, f.dias, hasta); return [f.item, f.eq.codigo, f.eq.placa || '', f.eq.descripcion || '', 'MP'].concat(dias.map(d => { const e = C.diarioEn(f.eq.id, d); return e ? 'OK' + e.tipo : ''; })).concat([r.ejeEG, r.ejeEP, r.prog, r.pct === null ? '' : +(r.pct / 100).toFixed(4), f.eq.estadoMov || 'MOVILIZADO']); });
    const pr = cum.map(r => r[r.length - 2]).filter(v => v !== '');
    const wu = XLSX.utils.aoa_to_sheet([['CUMPLIMIENTO DE ENGRASE MENSUAL DE ' + EQ.EngProg.nombreMes(mes).split(' ')[0]], [], ['', '', '', '', ''].concat(dias.map(d => cell(dt(d), 'dd'))), ['ITEM', 'CODIGO', 'PLACA', 'DESCRIPCION DE ACTIVO', 'ESTADO'].concat(dias.map(() => 'TIPO ENGR.')).concat(['EG EJEC.', 'EP EJEC.', 'PROGRAMADOS', '% CUMPLIMIENTO', 'ESTADO'])].concat(cum).concat([[], ['CUMPLIMIENTO TOTAL', pr.length ? +(pr.reduce((a, b) => a + b, 0) / pr.length).toFixed(4) : '']]), { cellDates: true });
    const pc = 5 + nD + 3; for (let r = 4; r < 4 + cum.length; r++) { const a = XLSX.utils.encode_cell({ r, c: pc }); if (wu[a] && wu[a].t === 'n') wu[a].z = '0%'; }
    const tc = XLSX.utils.encode_cell({ r: 4 + cum.length + 1, c: 1 }); if (wu[tc]) wu[tc].z = '0.0%';
    XLSX.utils.book_append_sheet(wb, wu, 'CUMPLIMIENTO');
    // --- PRIORID-ENGR ---
    const pri = EQ.EngProg.filasPrioridad().map(r => [r.eq.codigo, r.eq.placa || '', r.eq.descripcion || '', r.eq.marca || '', r.eq.propietario || '', r.ultFecha ? cell(dt(r.ultFecha)) : '', r.ultTipo, r.dias === null ? '' : r.dias, r.eq.estadoMov || 'MOVILIZADO', r.eq.clase || '', r.exceso === null ? '' : r.exceso]);
    const wp = XLSX.utils.aoa_to_sheet([[], ['COD_INT.', 'PLACA', 'EQUIPO', 'MARCA', 'PROPIETARIO', 'ULTIMO ENGRASE REALIZADO', 'ULTIMO ENGRASE', 'DIAS SIN ENGRASE', 'ESTADO', 'CLASE', 'DIAS EXCEDIDOS']].concat(pri), { cellDates: true });
    XLSX.utils.book_append_sheet(wb, wp, 'PRIORID-ENGR');
    // --- MAESTRO ---
    let id = 0; const progIds = new Map(filas.map(f => [f.eq.id, f.item]));
    const ma = S.equipos.slice().sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true })).map(e => [progIds.get(e.id) || 0, e.codigo, e.placa || '', e.codAlterno || '', e.descripcion || '', e.marca || '', e.modelo || '', e.serie || '', e.serieMotor || '', e.anio || '', e.capacidad || '', e.clase || '', e.propietario || '', e.tipoContrato || '', e.estadoMov || 'MOVILIZADO', e.fechaInicio ? cell(dt(e.fechaInicio)) : '', e.horometro === null || e.horometro === undefined ? '' : e.horometro, e.fechaDesmov ? cell(dt(e.fechaDesmov)) : '', e.familia || '']);
    const wm = XLSX.utils.aoa_to_sheet([[], ['ID', 'CODIGO INTERNO', 'PLACA/SERIE', 'COD. ALTERNO', 'EQUIPO', 'MARCA', 'MODELO', 'SERIE DEL EQUIPO', 'SERIE DEL MOTOR', 'AÑO', 'CAP.', 'CLASE', 'PROPIETARIO', 'TIPO', 'ESTADO', 'FECHA DE INICIO', 'HR / KM ACTUAL', 'FECHA DESMOV.', 'FAMILIA (APP)']].concat(ma), { cellDates: true });
    XLSX.utils.book_append_sheet(wb, wm, 'MAESTRO');
    XLSX.writeFile(wb, `${fmt.codigo ? fmt.codigo + '_' : ''}Programa_de_Engrase_${mes}.xlsx`, { cellDates: true });
    EQ.DB.audit('sistema', '*', 'Exportación Excel', `Programa de engrase ${mes}`);
  };

  EQ.XL = X;
})();
