/* MAESTRO DE EQUIPOS (compartido con Backlog) */
(function () {
  const U = EQ.U, S = EQ.S, C = EQ.C;
  EQ.Views = EQ.Views || {};
  const V = {};

  V.render = root => {
    const App = EQ.App;
    const st = App.state.eqF || (App.state.eqF = { ver: 'todos', sel: [] });
    const sel = new Set(st.sel.filter(id => C.eq(id)));
    const todos = S.equipos.slice().sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true }));
    const FIL = { todos: () => true, eng: e => C.engraseAplica(e), sinEng: e => !!e.sinEngrase, neu: e => C.neumAplica(e), sinNeu: e => !!e.sinNeumaticos, ninguno: e => !!e.sinEngrase && !!e.sinNeumaticos, inact: e => e.activo === false };
    const eqs = todos.filter(FIL[st.ver] || FIL.todos);
    const cnt = k => todos.filter(FIL[k]).length;
    root.innerHTML = `
      <div class="card mb">
        <h3>Maestro de equipos <span class="muted small" style="font-weight:normal">— fuente: aplicación Backlog (sincronización por código de equipo)</span></h3>
        <div class="flex">
          <button class="btn btn-orange" id="bImpFile">⭱ Importar maestro del Backlog (JSON / Excel / CSV)</button>
          <button class="btn" id="bXl">⭱ Importar Excel F-MT-18-TM</button>
          <button class="btn" id="bScan">🔍 Buscar Backlog en este navegador</button>
          <button class="btn btn-outline" id="bNew">+ Equipo manual</button>
          <button class="btn btn-outline" id="bTplAll" title="Aplica la plantilla de engrase de su familia a cada equipo que aún no tiene puntos">⧉ Plantillas a equipos sin configuración</button>
          <span class="spacer"></span>
          <button class="btn btn-outline" id="bExpJ">⭳ Exportar maestro JSON</button>
          ${(C.cfg().codigosEliminados || []).length ? `<button class="btn btn-ghost btn-sm" id="bElim" title="Códigos eliminados que no se vuelven a crear al importar">🗑 Eliminados (${C.cfg().codigosEliminados.length})</button>` : ''}
        </div>
        <div class="info-box mt">Los equipos se toman del Backlog: no es necesario registrarlos nuevamente. Al volver a importar, los equipos existentes se <b>actualizan</b> por código (sin duplicar) y los nuevos se agregan. La configuración de engrase y neumáticos se conserva.
        Si la app Backlog se ejecuta en este mismo navegador y carpeta/dominio, use <b>"Buscar Backlog en este navegador"</b> para leer su maestro directamente.</div>
      </div>
      ${todos.length ? `<div class="selector-bar"><b>Mostrar:</b><select id="eqV">${U.opts([{ v: 'todos', t: `Todos (${todos.length})` }, { v: 'eng', t: `Se engrasan (${cnt('eng')})` }, { v: 'sinEng', t: `No se engrasan (${cnt('sinEng')})` }, { v: 'neu', t: `Con medición de neumáticos (${cnt('neu')})` }, { v: 'sinNeu', t: `Sin medición de neumáticos (${cnt('sinNeu')})` }, { v: 'ninguno', t: `Ni engrase ni neumáticos (${cnt('ninguno')})` }, { v: 'inact', t: `Inactivos (${cnt('inact')})` }], st.ver)}</select>
        <span class="spacer"></span><span class="muted small" id="eqN">${sel.size} seleccionado(s)</span>
        <button class="btn btn-sm btn-outline" id="eqAll">☑ Seleccionar los ${eqs.length} mostrados</button><button class="btn btn-sm btn-outline" id="eqNone">☐ Ninguno</button>
        <select id="eqAcc"><option value="">Acción con seleccionados…</option><option value="engNo">⊘ Quitar del plan de engrase (no se engrasa)</option><option value="engSi">↺ Incluir en el plan de engrase</option><option value="neuNo">⊘ Quitar de la medición de neumáticos</option><option value="neuSi">↺ Incluir en la medición de neumáticos</option><option value="ambosNo">⊘ Quitar de engrase y de neumáticos</option><option value="desact">Desactivar</option><option value="act">Activar</option><option value="del">🗑 Eliminar del maestro</option></select><button class="btn btn-sm btn-orange" id="eqGo">Aplicar</button></div>` : ''}
      ${eqs.length ? '<div id="tblEq"></div>' : todos.length ? `<div class="card muted">No hay equipos con ese filtro.</div>` : `<div class="card">${U.emptyState('🚜', 'Aún no hay equipos', 'Importe el maestro de equipos exportado desde su aplicación de Backlog (JSON, Excel o CSV).', '<button class="btn btn-orange" id="bImpFile2">Importar maestro del Backlog</button>')}</div>`}`;
    const imp = async () => {
      const f = await U.pickFile('.json,.csv,.txt,.xlsx,.xls,.xlsm');
      if (!f) return;
      try { const src = await EQ.Backlog.parseFile(f); await EQ.Backlog.wizard(src, 'Backlog (' + f.name + ')', () => App.refresh()); }
      catch (e) { U.toast(e.message, 'bad'); }
    };
    root.querySelector('#bImpFile').onclick = imp;
    const b2 = root.querySelector('#bImpFile2'); if (b2) b2.onclick = imp;
    root.querySelector('#bScan').onclick = async () => {
      const src = await EQ.Backlog.scanBrowser();
      if (!src.length) { U.modal({ title: 'Backlog no encontrado en este navegador', size: 'sm', body: '<p>No se encontró un maestro de equipos del Backlog en el almacenamiento de este navegador para este origen.</p><p class="muted small">Los navegadores aíslan los datos por origen (carpeta local o dominio). Exporte el maestro desde la app Backlog e impórtelo con el botón de archivo.</p>', buttons: [{ label: 'Entendido' }] }); return; }
      EQ.Backlog.wizard(src, 'Backlog (navegador)', () => App.refresh());
    };
    root.querySelector('#bNew').onclick = () => V.formEquipo(null);
    root.querySelector('#bXl').onclick = () => EQ.XL.importarDialog();
    root.querySelector('#bExpJ').onclick = () => EQ.Backlog.exportMaestro();
    const bEl = root.querySelector('#bElim');
    if (bEl) bEl.onclick = () => { const cf = C.cfg(); U.modal({ title: 'Equipos eliminados del maestro', body: `<p class="small muted">Estos códigos no se vuelven a crear al importar el maestro del Backlog. Quite un código de la lista para que se importe de nuevo.</p><div class="chips">${cf.codigosEliminados.map((c, i) => `<span class="chip">${U.esc(c)}<button data-r="${i}" title="Permitir importar de nuevo">×</button></span>`).join('')}</div>`, onOpen: (m, close) => m.querySelectorAll('[data-r]').forEach(b => b.onclick = async () => { cf.codigosEliminados.splice(+b.dataset.r, 1); await EQ.DB.put('config', cf, { motivo: 'Código habilitado para importación' }); close(); U.toast('Código habilitado para la próxima importación', 'ok'); App.refresh(); }), buttons: [{ label: 'Cerrar', cls: 'btn-outline' }] }); };
    root.querySelector('#bTplAll').onclick = async () => {
      const cfg = C.cfg();
      const sin = C.equiposActivos().filter(e => !S.puntos.some(p => p.equipoId === e.id) && (cfg.plantillasEngrase[e.familia] || []).length);
      if (!sin.length) { U.toast('No hay equipos sin puntos con plantilla disponible', ''); return; }
      if (!(await U.confirm(`Se aplicará la plantilla de su familia a ${sin.length} equipo(s): ${U.esc(sin.map(e => e.codigo).join(', '))}.<br><br>Los valores son referenciales: verifíquelos según el manual del fabricante.`))) return;
      let n = 0; for (const e of sin) n += await EQ.Views.engrase.aplicarPlantilla(e, e.familia, true);
      U.toast(`${n} puntos creados en ${sin.length} equipo(s)`, 'ok'); App.refresh();
    };
    if (!todos.length) return;
    root.querySelector('#eqV').onchange = e => { st.ver = e.target.value; App.refresh(); };
    root.querySelector('#eqAll').onclick = () => { eqs.forEach(e => sel.add(e.id)); st.sel = [...sel]; App.refresh(); };
    root.querySelector('#eqNone').onclick = () => { st.sel = []; App.refresh(); };
    root.querySelector('#eqGo').onclick = async () => {
      const acc = root.querySelector('#eqAcc').value; const x = [...sel].map(C.eq).filter(Boolean);
      if (!acc) { U.toast('Elija una acción', 'bad'); return; }
      if (!x.length) { U.toast('Seleccione al menos un equipo (casilla ☑ de la tabla)', 'bad'); return; }
      let ok = false;
      if (acc === 'engNo') ok = await V.cambiarAlcance(x, 'engrase', false);
      if (acc === 'engSi') ok = await V.cambiarAlcance(x, 'engrase', true);
      if (acc === 'neuNo') ok = await V.cambiarAlcance(x, 'neum', false);
      if (acc === 'neuSi') ok = await V.cambiarAlcance(x, 'neum', true);
      if (acc === 'ambosNo') ok = await V.cambiarAlcance(x, 'ambos', false);
      if (acc === 'desact' || acc === 'act') { for (const e of x) { e.activo = acc === 'act'; await EQ.DB.put('equipos', e); } U.toast(`${x.length} equipo(s) ${acc === 'act' ? 'activados' : 'desactivados'}`, 'ok'); ok = true; App.refresh(); }
      if (acc === 'del') ok = await V.eliminarEquipos(x);
      if (ok) st.sel = [];
    };
    if (!eqs.length) return;
    U.table(root.querySelector('#tblEq'), {
      exportName: 'maestro_equipos',
      rows: eqs, rowClass: r => r.activo === false ? 'inactive' : '',
      cols: [
        { k: 'sel', t: '☑', nosort: true, noexport: true, fmt: (v, r) => `<input type="checkbox" data-s="${r.id}" ${sel.has(r.id) ? 'checked' : ''}>` },
        { k: 'codigo', t: 'Código', fmt: v => `<b>${U.esc(v)}</b>` },
        { k: 'descripcion', t: 'Descripción' },
        { k: 'familia', t: 'Familia' },
        { k: 'marca', t: 'Marca' }, { k: 'modelo', t: 'Modelo' }, { k: 'serie', t: 'Serie' },
        { k: 'ubicacion', t: 'Ubicación' },
        { k: 'horometro', t: 'Lectura actual', num: true, fmt: (v, r) => v === null || v === undefined ? '<span class="muted">—</span>' : `${U.num(v, 1)} ${C.unidad(r)}`, text: r => r.horometro },
        { k: 'uso', t: 'Uso/día', num: true, sort: r => C.usoDia(r), fmt: (v, r) => U.num(C.usoDia(r), 1), text: r => C.usoDia(r) },
        { k: 'placa', t: 'Placa' },
        { k: 'estadoMov', t: 'Estado', fmt: v => U.pill(!v || !/DESMOV|PROCESO|BAJA/i.test(v) ? 'verde' : 'gris', v || 'MOVILIZADO'), text: r => r.estadoMov || 'MOVILIZADO' },
        { k: 'seng', t: 'Engrase', sort: r => r.sinEngrase ? 0 : 1, fmt: (v, r) => `<button class="btn btn-ghost btn-sm" data-a="tE" data-id="${r.id}" title="Clic para ${r.sinEngrase ? 'incluir en' : 'quitar del'} plan de engrase">${r.sinEngrase ? U.pill('gris', 'No se engrasa') : U.pill('verde', 'Sí')}</button>`, text: r => r.sinEngrase ? 'No' : 'Sí' },
        { k: 'sneu', t: 'Med. neumáticos', sort: r => r.sinNeumaticos ? 0 : 1, fmt: (v, r) => `<button class="btn btn-ghost btn-sm" data-a="tN" data-id="${r.id}" title="Clic para ${r.sinNeumaticos ? 'incluir en' : 'quitar de'} la medición de neumáticos">${r.sinNeumaticos ? U.pill('gris', 'No se mide') : U.pill('verde', 'Sí')}</button>`, text: r => r.sinNeumaticos ? 'No' : 'Sí' },
        { k: 'prog', t: 'Programa engrase', sort: r => C.enPrograma(r) ? C.plan(r).intervalo : 999, fmt: (v, r) => C.enPrograma(r) ? `<span class="small">${U.esc(C.planTexto(C.plan(r)))}</span>` : '<span class="muted small">No</span>', text: r => C.enPrograma(r) ? C.planTexto(C.plan(r)) : 'No' },
        { k: 'dse', t: 'Días sin engrase', num: true, sort: r => C.enPrograma(r) ? C.diasSinEngrase(r) : -1, fmt: (v, r) => { if (!C.enPrograma(r)) return '<span class="muted">NA</span>'; const d = C.diasSinEngrase(r); return d === null ? '—' : `<b style="color:${d > C.th().diasSinEngrase ? 'var(--bad)' : 'var(--ok)'}">${d}</b>`; }, text: r => C.enPrograma(r) ? C.diasSinEngrase(r) : 'NA' },
        { k: 'pts', t: 'Ptos. engrase', num: true, sort: r => C.puntosEq(r.id, true).length, fmt: (v, r) => C.puntosEq(r.id, true).length, text: r => C.puntosEq(r.id, true).length },
        { k: 'neu', t: 'Neumáticos', sort: r => C.neumEq(r.id).length, fmt: (v, r) => r.layoutNeum === null || r.layoutNeum === undefined ? U.pill('gris', 'Sin config.') : `${C.neumEq(r.id).length}/${C.posiciones(r.layoutNeum).length}`, text: r => `${C.neumEq(r.id).length}/${C.posiciones(r.layoutNeum).length}` },
        { k: 'origen', t: 'Origen', fmt: v => U.esc(String(v || 'manual').replace(/\(.*\)/, '').trim()) },
        { k: 'acc', t: 'Acciones', nosort: true, noexport: true, fmt: (v, r) => `<div class="flex" style="flex-wrap:nowrap">
            <button class="btn btn-ghost btn-sm" data-a="edit" data-id="${r.id}" title="Editar">✎</button>
            <button class="btn btn-ghost btn-sm" data-a="lec" data-id="${r.id}" title="Actualizar horómetro/km">⏱</button>
            <button class="btn btn-ghost btn-sm" data-a="eng" data-id="${r.id}" title="Ficha de engrase">⛽</button>
            <button class="btn btn-ghost btn-sm" data-a="neu" data-id="${r.id}" title="Neumáticos">◎</button>
            <button class="btn btn-ghost btn-sm" data-a="act" data-id="${r.id}" title="${r.activo === false ? 'Activar' : 'Desactivar'}">${r.activo === false ? '↺' : '⊘'}</button>
            <button class="btn btn-ghost btn-sm" data-a="del" data-id="${r.id}" title="Eliminar">🗑</button></div>` }
      ]
    });
    root.querySelector('#tblEq').addEventListener('change', e => { const c = e.target.closest('[data-s]'); if (!c) return; if (c.checked) sel.add(c.dataset.s); else sel.delete(c.dataset.s); st.sel = [...sel]; root.querySelector('#eqN').textContent = `${sel.size} seleccionado(s)`; });
    root.querySelector('#tblEq').addEventListener('click', async e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const eq = C.eq(b.dataset.id);
      if (b.dataset.a === 'tE') { V.cambiarAlcance([eq], 'engrase', !!eq.sinEngrase); return; }
      if (b.dataset.a === 'tN') { V.cambiarAlcance([eq], 'neum', !!eq.sinNeumaticos); return; }
      if (b.dataset.a === 'edit') V.formEquipo(eq);
      if (b.dataset.a === 'lec') V.lecturaDialog(eq, () => App.refresh());
      if (b.dataset.a === 'eng') App.go('engrase', { eqId: eq.id });
      if (b.dataset.a === 'neu') App.go('neumaticos', { eqId: eq.id });
      if (b.dataset.a === 'act') { eq.activo = eq.activo === false; await EQ.DB.put('equipos', eq); U.toast(eq.activo ? 'Equipo activado' : 'Equipo desactivado', 'ok'); App.refresh(); }
      if (b.dataset.a === 'del') V.eliminarEquipos([eq]);
    });
  };

  /* Alcance por módulo: modulo = 'engrase' | 'neum' | 'ambos'; incluir = true (volver a incluir) / false (quitar).
     Quitar no borra historial: el equipo deja de aparecer en el plan / programa / control (engrase) o en la medición (neumáticos). */
  V.cambiarAlcance = (eqs, modulo, incluir) => new Promise(res => {
    eqs = eqs.filter(Boolean);
    if (!eqs.length) { res(false); return; }
    const nom = modulo === 'engrase' ? 'el plan de engrase' : modulo === 'neum' ? 'la medición de neumáticos' : 'el engrase y la medición de neumáticos';
    const lista = eqs.length <= 12 ? eqs.map(e => e.codigo).join(', ') : `${eqs.slice(0, 12).map(e => e.codigo).join(', ')} y ${eqs.length - 12} más`;
    const conNeu = modulo !== 'engrase' && !incluir ? eqs.filter(e => C.neumEq(e.id).length) : [];
    let done = false;
    U.modal({ title: `${incluir ? 'Incluir en' : 'Quitar de'} ${nom}`, onClose: () => { if (!done) res(false); }, body: `<p>${incluir ? 'Se incluirán' : 'Se quitarán'} <b>${eqs.length}</b> equipo(s) ${incluir ? 'en' : 'de'} ${nom}: <span class="small">${U.esc(lista)}</span></p>
      ${!incluir ? `<p class="small muted">${modulo !== 'neum' ? 'No aparecerán en el programa mensual, control diario, prioridad ni alertas de engrase. ' : ''}${modulo !== 'engrase' ? 'No aparecerán en el diagrama, inspecciones, análisis de desgaste ni alertas de neumáticos. ' : ''}El historial se conserva y puede volver a incluirlos cuando quiera.</p>` : ''}
      ${conNeu.length ? `<div class="warn-box">${conNeu.length} equipo(s) tienen neumáticos instalados (${U.esc(conNeu.map(e => e.codigo).join(', '))}). Seguirán registrados en el equipo; si ya no se usarán, retírelos desde el diagrama.</div>` : ''}
      ${!incluir ? `<div class="fld mt"><label>Motivo</label><input id="__mot" placeholder="Ej.: no requiere engrase, equipo menor, alquilado sin control…"></div>` : ''}`,
      buttons: [{ label: 'Cancelar', cls: 'btn-outline', onClick: () => { done = true; res(false); } }, { label: incluir ? 'Incluir' : 'Quitar', cls: incluir ? 'btn-ok' : 'btn-bad', onClick: async m => {
        const mot = (m.querySelector('#__mot') || {}).value || '';
        for (const e of eqs) {
          if (modulo === 'engrase' || modulo === 'ambos') { e.sinEngrase = !incluir; e.motivoSinEngrase = incluir ? '' : mot; e.fechaSinEngrase = incluir ? null : U.today(); }
          if (modulo === 'neum' || modulo === 'ambos') { e.sinNeumaticos = !incluir; e.motivoSinNeum = incluir ? '' : mot; e.fechaSinNeum = incluir ? null : U.today(); }
          await EQ.DB.put('equipos', e, { motivo: `${incluir ? 'Incluido en' : 'Quitado de'} ${nom}${mot ? ': ' + mot : ''}` });
        }
        done = true; res(true);
        U.toast(`${eqs.length} equipo(s) ${incluir ? 'incluidos en' : 'quitados de'} ${nom}`, 'ok'); EQ.App.refresh();
      } }] });
  });

  // Eliminación definitiva del maestro (con su historial de engrase). Los neumáticos instalados pasan a almacén.
  V.eliminarEquipos = eqs => new Promise(res => {
    eqs = eqs.filter(Boolean);
    if (!eqs.length) { res(false); return; }
    const cuenta = e => ({ pts: S.puntos.filter(p => p.equipoId === e.id).length, eng: S.engrasesDiarios.filter(p => p.equipoId === e.id).length + S.engrases.filter(p => p.equipoId === e.id && !p.intervencionId).length, ins: S.inspecciones.filter(p => p.equipoId === e.id).length, neu: C.neumEq(e.id).length });
    const tot = eqs.reduce((a, e) => { const c = cuenta(e); Object.keys(c).forEach(k => a[k] += c[k]); return a; }, { pts: 0, eng: 0, ins: 0, neu: 0 });
    const conHist = tot.pts + tot.eng + tot.ins + tot.neu;
    let done = false;
    U.modal({ title: `Eliminar ${eqs.length} equipo(s) del maestro`, onClose: () => { if (!done) res(false); }, body: `<p>Equipos: <b>${U.esc(eqs.slice(0, 15).map(e => e.codigo).join(', '))}${eqs.length > 15 ? ` y ${eqs.length - 15} más` : ''}</b></p>
      ${conHist ? `<div class="warn-box">Tienen información asociada: ${tot.pts} puntos de engrase, ${tot.eng} engrases registrados, ${tot.ins} mediciones de neumáticos y ${tot.neu} neumáticos instalados.<br>Al eliminar: se borran sus puntos, engrases, programas y lecturas de horómetro; los neumáticos instalados pasan a <b>almacén</b> y sus mediciones se conservan en el historial de cada neumático.</div>
        <p class="small muted">Si solo quiere que no se engrasen o no se midan, use mejor "Quitar del plan de engrase" / "Quitar de la medición de neumáticos" (se puede revertir).</p>` : ''}
      <div class="fld full"><label class="flex"><input type="checkbox" id="__noimp" checked> No volver a crearlos al reimportar el maestro del Backlog</label></div>
      <div class="fld mt"><label>Motivo (queda en la auditoría) <span class="req">*</span></label><input id="__mot"></div>
      ${conHist ? `<div class="fld mt"><label>Escriba ELIMINAR para confirmar</label><input id="__conf"></div>` : ''}`,
      buttons: [{ label: 'Cancelar', cls: 'btn-outline', onClick: () => { done = true; res(false); } }, { label: 'Eliminar definitivamente', cls: 'btn-bad', onClick: async m => {
        const mot = m.querySelector('#__mot').value.trim();
        if (!mot) throw new Error('Indique el motivo de la eliminación.');
        if (conHist && m.querySelector('#__conf').value.trim().toUpperCase() !== 'ELIMINAR') throw new Error('Escriba ELIMINAR para confirmar.');
        const noImp = m.querySelector('#__noimp').checked;
        const cfg = C.cfg();
        for (const eq of eqs) {
          for (const n of C.neumEq(eq.id)) { await C.registrarMovimiento(n, 'Retiro', { equipoId: eq.id, posAnterior: n.posicion, posNueva: '', motivo: 'Equipo eliminado del maestro', observaciones: mot }); n.equipoId = null; n.posicion = null; if (n.estado === 'En servicio') n.estado = 'Retirado'; await EQ.DB.put('neumaticos', n, { motivo: 'Equipo eliminado del maestro' }); }
          for (const x of S.engrases.filter(r => r.equipoId === eq.id)) await EQ.DB.del('engrases', x.id, { noAudit: true });
          for (const x of S.engrasesDiarios.filter(r => r.equipoId === eq.id)) await EQ.DB.del('engrasesDiarios', x.id, { noAudit: true });
          for (const x of S.puntos.filter(r => r.equipoId === eq.id)) await EQ.DB.del('puntos', x.id, { noAudit: true });
          for (const x of S.programas.filter(r => r.equipoId === eq.id)) await EQ.DB.del('programas', x.id);
          for (const x of S.horometros.filter(r => r.equipoId === eq.id)) await EQ.DB.del('horometros', x.id);
          await EQ.DB.del('equipos', eq.id, { motivo: mot });
          if (noImp && !cfg.codigosEliminados.some(c => String(c).toUpperCase() === String(eq.codigo).toUpperCase())) cfg.codigosEliminados.push(eq.codigo);
        }
        if (noImp) await EQ.DB.put('config', cfg, { motivo: 'Códigos eliminados del maestro' });
        done = true; res(true);
        U.toast(`${eqs.length} equipo(s) eliminados del maestro`, 'ok'); EQ.App.refresh();
      } }] });
  });

  V.formEquipo = (eq, onDone) => {
    const cfg = C.cfg();
    const isNew = !eq;
    eq = eq || { activo: true, unidad: 'h', sistemaLubricacion: 'Manual' };
    const body = `<form class="form-grid" id="fEq">
      ${U.field('codigo', 'Código de equipo', { value: eq.codigo, req: true, attrs: !isNew && eq.origen && eq.origen.startsWith('Backlog') ? 'readonly title="Código sincronizado con Backlog"' : '' })}
      ${U.field('descripcion', 'Descripción', { value: eq.descripcion, req: true })}
      ${U.field('familia', 'Familia', { type: 'select', options: cfg.familias, value: eq.familia, req: true })}
      ${U.field('marca', 'Marca', { value: eq.marca })}
      ${U.field('modelo', 'Modelo', { value: eq.modelo })}
      ${U.field('serie', 'Serie', { value: eq.serie })}
      ${U.field('placa', 'Placa', { value: eq.placa })}
      ${U.field('estadoMov', 'Estado', { type: 'datalist', options: cfg.estadosMovilizacion || ['MOVILIZADO', 'DESMOVILIZADO'], value: eq.estadoMov || 'MOVILIZADO' })}
      ${U.field('propietario', 'Propietario', { value: eq.propietario })}
      ${U.field('clase', 'Clase', { type: 'datalist', options: ['EQUIPO MOV. TIERRA', 'VEHICULO TRANSP. PESADO', 'VEHICULO LIVIANO', 'EQUIPO MENOR'], value: eq.clase })}
      ${U.field('tipoContrato', 'Tipo (directo / indirecto)', { type: 'datalist', options: ['DIRECTO', 'INDIRECTO'], value: eq.tipoContrato })}
      ${U.field('fechaInicio', 'Fecha de inicio / movilización', { type: 'date', value: eq.fechaInicio })}
      ${U.field('ordenPrograma', 'N° de ítem en el programa', { type: 'number', value: eq.ordenPrograma, attrs: 'min="1"', hint: 'Orden de la fila en el F-MT-18-TM' })}
      ${U.field('enPrograma', 'Programa de engrase EG/EP', { type: 'select', options: [{ v: '', t: 'Automático (movilizado y familia no excluida)' }, { v: 'si', t: 'Sí, siempre' }, { v: 'no', t: 'No incluir' }], value: eq.enPrograma === true ? 'si' : eq.enPrograma === false ? 'no' : '', empty: undefined })}
      ${U.field('ubicacion', 'Ubicación', { type: 'datalist', options: cfg.ubicaciones, value: eq.ubicacion })}
      ${U.field('unidad', 'Unidad de control', { type: 'select', options: [{ v: 'h', t: 'Horómetro (horas)' }, { v: 'km', t: 'Kilometraje (km)' }], value: eq.unidad || 'h', empty: undefined })}
      ${isNew ? U.field('horometro', 'Horómetro / Km actual', { type: 'number', value: eq.horometro, attrs: 'min="0"' }) : ''}
      ${U.field('usoDiaManual', 'Uso diario manual (h o km/día)', { type: 'number', value: eq.usoDiaManual, hint: 'Vacío = calcular con el historial de lecturas', attrs: 'min="0"' })}
      ${U.field('sistemaLubricacion', 'Sistema de lubricación', { type: 'select', options: cfg.sistemasLubricacion, value: eq.sistemaLubricacion })}
      ${U.field('tipoGrasa', 'Tipo de grasa principal', { type: 'select', options: cfg.tiposGrasa.map(g => g.nombre), value: eq.tipoGrasa })}
      ${U.field('frecuenciaEngrase', 'Frecuencia general de engrase (h/km)', { type: 'number', value: eq.frecuenciaEngrase, attrs: 'min="0"' })}
      <div class="fld"><label class="flex"><input type="checkbox" name="engraseSi" ${eq.sinEngrase ? '' : 'checked'}> Se engrasa (en el plan de engrase)</label><label class="flex"><input type="checkbox" name="neumSi" ${eq.sinNeumaticos ? '' : 'checked'}> Se miden sus neumáticos (remanentes)</label></div>
      ${U.field('tolPresion', 'Tolerancia de presión del equipo (±%)', { type: 'number', value: eq.tolPresion, hint: 'Vacío = usar tipo de neumático / general', attrs: 'min="0"' })}
      ${U.field('observaciones', 'Observaciones', { type: 'textarea', value: eq.observaciones, cls: 'full' })}
      ${isNew ? `<div class="fld full"><label class="flex"><input type="checkbox" name="aplicarPlantillas" checked> Aplicar plantillas de engrase y distribución de neumáticos según la familia</label></div>` : ''}
    </form>`;
    U.modal({ title: isNew ? 'Nuevo equipo' : `Editar equipo ${eq.codigo}`, size: 'lg', body, buttons: [
      { label: 'Cancelar', cls: 'btn-outline' },
      { label: 'Guardar', cls: 'btn-orange', onClick: async m => {
        const f = m.querySelector('#fEq'); const d = U.formData(f);
        U.requireFields(f, d, ['codigo', 'descripcion', 'familia']);
        const dup = C.eqByCode(d.codigo);
        if (dup && dup.id !== eq.id) { U.markInvalid(f, ['codigo']); throw new Error(`Ya existe un equipo con el código ${d.codigo}.`); }
        ['usoDiaManual', 'frecuenciaEngrase', 'tolPresion', 'horometro'].forEach(k => { if (d[k] !== null && d[k] !== undefined && d[k] < 0) { U.markInvalid(f, [k]); throw new Error('No se permiten valores negativos.'); } });
        const apl = d.aplicarPlantillas; delete d.aplicarPlantillas;
        d.sinEngrase = !d.engraseSi; d.sinNeumaticos = !d.neumSi; delete d.engraseSi; delete d.neumSi;
        d.enPrograma = d.enPrograma === 'si' ? true : d.enPrograma === 'no' ? false : null;
        d.estadoMov = (d.estadoMov || '').toUpperCase();
        if (d.fechaInicio && d.fechaInicio > U.today()) { U.markInvalid(f, ['fechaInicio']); throw new Error('Fecha de inicio futura.'); }
        const ini = d.horometro; if (!isNew) delete d.horometro;
        Object.assign(eq, d);
        if (isNew) { eq.origen = 'manual'; eq.layoutNeum = apl && cfg.layoutsNeum[eq.familia] !== undefined ? JSON.parse(JSON.stringify(cfg.layoutsNeum[eq.familia])) : null; }
        const saved = await EQ.DB.put('equipos', eq);
        if (isNew) { const cf = C.cfg(); const i = (cf.codigosEliminados || []).findIndex(c => String(c).toUpperCase() === String(eq.codigo).toUpperCase()); if (i >= 0) { cf.codigosEliminados.splice(i, 1); await EQ.DB.put('config', cf, { noAudit: true }); } }
        if (isNew && ini !== null && ini !== undefined) await EQ.DB.put('horometros', { equipoId: saved.id, fecha: U.today(), valor: ini, origen: 'alta' });
        if (isNew && apl) await EQ.Views.engrase.aplicarPlantilla(saved, eq.familia, true);
        U.toast('Equipo guardado', 'ok');
        if (onDone) onDone(saved); else EQ.App.refresh();
      } }] });
  };

  V.lecturaDialog = (eq, onDone) => {
    const lbl = C.lecturaLbl(eq), un = C.unidad(eq);
    const hist = S.horometros.filter(h => h.equipoId === eq.id).sort((a, b) => (b.fecha + b.creado) > (a.fecha + a.creado) ? 1 : -1).slice(0, 15);
    U.modal({ title: `Actualizar ${lbl.toLowerCase()} – ${eq.codigo}`, size: '', body: `
      <div class="info-box mb">Lectura actual: <b>${U.num(eq.horometro, 1)} ${un}</b> · Uso promedio: ${U.num(C.usoDia(eq), 1)} ${un}/día</div>
      <form class="form-grid" id="fLec">
        ${U.field('fecha', 'Fecha', { type: 'date', value: U.today(), req: true, attrs: `max="${U.today()}"` })}
        ${U.field('valor', `${lbl} (${un})`, { type: 'number', req: true, attrs: 'min="0"' })}
        <div class="fld full"><label class="flex"><input type="checkbox" name="correccion"> Corrección de lectura (permite un valor menor al último registro)</label></div>
        ${U.field('motivo', 'Motivo de la corrección', { cls: 'full', hint: 'Obligatorio en correcciones. Queda en la auditoría.' })}
      </form>
      <div class="section-title">Últimas lecturas</div>
      <div class="tbl-wrap" style="max-height:220px"><table class="tbl"><thead><tr><th>Fecha</th><th class="num">Lectura</th><th>Origen</th><th>Motivo</th></tr></thead><tbody>
      ${hist.map(h => `<tr><td>${U.fdate(h.fecha)}</td><td class="num">${U.num(h.valor, 1)}</td><td>${U.esc(h.origen)}</td><td>${U.esc(h.motivo || '')}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Sin lecturas</td></tr>'}</tbody></table></div>`,
      buttons: [{ label: 'Cancelar', cls: 'btn-outline' }, { label: 'Registrar lectura', cls: 'btn-orange', onClick: async m => {
        const f = m.querySelector('#fLec'); const d = U.formData(f);
        U.requireFields(f, d, ['fecha', 'valor']);
        if (d.fecha > U.today()) { U.markInvalid(f, ['fecha']); throw new Error('Fecha incorrecta: no puede ser futura.'); }
        if (d.correccion && !d.motivo) { U.markInvalid(f, ['motivo']); throw new Error('Indique el motivo de la corrección.'); }
        try { if (d.correccion) await C.registrarLectura(eq, d.valor, d.fecha, 'corrección', d.motivo, true); else await C.registrarLecturaFecha(eq, d.valor, d.fecha, 'manual'); }
        catch (e) { U.markInvalid(f, ['valor']); throw e; }
        U.toast('Lectura registrada', 'ok'); if (onDone) onDone();
      } }] });
  };

  EQ.Views.equipos = V;
})();
