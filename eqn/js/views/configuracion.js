/* CONFIGURACIÓN – todos los parámetros editables */
(function () {
  const U = EQ.U, S = EQ.S, C = EQ.C;
  EQ.Views = EQ.Views || {};
  const V = {};
  const TABS = [['programa', 'Programa de engrase EG/EP'], ['tecnicos', 'Técnicos del área'], ['grasas', 'Tipos de grasa y precios'], ['listas', 'General, monedas y listas'], ['tiposneum', 'Tipos de neumático y límites'], ['umbrales', 'Umbrales de alerta'], ['plantillas', 'Plantillas de engrase'], ['layouts', 'Plantillas de neumáticos'], ['datos', 'Datos y respaldo']];
  const LISTAS = [['familias', 'Familias de equipos'], ['sistemasLubricacion', 'Sistemas de lubricación'], ['tiposComponente', 'Tipos de componente'], ['responsables', 'Responsables / supervisores'], ['ubicaciones', 'Ubicaciones'], ['marcasNeum', 'Marcas de neumáticos'], ['medidas', 'Medidas de neumáticos'], ['disenos', 'Diseños de banda'], ['condiciones', 'Condiciones físicas (inspección)'], ['condicionesCriticas', 'Condiciones que hacen crítico un neumático'], ['estadosNeum', 'Estados de neumático'], ['estadosEngrase', 'Estados de registro por punto'], ['familiasSinPrograma', 'Familias fuera del programa de engrase'], ['estadosMovilizacion', 'Estados de equipo (movilización)'], ['medicionesCocada', 'Puntos de medición de remanente (cocada)']];
  const CORE = { estadosNeum: EQ.DEFAULT_CONFIG.estadosNeum, estadosEngrase: EQ.DEFAULT_CONFIG.estadosEngrase };
  const save = async (cfg, msg = 'Configuración guardada') => { await EQ.DB.put('config', cfg, { motivo: 'Configuración' }); U.toast(msg, 'ok'); EQ.App.refresh(); };

  V.render = root => {
    const tab = EQ.App.tab('configuracion', 'programa');
    root.innerHTML = EQ.App.tabsHtml('configuracion', TABS, tab) + '<div id="cfgBody"></div>';
    EQ.App.wireTabs(root, 'configuracion');
    const b = root.querySelector('#cfgBody');
    ({ programa, tecnicos, listas, grasas, tiposneum, umbrales, plantillas, layouts, datos })[tab](b);
  };

  function programa(root) {
    const cfg = C.cfg(), f = cfg.formato || {};
    root.innerHTML = `<div class="card mb"><h3>Encabezado del formato (exportación Excel / PDF)</h3><form class="form-grid" id="fFm">
        ${U.field('empresa', 'Sistema / empresa', { value: f.empresa, cls: 'full' })}${U.field('codigo', 'Código del formato', { value: f.codigo })}${U.field('version', 'Versión', { value: f.version })}</form>
        <div class="flex mt"><span class="spacer"></span><button class="btn btn-orange btn-sm" id="fmS">Guardar encabezado</button></div></div>
      <div id="tTip" class="mb"></div><div id="tPla"></div>
      <div class="info-box mt">Días máximos sin engrase (actual: <b>${cfg.umbrales.diasSinEngrase}</b>) y alertas por punto se configuran en "Umbrales de alerta". Las familias fuera del programa se editan en "Listas y catálogos".</div>`;
    root.querySelector('#fmS').onclick = async () => { cfg.formato = U.formData(root.querySelector('#fFm')); await save(cfg, 'Encabezado guardado'); };
    const usados = new Set(S.engrasesDiarios.map(d => d.tipo).concat(S.programas.flatMap(p => Object.values(p.dias || {}))));
    editableTable(root.querySelector('#tTip'), { title: 'Tipos de engrase', hint: 'Código corto que aparece en el programa (EG, EP…), nombre completo y tiempo estimado de ejecución en horas. Puede <b>editar el código o el nombre</b> de un tipo ya asignado sin eliminarlo: el cambio se aplica a los planes, programas y registros que lo usan.', rows: cfg.tiposEngrase.map(t => Object.assign({ _o: t.codigo }, t)), onAdd: () => ({ codigo: '', nombre: '', horas: 0.25 }),
      cols: [{ k: 'codigo', t: 'Código' }, { k: 'nombre', t: 'Nombre' }, { k: 'horas', t: 'Tiempo de ejecución (h)', num: true }],
      onSave: async rows => {
        rows = rows.filter(r => r.codigo).map(r => ({ _o: r._o, codigo: r.codigo.toUpperCase().replace(/\s+/g, ''), nombre: r.nombre || r.codigo, horas: r.horas || 0 }));
        if (!rows.length) throw new Error('Debe existir al menos un tipo de engrase.');
        const cs = rows.map(r => r.codigo); if (new Set(cs).size !== cs.length) throw new Error('Códigos duplicados.');
        const ren = {}; rows.forEach(r => { if (r._o && r._o !== r.codigo) ren[r._o] = r.codigo; });
        const faltan = [...usados].filter(c => !cs.includes(c) && !ren[c]); if (faltan.length) throw new Error(`No puede eliminar ${faltan.join(', ')}: hay programas o registros que lo usan. Puede renombrarlo (editar su código) en lugar de eliminarlo.`);
        if (Object.keys(ren).length) {
          const R = c => ren[c] || c;
          for (const p of S.programas) { const nd = {}; let ch = false; Object.entries(p.dias || {}).forEach(([d, t]) => { nd[d] = R(t); if (R(t) !== t) ch = true; }); if (ch) { p.dias = nd; await EQ.DB.put('programas', p); } }
          for (const d of S.engrasesDiarios) if (ren[d.tipo]) { d.tipo = R(d.tipo); await EQ.DB.put('engrasesDiarios', d, { noAudit: true }); }
          for (const e of S.equipos) if (e.planEngrase && (e.planEngrase.secuencia || []).some(t => ren[t])) { e.planEngrase.secuencia = e.planEngrase.secuencia.map(R); await EQ.DB.put('equipos', e, { noAudit: true }); }
          Object.values(cfg.planesEngrase || {}).forEach(p => p.secuencia = p.secuencia.map(R));
          await EQ.DB.audit('config', 'tiposEngrase', 'Modificación', 'Renombrado: ' + Object.entries(ren).map(([a, b]) => `${a} → ${b}`).join(', '));
        }
        cfg.tiposEngrase = rows.map(({ _o, ...r }) => r); await save(cfg, 'Tipos de engrase guardados');
      } });
    const fams = [...new Set(cfg.familias.concat(Object.keys(cfg.planesEngrase || {})))];
    editableTable(root.querySelector('#tPla'), { title: 'Plan de engrase por familia (valor por defecto de cada equipo)', hint: 'Secuencia de tipos separada por comas que se repite cada N días. Ej.: excavadoras "EG, EP" cada 3 días (EG cada 6 y EP entre medio), volquetes "EG, EP" cada 6, zarandas "EG" cada 3. Cada equipo puede tener su propio plan.',
      rows: Object.entries(cfg.planesEngrase || {}).map(([fam, p]) => ({ familia: fam, secuencia: p.secuencia.join(', '), intervalo: p.intervalo })), onAdd: () => ({ familia: fams[0], secuencia: 'EG', intervalo: 7 }),
      cols: [{ k: 'familia', t: 'Familia', opts: fams }, { k: 'secuencia', t: 'Secuencia' }, { k: 'intervalo', t: 'Cada (días)', num: true }],
      onSave: async rows => {
        const out = {}; const cods = cfg.tiposEngrase.map(t => t.codigo);
        rows.forEach(r => {
          if (!r.familia) return;
          const seq = String(r.secuencia || '').toUpperCase().split(/[\s,;]+/).filter(Boolean);
          if (!seq.length || seq.some(x => !cods.includes(x))) throw new Error(`${r.familia}: secuencia inválida (use ${cods.join(', ')}).`);
          if (!(r.intervalo >= 1 && r.intervalo <= 60)) throw new Error(`${r.familia}: intervalo inválido.`);
          if (out[r.familia]) throw new Error(`${r.familia} está repetida.`);
          out[r.familia] = { secuencia: seq, intervalo: Math.round(r.intervalo) };
        });
        cfg.planesEngrase = out; await save(cfg, 'Planes guardados');
      } });
  }

  function listas(root) {
    const cfg = C.cfg();
    root.innerHTML = `<div class="card mb"><h3>General y monedas</h3><div class="flex">
        <label>Moneda local <input id="cMon" value="${U.esc(cfg.moneda)}" style="width:70px"></label>
        <label>Símbolo dólares <input id="cUsd" value="${U.esc(cfg.monedaUSD || 'US$')}" style="width:70px"></label>
        <label>Tipo de cambio (${U.esc(cfg.moneda)} por 1 ${U.esc(cfg.monedaUSD || 'US$')}) <input id="cTc" type="number" min="0" step="0.001" value="${U.esc(cfg.tipoCambio ?? '')}" style="width:90px"></label>
        <label>Mostrar costos de neumáticos en <select id="cMn">${U.opts([cfg.moneda, cfg.monedaUSD || 'US$'], cfg.monedaNeum || cfg.moneda)}</select></label>
        <button class="btn btn-sm btn-orange" id="cMonS">Guardar</button></div>
        <div class="small muted mt-s">Cada neumático, reparación o reencauche puede registrarse en ${U.esc(cfg.moneda)} o en ${U.esc(cfg.monedaUSD || 'US$')}; los totales se convierten con el tipo de cambio.</div></div>
      <div class="grid g2">${LISTAS.map(([k, t]) => `<div class="card"><h3>${t}</h3><div class="chips" data-l="${k}">${(cfg[k] || []).map((v, i) => `<span class="chip"><span data-ed="${i}" style="cursor:pointer" title="Clic para renombrar">${U.esc(v)}</span><button data-del="${i}" title="Eliminar">×</button></span>`).join('')}</div>
        <div class="flex mt-s"><input data-add="${k}" placeholder="Nuevo valor…" style="flex:1"><button class="btn btn-sm btn-orange" data-addb="${k}">Agregar</button></div></div>`).join('')}</div>`;
    root.querySelector('#cMonS').onclick = () => {
      const tc = U.toNum(root.querySelector('#cTc').value);
      if (!(tc > 0)) { U.toast('Ingrese un tipo de cambio válido (mayor a 0)', 'bad'); return; }
      const oldB = cfg.moneda, oldU = cfg.monedaUSD || 'US$';
      cfg.moneda = root.querySelector('#cMon').value.trim() || 'S/'; cfg.monedaUSD = root.querySelector('#cUsd').value.trim() || 'US$'; cfg.tipoCambio = tc;
      const mn = root.querySelector('#cMn').value; cfg.monedaNeum = mn === oldU ? cfg.monedaUSD : mn === oldB ? cfg.moneda : mn;
      save(cfg);
    };
    root.querySelectorAll('[data-addb]').forEach(btn => btn.onclick = () => {
      const k = btn.dataset.addb; const inp = root.querySelector(`[data-add="${k}"]`); const v = inp.value.trim();
      if (!v) return; if ((cfg[k] || []).some(x => x.toLowerCase() === v.toLowerCase())) { U.toast('Valor duplicado', 'bad'); return; }
      if (k === 'medicionesCocada' && (cfg[k] || []).length >= 8) { U.toast('Máximo 8 puntos de medición.', 'bad'); return; }
      cfg[k] = (cfg[k] || []).concat([k === 'estadosMovilizacion' ? v.toUpperCase() : v]); save(cfg);
    });
    root.querySelectorAll('[data-add]').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') root.querySelector(`[data-addb="${i.dataset.add}"]`).click(); }));
    root.querySelectorAll('.chips').forEach(ch => ch.addEventListener('click', async e => {
      const k = ch.dataset.l;
      const d = e.target.closest('[data-del]'), ed = e.target.closest('[data-ed]');
      if (d) {
        const v = cfg[k][+d.dataset.del];
        if (CORE[k] && CORE[k].includes(v)) { U.toast('Estado base del sistema: puede renombrarse, no eliminarse.', 'bad'); return; }
        if (k === 'medicionesCocada' && cfg[k].length <= 1) { U.toast('Debe quedar al menos un punto de medición.', 'bad'); return; }
        if (k === 'familias' && S.equipos.some(e => e.familia === v)) { U.toast('Hay equipos con esta familia. Cámbielos antes de eliminarla.', 'bad'); return; }
        if (await U.confirm(`¿Eliminar "${U.esc(v)}" de la lista?`)) { cfg[k].splice(+d.dataset.del, 1); save(cfg); }
      }
      if (ed) {
        const i = +ed.dataset.ed, old = cfg[k][i];
        if (CORE[k] && CORE[k].includes(old)) { U.toast('Los estados base se usan en los cálculos y no se renombran. Agregue estados adicionales si los necesita.', 'bad'); return; }
        const nv = await U.prompt('Nuevo nombre', old, 'Renombrar'); if (!nv || nv === old) return;
        cfg[k][i] = nv;
        if (k === 'familias') { for (const e of S.equipos.filter(e => e.familia === old)) { e.familia = nv; await EQ.DB.put('equipos', e); } if (cfg.plantillasEngrase[old]) { cfg.plantillasEngrase[nv] = cfg.plantillasEngrase[old]; delete cfg.plantillasEngrase[old]; } if (cfg.layoutsNeum[old] !== undefined) { cfg.layoutsNeum[nv] = cfg.layoutsNeum[old]; delete cfg.layoutsNeum[old]; } }
        save(cfg);
      }
    }));
  }

  function editableTable(root, { title, cols, rows, onSave, onAdd, hint = '' }) {
    root.innerHTML = `<div class="card"><h3>${title}<span class="right"><button class="btn btn-sm btn-outline" id="etAdd">+ Agregar fila</button><button class="btn btn-sm btn-orange" id="etSave">Guardar cambios</button></span></h3>${hint ? `<div class="info-box mb">${hint}</div>` : ''}
      <div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map(c => `<th class="nosort ${c.num ? 'num' : ''}">${c.t}</th>`).join('')}<th class="nosort"></th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr data-i="${i}" data-o="${U.esc(r._o === undefined || r._o === null ? '' : r._o)}">${cols.map(c => `<td>${c.opts ? `<select data-k="${c.k}">${U.opts(c.opts, r[c.k])}</select>` : `<input data-k="${c.k}" ${c.num ? 'type="number" step="any" min="0" style="width:90px"' : 'style="width:100%"'} value="${U.esc(r[c.k] === null || r[c.k] === undefined ? '' : r[c.k])}">`}</td>`).join('')}<td><button class="btn btn-ghost btn-sm" data-rm="${i}">🗑</button></td></tr>`).join('')}
      </tbody></table></div></div>`;
    const read = () => [...root.querySelectorAll('tbody tr')].map(tr => { const o = {}; if (tr.dataset.o) o._o = tr.dataset.o; tr.querySelectorAll('[data-k]').forEach(i => { const c = cols.find(x => x.k === i.dataset.k); o[i.dataset.k] = c.num ? U.toNum(i.value) : i.value.trim(); }); return o; });
    root.querySelector('#etAdd').onclick = () => { const cur = read(); cur.push(onAdd()); rows.splice(0, rows.length, ...cur); editableTable(root, { title, cols, rows, onSave, onAdd, hint }); };
    root.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { const cur = read(); cur.splice(+b.dataset.rm, 1); rows.splice(0, rows.length, ...cur); editableTable(root, { title, cols, rows, onSave, onAdd, hint }); });
    root.querySelector('#etSave').onclick = async () => { try { await onSave(read()); } catch (e) { U.toast(e.message, 'bad'); } };
  }

  function grasas(root) {
    const cfg = C.cfg();
    const mon = cfg.moneda;
    root.innerHTML = `<div class="info-box mb">Edite el <b>nombre / tipo</b>, la marca, la base, el grado NLGI y los <b>precios</b> de cada grasa. El costo de engrase se calcula de dos formas: <b>por punto engrasado</b> (cantidad de puntos × precio por punto) y <b>por kg de grasa usada</b> (kg × precio por kg). Los precios pueden ingresarse en ${U.esc(mon)} o en ${U.esc(cfg.monedaUSD || 'US$')}: todos los costos se muestran en ambas monedas con el tipo de cambio (${U.num(C.tc(), 3)}, editable en "General, monedas y listas"). Cada registro guarda el precio y el tipo de cambio vigentes al momento del engrase; para recalcular registros antiguos use "✎ Editar" en el control diario.
      Costo oficial mostrado en dashboard y reportes: <select id="gMet">${U.opts([{ v: 'kg', t: 'Por kg de grasa usada' }, { v: 'puntos', t: 'Por puntos engrasados' }], cfg.metodoCostoEngrase || 'kg')}</select></div><div id="gT"></div>
      <div class="card mt"><h3>Precios equivalentes (T.C. ${U.num(C.tc(), 3)})</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th class="nosort">Grasa</th><th class="nosort num">${U.esc(mon)}/kg</th><th class="nosort num">${U.esc(mon)}/punto</th><th class="nosort num">${U.esc(cfg.monedaUSD || 'US$')}/kg</th><th class="nosort num">${U.esc(cfg.monedaUSD || 'US$')}/punto</th></tr></thead><tbody>${cfg.tiposGrasa.map(g => `<tr><td>${U.esc(g.nombre)}</td><td class="num">${U.money(C.precioGrasa(g.nombre))}</td><td class="num">${U.money(C.precioPunto(g.nombre))}</td><td class="num">${U.usd(C.precioGrasaUSD(g.nombre))}</td><td class="num">${U.usd(C.precioPuntoUSD(g.nombre))}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="card mt"><h3>Precio rápido de una grasa</h3><div class="flex"><select id="gq">${U.opts(cfg.tiposGrasa.map(g => g.nombre), (cfg.tiposGrasa[0] || {}).nombre)}</select><label>Moneda <select id="gqm">${U.opts([{ v: 'LOC', t: mon }, { v: 'USD', t: cfg.monedaUSD || 'US$' }], 'LOC')}</select></label><label>Precio por kg <input type="number" id="gqk" min="0" step="any" style="width:100px"></label><label>Precio por punto <input type="number" id="gqp" min="0" step="any" style="width:100px"></label><label class="flex small"><input type="checkbox" id="gqr"> Recalcular los engrases del mes actual con este precio</label><button class="btn btn-sm btn-orange" id="gqs">Guardar precio</button></div></div>`;
    root.querySelector('#gMet').onchange = async e => { cfg.metodoCostoEngrase = e.target.value; await save(cfg, 'Método de costo guardado'); };
    const gq = root.querySelector('#gq');
    const fillQ = () => { const g = C.grasa(gq.value) || {}; root.querySelector('#gqk').value = g.precioKg ?? ''; root.querySelector('#gqp').value = g.precioPunto ?? ''; root.querySelector('#gqm').value = g.moneda === 'USD' ? 'USD' : 'LOC'; };
    gq.onchange = fillQ; fillQ();
    root.querySelector('#gqs').onclick = async () => {
      const g = cfg.tiposGrasa.find(x => x.nombre === gq.value); if (!g) return;
      const k = U.toNum(root.querySelector('#gqk').value), pp = U.toNum(root.querySelector('#gqp').value);
      if ((k !== null && k < 0) || (pp !== null && pp < 0)) { U.toast('Precios negativos no permitidos', 'bad'); return; }
      g.precioKg = k || 0; g.precioPunto = pp || 0; g.moneda = root.querySelector('#gqm').value === 'USD' ? 'USD' : '';
      await EQ.DB.put('config', cfg, { motivo: `Precio de ${g.nombre}` });
      if (root.querySelector('#gqr').checked) { const mes = C.mesDe(U.today()); let n = 0; for (const d of S.engrasesDiarios.filter(d => C.mesDe(d.fecha) === mes && C.costoDiario(d).grasa === g.nombre)) { await C.actualizarDiario(d, { actualizarPrecio: true, tipoGrasa: g.nombre }, 'Actualización de precio de grasa'); n++; } U.toast(`${n} engrase(s) del mes recalculados`, 'ok'); }
      U.toast(`Precio de ${g.nombre} guardado`, 'ok'); EQ.App.refresh();
    };
    editableTable(root.querySelector('#gT'), { title: 'Tipos de grasa y precios', rows: cfg.tiposGrasa.map(g => Object.assign({ _o: g.nombre }, g, { moneda: g.moneda === 'USD' ? 'USD' : 'LOC' })), onAdd: () => ({ nombre: '', marca: '', base: '', nlgi: '2', moneda: 'LOC', precioKg: 0, precioPunto: 0 }),
      cols: [{ k: 'nombre', t: 'Nombre / tipo de grasa' }, { k: 'marca', t: 'Marca' }, { k: 'base', t: 'Base / especificación' }, { k: 'nlgi', t: 'NLGI', opts: ['000', '00', '0', '1', '1.5', '2', '3', '4', '5', '6'] }, { k: 'moneda', t: 'Moneda del precio', opts: [{ v: 'LOC', t: mon }, { v: 'USD', t: cfg.monedaUSD || 'US$' }] }, { k: 'precioKg', t: 'Precio por kg', num: true }, { k: 'precioPunto', t: 'Precio por punto', num: true }],
      onSave: async rows => {
        rows = rows.filter(r => r.nombre);
        if (!rows.length) throw new Error('Debe existir al menos un tipo de grasa.');
        if (rows.some(r => (r.precioKg !== null && r.precioKg < 0) || (r.precioPunto !== null && r.precioPunto < 0))) throw new Error('Precios negativos no permitidos.');
        const names = rows.map(r => r.nombre.toLowerCase()); if (new Set(names).size !== names.length) throw new Error('Nombres de grasa duplicados.');
        const ren = {}; rows.forEach(r => { if (r._o && r._o !== r.nombre) ren[r._o] = r.nombre; });
        const removed = cfg.tiposGrasa.map(g => g.nombre).filter(n => !rows.some(r => r.nombre === n) && !ren[n]);
        const used = removed.filter(n => S.puntos.some(p => p.tipoGrasa === n && p.activo !== false) || S.equipos.some(e => e.tipoGrasa === n));
        if (used.length) throw new Error(`No puede eliminar "${used.join(', ')}": hay equipos o puntos activos que la usan. Puede renombrarla (editar su nombre) o cambiar primero esos equipos.`);
        if (Object.keys(ren).length) {
          for (const p of S.puntos) if (ren[p.tipoGrasa]) { p.tipoGrasa = ren[p.tipoGrasa]; await EQ.DB.put('puntos', p, { noAudit: true }); }
          for (const e of S.equipos) if (ren[e.tipoGrasa]) { e.tipoGrasa = ren[e.tipoGrasa]; await EQ.DB.put('equipos', e, { noAudit: true }); }
          for (const r of S.engrases) if (ren[r.tipoGrasa]) { r.tipoGrasa = ren[r.tipoGrasa]; await EQ.DB.put('engrases', r, { noAudit: true }); }
          for (const d of S.engrasesDiarios) if (ren[d.tipoGrasa]) { d.tipoGrasa = ren[d.tipoGrasa]; await EQ.DB.put('engrasesDiarios', d, { noAudit: true }); }
          await EQ.DB.audit('config', 'tiposGrasa', 'Modificación', 'Grasa renombrada: ' + Object.entries(ren).map(([a, b]) => `${a} → ${b}`).join(', '));
        }
        cfg.tiposGrasa = rows.map(r => ({ nombre: r.nombre, marca: r.marca || '', base: r.base || '', nlgi: r.nlgi, moneda: r.moneda === 'USD' ? 'USD' : '', precioKg: r.precioKg || 0, precioPunto: r.precioPunto || 0 })); await save(cfg, 'Tipos de grasa y precios guardados');
      } });
  }

  function tecnicos(root) {
    const cfg = C.cfg();
    const uso = n => S.engrasesDiarios.filter(d => d.tecnico === n).length + S.inspecciones.filter(i => i.inspector === n).length;
    root.innerHTML = `<div class="info-box mb">Registre aquí a los técnicos de su área (lubricadores, técnicos de neumáticos, etc.). Aparecen como opciones al registrar engrases, inspecciones y movimientos de neumáticos. Para dar de baja a alguien que ya tiene registros desmarque "Activo" (su historial se conserva). Si al registrar un engrase escribe un nombre nuevo, se agrega automáticamente a esta lista.</div><div id="tTec"></div>`;
    editableTable(root.querySelector('#tTec'), { title: `Técnicos del área (${(cfg.tecnicosDet || []).filter(t => t.activo !== false).length} activos)`, rows: (cfg.tecnicosDet || []).map(t => Object.assign({ _o: t.nombre }, t, { activo: t.activo === false ? 'No' : 'Sí' })), onAdd: () => ({ nombre: '', cargo: 'Lubricador', especialidad: 'Engrase', codigo: '', telefono: '', activo: 'Sí' }),
      cols: [{ k: 'nombre', t: 'Nombres y apellidos' }, { k: 'cargo', t: 'Cargo' }, { k: 'especialidad', t: 'Especialidad', opts: ['Engrase', 'Neumáticos', 'Engrase y neumáticos'] }, { k: 'codigo', t: 'Código / DNI' }, { k: 'telefono', t: 'Teléfono' }, { k: 'activo', t: 'Activo', opts: ['Sí', 'No'] }],
      onSave: async rows => {
        rows = rows.filter(r => r.nombre);
        const ns = rows.map(r => r.nombre.toLowerCase()); if (new Set(ns).size !== ns.length) throw new Error('Nombres de técnico duplicados.');
        const ren = {}; rows.forEach(r => { if (r._o && r._o !== r.nombre) ren[r._o] = r.nombre; });
        const borr = (cfg.tecnicosDet || []).map(t => t.nombre).filter(n => !rows.some(r => r.nombre === n) && !ren[n] && uso(n));
        if (borr.length) throw new Error(`"${borr.join(', ')}" tiene registros: desmárquelo como no activo en lugar de eliminarlo.`);
        if (Object.keys(ren).length) {
          for (const d of S.engrasesDiarios) if (ren[d.tecnico]) { d.tecnico = ren[d.tecnico]; await EQ.DB.put('engrasesDiarios', d, { noAudit: true }); }
          for (const r of S.engrases) if (ren[r.tecnico]) { r.tecnico = ren[r.tecnico]; await EQ.DB.put('engrases', r, { noAudit: true }); }
          for (const i of S.inspecciones) if (ren[i.inspector]) { i.inspector = ren[i.inspector]; await EQ.DB.put('inspecciones', i, { noAudit: true }); }
        }
        cfg.tecnicosDet = rows.map(r => ({ nombre: r.nombre, cargo: r.cargo || '', especialidad: r.especialidad || 'Engrase', codigo: r.codigo || '', telefono: r.telefono || '', activo: r.activo !== 'No' }));
        cfg.tecnicos = cfg.tecnicosDet.filter(t => t.activo).map(t => t.nombre);
        await save(cfg, 'Técnicos guardados');
      } });
  }

  function tiposneum(root) {
    const cfg = C.cfg();
    editableTable(root, { title: 'Tipos de neumático – profundidades y presiones', hint: 'Límites por tipo de neumático. Cada neumático puede tener límites propios que reemplazan estos valores.', rows: JSON.parse(JSON.stringify(cfg.tiposNeumatico)), onAdd: () => ({ nombre: '', profNueva: 20, profAlerta: 6, profRetiro: 4, presionRec: 100, tolerancia: 10 }),
      cols: [{ k: 'nombre', t: 'Tipo' }, { k: 'profNueva', t: 'Cocada nueva (mm)', num: true }, { k: 'profAlerta', t: 'Prof. alerta (mm)', num: true }, { k: 'profRetiro', t: 'Prof. mínima retiro (mm)', num: true }, { k: 'presionRec', t: 'Presión rec. (PSI)', num: true }, { k: 'tolerancia', t: 'Tolerancia ±%', num: true }],
      onSave: async rows => {
        rows = rows.filter(r => r.nombre);
        rows.forEach(r => { ['profNueva', 'profAlerta', 'profRetiro', 'presionRec', 'tolerancia'].forEach(k => { if (r[k] === null || r[k] < 0) throw new Error(`${r.nombre}: valor inválido en ${k}.`); }); if (!(r.profRetiro < r.profAlerta && r.profAlerta < r.profNueva)) throw new Error(`${r.nombre}: debe cumplirse retiro < alerta < nueva.`); });
        const removed = cfg.tiposNeumatico.filter(t => !rows.some(r => r.nombre === t.nombre)).map(t => t.nombre).filter(n => S.neumaticos.some(x => x.tipo === n));
        if (removed.length) throw new Error(`Hay neumáticos con el tipo "${removed.join(', ')}".`);
        cfg.tiposNeumatico = rows; await save(cfg);
      } });
  }

  function umbrales(root) {
    const cfg = C.cfg(), t = cfg.umbrales;
    const F = [
      ['engraseAmarilloPct', 'Engrase: % de frecuencia restante para "próximo a vencer"', '%'], ['engraseAmarilloDias', 'Engrase: días restantes para "próximo a vencer"', 'días'], ['engraseCriticoPct', 'Engrase: % de exceso sobre el intervalo para alerta CRÍTICA', '%'],
      ['inspeccionDias', 'Neumáticos: días máximos entre inspecciones', 'días'], ['desgasteIrregularMm', 'Diferencia entre zonas para detectar desgaste irregular', 'mm'], ['desgasteCriticoPct', 'Desgaste para considerar neumático crítico', '%'],
      ['presionTolPct', 'Tolerancia general de presión', '±%'], ['presionCriticaPct', 'Desviación de presión para prioridad ALTA', '%'], ['minInspecciones', 'Mediciones mínimas para proyectar vida útil', 'n°'], ['minUsoProyeccion', 'Uso mínimo para proyectar vida útil', 'h/km'],
      ['diasProxReemplazo', 'Días para considerar "próximo a reemplazo"', 'días'], ['diasSinEngrase', 'Engrase: días máximos sin engrase (PRIORID-ENGR)', 'días'], ['horasDiaDefault', 'Uso diario por defecto (horómetro)', 'h/día'], ['kmDiaDefault', 'Uso diario por defecto (kilometraje)', 'km/día']];
    root.innerHTML = `<div class="card"><h3>Umbrales de alerta y parámetros de cálculo</h3><form class="form-grid" id="fU">${F.map(([k, l, u]) => U.field(k, `${l} (${u})`, { type: 'number', value: t[k], attrs: 'min="0"' })).join('')}
      <div class="fld full"><label class="flex"><input type="checkbox" name="parcialActualiza" ${t.parcialActualiza ? 'checked' : ''}> Un engrase "Parcial" reinicia el contador del punto</label></div>
      <div class="fld full"><label class="flex"><input type="checkbox" name="alertasPorPunto" ${t.alertasPorPunto ? 'checked' : ''}> Generar también alertas por punto de engrase (frecuencia en horas / días de cada punto)</label></div></form>
      <div class="flex mt"><button class="btn btn-outline" id="uRst">Restaurar valores por defecto</button><span class="spacer"></span><button class="btn btn-orange" id="uSave">Guardar umbrales</button></div></div>`;
    root.querySelector('#uSave').onclick = async () => {
      const f = root.querySelector('#fU'); const d = U.formData(f);
      const bad = F.map(x => x[0]).filter(k => d[k] === null || d[k] < 0);
      if (bad.length) { U.markInvalid(f, bad); U.toast('Valores inválidos o negativos', 'bad'); return; }
      if (d.minInspecciones < 1) { U.toast('Se requiere al menos 1 medición para proyectar', 'bad'); return; }
      cfg.umbrales = Object.assign(t, d); await save(cfg);
    };
    root.querySelector('#uRst').onclick = async () => { if (await U.confirm('¿Restaurar los umbrales por defecto?')) { cfg.umbrales = JSON.parse(JSON.stringify(EQ.DEFAULT_CONFIG.umbrales)); await save(cfg); } };
  }

  function plantillas(root) {
    const cfg = C.cfg();
    const st = EQ.App.state.tplF || (EQ.App.state.tplF = { fam: cfg.familias[0] });
    const fams = [...new Set(cfg.familias.concat(Object.keys(cfg.plantillasEngrase)))];
    if (!fams.includes(st.fam)) st.fam = fams[0];
    const rows = JSON.parse(JSON.stringify(cfg.plantillasEngrase[st.fam] || []));
    root.innerHTML = `<div class="selector-bar"><b>Plantilla de familia:</b><select id="tF">${U.opts(fams, st.fam)}</select><span class="muted small">Valores referenciales, modificables según manual del fabricante. Los cambios no afectan los puntos ya creados en los equipos.</span><span class="spacer"></span><button class="btn btn-sm btn-outline" id="tRst">Restaurar plantilla original</button></div><div id="tTbl"></div>`;
    root.querySelector('#tF').onchange = e => { st.fam = e.target.value; EQ.App.refresh(); };
    root.querySelector('#tRst').onclick = async () => { if (!EQ.DEFAULT_CONFIG.plantillasEngrase[st.fam]) { U.toast('No existe plantilla original para esta familia', 'bad'); return; } if (await U.confirm('¿Restaurar la plantilla original?')) { cfg.plantillasEngrase[st.fam] = JSON.parse(JSON.stringify(EQ.DEFAULT_CONFIG.plantillasEngrase[st.fam])); await save(cfg); } };
    editableTable(root.querySelector('#tTbl'), { title: `Puntos de la plantilla – ${U.esc(st.fam)}`, rows, onAdd: () => ({ codigo: '', componente: '', ubicacion: '', tipoComponente: 'Pasador', gramos: 10, frecHoras: 10, frecDias: 1 }),
      cols: [{ k: 'codigo', t: 'Código' }, { k: 'componente', t: 'Componente' }, { k: 'ubicacion', t: 'Ubicación' }, { k: 'tipoComponente', t: 'Tipo', opts: cfg.tiposComponente }, { k: 'gramos', t: 'g/punto', num: true }, { k: 'frecHoras', t: 'Frec. h/km', num: true }, { k: 'frecDias', t: 'Frec. días', num: true }],
      onSave: async rows => {
        rows = rows.filter(r => r.codigo && r.componente);
        const c = rows.map(r => r.codigo.toUpperCase()); if (new Set(c).size !== c.length) throw new Error('Códigos duplicados en la plantilla.');
        rows.forEach(r => { if ([r.gramos, r.frecHoras, r.frecDias].some(v => v !== null && v < 0)) throw new Error(`${r.codigo}: valores negativos.`); if (!r.frecHoras && !r.frecDias) throw new Error(`${r.codigo}: indique una frecuencia.`); });
        cfg.plantillasEngrase[st.fam] = rows; await save(cfg, 'Plantilla guardada');
      } });
  }

  function layouts(root) {
    const cfg = C.cfg();
    const fams = cfg.familias;
    const desc = l => l === null || l === undefined ? 'Sin plantilla (configuración manual)' : `${(l.ejes || []).map(e => e.tipo === 'dual' ? 'D' : 'S').join('-') || 'sin ejes'} · ${C.posiciones(l).length} posiciones${l.repuestos ? ` (${l.repuestos} repuesto)` : ''}`;
    root.innerHTML = `<div class="card"><h3>Distribución de neumáticos por familia</h3><div class="info-box mb">Plantilla que se aplica al importar o crear un equipo. Cada equipo puede modificarse individualmente en Control de Neumáticos → Configurar distribución. Notación: S = eje simple (2 neumáticos), D = eje dual (4).</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th class="nosort">Familia</th><th class="nosort">Ejes (S/D separados por guion)</th><th class="nosort num">Repuestos</th><th class="nosort">Resultado</th></tr></thead><tbody>
      ${fams.map(f => { const l = cfg.layoutsNeum[f]; return `<tr data-f="${U.esc(f)}"><td><b>${U.esc(f)}</b></td><td><input class="lx" value="${l === null || l === undefined ? '' : (l.ejes || []).map(e => e.tipo === 'dual' ? 'D' : 'S').join('-') || '0'}" placeholder="Vacío = manual · 0 = sin ejes · ej. S-D-D" style="width:240px"></td><td class="num"><input class="lr" type="number" min="0" max="4" value="${l ? l.repuestos || 0 : 0}" style="width:60px"></td><td class="small muted">${desc(l)}</td></tr>`; }).join('')}
      </tbody></table></div><div class="flex mt"><span class="spacer"></span><button class="btn btn-orange" id="lSave">Guardar plantillas</button></div></div>`;
    root.querySelector('#lSave').onclick = async () => {
      try {
        root.querySelectorAll('tbody tr').forEach(tr => {
          const f = tr.dataset.f, v = tr.querySelector('.lx').value.trim().toUpperCase(), r = Math.max(0, Math.min(4, parseInt(tr.querySelector('.lr').value) || 0));
          if (!v) { cfg.layoutsNeum[f] = null; return; }
          if (v === '0') { cfg.layoutsNeum[f] = { ejes: [], repuestos: r }; return; }
          const parts = v.split(/[-,\s]+/).filter(Boolean);
          if (parts.some(p => !['S', 'D'].includes(p))) throw new Error(`${f}: use solo S o D separados por guion.`);
          const prev = cfg.layoutsNeum[f] && cfg.layoutsNeum[f].ejes || [];
          cfg.layoutsNeum[f] = { ejes: parts.map((p, i) => ({ nombre: (prev[i] && prev[i].nombre) || `Eje ${i + 1}`, tipo: p === 'D' ? 'dual' : 'simple' })), repuestos: r };
        });
        await save(cfg, 'Plantillas de neumáticos guardadas');
      } catch (e) { U.toast(e.message, 'bad'); }
    };
  }

  V.backup = async () => {
    U.toast('Preparando la copia de seguridad (incluye fotos)…');
    let data; try { data = await EQ.DB.exportAllFull(); } catch (e) { data = EQ.DB.exportAll(); }
    U.download(JSON.stringify(data), `respaldo_engrase_neumaticos_${U.today()}.json`, 'application/json');
    EQ.DB.audit('sistema', '*', 'Copia de seguridad', 'Exportación JSON completa');
    U.toast('Copia de seguridad descargada', 'ok');
  };

  function datos(root) {
    const counts = Object.keys(EQ.DB.STORES).map(k => [k, S[k].length]);
    root.innerHTML = `<div class="grid g2">
      <div class="card"><h3>Copia de seguridad y restauración</h3>
        <p class="muted">Los datos se guardan en la nube de Mantify (Firestore) y los ve todo el personal en tiempo real. La copia de seguridad descarga todo en un archivo JSON (con fotos); sirve también para traer los datos de la versión anterior que se usaba sin conexión.</p>
        <div class="flex"><button class="btn btn-orange" id="dBk">⭳ Descargar copia de seguridad (JSON)</button><button class="btn" id="dXl">⭳ Exportar todo a Excel</button></div>
        <div class="flex mt"><button class="btn btn-outline" id="dRsM">⭱ Restaurar – combinar</button><button class="btn btn-outline" id="dRsR">⭱ Restaurar – reemplazar todo</button></div>
        <div class="small muted mt">Combinar: agrega/actualiza registros por identificador único sin borrar los existentes. Reemplazar: borra los datos del módulo en la nube y carga el respaldo.</div>
        <div class="section-title">Zona de riesgo</div><button class="btn btn-bad" id="dWipe">Borrar todos los datos de Engrase y Neumáticos</button></div>
      <div class="card"><h3>Contenido de la base (nube)</h3><table class="tbl"><thead><tr><th class="nosort">Tabla</th><th class="nosort num">Registros</th></tr></thead><tbody>${counts.map(([k, n]) => `<tr><td>${k}</td><td class="num">${n}</td></tr>`).join('')}</tbody></table>
        <div class="info-box mt"><b>Base de datos compartida:</b> integrado en Mantify. Los equipos se toman de la flota de Mantify (por código) y los cambios se sincronizan con todo el personal.</div></div></div>`;
    const admin = EQ.Bridge && EQ.Bridge.isAdmin();
    if (!admin) ['dRsM', 'dRsR', 'dWipe'].forEach(id => { const b = root.querySelector('#' + id); if (b) { b.disabled = true; b.title = 'Solo el planner'; } });
    root.querySelector('#dBk').onclick = V.backup;
    root.querySelector('#dXl').onclick = () => {
      const sheets = Object.keys(EQ.DB.STORES).filter(k => S[k].length && k !== 'config').map(k => {
        const keys = [...new Set(S[k].flatMap(o => Object.keys(o)))];
        return { name: k, aoa: [keys].concat(S[k].map(o => keys.map(x => { const v = o[x]; if (typeof v === 'string' && v.startsWith('data:')) return '[imagen]'; if (Array.isArray(v)) return v.map(y => typeof y === 'string' && y.startsWith('data:') ? '[imagen]' : y).join(', '); if (v && typeof v === 'object') return JSON.stringify(v); return v === null || v === undefined ? '' : v; }))) };
      });
      if (!sheets.length) { U.toast('No hay datos para exportar', 'bad'); return; }
      U.downloadXLSX(sheets, `base_engrase_neumaticos_${U.today()}.xlsx`);
    };
    const restore = async mode => {
      const f = await U.pickFile('.json'); if (!f) return;
      try {
        const data = JSON.parse(await U.readFileText(f));
        if (!data.stores) throw new Error('El archivo no es una copia de seguridad de esta aplicación.');
        const n = Object.values(data.stores).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
        if (!(await U.confirm(`Se ${mode === 'replace' ? '<b>reemplazará toda la base local</b> con' : 'combinarán'} ${n} registros del respaldo del ${U.fdatetime(data.exportado)}. ¿Continuar?`))) return;
        if (mode === 'replace') await V.backup();
        await EQ.DB.importAll(data, mode);
        U.toast('Restauración completada', 'ok'); EQ.App.refresh();
      } catch (e) { U.toast('Error al restaurar: ' + e.message, 'bad'); }
    };
    root.querySelector('#dRsM').onclick = () => restore('merge');
    root.querySelector('#dRsR').onclick = () => restore('replace');
    root.querySelector('#dWipe').onclick = async () => {
      const v = await U.prompt('Escriba BORRAR para confirmar. Se descargará antes una copia de seguridad.', '', 'Borrar base de datos');
      if (v !== 'BORRAR') { if (v !== null) U.toast('Confirmación incorrecta', 'bad'); return; }
      await V.backup(); await EQ.DB.wipe(); await EQ.DB.put('config', JSON.parse(JSON.stringify(EQ.DEFAULT_CONFIG)), { noAudit: true }); U.toast('Base de datos borrada', 'ok'); EQ.App.go('dashboard');
    };
  }

  EQ.Views.configuracion = V;
})();
