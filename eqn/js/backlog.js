/* =========================================================================
   INTEGRACIÓN CON EL MAESTRO DE EQUIPOS DEL BACKLOG
   - Importa desde archivo JSON / CSV / Excel exportado por la app Backlog.
   - Busca el maestro en este mismo navegador (localStorage / IndexedDB) si
     la app Backlog se ejecuta en el mismo origen (misma carpeta o dominio).
   - Sincroniza por CÓDIGO DE EQUIPO: actualiza los existentes, agrega los
     nuevos y nunca duplica.
   ========================================================================= */
(function () {
  const U = EQ.U, S = EQ.S;
  const B = {};
  B.CAMPOS = [
    { k: 'codigo', t: 'Código de equipo', req: true, syn: ['codigointerno', 'codint', 'cod_int', 'codigo', 'código', 'cod', 'code', 'codigoequipo', 'codequipo', 'cod_equipo', 'codigo_equipo', 'equipo_codigo', 'idequipo', 'id_equipo', 'tag', 'nrointerno', 'numerointerno', 'interno', 'equipmentid', 'unit'] },
    { k: 'descripcion', t: 'Descripción', syn: ['descripcion', 'descripción', 'descripciondeactivo', 'description', 'desc', 'nombre', 'name', 'denominacion', 'equipo', 'tipoequipo', 'tipo_equipo', 'equipo_nombre', 'equipment'] },
    { k: 'marca', t: 'Marca', syn: ['marca', 'brand', 'fabricante', 'make', 'manufacturer'] },
    { k: 'modelo', t: 'Modelo', syn: ['modelo', 'model'] },
    { k: 'serie', t: 'Serie', syn: ['seriedelequipo', 'serie', 'nserie', 'numserie', 'numeroserie', 'nro_serie', 'serial', 'serialnumber', 'vin', 'chasis'] },
    { k: 'placa', t: 'Placa', syn: ['placa', 'placaserie', 'plate', 'matricula'] },
    { k: 'familia', t: 'Familia / Tipo de equipo', syn: ['familia', 'family', 'equipo', 'tipoequipo', 'categoria', 'categoría', 'category', 'grupo', 'flota_tipo'] },
    { k: 'ubicacion', t: 'Ubicación', syn: ['ubicacion', 'ubicación', 'location', 'frente', 'area', 'área', 'proyecto', 'obra', 'sede', 'zona'] },
    { k: 'horometro', t: 'Horómetro / Km actual', syn: ['horometro', 'horómetro', 'horometroactual', 'horometro_actual', 'hrs', 'horas', 'hours', 'hourmeter', 'smu', 'kilometraje', 'km', 'odometro', 'odómetro', 'lectura', 'hrkminicio', 'hrkm'] },
    { k: 'estadoMov', t: 'Estado (movilizado / desmovilizado)', syn: ['estado', 'status', 'situacion', 'condicion', 'estadoequipo'] },
    { k: 'propietario', t: 'Propietario', syn: ['propietario', 'owner', 'dueño', 'proveedor'] },
    { k: 'clase', t: 'Clase', syn: ['clase', 'class'] },
    { k: 'tipoContrato', t: 'Tipo (directo / indirecto)', syn: ['tipo', 'type', 'tipocontrato'] },
    { k: 'anio', t: 'Año', syn: ['año', 'ano', 'anio', 'year', 'anofabricacion'] },
    { k: 'capacidad', t: 'Capacidad', syn: ['cap', 'capacidad', 'capacity', 'potencia'] },
    { k: 'serieMotor', t: 'Serie del motor', syn: ['seriedelmotor', 'seriemotor', 'motor', 'enginesn'] },
    { k: 'codAlterno', t: 'Código alterno', syn: ['codcoansa', 'codigoalterno', 'codalterno'] },
    { k: 'fechaInicio', t: 'Fecha de inicio / movilización', syn: ['fechadeinicio', 'fechainicio', 'fechamovilizacion', 'fechaingreso'] },
    { k: 'fechaDesmov', t: 'Fecha de desmovilización', syn: ['fechadesmov', 'fechadesmovilizacion', 'fechasalida'] }
  ];
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_]/g, '');

  // Busca arrays de objetos "tipo equipo" dentro de una estructura JSON
  B.findArrays = (data, path = '$', out = [], depth = 0) => {
    if (depth > 5 || data === null || data === undefined) return out;
    if (Array.isArray(data)) {
      const objs = data.filter(x => x && typeof x === 'object' && !Array.isArray(x));
      if (objs.length && objs.length >= data.length * 0.8) {
        const keys = new Set(); objs.slice(0, 50).forEach(o => Object.keys(o).forEach(k => keys.add(k)));
        const score = [...keys].reduce((s, k) => s + (B.CAMPOS.some(c => c.syn.includes(norm(k))) ? 1 : 0), 0);
        out.push({ path, rows: objs, keys: [...keys], score });
      }
      data.slice(0, 3).forEach((x, i) => { if (x && typeof x === 'object') B.findArrays(x, `${path}[${i}]`, out, depth + 1); });
    } else if (typeof data === 'object') {
      Object.entries(data).forEach(([k, v]) => { if (v && typeof v === 'object') B.findArrays(v, `${path}.${k}`, out, depth + 1); });
    }
    return out;
  };
  B.flatten = o => { // aplana un nivel de objetos anidados (ej. {datos:{marca}})
    const r = {};
    Object.entries(o).forEach(([k, v]) => {
      if (v && typeof v === 'object' && !Array.isArray(v)) Object.entries(v).forEach(([k2, v2]) => { if (typeof v2 !== 'object') r[`${k}.${k2}`] = v2; });
      else if (!Array.isArray(v)) r[k] = v;
    });
    return r;
  };
  B.autoMap = keys => {
    const used = new Set(), map = {};
    const SHARE = ['descripcion', 'familia']; // una misma columna (ej. EQUIPO) puede alimentar descripción y familia
    B.CAMPOS.forEach(c => {
      const free = k => !used.has(k) || SHARE.includes(c.k) && SHARE.some(x => map[x] === k);
      let found = null;
      for (const sy of c.syn) { found = keys.find(k => free(k) && norm(k) === sy); if (found) break; }
      if (!found) for (const sy of c.syn) { found = keys.find(k => free(k) && norm(k.split('.').pop()) === sy); if (found) break; }
      if (found) { map[c.k] = found; used.add(found); }
    });
    return map;
  };
  // Detecta la fila de encabezados (la que más coincide con los campos conocidos) en una hoja
  B.sheetRows = (ws, campos) => {
    campos = campos || B.CAMPOS;
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
    let best = 0, bestScore = -1;
    for (let i = 0; i < Math.min(15, aoa.length); i++) {
      const sc = aoa[i].reduce((s, h) => s + (campos.some(c => c.syn.includes(norm(h))) ? 1 : 0), 0);
      if (sc > bestScore) { bestScore = sc; best = i; }
    }
    const head = (aoa[best] || []).map((h, i) => String(h || '').replace(/\s+/g, ' ').trim() || ('col' + (i + 1)));
    const rows = aoa.slice(best + 1).filter(r => r.some(v => v !== '' && v !== null)).map(r => { const o = {}; head.forEach((h, i) => { o[h] = r[i] instanceof Date ? U.xlDate(r[i]) : r[i]; }); return o; });
    return { rows, keys: head, score: bestScore };
  };

  B.parseFile = async file => {
    const name = file.name.toLowerCase();
    if (name.endsWith('.json')) {
      const txt = await U.readFileText(file);
      let data; try { data = JSON.parse(txt); } catch (e) { throw new Error('El archivo JSON no es válido: ' + e.message); }
      return B.findArrays(data).sort((a, b) => b.score - a.score || b.rows.length - a.rows.length);
    }
    if (name.endsWith('.csv') || name.endsWith('.txt')) {
      const txt = (await U.readFileText(file)).replace(/^﻿/, '');
      const rows = B.parseCSV(txt);
      return [{ path: file.name, rows, keys: rows.length ? Object.keys(rows[0]) : [], score: 1 }];
    }
    if (/\.xlsx?$|\.xlsm$/.test(name)) {
      const buf = await U.readFileBuffer(file);
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      return wb.SheetNames.map(sn => { const r = B.sheetRows(wb.Sheets[sn]); return { path: 'Hoja: ' + sn, rows: r.rows, keys: r.keys, score: r.score + (/maestro|equipos|flota/i.test(sn) ? 3 : 0) }; }).filter(x => x.rows.length).sort((a, b) => b.score - a.score);
    }
    throw new Error('Formato no soportado. Use JSON, CSV o Excel.');
  };

  B.parseCSV = txt => {
    const first = txt.split(/\r?\n/)[0] || '';
    const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : (first.includes('\t') ? '\t' : ',');
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      if (q) { if (ch === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x !== '')) rows.push(row); row = []; }
      else cur += ch;
    }
    row.push(cur); if (row.some(x => x !== '')) rows.push(row);
    if (!rows.length) return [];
    const head = rows[0].map(h => h.trim());
    return rows.slice(1).map(r => { const o = {}; head.forEach((h, i) => o[h || ('col' + i)] = (r[i] || '').trim()); return o; });
  };

  // Escanea almacenamiento del mismo origen buscando el maestro del Backlog
  B.scanBrowser = async () => {
    const found = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const v = localStorage.getItem(k);
        if (!v || v.length < 5 || !/^[\[{]/.test(v.trim())) continue;
        try { B.findArrays(JSON.parse(v), `localStorage["${k}"]`).forEach(a => { if (a.score >= 1) found.push(a); }); } catch (e) { }
      }
    } catch (e) { }
    if (indexedDB.databases) {
      try {
        const dbs = await indexedDB.databases();
        for (const d of dbs) {
          if (!d.name || d.name === 'EQ_EngraseNeumaticos') continue;
          const db = await new Promise((res, rej) => { const r = indexedDB.open(d.name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onupgradeneeded = () => { r.transaction.abort(); }; }).catch(() => null);
          if (!db) continue;
          for (const st of Array.from(db.objectStoreNames)) {
            try {
              const rows = await new Promise((res, rej) => { const r = db.transaction(st, 'readonly').objectStore(st).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
              B.findArrays(rows, `IndexedDB ${d.name} › ${st}`).forEach(a => { if (a.score >= 1) found.push(a); });
            } catch (e) { }
          }
          db.close();
        }
      } catch (e) { }
    }
    return found.sort((a, b) => b.score - a.score || b.rows.length - a.rows.length);
  };

  B.familiaSugerida = txt => {
    const t = norm(txt);
    const fam = EQ.C.cfg().familias;
    const rules = [['excav', 'Excavadora'], ['tractor', 'Tractor de orugas'], ['tracto', 'Tracto camión'], ['zaranda', 'Zaranda'], ['screen', 'Zaranda'], ['electrog', 'Grupo electrógeno'], ['generador', 'Grupo electrógeno'], ['motosold', 'Motosoldadora'], ['combi', 'Minibús'], ['bulldo', 'Tractor de orugas'], ['dozer', 'Tractor de orugas'], ['retro', 'Retroexcavadora'], ['backhoe', 'Retroexcavadora'], ['volq', 'Volquete'], ['dump', 'Volquete'], ['camionminero', 'Volquete'], ['cargador', 'Cargador frontal'], ['loader', 'Cargador frontal'], ['motonive', 'Motoniveladora'], ['grader', 'Motoniveladora'], ['rodillo', 'Rodillo'], ['compact', 'Rodillo'], ['roller', 'Rodillo'], ['cisterna', 'Cisterna'], ['tanque', 'Cisterna'], ['grua', 'Grúa'], ['crane', 'Grúa'], ['camioneta', 'Camioneta 4x4'], ['pickup', 'Camioneta 4x4'], ['4x4', 'Camioneta 4x4'], ['minibus', 'Minibús'], ['bus', 'Minibús'], ['coaster', 'Minibús']];
    const exact = fam.find(f => norm(f) === t);
    if (exact) return exact;
    for (const [k, f] of rules) if (t.includes(k) && fam.includes(f)) return f;
    return txt ? (fam.includes(txt) ? txt : 'Otros') : 'Otros';
  };

  B.toDate = v => {
    if (v === null || v === undefined || v === '') return '';
    if (v instanceof Date) return U.xlDate(v);
    if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400000)); return U.toISODate(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }
    const s = String(v).trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s); if (m) return `${m[1]}-${U.pad(m[2])}-${U.pad(m[3])}`;
    m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(s); if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${U.pad(m[2])}-${U.pad(m[1])}`; }
    return '';
  };
  B.mapRows = (rows, map) => rows.map(r0 => {
    const r = B.flatten(r0);
    const o = {};
    B.CAMPOS.forEach(c => { if (map[c.k]) o[c.k] = r[map[c.k]]; });
    if (o.codigo !== undefined && o.codigo !== null) o.codigo = String(o.codigo).trim();
    if (o.horometro !== undefined) o.horometro = U.toNum(o.horometro);
    ['fechaInicio', 'fechaDesmov'].forEach(k => { if (o[k] !== undefined) o[k] = B.toDate(o[k]); });
    Object.keys(o).forEach(k => { if (typeof o[k] === 'string') o[k] = o[k].trim(); else if (typeof o[k] === 'number' && !['horometro'].includes(k)) o[k] = String(o[k]); });
    o._famOrig = o.familia || '';
    o.familia = B.familiaSugerida(o.familia || o.descripcion || '');
    return o;
  }).filter(o => o.codigo);

  B.previewMerge = mapped => {
    const seen = new Set(); const nuevos = [], actualiza = [], dup = [], eliminados = [];
    mapped.forEach(o => {
      const k = o.codigo.toUpperCase();
      if (seen.has(k)) { dup.push(o); return; }
      seen.add(k);
      if (EQ.C.eqByCode(o.codigo)) actualiza.push(o);
      else if ((EQ.C.cfg().codigosEliminados || []).some(c => String(c).toUpperCase() === k)) eliminados.push(o);
      else nuevos.push(o);
    });
    return { nuevos, actualiza, dup, eliminados };
  };

  B.applyImport = async (mapped, origen, { actualizarHorometro = true, conservarFamilia = true } = {}) => {
    const { nuevos, actualiza, dup } = B.previewMerge(mapped);
    const C = EQ.C, cfg = C.cfg();
    for (const o of nuevos) {
      const eq = { codigo: o.codigo, descripcion: o.descripcion || '', marca: o.marca || '', modelo: o.modelo || '', serie: o.serie || '', placa: o.placa || '', familia: o.familia, familiaBacklog: o._famOrig, ubicacion: o.ubicacion || '', horometro: o.horometro !== null && o.horometro !== undefined && o.horometro >= 0 ? o.horometro : null, unidad: ['Camioneta 4x4', 'Minibús'].includes(o.familia) ? 'km' : 'h', origen, activo: true,
        estadoMov: (o.estadoMov || '').toUpperCase(), propietario: o.propietario || '', clase: o.clase || '', tipoContrato: o.tipoContrato || '', anio: o.anio || '', capacidad: o.capacidad || '', serieMotor: o.serieMotor || '', codAlterno: o.codAlterno || '', fechaInicio: o.fechaInicio || '', fechaDesmov: o.fechaDesmov || '', sistemaLubricacion: 'Manual', layoutNeum: cfg.layoutsNeum[o.familia] !== undefined ? JSON.parse(JSON.stringify(cfg.layoutsNeum[o.familia])) : null, fechaSync: new Date().toISOString() };
      const saved = await EQ.DB.put('equipos', eq, { motivo: 'Importación ' + origen });
      if (saved.horometro !== null) await EQ.DB.put('horometros', { equipoId: saved.id, fecha: saved.fechaInicio && saved.fechaInicio <= U.today() ? saved.fechaInicio : U.today(), valor: saved.horometro, origen });
    }
    let horAct = 0, horIgn = 0;
    for (const o of actualiza) {
      const eq = C.eqByCode(o.codigo);
      ['descripcion', 'marca', 'modelo', 'serie', 'placa', 'ubicacion', 'propietario', 'clase', 'tipoContrato', 'anio', 'capacidad', 'serieMotor', 'codAlterno', 'fechaInicio', 'fechaDesmov'].forEach(k => { if (o[k] !== undefined && o[k] !== null && o[k] !== '') eq[k] = String(o[k]); });
      if (o.estadoMov) eq.estadoMov = String(o.estadoMov).toUpperCase();
      if (!conservarFamilia && o.familia) eq.familia = o.familia;
      eq.familiaBacklog = o._famOrig;
      eq.fechaSync = new Date().toISOString();
      await EQ.DB.put('equipos', eq, { motivo: 'Sincronización ' + origen });
      if (actualizarHorometro && o.horometro !== null && o.horometro !== undefined && o.horometro >= 0) {
        const ult = C.ultimaLectura(eq);
        if (ult === null || o.horometro > ult) { try { await C.registrarLecturaFecha(eq, o.horometro, o.fechaInicio && o.fechaInicio <= U.today() ? o.fechaInicio : U.today(), origen); horAct++; } catch (e) { horIgn++; } }
        else if (o.horometro < ult) horIgn++;
      }
    }
    await EQ.DB.audit('equipos', '*', 'Importación Backlog', `${origen}: ${nuevos.length} nuevos, ${actualiza.length} actualizados, ${dup.length} duplicados omitidos, ${horAct} lecturas actualizadas, ${horIgn} lecturas menores ignoradas`);
    return { nuevos: nuevos.length, actualizados: actualiza.length, duplicados: dup.length, horAct, horIgn };
  };

  // ---------- Asistente de importación (UI) ----------
  B.wizard = async (sources, origen, onDone) => {
    if (!sources.length) { U.toast('No se encontraron listas de equipos en la fuente seleccionada.', 'bad'); return; }
    let src = sources[0];
    const cfg = EQ.C.cfg();
    const build = () => {
      const keys = [...new Set(src.rows.slice(0, 200).flatMap(r => Object.keys(B.flatten(r))))];
      const saved = cfg.mapeoBacklog && cfg.mapeoBacklog.keysSig === keys.slice().sort().join('|') ? cfg.mapeoBacklog.map : null;
      const map = saved || B.autoMap(keys);
      return { keys, map };
    };
    let st = build();
    const body = () => `
      ${sources.length > 1 ? `<div class="fld mb"><label>Lista detectada</label><select id="bkSrc">${sources.map((s, i) => `<option value="${i}" ${s === src ? 'selected' : ''}>${U.esc(s.path)} (${s.rows.length} filas)</option>`).join('')}</select></div>` : `<div class="info-box mb">Fuente: <b>${U.esc(src.path)}</b> · ${src.rows.length} filas</div>`}
      <div class="section-title" style="margin-top:0">Correspondencia de campos (sincronización por código de equipo)</div>
      <div class="form-grid" id="bkMap">${B.CAMPOS.map(c => `<div class="fld"><label>${c.t}${c.req ? ' <span class="req">*</span>' : ''}</label><select data-k="${c.k}">${U.opts(st.keys, st.map[c.k], '— No importar —')}</select></div>`).join('')}</div>
      <div class="flex mt"><label class="flex"><input type="checkbox" id="bkHor" checked> Actualizar horómetro/km si es mayor al registrado</label>
      <label class="flex"><input type="checkbox" id="bkFam" checked> Conservar familia asignada localmente en equipos existentes</label></div>
      <div class="section-title">Vista previa</div><div id="bkPrev"></div>`;
    const m = U.modal({ title: 'Importar maestro de equipos del Backlog', size: 'xl', body: body(), buttons: [
      { label: 'Cancelar', cls: 'btn-outline' },
      { label: 'Importar / Sincronizar', cls: 'btn-orange', onClick: async (el) => {
        const map = readMap(el);
        if (!map.codigo) throw new Error('Debe indicar la columna del código de equipo.');
        const mapped = B.mapRows(src.rows, map);
        if (!mapped.length) throw new Error('No hay filas con código de equipo.');
        cfg.mapeoBacklog = { keysSig: st.keys.slice().sort().join('|'), map };
        await EQ.DB.put('config', cfg, { noAudit: true });
        const r = await B.applyImport(mapped, origen, { actualizarHorometro: el.querySelector('#bkHor').checked, conservarFamilia: el.querySelector('#bkFam').checked });
        U.toast(`Importación completa: ${r.nuevos} nuevos, ${r.actualizados} actualizados, ${r.duplicados} duplicados omitidos.`, 'ok');
        if (onDone) onDone(r);
      } }] });
    const readMap = el => { const map = {}; el.querySelectorAll('#bkMap select').forEach(s => { if (s.value) map[s.dataset.k] = s.value; }); return map; };
    const prev = () => {
      const el = m.el; const map = readMap(el);
      const mapped = map.codigo ? B.mapRows(src.rows, map) : [];
      const pm = B.previewMerge(mapped);
      el.querySelector('#bkPrev').innerHTML = `<div class="flex mb">${U.pill('ok', pm.nuevos.length + ' nuevos')} ${U.pill('info', pm.actualiza.length + ' a actualizar')} ${U.pill(pm.dup.length ? 'amarillo' : 'gris', pm.dup.length + ' duplicados en archivo (se omiten)')} ${U.pill('gris', (src.rows.length - mapped.length) + ' sin código')}${pm.eliminados.length ? ' ' + U.pill('gris', pm.eliminados.length + ' eliminados del maestro (no se vuelven a crear)') : ''}</div>
        <div class="tbl-wrap" style="max-height:300px"><table class="tbl"><thead><tr><th>Acción</th>${B.CAMPOS.filter(c => map[c.k]).map(c => `<th>${c.t}</th>`).join('')}<th>Familia asignada</th></tr></thead><tbody>
        ${mapped.slice(0, 50).map(o => `<tr><td>${EQ.C.eqByCode(o.codigo) ? U.pill('info', 'Actualizar') : U.pill('ok', 'Nuevo')}</td>${B.CAMPOS.filter(c => map[c.k]).map(c => `<td>${U.esc(c.k === 'familia' ? o._famOrig : o[c.k])}</td>`).join('')}<td>${U.esc(o.familia)}</td></tr>`).join('')}
        </tbody></table></div>${mapped.length > 50 ? `<div class="tbl-foot">Mostrando 50 de ${mapped.length}</div>` : ''}`;
    };
    const wire = () => {
      m.el.querySelectorAll('#bkMap select').forEach(s => s.onchange = prev);
      const ss = m.el.querySelector('#bkSrc');
      if (ss) ss.onchange = () => { src = sources[+ss.value]; st = build(); m.el.querySelector('.modal-body').innerHTML = body(); wire(); prev(); };
    };
    wire(); prev();
  };

  B.exportMaestro = () => {
    const data = { app: 'EQ_EngraseNeumaticos', tipo: 'maestro_equipos', exportado: new Date().toISOString(), equipos: S.equipos.map(e => ({ codigo: e.codigo, descripcion: e.descripcion, marca: e.marca, modelo: e.modelo, serie: e.serie, placa: e.placa, familia: e.familia, ubicacion: e.ubicacion, horometro: e.horometro, unidad: e.unidad, estado: e.estadoMov || '', propietario: e.propietario || '', clase: e.clase || '', fechaInicio: e.fechaInicio || '', activo: e.activo !== false })) };
    U.download(JSON.stringify(data, null, 2), `maestro_equipos_${U.today()}.json`, 'application/json');
  };

  EQ.Backlog = B;
})();
