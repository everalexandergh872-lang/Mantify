/* MÓDULO 01 – CONTROL DE ENGRASE Y LUBRICACIÓN */
(function () {
  const U = EQ.U, S = EQ.S, C = EQ.C;
  EQ.Views = EQ.Views || {};
  const V = {};
  const TABS = [['programa', 'Programa mensual (F-MT-18-TM)'], ['control', 'Control diario'], ['consumo', 'Estatus: puntos, kg y costos'], ['cumplimiento', 'Cumplimiento'], ['prioridad', 'Prioridad / días sin engrase'], ['plan', 'Equipos del plan'], ['ficha', 'Ficha, plan y puntos'], ['registros', 'Detalle por punto'], ['flota', 'Estado de puntos']];

  V.render = root => {
    const App = EQ.App;
    if (!C.equiposActivos().length) { root.innerHTML = `<div class="card">${U.emptyState('⛽', 'No hay equipos cargados', 'Importe primero el maestro de equipos de su aplicación Backlog.', '<a class="btn btn-orange" href="#/equipos">Ir al Maestro de Equipos</a> <button class="btn" id="engImpXl">⭱ Importar Excel F-MT-18-TM (maestro + programa + control diario)</button>')}</div>`; root.querySelector('#engImpXl').onclick = () => EQ.XL.importarDialog(); return; }
    let tab = App.tab('engrase', 'programa');
    if (tab === 'registro') tab = 'control';
    root.innerHTML = App.tabsHtml('engrase', TABS, tab) + '<div id="engBody"></div>';
    App.wireTabs(root, 'engrase');
    const body = root.querySelector('#engBody');
    const P = EQ.EngProg;
    if (!C.equiposEngrase().length && !['plan', 'consumo', 'registros'].includes(tab)) { body.innerHTML = `<div class="card">${U.emptyState('⊘', 'Ningún equipo está en el plan de engrase', 'Todos los equipos activos fueron quitados del plan de engrase. Vuelva a incluir los que correspondan.', '<button class="btn btn-orange" id="goPlan">Ir a "Equipos del plan"</button>')}</div>`; body.querySelector('#goPlan').onclick = () => App.setTab('engrase', 'plan'); return; }
    ({ programa: P.programa, control: P.control, cumplimiento: P.cumplimiento, prioridad: P.prioridad, plan: renderPlan, ficha: renderFicha, flota: renderFlota, consumo: renderConsumo, registros: renderRegistros })[tab](body);
  };

  // ---------------- A/B. FICHA Y PUNTOS ----------------
  function renderFicha(root) {
    const App = EQ.App;
    root.innerHTML = `<div class="selector-bar"><b>Equipo:</b> ${App.eqSelector(root, { modulo: 'engrase' })} <span class="legend-inline">${U.pill('verde', 'Dentro del intervalo')} ${U.pill('amarillo', 'Próximo a vencer')} ${U.pill('rojo', 'Vencido')} ${U.pill('gris', 'Sin configuración')}</span></div><div id="fichaBody"></div>`;
    App.wireEqSelector(root);
    const eq = C.eq(App.state.eqId);
    const b = root.querySelector('#fichaBody');
    const pts = C.puntosEq(eq.id);
    const act = pts.filter(p => p.activo !== false);
    const grasas = [...new Set(act.map(p => p.tipoGrasa).filter(Boolean))];
    const frecs = act.map(p => Number(p.frecHoras)).filter(x => x > 0);
    const res = C.resumenEngraseEq(eq);
    const un = C.unidad(eq);
    b.innerHTML = `
      <div class="card mb"><h3>Ficha de lubricación · ${U.esc(eq.codigo)} <span class="right">
        <button class="btn btn-outline btn-sm" id="bEdEq">✎ Editar equipo</button>
        <button class="btn btn-outline btn-sm" id="bLec">⏱ Actualizar ${C.lecturaLbl(eq).toLowerCase()}</button>
        <button class="btn btn-outline btn-sm" id="bQuit" title="El equipo no se engrasará: sale del plan, del programa mensual y de las alertas de engrase">⊘ Quitar del plan de engrase</button></span></h3>
        <div class="ficha">
          ${[['Código', eq.codigo], ['Descripción', eq.descripcion], ['Marca', eq.marca], ['Modelo', eq.modelo], ['Serie', eq.serie], ['Familia', eq.familia], ['Ubicación', eq.ubicacion],
            [C.lecturaLbl(eq) + ' actual', eq.horometro === null || eq.horometro === undefined ? '—' : `${U.num(eq.horometro, 1)} ${un}`], ['Uso promedio', `${U.num(C.usoDia(eq), 1)} ${un}/día`], ['Sistema de lubricación', eq.sistemaLubricacion],
            ['Puntos de engrase (activos)', `${act.length}${pts.length !== act.length ? ` <span class="muted small">(+${pts.length - act.length} inactivos)</span>` : ''}`],
            ['Tipo de grasa utilizada', eq.tipoGrasa || grasas.join(', ') || '—'],
            ['Precio grasa', (() => { const g = C.grasaEq(eq); return g ? `${U.money(C.precioGrasa(g))}/kg · ${U.money(C.precioPunto(g))}/punto (${U.usd(C.precioGrasaUSD(g))}/kg · ${U.usd(C.precioPuntoUSD(g))}/punto)` : '—'; })()],
            ['Frecuencia de engrase', eq.frecuenciaEngrase ? `${eq.frecuenciaEngrase} ${un}` : frecs.length ? `${Math.min(...frecs)}–${Math.max(...frecs)} ${un}` : '—']]
            .map(([k, v]) => `<div><div class="k">${k}</div><div class="v">${typeof v === 'string' && v.includes('<span') ? v : U.esc(v || '—')}</div></div>`).join('')}
        </div>
        <div class="kpis mt">
          <div class="kpi ok"><div class="lbl">Al día</div><div class="val">${res.verde}</div></div>
          <div class="kpi warn"><div class="lbl">Próximos</div><div class="val">${res.amarillo}</div></div>
          <div class="kpi bad"><div class="lbl">Vencidos</div><div class="val">${res.rojo}</div></div>
          <div class="kpi gray"><div class="lbl">Sin configuración / línea base</div><div class="val">${res.gris}</div></div>
          <div class="kpi orange"><div class="lbl">Grasa por ciclo completo</div><div class="val">${U.num(act.reduce((s, p) => s + (Number(p.gramos) || 0), 0) / 1000, 2)} kg</div></div>
        </div>
      </div>
      <div class="card mb" id="planCard"></div>
      <div class="card"><h3>Puntos de engrase <span class="muted small" style="font-weight:normal">— EG engrasa todos los puntos activos; EP solo los marcados "Incluido en EP"</span><span class="right">
        <button class="btn btn-sm" id="bTpl">⧉ Aplicar plantilla</button>
        <button class="btn btn-sm btn-outline" id="bBase">⚑ Establecer línea base</button>
        <button class="btn btn-sm btn-orange" id="bNewP">+ Nuevo punto</button>
        <button class="btn btn-sm btn-ok" id="bReg">✓ Registrar EG / EP</button></span></h3>
        ${pts.length ? '<div id="tblP"></div>' : U.emptyState('🛢', 'Sin puntos de engrase', `Aplique la plantilla de <b>${U.esc(eq.familia || 'su familia')}</b> o cree los puntos manualmente. Las cantidades y frecuencias de las plantillas son referenciales.`)}
      </div>`;
    b.querySelector('#bEdEq').onclick = () => EQ.Views.equipos.formEquipo(eq);
    b.querySelector('#bLec').onclick = () => EQ.Views.equipos.lecturaDialog(eq, () => App.refresh());
    b.querySelector('#bQuit').onclick = () => EQ.Views.equipos.cambiarAlcance([eq], 'engrase', false);
    b.querySelector('#bTpl').onclick = () => V.dialogPlantilla(eq);
    b.querySelector('#bBase').onclick = () => V.lineaBase(eq);
    b.querySelector('#bNewP').onclick = () => V.formPunto(eq, null);
    b.querySelector('#bReg').onclick = () => EQ.EngProg.registrarDialog(eq);
    EQ.EngProg.planCard(b.querySelector('#planCard'), eq);
    if (!pts.length) return;
    U.table(b.querySelector('#tblP'), {
      exportName: `puntos_engrase_${eq.codigo}`, rows: pts.map(p => Object.assign({}, p, { _st: C.estadoPunto(p, eq) })),
      rowClass: r => r.activo === false ? 'inactive' : '',
      cols: [
        { k: '_st', t: 'Estado', sort: r => ({ rojo: 0, amarillo: 1, gris: 2, verde: 3, inactivo: 4 })[r._st.estado], fmt: (v, r) => C.pillPunto(v) + (v.motivo ? `<div class="small muted">${U.esc(v.motivo)}</div>` : ''), text: r => r._st.label },
        { k: 'codigo', t: 'Código', fmt: v => `<b>${U.esc(v)}</b>` },
        { k: 'enParcial', t: 'Incluido en EP', sort: r => r.enParcial ? 1 : 0, fmt: (v, r) => `<input type="checkbox" data-ep="${r.id}" ${v ? 'checked' : ''} title="Incluir en engrase parcial">`, text: r => r.enParcial ? 'Sí' : 'No' },
        { k: 'componente', t: 'Componente' }, { k: 'ubicacion', t: 'Ubicación' }, { k: 'tipoComponente', t: 'Tipo' },
        { k: 'tipoGrasa', t: 'Grasa' }, { k: 'nlgi', t: 'NLGI' },
        { k: 'gramos', t: 'g/punto', num: true },
        { k: 'frecHoras', t: `Frec. (${un})`, num: true }, { k: 'frecDias', t: 'Frec. (días)', num: true },
        { k: 'ultimaFecha', t: 'Último engrase', fmt: v => U.fdate(v), text: r => r.ultimaFecha || '' },
        { k: 'ultimoHorometro', t: `Último ${un}`, num: true, fmt: v => U.num(v, 1) },
        { k: 'px', t: `Próximo ${un}`, num: true, sort: r => r._st.proxHor, fmt: (v, r) => U.num(r._st.proxHor, 1), text: r => r._st.proxHor },
        { k: 'rest', t: `Restan (${un})`, num: true, sort: r => r._st.restantes, fmt: (v, r) => r._st.restantes === null ? '—' : `<b style="color:${r._st.restantes <= 0 ? 'var(--bad)' : 'inherit'}">${U.num(r._st.restantes, 1)}</b>`, text: r => r._st.restantes },
        { k: 'pf', t: 'Próxima fecha', sort: r => r._st.proxFecha, fmt: (v, r) => r._st.proxFecha ? `${U.fdate(r._st.proxFecha)} <span class="small muted">(${r._st.diasRest} d)</span>` : '—', text: r => r._st.proxFecha || '' },
        { k: 'responsable', t: 'Responsable' }, { k: 'observaciones', t: 'Observaciones' },
        { k: 'acc', t: '', nosort: true, noexport: true, fmt: (v, r) => `<div class="flex" style="flex-wrap:nowrap"><button class="btn btn-ghost btn-sm" data-a="ed" data-id="${r.id}" title="Editar">✎</button><button class="btn btn-ghost btn-sm" data-a="tg" data-id="${r.id}" title="${r.activo === false ? 'Activar' : 'Desactivar'}">${r.activo === false ? '↺' : '⊘'}</button><button class="btn btn-ghost btn-sm" data-a="dl" data-id="${r.id}" title="Eliminar">🗑</button></div>` }
      ]
    });
    b.querySelector('#tblP').addEventListener('change', async e => {
      const c = e.target.closest('[data-ep]'); if (!c) return;
      const p = S.puntos.find(q => q.id === c.dataset.ep); p.enParcial = c.checked; await EQ.DB.put('puntos', p); U.toast(`${p.codigo}: ${p.enParcial ? 'incluido en' : 'excluido de'} EP`, 'ok');
    });
    b.querySelector('#tblP').addEventListener('click', async e => {
      const x = e.target.closest('[data-a]'); if (!x) return;
      const p = S.puntos.find(q => q.id === x.dataset.id);
      if (x.dataset.a === 'ed') V.formPunto(eq, p);
      if (x.dataset.a === 'tg') { p.activo = p.activo === false; await EQ.DB.put('puntos', p); U.toast(p.activo ? 'Punto activado' : 'Punto desactivado', 'ok'); App.refresh(); }
      if (x.dataset.a === 'dl') {
        const n = S.engrases.filter(r => r.puntoId === p.id).length;
        if (await U.confirm(`¿Eliminar el punto <b>${U.esc(p.codigo)} – ${U.esc(p.componente)}</b>?${n ? `<br><br><span class="warn-box" style="display:block">Tiene ${n} registros de engrase que se conservarán en el historial. Se recomienda <b>desactivarlo</b> en su lugar.</span>` : ''}`)) { await EQ.DB.del('puntos', p.id); App.refresh(); }
      }
    });
  }

  V.formPunto = (eq, p) => {
    const cfg = C.cfg(), isNew = !p, un = C.unidad(eq);
    p = p || { activo: true, tipoGrasa: eq.tipoGrasa || (cfg.tiposGrasa[0] || {}).nombre, frecHoras: eq.frecuenciaEngrase || null };
    const body = `<form class="form-grid" id="fP">
      ${U.field('codigo', 'Código del punto', { value: p.codigo, req: true })}
      ${U.field('componente', 'Componente', { value: p.componente, req: true })}
      ${U.field('ubicacion', 'Ubicación en el equipo', { value: p.ubicacion })}
      ${U.field('tipoComponente', 'Tipo de componente', { type: 'select', options: cfg.tiposComponente, value: p.tipoComponente })}
      ${U.field('tipoGrasa', 'Tipo de grasa', { type: 'select', options: cfg.tiposGrasa.map(g => g.nombre), value: p.tipoGrasa, req: true })}
      ${U.field('nlgi', 'Especificación NLGI', { value: p.nlgi || (C.grasa(p.tipoGrasa) || {}).nlgi || '' })}
      ${U.field('gramos', 'Cantidad por punto (g)', { type: 'number', value: p.gramos, req: true, attrs: 'min="0"' })}
      ${U.field('frecHoras', `Frecuencia (${un})`, { type: 'number', value: p.frecHoras, attrs: 'min="0"', hint: 'Lo que ocurra primero entre horas y días' })}
      ${U.field('frecDias', 'Frecuencia alternativa (días)', { type: 'number', value: p.frecDias, attrs: 'min="0"' })}
      ${U.field('ultimaFecha', 'Último engrase (fecha)', { type: 'date', value: p.ultimaFecha, attrs: `max="${U.today()}"` })}
      ${U.field('ultimoHorometro', `Último ${C.lecturaLbl(eq).toLowerCase()} (${un})`, { type: 'number', value: p.ultimoHorometro, attrs: 'min="0"' })}
      <div class="fld"><label>Próximo ${un} / fecha</label><input id="pxCalc" readonly></div>
      ${U.field('responsable', 'Responsable', { type: 'datalist', options: cfg.responsables.concat(cfg.tecnicos), value: p.responsable })}
      <div class="fld"><label>Engrase parcial (EP)</label><label class="flex"><input type="checkbox" name="enParcial" ${p.enParcial ? 'checked' : ''}> Incluir este punto en el EP</label></div>
      ${U.field('observaciones', 'Observaciones', { type: 'textarea', value: p.observaciones, cls: 'full' })}
    </form>`;
    U.modal({ title: isNew ? `Nuevo punto de engrase · ${eq.codigo}` : `Editar punto ${p.codigo}`, size: 'lg', body,
      onOpen: m => {
        const f = m.querySelector('#fP');
        const calc = () => { const d = U.formData(f); const px = d.ultimoHorometro !== null && d.frecHoras ? `${U.num(d.ultimoHorometro + d.frecHoras, 1)} ${un}` : '—'; const pf = d.ultimaFecha && d.frecDias ? U.fdate(U.addDays(d.ultimaFecha, d.frecDias)) : '—'; m.querySelector('#pxCalc').value = `${px} · ${pf}`; };
        f.addEventListener('input', calc); calc();
        f.querySelector('[name=tipoGrasa]').addEventListener('change', e => { const g = C.grasa(e.target.value); if (g) f.querySelector('[name=nlgi]').value = g.nlgi; });
      },
      buttons: [{ label: 'Cancelar', cls: 'btn-outline' }, { label: 'Guardar', cls: 'btn-orange', onClick: async m => {
        const f = m.querySelector('#fP'); const d = U.formData(f);
        U.requireFields(f, d, ['codigo', 'componente', 'tipoGrasa', 'gramos']);
        const neg = ['gramos', 'frecHoras', 'frecDias', 'ultimoHorometro'].filter(k => d[k] !== null && d[k] < 0);
        if (neg.length) { U.markInvalid(f, neg); throw new Error('No se permiten valores negativos.'); }
        if (!d.frecHoras && !d.frecDias) { U.markInvalid(f, ['frecHoras', 'frecDias']); throw new Error('Configure al menos una frecuencia (horas/km o días).'); }
        if (d.ultimaFecha && d.ultimaFecha > U.today()) { U.markInvalid(f, ['ultimaFecha']); throw new Error('Fecha incorrecta: el último engrase no puede ser futuro.'); }
        if (d.ultimoHorometro !== null && eq.horometro !== null && eq.horometro !== undefined && d.ultimoHorometro > eq.horometro) { U.markInvalid(f, ['ultimoHorometro']); throw new Error(`El último ${un} (${d.ultimoHorometro}) no puede ser mayor a la lectura actual del equipo (${eq.horometro}).`); }
        const dup = S.puntos.find(q => q.equipoId === eq.id && q.id !== p.id && String(q.codigo).toUpperCase() === d.codigo.toUpperCase());
        if (dup) { U.markInvalid(f, ['codigo']); throw new Error('Ya existe un punto con ese código en el equipo.'); }
        Object.assign(p, d, { equipoId: eq.id });
        await EQ.DB.put('puntos', p);
        U.toast('Punto guardado', 'ok'); EQ.App.refresh();
      } }] });
  };

  V.aplicarPlantilla = async (eq, familia, silent, modo = 'faltantes') => {
    const cfg = C.cfg();
    const tpl = cfg.plantillasEngrase[familia] || [];
    const grasa = eq.tipoGrasa || (cfg.tiposGrasa[0] || {}).nombre;
    const g = C.grasa(grasa) || {};
    let n = 0;
    if (modo === 'reemplazar') for (const p of C.puntosEq(eq.id, true)) { p.activo = false; await EQ.DB.put('puntos', p, { motivo: 'Reemplazo por plantilla' }); }
    const nuevos = [];
    const minF = Math.min(...tpl.map(t => Number(t.frecHoras) || Infinity));
    tpl.forEach(t => {
      const ex = S.puntos.find(q => q.equipoId === eq.id && String(q.codigo).toUpperCase() === t.codigo.toUpperCase());
      if (ex && modo !== 'reemplazar') return;
      if (ex && modo === 'reemplazar') { Object.assign(ex, t, { activo: true }); nuevos.push(ex); n++; return; }
      nuevos.push(Object.assign({ equipoId: eq.id, tipoGrasa: grasa, nlgi: g.nlgi || '', activo: true, ultimaFecha: null, ultimoHorometro: null, plantilla: familia, enParcial: (Number(t.frecHoras) || Infinity) <= minF }, t)); n++;
    });
    if (nuevos.length) await EQ.DB.bulkPut('puntos', nuevos, { motivo: `Plantilla ${familia} en ${eq.codigo}` });
    if (!silent) U.toast(`${n} punto(s) aplicados desde la plantilla ${familia}`, 'ok');
    return n;
  };

  V.dialogPlantilla = eq => {
    const cfg = C.cfg();
    const fams = Object.keys(cfg.plantillasEngrase);
    U.modal({ title: `Aplicar plantilla de engrase · ${eq.codigo}`, body: `
      <div class="form-grid" id="fT">
        ${U.field('familia', 'Plantilla', { type: 'select', options: fams.map(f => ({ v: f, t: `${f} (${cfg.plantillasEngrase[f].length} puntos)` })), value: eq.familia, empty: undefined })}
        ${U.field('modo', 'Modo', { type: 'select', options: [{ v: 'faltantes', t: 'Agregar solo puntos faltantes' }, { v: 'reemplazar', t: 'Reemplazar (desactiva los actuales)' }], value: 'faltantes', empty: undefined })}
      </div>
      <div id="tplPrev" class="mt"></div>
      <div class="warn-box mt">Las cantidades (g) y frecuencias son <b>referenciales</b>. Verifíquelas y ajústelas según el manual del fabricante. Puede editar las plantillas en Configuración.</div>`,
      onOpen: m => { const s = m.querySelector('[name=familia]'); const pv = () => { const t = cfg.plantillasEngrase[s.value] || []; m.querySelector('#tplPrev').innerHTML = `<div class="tbl-wrap" style="max-height:260px"><table class="tbl"><thead><tr><th>Código</th><th>Componente</th><th>Ubicación</th><th class="num">g</th><th class="num">Frec. h</th><th class="num">Días</th></tr></thead><tbody>${t.map(p => `<tr><td>${U.esc(p.codigo)}</td><td>${U.esc(p.componente)}</td><td>${U.esc(p.ubicacion)}</td><td class="num">${p.gramos}</td><td class="num">${p.frecHoras}</td><td class="num">${p.frecDias || ''}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Plantilla vacía</td></tr>'}</tbody></table></div>`; }; s.onchange = pv; pv(); },
      buttons: [{ label: 'Cancelar', cls: 'btn-outline' }, { label: 'Aplicar', cls: 'btn-orange', onClick: async m => { const d = U.formData(m.querySelector('#fT')); await V.aplicarPlantilla(eq, d.familia, false, d.modo); EQ.App.refresh(); } }] });
  };

  V.lineaBase = eq => {
    const pts = C.puntosEq(eq.id, true);
    if (!pts.length) { U.toast('El equipo no tiene puntos activos', 'bad'); return; }
    const un = C.unidad(eq);
    U.modal({ title: `Establecer línea base · ${eq.codigo}`, body: `<p>Define el último engrase de los puntos seleccionados (sin consumo de grasa) para iniciar el control. Use cuando el equipo ya estaba siendo engrasado antes de usar esta aplicación.</p>
      <form class="form-grid" id="fB">${U.field('fecha', 'Fecha', { type: 'date', value: U.today(), req: true, attrs: `max="${U.today()}"` })}${U.field('horometro', `${C.lecturaLbl(eq)} (${un})`, { type: 'number', value: eq.horometro, req: true, attrs: 'min="0"' })}
      ${U.field('alcance', 'Aplicar a', { type: 'select', options: [{ v: 'sin', t: 'Solo puntos sin línea base' }, { v: 'todos', t: 'Todos los puntos activos' }], value: 'sin', empty: undefined })}</form>`,
      buttons: [{ label: 'Cancelar', cls: 'btn-outline' }, { label: 'Establecer', cls: 'btn-orange', onClick: async m => {
        const f = m.querySelector('#fB'); const d = U.formData(f);
        U.requireFields(f, d, ['fecha', 'horometro']);
        if (d.fecha > U.today()) throw new Error('Fecha incorrecta: no puede ser futura.');
        if (d.horometro < 0) throw new Error('Horómetro negativo no permitido.');
        C.validarLecturaEnFecha(eq, d.horometro, d.fecha);
        await C.registrarLecturaFecha(eq, d.horometro, d.fecha, 'línea base engrase');
        const iid = EQ.DB.uid(); let n = 0;
        for (const p of pts) {
          if (d.alcance === 'sin' && C.estadoPunto(p, eq).label !== 'Sin línea base') continue;
          p.ultimaFecha = d.fecha; p.ultimoHorometro = d.horometro; await EQ.DB.put('puntos', p, { motivo: 'Línea base' });
          await EQ.DB.put('engrases', { intervencionId: iid, fecha: d.fecha, equipoId: eq.id, puntoId: p.id, codigoPunto: p.codigo, componente: p.componente, horometro: d.horometro, gramos: 0, tipoGrasa: p.tipoGrasa, tecnico: '', resultado: 'Línea base', observaciones: 'Línea base inicial' }, { noAudit: true });
          n++;
        }
        U.toast(`Línea base establecida en ${n} punto(s)`, 'ok'); EQ.App.refresh();
      } }] });
  };

  // Recalcula el último engrase de un punto a partir de los registros (tras eliminar)
  V.recalcPunto = async p => {
    const cfg = C.cfg();
    const valid = S.engrases.filter(r => r.puntoId === p.id && (r.resultado === 'Ejecutado' || r.resultado === 'Línea base' || (r.resultado === 'Parcial' && cfg.umbrales.parcialActualiza)))
      .sort((a, b) => (a.fecha + String(a.horometro).padStart(12, '0')) < (b.fecha + String(b.horometro).padStart(12, '0')) ? 1 : -1);
    const last = valid[0];
    p.ultimaFecha = last ? last.fecha : null; p.ultimoHorometro = last ? last.horometro : null;
    await EQ.DB.put('puntos', p, { motivo: 'Recálculo tras eliminar registro' });
  };

  // ---------------- D. ESTADO DE FLOTA ----------------
  function renderFlota(root) {
    const cfg = C.cfg();
    const st = EQ.App.state.flotaF || (EQ.App.state.flotaF = { estado: '', familia: '' });
    const eqs = C.equiposEngrase().filter(e => !st.familia || e.familia === st.familia);
    const rows = [];
    eqs.forEach(eq => C.puntosEq(eq.id, true).forEach(p => { const s = C.estadoPunto(p, eq); if (!st.estado || s.estado === st.estado) rows.push(Object.assign({}, p, { _eq: eq, _st: s })); }));
    const res = eqs.map(eq => Object.assign({ eq }, C.resumenEngraseEq(eq)));
    root.innerHTML = `
      <div class="selector-bar"><b>Filtros:</b>
        <select id="fFam">${U.opts(cfg.familias, st.familia, 'Todas las familias')}</select>
        <select id="fEst">${U.opts([{ v: 'rojo', t: 'Vencidos' }, { v: 'amarillo', t: 'Próximos a vencer' }, { v: 'verde', t: 'Dentro del intervalo' }, { v: 'gris', t: 'Sin configuración / línea base' }], st.estado, 'Todos los estados')}</select></div>
      <div class="grid g2">
        <div class="card"><h3>Resumen por equipo</h3><div id="tRes"></div></div>
        <div class="card"><h3>Estado de puntos de engrase</h3><div class="chart-box"><canvas id="chFl"></canvas></div></div>
      </div>
      <div class="card mt"><h3>Detalle de puntos (${rows.length})</h3><div id="tDet"></div></div>`;
    root.querySelector('#fFam').onchange = e => { st.familia = e.target.value; EQ.App.refresh(); };
    root.querySelector('#fEst').onchange = e => { st.estado = e.target.value; EQ.App.refresh(); };
    U.table(root.querySelector('#tRes'), { exportName: 'resumen_engrase_equipos', rows: res.filter(r => r.total), search: true, cols: [
      { k: 'c', t: 'Equipo', sort: r => r.eq.codigo, fmt: (v, r) => `<a href="#/engrase" data-eq="${r.eq.id}"><b>${U.esc(r.eq.codigo)}</b></a> <span class="small muted">${U.esc(r.eq.descripcion || '')}</span>`, text: r => r.eq.codigo },
      { k: 'total', t: 'Puntos', num: true }, { k: 'rojo', t: 'Vencidos', num: true, fmt: v => v ? `<b style="color:var(--bad)">${v}</b>` : 0 }, { k: 'amarillo', t: 'Próximos', num: true }, { k: 'verde', t: 'Al día', num: true }, { k: 'gris', t: 'Sin base', num: true },
      { k: 'peor', t: 'Estado', fmt: v => U.pill(v, { rojo: 'Pendiente vencido', amarillo: 'Programar', verde: 'Al día', gris: 'Sin datos' }[v]) }] });
    root.querySelector('#tRes').addEventListener('click', e => { const a = e.target.closest('[data-eq]'); if (a) { e.preventDefault(); EQ.App.state.eqId = a.dataset.eq; EQ.App.state.tab.engrase = 'ficha'; EQ.App.refresh(); } });
    const tot = { verde: 0, amarillo: 0, rojo: 0, gris: 0 }; res.forEach(r => ['verde', 'amarillo', 'rojo', 'gris'].forEach(k => tot[k] += r[k]));
    U.chart('chFl', { type: 'bar', data: { labels: ['Dentro del intervalo', 'Próximos', 'Vencidos', 'Sin config./base'], datasets: [{ label: 'Puntos', data: [tot.verde, tot.amarillo, tot.rojo, tot.gris], backgroundColor: [U.STATUS.verde, U.STATUS.amarillo, U.STATUS.rojo, U.STATUS.gris] }] } });
    U.table(root.querySelector('#tDet'), { exportName: 'estado_puntos_engrase', rows, cols: [
      { k: 'e', t: 'Equipo', sort: r => r._eq.codigo, fmt: (v, r) => `<b>${U.esc(r._eq.codigo)}</b>`, text: r => r._eq.codigo },
      { k: '_st', t: 'Estado', sort: r => ({ rojo: 0, amarillo: 1, gris: 2, verde: 3 })[r._st.estado], fmt: v => C.pillPunto(v), text: r => r._st.label },
      { k: 'codigo', t: 'Punto' }, { k: 'componente', t: 'Componente' }, { k: 'tipoGrasa', t: 'Grasa' }, { k: 'gramos', t: 'g', num: true },
      { k: 'ultimaFecha', t: 'Último', fmt: v => U.fdate(v), text: r => r.ultimaFecha },
      { k: 'px', t: 'Próximo h/km', num: true, sort: r => r._st.proxHor, fmt: (v, r) => U.num(r._st.proxHor, 1), text: r => r._st.proxHor },
      { k: 'rs', t: 'Restan', num: true, sort: r => r._st.restantes, fmt: (v, r) => r._st.restantes === null ? '—' : `${U.num(r._st.restantes, 1)} ${C.unidad(r._eq)}`, text: r => r._st.restantes },
      { k: 'pf', t: 'Próx. fecha', sort: r => r._st.proxFecha, fmt: (v, r) => U.fdate(r._st.proxFecha), text: r => r._st.proxFecha }] });
  }

  // ---------------- PLAN: EQUIPOS QUE SE ENGRASAN ----------------
  function renderPlan(root) {
    const cfg = C.cfg();
    const st = EQ.App.state.planF || (EQ.App.state.planF = { ver: 'todos', familia: '', sel: [] });
    const sel = new Set(st.sel);
    const all = C.equiposActivos();
    const eqs = all.filter(e => (!st.familia || e.familia === st.familia) && ({ todos: true, en: C.engraseAplica(e), fuera: !C.engraseAplica(e), prog: C.enPrograma(e), noprog: C.engraseAplica(e) && !C.enPrograma(e) })[st.ver]);
    const fuera = all.filter(e => !C.engraseAplica(e)).length;
    root.innerHTML = `
      <div class="info-box mb">Defina aquí qué equipos <b>se engrasan</b>. Un equipo "fuera del plan" no aparece en el programa mensual, el control diario, la prioridad ni las alertas de engrase (su historial se conserva y puede volver a incluirse). Para quitar un equipo solo de un mes use el ✕ del programa mensual. Para borrarlo del todo use el Maestro de Equipos.</div>
      <div class="selector-bar"><b>Mostrar:</b>
        <select id="plV">${U.opts([{ v: 'todos', t: `Todos (${all.length})` }, { v: 'en', t: `En el plan de engrase (${all.length - fuera})` }, { v: 'fuera', t: `Fuera del plan – no se engrasan (${fuera})` }, { v: 'prog', t: 'En el programa mensual' }, { v: 'noprog', t: 'En el plan pero fuera del programa' }], st.ver)}</select>
        <select id="plF">${U.opts(cfg.familias, st.familia, 'Todas las familias')}</select>
        <span class="spacer"></span><span class="muted small" id="plN">${sel.size} seleccionado(s)</span>
        <button class="btn btn-sm btn-outline" id="plAll">☑ Seleccionar los ${eqs.length} mostrados</button><button class="btn btn-sm btn-outline" id="plNone">☐ Ninguno</button>
        <button class="btn btn-sm btn-bad" id="plOut">⊘ Quitar del plan</button><button class="btn btn-sm btn-ok" id="plIn">↺ Incluir en el plan</button><button class="btn btn-sm btn-orange" id="plSet">✎ Asignar plan / grasa</button></div>
      <div class="card"><div id="plT"></div></div>`;
    const upd = () => { st.ver = root.querySelector('#plV').value; st.familia = root.querySelector('#plF').value; EQ.App.refresh(); };
    root.querySelector('#plV').onchange = upd; root.querySelector('#plF').onchange = upd;
    const selEqs = () => { const x = [...sel].map(C.eq).filter(Boolean); if (!x.length) U.toast('Seleccione al menos un equipo', 'bad'); return x; };
    root.querySelector('#plAll').onclick = () => { eqs.forEach(e => sel.add(e.id)); st.sel = [...sel]; EQ.App.refresh(); };
    root.querySelector('#plNone').onclick = () => { st.sel = []; EQ.App.refresh(); };
    root.querySelector('#plOut').onclick = async () => { const x = selEqs(); if (x.length && await EQ.Views.equipos.cambiarAlcance(x, 'engrase', false)) st.sel = []; };
    root.querySelector('#plIn').onclick = async () => { const x = selEqs(); if (x.length && await EQ.Views.equipos.cambiarAlcance(x, 'engrase', true)) st.sel = []; };
    root.querySelector('#plSet').onclick = () => { const x = selEqs(); if (x.length) V.asignarPlanMasivo(x); };
    U.table(root.querySelector('#plT'), { exportName: 'equipos_plan_engrase', rows: eqs, rowClass: r => C.engraseAplica(r) ? '' : 'inactive', cols: [
      { k: 'sel', t: '☑', nosort: true, noexport: true, fmt: (v, r) => `<input type="checkbox" data-s="${r.id}" ${sel.has(r.id) ? 'checked' : ''}>` },
      { k: 'codigo', t: 'Código', fmt: v => `<b>${U.esc(v)}</b>` }, { k: 'descripcion', t: 'Descripción' }, { k: 'familia', t: 'Familia' }, { k: 'placa', t: 'Placa' },
      { k: 'estadoMov', t: 'Estado', fmt: v => U.esc(v || 'MOVILIZADO'), text: r => r.estadoMov || 'MOVILIZADO' },
      { k: 'ap', t: 'Se engrasa', sort: r => C.engraseAplica(r) ? 1 : 0, fmt: (v, r) => C.engraseAplica(r) ? U.pill('verde', 'Sí') : U.pill('gris', 'No') + (r.motivoSinEngrase ? `<div class="small muted">${U.esc(r.motivoSinEngrase)}</div>` : ''), text: r => C.engraseAplica(r) ? 'Sí' : 'No' },
      { k: 'pg', t: 'Programa mensual', sort: r => C.enPrograma(r) ? 1 : 0, fmt: (v, r) => C.enPrograma(r) ? U.pill('info', 'Sí') : `<span class="muted small">${!C.engraseAplica(r) ? '—' : r.enPrograma === false ? 'No (excluido en la ficha)' : !C.movilizado(r) ? 'No (desmovilizado)' : 'No (familia excluida)'}</span>`, text: r => C.enPrograma(r) ? 'Sí' : 'No' },
      { k: 'pl', t: 'Plan EG/EP', sort: r => C.planTexto(C.plan(r)), fmt: (v, r) => `<span class="small">${U.esc(C.planTexto(C.plan(r)))}${r.planEngrase ? ' ✎' : ''}</span>`, text: r => C.planTexto(C.plan(r)) },
      { k: 'gr', t: 'Grasa', sort: r => C.grasaEq(r), fmt: (v, r) => U.esc(C.grasaEq(r)), text: r => C.grasaEq(r) },
      { k: 'pts', t: 'Puntos', num: true, sort: r => C.puntosEq(r.id, true).length, fmt: (v, r) => C.puntosEq(r.id, true).length, text: r => C.puntosEq(r.id, true).length },
      { k: 'ds', t: 'Días sin engrase', num: true, sort: r => C.enPrograma(r) ? C.diasSinEngrase(r) : -1, fmt: (v, r) => C.enPrograma(r) ? (C.diasSinEngrase(r) ?? '—') : '<span class="muted">NA</span>', text: r => C.enPrograma(r) ? C.diasSinEngrase(r) : 'NA' },
      { k: 'acc', t: '', nosort: true, noexport: true, fmt: (v, r) => `<div class="flex" style="flex-wrap:nowrap"><button class="btn btn-ghost btn-sm" data-pl="${r.id}" title="Editar plan">✎</button><button class="btn btn-ghost btn-sm" data-fi="${r.id}" title="Ficha y puntos">⛽</button>${C.engraseAplica(r) ? `<button class="btn btn-ghost btn-sm" data-out="${r.id}" title="Quitar del plan de engrase">⊘</button>` : `<button class="btn btn-ghost btn-sm" data-in="${r.id}" title="Incluir en el plan">↺</button>`}</div>` }] });
    const T = root.querySelector('#plT');
    T.addEventListener('change', e => { const c = e.target.closest('[data-s]'); if (!c) return; if (c.checked) sel.add(c.dataset.s); else sel.delete(c.dataset.s); st.sel = [...sel]; root.querySelector('#plN').textContent = `${sel.size} seleccionado(s)`; });
    T.addEventListener('click', e => {
      const b = e.target.closest('[data-pl],[data-fi],[data-out],[data-in]'); if (!b) return;
      const eq = C.eq(b.dataset.pl || b.dataset.fi || b.dataset.out || b.dataset.in);
      if (b.dataset.pl) { if (!C.engraseAplica(eq)) { U.toast('Incluya primero el equipo en el plan', 'bad'); return; } EQ.EngProg.planDialog(eq); }
      if (b.dataset.fi) { if (!C.engraseAplica(eq)) { U.toast('El equipo está fuera del plan de engrase', 'bad'); return; } EQ.App.state.eqId = eq.id; EQ.App.setTab('engrase', 'ficha'); }
      if (b.dataset.out) EQ.Views.equipos.cambiarAlcance([eq], 'engrase', false);
      if (b.dataset.in) EQ.Views.equipos.cambiarAlcance([eq], 'engrase', true);
    });
  }

  V.asignarPlanMasivo = eqs => {
    const cfg = C.cfg(), cods = C.tiposEng().map(t => t.codigo);
    eqs = eqs.filter(C.engraseAplica);
    if (!eqs.length) { U.toast('Los equipos seleccionados están fuera del plan', 'bad'); return; }
    U.modal({ title: `Asignar plan / grasa a ${eqs.length} equipo(s)`, body: `<form class="form-grid" id="fAm">
      ${U.field('secuencia', 'Secuencia de tipos (vacío = no cambiar)', { hint: `Ej.: "EG, EP" · tipos: ${cods.join(', ')} · escriba FAMILIA para volver al plan por familia` })}
      ${U.field('intervalo', 'Cada cuántos días (vacío = no cambiar)', { type: 'number', attrs: 'min="1" max="60"' })}
      ${U.field('tipoGrasa', 'Grasa principal (vacío = no cambiar)', { type: 'select', options: cfg.tiposGrasa.map(g => g.nombre), empty: '— No cambiar —' })}
      <div class="fld"><label class="flex"><input type="checkbox" name="grasaPuntos"> Aplicar también esa grasa a todos sus puntos de engrase</label></div>
      ${U.field('enPrograma', 'Programa mensual', { type: 'select', options: [{ v: '', t: '— No cambiar —' }, { v: 'auto', t: 'Automático' }, { v: 'si', t: 'Sí, siempre' }, { v: 'no', t: 'No incluir' }], empty: undefined })}
      </form><div class="small muted mt">${U.esc(eqs.map(e => e.codigo).join(', '))}</div>`,
      buttons: [{ label: 'Cancelar', cls: 'btn-outline' }, { label: 'Aplicar', cls: 'btn-orange', onClick: async m => {
        const d = U.formData(m.querySelector('#fAm'));
        const famReset = /^familia$/i.test(d.secuencia);
        const seq = famReset ? null : String(d.secuencia || '').toUpperCase().split(/[\s,;→>-]+/).filter(Boolean);
        if (seq && seq.length && seq.some(x => !cods.includes(x))) throw new Error(`Secuencia inválida. Use: ${cods.join(', ')}`);
        if (d.intervalo !== null && !(d.intervalo >= 1 && d.intervalo <= 60)) throw new Error('Intervalo inválido (1 a 60 días).');
        for (const eq of eqs) {
          if (famReset) eq.planEngrase = null;
          else if ((seq && seq.length) || d.intervalo) { const p = C.plan(eq); eq.planEngrase = { secuencia: seq && seq.length ? seq : p.secuencia, intervalo: d.intervalo ? Math.round(d.intervalo) : p.intervalo, ancla: p.ancla }; }
          if (d.tipoGrasa) { eq.tipoGrasa = d.tipoGrasa; if (d.grasaPuntos) for (const p of C.puntosEq(eq.id)) { p.tipoGrasa = d.tipoGrasa; p.nlgi = (C.grasa(d.tipoGrasa) || {}).nlgi || p.nlgi; await EQ.DB.put('puntos', p, { noAudit: true }); } }
          if (d.enPrograma) eq.enPrograma = d.enPrograma === 'si' ? true : d.enPrograma === 'no' ? false : null;
          await EQ.DB.put('equipos', eq, { motivo: 'Asignación masiva de plan' });
        }
        U.toast(`Plan actualizado en ${eqs.length} equipo(s). Use "Regenerar desde planes" en el programa del mes si desea aplicarlo al mes ya guardado.`, 'ok'); EQ.App.refresh();
      } }] });
  };

  // ---------------- E. ESTATUS: PUNTOS ENGRASADOS, KG DE GRASA Y COSTOS ----------------
  function renderConsumo(root) {
    const cfg = C.cfg();
    const mesIni = U.today().slice(0, 7) + '-01';
    const st = EQ.App.state.estF || (EQ.App.state.estF = { desde: mesIni, hasta: U.today(), equipoId: '', tecnico: '', ceros: true });
    if (!st.mon) st.mon = 'ambas';
    const verL = st.mon !== 'usd', verU = st.mon !== 'loc', usd = C.monUSD(), loc = C.monBase();
    const r = C.estatusEngrase(st);
    const t = r.tot;
    const met = cfg.metodoCostoEngrase === 'puntos' ? 'puntos' : 'kg';
    const eqsPlan = C.equiposEngrase();
    const ids = new Set(Object.keys(r.porEquipo));
    if (st.ceros && !st.tecnico) eqsPlan.filter(e => C.enPrograma(e) && (!st.equipoId || e.id === st.equipoId)).forEach(e => ids.add(e.id));
    const vac = { n: 0, eg: 0, ep: 0, puntos: 0, kg: 0, costoPuntos: 0, costoKg: 0, costo: 0, costoPuntosUSD: 0, costoKgUSD: 0, costoUSD: 0, ultimo: '' };
    const porEq = [...ids].map(id => Object.assign({ eq: C.eq(id) }, vac, r.porEquipo[id] || {})).filter(x => x.eq).sort((a, b) => b.kg - a.kg || String(a.eq.codigo).localeCompare(String(b.eq.codigo), 'es', { numeric: true }));
    const porTec = Object.entries(r.porTecnico).map(([k, v]) => Object.assign({ tecnico: k }, v)).sort((a, b) => b.n - a.n);
    const porG = Object.entries(r.porGrasa).map(([k, v]) => Object.assign({ grasa: k }, v)).sort((a, b) => b.kg - a.kg);
    const sinPrecio = [...new Set(r.registros.map(d => C.costoDiario(d)).filter(c => !(c.precioKg > 0) || !(c.precioPunto > 0)).map(c => c.grasa))];
    const meses = U.lastMonths(12);
    const hist = C.estatusEngrase({ equipoId: st.equipoId, tecnico: st.tecnico });
    const mm = U.addDays(mesIni, -1).slice(0, 7);
    const preset = { mes: [mesIni, U.today()], ant: [mm + '-01', U.addDays(mesIni, -1)], d90: [U.addDays(U.today(), -90), U.today()], anio: [U.today().slice(0, 4) + '-01-01', U.today()] };
    root.innerHTML = `
      <div class="selector-bar"><b>Periodo:</b> <input type="date" id="cD" value="${st.desde}"> a <input type="date" id="cH" value="${st.hasta}">
        <div class="tabs" style="margin:0;border:none">${[['mes', 'Este mes'], ['ant', 'Mes anterior'], ['d90', '90 días'], ['anio', 'Año']].map(([k, l]) => `<button data-pr="${k}" class="${preset[k][0] === st.desde && preset[k][1] === st.hasta ? 'active' : ''}">${l}</button>`).join('')}</div>
        <select id="cE">${U.opts(C.equiposActivos().map(e => ({ v: e.id, t: C.eqLabel(e) })), st.equipoId, 'Todos los equipos')}</select>
        <select id="cT">${U.opts([...new Set(C.tecnicos().concat(Object.keys(r.porTecnico).filter(x => x !== 'Sin técnico')))], st.tecnico, 'Todos los técnicos')}</select>
        <label class="flex small"><input type="checkbox" id="cZ" ${st.ceros ? 'checked' : ''}> Incluir equipos del programa sin engrase</label>
        <b>Moneda:</b><select id="cMo">${U.opts([{ v: 'ambas', t: `${loc} y ${usd}` }, { v: 'loc', t: `Solo ${loc}` }, { v: 'usd', t: `Solo ${usd} (dólares)` }], st.mon)}</select>
        <span class="muted small">T.C. ${U.num(C.tc(), 3)}</span>
        <span class="spacer"></span><button class="btn btn-sm btn-ok" id="cReg">✓ Registrar engrase</button><a href="#/configuracion" class="btn btn-outline btn-sm" id="cPr">Precios de grasa</a></div>
      ${sinPrecio.length ? `<div class="warn-box mb">Grasa sin precio ${sinPrecio.length > 1 ? 'configurado' : 'configurado'} (por kg o por punto): <b>${U.esc(sinPrecio.join(', '))}</b>. Sus costos salen en 0. Configúrelos en Configuración → Tipos de grasa y precios.</div>` : ''}
      <div class="kpis mb">
        <div class="kpi"><div class="lbl">Engrases registrados</div><div class="val">${t.n}</div><div class="sub">EG ${t.eg} · EP ${t.ep}</div></div>
        <div class="kpi orange"><div class="lbl">Puntos engrasados</div><div class="val">${U.num(t.puntos)}</div><div class="sub">${t.n ? U.num(t.puntos / t.n, 1) + ' por engrase' : ''}</div></div>
        <div class="kpi orange"><div class="lbl">Grasa usada</div><div class="val">${U.num(t.kg, 2)} kg</div><div class="sub">${t.n ? U.num(t.kg / t.n, 3) + ' kg por engrase' : ''}</div></div>
        ${verL ? `<div class="kpi ${met === 'puntos' ? 'ok' : ''}"><div class="lbl">Costo por puntos (${U.esc(loc)})</div><div class="val">${U.money(t.costoPuntos)}</div><div class="sub">${met === 'puntos' ? 'costo oficial' : 'puntos × precio/punto'}</div></div>
        <div class="kpi ${met === 'kg' ? 'ok' : ''}"><div class="lbl">Costo por kg (${U.esc(loc)})</div><div class="val">${U.money(t.costoKg)}</div><div class="sub">${met === 'kg' ? 'costo oficial' : 'kg × precio/kg'}</div></div>` : ''}
        ${verU ? `<div class="kpi ${met === 'puntos' ? 'ok' : ''}"><div class="lbl">Costo por puntos (${U.esc(usd)})</div><div class="val">${U.usd(t.costoPuntosUSD)}</div><div class="sub">${t.puntos ? U.usd(t.costoPuntosUSD / t.puntos) + ' por punto' : 'en dólares'}</div></div>
        <div class="kpi ${met === 'kg' ? 'ok' : ''}"><div class="lbl">Costo por kg (${U.esc(usd)})</div><div class="val">${U.usd(t.costoKgUSD)}</div><div class="sub">${t.kg ? U.usd(t.costoKgUSD / t.kg) + ' por kg' : 'en dólares'}</div></div>` : ''}
        <div class="kpi gray"><div class="lbl">Equipos engrasados</div><div class="val">${Object.keys(r.porEquipo).length}</div><div class="sub">de ${C.equiposPrograma().length} en programa</div></div>
      </div>
      <div class="card mb"><h3>Estatus por equipo <span class="muted small" style="font-weight:normal">— cantidad de puntos engrasados, kg de grasa y costo de cada equipo en el periodo</span></h3><div id="tCE"></div></div>
      <div class="grid g3">
        <div class="card"><h3>Kg de grasa por equipo</h3><div class="chart-box"><canvas id="chCE"></canvas></div></div>
        <div class="card"><h3>Puntos engrasados por equipo</h3><div class="chart-box"><canvas id="chCP"></canvas></div></div>
        <div class="card"><h3>Costo mensual (últimos 12 meses${st.mon === 'usd' ? ', ' + U.esc(usd) : ''})</h3><div class="chart-box"><canvas id="chCM"></canvas></div></div>
      </div>
      <div class="grid g2 mt">
        <div class="card"><h3>Por técnico</h3><div id="tCT"></div></div>
        <div class="card"><h3>Por tipo de grasa</h3><div id="tCG"></div></div>
      </div>
      <div class="card mt"><h3>Detalle por punto de engrase (g aplicados)</h3><div id="tCPt"></div></div>`;
    const upd = () => { st.desde = root.querySelector('#cD').value; st.hasta = root.querySelector('#cH').value; st.equipoId = root.querySelector('#cE').value; st.tecnico = root.querySelector('#cT').value; st.ceros = root.querySelector('#cZ').checked; if (st.desde && st.hasta && st.desde > st.hasta) { U.toast('Rango de fechas incorrecto', 'bad'); return; } EQ.App.refresh(); };
    ['#cD', '#cH', '#cE', '#cT', '#cZ'].forEach(x => root.querySelector(x).onchange = upd);
    root.querySelector('#cMo').onchange = e => { st.mon = e.target.value; EQ.App.refresh(); };
    root.querySelectorAll('[data-pr]').forEach(b => b.onclick = () => { [st.desde, st.hasta] = preset[b.dataset.pr]; EQ.App.refresh(); });
    root.querySelector('#cReg').onclick = () => EQ.EngProg.registrarDialog(st.equipoId ? C.eq(st.equipoId) : null);
    root.querySelector('#cPr').onclick = e => { e.preventDefault(); EQ.App.state.tab.configuracion = 'grasas'; EQ.App.go('configuracion'); };
    const top = porEq.filter(x => x.n).slice(0, 20);
    U.chart('chCE', { type: 'bar', data: { labels: top.map(x => x.eq.codigo), datasets: [{ label: 'kg', data: top.map(x => +x.kg.toFixed(3)), backgroundColor: U.PALETTE[0] }] } });
    const topP = porEq.filter(x => x.n).sort((a, b) => b.puntos - a.puntos).slice(0, 20);
    U.chart('chCP', { type: 'bar', data: { labels: topP.map(x => x.eq.codigo), datasets: [{ label: 'Puntos', data: topP.map(x => x.puntos), backgroundColor: U.PALETTE[1] }] } });
    U.chart('chCM', { type: 'bar', data: { labels: meses.map(U.monthName), datasets: (() => { const u = st.mon === 'usd', sf = u ? 'USD' : '', sy = u ? usd : loc; return [{ label: `Costo por kg (${sy})`, data: meses.map(m => +((hist.porMes[m] || {})['costoKg' + sf] || 0).toFixed(2)), backgroundColor: U.PALETTE[2] }, { label: `Costo por puntos (${sy})`, data: meses.map(m => +((hist.porMes[m] || {})['costoPuntos' + sf] || 0).toFixed(2)), backgroundColor: U.PALETTE[3] }]; })() } });
    const money = v => U.money(v), t2 = v => +Number(v || 0).toFixed(2);
    const colsCosto = () => [].concat(verU ? [{ k: 'costoPuntosUSD', t: `Costo por puntos (${usd})`, num: true, fmt: v => `<b>${U.usd(v)}</b>`, text: x => t2(x.costoPuntosUSD) }, { k: 'costoKgUSD', t: `Costo por kg (${usd})`, num: true, fmt: v => `<b>${U.usd(v)}</b>`, text: x => t2(x.costoKgUSD) }] : [])
      .concat(verL ? [{ k: 'costoPuntos', t: `Costo por puntos (${loc})`, num: true, fmt: money, text: x => t2(x.costoPuntos) }, { k: 'costoKg', t: `Costo por kg (${loc})`, num: true, fmt: money, text: x => t2(x.costoKg) }] : []);
    U.table(root.querySelector('#tCE'), { exportName: 'estatus_engrase_por_equipo', rows: porEq, rowClass: x => x.n ? '' : 'inactive', cols: [
      { k: 'eq', t: 'Equipo', sort: x => x.eq.codigo, fmt: v => `<b>${U.esc(v.codigo)}</b>`, text: x => x.eq.codigo },
      { k: 'd', t: 'Descripción', sort: x => x.eq.descripcion, fmt: (v, x) => `${U.esc(x.eq.descripcion || '')}<div class="small muted">${U.esc(x.eq.familia || '')}</div>`, text: x => x.eq.descripcion },
      { k: 'n', t: 'Engrases', num: true }, { k: 'eg', t: 'EG', num: true }, { k: 'ep', t: 'EP', num: true },
      { k: 'puntos', t: 'Puntos engrasados', num: true, fmt: v => `<b>${U.num(v)}</b>` },
      { k: 'kg', t: 'Grasa (kg)', num: true, fmt: v => `<b>${U.num(v, 3)}</b>`, text: x => +x.kg.toFixed(3) },
      ...colsCosto(),
      ...(verU ? [{ k: 'cu', t: `Costo ${usd}/punto`, num: true, sort: x => x.puntos ? x.costoPuntosUSD / x.puntos : null, fmt: (v, x) => x.puntos ? U.usd(x.costoPuntosUSD / x.puntos) : '—', text: x => x.puntos ? +(x.costoPuntosUSD / x.puntos).toFixed(3) : '' }, { k: 'ck', t: `Costo ${usd}/kg`, num: true, sort: x => x.kg ? x.costoKgUSD / x.kg : null, fmt: (v, x) => x.kg ? U.usd(x.costoKgUSD / x.kg) : '—', text: x => x.kg ? +(x.costoKgUSD / x.kg).toFixed(3) : '' }] : []),
      { k: 'pp', t: 'Ptos/engrase', num: true, sort: x => x.n ? x.puntos / x.n : null, fmt: (v, x) => x.n ? U.num(x.puntos / x.n, 1) : '—', text: x => x.n ? +(x.puntos / x.n).toFixed(1) : '' },
      { k: 'kp', t: 'Kg/engrase', num: true, sort: x => x.n ? x.kg / x.n : null, fmt: (v, x) => x.n ? U.num(x.kg / x.n, 3) : '—', text: x => x.n ? +(x.kg / x.n).toFixed(3) : '' },
      { k: 'ultimo', t: 'Último engrase', fmt: v => v ? U.fdate(v) : '<span class="muted">Sin engrase en el periodo</span>', text: x => x.ultimo },
      { k: 'acc', t: '', nosort: true, noexport: true, fmt: (v, x) => `<button class="btn btn-ghost btn-sm" data-reg="${x.eq.id}" title="Registrar engrase">✓</button>` }] });
    root.querySelector('#tCE').addEventListener('click', e => { const b = e.target.closest('[data-reg]'); if (b) EQ.EngProg.registrarDialog(C.eq(b.dataset.reg)); });
    U.table(root.querySelector('#tCT'), { exportName: 'estatus_engrase_por_tecnico', search: false, rows: porTec, cols: [
      { k: 'tecnico', t: 'Técnico' }, { k: 'n', t: 'Engrases', num: true }, { k: 'puntos', t: 'Puntos', num: true }, { k: 'kg', t: 'Kg', num: true, fmt: v => U.num(v, 3), text: x => +x.kg.toFixed(3) },
      ...colsCosto()] });
    U.table(root.querySelector('#tCG'), { exportName: 'estatus_engrase_por_grasa', search: false, rows: porG, cols: [
      { k: 'grasa', t: 'Tipo de grasa' },
      { k: 'pk', t: 'Precio/kg', num: true, sort: x => C.precioGrasa(x.grasa), fmt: (v, x) => `${verL ? U.money(C.precioGrasa(x.grasa)) : ''}${verL && verU ? '<br>' : ''}${verU ? `<span class="small">${U.usd(C.precioGrasaUSD(x.grasa))}</span>` : ''}`, text: x => C.precioGrasa(x.grasa) },
      { k: 'pp', t: 'Precio/punto', num: true, sort: x => C.precioPunto(x.grasa), fmt: (v, x) => `${verL ? U.money(C.precioPunto(x.grasa)) : ''}${verL && verU ? '<br>' : ''}${verU ? `<span class="small">${U.usd(C.precioPuntoUSD(x.grasa))}</span>` : ''}`, text: x => C.precioPunto(x.grasa) },
      { k: 'puntos', t: 'Puntos', num: true }, { k: 'kg', t: 'Kg', num: true, fmt: v => U.num(v, 3), text: x => +x.kg.toFixed(3) },
      ...colsCosto()] });
    const cp = C.consumo(st);
    const porP = Object.entries(cp.porPunto).filter(([id]) => id && id !== 'null').map(([id, v]) => { const p = S.puntos.find(x => x.id === id) || {}; return Object.assign({ p, eq: C.eq(p.equipoId) }, v); }).sort((a, b) => b.g - a.g);
    U.table(root.querySelector('#tCPt'), { exportName: 'consumo_por_punto', rows: porP, cols: [
      { k: 'eq', t: 'Equipo', sort: x => x.eq && x.eq.codigo, fmt: v => v ? U.esc(v.codigo) : '—', text: x => x.eq ? x.eq.codigo : '' },
      { k: 'pc', t: 'Punto', sort: x => x.p.codigo, fmt: (v, x) => U.esc(x.p.codigo || '(eliminado)'), text: x => x.p.codigo },
      { k: 'pcomp', t: 'Componente', sort: x => x.p.componente, fmt: (v, x) => U.esc(x.p.componente || ''), text: x => x.p.componente },
      { k: 'n', t: 'Veces engrasado', num: true }, { k: 'g', t: 'Grasa (kg)', num: true, fmt: v => U.num(v / 1000, 3), text: x => +(x.g / 1000).toFixed(3) },
      ...(verL ? [{ k: 'costo', t: `Costo kg (${loc})`, num: true, fmt: v => U.money(v), text: x => +x.costo.toFixed(2) }] : []),
      ...(verU ? [{ k: 'costoUSD', t: `Costo kg (${usd})`, num: true, fmt: v => U.usd(v), text: x => +x.costoUSD.toFixed(2) }] : [])] });
  }

  // ---------------- REGISTROS ----------------
  function renderRegistros(root) {
    const st = EQ.App.state.regF || (EQ.App.state.regF = { desde: U.addDays(U.today(), -60), hasta: U.today(), equipoId: '', resultado: '' });
    const cfg = C.cfg();
    const rows = S.engrases.filter(r => r.fecha >= st.desde && r.fecha <= st.hasta && (!st.equipoId || r.equipoId === st.equipoId) && (!st.resultado || r.resultado === st.resultado)).sort((a, b) => (b.fecha + b.creado) > (a.fecha + a.creado) ? 1 : -1);
    root.innerHTML = `<div class="selector-bar"><b>Filtros:</b> <input type="date" id="rD" value="${st.desde}"> a <input type="date" id="rH" value="${st.hasta}">
      <select id="rE">${U.opts(C.equiposEngrase().map(e => ({ v: e.id, t: C.eqLabel(e) })), st.equipoId, 'Todos los equipos')}</select>
      <select id="rR">${U.opts(cfg.estadosEngrase.concat(['Línea base']), st.resultado, 'Todos los resultados')}</select></div><div class="card"><div id="tReg"></div></div>`;
    const upd = () => { st.desde = root.querySelector('#rD').value; st.hasta = root.querySelector('#rH').value; st.equipoId = root.querySelector('#rE').value; st.resultado = root.querySelector('#rR').value; EQ.App.refresh(); };
    ['#rD', '#rH', '#rE', '#rR'].forEach(s => root.querySelector(s).onchange = upd);
    const fotoOf = r => r.foto || ((S.engrases.find(x => x.intervencionId === r.intervencionId && x.foto) || {}).foto);
    const resCls = { 'Ejecutado': 'verde', 'Parcial': 'amarillo', 'No ejecutado': 'rojo', 'Reprogramado': 'info', 'Línea base': 'gris' };
    U.table(root.querySelector('#tReg'), { exportName: 'registros_engrase', rows, cols: [
      { k: 'fecha', t: 'Fecha', fmt: v => U.fdate(v), text: r => r.fecha },
      { k: 'equipoId', t: 'Equipo', fmt: v => U.esc((C.eq(v) || {}).codigo || '—'), text: r => (C.eq(r.equipoId) || {}).codigo },
      { k: 'codigoPunto', t: 'Punto' }, { k: 'componente', t: 'Componente' },
      { k: 'horometro', t: 'Horómetro/km', num: true, fmt: v => U.num(v, 1) },
      { k: 'gramos', t: 'g', num: true }, { k: 'tipoGrasa', t: 'Grasa' }, { k: 'tecnico', t: 'Técnico' },
      { k: 'resultado', t: 'Resultado', fmt: (v, r) => U.pill(resCls[v] || 'gris', v) + (r.reprogramadoPara ? ` <span class="small muted">→ ${U.fdate(r.reprogramadoPara)}</span>` : ''), text: r => r.resultado },
      { k: 'observaciones', t: 'Observaciones' },
      { k: 'foto', t: 'Foto', nosort: true, noexport: true, fmt: (v, r) => { const f = fotoOf(r); return f ? `<img class="photo-thumb" src="${f}" data-foto="${r.id}">` : ''; } },
      { k: 'acc', t: '', nosort: true, noexport: true, fmt: (v, r) => `<button class="btn btn-ghost btn-sm" data-del="${r.id}" title="Eliminar registro">🗑</button>` }] });
    root.querySelector('#tReg').addEventListener('click', async e => {
      const im = e.target.closest('[data-foto]'); if (im) { U.showPhoto(im.src); return; }
      const d = e.target.closest('[data-del]'); if (!d) return;
      const r = S.engrases.find(x => x.id === d.dataset.del);
      const motivo = await U.prompt('Motivo de la eliminación (queda en la auditoría):', '', 'Eliminar registro de engrase');
      if (!motivo) return;
      const foto = r.foto;
      await EQ.DB.del('engrases', r.id, { motivo });
      if (foto) { const o = S.engrases.find(x => x.intervencionId === r.intervencionId); if (o) { o.foto = foto; await EQ.DB.put('engrases', o, { noAudit: true }); } }
      const p = S.puntos.find(x => x.id === r.puntoId); if (p) await V.recalcPunto(p);
      U.toast('Registro eliminado y punto recalculado', 'ok'); EQ.App.refresh();
    });
  }

  EQ.Views.engrase = V;
})();
