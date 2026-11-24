/* =====================================================================
   PLANIFICACIÓN (planner / supervisor)
   - Calendario semanal: preventivos, backlogs programados, engrases EG/EP e inspecciones de neumáticos.
     Se reprograma arrastrando (laptop) o tocando la tarjeta (celular).
   - Carga de trabajo por técnico: horas asignadas por día frente a las disponibles.
   - Preventivos por horómetro: fecha proyectada con el uso diario real de cada equipo.
   - Ventanas de mantenimiento: backlogs pendientes del equipo que se pueden hacer en la misma parada.
   ===================================================================== */
const PL_DIAS=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const PL_PM_H=4; // horas estimadas de un preventivo cuando no se indicó la duración
const PL_AVISO_H=50; // aviso cuando faltan estas horas (o km/10) para el preventivo
let plW='',plSel='',plF={eng:true,ins:true};
const plCap=()=>{try{return Number(localStorage.getItem('plCap'))||8}catch(_){return 8}};
const plMon=d=>{const x=day(d||today()),w=(x.getDay()+6)%7;x.setDate(x.getDate()-w);return fmtISO(x)};
const plDays=()=>{plW=plW||plMon();return Array.from({length:7},(_,i)=>addDays(plW,i))};
function plGo(n){plW=n===0?plMon():addDays(plW||plMon(),n*7);renderPlan()}
const plEqCode=fid=>String(eqOf(fid).code||'').toUpperCase();
const plBkH=b=>{const t=((b.ot&&b.ot.tareas)||[]).reduce((s,x)=>s+(Number(x.h)||0),0);return t||Number(b.durH)||Number(b.hh)||0};
const plTech=n=>{if(!n)return '';const k=nk(n),T=techList().find(u=>nk(u.name)===k);return T?T.name:String(n).trim()};

/* ---------- Preventivos por horómetro ---------- */
function plUso(e){const S=window.EQN_SUM,u=S&&S.uso&&S.uso[String(e.code||'').toUpperCase()];return u&&u.u>0?u:null}
function pmHrs(p){
  if(p.status!=='PROGRAMADO'||p.scheduledHours===''||p.scheduledHours==null)return null;
  const e=eqOf(p.fleetId),cur=Number(e.hours);if(!(cur>=0)||e.hours===''||e.hours==null)return null;
  const km=/km/i.test(p.plan||'')||(plUso(e)||{}).un==='km',rem=Math.round((Number(p.scheduledHours)-cur)*10)/10,uso=plUso(e);
  const proj=uso?(rem<=0?today():addDays(today(),Math.floor(rem/uso.u))):null,lim=km?PL_AVISO_H*10:PL_AVISO_H;
  return{rem,un:km?'km':'h',uso,proj,k:rem<=0?'VENCIDO':rem<=lim?'PROXIMO':'OK',adelantar:!!(proj&&p.scheduledDate&&proj<p.scheduledDate)};
}
function pmHrsLine(p){const r=pmHrs(p);if(!r)return '';
  const c=r.k==='VENCIDO'?'text-red-400':r.k==='PROXIMO'?'text-amber-400':'text-slate-400';
  return `<p class="text-xs mt-1 font-semibold ${c}">⏱️ ${r.rem<=0?`Pasado por ${Math.abs(r.rem).toLocaleString('es-PE')} ${r.un}`:`Faltan ${r.rem.toLocaleString('es-PE')} ${r.un}`}${r.proj?` · por uso real ≈ ${fmtD(r.proj)}`:''}${r.adelantar?' · conviene adelantarlo':''}</p>`}

/* ---------- Eventos ---------- */
function plEvents(from,to){
  const L=[],t=today();
  pms.forEach(p=>{const d=p.scheduledDate;if(!d)return;const done=p.status!=='PROGRAMADO';
    if((d>=from&&d<=to)||(!done&&d<from&&from<=t))L.push({k:'pm',id:p.id,d,fid:p.fleetId,code:plEqCode(p.fleetId),title:p.plan||'Preventivo',who:plTech(p.responsible||p.resp),h:Number(p.durH)||PL_PM_H,done,over:!done&&d<t,drag:!done&&isSup(),hr:pmHrs(p)})});
  backlogs.forEach(b=>{const d=b.scheduledDate;if(!d||b.status==='ANULADO')return;const done=!bkOpen(b);
    if((d>=from&&d<=to)||(!done&&d<from&&from<=t))L.push({k:'bk',id:b.id,d,fid:b.fleetId,code:plEqCode(b.fleetId),title:(bkNo(b)||b.id)+' · '+(b.component||''),who:plTech(b.ot&&otTech(b.ot)),h:plBkH(b),done,over:!done&&d<t,drag:!done&&isSup(),pr:b.criticality})});
  const S=window.EQN_SUM;(S&&S.agenda||[]).forEach((a,i)=>{if(a.k==='engrase'&&!plF.eng||a.k==='inspeccion'&&!plF.ins)return;if(!((a.d>=from&&a.d<=to)||(a.venc&&!a.done&&from<=t)))return;
    L.push({k:a.k==='engrase'?'eg':'in',id:'A'+i,d:a.d,code:a.code,title:a.k==='engrase'?`Engrase ${a.t}`:`Medición neumáticos (${a.n})`,who:'',h:a.h||0,done:a.done,over:a.venc&&!a.done,drag:false})});
  return L;
}
const PL_C={pm:['#60a5fa','rgba(59,130,246,.12)','🗓️'],bk:['#f59e0b','rgba(245,158,11,.12)','🔧'],eg:['#34d399','rgba(16,185,129,.12)','🛢️'],in:['#c084fc','rgba(168,85,247,.12)','🛞']};
function plCard(e){const c=PL_C[e.k];
  return `<div class="plc${e.done?' pldone':''}${e.over?' plover':''}" style="--c:${c[0]};--b:${c[1]}" ${e.drag?`draggable="true" ondragstart="plDrag(event,'${e.k}','${e.id}')"`:''} onclick="plOpen('${e.k}','${esc(e.id)}')" title="${esc(e.title)}">
    <div class="flex justify-between gap-1"><b>${c[2]} ${esc(e.code)}</b>${e.h?`<span class="plh">${Math.round(e.h*10)/10} h</span>`:''}</div>
    <p class="pl1">${esc(e.title)}</p>${e.who?`<p class="pl2">👷 ${esc(e.who)}</p>`:''}${e.pr?`<span class="pl2" style="color:${PR_C[e.pr]||'#94a3b8'}">${esc(e.pr)}</span>`:''}${e.hr&&e.hr.k!=='OK'?`<p class="pl2" style="color:${e.hr.k==='VENCIDO'?'#f87171':'#fbbf24'}">⏱️ ${e.hr.rem<=0?'pasado de horas':'faltan '+e.hr.rem+' '+e.hr.un}</p>`:''}${e.over?'<p class="pl2" style="color:#f87171">Atrasado</p>':''}${e.done?'<p class="pl2">✓ Hecho</p>':''}</div>`}

/* ---------- Arrastrar y soltar ---------- */
function plDrag(ev,k,id){ev.dataTransfer.setData('text/plain',k+'|'+id);ev.dataTransfer.effectAllowed='move'}
function plOver(ev){ev.preventDefault();ev.currentTarget.classList.add('plhot')}
function plLeave(ev){ev.currentTarget.classList.remove('plhot')}
function plDrop(ev,d){ev.preventDefault();ev.currentTarget.classList.remove('plhot');const [k,id]=(ev.dataTransfer.getData('text/plain')||'').split('|');if(k&&id)plMove(k,id,d)}
function plMove(k,id,d){
  if(!isSup()||!d)return;
  if(k==='pm'){const p=pms.find(x=>x.id===id);if(!p||p.status!=='PROGRAMADO')return;if(p.scheduledDate!==d)put('preventive',{...p,scheduledDate:d})}
  else if(k==='bk'){const b=backlogs.find(x=>x.id===id);if(!b||!bkOpen(b))return;
    put('backlogs',{...b,scheduledDate:d,status:['REGISTRADO','PLANIFICADO'].includes(b.status)?'PROGRAMADO':b.status})}
}

/* ---------- Detalle de una tarjeta (también sirve para reprogramar en el celular) ---------- */
function plOpen(k,id){
  if(k==='eg'||k==='in'){const S=window.EQN_SUM,a=(S&&S.agenda||[])[Number(id.slice(1))];if(!a)return;
    show(`<div class="flex justify-between items-start"><h3 class="font-bold">${a.k==='engrase'?'🛢️ Engrase '+esc(a.t):'🛞 Medición de neumáticos'} · ${esc(a.code)}</h3><button type="button" onclick="hide()" class="text-slate-400 text-xl">✕</button></div>
    <p class="text-sm text-slate-300 mt-2">${fmtD(a.d)} · ${a.done?'✓ Ejecutado':a.venc?'Atrasado':'Programado'}${a.h?' · '+a.h+' h estimadas':''}</p>
    <p class="text-xs text-slate-400 mt-2">El programa de engrase y las mediciones se ajustan en el apartado Engrase y Neumáticos.</p>
    <div class="flex gap-2 justify-end mt-4"><button type="button" onclick="hide();eqnOpen('${a.k==='engrase'?'engrase':'neumaticos'}','${esc(a.code)}')" class="btn bg-amber-500 text-slate-950">Abrir en Engrase y Neumáticos</button></div>`,'28rem');return}
  const p=k==='pm'?pms.find(x=>x.id===id):null,b=k==='bk'?backlogs.find(x=>x.id===id):null,o=p||b;if(!o)return;plSel=p?p.id:'';
  const e=eqOf(o.fleetId),d=o.scheduledDate||today(),can=isSup()&&(p?p.status==='PROGRAMADO':bkOpen(b));
  const ver=p?`openDetailPm('${p.id}')`:`bkDetail('${b.id}')`,hr=p?pmHrs(p):null;
  show(`<div class="flex justify-between items-start gap-2"><div><h3 class="font-bold">${p?'🗓️ '+esc(p.plan):'🔧 '+esc(bkNo(b)||b.id)+' · '+esc(b.component||'')}</h3><p class="text-xs text-slate-400">${esc(e.code)} · ${esc(e.category||'')} · ${esc(e.brand||'')} ${esc(e.model||'')}</p></div><button type="button" onclick="hide()" class="text-slate-400 text-xl">✕</button></div>
   <div class="text-sm text-slate-300 mt-2 space-y-1"><p>Programado: <b>${fmtD(o.scheduledDate)}</b>${p&&p.scheduledHours!==''&&p.scheduledHours!=null?' · a las '+fmtH(p.scheduledHours)+' h':''}</p>
   ${p?`<p>Responsable: ${esc(p.responsible||'—')} · ${Number(p.durH)||PL_PM_H} h estimadas${p.durH?'':' (por defecto)'}</p>`:`<p>Técnico: ${esc((b.ot&&otTech(b.ot))||'— sin OT —')} · ${plBkH(b)||'—'} h · prioridad ${esc(PR_L[b.criticality]||b.criticality||'—')}</p>`}
   ${hr?pmHrsLine(p):''}</div>
   ${can?`<div class="bg-slate-900/50 border border-slate-700 rounded-lg p-3 mt-3"><p class="text-xs text-slate-400 font-semibold mb-1">Reprogramar</p><div class="flex gap-2 flex-wrap items-center"><input type="date" id="pl-d" class="inp" style="max-width:11rem" value="${esc(d)}">${hr&&hr.proj&&hr.proj!==d?`<button type="button" class="btn bg-slate-700 !py-1" onclick="$('pl-d').value='${hr.proj}'">Usar fecha por horómetro (${fmtD(hr.proj)})</button>`:''}<button type="button" class="btn bg-amber-500 text-slate-950" onclick="plMove('${k}','${o.id}',$('pl-d').value);hide()">Guardar fecha</button></div></div>`:''}
   ${p?plWinHtml(p.fleetId,d,true):''}
   <div class="flex gap-2 justify-end mt-4"><button type="button" onclick="hide();${ver}" class="btn bg-slate-700">Ver detalle</button></div>`,'40rem');
}

/* ---------- Ventanas de mantenimiento ---------- */
const plWinList=fid=>backlogs.filter(b=>b.fleetId===fid&&bkOpen(b)).sort((a,b)=>String(a.criticality).localeCompare(String(b.criticality)));
function plWinHtml(fid,d,act){
  const l=plWinList(fid);if(!l.length)return act?'<p class="text-xs text-slate-500 mt-3">✅ Este equipo no tiene backlogs pendientes.</p>':'';
  return `<div class="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mt-3"><p class="text-sm font-semibold text-amber-400">🪟 Aprovecha la parada: ${l.length} backlog(s) pendiente(s) de este equipo</p>
   ${l.slice(0,8).map(b=>`<div class="flex justify-between items-center gap-2 text-sm mt-2"><div class="min-w-0"><b>${esc(bkNo(b)||b.id)}</b> <span class="text-slate-300">${esc(b.component||'')}</span> <span class="text-xs" style="color:${PR_C[b.criticality]||'#94a3b8'}">${esc(b.criticality||'')}</span><p class="text-xs text-slate-400">${esc((BK_ST[b.status]||{}).l||b.status)}${b.scheduledDate?' · programado '+fmtD(b.scheduledDate):''}${plBkH(b)?' · '+plBkH(b)+' h':''}</p></div>
     ${act&&isSup()&&b.scheduledDate!==d&&!['ESPERA_REPUESTOS','ESPERA_SERVICIO'].includes(b.status)?`<button type="button" class="btn bg-amber-500/20 text-amber-400 !py-1" style="white-space:nowrap" onclick="plMove('bk','${b.id}','${d}');setTimeout(()=>plOpen('pm','${esc(plSel)}'),300)">Programar el ${fmtD(d)}</button>`:''}</div>`).join('')}
   ${l.some(b=>['ESPERA_REPUESTOS','ESPERA_SERVICIO'].includes(b.status))?'<p class="text-[11px] text-slate-400 mt-2">Los que esperan repuestos o servicio se programan cuando lleguen.</p>':''}</div>`;
}
function pmWinRender(){const s=document.querySelector('#modal select[name=fleetId]'),el=$('pm-win'),dt=document.querySelector('#modal input[name=scheduledDate]');if(!s||!el)return;el.innerHTML=plWinHtml(s.value,dt?dt.value:today(),false)}

/* ---------- Carga de trabajo por técnico ---------- */
function plLoad(ev,days){
  const rows={},cap=plCap(),add=(w,d,h)=>{(rows[w]=rows[w]||{})[d]=(rows[w][d]||0)+h};
  techList().filter(u=>u.role!=='admin').forEach(u=>rows[u.name]=rows[u.name]||{});
  ev.filter(e=>!e.done&&days.includes(e.d)&&e.h>0).forEach(e=>add(e.k==='eg'?'🛢️ Engrase (programa EG/EP)':e.who||'⚠️ Sin técnico asignado',e.d,e.h));
  const names=Object.keys(rows).sort((a,b)=>(a.startsWith('⚠️')?1:0)-(b.startsWith('⚠️')?1:0)||(a.startsWith('🛢️')?1:0)-(b.startsWith('🛢️')?1:0)||a.localeCompare(b));
  if(!names.length)return dEmpty('Sin técnicos ni trabajos con horas en esta semana.');
  const cell=(n,d)=>{const h=Math.round(((rows[n]||{})[d]||0)*10)/10,sp=n.startsWith('⚠️')||n.startsWith('🛢️'),c=!h?'':sp?'#94a3b8':h>cap?'#f87171':h>=cap*.75?'#fbbf24':'#34d399';
    return `<td class="num" style="${h?`color:${c};font-weight:700`:'color:#64748b'}">${h||'·'}</td>`};
  return `<div class="ltw" style="overflow-x:auto"><table class="ltbl"><thead><tr><th>Técnico</th>${days.map((d,i)=>`<th class="num">${PL_DIAS[i]} ${d.slice(8)}</th>`).join('')}<th class="num">Semana</th></tr></thead><tbody>
   ${names.map(n=>{const tot=Math.round(days.reduce((s,d)=>s+((rows[n]||{})[d]||0),0)*10)/10;return `<tr><td class="nw"><b>${esc(n)}</b></td>${days.map(d=>cell(n,d)).join('')}<td class="num"><b>${tot||'·'}</b></td></tr>`}).join('')}
   </tbody></table></div><p class="text-[11px] text-slate-400 mt-1">Verde: carga normal · ámbar: ≥75 % · rojo: más de ${cap} h en el día. Horas de backlogs: de las tareas de la OT (o la duración / HH del backlog). Preventivos sin duración: ${PL_PM_H} h. Disponibles por técnico y día: <input type="number" min="1" max="24" step="0.5" value="${cap}" class="inp" style="display:inline-block;width:4.5rem;padding:.15rem .4rem" onchange="try{localStorage.setItem('plCap',this.value)}catch(_){};renderPlan()"> h</p>`;
}

/* ---------- Vista ---------- */
function renderPlan(){
  const el=$('v-plan');if(!el)return;
  if(!isSup()){el.innerHTML=dEmpty('La planificación es para el planner y los supervisores.');return}
  const days=plDays(),from=days[0],to=days[6],t=today(),ev=plEvents(from,to);
  const over=ev.filter(e=>e.over&&e.d<from),wk=ev.filter(e=>e.d>=from&&e.d<=to);
  const unsch=backlogs.filter(b=>bkOpen(b)&&!b.scheduledDate).sort((a,b)=>String(a.criticality).localeCompare(String(b.criticality))||(a.observationDate||'').localeCompare(b.observationDate||''));
  const hrsL=pms.map(p=>({p,r:pmHrs(p)})).filter(x=>x.r&&(x.r.k!=='OK'||x.r.adelantar)).sort((a,b)=>a.r.rem-b.r.rem);
  const tot=k=>wk.filter(e=>e.k===k&&!e.done).length,hT=Math.round(wk.filter(e=>!e.done).reduce((s,e)=>s+e.h,0)*10)/10;
  el.innerHTML=`<div class="pghead"><div class="flex items-center gap-3"><span class="pgic">📅</span><div><h2 class="text-xl font-bold">Planificación semanal</h2><p class="text-xs text-slate-400">${fmtD(from)} al ${fmtD(to)} · arrastra una tarjeta a otro día para reprogramarla (en el celular, tócala)</p></div></div>
   <div class="flex gap-1 flex-wrap"><button type="button" class="btn bg-slate-700" onclick="plGo(-1)">‹ Semana anterior</button><button type="button" class="btn bg-slate-700" onclick="plGo(0)">Esta semana</button><button type="button" class="btn bg-slate-700" onclick="plGo(1)">Siguiente ›</button></div></div>
  <div class="kgrid">${kpi('Preventivos',tot('pm'),'en la semana','#60a5fa','🗓️')}${kpi('Backlogs programados',tot('bk'),unsch.length+' sin fecha','#f59e0b','🔧')}${kpi('Engrases EG/EP',tot('eg'),'del programa','#34d399','🛢️')}${kpi('Horas planificadas',hT,over.length+' trabajo(s) atrasado(s)',over.length?'#f87171':'#e2e8f0','⏱️')}</div>
  <div class="flex gap-3 flex-wrap text-xs text-slate-400 items-center"><label class="flex items-center gap-1"><input type="checkbox" ${plF.eng?'checked':''} onchange="plF.eng=this.checked;renderPlan()"> Engrases EG/EP</label><label class="flex items-center gap-1"><input type="checkbox" ${plF.ins?'checked':''} onchange="plF.ins=this.checked;renderPlan()"> Mediciones de neumáticos</label>${window.EQN_SUM?'':'<span>· Cargando engrases e inspecciones…</span>'}</div>
  ${over.length?`<div class="bg-red-500/10 border border-red-500/30 rounded-xl p-3"><p class="text-sm font-semibold text-red-400 mb-2">⚠️ Atrasados (${over.length}) — arrástralos a un día de la semana</p><div class="plrow">${over.sort((a,b)=>a.d.localeCompare(b.d)).map(plCard).join('')}</div></div>`:''}
  <div class="plweek">${days.map((d,i)=>{const l=wk.filter(e=>e.d===d).sort((a,b)=>'pmbkegin'.indexOf(a.k)-'pmbkegin'.indexOf(b.k)||a.code.localeCompare(b.code)),h=Math.round(l.filter(e=>!e.done).reduce((s,e)=>s+e.h,0)*10)/10;
    return `<div class="plday${d===t?' pltoday':''}" ondragover="plOver(event)" ondragleave="plLeave(event)" ondrop="plDrop(event,'${d}')"><div class="plhd"><b>${PL_DIAS[i]} ${d.slice(8)}</b><span>${h?h+' h':''}</span></div>${l.map(plCard).join('')||'<p class="pl2" style="text-align:center;padding:.5rem 0">—</p>'}</div>`}).join('')}</div>
  <div class="dcard"><p class="font-semibold mb-2">👷 Carga de trabajo por técnico</p>${plLoad(ev,days)}</div>
  <div class="dgrid2">
   <div class="dcard"><p class="font-semibold mb-2">⏱️ Preventivos por horómetro</p>${hrsL.length?hrsL.slice(0,12).map(({p,r})=>{const e=eqOf(p.fleetId);return `<div class="flex justify-between items-center gap-2 text-sm py-1 border-b border-slate-700"><div class="min-w-0"><b class="text-amber-400">${esc(e.code)}</b> ${esc(p.plan)}<p class="text-xs text-slate-400">Programado ${fmtD(p.scheduledDate)} a las ${fmtH(p.scheduledHours)} ${r.un} · actual ${fmtH(e.hours)}${r.uso?` · uso ${r.uso.u} ${r.un}/día`:''}</p>${pmHrsLine(p)}</div>${r.proj&&r.proj!==p.scheduledDate?`<button type="button" class="btn bg-slate-700 !py-1" style="white-space:nowrap" onclick="plMove('pm','${p.id}','${r.proj}')">Mover al ${fmtD(r.proj)}</button>`:''}</div>`}).join(''):dEmpty('Ningún preventivo está cerca por horómetro. Para usarlo, indica el horómetro programado en el preventivo.')}</div>
  <div class="dcard"><p class="font-semibold mb-2">🔧 Backlogs sin fecha (${unsch.length}) — arrástralos al calendario</p>${unsch.length?`<div class="plrow">${unsch.slice(0,40).map(b=>plCard({k:'bk',id:b.id,d:'',code:plEqCode(b.fleetId),title:(bkNo(b)||b.id)+' · '+(b.component||''),who:plTech(b.ot&&otTech(b.ot)),h:plBkH(b),pr:b.criticality,drag:isSup()})).join('')}</div>`:dEmpty('Todos los backlogs abiertos tienen fecha.')}</div>
  </div>`;
}
