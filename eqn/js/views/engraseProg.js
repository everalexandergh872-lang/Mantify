/* PROGRAMA DE ENGRASE EG/EP – lógica del formato F-MT-18-TM
   Programa mensual · Control diario · Cumplimiento · Prioridad (días sin engrase) */
(function () {
  const U = EQ.U, S = EQ.S, C = EQ.C;
  const P = {};
  const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const st = () => { const d = { mes: C.mesDe(U.today()), modo: 'registrar', aLaFecha: true, ctrlMes: C.mesDe(U.today()), ctrlEq: '', diaRapido: U.today() }; EQ.App.state.prog2 = Object.assign(d, EQ.App.state.prog2 || {}); return EQ.App.state.prog2; };
  const tiposCod = () => C.tiposEng().map(t => t.codigo);
  const nombreMes = mes => { const n = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']; return n[+mes.slice(5) - 1] + ' ' + mes.slice(0, 4); };
  P.nombreMes = nombreMes;

  // ===================== PROGRAMA MENSUAL =====================
  P.programa = root => {
    const s = st();
    const filas = C.programaMes(s.mes);
    const dias = C.mesDias(s.mes);
    const guardado = filas.some(f => f.guardado);
    const excl = C.excluidosMes(s.mes);
    const tot = {}; dias.forEach(d => tot[d] = 0);
    const hh = {}; dias.forEach(d => hh[d] = 0);
    root.innerHTML = `
      <div class="selector-bar"><b>Mes:</b><input type="month" id="pgMes" value="${s.mes}">
        <div class="tabs" style="margin:0;border:none"><button data-md="registrar" class="${s.modo === 'registrar' ? 'active' : ''}">Clic = registrar ejecución</button><button data-md="editar" class="${s.modo === 'editar' ? 'active' : ''}">Clic = editar programa</button></div>
        <span class="spacer"></span>
        <button class="btn btn-sm btn-outline" id="pgAddEq" title="Agregar al programa de este mes un equipo que no figura">+ Agregar equipo</button>
        <button class="btn btn-sm btn-outline" id="pgGen">${guardado ? '↻ Regenerar desde planes' : '💾 Guardar programa'}</button>
        <button class="btn btn-sm btn-orange" id="pgImp">⭱ Importar Excel F-MT-18-TM</button>
        <button class="btn btn-sm" id="pgExp">⭳ Exportar Excel F-MT-18-TM</button>
        <button class="btn btn-sm btn-outline" id="pgPdf">PDF</button></div>
      ${!filas.length ? `<div class="card">${U.emptyState('📅', 'No hay equipos en el programa', 'Importe el maestro (o el Excel F-MT-18-TM). Solo entran equipos MOVILIZADOS cuya familia no esté excluida (camionetas, buses, grupos electrógenos, motosoldadoras); puede forzarlo en la ficha del equipo.')}</div>` : `
      ${!guardado ? '<div class="info-box mb">Programa generado automáticamente con el plan de cada equipo. Se guarda al editar una celda o con "Guardar programa".</div>' : ''}
      ${excl.length ? `<div class="warn-box mb"><b>Quitados del programa de ${nombreMes(s.mes)} (${excl.length}):</b> ${excl.map(e => `<span class="chip" style="display:inline-flex;margin:2px">${U.esc(e.codigo)} <button data-rest="${e.id}" title="Volver a incluir en este mes">↺</button></span>`).join(' ')}</div>` : ''}
      <div class="card"><h3 style="justify-content:center">PROGRAMA DE ENGRASE MENSUAL DE ${nombreMes(s.mes)}</h3>
      <div class="legend-inline mb">${U.pill('info', 'Programado')} ${U.pill('verde', 'Ejecutado según programa')} ${U.pill('rojo', 'Programado no ejecutado')} <span class="pill noDot" style="background:#e3f5ea;color:#1e9e5a;border:1px dashed #1e9e5a">✓ Ejecutado sin programa</span> <span class="muted">EG = ${U.esc(C.tipoEng('EG').nombre)} · EP = ${U.esc(C.tipoEng('EP').nombre)}</span></div>
      <div class="tbl-wrap" style="max-height:none"><table class="tbl prog-grid"><thead>
        <tr><th rowspan="2" class="nosort">ITEM</th><th rowspan="2" class="nosort">COD.</th><th rowspan="2" class="nosort">PLACA</th><th rowspan="2" class="nosort">DESCRIPCIÓN DE ACTIVO</th><th rowspan="2" class="nosort">Plan</th><th rowspan="2" class="nosort">Tipo de OT</th><th rowspan="2" class="nosort">T. Ejec</th>
        ${dias.map(d => `<th class="nosort dcol ${d === U.today() ? 'hoy' : ''}">${+d.slice(8)}</th>`).join('')}<th rowspan="2" class="nosort">TOTAL (EG)</th><th rowspan="2" class="nosort">TOTAL (EP)</th><th rowspan="2" class="nosort">Ejec.</th><th rowspan="2" class="nosort">% a la fecha</th><th rowspan="2" class="nosort">ESTADO</th><th rowspan="2" class="nosort" title="Quitar del programa">✕</th></tr>
        <tr>${dias.map(d => `<th class="nosort dcol ${d === U.today() ? 'hoy' : ''}">${DOW[U.parseDate(d).getDay()]}</th>`).join('')}</tr></thead><tbody>
        ${filas.map(f => {
          const cu = C.cumplimientoEq(s.mes, f.eq, f.dias, s.mes === C.mesDe(U.today()) ? U.today() : null);
          return `<tr><td>${f.item}</td><td><a href="#" data-plan="${f.eq.id}"><b>${U.esc(f.eq.codigo)}</b></a></td><td>${U.esc(f.eq.placa || '')}</td><td>${U.esc(f.eq.descripcion || f.eq.familia || '')}</td>
            <td class="small muted">${U.esc(C.planTexto(C.plan(f.eq)))}${f.manual ? ' ✎' : ''}</td><td>MP</td><td class="num">${U.num(C.tipoEng('EG').horas, 2)}</td>
            ${dias.map(d => {
              const t = f.dias[d] || ''; const ej = C.diarioEn(f.eq.id, d);
              if (t) { tot[d]++; hh[d] += C.tipoEng(t).horas || 0; }
              let cls = '', txt = t;
              if (ej && t) { cls = 'c-ok'; txt = (ej.tipo === t ? t : ej.tipo) + '✓'; }
              else if (ej) { cls = 'c-extra'; txt = '✓' + ej.tipo; }
              else if (t && d < U.today()) cls = 'c-venc';
              else if (t) cls = 'c-prog';
              return `<td class="pc ${cls} ${d === U.today() ? 'hoy' : ''}" data-eq="${f.eq.id}" data-d="${d}" title="${U.esc(f.eq.codigo)} · ${U.fdate(d)}${t ? ' · Programado ' + t : ''}${ej ? ' · Ejecutado ' + ej.tipo : ''}">${txt}</td>`;
            }).join('')}
            <td class="num">${Object.values(f.dias).filter(x => x === 'EG').length}</td><td class="num">${Object.values(f.dias).filter(x => x === 'EP').length}</td><td class="num">${cu.eje}</td>
            <td class="num">${cu.pct === null ? '—' : `<b style="color:${cu.pct >= 90 ? 'var(--ok)' : cu.pct >= 75 ? '#9a7100' : 'var(--bad)'}">${U.num(cu.pct, 0)}%</b>`}</td><td class="small">${U.esc(f.eq.estadoMov || 'MOVILIZADO')}</td><td><button class="btn btn-ghost btn-sm" data-rm="${f.eq.id}" title="Quitar ${U.esc(f.eq.codigo)} del programa">✕</button></td></tr>`;
        }).join('')}
        <tr class="tot"><td colspan="7" style="text-align:right"><b>Equipos programados por día</b></td>${dias.map(d => `<td class="num"><b>${tot[d] || ''}</b></td>`).join('')}<td colspan="6"></td></tr>
        <tr class="tot"><td colspan="7" style="text-align:right">Horas-hombre estimadas</td>${dias.map(d => `<td class="num small">${hh[d] ? U.num(hh[d], 1) : ''}</td>`).join('')}<td colspan="6"></td></tr>
      </tbody></table></div>
      <div class="small muted mt">LEYENDA: EP = ${U.esc(C.tipoEng('EP').nombre)} PROGR. · EG = ${U.esc(C.tipoEng('EG').nombre)} PROGR. · NOTA: tiempo aproximado de ejecución EG ${U.num(C.tipoEng('EG').horas, 2)} h / EP ${U.num(C.tipoEng('EP').horas, 2)} h (editable en Configuración). Clic en el código para editar el plan del equipo.</div></div>`}`;
    root.querySelector('#pgMes').onchange = e => { if (e.target.value) { s.mes = e.target.value; EQ.App.refresh(); } };
    root.querySelectorAll('[data-md]').forEach(b => b.onclick = () => { s.modo = b.dataset.md; EQ.App.refresh(); });
    root.querySelector('#pgImp').onclick = () => EQ.XL.importarDialog();
    root.querySelector('#pgAddEq').onclick = () => P.agregarAlPrograma(s.mes);
    root.querySelectorAll('[data-rest]').forEach(b => b.onclick = async () => { await EQ.DB.del('programas', `${s.mes}|${b.dataset.rest}`); U.toast('Equipo incluido nuevamente en el programa del mes', 'ok'); EQ.App.refresh(); });
    root.querySelector('#pgExp').onclick = () => EQ.XL.exportar(s.mes);
    root.querySelector('#pgPdf').onclick = () => P.pdfPrograma(s.mes);
    root.querySelector('#pgGen').onclick = async () => {
      if (guardado) {
        if (!(await U.confirm(`¿Regenerar el programa de ${nombreMes(s.mes)} desde los planes? Se reemplazan las marcas EG/EP (incluidas las editadas o importadas). Los engrases ya registrados no se modifican.`))) return;
        const n = await C.guardarProgramaMes(s.mes, true); U.toast(`Programa regenerado (${n} equipos)`, 'ok');
      } else { const n = await C.guardarProgramaMes(s.mes, false); U.toast(`Programa guardado (${n} equipos)`, 'ok'); }
      EQ.App.refresh();
    };
    const grid = root.querySelector('.prog-grid');
    if (!grid) return;
    grid.addEventListener('click', async e => {
      const a = e.target.closest('[data-plan]'); if (a) { e.preventDefault(); P.planDialog(C.eq(a.dataset.plan)); return; }
      const rm = e.target.closest('[data-rm]'); if (rm) { P.quitarDelPrograma(C.eq(rm.dataset.rm), s.mes); return; }
      const td = e.target.closest('td.pc'); if (!td) return;
      const eq = C.eq(td.dataset.eq), d = td.dataset.d;
      const fila = filas.find(f => f.eq.id === eq.id);
      if (s.modo === 'editar') {
        const seq = [''].concat(tiposCod());
        const cur = fila.dias[d] || '';
        const nx = seq[(seq.indexOf(cur) + 1) % seq.length];
        if (!fila.guardado) await C.guardarProgramaMes(s.mes, false);
        const g = C.programaGuardado(s.mes, eq.id) || { id: `${s.mes}|${eq.id}`, mes: s.mes, equipoId: eq.id, dias: Object.assign({}, fila.dias) };
        g.dias = Object.assign({}, g.dias); if (nx) g.dias[d] = nx; else delete g.dias[d];
        g.manual = true;
        await EQ.DB.put('programas', g);
        EQ.App.refresh();
      } else {
        const ej = C.diarioEn(eq.id, d);
        if (ej) P.verDiario(ej);
        else if (d > U.today()) U.toast('No se puede registrar una ejecución futura. Use "Clic = editar programa" para cambiar la programación.', 'bad');
        else P.registrarDialog(eq, d, fila.dias[d] || 'EG');
      }
    });
  };

  // Quitar un equipo del programa mensual (solo el mes, el programa en adelante o el plan de engrase)
  P.quitarDelPrograma = (eq, mes) => {
    U.modal({ title: `Quitar ${eq.codigo} del programa`, body: `<p><b>${U.esc(C.eqLabel(eq))}</b></p><form id="fQp" class="form-grid">
      <div class="fld full"><label class="flex"><input type="radio" name="alc" value="mes" checked> Solo del programa de <b>${nombreMes(mes)}</b> (sigue en el plan; los meses siguientes se programan normalmente)</label>
      <label class="flex"><input type="radio" name="alc" value="prog"> Del programa mensual desde ${nombreMes(mes)} en adelante (sigue en el plan y puede registrar engrases)</label>
      <label class="flex"><input type="radio" name="alc" value="plan"> Quitar del plan de engrase: <b>el equipo no se engrasará</b> (sale del programa, del control y de las alertas)</label></div>
      ${U.field('motivo', 'Motivo', { cls: 'full', hint: 'Ej.: equipo en taller, desmovilizado, no requiere engrase…' })}</form>
      <div class="small muted">Los engrases ya registrados se conservan. Puede revertirlo en cualquier momento (↺).</div>`,
      buttons: [{ label: 'Cancelar', cls: 'btn-outline' }, { label: 'Quitar', cls: 'btn-bad', onClick: async m => {
        const alc = m.querySelector('[name=alc]:checked').value, motivo = m.querySelector('[name=motivo]').value.trim();
        await EQ.DB.put('programas', { id: `${mes}|${eq.id}`, mes, equipoId: eq.id, dias: {}, excluido: true, motivo, manual: true });
        if (alc === 'prog') { eq.enPrograma = false; await EQ.DB.put('equipos', eq, { motivo: motivo || 'Quitado del programa mensual' }); }
        if (alc === 'plan') { eq.sinEngrase = true; eq.motivoSinEngrase = motivo; eq.fechaSinEngrase = U.today(); await EQ.DB.put('equipos', eq, { motivo: motivo || 'Quitado del plan de engrase' }); }
        U.toast(`${eq.codigo} quitado ${alc === 'mes' ? 'del programa de ' + nombreMes(mes) : alc === 'prog' ? 'del programa mensual' : 'del plan de engrase'}`, 'ok'); EQ.App.refresh();
      } }] });
  };
  P.agregarAlPrograma = mes => {
    const filas = C.programaMes(mes);
    const ya = new Set(filas.map(f => f.eq.id));
    const cand = C.equiposActivos().filter(e => !ya.has(e.id));
    if (!cand.length) { U.toast('Todos los equipos activos ya están en el programa del mes', ''); return; }
    U.modal({ title: `Agregar equipo al programa de ${nombreMes(mes)}`, body: `<form id="fAp" class="form-grid">
      ${U.field('eq', 'Equipo', { type: 'select', options: cand.map(e => ({ v: e.id, t: C.eqLabel(e) + (C.engraseAplica(e) ? '' : ' (fuera del plan)') + (C.excluidoMes(mes, e.id) ? ' (quitado este mes)' : '') })), req: true, cls: 'full' })}
      <div class="fld full"><label class="flex"><input type="checkbox" name="siempre"> Incluirlo también en los meses siguientes (programa automático)</label></div></form>
      <div class="small muted">Se programa con el plan del equipo (${'EG/EP'}); puede editar las celdas con "Clic = editar programa".</div>`,
      buttons: [{ label: 'Cancelar', cls: 'btn-outline' }, { label: 'Agregar', cls: 'btn-orange', onClick: async m => {
        const d = U.formData(m.querySelector('#fAp')); const eq = C.eq(d.eq); if (!eq) throw new Error('Seleccione un equipo.');
        if (!C.engraseAplica(eq)) { eq.sinEngrase = false; eq.motivoSinEngrase = ''; }
        if (d.siempre) eq.enPrograma = true;
        await EQ.DB.put('equipos', eq, { motivo: 'Agregado al programa ' + mes });
        await EQ.DB.put('programas', { id: `${mes}|${eq.id}`, mes, equipoId: eq.id, item: filas.length + 1, dias: C.generarDias(eq, mes, filas.length), manual: true });
        U.toast(`${eq.codigo} agregado al programa`, 'ok'); EQ.App.refresh();
      } }] });
  };

  // ===================== PLAN POR EQUIPO =====================
  P.planCard = (el, eq) => {
    if (!el) return;
    const p = C.plan(eq);
    const ds = C.diasSinEngrase(eq), u = C.ultimoEngrase(eq);
    el.innerHTML = `<h3>Programa de engrase EG/EP <span class="right"><button class="btn btn-sm btn-outline" id="pcPlan">✎ Editar plan</button><button class="btn btn-sm btn-ok" id="pcReg">✓ Registrar EG / EP</button></span></h3>
      <div class="ficha">
        <div><div class="k">En programa</div><div class="v">${C.enPrograma(eq) ? 'Sí' : 'No'} <span class="small muted">${U.esc(eq.estadoMov || 'MOVILIZADO')}</span></div></div>
        <div><div class="k">Plan</div><div class="v">${U.esc(C.planTexto(p))}${eq.planEngrase ? '' : ' <span class="small muted">(por familia)</span>'}</div></div>
        <div><div class="k">Fecha ancla (EG de referencia)</div><div class="v">${p.ancla ? U.fdate(p.ancla) : 'Escalonado automático'}</div></div>
        <div><div class="k">Último engrase</div><div class="v">${u ? `${U.esc(C.tipoEng(u.tipo).nombre)} · ${U.fdate(u.fecha)}` : 'SIN ENGRASAR'}</div></div>
        <div><div class="k">Días sin engrase</div><div class="v" style="color:${ds !== null && ds > C.th().diasSinEngrase ? 'var(--bad)' : 'inherit'}">${ds === null ? '—' : ds}</div></div>
        <div><div class="k">Puntos en EG / EP</div><div class="v">${C.puntosDeTipo(eq, 'EG').length} / ${C.puntosDeTipo(eq, 'EP').length}</div></div>
      </div>`;
    el.querySelector('#pcPlan').onclick = () => P.planDialog(eq);
    el.querySelector('#pcReg').onclick = () => P.registrarDialog(eq);
  };

  P.planDialog = eq => {
    const p = C.plan(eq);
    const mes = st().mes;
    U.modal({ title: `Plan de engrase · ${eq.codigo}`, body: `<form class="form-grid" id="fPl">
        ${U.field('secuencia', 'Secuencia de tipos (separados por coma)', { value: p.secuencia.join(', '), req: true, hint: `Ej.: "EG, EP" alterna general y parcial · "EG" solo general. Tipos válidos: ${tiposCod().join(', ')}` })}
        ${U.field('intervalo', 'Cada cuántos días', { type: 'number', value: p.intervalo, req: true, attrs: 'min="1" max="60"' })}
        ${U.field('ancla', 'Fecha ancla (un día con el primer tipo de la secuencia)', { type: 'date', value: p.ancla || '', hint: 'Vacío = escalonado automático por ítem' })}
        ${U.field('enPrograma', 'Incluir en programa', { type: 'select', options: [{ v: '', t: 'Automático (movilizado y familia no excluida)' }, { v: 'si', t: 'Sí, siempre' }, { v: 'no', t: 'No' }], value: eq.enPrograma === true ? 'si' : eq.enPrograma === false ? 'no' : '', empty: undefined })}
        <div class="fld full"><label class="flex"><input type="checkbox" name="regen" checked> Regenerar el programa de ${nombreMes(mes)} para este equipo</label></div>
        <div class="fld full"><label class="flex"><input type="checkbox" name="usarFamilia"> Volver al plan por defecto de la familia (${U.esc(C.planTexto(C.planDefault(eq.familia)))})</label></div></form>
        <div id="plPrev" class="mt small"></div>`,
      onOpen: m => {
        const f = m.querySelector('#fPl');
        const prev = () => { try { const pl = read(f); const tmp = Object.assign({}, eq, { planEngrase: pl }); const d = C.generarDias(tmp, mes, 0); m.querySelector('#plPrev').innerHTML = `<b>Vista previa ${nombreMes(mes)}:</b> ${Object.entries(d).map(([k, v]) => `${+k.slice(8)}:${v}`).join(' · ') || '—'}`; } catch (e) { m.querySelector('#plPrev').textContent = e.message; } };
        f.addEventListener('input', prev); prev();
      },
      buttons: [{ label: 'Cancelar', cls: 'btn-outline' }, { label: 'Guardar plan', cls: 'btn-orange', onClick: async m => {
        const f = m.querySelector('#fPl'); const d = U.formData(f);
        const pl = d.usarFamilia ? null : read(f);
        eq.planEngrase = pl;
        eq.enPrograma = d.enPrograma === 'si' ? true : d.enPrograma === 'no' ? false : null;
        await EQ.DB.put('equipos', eq, { motivo: 'Plan de engrase' });
        if (d.regen) {
          const filas = C.programaMes(mes); const i = filas.findIndex(x => x.eq.id === eq.id);
          if (i >= 0) await EQ.DB.put('programas', { id: `${mes}|${eq.id}`, mes, equipoId: eq.id, dias: C.generarDias(eq, mes, i), manual: false });
        }
        U.toast('Plan guardado', 'ok'); EQ.App.refresh();
      } }] });
    function read(f) {
      const d = U.formData(f);
      const seq = String(d.secuencia || '').toUpperCase().split(/[\s,;→>-]+/).filter(Boolean);
      if (!seq.length || seq.some(x => !tiposCod().includes(x))) throw new Error(`Secuencia inválida. Use: ${tiposCod().join(', ')}`);
      if (!(d.intervalo >= 1 && d.intervalo <= 60)) throw new Error('Intervalo inválido (1 a 60 días).');
      return { secuencia: seq, intervalo: Math.round(d.intervalo), ancla: d.ancla || null };
    }
  };

  // ===================== REGISTRO (CONTROL DIARIO) =====================
  // Registro por punto de engrase (marcando cada punto y sus gramos) y/o por cantidad total (N° de puntos y kg)
  const costoHtml = (np, kg, grasa) => {
    const pk = C.precioGrasa(grasa), pp = C.precioPunto(grasa);
    return `<div class="kpis" style="margin:0">
      <div class="kpi orange"><div class="lbl">Puntos engrasados</div><div class="val">${U.num(np)}</div></div>
      <div class="kpi orange"><div class="lbl">Grasa usada</div><div class="val">${U.num(kg, 3)} kg</div></div>
      <div class="kpi"><div class="lbl">Costo por puntos</div><div class="val">${U.money(np * pp)}</div><div class="sub">${U.num(np)} × ${U.money(pp)}/punto</div></div>
      <div class="kpi"><div class="lbl">Costo por kg</div><div class="val">${U.money(kg * pk)}</div><div class="sub">${U.num(kg, 3)} kg × ${U.money(pk)}/kg</div></div>
      <div class="kpi"><div class="lbl">Costo por puntos (${U.esc(C.monUSD())})</div><div class="val">${U.usd(np * pp / C.tc())}</div><div class="sub">${U.num(np)} × ${U.usd(pp / C.tc())}/punto</div></div>
      <div class="kpi"><div class="lbl">Costo por kg (${U.esc(C.monUSD())})</div><div class="val">${U.usd(kg * pk / C.tc())}</div><div class="sub">${U.num(kg, 3)} kg × ${U.usd(pk / C.tc())}/kg · T.C. ${U.num(C.tc(), 3)}</div></div></div>
      ${!(pk > 0) || !(pp > 0) ? `<div class="warn-box mt-s small">La grasa "${U.esc(grasa || '—')}" no tiene precio ${!(pk > 0) ? 'por kg' : ''}${!(pk > 0) && !(pp > 0) ? ' ni ' : ''}${!(pp > 0) ? 'por punto' : ''}. Configúrelo en Configuración → Tipos de grasa y precios.</div>` : ''}`;
  };
  P.registrarDialog = (eq, fecha, tipo) => {
    const cfg = C.cfg();
    const eqs = C.equiposEngrase();
    if (!eqs.length) { U.toast('No hay equipos en el plan de engrase', 'bad'); return; }
    if (eq && !C.engraseAplica(eq)) { U.toast(`${eq.codigo} está fuera del plan de engrase`, 'bad'); return; }
    fecha = fecha || U.today();
    eq = eq || null;
    if (!tipo && eq) { const g = C.programaMes(C.mesDe(fecha)).find(f => f.eq.id === eq.id); tipo = g && g.dias[fecha] || 'EG'; }
    const tecs = C.tecnicos('Engrase');
    U.modal({ title: 'Registrar engrase (control diario)', size: 'xl', body: `<form class="form-grid" id="fD">
      ${U.field('equipoId', 'Equipo', { type: 'select', options: eqs.map(e => ({ v: e.id, t: C.eqLabel(e) + (C.enPrograma(e) ? '' : ' (fuera de programa)') })), value: eq ? eq.id : '', req: true })}
      ${U.field('fecha', 'Fecha real', { type: 'date', value: fecha, req: true, attrs: `max="${U.today()}"` })}
      ${U.field('tipo', 'Tipo de engrase', { type: 'select', options: C.tiposEng().map(t => ({ v: t.codigo, t: `${t.codigo} – ${t.nombre}` })), value: tipo || 'EG', req: true, empty: undefined })}
      ${U.field('horometro', 'Horómetro / Km', { type: 'number', attrs: 'min="0"', hint: 'Opcional, recomendado' })}
      ${U.field('tecnico', 'Técnico', { type: 'datalist', options: tecs, value: tecs.length === 1 ? tecs[0] : '', hint: 'Si escribe un nombre nuevo se agrega a los técnicos del área' })}
      ${U.field('tipoGrasa', 'Grasa usada', { type: 'select', options: cfg.tiposGrasa.map(g => g.nombre), value: eq ? C.grasaEq(eq) : '', req: true, empty: undefined })}
      <div class="fld"><label>Fotografía de evidencia</label><input type="file" accept="image/*" id="dFoto"></div>
      ${U.field('observaciones', 'Observaciones', { type: 'textarea' })}
      </form>
      <div class="section-title">Puntos de engrase engrasados <span class="right" id="dPtBtns"></span></div>
      <div id="dPts"></div>
      <div class="section-title">Cantidades usadas en el equipo</div>
      <div class="form-grid" id="fQ">
        ${U.field('nPuntos', 'Cantidad de puntos engrasados', { type: 'number', attrs: 'min="0" step="1"', hint: 'Se calcula con los puntos marcados; puede escribirlo directamente' })}
        ${U.field('kg', 'Grasa usada en el equipo (kg)', { type: 'number', attrs: 'min="0" step="0.001"', hint: 'Se calcula con los gramos de cada punto; escriba el total real si lo pesó' })}
      </div>
      <div id="dCost" class="mt"></div><div id="dInfo" class="small muted mt"></div>`,
      onOpen: m => {
        const f = m.querySelector('#fD'), q = m.querySelector('#fQ');
        const touched = { nPuntos: false, kg: false };
        q.querySelector('[name=nPuntos]').addEventListener('input', () => { touched.nPuntos = true; cost(); });
        q.querySelector('[name=kg]').addEventListener('input', () => { touched.kg = true; cost(); });
        const cur = () => C.eq(f.querySelector('[name=equipoId]').value);
        const sel = () => [...m.querySelectorAll('#dPts tbody tr')].filter(tr => tr.querySelector('.ck').checked).map(tr => ({ id: tr.dataset.p, gramos: U.toNum(tr.querySelector('.gr').value) || 0 }));
        const recalc = () => {
          const ps = sel();
          if (!touched.nPuntos) q.querySelector('[name=nPuntos]').value = m.querySelector('#dPts tbody tr') ? ps.length : (q.querySelector('[name=nPuntos]').value || '');
          if (!touched.kg && m.querySelector('#dPts tbody tr')) q.querySelector('[name=kg]').value = +(ps.reduce((a, x) => a + x.gramos, 0) / 1000).toFixed(3);
          cost();
        };
        const cost = () => { const d = U.formData(q); m.querySelector('#dCost').innerHTML = costoHtml(d.nPuntos || 0, d.kg || 0, f.querySelector('[name=tipoGrasa]').value); };
        const marcar = modo => { const e = cur(); const t = f.querySelector('[name=tipo]').value; const ids = new Set(C.puntosDeTipo(e, t).map(p => p.id)); m.querySelectorAll('#dPts tbody tr').forEach(tr => tr.querySelector('.ck').checked = modo === 'todos' ? true : modo === 'nada' ? false : ids.has(tr.dataset.p)); recalc(); };
        const drawPts = () => {
          const e = cur(); if (!e) return;
          const pts = C.puntosEq(e.id, true), t = f.querySelector('[name=tipo]').value;
          const ids = new Set(C.puntosDeTipo(e, t).map(p => p.id));
          m.querySelector('#dPtBtns').innerHTML = pts.length ? `<button type="button" class="btn btn-sm btn-outline" data-mk="tipo">Según ${U.esc(t)}</button> <button type="button" class="btn btn-sm btn-outline" data-mk="todos">Todos</button> <button type="button" class="btn btn-sm btn-outline" data-mk="nada">Ninguno</button>` : '';
          m.querySelector('#dPts').innerHTML = pts.length ? `<div class="tbl-wrap" style="max-height:260px"><table class="tbl"><thead><tr><th class="nosort">✓</th><th class="nosort">Código</th><th class="nosort">Componente</th><th class="nosort">Ubicación</th><th class="nosort">En EP</th><th class="nosort">Grasa</th><th class="nosort num">Gramos aplicados</th></tr></thead><tbody>
            ${pts.map(p => `<tr data-p="${p.id}"><td><input type="checkbox" class="ck" ${ids.has(p.id) ? 'checked' : ''}></td><td><b>${U.esc(p.codigo)}</b></td><td>${U.esc(p.componente || '')}</td><td class="small">${U.esc(p.ubicacion || '')}</td><td>${p.enParcial ? 'Sí' : ''}</td><td class="small">${U.esc(p.tipoGrasa || '')}</td><td class="num"><input type="number" class="gr" min="0" step="any" value="${Number(p.gramos) || 0}" style="width:80px"></td></tr>`).join('')}</tbody></table></div>`
            : `<div class="info-box">${U.esc(e.codigo)} no tiene puntos de engrase configurados: registre directamente la <b>cantidad de puntos engrasados</b> y los <b>kg de grasa</b> usados. Puede crear los puntos en la ficha del equipo (plantilla por familia).</div>`;
          m.querySelectorAll('[data-mk]').forEach(b => b.onclick = () => marcar(b.dataset.mk));
          m.querySelector('#dPts').oninput = m.querySelector('#dPts').onchange = recalc;
          if (!pts.length) { if (!touched.nPuntos) q.querySelector('[name=nPuntos]').value = ''; if (!touched.kg) q.querySelector('[name=kg]').value = ''; }
          recalc();
        };
        const info = () => {
          const e = cur(); if (!e) return;
          const d = f.querySelector('[name=fecha]').value;
          const prog = d ? (C.programaMes(C.mesDe(d)).find(x => x.eq.id === e.id) || { dias: {} }).dias[d] : '';
          f.querySelector('[name=horometro]').placeholder = e.horometro !== null && e.horometro !== undefined ? `Último: ${U.num(e.horometro, 1)}` : '';
          m.querySelector('#dInfo').innerHTML = `Programado ese día: <b>${prog || 'nada'}</b> · Días sin engrase: ${C.diasSinEngrase(e) ?? '—'}${C.diarioEn(e.id, d) ? ' · <b style="color:var(--bad)">Ya existe un registro en esa fecha (edítelo desde el control diario)</b>' : ''}`;
        };
        f.querySelector('[name=equipoId]').addEventListener('change', () => { const e = cur(); if (e) f.querySelector('[name=tipoGrasa]').value = C.grasaEq(e); touched.nPuntos = touched.kg = false; drawPts(); info(); });
        f.querySelector('[name=tipo]').addEventListener('change', () => marcar('tipo'));
        f.querySelector('[name=tipoGrasa]').addEventListener('change', cost);
        f.querySelector('[name=fecha]').addEventListener('change', info);
        drawPts(); info();
      },
      buttons: [{ label: 'Cancelar', cls: 'btn-outline' }, { label: 'Registrar', cls: 'btn-ok', onClick: async m => {
        const f = m.querySelector('#fD'); const d = U.formData(f); const q = U.formData(m.querySelector('#fQ'));
        U.requireFields(f, d, ['equipoId', 'fecha', 'tipo', 'tipoGrasa']);
        const e = C.eq(d.equipoId);
        const rows = [...m.querySelectorAll('#dPts tbody tr')];
        const puntosSel = rows.length ? rows.filter(tr => tr.querySelector('.ck').checked).map(tr => ({ id: tr.dataset.p, gramos: U.toNum(tr.querySelector('.gr').value) || 0 })) : [];
        if (puntosSel.some(x => x.gramos < 0)) throw new Error('No se permiten gramos negativos.');
        if (!puntosSel.length && !(q.nPuntos > 0) && !(q.kg > 0)) throw new Error('Indique los puntos engrasados o la cantidad de grasa (kg).');
        const file = m.querySelector('#dFoto').files[0];
        const foto = file ? await U.readPhoto(file) : null;
        try { const r = await C.registrarDiario({ eq: e, fecha: d.fecha, horometro: d.horometro, tipo: d.tipo, tecnico: d.tecnico, observaciones: d.observaciones, foto, puntosSel, nPuntos: q.nPuntos, kg: q.kg, tipoGrasa: d.tipoGrasa }); U.toast(`${e.codigo}: ${d.tipo} registrado el ${U.fdate(d.fecha)} · ${r.puntos} puntos · ${U.num(r.gramos / 1000, 3)} kg`, 'ok'); }
        catch (err) { if (/Horómetro|Kilometraje|Incremento|lectura/i.test(err.message)) U.markInvalid(f, ['horometro']); throw err; }
        EQ.App.refresh();
      } }] });
  };

  P.editarDiario = d => {
    const cfg = C.cfg(), eq = C.eq(d.equipoId);
    U.modal({ title: `Editar engrase · ${eq ? eq.codigo : ''} · ${U.fdate(d.fecha)}`, size: 'lg', body: `<form class="form-grid" id="fEd">
      ${U.field('fecha', 'Fecha real', { type: 'date', value: d.fecha, req: true, attrs: `max="${U.today()}"` })}
      ${U.field('tipo', 'Tipo de engrase asignado', { type: 'select', options: C.tiposEng().map(t => ({ v: t.codigo, t: `${t.codigo} – ${t.nombre}` })), value: d.tipo, req: true, empty: undefined })}
      ${U.field('horometro', 'Horómetro / Km', { type: 'number', value: d.horometro, attrs: 'min="0"' })}
      ${U.field('tecnico', 'Técnico', { type: 'datalist', options: C.tecnicos('Engrase'), value: d.tecnico })}
      ${U.field('tipoGrasa', 'Grasa usada', { type: 'select', options: cfg.tiposGrasa.map(g => g.nombre), value: C.costoDiario(d).grasa, empty: undefined })}
      ${U.field('puntos', 'Cantidad de puntos engrasados', { type: 'number', value: d.puntos, attrs: 'min="0" step="1"' })}
      ${U.field('kg', 'Grasa usada (kg)', { type: 'number', value: +((Number(d.gramos) || 0) / 1000).toFixed(3), attrs: 'min="0" step="0.001"' })}
      ${U.field('tc', `Tipo de cambio del registro (${C.monBase()} por ${C.monUSD()})`, { type: 'number', value: C.costoDiario(d).tc, attrs: 'min="0" step="0.001"' })}
      <div class="fld"><label class="flex"><input type="checkbox" name="actualizarPrecio"> Recalcular con los precios y T.C. vigentes</label><span class="hint">Guardados: ${U.money(C.costoDiario(d).precioKg)}/kg · ${U.money(C.costoDiario(d).precioPunto)}/punto</span></div>
      ${U.field('observaciones', 'Observaciones', { type: 'textarea', value: d.observaciones, cls: 'full' })}
      ${U.field('motivo', 'Motivo de la modificación', { req: true, cls: 'full', hint: 'Queda en la auditoría' })}</form><div id="eCost" class="mt"></div>`,
      onOpen: m => { const f = m.querySelector('#fEd'); const c = () => { const x = U.formData(f); m.querySelector('#eCost').innerHTML = costoHtml(x.puntos || 0, x.kg || 0, x.tipoGrasa); }; f.addEventListener('input', c); f.addEventListener('change', c); c(); },
      buttons: [{ label: 'Cancelar', cls: 'btn-outline' }, { label: 'Guardar cambios', cls: 'btn-orange', onClick: async m => {
        const f = m.querySelector('#fEd'); const x = U.formData(f);
        U.requireFields(f, x, ['fecha', 'tipo', 'motivo']);
        const precioCambia = x.actualizarPrecio || x.tipoGrasa !== C.costoDiario(d).grasa;
        await C.actualizarDiario(d, { fecha: x.fecha, tipo: x.tipo, horometro: x.horometro, tecnico: x.tecnico, tipoGrasa: x.tipoGrasa, puntos: x.puntos === null ? 0 : Math.round(x.puntos), kg: x.kg === null ? 0 : x.kg, observaciones: x.observaciones, actualizarPrecio: precioCambia, tc: x.actualizarPrecio ? null : x.tc }, x.motivo);
        U.toast('Registro actualizado', 'ok'); EQ.App.refresh();
      } }] });
  };

  P.verDiario = d => {
    const eq = C.eq(d.equipoId), c = C.costoDiario(d);
    U.modal({ title: `Engrase ${d.tipo} · ${eq ? eq.codigo : ''} · ${U.fdate(d.fecha)}`, body: `<div class="ficha">
      ${[['Tipo', C.tipoEng(d.tipo).nombre], ['Fecha', U.fdate(d.fecha)], ['Horómetro', U.num(d.horometro, 1)], ['Técnico', d.tecnico], ['Puntos engrasados', U.num(c.puntos)], ['Grasa usada', U.num(c.kg, 3) + ' kg'], ['Tipo de grasa', c.grasa], ['Costo por puntos', `${U.money(c.costoPuntos)} (${U.money(c.precioPunto)}/punto)`], ['Costo por kg', `${U.money(c.costoKg)} (${U.money(c.precioKg)}/kg)`], [`Costo por puntos (${C.monUSD()})`, `${U.usd(c.costoPuntosUSD)} (${U.usd(c.precioPuntoUSD)}/punto)`], [`Costo por kg (${C.monUSD()})`, `${U.usd(c.costoKgUSD)} (${U.usd(c.precioKgUSD)}/kg)`], ['Tipo de cambio', U.num(c.tc, 3)], ['Observaciones', d.observaciones]].map(([k, v]) => `<div><div class="k">${k}</div><div class="v">${U.esc(v === null || v === undefined || v === '' ? '—' : v)}</div></div>`).join('')}</div>
      ${(() => { const rs = S.engrases.filter(r => r.intervencionId === d.id && r.puntoId); return rs.length ? `<div class="section-title">Puntos engrasados (${rs.length})</div><div class="small">${rs.map(r => `${U.esc(r.codigoPunto)} <span class="muted">${U.num(r.gramos, 0)} g</span>`).join(' · ')}</div>` : ''; })()}
      ${d.foto ? `<img src="${d.foto}" style="max-width:100%;margin-top:10px;border-radius:6px">` : ''}`,
      buttons: [{ label: 'Eliminar registro', cls: 'btn-bad', onClick: async () => { const mot = await U.prompt('Motivo de la eliminación (queda en auditoría):', '', 'Eliminar engrase'); if (!mot) return false; await C.eliminarDiario(d, mot); U.toast('Registro eliminado', 'ok'); EQ.App.refresh(); } }, { label: '✎ Editar', cls: 'btn-orange', onClick: () => { setTimeout(() => P.editarDiario(d), 30); } }, { label: 'Cerrar', cls: 'btn-outline' }] });
  };

  // ===================== CONTROL DIARIO =====================
  P.control = root => {
    const s = st(), cfg = C.cfg();
    const prog = C.programaMes(C.mesDe(s.diaRapido));
    const defPts = (eq, t) => { const n = C.puntosDeTipo(eq, t || 'EG').length; return n || ''; };
    const defKg = (eq, t) => { const g = C.puntosDeTipo(eq, t || 'EG').reduce((a, p) => a + (Number(p.gramos) || 0), 0); return g ? +(g / 1000).toFixed(3) : ''; };
    const pend = prog.filter(f => f.dias[s.diaRapido] && !C.diarioEn(f.eq.id, s.diaRapido));
    const rows = S.engrasesDiarios.filter(d => (!s.ctrlMes || C.mesDe(d.fecha) === s.ctrlMes) && (!s.ctrlEq || d.equipoId === s.ctrlEq)).sort((a, b) => a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0);
    root.innerHTML = `
      <div class="card mb"><h3>Registro rápido del día <span class="right"><button class="btn btn-sm btn-ok" id="cdNew">+ Registrar engrase individual</button></span></h3>
        <div class="flex mb"><b>Fecha:</b><input type="date" id="cdDia" value="${s.diaRapido}" max="${U.today()}"><b>Técnico:</b><input id="cdTec" list="cdTecL" style="width:180px" value="${U.esc(s.tecRapido || '')}"><datalist id="cdTecL">${C.tecnicos('Engrase').map(t => `<option value="${U.esc(t)}">`).join('')}</datalist>
        <span class="muted small">Equipos programados para el día y aún no registrados (${pend.length}).</span></div>
        ${pend.length ? `<div class="tbl-wrap"><table class="tbl" id="cdTbl"><thead><tr><th class="nosort">✓</th><th class="nosort">COD</th><th class="nosort">Equipo</th><th class="nosort">Programado</th><th class="nosort">Tipo ejecutado</th><th class="nosort">Horómetro / Km</th><th class="nosort num">Puntos engrasados</th><th class="nosort num">Grasa (kg)</th><th class="nosort">Grasa</th><th class="nosort">Observación</th></tr></thead><tbody>
          ${pend.map(f => `<tr data-eq="${f.eq.id}"><td><input type="checkbox" class="ck" checked></td><td><b>${U.esc(f.eq.codigo)}</b></td><td>${U.esc(f.eq.descripcion || '')} <span class="small muted">${U.esc(f.eq.placa || '')}</span></td><td>${U.pill('info', f.dias[s.diaRapido])}</td>
            <td><select class="tp">${U.opts(tiposCod(), f.dias[s.diaRapido])}</select></td><td><input type="number" class="hr" min="0" step="any" placeholder="${f.eq.horometro !== null && f.eq.horometro !== undefined ? 'últ. ' + U.num(f.eq.horometro, 1) : ''}" style="width:120px"></td>
            <td class="num"><input type="number" class="np" min="0" step="1" value="${defPts(f.eq, f.dias[s.diaRapido])}" style="width:70px"></td><td class="num"><input type="number" class="kg" min="0" step="0.001" value="${defKg(f.eq, f.dias[s.diaRapido])}" style="width:80px"></td>
            <td><select class="gs">${U.opts(cfg.tiposGrasa.map(g => g.nombre), C.grasaEq(f.eq))}</select></td><td><input class="ob" style="width:180px"></td></tr>`).join('')}
          </tbody></table></div><div class="flex mt"><span class="spacer"></span><button class="btn btn-ok" id="cdSave">✓ Registrar seleccionados</button></div>` : '<div class="muted">No hay engrases programados pendientes para esta fecha.</div>'}
      </div>
      <div class="selector-bar"><b>CONTROL DIARIO DE ENGRASE</b><input type="month" id="cdMes" value="${s.ctrlMes}"><select id="cdEq">${U.opts(C.equiposEngrase().map(e => ({ v: e.id, t: C.eqLabel(e) })), s.ctrlEq, 'Todos los equipos')}</select><span class="spacer"></span><button class="btn btn-sm btn-orange" id="cdImp">⭱ Importar Excel</button></div>
      <div class="card"><div id="cdList"></div></div>`;
    root.querySelector('#cdDia').onchange = e => { if (e.target.value) { s.diaRapido = e.target.value > U.today() ? U.today() : e.target.value; EQ.App.refresh(); } };
    const cdT = root.querySelector('#cdTbl');
    if (cdT) cdT.addEventListener('change', e => { if (!e.target.classList.contains('tp')) return; const tr = e.target.closest('tr'); const eq = C.eq(tr.dataset.eq); tr.querySelector('.np').value = defPts(eq, e.target.value); tr.querySelector('.kg').value = defKg(eq, e.target.value); });
    root.querySelector('#cdTec').onchange = e => { s.tecRapido = e.target.value.trim(); };
    root.querySelector('#cdMes').onchange = e => { s.ctrlMes = e.target.value; EQ.App.refresh(); };
    root.querySelector('#cdEq').onchange = e => { s.ctrlEq = e.target.value; EQ.App.refresh(); };
    root.querySelector('#cdNew').onclick = () => P.registrarDialog(s.ctrlEq ? C.eq(s.ctrlEq) : null, s.diaRapido);
    root.querySelector('#cdImp').onclick = () => EQ.XL.importarDialog();
    const sv = root.querySelector('#cdSave');
    if (sv) sv.onclick = async () => {
      sv.disabled = true;
      const tec = root.querySelector('#cdTec').value.trim();
      let ok = 0; const errs = [];
      for (const tr of root.querySelectorAll('#cdTbl tbody tr')) {
        if (!tr.querySelector('.ck').checked) continue;
        const eq = C.eq(tr.dataset.eq);
        try { await C.registrarDiario({ eq, fecha: s.diaRapido, horometro: U.toNum(tr.querySelector('.hr').value), tipo: tr.querySelector('.tp').value, tecnico: tec, observaciones: tr.querySelector('.ob').value.trim(), nPuntos: U.toNum(tr.querySelector('.np').value), kg: U.toNum(tr.querySelector('.kg').value), tipoGrasa: tr.querySelector('.gs').value }); ok++; }
        catch (e) { errs.push(`${eq.codigo}: ${e.message}`); tr.querySelector('.hr').classList.add('invalid'); }
      }
      sv.disabled = false;
      if (errs.length) U.modal({ title: `Registrados ${ok}; con errores ${errs.length}`, body: `<ul>${errs.map(e => `<li>${U.esc(e)}</li>`).join('')}</ul>`, buttons: [{ label: 'Cerrar', cls: 'btn-outline', onClick: () => EQ.App.refresh() }] });
      else { U.toast(`${ok} engrase(s) registrados`, 'ok'); EQ.App.refresh(); }
    };
    U.table(root.querySelector('#cdList'), { exportName: 'control_diario_engrase', rows, empty: 'Sin registros en el periodo', cols: [
      { k: 'key', t: 'KEY', sort: r => (C.eq(r.equipoId) || {}).codigo + r.fecha, fmt: (v, r) => U.esc(((C.eq(r.equipoId) || {}).codigo || '') + r.fecha.split('-').reverse().join('/')), text: r => ((C.eq(r.equipoId) || {}).codigo || '') + U.fdate(r.fecha) },
      { k: 'cod', t: 'COD', sort: r => (C.eq(r.equipoId) || {}).codigo, fmt: (v, r) => `<b>${U.esc((C.eq(r.equipoId) || {}).codigo || '—')}</b>`, text: r => (C.eq(r.equipoId) || {}).codigo },
      { k: 'fecha', t: 'FECHA REAL.', fmt: v => U.fdate(v), text: r => r.fecha },
      { k: 'horometro', t: 'HORO.', num: true, fmt: v => U.num(v, 1) },
      { k: 'tipo', t: 'TIPO DE ENGRASE', fmt: v => `${U.pill(v === 'EG' ? 'info' : 'amarillo', v)} ${U.esc(C.tipoEng(v).nombre)}`, text: r => C.tipoEng(r.tipo).nombre },
      { k: 'dse', t: 'DÍAS DESDE EL ENGRASE', num: true, sort: r => U.daysBetween(r.fecha, U.today()), fmt: (v, r) => U.daysBetween(r.fecha, U.today()), text: r => U.daysBetween(r.fecha, U.today()) },
      { k: 'tecnico', t: 'Técnico' }, { k: 'puntos', t: 'Puntos engrasados', num: true }, { k: 'gramos', t: 'Grasa (kg)', num: true, fmt: v => U.num((v || 0) / 1000, 3), text: r => +((r.gramos || 0) / 1000).toFixed(3) },
      { k: 'gr', t: 'Grasa', sort: r => C.costoDiario(r).grasa, fmt: (v, r) => `<span class="small">${U.esc(C.costoDiario(r).grasa)}</span>`, text: r => C.costoDiario(r).grasa },
      { k: 'cp', t: 'Costo puntos', num: true, sort: r => C.costoDiario(r).costoPuntos, fmt: (v, r) => U.money(C.costoDiario(r).costoPuntos), text: r => +C.costoDiario(r).costoPuntos.toFixed(2) },
      { k: 'ck', t: 'Costo kg', num: true, sort: r => C.costoDiario(r).costoKg, fmt: (v, r) => U.money(C.costoDiario(r).costoKg), text: r => +C.costoDiario(r).costoKg.toFixed(2) },
      { k: 'cpu', t: `Costo puntos ${C.monUSD()}`, num: true, sort: r => C.costoDiario(r).costoPuntosUSD, fmt: (v, r) => U.usd(C.costoDiario(r).costoPuntosUSD), text: r => +C.costoDiario(r).costoPuntosUSD.toFixed(2) },
      { k: 'cku', t: `Costo kg ${C.monUSD()}`, num: true, sort: r => C.costoDiario(r).costoKgUSD, fmt: (v, r) => U.usd(C.costoDiario(r).costoKgUSD), text: r => +C.costoDiario(r).costoKgUSD.toFixed(2) },
      { k: 'observaciones', t: 'Observaciones' },
      { k: 'acc', t: '', nosort: true, noexport: true, fmt: (v, r) => `<div class="flex" style="flex-wrap:nowrap">${r.foto ? '📷 ' : ''}<button class="btn btn-ghost btn-sm" data-v="${r.id}" title="Ver">👁</button><button class="btn btn-ghost btn-sm" data-ed="${r.id}" title="Editar">✎</button></div>` }] });
    root.querySelector('#cdList').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) P.verDiario(S.engrasesDiarios.find(x => x.id === b.dataset.v)); const ed = e.target.closest('[data-ed]'); if (ed) P.editarDiario(S.engrasesDiarios.find(x => x.id === ed.dataset.ed)); });
  };

  // ===================== CUMPLIMIENTO =====================
  P.cumplimiento = root => {
    const s = st();
    const filas = C.programaMes(s.mes);
    const dias = C.mesDias(s.mes);
    const hasta = s.aLaFecha && s.mes === C.mesDe(U.today()) ? U.today() : null;
    const res = filas.map(f => Object.assign({ f }, C.cumplimientoEq(s.mes, f.eq, f.dias, hasta)));
    const v = res.filter(r => r.pct !== null);
    const total = v.length ? v.reduce((a, r) => a + r.pct, 0) / v.length : null;
    root.innerHTML = `<div class="selector-bar"><b>Mes:</b><input type="month" id="cuMes" value="${s.mes}"><label class="flex"><input type="checkbox" id="cuF" ${s.aLaFecha ? 'checked' : ''}> Solo programados hasta hoy</label><span class="spacer"></span><button class="btn btn-sm" id="cuX">⭳ Excel</button></div>
      <div class="kpis mb">
        <div class="kpi ${total === null ? 'gray' : total >= 90 ? 'ok' : total >= 75 ? 'warn' : 'bad'}"><div class="lbl">CUMPLIMIENTO TOTAL</div><div class="val">${total === null ? '—' : U.num(total, 1) + '%'}</div><div class="sub">promedio por equipo</div></div>
        <div class="kpi"><div class="lbl">Programados</div><div class="val">${res.reduce((a, r) => a + r.prog, 0)}</div><div class="sub">EG ${res.reduce((a, r) => a + r.progEG, 0)} · EP ${res.reduce((a, r) => a + r.progEP, 0)}</div></div>
        <div class="kpi ok"><div class="lbl">Ejecutados</div><div class="val">${res.reduce((a, r) => a + r.eje, 0)}</div><div class="sub">OKEG ${res.reduce((a, r) => a + r.ejeEG, 0)} · OKEP ${res.reduce((a, r) => a + r.ejeEP, 0)}</div></div>
        <div class="kpi bad"><div class="lbl">Programados no ejecutados</div><div class="val">${res.reduce((a, r) => a + r.noEjec, 0)}</div></div></div>
      <div class="card mb"><h3 style="justify-content:center">CUMPLIMIENTO DE ENGRASE MENSUAL DE ${nombreMes(s.mes)}</h3>
      <div class="tbl-wrap" style="max-height:none"><table class="tbl prog-grid"><thead><tr><th class="nosort">ITEM</th><th class="nosort">CÓDIGO</th><th class="nosort">PLACA</th><th class="nosort">DESCRIPCIÓN</th>${dias.map(d => `<th class="nosort dcol ${d === U.today() ? 'hoy' : ''}">${+d.slice(8)}</th>`).join('')}<th class="nosort">EG ejec.</th><th class="nosort">EP ejec.</th><th class="nosort">Prog.</th><th class="nosort">%</th></tr></thead><tbody>
      ${res.map(r => `<tr><td>${r.f.item}</td><td><b>${U.esc(r.f.eq.codigo)}</b></td><td>${U.esc(r.f.eq.placa || '')}</td><td>${U.esc(r.f.eq.descripcion || '')}</td>${dias.map(d => { const ej = C.diarioEn(r.f.eq.id, d), t = r.f.dias[d]; return `<td class="pc ${ej ? 'c-ok' : t && d < U.today() ? 'c-venc' : t ? 'c-prog' : ''}">${ej ? 'OK' + ej.tipo : t || ''}</td>`; }).join('')}
        <td class="num">${r.ejeEG}</td><td class="num">${r.ejeEP}</td><td class="num">${r.prog}</td><td class="num"><b>${r.pct === null ? '—' : U.num(r.pct, 0) + '%'}</b></td></tr>`).join('')}
      </tbody></table></div></div>
      <div class="card"><h3>Cumplimiento por equipo (%)</h3><div class="chart-box"><canvas id="cuCh"></canvas></div></div>`;
    root.querySelector('#cuMes').onchange = e => { if (e.target.value) { s.mes = e.target.value; EQ.App.refresh(); } };
    root.querySelector('#cuF').onchange = e => { s.aLaFecha = e.target.checked; EQ.App.refresh(); };
    root.querySelector('#cuX').onclick = () => EQ.XL.exportar(s.mes);
    U.chart('cuCh', { type: 'bar', data: { labels: v.map(r => r.f.eq.codigo), datasets: [{ label: '% cumplimiento', data: v.map(r => +r.pct.toFixed(1)), backgroundColor: v.map(r => r.pct >= 90 ? U.STATUS.verde : r.pct >= 75 ? U.STATUS.amarillo : U.STATUS.rojo) }] }, options: { scales: { y: { max: 100 } } } });
  };

  // ===================== PRIORIDAD (PRIORID-ENGR) =====================
  P.filasPrioridad = () => {
    const lim = C.th().diasSinEngrase;
    return C.equiposEngrase().map(eq => {
      const u = C.ultimoEngrase(eq);
      const aplica = C.enPrograma(eq);
      const ds = aplica ? C.diasSinEngrase(eq) : null;
      return { eq, ultFecha: u ? u.fecha : (eq.fechaInicio || ''), ultTipo: u ? C.tipoEng(u.tipo).nombre : 'SIN ENGRASAR', dias: aplica ? ds : 'NA', exceso: aplica && ds !== null ? ds - lim : null, aplica };
    }).sort((a, b) => (b.aplica - a.aplica) || ((b.dias === 'NA' ? -1 : b.dias ?? -1) - (a.dias === 'NA' ? -1 : a.dias ?? -1)));
  };
  P.prioridad = root => {
    const lim = C.th().diasSinEngrase;
    const rows = P.filasPrioridad();
    root.innerHTML = `<div class="info-box mb">Días sin engrase = hoy − último engrase realizado (si nunca se engrasó, desde la fecha de inicio/movilización). Límite: <b>${lim} días</b> (editable en Configuración → Umbrales). "NA" = desmovilizado o fuera de programa.</div><div class="card"><div id="prT"></div></div>`;
    U.table(root.querySelector('#prT'), { exportName: 'prioridad_engrase', rows, cols: [
      { k: 'c', t: 'COD_INT.', sort: r => r.eq.codigo, fmt: (v, r) => `<b>${U.esc(r.eq.codigo)}</b>`, text: r => r.eq.codigo },
      { k: 'p', t: 'PLACA', sort: r => r.eq.placa, fmt: (v, r) => U.esc(r.eq.placa || ''), text: r => r.eq.placa },
      { k: 'e', t: 'EQUIPO', sort: r => r.eq.descripcion, fmt: (v, r) => U.esc(r.eq.descripcion || ''), text: r => r.eq.descripcion },
      { k: 'm', t: 'MARCA', sort: r => r.eq.marca, fmt: (v, r) => U.esc(r.eq.marca || ''), text: r => r.eq.marca },
      { k: 'pr', t: 'PROPIETARIO', sort: r => r.eq.propietario, fmt: (v, r) => U.esc(r.eq.propietario || ''), text: r => r.eq.propietario },
      { k: 'ultFecha', t: 'ÚLTIMO ENGRASE REALIZADO', fmt: v => U.fdate(v), text: r => r.ultFecha },
      { k: 'ultTipo', t: 'ÚLTIMO ENGRASE' },
      { k: 'dias', t: 'DÍAS SIN ENGRASE', num: true, sort: r => r.dias === 'NA' ? -1 : r.dias, fmt: (v, r) => v === 'NA' ? '<span class="muted">NA</span>' : v === null ? '—' : `<b style="color:${v > lim * 2 ? '#7a1010' : v > lim ? 'var(--bad)' : v >= lim ? '#9a7100' : 'var(--ok)'}">${v}</b>` },
      { k: 'es', t: 'ESTADO', sort: r => r.eq.estadoMov, fmt: (v, r) => U.esc(r.eq.estadoMov || 'MOVILIZADO'), text: r => r.eq.estadoMov || 'MOVILIZADO' },
      { k: 'cl', t: 'CLASE', sort: r => r.eq.clase, fmt: (v, r) => U.esc(r.eq.clase || ''), text: r => r.eq.clase },
      { k: 'exceso', t: 'DÍAS EXCEDIDOS', num: true, fmt: v => v === null ? '' : v > 0 ? `<b style="color:var(--bad)">+${v}</b>` : v },
      { k: 'pri', t: 'Prioridad', sort: r => r.exceso, fmt: (v, r) => !r.aplica ? U.pill('gris', 'NA') : r.dias === null ? U.pill('gris', 'Sin datos') : r.exceso > lim ? U.pill('critica', 'Crítica') : r.exceso > 0 ? U.pill('alta', 'Alta') : r.exceso === 0 ? U.pill('media', 'Hoy') : U.pill('verde', 'Al día'), text: r => !r.aplica ? 'NA' : r.exceso > lim ? 'Crítica' : r.exceso > 0 ? 'Alta' : 'Al día' },
      { k: 'acc', t: '', nosort: true, noexport: true, fmt: (v, r) => `<div class="flex" style="flex-wrap:nowrap">${r.aplica ? `<button class="btn btn-sm btn-outline" data-r="${r.eq.id}">Registrar</button>` : ''}<button class="btn btn-ghost btn-sm" data-q="${r.eq.id}" title="Quitar del plan de engrase (no se engrasa)">⊘</button></div>` }] });
    root.querySelector('#prT').addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) P.registrarDialog(C.eq(b.dataset.r)); const q = e.target.closest('[data-q]'); if (q) EQ.Views.equipos.cambiarAlcance([C.eq(q.dataset.q)], 'engrase', false); });
  };

  // ===================== PDF del programa =====================
  P.pdfPrograma = mes => {
    const filas = C.programaMes(mes), dias = C.mesDias(mes);
    const head = ['ITEM', 'COD.', 'PLACA', 'DESCRIPCIÓN'].concat(dias.map(d => String(+d.slice(8)))).concat(['EG', 'EP', 'Ejec', '%']);
    const body = filas.map(f => { const cu = C.cumplimientoEq(mes, f.eq, f.dias, mes === C.mesDe(U.today()) ? U.today() : null); return [f.item, f.eq.codigo, f.eq.placa || '', f.eq.descripcion || ''].concat(dias.map(d => { const ej = C.diarioEn(f.eq.id, d); return ej ? (f.dias[d] ? 'OK' : '+') + ej.tipo : (f.dias[d] || ''); })).concat([Object.values(f.dias).filter(x => x === 'EG').length, Object.values(f.dias).filter(x => x === 'EP').length, cu.eje, cu.pct === null ? '' : Math.round(cu.pct) + '%']); });
    const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    const cfg = C.cfg().formato || {};
    doc.setFontSize(12); doc.text(cfg.empresa || 'PROGRAMA DE ENGRASE', 10, 12); doc.setFontSize(9); doc.text(`CÓDIGO: ${cfg.codigo || 'F-MT-18-TM'} · VERSIÓN: ${cfg.version || '01'}`, 410, 12, { align: 'right' });
    doc.setFontSize(13); doc.text(`PROGRAMA DE ENGRASE MENSUAL DE ${nombreMes(mes)}`, 210, 20, { align: 'center' });
    doc.autoTable({ startY: 25, head: [head], body, theme: 'grid', styles: { fontSize: 6, cellPadding: 0.8, halign: 'center' }, columnStyles: { 3: { halign: 'left', cellWidth: 35 } }, headStyles: { fillColor: [15, 39, 66] },
      didParseCell: h => { if (h.section === 'body' && h.column.index >= 4 && h.column.index < 4 + dias.length) { const v = String(h.cell.raw || ''); if (v.startsWith('OK') || v.startsWith('+')) h.cell.styles.fillColor = [227, 245, 234]; else if (v && dias[h.column.index - 4] < U.today()) h.cell.styles.fillColor = [253, 230, 230]; else if (v) h.cell.styles.fillColor = [229, 239, 252]; } } });
    doc.setFontSize(7); doc.text(`LEYENDA: EP = ${C.tipoEng('EP').nombre} PROGR. · EG = ${C.tipoEng('EG').nombre} PROGR. · OK = ejecutado · + = ejecutado sin programa. Generado ${U.fdatetime(new Date().toISOString())}`, 10, doc.lastAutoTable.finalY + 6);
    doc.save(`F-MT-18-TM_Programa_Engrase_${mes}.pdf`);
  };

  EQ.EngProg = P;
})();
