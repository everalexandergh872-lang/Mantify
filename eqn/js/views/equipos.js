/* EQUIPOS: ya no hay maestro propio. Los equipos vienen de Mantify → Equipos.
   Aquí quedan solo los diálogos de configuración de engrase/neumáticos de cada equipo. */
(function () {
  const U = EQ.U, S = EQ.S, C = EQ.C;
  EQ.Views = EQ.Views || {};
  const V = {};

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

  V.formEquipo = (eq, onDone) => {
    const cfg = C.cfg();
    const isNew = !eq;
    eq = eq || { activo: true, unidad: 'h', sistemaLubricacion: 'Manual' };
    const ro = !isNew && eq.fleetId && EQ.DB.host() ? 'readonly title="Se edita en Mantify → Equipos"' : ''; // datos generales: un solo maestro
    const body = `<form class="form-grid" id="fEq">${ro ? '<div class="info-box full">Los datos generales (código, descripción, marca, modelo, serie, placa, ubicación) vienen de <b>Mantify → Equipos</b> y se editan allí. Aquí solo se configura lo propio de engrase y neumáticos.</div>' : ''}
      ${U.field('codigo', 'Código de equipo', { value: eq.codigo, req: true, attrs: ro || (!isNew && eq.origen && eq.origen.startsWith('Backlog') ? 'readonly title="Código sincronizado con Backlog"' : '') })}
      ${U.field('descripcion', 'Descripción', { value: eq.descripcion, req: true, attrs: ro })}
      ${U.field('familia', 'Familia', { type: 'select', options: cfg.familias, value: eq.familia, req: true })}
      ${U.field('marca', 'Marca', { value: eq.marca, attrs: ro })}
      ${U.field('modelo', 'Modelo', { value: eq.modelo, attrs: ro })}
      ${U.field('serie', 'Serie', { value: eq.serie, attrs: ro })}
      ${U.field('placa', 'Placa', { value: eq.placa, attrs: ro })}
      ${U.field('estadoMov', 'Estado', { type: 'datalist', options: cfg.estadosMovilizacion || ['MOVILIZADO', 'DESMOVILIZADO'], value: eq.estadoMov || 'MOVILIZADO' })}
      ${U.field('propietario', 'Propietario', { value: eq.propietario })}
      ${U.field('clase', 'Clase', { type: 'datalist', options: ['EQUIPO MOV. TIERRA', 'VEHICULO TRANSP. PESADO', 'VEHICULO LIVIANO', 'EQUIPO MENOR'], value: eq.clase })}
      ${U.field('tipoContrato', 'Tipo (directo / indirecto)', { type: 'datalist', options: ['DIRECTO', 'INDIRECTO'], value: eq.tipoContrato })}
      ${U.field('fechaInicio', 'Fecha de inicio / movilización', { type: 'date', value: eq.fechaInicio })}
      ${U.field('ordenPrograma', 'N° de ítem en el programa', { type: 'number', value: eq.ordenPrograma, attrs: 'min="1"', hint: 'Orden de la fila en el programa de engrase' })}
      ${U.field('enPrograma', 'Programa de engrase EG/EP', { type: 'select', options: [{ v: '', t: 'Automático (movilizado y familia no excluida)' }, { v: 'si', t: 'Sí, siempre' }, { v: 'no', t: 'No incluir' }], value: eq.enPrograma === true ? 'si' : eq.enPrograma === false ? 'no' : '', empty: undefined })}
      ${(ro ? U.field('ubicacion', 'Ubicación', { value: eq.ubicacion, attrs: ro }) : U.field('ubicacion', 'Ubicación', { type: 'datalist', options: cfg.ubicaciones, value: eq.ubicacion }))}
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
    U.modal({ title: isNew ? 'Nuevo equipo' : `Configuración de engrase y neumáticos · ${eq.codigo}`, size: 'lg', body, buttons: [
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
