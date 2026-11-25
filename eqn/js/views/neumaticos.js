/* MÓDULO 02 – CONTROL DE DESGASTE Y VIDA ÚTIL DE NEUMÁTICOS */
(function () {
  const U = EQ.U, S = EQ.S, C = EQ.C;
  EQ.Views = EQ.Views || {};
  const V = {};
  const TABS = [['diagrama', 'Medición de remanentes'], ['inventario', 'Inventario de neumáticos'], ['inspeccion', 'Inspección por equipo'], ['analisis', 'Desgaste y vida útil'], ['presiones', 'Control de presión'], ['costos', 'Costos']];

  V.render = root => {
    const App = EQ.App;
    let tab = App.tab('neumaticos', 'diagrama');
    if (!TABS.some(([k]) => k === tab)) tab = App.state.tab.neumaticos = 'diagrama'; // la "carga libre de remanentes" ya no existe
    root.innerHTML = App.tabsHtml('neumaticos', TABS, tab) + '<div id="neuBody"></div>';
    App.wireTabs(root, 'neumaticos');
    const body = root.querySelector('#neuBody');
    if (!C.equiposNeum().length && C.equiposActivos().length && !['inventario', 'costos'].includes(tab)) { body.innerHTML = `<div class="card">${U.emptyState('⊘', 'Ningún equipo está en la medición de neumáticos', 'Todos los equipos fueron quitados de la medición de neumáticos. Vuelva a incluirlos desde el Maestro de Equipos.', '<a class="btn btn-orange" href="#/equipos">Ir al Maestro de Equipos</a>')}</div>`; return; }
    if (!C.equiposActivos().length && tab !== 'inventario') { body.innerHTML = `<div class="card">${U.emptyState('◎', 'No hay equipos cargados', 'Los equipos se toman de <b>Mantify → Equipos</b>. Registre allí la flota y aparecerá aquí sola.', '<a class="btn btn-orange" href="#" data-mfleet>Ir a Equipos de Mantify</a>')}</div>`; return; }
    ({ diagrama: renderDiagrama, inventario: renderInventario, inspeccion: renderInspeccion, analisis: renderAnalisis, presiones: renderPresiones, costos: renderCostos })[tab](body);
  };

  const stockDisponible = () => S.neumaticos.filter(n => !n.posicion && EQ.ESTADOS_INSTALABLES.includes(n.estado));

  // ---------------- C. DIAGRAMA ----------------
  function tireBox(eq, p) {
    const n = C.neumEnPos(eq.id, p.pos);
    const sel = EQ.App.state.selPos === p.pos ? 'sel' : '';
    if (!n) return `<div class="tire empty ${sel}" data-pos="${p.pos}" title="${U.esc(p.label)} – vacía"><span class="pos">P${p.num}</span><span>vacía</span></div>`;
    const a = C.analisisNeum(n);
    return `<div class="tire ${a.estadoDesg} ${sel}" data-pos="${p.pos}" title="${U.esc(p.label)} · ${U.esc(n.codigo)}"><span class="pos">P${p.num}</span><span style="font-size:9px">${U.esc(String(n.codigo).length > 8 ? '…' + String(n.codigo).slice(-7) : n.codigo)}</span><span class="pct">${a.ultima && C.profProm(a.ultima) !== null ? U.num(a.profActual, 1) + ' mm' : '—'}</span>${a.presion.cls === 'rojo' || a.presion.cls === 'amarillo' ? '<span title="Presión fuera de rango">⚠</span>' : ''}</div>`;
  }
  function renderDiagrama(root) {
    const App = EQ.App;
    const nFuera = C.equiposActivos().filter(e => !C.neumAplica(e)).length;
    root.innerHTML = `<div class="selector-bar"><b>Equipo:</b> ${App.eqSelector(root, { modulo: 'neum' })}
      <span class="legend-inline">${U.pill('verde', 'Normal')} ${U.pill('amarillo', 'Observación')} ${U.pill('rojo', 'Crítico')} ${U.pill('gris', 'Sin inspección')}</span><span class="spacer"></span>
      <button class="btn btn-outline btn-sm" id="bLay">⚙ Configurar distribución</button>
      <button class="btn btn-sm" id="bIns">🔎 Inspeccionar equipo</button>
      <button class="btn btn-orange btn-sm" id="bNewN">+ Registrar neumático</button>
      <button class="btn btn-outline btn-sm" id="bQuitN" title="El equipo deja de aparecer en la medición de neumáticos (diagrama, inspección, desgaste y alertas)">⊘ Quitar de la medición</button>
      ${nFuera ? `<button class="btn btn-ghost btn-sm" id="bVerFuera">Sin medición (${nFuera})</button>` : ''}</div><div id="dgBody"></div>`;
    App.wireEqSelector(root);
    const eq = C.eq(App.state.eqId);
    root.querySelector('#bLay').onclick = () => V.configLayout(eq);
    root.querySelector('#bIns').onclick = () => { App.state.tab.neumaticos = 'inspeccion'; App.refresh(); };
    root.querySelector('#bNewN').onclick = () => V.formNeum(null);
    root.querySelector('#bQuitN').onclick = () => EQ.Views.equipos.cambiarAlcance([eq], 'neum', false);
    const bvf = root.querySelector('#bVerFuera'); if (bvf) bvf.onclick = () => V.equiposSinMedicion();
    const b = root.querySelector('#dgBody');
    if (eq.layoutNeum === null || eq.layoutNeum === undefined) { b.innerHTML = `<div class="card">${U.emptyState('⚙', 'Distribución de neumáticos no configurada', `Defina la cantidad de ejes y posiciones para <b>${U.esc(eq.codigo)}</b> (${U.esc(eq.familia || '')}). Cada equipo tiene su propia configuración.`, '<button class="btn btn-orange" id="bLay2">Configurar distribución</button>')}</div>`; b.querySelector('#bLay2').onclick = () => V.configLayout(eq); return; }
    const pos = C.posiciones(eq.layoutNeum);
    if (!pos.length) { b.innerHTML = `<div class="card">${U.emptyState('🚜', 'Equipo sin neumáticos', 'La distribución configurada no tiene ejes (equipo sobre orugas). Puede cambiarla en "Configurar distribución".')}</div>`; return; }
    const ejes = eq.layoutNeum.ejes || [];
    const inst = C.neumEq(eq.id);
    b.innerHTML = `<div class="info-box mb">👆 Toca una posición para registrar sus remanentes, la marca, el modelo y la medida del neumático. Cada medición queda en el <b>registro de mediciones</b> de abajo.</div><div class="truck-wrap">
      <div class="truck"><div class="cab">FRENTE · ${U.esc(eq.codigo)}</div><div class="chassis"></div>
        ${ejes.map((e, i) => { const ps = pos.filter(p => p.eje === i); const half = ps.length / 2; return `<div class="axle"><div class="bar"></div><div class="side">${ps.slice(0, half).map(p => tireBox(eq, p)).join('')}</div><div class="mid">${U.esc(e.nombre)}</div><div class="side">${ps.slice(half).map(p => tireBox(eq, p)).join('')}</div></div>`; }).join('')}
        ${pos.some(p => p.repuesto) ? `<div class="spares"><span class="lbl">Repuestos</span>${pos.filter(p => p.repuesto).map(p => tireBox(eq, p)).join('')}</div>` : ''}
      </div>
      <div class="tire-panel"><div class="card" id="tPanel"></div>
        <div class="card mt"><h3>Resumen del equipo</h3><div class="kpis">
          <div class="kpi"><div class="lbl">Posiciones</div><div class="val">${pos.length}</div><div class="sub">${pos.filter(p => p.repuesto).length} repuesto(s)</div></div>
          <div class="kpi ok"><div class="lbl">Instalados</div><div class="val">${inst.length}</div></div>
          <div class="kpi gray"><div class="lbl">Vacías</div><div class="val">${pos.length - inst.length}</div></div>
          <div class="kpi bad"><div class="lbl">Críticos</div><div class="val">${inst.filter(n => C.analisisNeum(n).critico).length}</div></div>
        </div></div></div></div>`;
    b.insertAdjacentHTML('beforeend', '<div class="card mt" id="regMed"></div>');
    b.querySelectorAll('.tire').forEach(t => t.onclick = () => { App.state.selPos = t.dataset.pos; b.querySelectorAll('.tire').forEach(x => x.classList.toggle('sel', x === t)); panel(eq, t.dataset.pos); V.medirPos(eq, t.dataset.pos); });
    registroMediciones(b.querySelector('#regMed'), eq);
    if (!App.state.selPos || !pos.find(p => p.pos === App.state.selPos)) App.state.selPos = pos[0].pos;
    b.querySelector(`.tire[data-pos="${App.state.selPos}"]`).classList.add('sel');
    panel(eq, App.state.selPos);
  }
  function panel(eq, posCode) {
    const el = document.getElementById('tPanel');
    const p = C.posiciones(eq.layoutNeum).find(x => x.pos === posCode);
    const n = C.neumEnPos(eq.id, posCode);
    if (!n) {
      el.innerHTML = `<h3>Posición P${p.num} · ${U.esc(p.pos)}</h3><div class="muted mb">${U.esc(p.label)} — <b>posición vacía</b></div>
        <div class="flex"><button class="btn btn-ok" id="pMed">✎ Medir y registrar neumático</button><button class="btn btn-orange" id="pInst">Instalar neumático</button><button class="btn btn-outline" id="pNew">Registrar nuevo e instalar</button></div>
        <div class="small muted mt">Neumáticos disponibles en almacén: ${stockDisponible().length}</div>`;
      el.querySelector('#pMed').onclick = () => V.medirPos(eq, posCode);
      el.querySelector('#pInst').onclick = () => V.instalar(eq, posCode);
      el.querySelector('#pNew').onclick = () => V.formNeum(null, saved => V.instalar(eq, posCode, saved));
      return;
    }
    const a = C.analisisNeum(n);
    el.innerHTML = `<h3>P${p.num} · ${U.esc(p.pos)} <span class="right">${U.pill(a.estadoDesg, C.DESG_LBL[a.estadoDesg])}</span></h3>
      <div class="ficha">${[['Código', n.codigo], ['Serie', n.serie], ['Marca / Modelo', `${n.marca || ''} ${n.modelo || ''}`], ['Medida', n.medida], ['Diseño', n.diseno], ['Estado', n.estado], ['Instalado', `${U.fdate(n.fechaInst)} @ ${U.num(n.lecturaInstalacion, 0)} ${C.unidad(eq)}`], ['Uso acumulado', `${U.num(a.uso, 0)} ${a.unidad}`],
        ['Cocada inicial / actual', `${U.num(a.profInicial, 1)} / ${U.num(a.profActual, 1)} mm`], ['Desgaste', a.ultima ? `${U.num(a.desgMm, 1)} mm (${U.num(a.desgPct, 1)}%)` : 'Sin inspección'], ['Presión', a.presion.diff === null ? 'Sin inspección' : `${a.presion.estado} (${a.presion.diff > 0 ? '+' : ''}${U.num(a.presion.diff, 1)} PSI)`],
        ['Vida útil restante', a.suficiente ? `${U.num(a.vidaRestHoy, 0)} ${a.unidadVida}` : 'Información insuficiente'], ['Reemplazo estimado', a.fechaReemplazo ? U.fdate(a.fechaReemplazo) : '—'], ['Última inspección', a.ultima ? `${U.fdate(a.ultima.fecha)} (${a.diasSinInsp} d)` : '—']]
        .map(([k, v]) => `<div><div class="k">${k}</div><div class="v">${U.esc(v || '—')}</div></div>`).join('')}</div>
      ${a.patrones.length ? `<div class="warn-box mt">Desgaste / condición: <b>${U.esc(a.patrones.join(', '))}</b></div>` : ''}
      ${!a.suficiente ? `<div class="small muted mt">Proyección: ${U.esc(a.motivoInsuf)}</div>` : ''}
      <div class="flex mt"><button class="btn btn-sm" data-a="ficha">Ficha e historial</button><button class="btn btn-sm btn-outline" data-a="mover">⇄ Rotar / cambiar posición</button><button class="btn btn-sm btn-outline" data-a="retirar">⤓ Retirar</button><button class="btn btn-sm btn-outline" data-a="estado">Cambiar estado</button><button class="btn btn-sm btn-outline" data-a="rep">Reparación</button><button class="btn btn-sm btn-orange" data-a="rem">✎ Medir remanente</button></div>`;
    el.querySelector('[data-a=ficha]').onclick = () => V.fichaNeum(n);
    el.querySelector('[data-a=mover]').onclick = () => V.mover(n);
    el.querySelector('[data-a=retirar]').onclick = () => V.retirar(n);
    el.querySelector('[data-a=estado]').onclick = () => V.cambiarEstado(n);
    el.querySelector('[data-a=rep]').onclick = () => V.reparar(n, 'Reparación');
    el.querySelector('[data-a=rem]').onclick = () => V.medirPos(eq, posCode);
  }

  // ---------------- A. Configuración de distribución por equipo ----------------
  V.equiposSinMedicion = () => {
    const x = C.equiposActivos().filter(e => !C.neumAplica(e));
    U.modal({ title: `Equipos sin medición de neumáticos (${x.length})`, size: 'lg', body: `<div class="tbl-wrap" style="max-height:420px"><table class="tbl"><thead><tr><th class="nosort">Código</th><th class="nosort">Descripción</th><th class="nosort">Motivo</th><th class="nosort">Desde</th><th class="nosort"></th></tr></thead><tbody>${x.map(e => `<tr><td><b>${U.esc(e.codigo)}</b></td><td>${U.esc(e.descripcion || '')}</td><td class="small">${U.esc(e.motivoSinNeum || '')}</td><td>${U.fdate(e.fechaSinNeum)}</td><td><button class="btn btn-sm btn-ok" data-inc="${e.id}">↺ Incluir</button></td></tr>`).join('')}</tbody></table></div>`,
      onOpen: (m, close) => m.querySelectorAll('[data-inc]').forEach(b => b.onclick = async () => { close(); await EQ.Views.equipos.cambiarAlcance([C.eq(b.dataset.inc)], 'neum', true); }), buttons: [{ label: 'Cerrar', cls: 'btn-outline' }] });
  };

  V.configLayout = eq => {
    const cfg = C.cfg();
    let lay = JSON.parse(JSON.stringify(eq.layoutNeum || cfg.layoutsNeum[eq.familia] || { ejes: [{ nombre: 'Eje 1', tipo: 'simple' }, { nombre: 'Eje 2', tipo: 'simple' }], repuestos: 0 }));
    const tpls = Object.assign({}, ...Object.entries(cfg.layoutsNeum).filter(([k, v]) => v).map(([k, v]) => ({ ['Familia: ' + k]: v })), cfg.layoutsExtra || {});
    const draw = m => {
      const tot = C.posiciones(lay).length;
      m.querySelector('#layBody').innerHTML = `<table class="tbl"><thead><tr><th class="nosort">#</th><th class="nosort">Nombre del eje</th><th class="nosort">Tipo</th><th class="nosort num">Neumáticos</th><th class="nosort"></th></tr></thead><tbody>
        ${lay.ejes.map((e, i) => `<tr><td>E${i + 1}</td><td><input data-i="${i}" data-f="nombre" value="${U.esc(e.nombre)}" style="width:100%"></td><td><select data-i="${i}" data-f="tipo">${U.opts([{ v: 'simple', t: 'Simple (1 por lado)' }, { v: 'dual', t: 'Dual / gemelas (2 por lado)' }], e.tipo)}</select></td><td class="num">${e.tipo === 'dual' ? 4 : 2}</td><td><button class="btn btn-ghost btn-sm" data-del="${i}">🗑</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">Sin ejes (equipo sobre orugas)</td></tr>'}
        </tbody></table><div class="flex mt"><button class="btn btn-outline btn-sm" id="addEje">+ Agregar eje</button><span class="spacer"></span><label>Repuestos <input type="number" id="nRep" min="0" max="4" value="${lay.repuestos || 0}" style="width:70px"></label><b>Total posiciones: ${tot}</b></div>`;
      m.querySelectorAll('#layBody [data-f]').forEach(i => i.onchange = () => { lay.ejes[+i.dataset.i][i.dataset.f] = i.value; draw(m); });
      m.querySelectorAll('#layBody [data-del]').forEach(x => x.onclick = () => { lay.ejes.splice(+x.dataset.del, 1); draw(m); });
      m.querySelector('#addEje').onclick = () => { lay.ejes.push({ nombre: `Eje ${lay.ejes.length + 1}`, tipo: 'simple' }); draw(m); };
      m.querySelector('#nRep').onchange = e => { lay.repuestos = Math.max(0, Math.min(4, parseInt(e.target.value) || 0)); draw(m); };
    };
    U.modal({ title: `Distribución de neumáticos · ${eq.codigo}`, size: 'lg', body: `<div class="flex mb"><b>Cargar plantilla:</b><select id="laySel">${U.opts(Object.keys(tpls), '', '— Seleccione —')}</select></div><div id="layBody"></div>
      <div class="info-box mt">La configuración es individual para este equipo. Si elimina posiciones que tienen neumáticos instalados, primero debe retirarlos.</div>`,
      onOpen: m => { draw(m); m.querySelector('#laySel').onchange = e => { if (tpls[e.target.value]) { lay = JSON.parse(JSON.stringify(tpls[e.target.value])); draw(m); } }; },
      buttons: [{ label: 'Cancelar', cls: 'btn-outline' }, { label: 'Guardar distribución', cls: 'btn-orange', onClick: async () => {
        lay.ejes.forEach((e, i) => { if (!e.nombre) e.nombre = `Eje ${i + 1}`; });
        const nuevas = new Set(C.posiciones(lay).map(p => p.pos));
        const huerf = C.neumEq(eq.id).filter(n => !nuevas.has(n.posicion));
        if (huerf.length) throw new Error(`Posición ocupada: retire primero los neumáticos de ${huerf.map(n => n.posicion + ' (' + n.codigo + ')').join(', ')}.`);
        eq.layoutNeum = lay; await EQ.DB.put('equipos', eq, { motivo: 'Configuración de neumáticos' });
        U.toast('Distribución guardada', 'ok'); EQ.App.refresh();
      } }] });
  };

  // ---------------- B. Ficha / formulario de neumático ----------------
  V.formNeum = (n, onSaved) => {
    const cfg = C.cfg(), isNew = !n;
    n = n || { estado: 'Nuevo', fechaAdq: U.today(), ciclo: 0, usoAcumulado: 0 };
    const body = `<form class="form-grid" id="fN">
      ${U.field('codigo', 'Código interno', { value: n.codigo, req: true })}
      ${U.field('serie', 'Número de serie', { value: n.serie, req: true })}
      ${U.field('marca', 'Marca', { type: 'datalist', options: cfg.marcasNeum, value: n.marca, req: true })}
      ${U.field('modelo', 'Modelo', { value: n.modelo })}
      ${U.field('medida', 'Medida', { type: 'datalist', options: cfg.medidas, value: n.medida, req: true })}
      ${U.field('diseno', 'Diseño', { type: 'datalist', options: cfg.disenos, value: n.diseno })}
      ${U.field('tipo', 'Tipo de neumático (límites)', { type: 'select', options: cfg.tiposNeumatico.map(t => t.nombre), value: n.tipo, req: true })}
      ${U.field('fechaAdq', 'Fecha de adquisición', { type: 'date', value: n.fechaAdq, attrs: `max="${U.today()}"` })}
      ${U.field('profInicial', 'Profundidad inicial de cocada (mm)', { type: 'number', value: n.profInicial, req: true, attrs: 'min="0"' })}
      ${U.field('presionRec', 'Presión recomendada (PSI)', { type: 'number', value: n.presionRec, req: true, attrs: 'min="0"' })}
      ${U.field('costo', 'Costo de adquisición', { type: 'number', value: n.costo, attrs: 'min="0"' })}
      ${U.field('monedaCosto', 'Moneda del costo', { type: 'select', options: [{ v: 'LOC', t: `${cfg.moneda} (moneda local)` }, { v: 'USD', t: `${cfg.monedaUSD || 'US$'} (dólares)` }], value: C.esUSD(n.monedaCosto) ? 'USD' : 'LOC', empty: undefined, hint: `T.C. ${U.num(C.tc(), 3)}` })}
      ${isNew ? U.field('estado', 'Estado inicial', { type: 'select', options: ['Nuevo', 'Reencauchado', 'Retirado'], value: n.estado, empty: undefined }) : `<div class="fld"><label>Estado actual</label><input value="${U.esc(n.estado)}" readonly></div>`}
      ${isNew ? U.field('usoAcumulado', 'Uso previo acumulado (h/km)', { type: 'number', value: 0, attrs: 'min="0"', hint: 'Si el neumático ya tenía uso antes de registrarlo' }) : ''}
      ${U.field('profAlerta', 'Profundidad de alerta (mm)', { type: 'number', value: n.profAlerta, hint: 'Vacío = según tipo', attrs: 'min="0"' })}
      ${U.field('profRetiro', 'Profundidad mínima de retiro (mm)', { type: 'number', value: n.profRetiro, hint: 'Vacío = según tipo', attrs: 'min="0"' })}
      ${U.field('tolPresion', 'Tolerancia de presión (±%)', { type: 'number', value: n.tolPresion, hint: 'Vacío = equipo / tipo / general', attrs: 'min="0"' })}
      ${U.field('observaciones', 'Observaciones', { type: 'textarea', value: n.observaciones, cls: 'full' })}
    </form>`;
    U.modal({ title: isNew ? 'Registrar neumático' : `Editar neumático ${n.codigo}`, size: 'lg', body,
      onOpen: m => { const f = m.querySelector('#fN'); f.querySelector('[name=tipo]').addEventListener('change', e => { const t = cfg.tiposNeumatico.find(x => x.nombre === e.target.value); if (!t) return; const pi = f.querySelector('[name=profInicial]'), pr = f.querySelector('[name=presionRec]'); if (!pi.value) pi.value = t.profNueva; if (!pr.value) pr.value = t.presionRec; }); },
      buttons: [{ label: 'Cancelar', cls: 'btn-outline' }, { label: 'Guardar', cls: 'btn-orange', onClick: async m => {
        const f = m.querySelector('#fN'); const d = U.formData(f);
        U.requireFields(f, d, ['codigo', 'serie', 'marca', 'medida', 'tipo', 'profInicial', 'presionRec']);
        d.monedaCosto = d.monedaCosto === 'USD' ? 'USD' : '';
        const neg = ['profInicial', 'presionRec', 'costo', 'profAlerta', 'profRetiro', 'tolPresion', 'usoAcumulado'].filter(k => d[k] !== null && d[k] !== undefined && d[k] < 0);
        if (neg.length) { U.markInvalid(f, neg); throw new Error('No se permiten valores negativos.'); }
        if (!(d.profInicial > 0) || d.profInicial > 150) { U.markInvalid(f, ['profInicial']); throw new Error('Profundidad inicial inválida.'); }
        if (d.profRetiro !== null && d.profRetiro >= d.profInicial) { U.markInvalid(f, ['profRetiro']); throw new Error('La profundidad de retiro debe ser menor que la inicial.'); }
        if (d.fechaAdq && d.fechaAdq > U.today()) { U.markInvalid(f, ['fechaAdq']); throw new Error('Fecha incorrecta: la adquisición no puede ser futura.'); }
        const dc = S.neumaticos.find(x => x.id !== n.id && String(x.codigo).toUpperCase() === d.codigo.toUpperCase());
        if (dc) { U.markInvalid(f, ['codigo']); throw new Error(`Neumático duplicado: el código ${d.codigo} ya existe.`); }
        const ds = S.neumaticos.find(x => x.id !== n.id && String(x.serie).toUpperCase() === d.serie.toUpperCase() && String(x.marca).toUpperCase() === d.marca.toUpperCase());
        if (ds) { U.markInvalid(f, ['serie']); throw new Error(`Neumático duplicado: la serie ${d.serie} (${d.marca}) ya está registrada como ${ds.codigo}.`); }
        if (!isNew && S.inspecciones.some(i => i.neumaticoId === n.id && (i.ciclo || 0) === (n.ciclo || 0)) && Number(n.profInicial) !== d.profInicial) {
          if (!(await U.confirm('Cambiar la profundidad inicial afecta los cálculos de desgaste de las inspecciones existentes. ¿Continuar?'))) return false;
        }
        Object.assign(n, d);
        if (isNew) { n.ciclo = 0; n.reencauches = 0; n.usoInicioCiclo = 0; }
        const saved = await EQ.DB.put('neumaticos', n);
        if (isNew) await C.registrarMovimiento(saved, 'Alta', { motivo: 'Registro en inventario', costo: 0, observaciones: `Estado ${saved.estado}` });
        U.toast('Neumático guardado', 'ok');
        if (onSaved) setTimeout(() => onSaved(saved), 50); else EQ.App.refresh();
      } }] });
  };

  // ---------------- Instalación / retiro / rotación ----------------
  V.instalar = (eq, posCode, pre) => {
    const cfg = C.cfg();
    const disp = stockDisponible();
    if (!disp.length) { U.modal({ title: 'Sin neumáticos disponibles', size: 'sm', body: '<p>No hay neumáticos en almacén con estado instalable (Nuevo, Reencauchado, Retirado). Registre uno nuevo.</p>', buttons: [{ label: 'Cerrar', cls: 'btn-outline' }, { label: 'Registrar neumático', cls: 'btn-orange', onClick: () => { setTimeout(() => V.formNeum(null, s => V.instalar(eq, posCode, s)), 50); } }] }); return; }
    const posList = C.posiciones(eq.layoutNeum);
    const un = C.unidad(eq);
    U.modal({ title: `Instalar neumático · ${eq.codigo}`, body: `<form class="form-grid" id="fI">
      ${U.field('neumaticoId', 'Neumático', { type: 'select', options: disp.map(n => ({ v: n.id, t: `${n.codigo} · ${n.marca} ${n.medida} · ${n.estado} · ${U.num(C.analisisNeum(n).profActual, 1)} mm` })), value: pre ? pre.id : disp[0].id, req: true })}
      ${U.field('posicion', 'Posición', { type: 'select', options: posList.map(p => ({ v: p.pos, t: `P${p.num} · ${p.pos} – ${p.label}${C.neumEnPos(eq.id, p.pos) ? ' (OCUPADA)' : ''}` })), value: posCode, req: true })}
      ${U.field('fecha', 'Fecha de instalación', { type: 'date', value: U.today(), req: true, attrs: `max="${U.today()}"` })}
      ${U.field('lectura', `${C.lecturaLbl(eq)} de instalación (${un})`, { type: 'number', value: eq.horometro, req: true, attrs: 'min="0"' })}
      ${U.field('responsable', 'Responsable', { type: 'datalist', options: C.tecnicos('Neumáticos').concat(cfg.responsables), req: true })}
      ${U.field('motivo', 'Motivo', { value: 'Instalación' })}
      ${U.field('observaciones', 'Observaciones', { type: 'textarea', cls: 'full' })}</form>`,
      buttons: [{ label: 'Cancelar', cls: 'btn-outline' }, { label: 'Instalar', cls: 'btn-orange', onClick: async m => {
        const f = m.querySelector('#fI'); const d = U.formData(f);
        U.requireFields(f, d, ['neumaticoId', 'posicion', 'fecha', 'lectura', 'responsable']);
        const n = S.neumaticos.find(x => x.id === d.neumaticoId);
        if (d.fecha > U.today()) { U.markInvalid(f, ['fecha']); throw new Error('Fecha incorrecta: no puede ser futura.'); }
        if (n.fechaAdq && d.fecha < n.fechaAdq) { U.markInvalid(f, ['fecha']); throw new Error('Fecha incorrecta: la instalación es anterior a la adquisición.'); }
        if (d.lectura < 0) throw new Error('Lectura negativa no permitida.');
        const oc = C.neumEnPos(eq.id, d.posicion);
        if (oc) { U.markInvalid(f, ['posicion']); throw new Error(`Posición ocupada por ${oc.codigo}. Retírelo o use "Rotar / cambiar posición".`); }
        try { C.validarLecturaEnFecha(eq, d.lectura, d.fecha); } catch (e) { U.markInvalid(f, ['lectura']); throw e; }
        if (n.posicion) throw new Error(`El neumático ya está instalado en ${(C.eq(n.equipoId) || {}).codigo} ${n.posicion}.`);
        if (n.unidadUso && n.unidadUso !== un && !(await U.confirm(`El neumático acumula uso en <b>${n.unidadUso}</b> y el equipo se controla en <b>${un}</b>. El uso acumulado mezclará unidades. ¿Continuar?`))) return false;
        const ult = C.ultimaLectura(eq);
        await C.registrarLecturaFecha(eq, d.lectura, d.fecha, 'instalación de neumático');
        n.equipoId = eq.id; n.posicion = d.posicion; n.lecturaInstalacion = d.lectura; n.fechaInst = d.fecha; n.unidadUso = n.unidadUso || un;
        if (n.estado !== 'En observación') n.estado = 'En servicio';
        await EQ.DB.put('neumaticos', n, { motivo: 'Instalación' });
        await C.registrarMovimiento(n, 'Instalación', { fecha: d.fecha, equipoId: eq.id, lectura: d.lectura, posAnterior: '', posNueva: d.posicion, motivo: d.motivo, responsable: d.responsable, observaciones: d.observaciones });
        EQ.App.state.selPos = d.posicion;
        U.toast(`${n.codigo} instalado en ${d.posicion}`, 'ok'); EQ.App.refresh();
      } }] });
  };

  V.retirar = n => {
    const eq = C.eq(n.equipoId), cfg = C.cfg(), un = C.unidad(eq);
    U.modal({ title: `Retirar neumático ${n.codigo} · ${eq.codigo} ${n.posicion}`, body: `<form class="form-grid" id="fRt">
      ${U.field('fecha', 'Fecha de retiro', { type: 'date', value: U.today(), req: true, attrs: `max="${U.today()}"` })}
      ${U.field('lectura', `${C.lecturaLbl(eq)} de retiro (${un})`, { type: 'number', value: eq.horometro, req: true, attrs: 'min="0"', hint: `Instalado a ${U.num(n.lecturaInstalacion, 1)} ${un}` })}
      ${U.field('estado', 'Destino / nuevo estado', { type: 'select', options: ['Retirado', 'En reparación', 'En observación', 'Baja definitiva'], value: 'Retirado', empty: undefined })}
      ${U.field('motivo', 'Motivo del retiro', { type: 'datalist', options: ['Desgaste límite', 'Rotación programada', 'Corte / daño', 'Separación de banda', 'Pinchazo', 'Reencauche', 'Cambio de equipo', 'Otro'], req: true })}
      ${U.field('profRetiro', 'Profundidad al retiro (mm, opcional)', { type: 'number', attrs: 'min="0"' })}
      ${U.field('responsable', 'Responsable', { type: 'datalist', options: C.tecnicos('Neumáticos').concat(cfg.responsables), req: true })}
      ${U.field('observaciones', 'Observaciones', { type: 'textarea', cls: 'full' })}</form>`,
      buttons: [{ label: 'Cancelar', cls: 'btn-outline' }, { label: 'Retirar', cls: 'btn-bad', onClick: async m => {
        const f = m.querySelector('#fRt'); const d = U.formData(f);
        U.requireFields(f, d, ['fecha', 'lectura', 'motivo', 'responsable']);
        if (d.fecha > U.today()) { U.markInvalid(f, ['fecha']); throw new Error('Fecha incorrecta: no puede ser futura.'); }
        if (n.fechaInst && d.fecha < n.fechaInst) { U.markInvalid(f, ['fecha']); throw new Error('Fecha incorrecta: anterior a la instalación.'); }
        if (!C.isRep(n.posicion) && d.lectura < Number(n.lecturaInstalacion)) { U.markInvalid(f, ['lectura']); throw new Error(`Lectura inferior a la de instalación (${n.lecturaInstalacion}).`); }
        try { C.validarLecturaEnFecha(eq, d.lectura, d.fecha); } catch (e) { U.markInvalid(f, ['lectura']); throw e; }
        if (d.profRetiro !== null && (d.profRetiro < 0 || d.profRetiro > Number(n.profInicial) + 1)) { U.markInvalid(f, ['profRetiro']); throw new Error('Profundidad inválida.'); }
        const ult = C.ultimaLectura(eq);
        await C.registrarLecturaFecha(eq, d.lectura, d.fecha, 'retiro de neumático');
        const per = C.isRep(n.posicion) ? 0 : d.lectura - Number(n.lecturaInstalacion);
        if (d.profRetiro !== null) {
          await EQ.DB.put('inspecciones', { sesionId: EQ.DB.uid(), fecha: d.fecha, equipoId: eq.id, lectura: d.lectura, neumaticoId: n.id, posicion: n.posicion, presionMed: null, presionRec: n.presionRec, profs: [d.profRetiro], profInt: null, profCen: d.profRetiro, profExt: null, condiciones: [], observaciones: 'Medición al retiro', inspector: d.responsable, fotos: [], ciclo: n.ciclo || 0, usoNeumatico: C.usoNeumEnLectura(n, d.lectura) }, { noAudit: true });
        }
        const pos = n.posicion;
        n.usoAcumulado = (Number(n.usoAcumulado) || 0) + Math.max(0, per);
        n.equipoId = null; n.posicion = null; n.lecturaInstalacion = null; n.estado = d.estado;
        if (d.estado === 'Baja definitiva') n.fechaBaja = d.fecha;
        await EQ.DB.put('neumaticos', n, { motivo: 'Retiro: ' + d.motivo });
        await C.registrarMovimiento(n, d.estado === 'Baja definitiva' ? 'Retiro y baja' : 'Retiro', { fecha: d.fecha, equipoId: eq.id, lectura: d.lectura, posAnterior: pos, posNueva: '', motivo: d.motivo, responsable: d.responsable, observaciones: d.observaciones, usoPeriodo: per });
        U.toast(`${n.codigo} retirado (${U.num(per, 0)} ${un} en el periodo)`, 'ok'); EQ.App.refresh();
      } }] });
  };

  V.mover = n => {
    const eq = C.eq(n.equipoId), cfg = C.cfg(), un = C.unidad(eq);
    const pos = C.posiciones(eq.layoutNeum).filter(p => p.pos !== n.posicion);
    U.modal({ title: `Rotar / cambiar posición · ${n.codigo} (${n.posicion})`, body: `<form class="form-grid" id="fM">
      ${U.field('destino', 'Posición destino', { type: 'select', options: pos.map(p => { const o = C.neumEnPos(eq.id, p.pos); return { v: p.pos, t: `P${p.num} · ${p.pos} – ${o ? 'ocupada por ' + o.codigo + ' (se intercambian)' : 'vacía'}` }; }), req: true })}
      ${U.field('fecha', 'Fecha', { type: 'date', value: U.today(), req: true, attrs: `max="${U.today()}"` })}
      ${U.field('lectura', `${C.lecturaLbl(eq)} (${un})`, { type: 'number', value: eq.horometro, req: true, attrs: 'min="0"' })}
      ${U.field('motivo', 'Motivo', { type: 'datalist', options: ['Rotación programada', 'Desgaste irregular', 'Igualar desgaste', 'Cambio a repuesto', 'Otro'], value: 'Rotación programada', req: true })}
      ${U.field('responsable', 'Responsable', { type: 'datalist', options: C.tecnicos('Neumáticos').concat(cfg.responsables), req: true })}
      ${U.field('observaciones', 'Observaciones', { type: 'textarea', cls: 'full' })}</form>`,
      buttons: [{ label: 'Cancelar', cls: 'btn-outline' }, { label: 'Aplicar', cls: 'btn-orange', onClick: async m => {
        const f = m.querySelector('#fM'); const d = U.formData(f);
        U.requireFields(f, d, ['destino', 'fecha', 'lectura', 'motivo', 'responsable']);
        if (d.fecha > U.today()) throw new Error('Fecha incorrecta: no puede ser futura.');
        const ult = C.ultimaLectura(eq);
        try { C.validarLecturaEnFecha(eq, d.lectura, d.fecha); } catch (e) { U.markInvalid(f, ['lectura']); throw e; }
        await C.registrarLecturaFecha(eq, d.lectura, d.fecha, 'rotación de neumático');
        const other = C.neumEnPos(eq.id, d.destino);
        const moveOne = async (t, to) => {
          const from = t.posicion;
          if (!C.isRep(from) && C.isRep(to)) { t.usoAcumulado = (Number(t.usoAcumulado) || 0) + Math.max(0, d.lectura - Number(t.lecturaInstalacion)); t.lecturaInstalacion = d.lectura; }
          else if (C.isRep(from) && !C.isRep(to)) t.lecturaInstalacion = d.lectura;
          t.posicion = to;
          await EQ.DB.put('neumaticos', t, { motivo: 'Rotación' });
          await C.registrarMovimiento(t, 'Rotación', { fecha: d.fecha, equipoId: eq.id, lectura: d.lectura, posAnterior: from, posNueva: to, motivo: d.motivo, responsable: d.responsable, observaciones: d.observaciones });
        };
        const orig = n.posicion;
        await moveOne(n, d.destino);
        if (other) await moveOne(other, orig);
        EQ.App.state.selPos = d.destino;
        U.toast(other ? `Intercambio ${orig} ⇄ ${d.destino}` : `Movido a ${d.destino}`, 'ok'); EQ.App.refresh();
      } }] });
  };

  V.cambiarEstado = n => {
    const cfg = C.cfg();
    const opts = cfg.estadosNeum.filter(e => e !== n.estado && (!n.posicion || !['Baja definitiva', 'Retirado'].includes(e)));
    U.modal({ title: `Cambiar estado · ${n.codigo}`, size: 'sm', body: `<form class="form-grid" id="fE">
      ${U.field('estado', 'Nuevo estado', { type: 'select', options: opts, req: true, cls: 'full' })}
      ${U.field('fecha', 'Fecha', { type: 'date', value: U.today(), req: true, attrs: `max="${U.today()}"`, cls: 'full' })}
      ${U.field('motivo', 'Motivo', { req: true, cls: 'full' })}
      ${U.field('responsable', 'Responsable', { type: 'datalist', options: C.tecnicos('Neumáticos').concat(cfg.responsables), cls: 'full' })}</form>
      ${n.posicion ? '<div class="small muted mt">Para retirar o dar de baja un neumático instalado use "Retirar".</div>' : ''}`,
      buttons: [{ label: 'Cancelar', cls: 'btn-outline' }, { label: 'Guardar', cls: 'btn-orange', onClick: async m => {
        const f = m.querySelector('#fE'); const d = U.formData(f);
        U.requireFields(f, d, ['estado', 'fecha', 'motivo']);
        if (d.fecha > U.today()) throw new Error('Fecha incorrecta.');
        const prev = n.estado; n.estado = d.estado; if (d.estado === 'Baja definitiva') n.fechaBaja = d.fecha;
        await EQ.DB.put('neumaticos', n, { motivo: d.motivo });
        await C.registrarMovimiento(n, d.estado === 'Baja definitiva' ? 'Baja definitiva' : 'Cambio de estado', { fecha: d.fecha, equipoId: n.equipoId, posAnterior: n.posicion || '', posNueva: n.posicion || '', motivo: `${prev} → ${d.estado}: ${d.motivo}`, responsable: d.responsable });
        U.toast('Estado actualizado', 'ok'); EQ.App.refresh();
      } }] });
  };

  V.reparar = (n, tipo) => {
    const cfg = C.cfg();
    if (tipo === 'Reencauche' && n.posicion) { U.toast('Retire el neumático antes de registrar un reencauche.', 'bad'); return; }
    U.modal({ title: `${tipo} · ${n.codigo}`, body: `<form class="form-grid" id="fRp">
      ${U.field('fecha', 'Fecha', { type: 'date', value: U.today(), req: true, attrs: `max="${U.today()}"` })}
      ${U.field('costo', 'Costo', { type: 'number', req: true, attrs: 'min="0"' })}
      ${U.field('monedaCosto', 'Moneda', { type: 'select', options: [{ v: 'LOC', t: cfg.moneda }, { v: 'USD', t: cfg.monedaUSD || 'US$' }], value: C.esUSD(n.monedaCosto) ? 'USD' : 'LOC', empty: undefined })}
      ${tipo === 'Reencauche' ? U.field('profNueva', 'Nueva profundidad de cocada (mm)', { type: 'number', req: true, attrs: 'min="0"' }) + U.field('disenoNuevo', 'Diseño de banda', { type: 'datalist', options: cfg.disenos, value: n.diseno }) : U.field('tipoRep', 'Tipo de reparación', { type: 'datalist', options: ['Parche', 'Vulcanizado', 'Reparación de corte', 'Reparación de talón', 'Otro'], req: true })}
      ${U.field('proveedor', 'Proveedor / taller', {})}
      ${!n.posicion ? U.field('estado', 'Estado posterior', { type: 'select', options: tipo === 'Reencauche' ? ['Reencauchado'] : ['Nuevo', 'Retirado', 'En reparación', 'Reencauchado'], value: tipo === 'Reencauche' ? 'Reencauchado' : 'Retirado', empty: undefined }) : ''}
      ${U.field('responsable', 'Responsable', { type: 'datalist', options: C.tecnicos('Neumáticos').concat(cfg.responsables), req: true })}
      ${U.field('observaciones', 'Observaciones', { type: 'textarea', cls: 'full' })}</form>
      ${tipo === 'Reencauche' ? '<div class="info-box mt">El reencauche inicia un nuevo ciclo de desgaste: la profundidad inicial pasa a ser la nueva cocada y el historial anterior se conserva.</div>' : ''}`,
      buttons: [{ label: 'Cancelar', cls: 'btn-outline' }, { label: 'Registrar', cls: 'btn-orange', onClick: async m => {
        const f = m.querySelector('#fRp'); const d = U.formData(f);
        U.requireFields(f, d, ['fecha', 'costo', 'responsable'].concat(tipo === 'Reencauche' ? ['profNueva'] : ['tipoRep']));
        if (d.costo < 0) throw new Error('Costo negativo no permitido.');
        if (d.fecha > U.today()) throw new Error('Fecha incorrecta.');
        if (tipo === 'Reencauche') {
          if (!(d.profNueva > 0) || d.profNueva > 150) { U.markInvalid(f, ['profNueva']); throw new Error('Profundidad inválida.'); }
          n.ciclo = (n.ciclo || 0) + 1; n.reencauches = (n.reencauches || 0) + 1;
          if (!n.profInicialOriginal) n.profInicialOriginal = n.profInicial;
          n.profInicial = d.profNueva; n.usoInicioCiclo = C.usoNeum(n); n.fechaInicioCiclo = d.fecha; if (d.disenoNuevo) n.diseno = d.disenoNuevo;
          n.estado = 'Reencauchado';
        } else if (d.estado) n.estado = d.estado;
        await EQ.DB.put('neumaticos', n, { motivo: tipo });
        await C.registrarMovimiento(n, tipo, { fecha: d.fecha, equipoId: n.equipoId, posAnterior: n.posicion || '', posNueva: n.posicion || '', motivo: tipo === 'Reencauche' ? `Reencauche #${n.reencauches} – cocada ${d.profNueva} mm` : d.tipoRep, responsable: d.responsable, observaciones: [d.proveedor ? 'Proveedor: ' + d.proveedor : '', d.observaciones].filter(Boolean).join(' · '), costo: d.costo, monedaCosto: d.monedaCosto === 'USD' ? 'USD' : '' });
        U.toast(`${tipo} registrado`, 'ok'); EQ.App.refresh();
      } }] });
  };

  // ---------------- Ficha completa con historial ----------------
  V.fichaNeum = n => {
    if (!n) return;
    const a = C.analisisNeum(n), eq = a.eq;
    const all = C.inspNeum(n, false);
    const movs = S.movimientos.filter(m => m.neumaticoId === n.id).sort((x, y) => (y.fecha + y.creado) > (x.fecha + x.creado) ? 1 : -1);
    U.modal({ title: `Neumático ${n.codigo}`, size: 'xl', body: `
      <div class="grid g2">
        <div class="card"><h3>Datos ${U.pill(a.estadoDesg, C.DESG_LBL[a.estadoDesg])}</h3><div class="ficha">
        ${[['Código', n.codigo], ['Serie', n.serie], ['Marca', n.marca], ['Modelo', n.modelo], ['Medida', n.medida], ['Diseño', n.diseno], ['Tipo', n.tipo], ['Estado', n.estado], ['Adquisición', U.fdate(n.fechaAdq)], ['Instalación', U.fdate(n.fechaInst)], ['Equipo / Posición', eq ? `${eq.codigo} · ${C.posLabel(eq, n.posicion)}` : 'En almacén'], ['Reencauches', n.reencauches || 0],
          ['Cocada inicial (ciclo)', `${U.num(n.profInicial, 1)} mm`], ['Cocada actual', `${U.num(a.profActual, 1)} mm`], ['Desgaste', `${U.num(a.desgMm, 1)} mm · ${U.num(a.desgPct, 1)}%`], ['Límites alerta / retiro', `${U.num(a.lim.profAlerta, 1)} / ${U.num(a.lim.profRetiro, 1)} mm`],
          ['Presión recomendada', `${U.num(n.presionRec, 0)} PSI (±${a.tol}%)`], ['Última presión', a.presion.estado], ['Uso acumulado', `${U.num(a.uso, 0)} ${a.unidad}`], ['Uso en ciclo actual', `${U.num(a.usoCiclo, 0)} ${a.unidad}`],
          ['Tasa de desgaste', a.suficiente ? (a.porDias ? `${U.num(a.tasaDia * 30, 2)} mm / 30 días` : `${U.num(a.tasa * 1000, 2)} mm / 1000 ${a.unidad}`) : '—'], ['Vida útil restante', a.suficiente ? `${U.num(a.vidaRestHoy, 0)} ${a.unidadVida}` : 'Información insuficiente'], ['Vida útil total estimada', a.suficiente ? `${U.num(a.vidaTotal, 0)} ${a.unidadVida}` : '—'], ['Reemplazo estimado', a.fechaReemplazo ? U.fdate(a.fechaReemplazo) : '—'],
          ['Costo adquisición', `${U.moneyC(n.costo, C.esUSD(n.monedaCosto) ? C.monUSD() : C.monBase())}${C.esUSD(n.monedaCosto) !== C.esUSD(C.monNeum()) ? ` <span class="small muted">≈ ${U.moneyN(a.costoAdq)}</span>` : ''}`], ['Costo reparaciones/reencauches', U.moneyN(a.costoMant)], ['Costo total', U.moneyN(a.costoTotal)], [`Costo por ${a.unidad}`, a.costoUso ? U.moneyN(a.costoUso) : '—']]
          .map(([k, v]) => `<div><div class="k">${k}</div><div class="v">${U.esc(v === null || v === undefined || v === '' ? '—' : v)}</div></div>`).join('')}</div>
          ${!a.suficiente ? `<div class="warn-box mt">No se proyecta vida útil: ${U.esc(a.motivoInsuf)}.</div>` : ''}
          ${a.patrones.length ? `<div class="bad-box mt">Condiciones detectadas: <b>${U.esc(a.patrones.join(', '))}</b></div>` : ''}
          <div class="flex mt"><button class="btn btn-sm btn-outline" id="fnEd">✎ Editar</button>${!n.posicion ? '<button class="btn btn-sm btn-outline" id="fnRe">Reencauche</button><button class="btn btn-sm btn-outline" id="fnRp">Reparación</button><button class="btn btn-sm btn-outline" id="fnEs">Cambiar estado</button>' : ''}</div></div>
        <div class="card"><h3>Evolución de cocada (mm)</h3><div class="chart-box"><canvas id="chFN"></canvas></div></div>
      </div>
      <div class="card mt"><h3>Inspecciones (${all.length})</h3><div class="tbl-wrap" style="max-height:260px"><table class="tbl"><thead><tr><th>Fecha</th><th>Ciclo</th><th>Equipo/Pos.</th><th class="num">Uso</th><th class="num">PSI med/rec</th><th>Remanentes (mm)</th><th class="num">Prom.</th><th>Condición</th><th>Inspector</th><th>Fotos</th><th></th></tr></thead><tbody>
        ${all.slice().reverse().map(i => `<tr><td>${U.fdate(i.fecha)}</td><td>${i.ciclo || 0}</td><td>${U.esc((C.eq(i.equipoId) || {}).codigo || '')} ${U.esc(i.posicion || '')}</td><td class="num">${U.num(i.usoNeumatico, 0)}</td><td class="num">${U.num(i.presionMed, 0)}/${U.num(i.presionRec, 0)}</td><td>${U.esc(C.profsOf(i).map(x => U.num(x, 1)).join(' / '))}</td><td class="num">${U.num(C.profProm(i), 1)}</td><td>${U.esc(C.patrones(i).join(', ') || 'Sin novedad')}</td><td>${U.esc(i.inspector || '')}</td><td>${(i.fotos || []).map(f => `<img class="photo-thumb" src="${f}">`).join('')}</td><td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-ei="${i.id}" title="Editar">✎</button><button class="btn btn-ghost btn-sm" data-di="${i.id}" title="Eliminar">🗑</button></td></tr>`).join('') || '<tr><td colspan="11" class="muted">Sin inspecciones</td></tr>'}</tbody></table></div></div>
      <div class="card mt"><h3>Historial de movimientos (${movs.length})</h3><div class="tbl-wrap" style="max-height:260px"><table class="tbl"><thead><tr><th>Fecha</th><th>Tipo</th><th>Equipo</th><th class="num">Lectura</th><th>Pos. anterior</th><th>Pos. nueva</th><th>Motivo</th><th>Responsable</th><th class="num">Costo</th><th>Observaciones</th></tr></thead><tbody>
        ${movs.map(m => `<tr><td>${U.fdate(m.fecha)}</td><td><b>${U.esc(m.tipo)}</b></td><td>${U.esc((C.eq(m.equipoId) || {}).codigo || '')}</td><td class="num">${U.num(m.lectura, 0)}</td><td>${U.esc(m.posAnterior || '')}</td><td>${U.esc(m.posNueva || '')}</td><td>${U.esc(m.motivo || '')}</td><td>${U.esc(m.responsable || '')}</td><td class="num">${m.costo ? U.moneyC(m.costo, C.esUSD(m.monedaCosto) ? C.monUSD() : C.monBase()) : ''}</td><td>${U.esc(m.observaciones || '')}</td></tr>`).join('') || '<tr><td colspan="10" class="muted">Sin movimientos</td></tr>'}</tbody></table></div></div>`,
      onOpen: (m, close) => {
        m.querySelectorAll('.photo-thumb').forEach(i => i.onclick = () => U.showPhoto(i.src));
        const ins = all.filter(i => C.profProm(i) !== null);
        U.chart('chFN', { type: 'line', data: { labels: ins.map(i => U.fdate(i.fecha)), datasets: [{ label: 'Cocada promedio (mm)', data: ins.map(i => +C.profProm(i).toFixed(2)) }, ...(a.lim.profRetiro !== null ? [{ label: 'Límite de retiro', data: ins.map(() => a.lim.profRetiro), borderColor: U.STATUS.rojo, backgroundColor: U.STATUS.rojo, borderDash: [6, 4], pointRadius: 0 }] : [])] } });
        const go = (id, fn) => { const b = m.querySelector(id); if (b) b.onclick = () => { close(); setTimeout(fn, 30); }; };
        m.addEventListener('click', e => { const ei = e.target.closest('[data-ei]'), di = e.target.closest('[data-di]'); if (ei) { close(); setTimeout(() => V.editarMedicion(S.inspecciones.find(x => x.id === ei.dataset.ei)), 30); } if (di) { close(); setTimeout(() => V.eliminarMedicion(S.inspecciones.find(x => x.id === di.dataset.di)), 30); } });
        go('#fnEd', () => V.formNeum(n)); go('#fnRe', () => V.reparar(n, 'Reencauche')); go('#fnRp', () => V.reparar(n, 'Reparación')); go('#fnEs', () => V.cambiarEstado(n));
      } });
  };

  // ---------------- Inventario ----------------
  function renderInventario(root) {
    const cfg = C.cfg();
    const st = EQ.App.state.invF || (EQ.App.state.invF = { estado: '', ubic: '' });
    const rows = S.neumaticos.filter(n => (!st.estado || n.estado === st.estado) && (!st.ubic || (st.ubic === 'inst' ? !!n.posicion : !n.posicion))).map(n => Object.assign({}, n, { _a: C.analisisNeum(n) }));
    root.innerHTML = `<div class="selector-bar"><b>Filtros:</b><select id="iE">${U.opts(cfg.estadosNeum, st.estado, 'Todos los estados')}</select><select id="iU">${U.opts([{ v: 'inst', t: 'Instalados' }, { v: 'alm', t: 'En almacén / fuera de equipo' }], st.ubic, 'Todas las ubicaciones')}</select>
      <span class="spacer"></span><button class="btn btn-orange btn-sm" id="iNew">+ Registrar neumático</button></div>
      <div class="kpis mb">${cfg.estadosNeum.map(e => `<div class="kpi clickable" data-e="${U.esc(e)}"><div class="lbl">${U.esc(e)}</div><div class="val">${S.neumaticos.filter(n => n.estado === e).length}</div></div>`).join('')}</div>
      <div class="card"><div id="tInv"></div></div>`;
    root.querySelector('#iE').onchange = e => { st.estado = e.target.value; EQ.App.refresh(); };
    root.querySelector('#iU').onchange = e => { st.ubic = e.target.value; EQ.App.refresh(); };
    root.querySelectorAll('[data-e]').forEach(k => k.onclick = () => { st.estado = k.dataset.e; EQ.App.refresh(); });
    root.querySelector('#iNew').onclick = () => V.formNeum(null);
    U.table(root.querySelector('#tInv'), { exportName: 'inventario_neumaticos', rows, empty: 'No hay neumáticos registrados', cols: [
      { k: 'codigo', t: 'Código', fmt: (v, r) => `<a href="#" data-f="${r.id}"><b>${U.esc(v)}</b></a>`, text: r => r.codigo },
      { k: 'serie', t: 'Serie' }, { k: 'marca', t: 'Marca' }, { k: 'modelo', t: 'Modelo' }, { k: 'medida', t: 'Medida' }, { k: 'diseno', t: 'Diseño' },
      { k: 'estado', t: 'Estado', fmt: v => U.pill({ 'Nuevo': 'info', 'En servicio': 'verde', 'En observación': 'amarillo', 'En reparación': 'amarillo', 'Reencauchado': 'info', 'Retirado': 'gris', 'Baja definitiva': 'rojo' }[v] || 'gris', v), text: r => r.estado },
      { k: 'eq', t: 'Equipo · Posición', sort: r => r.equipoId ? (C.eq(r.equipoId) || {}).codigo : 'zzz', fmt: (v, r) => r.equipoId ? `${U.esc((C.eq(r.equipoId) || {}).codigo)} · ${U.esc(r.posicion)}` : '<span class="muted">Almacén</span>', text: r => r.equipoId ? `${(C.eq(r.equipoId) || {}).codigo} ${r.posicion}` : 'Almacén' },
      { k: 'pa', t: 'Cocada (mm)', num: true, sort: r => r._a.profActual, fmt: (v, r) => U.num(r._a.profActual, 1), text: r => r._a.profActual },
      { k: 'dp', t: 'Desgaste %', num: true, sort: r => r._a.desgPct, fmt: (v, r) => r._a.ultima ? U.num(r._a.desgPct, 1) : '—', text: r => r._a.desgPct },
      { k: 'ed', t: 'Condición', sort: r => r._a.estadoDesg, fmt: (v, r) => U.pill(r._a.estadoDesg, C.DESG_LBL[r._a.estadoDesg]), text: r => C.DESG_LBL[r._a.estadoDesg] },
      { k: 'uso', t: 'Uso acum.', num: true, sort: r => r._a.uso, fmt: (v, r) => U.num(r._a.uso, 0), text: r => r._a.uso },
      { k: 'costo', t: 'Costo', num: true, sort: r => r._a.costoAdq, fmt: (v, r) => v ? U.moneyC(v, C.esUSD(r.monedaCosto) ? C.monUSD() : C.monBase()) : '—', text: r => r.costo },
      { k: 'mon', t: 'Moneda', sort: r => C.esUSD(r.monedaCosto) ? 1 : 0, fmt: (v, r) => C.esUSD(r.monedaCosto) ? C.monUSD() : C.monBase(), text: r => C.esUSD(r.monedaCosto) ? C.monUSD() : C.monBase() },
      { k: 'acc', t: '', nosort: true, noexport: true, fmt: (v, r) => `<div class="flex" style="flex-wrap:nowrap"><button class="btn btn-ghost btn-sm" data-a="ed" data-id="${r.id}" title="Editar">✎</button>${!r.posicion ? `<button class="btn btn-ghost btn-sm" data-a="re" data-id="${r.id}" title="Reencauche">♻</button><button class="btn btn-ghost btn-sm" data-a="rp" data-id="${r.id}" title="Reparación">🔧</button><button class="btn btn-ghost btn-sm" data-a="es" data-id="${r.id}" title="Cambiar estado / baja">⇆</button>` : ''}${!S.movimientos.some(m => m.neumaticoId === r.id && m.tipo !== 'Alta') && !S.inspecciones.some(i => i.neumaticoId === r.id) && !r.posicion ? `<button class="btn btn-ghost btn-sm" data-a="dl" data-id="${r.id}" title="Eliminar">🗑</button>` : ''}</div>` }] });
    root.querySelector('#tInv').addEventListener('click', async e => {
      const f = e.target.closest('[data-f]'); if (f) { e.preventDefault(); V.fichaNeum(S.neumaticos.find(x => x.id === f.dataset.f)); return; }
      const b = e.target.closest('[data-a]'); if (!b) return;
      const n = S.neumaticos.find(x => x.id === b.dataset.id);
      if (b.dataset.a === 'ed') V.formNeum(n);
      if (b.dataset.a === 're') V.reparar(n, 'Reencauche');
      if (b.dataset.a === 'rp') V.reparar(n, 'Reparación');
      if (b.dataset.a === 'es') V.cambiarEstado(n);
      if (b.dataset.a === 'dl' && await U.confirm(`¿Eliminar el neumático ${U.esc(n.codigo)}? Solo es posible porque no tiene historial.`)) { for (const m of S.movimientos.filter(m => m.neumaticoId === n.id)) await EQ.DB.del('movimientos', m.id, { noAudit: true }); await EQ.DB.del('neumaticos', n.id); EQ.App.refresh(); }
    });
  }

  // ---------------- D. Inspección por sesión ----------------
  function renderInspeccion(root) {
    const App = EQ.App, cfg = C.cfg();
    const meds = C.medNombres();
    root.innerHTML = `<div class="selector-bar"><b>Equipo:</b> ${App.eqSelector(root, { modulo: 'neum' })}</div><div id="inBody"></div>`;
    App.wireEqSelector(root);
    const eq = C.eq(App.state.eqId), un = C.unidad(eq);
    const b = root.querySelector('#inBody');
    const posMap = Object.fromEntries(C.posiciones(eq.layoutNeum).map(p => [p.pos, p]));
    const tires = C.neumEq(eq.id).sort((x, y) => ((posMap[x.posicion] || {}).num || 99) - ((posMap[y.posicion] || {}).num || 99));
    if (!tires.length) { b.innerHTML = `<div class="card">${U.emptyState('◎', 'El equipo no tiene neumáticos instalados', 'Regístrelos tocando cada posición en <b>Medición de remanentes</b>.')}</div>`; return; }
    b.innerHTML = `<div class="card"><h3>Sesión de inspección · ${U.esc(C.eqLabel(eq))}</h3>
      <form class="form-grid" id="fS">
        ${U.field('fecha', 'Fecha', { type: 'date', value: U.today(), req: true, attrs: `max="${U.today()}"` })}
        ${U.field('lectura', `${C.lecturaLbl(eq)} (${un})`, { type: 'number', value: '', attrs: 'min="0"', hint: `Opcional · último: ${U.num(eq.horometro, 1)} ${un}` })}
        ${U.field('inspector', 'Inspector', { type: 'datalist', options: C.tecnicos('Neumáticos') })}
        ${U.field('observaciones', 'Observaciones generales', {})}
      </form>
      <div class="info-box mt">Complete solo lo que midió. Puede ingresar 1 a ${meds.length} remanentes por neumático (${meds.map(U.esc).join(', ')}), solo la presión o solo la condición. Las filas vacías no se registran. Los puntos de medición se configuran en Configuración → Listas.</div>
      <div class="tbl-wrap mt" style="max-height:none"><table class="tbl rem-grid" id="tIns"><thead><tr><th class="nosort">Pos.</th><th class="nosort">Neumático</th><th class="nosort num">PSI rec.</th><th class="nosort num">PSI medida</th>${meds.map(m => `<th class="nosort num">${U.esc(m)} mm</th>`).join('')}<th class="nosort">Condición física</th><th class="nosort">Obs.</th><th class="nosort">Fotos</th><th class="nosort">Resultado</th></tr></thead><tbody>
      ${tires.map(n => { const a = C.analisisNeum(n); return `<tr data-id="${n.id}"><td><b>P${(posMap[n.posicion] || {}).num || ''}</b><div class="small muted">${U.esc(n.posicion)}</div></td>
        <td><b>${U.esc(n.codigo)}</b><div class="small muted">ini ${U.num(n.profInicial, 1)} · últ ${U.num(a.profActual, 1)} mm</div></td>
        <td class="num"><input type="number" class="pr" value="${n.presionRec || ''}" min="0" step="any" style="width:64px"></td>
        <td class="num"><input type="number" class="pm" min="0" step="any" style="width:64px"></td>
        ${meds.map((m, k) => `<td class="num"><input type="number" class="pf" data-k="${k}" min="0" step="any" style="width:58px"></td>`).join('')}
        <td><details class="cond"><summary>Seleccionar</summary><div class="cond-box">${cfg.condiciones.map(c => `<label><input type="checkbox" value="${U.esc(c)}">${U.esc(c)}</label>`).join('')}</div></details></td>
        <td><input class="ob" style="width:120px"></td>
        <td><input type="file" class="ft" accept="image/*" multiple style="width:110px"></td>
        <td class="res small"></td></tr>`; }).join('')}
      </tbody></table></div>
      <div class="flex mt"><span class="spacer"></span><button class="btn btn-ok" id="bSaveI">✓ Guardar inspección</button></div></div>`;
    const tb = b.querySelector('#tIns');
    const live = tr => {
      const n = S.neumaticos.find(x => x.id === tr.dataset.id);
      const v = el => U.toNum(el.value);
      const i = { profs: [...tr.querySelectorAll('.pf')].map(v), condiciones: [...tr.querySelectorAll('.cond input:checked')].map(x => x.value) };
      const pm = v(tr.querySelector('.pm')), pr = v(tr.querySelector('.pr'));
      const out = [];
      const prom = C.profProm(i);
      if (prom !== null) out.push(`Prom ${U.num(prom, 1)} mm · ${U.num((n.profInicial - prom) / n.profInicial * 100, 0)}%${prom > Number(n.profInicial) ? ' <span style="color:var(--bad)">&gt; inicial</span>' : ''}`);
      if (pm !== null && pr) { const ps = C.presionEstado(pm, pr, C.tolPresion(n, eq)); out.push(U.pill(ps.cls, `${ps.diff > 0 ? '+' : ''}${U.num(ps.diff, 1)} PSI`)); }
      const pat = C.patrones(i); if (pat.length) out.push(`<span style="color:var(--bad)">${U.esc(pat.join(', '))}</span>`);
      tr.querySelector('.res').innerHTML = out.join('<br>');
      tr.querySelector('summary').textContent = i.condiciones.length ? i.condiciones.length + ' sel.' : 'Seleccionar';
    };
    tb.addEventListener('input', e => live(e.target.closest('tr')));
    tb.addEventListener('change', e => live(e.target.closest('tr')));
    b.querySelector('#bSaveI').onclick = async () => {
      const btn = b.querySelector('#bSaveI'); btn.disabled = true;
      try { await guardarInspeccion(eq, b); } catch (e) { U.toast(e.message, 'bad'); } finally { btn.disabled = false; }
    };
  }

  async function guardarInspeccion(eq, b) {
    const f = b.querySelector('#fS'); const d = U.formData(f);
    U.requireFields(f, d, ['fecha']);
    if (d.fecha > U.today()) { U.markInvalid(f, ['fecha']); throw new Error('Fecha incorrecta: no puede ser futura.'); }
    if (d.lectura !== null && d.lectura < 0) { U.markInvalid(f, ['lectura']); throw new Error('Lectura negativa no permitida.'); }
    let lecturaOk = true;
    if (d.lectura !== null) { try { C.validarLecturaEnFecha(eq, d.lectura, d.fecha); } catch (e) { lecturaOk = false; if (!(await U.confirm(`${U.esc(e.message)}<br><br>¿Guardar las mediciones de todas formas, sin actualizar el ${C.lecturaLbl(eq).toLowerCase()} del equipo?`))) return; } }
    const rows = [], errs = [], warns = [];
    for (const tr of b.querySelectorAll('#tIns tbody tr')) {
      const n = S.neumaticos.find(x => x.id === tr.dataset.id);
      const v = el => U.toNum(el.value);
      const r = { n, presionRec: v(tr.querySelector('.pr')), presionMed: v(tr.querySelector('.pm')), profs: [...tr.querySelectorAll('.pf')].map(v), condiciones: [...tr.querySelectorAll('.cond input:checked')].map(x => x.value), obs: tr.querySelector('.ob').value.trim(), files: tr.querySelector('.ft').files };
      const any = r.presionMed !== null || r.profs.some(x => x !== null) || r.condiciones.length || r.obs || r.files.length;
      if (!any) continue;
      if (r.profs.some(x => x !== null && x < 0)) errs.push(`${n.codigo}: remanente negativo`);
      if (r.profs.some(x => x !== null && x > Number(n.profInicial))) warns.push(`${n.codigo}: remanente mayor a la cocada inicial (${n.profInicial} mm)`);
      if (r.presionMed !== null && (r.presionMed < 0 || r.presionMed > 300)) errs.push(`${n.codigo}: presión inválida`);
      if (C.inspNeum(n, false).some(i => i.fecha > d.fecha)) warns.push(`${n.codigo}: ya tiene mediciones posteriores (se ordenará por fecha)`);
      rows.push(r);
    }
    if (!rows.length) throw new Error('Registro incompleto: ingrese datos de al menos un neumático.');
    if (errs.length) throw new Error('Corrija: ' + errs.slice(0, 4).join(' · '));
    if (warns.length && !(await U.confirm(`Revise antes de guardar:<ul>${warns.slice(0, 10).map(w => `<li>${U.esc(w)}</li>`).join('')}</ul>¿Guardar de todas formas?`))) return;
    const sid = EQ.DB.uid();
    let cambios = 0;
    for (const r of rows) {
      const fotos = await U.readPhotos(r.files);
      await C.guardarMedicion({ n: r.n, fecha: d.fecha, lectura: d.lectura, profs: r.profs, presionMed: r.presionMed, presionRec: r.presionRec, condiciones: r.condiciones, observaciones: [r.obs, d.observaciones].filter(Boolean).join(' · '), inspector: d.inspector, fotos, posicion: r.n.posicion, equipoId: eq.id, sesionId: sid, registrarLectura: lecturaOk });
      cambios += await marcarObservacion(r.n, d.fecha, d.inspector);
    }
    await EQ.DB.audit('inspecciones', sid, 'Creación', `Sesión ${eq.codigo} ${d.fecha}: ${rows.length} neumático(s)`);
    U.toast(`Inspección guardada: ${rows.length} neumático(s)${cambios ? `, ${cambios} pasaron a "En observación"` : ''}.`, 'ok');
    EQ.App.state.tab.neumaticos = 'diagrama'; EQ.App.refresh();
  }
  async function marcarObservacion(n, fecha, resp) {
    const a = C.analisisNeum(n);
    if (n.estado === 'En servicio' && (a.estadoDesg === 'rojo' || a.irregular)) {
      n.estado = 'En observación'; await EQ.DB.put('neumaticos', n, { motivo: 'Medición de remanente' });
      await C.registrarMovimiento(n, 'Cambio de estado', { fecha, equipoId: n.equipoId, posAnterior: n.posicion, posNueva: n.posicion, motivo: `En servicio → En observación (${a.patrones.join(', ') || 'remanente crítico'})`, responsable: resp || '' });
      return 1;
    }
    return 0;
  }

  // tipo de neumático sugerido según la familia del equipo (límites, cocada nueva y presión)
  const tipoSugerido = eq => { const ts = C.cfg().tiposNeumatico; const f = (eq && eq.familia) || ''; const by = re => ts.find(t => re.test(t.nombre)); return (/volquete|cisterna|tracto/i.test(f) && by(/cami[oó]n/i)) || (/camioneta/i.test(f) && by(/camioneta/i)) || (/minib/i.test(f) && by(/minib/i)) || (/cargador|motoniv|retro|rodillo/i.test(f) && by(/OTR/i)) || ts[0] || {}; };

  // ---------------- MEDICIÓN DE REMANENTES (tocando cada posición del diagrama) ----------------
  const yoNombre = () => (EQ.Bridge.me() || {}).name || '';
  const codigoLibre = base => { let c = base, k = 1; while (S.neumaticos.some(x => String(x.codigo).toUpperCase() === c.toUpperCase())) c = `${base}-${++k}`; return c; };
  V.medirPos = (eq, posCode) => {
    const cfg = C.cfg(), meds = C.medNombres(), un = C.unidad(eq), tec = !EQ.Bridge.isSup();
    const pos = C.posiciones(eq.layoutNeum), p = pos.find(x => x.pos === posCode); if (!p) return;
    const n = C.neumEnPos(eq.id, posCode), a = n ? C.analisisNeum(n) : null;
    const sig = pos[pos.indexOf(p) + 1] || null;
    const ult = a && a.ultima ? C.profsOf(a.ultima) : [];
    const insp = tec ? U.field('inspector', 'Medido por', { value: yoNombre(), attrs: 'readonly' }) : U.field('inspector', 'Medido por', { type: 'datalist', options: C.tecnicos('Neumáticos'), value: yoNombre(), req: true });
    U.modal({ title: `P${p.num} · ${p.pos} — ${eq.codigo}`, size: 'lg', body: `
      <div class="muted small mb">${U.esc(p.label)}${n ? ` · Neumático <b>${U.esc(n.codigo)}</b>${a.ultima ? ` · última medición ${U.fdate(a.ultima.fecha)}: ${ult.map(x => U.num(x, 1)).join(' / ')} mm` : ' · sin mediciones'}` : ' · <b>sin neumático registrado</b>: se registrará con estos datos'}</div>
      <div class="section-title">Neumático instalado</div>
      <form class="form-grid med-grid" id="fMn">
        ${n ? '' : U.field('codigo', 'Código / serie', { hint: `Vacío = ${U.esc(eq.codigo)}-${U.esc(p.pos)}` })}
        ${U.field('marca', 'Marca', { type: 'datalist', options: cfg.marcasNeum, value: n ? n.marca : '' })}
        ${U.field('modelo', 'Modelo', { value: n ? n.modelo : '' })}
        ${U.field('medida', 'Medida', { type: 'datalist', options: cfg.medidas, value: n ? n.medida : '', hint: 'Ej. 265/70R16' })}
        ${n ? '' : U.field('profInicial', 'Cocada nueva (mm)', { type: 'number', attrs: 'min="0" inputmode="decimal"', hint: 'Opcional' })}
      </form>
      <div class="section-title">Medición</div>
      <form class="form-grid med-grid" id="fMm">
        ${meds.map((m, k) => U.field('p' + k, `Remanente ${m} (mm)`, { type: 'number', attrs: `min="0" inputmode="decimal" placeholder="${ult[k] !== undefined ? 'últ. ' + U.num(ult[k], 1) : ''}"` })).join('')}
        ${U.field('presionMed', 'Presión (PSI)', { type: 'number', attrs: `min="0" inputmode="decimal"${n && n.presionRec ? ` placeholder="rec. ${U.num(n.presionRec, 0)}"` : ''}`, hint: 'Opcional' })}
        ${U.field('fecha', 'Fecha', { type: 'date', value: U.today(), req: true, attrs: `max="${U.today()}"` })}
        ${U.field('lectura', `${C.lecturaLbl(eq)} (${un})`, { type: 'number', attrs: 'min="0" inputmode="decimal"', hint: `Opcional · último ${U.num(eq.horometro, 1)}` })}
        ${insp}
        ${U.field('observaciones', 'Observación', { cls: 'full' })}
      </form>`,
      onOpen: m => { const f = m.querySelector('[name=p0]'); if (f) setTimeout(() => f.focus(), 60); },
      buttons: [{ label: 'Cancelar', cls: 'btn-outline' }, { label: '✓ Guardar', cls: 'btn-ok', onClick: m => guardarMedPos(m, eq, p, n) },
        sig ? { label: `Guardar y P${sig.num} ›`, cls: 'btn-orange', onClick: async m => { const r = await guardarMedPos(m, eq, p, n); if (r !== false) setTimeout(() => V.medirPos(eq, sig.pos), 80); return r; } } : null].filter(Boolean) });
  };
  async function guardarMedPos(m, eq, p, n) {
    const fn = m.querySelector('#fMn'), fm = m.querySelector('#fMm');
    const dn = U.formData(fn), dm = U.formData(fm), meds = C.medNombres();
    const profs = meds.map((_, k) => dm['p' + k]);
    if (!profs.some(x => x !== null)) { U.markInvalid(fm, ['p0']); throw new Error('Registro incompleto: ingrese al menos un remanente.'); }
    if (profs.some(x => x !== null && (x < 0 || x > 150))) throw new Error('Valor de remanente inválido.');
    if (!dm.fecha || dm.fecha > U.today()) { U.markInvalid(fm, ['fecha']); throw new Error('Fecha incorrecta: no puede estar vacía ni ser futura.'); }
    if (dm.lectura !== null && dm.lectura < 0) throw new Error('Lectura negativa no permitida.');
    const inspector = !EQ.Bridge.isSup() ? yoNombre() : dm.inspector;
    if (!inspector) { U.markInvalid(fm, ['inspector']); throw new Error('Indique quién hizo la medición.'); }
    const mx = Math.max(...profs.filter(x => x !== null));
    if (n && mx > Number(n.profInicial) && !(await U.confirm(`El remanente (${U.num(mx, 1)} mm) es mayor que la cocada inicial registrada de ${n.codigo} (${U.num(n.profInicial, 1)} mm). ¿Guardar de todas formas?`))) return false;
    if (!n) { // posición sin neumático: se registra e instala con lo que se midió
      const t = tipoSugerido(eq), cod = codigoLibre(dn.codigo || `${eq.codigo}-${p.pos}`);
      let serie = dn.codigo || cod, k = 1; const marca = dn.marca || 'Sin marca';
      while (S.neumaticos.some(x => String(x.serie).toUpperCase() === String(serie).toUpperCase() && String(x.marca).toUpperCase() === marca.toUpperCase())) serie = `${dn.codigo || cod}-${++k}`;
      const ini = dn.profInicial > 0 ? Math.max(dn.profInicial, mx) : Math.max(Number(t.profNueva) || 0, mx);
      const lect = dm.lectura !== null ? dm.lectura : (Number(eq.horometro) || 0);
      n = await EQ.DB.put('neumaticos', { codigo: cod, serie, marca, modelo: dn.modelo || '', medida: dn.medida || 'Sin medida', tipo: t.nombre || '', profInicial: ini, presionRec: t.presionRec || null, estado: 'En servicio', fechaAdq: '', ciclo: 0, reencauches: 0, usoAcumulado: 0, usoInicioCiclo: 0,
        equipoId: eq.id, posicion: p.pos, lecturaInstalacion: lect, fechaInst: dm.fecha, unidadUso: C.unidad(eq), observaciones: `Registrado desde la medición de remanentes (${eq.codigo} ${p.pos}).` });
      await C.registrarMovimiento(n, 'Alta', { motivo: 'Registro desde la medición de remanentes', responsable: inspector });
      await C.registrarMovimiento(n, 'Instalación', { fecha: dm.fecha, equipoId: eq.id, lectura: lect, posAnterior: '', posNueva: p.pos, motivo: 'Neumático encontrado en la medición de remanentes', responsable: inspector });
    } else { // actualiza marca, modelo y medida si cambiaron
      const ch = ['marca', 'modelo', 'medida'].filter(k => dn[k] && dn[k] !== (n[k] || ''));
      if (ch.length) { ch.forEach(k => { n[k] = dn[k]; }); await EQ.DB.put('neumaticos', n, { motivo: `Datos actualizados en la medición de remanentes (${ch.join(', ')})` }); }
    }
    const res = await C.guardarMedicion({ n, fecha: dm.fecha, lectura: dm.lectura, profs, presionMed: dm.presionMed, presionRec: n.presionRec, condiciones: [], observaciones: dm.observaciones, inspector, posicion: p.pos, equipoId: eq.id });
    const obs = await marcarObservacion(n, dm.fecha, inspector);
    EQ.App.state.selPos = p.pos;
    U.toast(`P${p.num} (${n.codigo}): ${profs.filter(x => x !== null).map(x => U.num(x, 1)).join(' / ')} mm guardado${obs ? ' · pasó a "En observación"' : ''}${res.nota ? ' · ' + res.nota : ''}`, 'ok');
    EQ.App.refresh();
  }
  // Registro de mediciones de remanentes del equipo (o de toda la flota)
  function registroMediciones(el, eq) {
    const App = EQ.App, todos = !!App.state.regTodos, sup = EQ.Bridge.isSup(), yo = yoNombre();
    const rows = S.inspecciones.filter(i => (todos || i.equipoId === eq.id) && C.profsOf(i).length).sort((a, b) => (b.fecha + (b.creado || '')) > (a.fecha + (a.creado || '')) ? 1 : -1);
    const nf = id => S.neumaticos.find(x => x.id === id) || {};
    const posNum = i => { const e = C.eq(i.equipoId); const q = e && e.layoutNeum ? C.posiciones(e.layoutNeum).find(x => x.pos === i.posicion) : null; return q ? `P${q.num} · ${i.posicion}` : (i.posicion || ''); };
    el.innerHTML = `<h3>Registro de mediciones de remanentes <span class="muted small" style="font-weight:normal">${todos ? 'todos los equipos' : U.esc(eq.codigo)} · ${rows.length}</span><span class="right"><label class="flex small" style="font-weight:normal"><input type="checkbox" id="regTodos" ${todos ? 'checked' : ''}> Todos los equipos</label></span></h3><div id="regT"></div>`;
    el.querySelector('#regTodos').onchange = e => { App.state.regTodos = e.target.checked; App.refresh(); };
    U.table(el.querySelector('#regT'), { exportName: `remanentes_${todos ? 'flota' : eq.codigo}`, rows, empty: 'Aún no hay mediciones. Toca una posición del diagrama para registrar la primera.', cols: [
      { k: 'fecha', t: 'Fecha', fmt: v => U.fdate(v), text: r => r.fecha },
      { k: 'eqc', t: 'Equipo', sort: r => (C.eq(r.equipoId) || {}).codigo, fmt: (v, r) => U.esc((C.eq(r.equipoId) || {}).codigo || ''), text: r => (C.eq(r.equipoId) || {}).codigo },
      { k: 'posicion', t: 'Posición', fmt: (v, r) => U.esc(posNum(r)), text: r => posNum(r) },
      { k: 'neu', t: 'Neumático', sort: r => nf(r.neumaticoId).codigo, fmt: (v, r) => U.esc(nf(r.neumaticoId).codigo || '—'), text: r => nf(r.neumaticoId).codigo },
      { k: 'mm', t: 'Marca / modelo', sort: r => nf(r.neumaticoId).marca, fmt: (v, r) => U.esc([nf(r.neumaticoId).marca, nf(r.neumaticoId).modelo].filter(Boolean).join(' ')), text: r => [nf(r.neumaticoId).marca, nf(r.neumaticoId).modelo].filter(Boolean).join(' ') },
      { k: 'med', t: 'Medida', sort: r => nf(r.neumaticoId).medida, fmt: (v, r) => U.esc(nf(r.neumaticoId).medida || ''), text: r => nf(r.neumaticoId).medida },
      { k: 'rem', t: `Remanentes mm (${C.medNombres().join(' / ')})`, sort: r => C.profProm(r), fmt: (v, r) => U.esc(C.profsOf(r).map(x => U.num(x, 1)).join(' / ')), text: r => C.profsOf(r).join(' / ') },
      { k: 'pr', t: 'Prom. mm', num: true, sort: r => C.profProm(r), fmt: (v, r) => `<b>${U.num(C.profProm(r), 1)}</b>`, text: r => +C.profProm(r).toFixed(2) },
      { k: 'presionMed', t: 'PSI', num: true, fmt: v => v === null || v === undefined ? '' : U.num(v, 0) },
      { k: 'lectura', t: 'Horóm./Km', num: true, fmt: v => U.num(v, 1) },
      { k: 'inspector', t: 'Medido por' }, { k: 'observaciones', t: 'Obs.' },
      { k: 'acc', t: '', nosort: true, noexport: true, fmt: (v, r) => `<div class="flex" style="flex-wrap:nowrap">${sup || (yo && r.inspector === yo) ? `<button class="btn btn-ghost btn-sm" data-ei="${r.id}" title="Editar">✎</button>` : ''}${sup ? `<button class="btn btn-ghost btn-sm" data-di="${r.id}" title="Eliminar">🗑</button>` : ''}</div>` }] });
    el.querySelector('#regT').addEventListener('click', e => {
      const ei = e.target.closest('[data-ei]'); if (ei) { V.editarMedicion(S.inspecciones.find(i => i.id === ei.dataset.ei)); return; }
      const di = e.target.closest('[data-di]'); if (di) V.eliminarMedicion(S.inspecciones.find(i => i.id === di.dataset.di));
    });
  }

  V.editarMedicion = i => {
    if (!i) return;
    const cfg = C.cfg(), n = S.neumaticos.find(x => x.id === i.neumaticoId) || {};
    const meds = C.medNombres(); const pv = C.profsOf(i);
    const N = Math.max(meds.length, Array.isArray(i.profs) ? i.profs.length : 3);
    const vals = Array.isArray(i.profs) ? i.profs : [i.profInt, i.profCen, i.profExt];
    U.modal({ title: `Editar medición · ${n.codigo || ''} · ${U.fdate(i.fecha)}`, body: `<form class="form-grid" id="fEm">
      ${U.field('fecha', 'Fecha', { type: 'date', value: i.fecha, req: true, attrs: `max="${U.today()}"` })}
      ${U.field('lectura', 'Horómetro / Km', { type: 'number', value: i.lectura, attrs: 'min="0"' })}
      ${Array.from({ length: N }, (_, k) => U.field('p' + k, `${meds[k] || 'Medición ' + (k + 1)} (mm)`, { type: 'number', value: vals[k] === undefined ? '' : vals[k], attrs: 'min="0"' })).join('')}
      ${U.field('presionMed', 'Presión medida (PSI)', { type: 'number', value: i.presionMed, attrs: 'min="0"' })}
      ${U.field('presionRec', 'Presión recomendada (PSI)', { type: 'number', value: i.presionRec, attrs: 'min="0"' })}
      ${U.field('posicion', 'Posición', { value: i.posicion })}
      ${U.field('inspector', 'Inspector', { type: 'datalist', options: C.tecnicos('Neumáticos'), value: i.inspector })}
      <div class="fld full"><label>Condición física</label><div class="cond-box">${cfg.condiciones.map(c => `<label><input type="checkbox" name="c_${U.esc(c)}" ${(i.condiciones || []).includes(c) ? 'checked' : ''}>${U.esc(c)}</label>`).join('')}</div></div>
      ${U.field('observaciones', 'Observaciones', { type: 'textarea', value: i.observaciones, cls: 'full' })}
      ${U.field('motivo', 'Motivo de la modificación', { req: true, cls: 'full' })}</form>`,
      buttons: [{ label: 'Cancelar', cls: 'btn-outline' }, { label: 'Guardar cambios', cls: 'btn-orange', onClick: async m => {
        const f = m.querySelector('#fEm'); const d = U.formData(f);
        U.requireFields(f, d, ['fecha', 'motivo']);
        if (d.fecha > U.today()) throw new Error('Fecha futura.');
        const profs = Array.from({ length: N }, (_, k) => d['p' + k]);
        if (profs.some(x => x !== null && x < 0) || (d.presionMed !== null && d.presionMed < 0) || (d.lectura !== null && d.lectura < 0)) throw new Error('No se permiten valores negativos.');
        Object.assign(i, { fecha: d.fecha, lectura: d.lectura, profs, presionMed: d.presionMed, presionRec: d.presionRec, posicion: d.posicion, inspector: d.inspector, observaciones: d.observaciones, condiciones: cfg.condiciones.filter(c => d['c_' + c]) }, C.zonas(profs));
        if (n.id) i.usoNeumatico = C.usoNeumEnFecha(n, d.fecha, d.lectura, i.equipoId) ?? i.usoNeumatico;
        await EQ.DB.put('inspecciones', i, { motivo: d.motivo });
        U.toast('Medición actualizada', 'ok'); EQ.App.refresh();
      } }] });
  };
  V.eliminarMedicion = async i => {
    if (!i) return;
    const mot = await U.prompt('Motivo de la eliminación (queda en la auditoría):', '', 'Eliminar medición');
    if (!mot) return;
    await EQ.DB.del('inspecciones', i.id, { motivo: mot });
    U.toast('Medición eliminada', 'ok'); EQ.App.refresh();
  };

  // ---------------- E/F. Análisis de desgaste ----------------
  function renderAnalisis(root) {
    const rows = S.neumaticos.filter(n => n.posicion).map(n => Object.assign({}, n, { _a: C.analisisNeum(n), _eq: C.eq(n.equipoId) })).filter(r => r._eq && C.neumAplica(r._eq));
    const porEq = {}, porPos = {};
    rows.forEach(r => { if (!r._a.ultima) return; (porEq[r._eq.codigo] = porEq[r._eq.codigo] || []).push(r._a.desgPct); const pk = r.posicion.replace(/^E\d+-/, m => m); (porPos[pk] = porPos[pk] || []).push(r._a.desgPct); });
    const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
    const eqK = Object.keys(porEq).sort((a, b) => avg(porEq[b]) - avg(porEq[a])).slice(0, 15);
    const posK = Object.keys(porPos).sort();
    root.innerHTML = `<div class="kpis mb">
        <div class="kpi"><div class="lbl">Neumáticos instalados</div><div class="val">${rows.length}</div></div>
        <div class="kpi bad"><div class="lbl">Críticos</div><div class="val">${rows.filter(r => r._a.critico).length}</div></div>
        <div class="kpi warn"><div class="lbl">Desgaste anormal</div><div class="val">${rows.filter(r => r._a.irregular).length}</div></div>
        <div class="kpi orange"><div class="lbl">Próximos a reemplazo (${C.th().diasProxReemplazo} d)</div><div class="val">${rows.filter(r => r._a.proxReemplazo).length}</div></div>
        <div class="kpi gray"><div class="lbl">Sin datos para proyectar</div><div class="val">${rows.filter(r => !r._a.suficiente).length}</div></div></div>
      <div class="grid g2"><div class="card"><h3>Desgaste promedio por equipo (%)</h3><div class="chart-box"><canvas id="chDE"></canvas></div></div>
        <div class="card"><h3>Desgaste promedio por posición (%)</h3><div class="chart-box"><canvas id="chDP"></canvas></div></div></div>
      <div class="card mt"><h3>Desgaste, irregularidades y vida útil</h3><div id="tAn"></div></div>`;
    U.chart('chDE', { type: 'bar', data: { labels: eqK, datasets: [{ label: '% desgaste', data: eqK.map(k => +avg(porEq[k]).toFixed(1)), backgroundColor: U.PALETTE[0] }] }, options: { scales: { y: { max: 100 } } } });
    U.chart('chDP', { type: 'bar', data: { labels: posK, datasets: [{ label: '% desgaste', data: posK.map(k => +avg(porPos[k]).toFixed(1)), backgroundColor: U.PALETTE[1] }] }, options: { scales: { y: { max: 100 } } } });
    U.table(root.querySelector('#tAn'), { exportName: 'desgaste_neumaticos', rows, cols: [
      { k: 'e', t: 'Equipo', sort: r => r._eq.codigo, fmt: (v, r) => `<b>${U.esc(r._eq.codigo)}</b>`, text: r => r._eq.codigo },
      { k: 'posicion', t: 'Posición', fmt: (v, r) => U.esc(C.posLabel(r._eq, v)), text: r => r.posicion },
      { k: 'codigo', t: 'Neumático', fmt: (v, r) => `<a href="#" data-f="${r.id}">${U.esc(v)}</a>`, text: r => r.codigo },
      { k: 'ed', t: 'Estado', sort: r => ({ rojo: 0, amarillo: 1, gris: 2, verde: 3 })[r._a.estadoDesg], fmt: (v, r) => U.pill(r._a.estadoDesg, C.DESG_LBL[r._a.estadoDesg]), text: r => C.DESG_LBL[r._a.estadoDesg] },
      { k: 'pi', t: 'Inicial mm', num: true, sort: r => r._a.profInicial, fmt: (v, r) => U.num(r._a.profInicial, 1), text: r => r._a.profInicial },
      { k: 'pa', t: 'Actual mm', num: true, sort: r => r._a.profActual, fmt: (v, r) => r._a.ultima ? U.num(r._a.profActual, 1) : '—', text: r => r._a.profActual },
      { k: 'dm', t: 'Desg. mm', num: true, sort: r => r._a.desgMm, fmt: (v, r) => r._a.ultima ? U.num(r._a.desgMm, 1) : '—', text: r => r._a.desgMm },
      { k: 'dp', t: 'Desg. %', num: true, sort: r => r._a.desgPct, fmt: (v, r) => r._a.ultima ? `<b>${U.num(r._a.desgPct, 1)}</b>` : '—', text: r => r._a.desgPct },
      { k: 'pat', t: 'Desgaste anormal / condición', sort: r => r._a.patrones.length, fmt: (v, r) => r._a.patrones.length ? `<span style="color:var(--bad)">${U.esc(r._a.patrones.join(', '))}</span>` : '<span class="muted">—</span>', text: r => r._a.patrones.join(', ') },
      { k: 'tasa', t: 'Tasa de desgaste', num: true, sort: r => r._a.tasa || r._a.tasaDia, fmt: (v, r) => !r._a.suficiente ? '—' : r._a.porDias ? `${U.num(r._a.tasaDia * 30, 2)} mm/30 d` : `${U.num(r._a.tasa * 1000, 2)} mm/1000 ${r._a.unidad}`, text: r => !r._a.suficiente ? '' : r._a.porDias ? `${(r._a.tasaDia * 30).toFixed(2)} mm/30 d` : `${(r._a.tasa * 1000).toFixed(2)} mm/1000 ${r._a.unidad}` },
      { k: 'vr', t: 'Vida restante', num: true, sort: r => r._a.vidaRestHoy, fmt: (v, r) => r._a.suficiente ? `${U.num(r._a.vidaRestHoy, 0)} ${r._a.unidadVida}` : `<span class="small muted" title="${U.esc(r._a.motivoInsuf)}">Insuficiente</span>`, text: r => r._a.suficiente ? Math.round(r._a.vidaRestHoy) : 'Información insuficiente' },
      { k: 'fr', t: 'Reemplazo estimado', sort: r => r._a.fechaReemplazo, fmt: (v, r) => r._a.fechaReemplazo ? `${U.fdate(r._a.fechaReemplazo)}${r._a.proxReemplazo ? ' ⚠' : ''}` : '—', text: r => r._a.fechaReemplazo || '' },
      { k: 'ui', t: 'Últ. inspección', sort: r => r._a.ultima ? r._a.ultima.fecha : '', fmt: (v, r) => r._a.ultima ? `${U.fdate(r._a.ultima.fecha)}${r._a.inspVencida ? ' <span style="color:var(--bad)">●</span>' : ''}` : '<span style="color:var(--bad)">Nunca</span>', text: r => r._a.ultima ? r._a.ultima.fecha : '' }] });
    root.querySelector('#tAn').addEventListener('click', e => { const f = e.target.closest('[data-f]'); if (f) { e.preventDefault(); V.fichaNeum(S.neumaticos.find(x => x.id === f.dataset.f)); } });
  }

  // ---------------- G. Presiones ----------------
  function renderPresiones(root) {
    const st = EQ.App.state.presF || (EQ.App.state.presF = { soloFuera: false });
    let rows = S.neumaticos.filter(n => n.posicion).map(n => Object.assign({}, n, { _a: C.analisisNeum(n), _eq: C.eq(n.equipoId) })).filter(r => r._eq && C.neumAplica(r._eq));
    const cnt = k => rows.filter(r => r._a.presion.estado === k).length;
    if (st.soloFuera) rows = rows.filter(r => r._a.presion.cls === 'rojo' || r._a.presion.cls === 'amarillo');
    root.innerHTML = `<div class="kpis mb">
      <div class="kpi ok"><div class="lbl">Presión normal</div><div class="val">${cnt('Presión normal')}</div></div>
      <div class="kpi bad"><div class="lbl">Presión baja</div><div class="val">${cnt('Presión baja')}</div></div>
      <div class="kpi warn"><div class="lbl">Presión alta</div><div class="val">${cnt('Presión alta')}</div></div>
      <div class="kpi gray"><div class="lbl">Sin inspección</div><div class="val">${cnt('Sin inspección')}</div></div></div>
      <div class="selector-bar"><label class="flex"><input type="checkbox" id="pF" ${st.soloFuera ? 'checked' : ''}> Mostrar solo fuera de rango</label><span class="muted small">Tolerancia: neumático → equipo → tipo de neumático → general (±${C.th().presionTolPct}%)</span></div>
      <div class="card"><div id="tPr"></div></div>`;
    root.querySelector('#pF').onchange = e => { st.soloFuera = e.target.checked; EQ.App.refresh(); };
    U.table(root.querySelector('#tPr'), { exportName: 'control_presiones', rows, cols: [
      { k: 'e', t: 'Equipo', sort: r => r._eq.codigo, fmt: (v, r) => `<b>${U.esc(r._eq.codigo)}</b>`, text: r => r._eq.codigo },
      { k: 'posicion', t: 'Posición' }, { k: 'codigo', t: 'Neumático' },
      { k: 'f', t: 'Fecha medición', sort: r => r._a.ultima ? r._a.ultima.fecha : '', fmt: (v, r) => r._a.ultima ? U.fdate(r._a.ultima.fecha) : '—', text: r => r._a.ultima ? r._a.ultima.fecha : '' },
      { k: 'presionRec', t: 'Recomendada PSI', num: true },
      { k: 'pm', t: 'Medida PSI', num: true, sort: r => { const i = [...r._a.inspecciones].reverse().find(x => x.presionMed !== null); return i ? i.presionMed : null; }, fmt: (v, r) => { const i = [...r._a.inspecciones].reverse().find(x => x.presionMed !== null && x.presionMed !== undefined); return i ? U.num(i.presionMed, 1) : '—'; }, text: r => { const i = [...r._a.inspecciones].reverse().find(x => x.presionMed !== null && x.presionMed !== undefined); return i ? i.presionMed : ''; } },
      { k: 'df', t: 'Diferencia PSI', num: true, sort: r => r._a.presion.diff, fmt: (v, r) => r._a.presion.diff === null ? '—' : `${r._a.presion.diff > 0 ? '+' : ''}${U.num(r._a.presion.diff, 1)}`, text: r => r._a.presion.diff },
      { k: 'pc', t: 'Desv. %', num: true, sort: r => r._a.presion.pct, fmt: (v, r) => r._a.presion.pct === null ? '—' : U.num(r._a.presion.pct, 1), text: r => r._a.presion.pct === null ? '' : +r._a.presion.pct.toFixed(1) },
      { k: 'tol', t: 'Tolerancia ±%', num: true, sort: r => r._a.tol, fmt: (v, r) => r._a.tol, text: r => r._a.tol },
      { k: 'es', t: 'Estado', sort: r => r._a.presion.estado, fmt: (v, r) => U.pill(r._a.presion.cls, r._a.presion.estado) + (r._a.inspVencida ? ' <span class="small" style="color:var(--bad)">inspección vencida</span>' : ''), text: r => r._a.presion.estado }] });
  }

  // ---------------- H. Costos ----------------
  function renderCostos(root) {
    const rows = S.neumaticos.map(n => Object.assign({}, n, { _a: C.analisisNeum(n) }));
    const tot = rows.reduce((s, r) => s + r._a.costoTotal, 0);
    const porEq = {};
    rows.forEach(r => { const id = r.equipoId || '__alm'; (porEq[id] = porEq[id] || { costo: 0, n: 0, uso: 0 }); porEq[id].costo += r._a.costoTotal; porEq[id].n++; porEq[id].uso += r._a.uso; });
    const meses = U.lastMonths(12);
    const porMes = {};
    S.neumaticos.forEach(n => { if (n.fechaAdq && n.costo) porMes[U.monthKey(n.fechaAdq)] = (porMes[U.monthKey(n.fechaAdq)] || 0) + C.conv(n.costo, n.monedaCosto, C.monNeum()); });
    S.movimientos.forEach(m => { if (m.costo) porMes[U.monthKey(m.fecha)] = (porMes[U.monthKey(m.fecha)] || 0) + C.conv(m.costo, m.monedaCosto, C.monNeum()); });
    const conUso = rows.filter(r => r._a.costoUso);
    root.innerHTML = `<div class="selector-bar"><b>Mostrar costos en:</b><select id="cMonN">${U.opts(C.monedas(), C.monNeum())}</select><span class="muted small">Tipo de cambio: 1 ${U.esc(C.monUSD())} = ${U.esc(C.monBase())} ${U.num(C.tc(), 3)} (editable en Configuración → General). Cada neumático y reparación conserva su moneda original.</span></div><div class="kpis mb">
      <div class="kpi orange"><div class="lbl">Costo acumulado neumáticos</div><div class="val">${U.moneyN(tot)}</div></div>
      <div class="kpi"><div class="lbl">Adquisición</div><div class="val">${U.moneyN(rows.reduce((s, r) => s + r._a.costoAdq, 0))}</div></div>
      <div class="kpi"><div class="lbl">Reparaciones y reencauches</div><div class="val">${U.moneyN(rows.reduce((s, r) => s + r._a.costoMant, 0))}</div></div>
      <div class="kpi gray"><div class="lbl">Costo medio por h/km</div><div class="val">${conUso.length ? U.moneyN(conUso.reduce((s, r) => s + r._a.costoUso, 0) / conUso.length) : '—'}</div></div></div>
      <div class="grid g2"><div class="card"><h3>Costos mensuales de neumáticos</h3><div class="chart-box"><canvas id="chCM2"></canvas></div></div><div class="card"><h3>Costo por equipo</h3><div id="tCEq"></div></div></div>
      <div class="card mt"><h3>Costo por neumático</h3><div id="tCN"></div></div>`;
    root.querySelector('#cMonN').onchange = async e => { const cf = C.cfg(); cf.monedaNeum = e.target.value; await EQ.DB.put('config', cf, { motivo: 'Moneda de costos de neumáticos' }); EQ.App.refresh(); };
    U.chart('chCM2', { type: 'bar', data: { labels: meses.map(U.monthName), datasets: [{ label: C.monNeum(), data: meses.map(m => +(porMes[m] || 0).toFixed(2)), backgroundColor: U.PALETTE[1] }] } });
    U.table(root.querySelector('#tCEq'), { exportName: 'costos_neumaticos_equipo', rows: Object.entries(porEq).map(([id, v]) => Object.assign({ eq: id === '__alm' ? null : C.eq(id) }, v)), cols: [
      { k: 'eq', t: 'Equipo', sort: r => r.eq ? r.eq.codigo : 'zzz', fmt: v => v ? `<b>${U.esc(v.codigo)}</b>` : 'Almacén / retirados', text: r => r.eq ? r.eq.codigo : 'Almacén' },
      { k: 'n', t: 'Neumáticos', num: true }, { k: 'costo', t: 'Costo total', num: true, fmt: v => U.moneyN(v), text: r => +r.costo.toFixed(2) }, { k: 'uso', t: 'Uso acum.', num: true, fmt: v => U.num(v, 0) },
      { k: 'cu', t: 'Costo/uso', num: true, sort: r => r.uso ? r.costo / r.uso : null, fmt: (v, r) => r.uso ? U.moneyN(r.costo / r.uso) : '—', text: r => r.uso ? +(r.costo / r.uso).toFixed(3) : '' }] });
    U.table(root.querySelector('#tCN'), { exportName: 'costos_por_neumatico', rows, cols: [
      { k: 'codigo', t: 'Neumático' }, { k: 'marca', t: 'Marca' }, { k: 'medida', t: 'Medida' }, { k: 'estado', t: 'Estado' },
      { k: 'costo', t: 'Adquisición (orig.)', num: true, sort: r => r._a.costoAdq, fmt: (v, r) => v ? U.moneyC(v, C.esUSD(r.monedaCosto) ? C.monUSD() : C.monBase()) : '—', text: r => r.costo ? `${C.esUSD(r.monedaCosto) ? C.monUSD() : C.monBase()} ${r.costo}` : '' },
      { k: 'ca', t: `Adquisición (${C.monNeum()})`, num: true, sort: r => r._a.costoAdq, fmt: (v, r) => U.moneyN(r._a.costoAdq), text: r => +r._a.costoAdq.toFixed(2) },
      { k: 'cm', t: 'Mant./Reenc.', num: true, sort: r => r._a.costoMant, fmt: (v, r) => U.moneyN(r._a.costoMant), text: r => r._a.costoMant },
      { k: 'ct', t: 'Total', num: true, sort: r => r._a.costoTotal, fmt: (v, r) => `<b>${U.moneyN(r._a.costoTotal)}</b>`, text: r => r._a.costoTotal },
      { k: 'uso', t: 'Uso acumulado', num: true, sort: r => r._a.uso, fmt: (v, r) => `${U.num(r._a.uso, 0)} ${r._a.unidad}`, text: r => r._a.uso },
      { k: 'cu', t: 'Costo por h/km', num: true, sort: r => r._a.costoUso, fmt: (v, r) => r._a.costoUso ? U.moneyN(r._a.costoUso) : '—', text: r => r._a.costoUso ? +r._a.costoUso.toFixed(3) : '' },
      { k: 'vt', t: 'Vida útil estimada', num: true, sort: r => r._a.vidaTotal, fmt: (v, r) => r._a.suficiente ? `${U.num(r._a.vidaTotal, 0)} ${r._a.unidadVida}` : '—', text: r => r._a.vidaTotal ? Math.round(r._a.vidaTotal) : '' },
      { k: 'cp', t: 'Costo proyectado/uso', num: true, sort: r => r._a.suficiente ? r._a.costoTotal / r._a.vidaTotal : null, fmt: (v, r) => r._a.suficiente && !r._a.porDias && r._a.vidaTotal ? U.moneyN(r._a.costoTotal / ((Number(r.usoInicioCiclo) || 0) + r._a.vidaTotal)) : '—', text: r => '' }] });
  }

  EQ.Views.neumaticos = V;
})();
