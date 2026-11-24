/* DASHBOARD GENERAL – consolida ambos módulos */
(function () {
  const U = EQ.U, S = EQ.S, C = EQ.C;
  EQ.Views = EQ.Views || {};
  const V = {};

  V.render = root => {
    if (!S.equipos.length) {
      root.innerHTML = `<div class="card">${U.emptyState('📊', 'Bienvenido al control de engrase y neumáticos', 'Para comenzar, importe el maestro de equipos de su aplicación Backlog. No es necesario registrar los equipos nuevamente.', '<a class="btn btn-orange" href="#/equipos">Importar equipos del Backlog</a>')}</div>`;
      return;
    }
    const k = C.kpis();
    const al = C.alertas().filter(a => !a.atendida);
    const prio = C.prioridadEquipos(al).slice(0, 8);
    const mk = U.monthKey(U.today());
    const meses = U.lastMonths(6);
    const cons = C.consumo({ desde: U.addDays(U.today(), -30), hasta: U.today() });
    const est30 = C.estatusEngrase({ desde: U.addDays(U.today(), -30), hasta: U.today() }).tot;
    const neum = S.neumaticos.filter(n => n.posicion).map(n => Object.assign({ n }, C.analisisNeum(n))).filter(x => x.eq);
    const lim = C.th().diasSinEngrase;
    const progHoy = C.programaMes(mk);
    const pendEq = C.equiposPrograma().filter(e => { const d = C.diasSinEngrase(e); const f = progHoy.find(x => x.eq.id === e.id); return (d !== null && d > lim) || (f && f.dias[U.today()] && !C.diarioEn(e.id, U.today())); });
    const noEjMes = progHoy.reduce((s, f) => s + Object.keys(f.dias).filter(d => d < U.today() && !C.diarioEn(f.eq.id, d)).length, 0);
    const crit = neum.filter(x => x.ultima).sort((a, b) => (b.critico - a.critico) || (b.desgPct - a.desgPct)).slice(0, 10);
    const irr = neum.filter(x => x.irregular);
    const proxR = neum.filter(x => x.fechaReemplazo).sort((a, b) => a.fechaReemplazo < b.fechaReemplazo ? -1 : 1);
    const prog7 = C.programacion(U.today(), U.addDays(U.today(), 7)).eventos;
    const mantNeumMes = S.movimientos.filter(m => U.monthKey(m.fecha) === mk).reduce((s, m) => s + C.conv(m.costo, m.monedaCosto, C.monNeum()), 0) + S.neumaticos.filter(n => U.monthKey(n.fechaAdq) === mk).reduce((s, n) => s + C.conv(n.costo, n.monedaCosto, C.monNeum()), 0);

    root.innerHTML = `
      <div class="section-title" style="margin-top:0">Respuestas rápidas para el Planner</div>
      <div class="answers">
        <div class="a"><div class="q">1. Equipos con engrases pendientes</div><div class="r">${pendEq.length ? U.esc(pendEq.slice(0, 6).map(e => e.codigo).join(', ')) + (pendEq.length > 6 ? ` (+${pendEq.length - 6})` : '') : 'Ninguno'}</div></div>
        <div class="a"><div class="q">2. Engrases vencidos (programados no ejecutados este mes)</div><div class="r">${noEjMes} engrase(s) · ${k.excedidos} equipo(s) con más de ${lim} días sin engrase</div></div>
        <div class="a"><div class="q">3. Consumo de lubricante (últimos 30 días)</div><div class="r">${U.num(est30.kg, 2)} kg · ${U.num(est30.puntos)} puntos · ${U.money(est30.costo)} · ${U.usd(est30.costoUSD)}</div></div>
        <div class="a"><div class="q">4. Neumáticos con desgaste anormal</div><div class="r">${irr.length ? U.esc(irr.slice(0, 4).map(x => `${x.eq.codigo}/${x.n.posicion}`).join(', ')) + (irr.length > 4 ? ` (+${irr.length - 4})` : '') : 'Ninguno detectado'}</div></div>
        <div class="a"><div class="q">5. Próximo reemplazo de neumático</div><div class="r">${proxR.length ? `${U.esc(proxR[0].n.codigo)} (${U.esc(proxR[0].eq.codigo)}) · ${U.fdate(proxR[0].fechaReemplazo)}` : 'Sin proyección (faltan mediciones)'}</div></div>
        <div class="a"><div class="q">6. Costo de neumáticos (acumulado / mes)</div><div class="r">${U.moneyN(k.costoNeum)} / ${U.moneyN(mantNeumMes)}</div></div>
        <div class="a"><div class="q">7. Actividades a programar (7 días)</div><div class="r">${prog7.filter(e => e.tipo === 'engrase' && !e.ejecutado).length} engrases (EG ${prog7.filter(e => e.tipoEng === 'EG' && !e.ejecutado).length} / EP ${prog7.filter(e => e.tipoEng === 'EP' && !e.ejecutado).length}) · ${prog7.filter(e => e.tipo === 'inspeccion').length} inspecciones</div></div>
        <div class="a"><div class="q">8. Equipos con atención prioritaria</div><div class="r">${prio.length ? U.esc(prio.slice(0, 5).map(p => p.eq.codigo).join(', ')) : 'Ninguno'}</div></div>
      </div>

      <div class="section-title">Indicadores de engrase</div>
      <div class="kpis">
        <div class="kpi clickable" data-go="engrase:programa"><div class="lbl">Engrases programados (mes)</div><div class="val">${C.cumplimientoMesPrograma(mk, false).prog}</div><div class="sub">${k.puntos} puntos configurados</div></div>
        <div class="kpi ok clickable" data-go="engrase:control"><div class="lbl">Engrases ejecutados (mes)</div><div class="val">${k.ejecMes !== undefined ? k.egMes + k.epMes : 0}</div><div class="sub">EG ${k.egMes} · EP ${k.epMes}</div></div>
        <div class="kpi warn clickable" data-go="engrase:control"><div class="lbl">Pendientes hoy</div><div class="val">${k.pendHoy}</div><div class="sub">de ${k.progHoy} programados hoy</div></div>
        <div class="kpi bad clickable" data-go="engrase:prioridad"><div class="lbl">Equipos > ${lim} días sin engrase</div><div class="val">${k.excedidos}</div><div class="sub">de ${k.equiposPrograma} en programa</div></div>
        <div class="kpi bad clickable" data-go="engrase:cumplimiento"><div class="lbl">Programados no ejecutados (mes)</div><div class="val">${noEjMes}</div></div>
        <div class="kpi ${k.cumplimientoProg === null ? 'gray' : k.cumplimientoProg >= 90 ? 'ok' : k.cumplimientoProg >= 75 ? 'warn' : 'bad'} clickable" data-go="engrase:cumplimiento"><div class="lbl">Cumplimiento del programa</div><div class="val">${k.cumplimientoProg === null ? '—' : U.num(k.cumplimientoProg, 1) + '%'}</div><div class="sub">ejecutados / programados a la fecha</div></div>
        <div class="kpi orange clickable" data-go="engrase:consumo"><div class="lbl">Consumo de grasa (mes)</div><div class="val">${U.num(k.consumoMesKg, 2)} kg</div></div>
        <div class="kpi bad"><div class="lbl">Equipos críticos</div><div class="val">${k.equiposCriticos}</div><div class="sub">engrase vencido o neumático crítico</div></div>
      </div>

      <div class="section-title">Indicadores de neumáticos</div>
      <div class="kpis">
        <div class="kpi clickable" data-go="neumaticos:inventario"><div class="lbl">Neumáticos instalados</div><div class="val">${k.neumInstalados}</div><div class="sub">${k.neumTotal} registrados</div></div>
        <div class="kpi ok"><div class="lbl">Operativos</div><div class="val">${k.neumOperativos}</div></div>
        <div class="kpi warn"><div class="lbl">En observación</div><div class="val">${k.neumObservacion}</div></div>
        <div class="kpi bad clickable" data-go="neumaticos:analisis"><div class="lbl">Críticos</div><div class="val">${k.neumCriticos}</div></div>
        <div class="kpi warn clickable" data-go="neumaticos:presiones"><div class="lbl">Presiones fuera de rango</div><div class="val">${k.presionFuera}</div></div>
        <div class="kpi"><div class="lbl">Desgaste promedio</div><div class="val">${k.desgProm === null ? '—' : U.num(k.desgProm, 1) + '%'}</div></div>
        <div class="kpi orange clickable" data-go="neumaticos:costos"><div class="lbl">Costos acumulados</div><div class="val" style="font-size:19px">${U.moneyN(k.costoNeum)}</div></div>
        <div class="kpi bad"><div class="lbl">Próximos a reemplazo</div><div class="val">${k.proxReemplazo}</div><div class="sub">críticos o ≤ ${C.th().diasProxReemplazo} días</div></div>
      </div>

      <div class="grid g2 mt">
        <div class="card"><h3>Equipos que requieren atención prioritaria</h3>${prio.length ? `<div class="prio-list">${prio.map(p => `<div class="item"><div class="score">${Math.round(p.score)}</div><div><b>${U.esc(p.eq.codigo)}</b> <span class="muted small">${U.esc(p.eq.descripcion || '')}</span><div class="small">${p.n.critica ? U.pill('critica', p.n.critica + ' crítica(s)') : ''} ${p.n.alta ? U.pill('alta', p.n.alta + ' alta(s)') : ''} ${p.n.media ? U.pill('media', p.n.media + ' media(s)') : ''} <span class="muted">${U.esc([...p.motivos].join(' · '))}</span></div></div></div>`).join('')}</div>` : '<div class="muted">Sin equipos con alertas relevantes.</div>'}</div>
        <div class="card"><h3>Ranking de neumáticos críticos <span class="right small muted" style="font-weight:normal">por % de desgaste</span></h3>
          ${crit.length ? `<div class="tbl-wrap" style="max-height:300px"><table class="tbl"><thead><tr><th class="nosort">#</th><th class="nosort">Equipo</th><th class="nosort">Pos.</th><th class="nosort">Neumático</th><th class="nosort num">Cocada</th><th class="nosort num">Desg. %</th><th class="nosort">Estado</th></tr></thead><tbody>${crit.map((x, i) => `<tr><td>${i + 1}</td><td>${U.esc(x.eq.codigo)}</td><td>${U.esc(x.n.posicion)}</td><td><a href="#" data-n="${x.n.id}">${U.esc(x.n.codigo)}</a></td><td class="num">${U.num(x.profActual, 1)}</td><td class="num"><b>${U.num(x.desgPct, 1)}</b></td><td>${U.pill(x.estadoDesg, C.DESG_LBL[x.estadoDesg])}</td></tr>`).join('')}</tbody></table></div>` : '<div class="muted">Aún no hay inspecciones de neumáticos.</div>'}</div>
      </div>

      <div class="grid g2 mt">
        <div class="card"><h3>Cumplimiento mensual del programa de engrase (%)</h3><div class="chart-box"><canvas id="dCum"></canvas></div><div class="small muted">Promedio por equipo de ejecutados ÷ programados (hoja CUMPLIMIENTO). Meses sin programa guardado no se muestran.</div></div>
        <div class="card"><h3>Consumo de grasa por equipo (kg, mes actual)</h3><div class="chart-box"><canvas id="dConsEq"></canvas></div></div>
        <div class="card"><h3>Consumo por tipo de grasa (kg, últimos 6 meses)</h3><div class="chart-box"><canvas id="dConsG"></canvas></div></div>
        <div class="card"><h3>Desgaste promedio por equipo (%)</h3><div class="chart-box"><canvas id="dDesEq"></canvas></div></div>
        <div class="card"><h3>Desgaste promedio por posición (%)</h3><div class="chart-box"><canvas id="dDesPos"></canvas></div></div>
        <div class="card"><h3>Proyección de reemplazos (neumáticos por mes)</h3><div class="chart-box"><canvas id="dProy"></canvas></div><div class="small muted">Solo neumáticos con mediciones suficientes. ${neum.filter(x => !x.suficiente).length} sin proyección.</div></div>
      </div>
      <div class="card mt"><h3>Costos mensuales (${C.cfg().moneda})</h3><div class="chart-box"><canvas id="dCost"></canvas></div></div>`;

    root.querySelectorAll('[data-go]').forEach(el => el.onclick = () => { const [r, t] = el.dataset.go.split(':'); if (t) EQ.App.state.tab[r] = t; EQ.App.go(r); });
    root.querySelectorAll('[data-n]').forEach(a => a.onclick = e => { e.preventDefault(); EQ.Views.neumaticos.fichaNeum(S.neumaticos.find(n => n.id === a.dataset.n)); });

    U.chart('dCum', { type: 'line', data: { labels: meses.map(U.monthName), datasets: [{ label: 'Cumplimiento %', data: meses.map(m => { if (m !== mk && !S.programas.some(x => x.mes === m)) return null; const v = C.cumplimientoMesPrograma(m, true).pct; return v === null ? null : +v.toFixed(1); }), spanGaps: true }] }, options: { scales: { y: { max: 100 } } } });
    const cMes = C.consumo({ desde: mk + '-01', hasta: mk + '-31' });
    const ce = Object.entries(cMes.porEquipo).map(([id, v]) => [(C.eq(id) || {}).codigo || '—', v.g / 1000]).sort((a, b) => b[1] - a[1]).slice(0, 12);
    U.chart('dConsEq', { type: 'bar', data: { labels: ce.map(x => x[0]), datasets: [{ label: 'kg', data: ce.map(x => +x[1].toFixed(3)), backgroundColor: U.PALETTE[0] }] } });
    const c6 = C.consumo({ desde: meses[0] + '-01', hasta: U.today() });
    const cg = Object.entries(c6.porGrasa).sort((a, b) => b[1].g - a[1].g);
    U.chart('dConsG', { type: 'bar', data: { labels: cg.map(x => x[0]), datasets: [{ label: 'kg', data: cg.map(x => +(x[1].g / 1000).toFixed(3)), backgroundColor: U.PALETTE[2] }] }, options: { indexAxis: 'y', scales: { x: { beginAtZero: true }, y: { grid: { display: false } } } } });
    const pe = {}, pp = {};
    neum.filter(x => x.ultima).forEach(x => { (pe[x.eq.codigo] = pe[x.eq.codigo] || []).push(x.desgPct); (pp[x.n.posicion] = pp[x.n.posicion] || []).push(x.desgPct); });
    const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
    const peK = Object.keys(pe).sort((a, b) => avg(pe[b]) - avg(pe[a])).slice(0, 12), ppK = Object.keys(pp).sort();
    U.chart('dDesEq', { type: 'bar', data: { labels: peK, datasets: [{ label: '% desgaste', data: peK.map(x => +avg(pe[x]).toFixed(1)), backgroundColor: U.PALETTE[0] }] }, options: { scales: { y: { max: 100 } } } });
    U.chart('dDesPos', { type: 'bar', data: { labels: ppK, datasets: [{ label: '% desgaste', data: ppK.map(x => +avg(pp[x]).toFixed(1)), backgroundColor: U.PALETTE[1] }] }, options: { scales: { y: { max: 100 } } } });
    const nm = U.nextMonths(6);
    U.chart('dProy', { type: 'bar', data: { labels: nm.map(U.monthName), datasets: [{ label: 'Reemplazos', data: nm.map((m, i) => proxR.filter(x => i === 0 ? U.monthKey(x.fechaReemplazo) <= m : U.monthKey(x.fechaReemplazo) === m).length), backgroundColor: U.PALETTE[3] }] }, options: { scales: { y: { ticks: { precision: 0 } } } } });
    const m12 = U.lastMonths(12);
    const cAll = C.consumo({});
    const tc = {};
    S.neumaticos.forEach(n => { if (n.fechaAdq && n.costo) tc[U.monthKey(n.fechaAdq)] = (tc[U.monthKey(n.fechaAdq)] || 0) + Number(n.costo); });
    S.movimientos.forEach(m => { if (m.costo) tc[U.monthKey(m.fecha)] = (tc[U.monthKey(m.fecha)] || 0) + Number(m.costo); });
    U.chart('dCost', { type: 'bar', data: { labels: m12.map(U.monthName), datasets: [{ label: 'Grasa', data: m12.map(m => +(((cAll.porMes[m] || {}).costo) || 0).toFixed(2)), backgroundColor: U.PALETTE[0] }, { label: 'Neumáticos (compras, reparaciones, reencauches)', data: m12.map(m => +(tc[m] || 0).toFixed(2)), backgroundColor: U.PALETTE[1] }] } });
  };

  EQ.Views.dashboard = V;
})();
