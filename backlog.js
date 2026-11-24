/* =====================================================================
   BACKLOGS (flujo de Control de flota): estados, plazos por prioridad,
   requerimientos de repuestos y servicios, orden de trabajo, trazabilidad,
   órdenes de trabajo, fallas recurrentes y dashboard de mantenimiento.
   Se carga ANTES de app.js: aquí solo hay declaraciones (nada se ejecuta al cargar).
   ===================================================================== */

/* ---------- Estados, plazos y catálogos ---------- */
const BK_ST={
  REGISTRADO:{l:'Registrado',c:'#94a3b8',d:'Detectado, falta evaluar y planificar'},
  PLANIFICADO:{l:'Planificado',c:'#3b82f6',d:'Recursos definidos, listo para programar'},
  ESPERA_REPUESTOS:{l:'Espera repuestos',c:'#f97316',d:'Requerimiento de repuestos emitido'},
  ESPERA_SERVICIO:{l:'Espera servicio',c:'#a855f7',d:'Requiere servicio de tercero'},
  PROGRAMADO:{l:'Programado',c:'#06b6d4',d:'Fecha asignada para ejecutar'},
  EN_EJECUCION:{l:'En ejecución',c:'#f59e0b',d:'Trabajo en curso en el equipo'},
  PENDIENTE_VALIDACION:{l:'Por validar',c:'#c084fc',d:'Cerrado por el técnico, falta el supervisor'},
  COMPLETADO:{l:'Cerrado',c:'#10b981',d:'Validado por el supervisor'},
  ANULADO:{l:'Anulado',c:'#64748b',d:'Descartado'}};
const BK_OPEN=['REGISTRADO','PLANIFICADO','ESPERA_REPUESTOS','ESPERA_SERVICIO','PROGRAMADO','EN_EJECUCION'];
const BK_OLD={PENDIENTE:'REGISTRADO',EN_PROCESO:'EN_EJECUCION'}; // estados de la versión anterior
const PR_OLD={ALTA:'P1',MEDIA:'P2',BAJA:'P3'}; // prioridades de la versión anterior
const bkNorm=b=>{let o=BK_OLD[b.status]?{...b,status:BK_OLD[b.status]}:b;if(!PR_K.includes(o.criticality))o={...o,criticality:PR_OLD[o.criticality]||'P2'};const t=bkTypeOf(o.workType);if(t!==o.workType)o={...o,workType:t};return o};
const bkOpen=b=>BK_OPEN.includes(b.status);
const bkClosed=b=>b.status==='COMPLETADO'||b.status==='PENDIENTE_VALIDACION';
// Prioridad según el formato F-MT-21 (lead time)
const PR_K=['P1','P2','P3','P4'];
const PLAZO={P1:4,P2:7,P3:24,P4:45};
const PR_L={P1:'P1 Emergencia',P2:'P2 Alta',P3:'P3 Normal',P4:'P4 Oportunidad'},PR_F={P1:'P1 - Emergencia (≤4 d)',P2:'P2 - Alta (≤7 d)',P3:'P3 - Normal (≤24 d)',P4:'P4 - Oportunidad (≤45 d)'},PR_C={P1:'#ef4444',P2:'#f97316',P3:'#eab308',P4:'#22c55e'};
const PR_D={P1:'Riesgo de falla mayor o de seguridad',P2:'Afecta el desempeño, atender en la semana',P3:'Atender dentro del mes',P4:'Atender en una ventana de oportunidad'};
const BK_SYS=['Motor','Sistema de enfriamiento','Sistema de combustible','Admisión y escape','Sistema de lubricación','Tren de fuerza / Transmisión','Diferenciales y mandos finales','Sistema hidráulico','Sistema de frenos','Sistema de dirección','Suspensión','Tren de rodaje / Orugas','Neumáticos y aros','Sistema eléctrico','Sistema de arranque y carga','Aire acondicionado','Cabina y ergonomía','Estructura / Chasis / Bastidor','Implementos (tolva, cucharón, hoja)','Sistema de seguridad (alarmas, luces, extintores)','Sistema contra incendio (AFEX)','GPS / Telemetría','Carrocería'];
const BK_SRC=['Inspección diaria / Check list del operador','Inspección del técnico','Mantenimiento preventivo (PM)','Análisis de aceite','Reporte de falla del operador','Inspección de seguridad / SSOMA','Monitoreo de condición (termografía, vibraciones)','Telemetría / códigos de falla','Inspección pre-uso de garita'];
const BK_TYPE=['Correctivo / Falla / Observación','Preventivo / PM / Rutina','Predictivo / Condición / Inspección','Pendiente por repuesto / Ventana'];
const bkTypeOf=t=>{if(BK_TYPE.includes(t))return t;const k=nk(t);return /^prev/.test(k)?BK_TYPE[1]:/^(predic|inspec|condic)/.test(k)?BK_TYPE[2]:/^(pend|repuest|ventan)/.test(k)?BK_TYPE[3]:BK_TYPE[0]};
const BK_EVT=['En Pre-PM','En PM1','En PM2','En PM3','En PM4','Parada exclusiva / Correctiva','Ventana de oportunidad'];
const BK_CON=['En operación – requiere parada programada','Equipo detenido','En taller','N/A'];
const BK_HR=['Mecánico','Electricista','Soldador','Gruero','Rigger'],BK_EQS=['Grúa','Máquina de soldar','Compresora','Luminaria','Montacarga'];
const OT_ESP=['Mecánica','Eléctrica','Soldadura','Neumáticos','Lubricación','Hidráulica','Terceros'];
const RQ_ST={SOLICITADO:{l:'Solicitado',c:'#94a3b8'},APROBADO:{l:'Aprobado',c:'#3b82f6'},TRANSITO:{l:'En tránsito',c:'#f59e0b'},ATENDIDO:{l:'Atendido / recibido',c:'#10b981'}};
const RQ_T={R:'Repuesto',S:'Servicio'};
const bkLimit=b=>addDays(b.observationDate||today(),PLAZO[b.criticality]||7);
const dDiff=(a,b)=>Math.round((day(b)-day(a))/864e5);
const bkVenc=b=>bkOpen(b)&&today()>bkLimit(b);
const bkAge=b=>Math.max(0,dDiff(b.observationDate||today(),bkClosed(b)&&b.closeDate?b.closeDate:today()));
const bkLate=b=>bkOpen(b)?Math.max(0,dDiff(bkLimit(b),today())):bkClosed(b)&&b.closeDate?Math.max(0,dDiff(bkLimit(b),b.closeDate)):0;
const rqPend=r=>r&&r.st!=='ATENDIDO';
const rqLate=r=>rqPend(r)&&r.estDate&&r.estDate<today();
const bkLog=(b,t)=>[...(b.log||[]),{t,ts:Date.now(),by:me?me.name:''}].slice(-80);
const famOf=b=>eqOf(b.fleetId).category||'';
const bkStBadge=k=>{const s=BK_ST[k]||{l:k,c:'#94a3b8'};return `<span class="bdg" style="color:${s.c};background:${s.c}1f;border-color:${s.c}66">${esc(s.l)}</span>`};
const bkPrBadge=k=>`<span class="bdg" style="color:#fff;background:${PR_C[k]||'#64748b'};border-color:${PR_C[k]||'#64748b'}">${esc(PR_L[k]||k||'—')}</span>`;
const chipMono=(t,c)=>t?`<span class="chipm" style="${c?'color:'+c+';border-color:'+c+'66':''}">${esc(t)}</span>`:'';
const monL=m=>{const [y,mo]=m.split('-');return ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Set','Oct','Nov','Dic'][+mo-1]+' '+y.slice(2)};
const monAdd=(m,n)=>{const [y,mo]=m.split('-').map(Number),d=new Date(y,mo-1+n,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};
const monEnd=m=>{const [y,mo]=m.split('-').map(Number);return fmtISO(new Date(y,mo,0))};

/* ---------- Menú lateral (laptop) y buscador ---------- */
const SIDE=[['General',[['dash','📊','Dashboard']]],
  ['Backlogs',[['back:list','🔧','Backlogs'],['back:mis','📋','Mis OT'],['back:board','🗂️','Tablero'],['back:req','📦','Repuestos y servicios'],['back:ot','📄','Órdenes de trabajo'],['back:fal','⚠️','Fallas recurrentes']]],
  ['Mantenimiento',[['pm','🗓️','Preventivos'],['gr','🛢️','Engrase y Neumáticos'],['rep','📝','Reporte de paradas']]],
  ['Gestión',[['fleet','🚜','Equipos'],['sup','🛡️','Supervisor'],['adm','⚙️','Admin']]]];
function renderSide(){
  const s=$('side');if(!s||!me)return;
  const venc=backlogs.filter(bkVenc).length,val=backlogs.filter(b=>b.status==='PENDIENTE_VALIDACION').length+pms.filter(p=>p.status==='PENDIENTE_VALIDACION').length;
  const vis=k=>{const t=$('t-'+k.split(':')[0]);return !t||t.style.display!=='none'};
  const act=k=>{const [a,b]=k.split(':');return cur===a&&(!b||bkSub===b||(b==='list'&&!['board','req','ot','fal','mis'].includes(bkSub)))};
  const mo=misOpen().length,bd=k=>k==='back:mis'&&mo?`<span class="sbdg" style="background:#d97706">${mo}</span>`:k==='back:list'&&venc?`<span class="sbdg">${venc}</span>`:k==='sup'&&val?`<span class="sbdg" style="background:#7e22ce">${val}</span>`:'';
  s.innerHTML=`<div class="side-brand">${SYM(34)}<div class="min-w-0"><b>mantify</b><span>Control de mantenimiento</span></div></div>
  <button type="button" class="side-new" onclick="openBack()">＋ Nuevo backlog</button>
  <nav class="side-nav">${SIDE.map(([g,items])=>{const it=items.filter(([k])=>vis(k));return it.length?`<p class="side-g">${g}</p>`+it.map(([k,ic,l])=>`<button type="button" class="side-i${act(k)?' on':''}" onclick="sideGo('${k}')"><span class="side-ic">${ic}</span><span class="side-l">${l}</span>${bd(k)}</button>`).join(''):''}).join('')}</nav>
  <div class="side-foot"><button type="button" class="side-i" onclick="themeToggle()" style="margin-bottom:.4rem"><span class="side-ic">${isLight()?'🌙':'☀️'}</span><span class="side-l">${isLight()?'Fondo oscuro':'Fondo blanco'}</span></button>${$('sync')?$('sync').innerHTML:''}</div>`;
  otNotify();
}
function sideGo(k){const [a,b]=k.split(':');if(a==='back'){bkGo(b)}else{if(a==='gr')eqnRoute='dashboard';tab(a)}}
function bkGo(sub,st){bkSub=sub||'list';if(st!=null){bkF.st=st;bkF.venc=false}if(cur!=='back')tab('back');else render()}
function gSearch(v){
  v=(v||'').trim();if(!v)return;const q=v.toLowerCase(),e=fleet.find(x=>String(x.code).toLowerCase()===q);
  if(e){openEquip(e.id);return}
  const b=backlogs.find(x=>String(x.id).toLowerCase()===q||String(x.num||'').toLowerCase()===q||(x.ot&&String(x.ot.num).toLowerCase()===q));if(b){bkDetail(b.id);return}
  bkF.q=v;bkF.st='';bkGo('list');
}

/* ---------- Vista Backlogs ---------- */
let bkSub='list',bkF={q:'',st:'',pr:'',sy:'',fa:'',venc:false},bkDetId=null,bkView='list';
const BK_SUBS=[['list','🔧 Backlogs'],['mis','📋 Mis OT'],['board','🗂️ Tablero'],['req','📦 Repuestos y servicios'],['ot','📄 Órdenes de trabajo'],['fal','⚠️ Fallas recurrentes']];
function bkSet(k,v){bkF[k]=k==='venc'?!bkF.venc:v;renderBack()}
function bkFiltered(){
  const s=nk(bkF.q);
  return backlogs.filter(b=>{const e=eqOf(b.fleetId);
    if(bkF.st==='OPEN'?!bkOpen(b):bkF.st&&b.status!==bkF.st)return false;
    if(bkF.pr&&b.criticality!==bkF.pr)return false;if(bkF.sy&&b.system!==bkF.sy)return false;if(bkF.fa&&e.category!==bkF.fa)return false;if(bkF.venc&&!bkVenc(b))return false;
    return !s||[b.id,b.num,e.code,e.brand,e.model,b.component,b.system,b.description,b.rqMain,b.ot&&b.ot.num,...(b.reqs||[]).map(r=>r.num)].some(v=>nk(v).includes(s))})
   .sort((a,b)=>(bkOpen(b)-bkOpen(a))||(b.observationDate||'').localeCompare(a.observationDate||'')||String(b.id).localeCompare(String(a.id)));
}
function renderBack(){
  const el=$('v-back');if(!el)return;
  const subBar=`<div class="subbar">${BK_SUBS.map(([k,l])=>`<button type="button" onclick="bkGo('${k}')" class="btn ${bkSub===k?'bg-amber-500 text-slate-950':'bg-slate-700'} !py-1" style="white-space:nowrap">${l}</button>`).join('')}</div>`;
  if(bkSub==='mis'){el.innerHTML=subBar+misView();return}
  if(bkSub==='req'){el.innerHTML=subBar+rqView();return}
  if(bkSub==='ot'){el.innerHTML=subBar+otView();return}
  if(bkSub==='fal'){el.innerHTML=subBar+falView();return}
  const l=bkFiltered(),systems=[...new Set([...BK_SYS,...backlogs.map(b=>b.system).filter(Boolean)])],fams=[...new Set(fleet.map(e=>e.category).filter(Boolean))].sort();
  const o=(v,t,c)=>`<option value="${esc(v)}" ${c===v?'selected':''}>${esc(t)}</option>`;
  const head=`<div class="pghead"><div class="flex items-center gap-3 min-w-0"><span class="pgic">🔧</span><div class="min-w-0"><h2 class="text-xl font-bold">Backlogs</h2><p class="text-xs text-slate-400">${l.length} de ${backlogs.length} backlogs · ${backlogs.filter(bkOpen).length} abiertos · <span class="text-red-400">${backlogs.filter(bkVenc).length} vencidos</span></p></div></div>
    <div class="flex gap-2 flex-wrap"><button onclick="openBack()" class="btn bg-amber-500 text-slate-950">＋ Nuevo backlog</button><button onclick="exportCsv('back')" class="btn bg-slate-700">📊 Excel</button><button onclick="bkPdfOpen()" class="btn bg-slate-700">📄 PDF abiertos</button><button id="bt-mod-bk" onclick="openModEq('bk')" class="btn bg-slate-700" style="display:${isAdmin()?'':'none'}">🧩 Equipos</button></div></div>`;
  const filt=`<div class="bg-slate-800 border border-slate-700 rounded-xl p-3 bkfilt">
    <input class="inp" placeholder="Buscar N° backlog, equipo, componente, N° RQ u OT…" value="${esc(bkF.q)}" oninput="bkF.q=this.value;clearTimeout(window._bkq);window._bkq=setTimeout(renderBackKeep,250)">
    <select class="inp" onchange="bkSet('st',this.value)">${o('','Todos los estados',bkF.st)}${o('OPEN','Solo abiertos',bkF.st)}${Object.keys(BK_ST).map(k=>o(k,BK_ST[k].l,bkF.st)).join('')}</select>
    <select class="inp" onchange="bkSet('pr',this.value)">${o('','Prioridad',bkF.pr)}${PR_K.map(k=>o(k,PR_L[k],bkF.pr)).join('')}</select>
    <select class="inp" onchange="bkSet('sy',this.value)">${o('','Sistema',bkF.sy)}${systems.map(k=>o(k,k,bkF.sy)).join('')}</select>
    <select class="inp" onchange="bkSet('fa',this.value)">${o('','Familia',bkF.fa)}${fams.map(k=>o(k,k,bkF.fa)).join('')}</select>
    <button type="button" onclick="bkSet('venc')" class="btn ${bkF.venc?'bg-red-500 text-white':'bg-slate-700'}">⏰ Vencidos</button></div>`;
  el.innerHTML=subBar+head+filt+(bkSub==='board'?bkBoard(l):bkList(l));
}
function renderBackKeep(){const a=document.activeElement,pos=a&&a.selectionStart;renderBack();const i=document.querySelector('.bkfilt input');if(i&&a&&a.tagName==='INPUT'){i.focus();try{i.setSelectionRange(pos,pos)}catch(_){}}}
function bkActs(b){
  return `${bkOpen(b)&&otCanClose(b)?`<button onclick="openClose('${b.id}')" class="btn bg-emerald-500/20 text-emerald-400 !py-1" title="Cerrar con reporte de mantenimiento">✅</button>`:''}<button onclick="bkDetail('${b.id}')" class="btn bg-slate-700 !py-1" title="Ver detalle">👁️</button>${bkOpen(b)||isAdmin()?`<button onclick="openBack('${b.id}')" class="btn bg-slate-700 !py-1" title="Editar">✏️</button>`:''}`;
}
function bkList(l){
  if(!l.length)return `<p class="text-slate-500 text-sm">${backlogs.length?'Ningún backlog coincide con los filtros.':'Aún no hay backlogs. Usa "＋ Nuevo backlog" para registrar la primera observación.'}</p>`;
  const lim=l.slice(0,bkLim),more=l.length>bkLim?`<button onclick="bkLim+=60;renderBack()" class="btn bg-slate-700 w-full mt-2">Ver ${Math.min(60,l.length-bkLim)} más (${l.length-bkLim} restantes)</button>`:'';
  const reqTxt=b=>[b.rqMain&&chipMono(b.rqMain),...(b.reqs||[]).filter(r=>r.num&&r.num!==b.rqMain).slice(0,2).map(r=>chipMono(r.num)),b.ot&&b.ot.num?chipMono(b.ot.num,'#60a5fa'):(bkOpen(b)?'<span class="chipm" style="color:#fbbf24;border-color:#fbbf2466">Sin OT</span>':'')].filter(Boolean).join(' ');
  const venc=b=>bkVenc(b)?`<span class="lsub text-red-400">Vencido ${fmtD(bkLimit(b))}</span>`:b.rejectNote&&b.status==='EN_EJECUCION'?`<span class="lsub text-red-400">⚠️ Devuelto</span>`:'';
  const tbl=`<div class="lap-only"><div class="ltw"><table class="ltbl"><thead><tr><th>N° / Fecha</th><th>Equipo</th><th>Observación</th><th>Prioridad</th><th>Estado</th><th>N° Req. · OT</th><th>Días</th><th></th></tr></thead><tbody>${lim.map(b=>{const e=eqOf(b.fleetId),a=bkAge(b);
    return `<tr class="clk" onclick="if(!event.target.closest('button'))bkDetail('${b.id}')"><td class="nw"><b class="text-amber-400 mono">${esc(bkNo(b))}</b><span class="lsub">${fmtD(b.observationDate)}</span></td><td class="nw"><b>${esc(e.code)}</b><span class="lsub">${esc(e.category||'')}</span></td><td style="max-width:28rem"><span class="lsub" style="color:#cbd5e1">${esc(b.system)} · <b>${esc(b.component)}</b></span><span class="lsub clamp2">${esc(b.description)}</span></td><td>${bkPrBadge(b.criticality)}</td><td class="nw">${bkStBadge(b.status)}${venc(b)}</td><td>${reqTxt(b)}</td><td class="num nw"><b class="${bkVenc(b)?'text-red-400':'text-slate-300'}">${a}</b></td><td><div class="lact">${bkActs(b)}</div></td></tr>`}).join('')}</tbody></table></div></div>`;
  const cards=`<div class="mob-only grid gap-3 md:grid-cols-2">${lim.map(b=>{const e=eqOf(b.fleetId);
    return `<div class="bkcard" onclick="if(!event.target.closest('button'))bkDetail('${b.id}')" style="border-left:4px solid ${BK_ST[b.status]?BK_ST[b.status].c:'#334155'}"><div class="flex justify-between items-start gap-2"><div class="min-w-0"><span class="mono text-xs text-slate-400">${esc(bkNo(b))} · ${fmtD(b.observationDate)}</span><p class="font-bold"><span class="text-amber-400">${esc(e.code)}</span> <span class="text-xs text-slate-400">${esc(e.category||'')}</span></p></div>${bkPrBadge(b.criticality)}</div>
      <p class="font-semibold mt-1">${esc(b.component)}</p><p class="text-xs text-slate-400">${esc(b.system)}</p><p class="text-xs text-slate-400 clamp2 mt-1">${esc(b.description)}</p>
      <div class="flex gap-1 flex-wrap items-center mt-2">${bkStBadge(b.status)} ${reqTxt(b)} <span class="text-xs font-bold ${bkVenc(b)?'text-red-400':'text-slate-400'}" style="margin-left:auto">${bkAge(b)} d</span></div>${venc(b)}
      <div class="cact flex gap-1 justify-end mt-3 flex-wrap">${bkActs(b)}</div></div>`}).join('')}</div>`;
  return tbl+cards+more;
}
let bkLim=60;
function bkBoard(l){
  const cols=[...BK_OPEN,'PENDIENTE_VALIDACION'];
  return `<div class="board">${cols.map(k=>{const it=l.filter(b=>b.status===k);
    return `<div class="bcol"><div class="bcol-h"><span><i style="background:${BK_ST[k].c}"></i>${BK_ST[k].l}</span><b>${it.length}</b></div><p class="bcol-d">${BK_ST[k].d}</p>
    ${it.map(b=>{const e=eqOf(b.fleetId),v=bkVenc(b);return `<button type="button" class="bcard${v?' late':''}" onclick="bkDetail('${b.id}')"><div class="flex justify-between gap-2"><span class="mono text-[11px] text-slate-400">${esc(bkNo(b))}</span>${bkPrBadge(b.criticality)}</div>
      <p class="text-sm mt-1"><b>${esc(e.code)}</b> <span class="text-[11px] text-slate-400">${esc(e.category||'')}</span></p><p class="text-sm font-semibold">${esc(b.component)}</p><p class="text-xs text-slate-400 clamp2">${esc(b.description)}</p>
      <div class="flex gap-1 flex-wrap items-center mt-2">${chipMono(b.rqMain||((b.reqs||[])[0]||{}).num)}${b.ot&&b.ot.num?chipMono(b.ot.num,'#60a5fa'):'<span class="chipm" style="color:#fbbf24;border-color:#fbbf2466">Sin OT</span>'}<b class="text-xs ${v?'text-red-400':'text-slate-400'}" style="margin-left:auto">${bkAge(b)} d</b></div></button>`}).join('')||'<p class="text-xs text-slate-500" style="padding:.5rem">Sin backlogs</p>'}</div>`}).join('')}</div>`;
}

/* ---------- Formulario nuevo / editar ---------- */
let bkReqT=[];
const sysSel=(v)=>{const a=[...BK_SYS];if(v&&!a.includes(v))a.unshift(v);return `<select class="inp mt-1 font-normal" name="system" required><option value="">Selecciona el sistema</option>${a.map(x=>`<option ${x===v?'selected':''}>${esc(x)}</option>`).join('')}</select>`};
const lst=(n,o,v,ph)=>`<input class="inp mt-1 font-normal" name="${n}" list="dl-${n}" value="${esc(v||'')}" placeholder="${esc(ph||'')}" maxlength="200"><datalist id="dl-${n}">${o.map(x=>`<option value="${esc(x)}">`).join('')}</datalist>`;
const fsec=(n,t,body)=>`<div class="fsec"><p class="fsec-h"><span>${n}</span>${t}</p><div class="space-y-3">${body}</div></div>`;
function openBack(id){
  const b=backlogs.find(x=>x.id===id)||{};
  if(!fleetIn('bk',b.fleetId).length){note(fleet.length?'Ningún equipo está habilitado en Backlogs (usa 🧩 Equipos).':'Primero registra un equipo en la pestaña Equipos.');return}
  bkReqT=(b.reqs||[]).map(r=>({...r}));
  const locked=!!id&&!bkOpen(b),pr=b.criticality||'P2',eqs=fleetIn('bk',b.fleetId).sort((a,c)=>String(a.code).localeCompare(String(c.code))),e0=eqOf(b.fleetId||eqs[0].id);
  const prev=k=>[...new Set(backlogs.map(x=>x[k]).filter(Boolean))];
  const rh=b.rrhh||{},eqS=b.eqSop||[];
  show(`<div class="flex justify-between items-start"><div><h3 class="font-bold text-lg">${id?'Editar backlog '+esc(bkNo(b)||id):'Nuevo backlog'}</h3><p class="text-xs text-slate-400">Formato de backlog (F-MT-21) · el N° se asigna solo</p></div><button type="button" onclick="hide()" class="text-slate-400 text-xl">✕</button></div>
  <form onsubmit="saveBack(event,'${id||''}')" class="space-y-4 mt-3">
   ${fsec(1,'Datos del backlog',`<label class="block text-xs text-slate-400 font-semibold">Equipo *<select class="inp mt-1 font-normal" name="fleetId" required>${eqs.map(f=>`<option value="${f.id}" ${f.id===b.fleetId?'selected':''}>${esc(f.code)} · ${esc(f.category||'')} · ${esc(f.brand)} ${esc(f.model)}</option>`).join('')}</select></label>
     <div class="g2">${field('observationDate','Fecha de detección *',b.observationDate||today(),`required max="${today()}" onchange="bkLimPrev()"`,'date')}<label class="block text-xs text-slate-400 font-semibold">Elaborado por (solicitante) *<input class="inp mt-1 font-normal" name="detectedBy" required maxlength="80" value="${esc(b.detectedBy||(id?'':me.name))}"></label></div>
     <div class="g2"><label class="block text-xs text-slate-400 font-semibold">Ubicación${lst('ubic',prev('ubic'),b.ubic??(id?'':e0.location||''),'Ej. Tajo, taller, chancadora')}</label><label class="block text-xs text-slate-400 font-semibold">Proyecto${lst('proyecto',prev('proyecto'),b.proyecto,'Ej. Canteras y rellenos Tía María')}</label></div>
     <div class="g2">${field('hoursAt','Horómetro / km',b.hoursAt??(id?'':e0.hours??''),'min="0" step="any" inputmode="decimal"','number')}<label class="block text-xs text-slate-400 font-semibold">Lugar de inspección${lst('lugarInsp',[...ST_LUG,...prev('lugarInsp')],b.lugarInsp,'Campo, taller…')}</label></div>
     <div class="g2"><div><p class="text-xs text-slate-400 font-semibold mb-1">Responsabilidad</p>${fxOpts('respons',['COANSA','PROVEEDOR'],b.respons||'COANSA','radio')}</div><label class="block text-xs text-slate-400 font-semibold">Fuente${lst('source',BK_SRC,b.source,'Elige o escribe')}</label></div>`)}
   ${fsec(2,'Clasificación',`<div><p class="text-xs text-slate-400 font-semibold mb-1">Prioridad (lead time)</p><div class="prsel">${PR_K.map(k=>`<label class="prop" style="--c:${PR_C[k]}"><input type="radio" name="criticality" value="${k}" ${pr===k?'checked':''} onchange="bkLimPrev()"><span><b>${PR_F[k]}</b><small>${PR_D[k]}</small></span></label>`).join('')}</div><p id="bk-lim" class="text-xs text-amber-400 mt-1"></p></div>
     <div><p class="text-xs text-slate-400 font-semibold mb-1">Tipo de backlog</p>${fxOpts('workType',BK_TYPE,b.workType||BK_TYPE[0],'radio')}</div>
     <div><p class="text-xs text-slate-400 font-semibold mb-1">Evento / ejecución</p>${fxOpts('evento',BK_EVT,b.evento||'','radio')}</div>
     <div><p class="text-xs text-slate-400 font-semibold mb-1">Condición / modo</p>${fxOpts('condicion',BK_CON,b.condicion||(b.needsStop?BK_CON[0]:''),'radio')}</div>`)}
   ${fsec(3,'Datos de la actividad',`<div class="g2">${field('component','Componente *',b.component,'required placeholder="Ej. manguera del cilindro de levante"')}<label class="block text-xs text-slate-400 font-semibold">Sistema *${sysSel(b.system)}</label></div>
     <div class="g2">${field('subsystem','Sub sistema',b.subsystem)}${field('tipoRep','Tipo de reparación',b.tipoRep,'list="dl-trep" placeholder="Cambio, reparación, ajuste…"')}</div><datalist id="dl-trep">${['Cambio de componente','Reparación','Ajuste / regulación','Soldadura','Inspección','Limpieza','Reajuste de pernos'].map(x=>`<option value="${x}">`).join('')}</datalist>
     <div class="g2">${field('sintoma','Síntoma',b.sintoma)}${field('causa','Causa',b.causa)}</div>
     <label class="block text-xs text-slate-400 font-semibold">Reporte original (campo) *<textarea maxlength="5000" name="description" required rows="3" class="inp mt-1 font-normal" placeholder="Lo que se reportó en campo">${esc(b.description)}</textarea></label>
     <label class="block text-xs text-slate-400 font-semibold">Actividad realizada (descripción técnica)<textarea maxlength="5000" name="actividad" rows="3" class="inp mt-1 font-normal" placeholder="Trabajo técnico a realizar / realizado">${esc(b.actividad||'')}</textarea></label>
     <label class="block text-xs text-slate-400 font-semibold">Observaciones / recomendaciones<textarea maxlength="5000" name="obsRec" rows="2" class="inp mt-1 font-normal">${esc(b.obsRec||'')}</textarea></label>`)}
   ${fsec(4,'Datos de los recursos',`<div class="g3">${field('durH','Duración tarea (h)',b.durH??'','min="0" step="0.5" inputmode="decimal"','number')}${field('hh','HH total',b.hh??'','min="0" step="0.5" inputmode="decimal"','number')}<div><p class="text-xs text-slate-400 font-semibold mb-1">Lugar</p>${fxOpts('lugarEj',['Site','Externo'],b.lugarEj||'Site','radio')}</div></div>
     <p class="text-xs text-slate-400 font-semibold">Recursos humanos (cantidad)</p><div class="g3">${BK_HR.map(k=>field('rh_'+k,k,rh[k]??'','min="0" step="1" inputmode="numeric"','number')).join('')}</div>
     <p class="text-xs text-slate-400 font-semibold">Equipos de soporte</p>${fxOpts('eqSop',BK_EQS,eqS,'checkbox')}${field('eqOtros','Otros equipos de soporte',b.eqOtros||'')}`)}
   ${fsec(5,'Solicitud de partes',`<div id="rw-bkparts"></div>`)}
   ${fsec(6,'Planificación y seguimiento',`<div class="g2">${locked?`<label class="block text-xs text-slate-400 font-semibold">Estado<input class="inp mt-1 font-normal" value="${esc((BK_ST[b.status]||{}).l||b.status)}" disabled></label>`:`<label class="block text-xs text-slate-400 font-semibold">Estado<select class="inp mt-1 font-normal" name="status">${BK_OPEN.map(k=>`<option value="${k}" ${k===(b.status||'REGISTRADO')?'selected':''}>${BK_ST[k].l}</option>`).join('')}</select></label>`}${field('rqMain','N° de requerimiento principal',b.rqMain,'placeholder="RQ / SOLPED / OS"')}</div>
     <div class="g2">${field('scheduledDate','Fecha programada',b.scheduledDate,'','date')}${field('cost','Costo estimado ($)',b.cost||'','min="0" step="0.01" inputmode="decimal"','number')}</div>
     <div><div class="flex justify-between items-center gap-2 flex-wrap"><p class="text-xs text-slate-400 font-semibold">Requerimientos de repuestos y servicios</p><div class="flex gap-1"><button type="button" onclick="bkReqAdd('R')" class="btn bg-slate-700 !py-1">＋ Repuesto (RQ)</button><button type="button" onclick="bkReqAdd('S')" class="btn bg-slate-700 !py-1">＋ Servicio (OS)</button></div></div><div id="bk-reqs" class="space-y-2 mt-2"></div></div>`)}
   ${phxBox('bkf','Referencias, fotos y anexos (opcional, hasta 6)',b.photosBefore,b.conFotos!=null?b.conFotos:!!(b.photosBefore||[]).length,true)}
   <p id="bk-err" class="text-xs text-red-400 hidden"></p>${btns('hide()',id?'Guardar cambios':'Registrar backlog')}</form>`,'48rem');
  rwInit('bkparts',b.parts||[],[{k:'np',ph:'N° parte',f:1},{k:'d',ph:'Descripción',f:3},{k:'cant',ph:'Cant.',f:.6,t:'number'},{k:'med',ph:'Medida',f:.8}],3);
  phxRender('bkf');bkReqRender();bkLimPrev();
  const s=document.querySelector('#modal select[name=fleetId]'),h=document.querySelector('#modal input[name=hoursAt]');if(s&&h&&!id)s.onchange=()=>{h.value=eqOf(s.value).hours??''};
}
function bkLimPrev(){const f=document.querySelector('#modal form');if(!f||!$('bk-lim'))return;const pr=(f.querySelector('input[name=criticality]:checked')||{}).value||'MEDIA';$('bk-lim').textContent='Fecha límite: '+fmtD(addDays(f.observationDate.value||today(),PLAZO[pr]))}
function bkReqAdd(t){bkReqT.push({id:uid('R'),type:t,num:'',desc:'',provider:'',reqDate:today(),estDate:'',st:'SOLICITADO'});bkReqRender()}
function bkReqRender(){
  const el=$('bk-reqs');if(!el)return;
  el.innerHTML=bkReqT.length?bkReqT.map((r,i)=>`<div class="bg-slate-900/50 border border-slate-700 rounded-lg p-3 space-y-2"><div class="flex justify-between items-center"><b class="text-xs ${r.type==='S'?'text-violet-300':'text-orange-300'}">${r.type==='S'?'🛠️ Servicio (OS)':'📦 Repuesto (RQ)'}</b><button type="button" onclick="bkReqT.splice(${i},1);bkReqRender()" class="btn bg-red-500/20 !py-1">✕</button></div>
    <div class="g2"><input class="inp" placeholder="N° ${r.type==='S'?'OS':'RQ / SOLPED'}" value="${esc(r.num)}" oninput="bkReqT[${i}].num=this.value"><input class="inp" placeholder="Proveedor" value="${esc(r.provider)}" oninput="bkReqT[${i}].provider=this.value"></div>
    <input class="inp" placeholder="${r.type==='S'?'Servicio requerido':'Repuestos y materiales (ej. Manguera 1/2&quot;, abrazadera 60 mm)'}" value="${esc(r.desc)}" oninput="bkReqT[${i}].desc=this.value">
    <div class="g3"><label class="block text-[11px] text-slate-400">Solicitado<input class="inp" type="date" value="${esc(r.reqDate)}" onchange="bkReqT[${i}].reqDate=this.value"></label><label class="block text-[11px] text-slate-400">Llegada estimada<input class="inp" type="date" value="${esc(r.estDate)}" onchange="bkReqT[${i}].estDate=this.value"></label><label class="block text-[11px] text-slate-400">Estado<select class="inp" onchange="bkReqT[${i}].st=this.value">${Object.keys(RQ_ST).map(k=>`<option value="${k}" ${k===r.st?'selected':''}>${RQ_ST[k].l}</option>`).join('')}</select></label></div></div>`).join('')
   :'<p class="text-xs text-slate-500">Sin requerimientos. Agrega uno si el trabajo necesita repuestos o un servicio de terceros.</p>';
}
async function saveBack(ev,id){
  ev.preventDefault();const F=ev.target,f=Object.fromEntries(new FormData(F)),er=$('bk-err'),old=backlogs.find(x=>x.id===id)||{};
  const bad=m=>{er.textContent=m;er.classList.remove('hidden');er.scrollIntoView({block:'center'})};
  if(!f.system)return bad('Selecciona el sistema.');
  const reqs=bkReqT.filter(r=>String(r.num).trim()||String(r.desc).trim()).map(r=>({...r,num:String(r.num).trim(),desc:String(r.desc).trim(),provider:String(r.provider).trim()}));
  if(reqs.some(r=>!r.num))return bad('Cada requerimiento necesita su N° (RQ, SOLPED u OS).');
  const rrhh={};BK_HR.forEach(k=>{const v=f['rh_'+k];if(v!==''&&v!=null&&Number(v)>0)rrhh[k]=Number(v)});
  const fotOn=phxOn('bkf'),fotos=fotOn?phxGet('bkf').map(p=>p.src):[];
  const n={photosAfter:[],closeDate:'',closeTech:'',closeNotes:'',...old,
    id:id||'BKL-'+Date.now().toString().slice(-7),fleetId:f.fleetId,observationDate:f.observationDate,detectedBy:(f.detectedBy||'').trim(),source:(f.source||'').trim(),hoursAt:f.hoursAt===''?'':Number(f.hoursAt),
    ubic:(f.ubic||'').trim(),proyecto:(f.proyecto||'').trim(),lugarInsp:(f.lugarInsp||'').trim(),respons:f.respons||'COANSA',
    system:f.system,subsystem:(f.subsystem||'').trim(),component:f.component.trim(),sintoma:(f.sintoma||'').trim(),causa:(f.causa||'').trim(),tipoRep:(f.tipoRep||'').trim(),
    description:f.description.trim(),actividad:(f.actividad||'').trim(),obsRec:(f.obsRec||'').trim(),
    criticality:f.criticality||'P2',workType:f.workType||BK_TYPE[0],evento:f.evento||'',condicion:f.condicion||'',needsStop:/parada|detenido|taller/i.test(f.condicion||''),
    durH:f.durH===''?'':Number(f.durH),hh:f.hh===''?'':Number(f.hh),lugarEj:f.lugarEj||'Site',rrhh,eqSop:F.querySelectorAll('input[name=eqSop]:checked').length?[...F.querySelectorAll('input[name=eqSop]:checked')].map(x=>x.value):[],eqOtros:(f.eqOtros||'').trim(),
    parts:rwGet('bkparts'),rqMain:(f.rqMain||'').trim()||(reqs[0]||{}).num||'',scheduledDate:f.scheduledDate||'',cost:Number(f.cost||0),reqs,conFotos:fotOn,photosBefore:fotos,
    status:old.status&&!bkOpen(old)?old.status:(f.status||'REGISTRADO')};
  if(!id||!n.elab)n.elab={name:n.detectedBy,date:n.observationDate,sig:n.detectedBy===me.name?mySig():''};
  else n.elab={...n.elab,name:n.detectedBy,date:n.observationDate,sig:n.detectedBy===n.elab.name?n.elab.sig:(n.detectedBy===me.name?mySig():'')};
  const ch=[];if(!id)ch.push('Backlog registrado por '+(n.detectedBy||me.name));else{if(old.status!==n.status)ch.push('Estado: '+(BK_ST[old.status]||{}).l+' → '+BK_ST[n.status].l);ch.push('Datos del backlog editados');}
  const nr=reqs.filter(r=>!(old.reqs||[]).some(o=>o.id===r.id));nr.forEach(r=>ch.push(`${RQ_T[r.type]} ${r.num} solicitado`));
  n.log=ch.reduce((lg,t)=>bkLog({log:lg},t),old.log||[]);
  if(docBig(n))return bad('El backlog tiene demasiadas fotos o muy pesadas. Quita alguna foto e intenta otra vez.');
  if(!numOf('bk',n.num)){const sb=F.querySelector('button:not([type=button])');if(sb)sb.disabled=true;n.num=(await takeNums('bk'))[0]}
  put('backlogs',n);
  const e=fleet.find(x=>x.id===n.fleetId);if(e&&n.hoursAt!==''&&n.hoursAt>(Number(e.hours)||0))put('fleet',{...e,hours:n.hoursAt});
  if(id&&bkDetId===id)bkDetail(id);else{hide();toast(id?'✔ Backlog actualizado':'✔ Backlog '+n.num+' registrado')}
}
function delBack(id){if(!isAdmin())return;ask('¿Eliminar este backlog? Esta acción no se puede deshacer.',()=>{del('backlogs',id);bkDetId=null})}

/* ---------- Detalle ---------- */
function bkDetail(id,keep){
  const b=backlogs.find(x=>x.id===id);if(!b){bkDetId=null;return}bkDetId=id;
  const box=$('modal').firstElementChild,sc=keep&&box?box.scrollTop:0;
  const e=eqOf(b.fleetId),v=bkVenc(b),open=bkOpen(b),o=b.ot||null;
  const info=(l,x,c)=>`<div><p class="ilab">${l}</p><p class="${c||''}">${x}</p></div>`;
  const ph=a=>(a&&a.length)?a.map(s=>`<img src="${esc(s)}" class="w-24 h-24 object-cover rounded border border-slate-700">`).join(''):'<p class="text-xs text-slate-500">Sin fotos.</p>';
  const moves=open?BK_OPEN.filter(k=>k!==b.status).map(k=>`<button type="button" onclick="bkMove('${b.id}','${k}')" class="mvb"><i style="background:${BK_ST[k].c}"></i>${BK_ST[k].l}</button>`).join(''):'';
  show(`<div id="bkd"><div class="flex justify-between items-center mb-2"><button type="button" onclick="hide();bkDetId=null" class="text-sm text-slate-400">← Volver</button><button type="button" onclick="hide();bkDetId=null" class="text-slate-400 text-xl">✕</button></div>
  <div class="dhero" style="--c:${(BK_ST[b.status]||{}).c||'#334155'}"><p class="mono text-sm text-slate-400">${esc(bkNo(b))}</p><h3 class="text-2xl font-extrabold leading-tight">${esc(b.component)}</h3><p class="text-slate-400">${esc(b.system)}</p>
    <p class="mono text-amber-400 font-semibold mt-1"><button type="button" class="lnk" onclick="openEquip('${e.id||''}')">${esc(e.code)}</button> · ${esc(e.brand)} ${esc(e.model)} · ${esc(e.category||'')}</p>
    <div class="flex gap-1 flex-wrap mt-2">${bkStBadge(b.status)} ${bkPrBadge(b.criticality)} ${v?'<span class="bdg" style="color:#fff;background:#dc2626;border-color:#dc2626">VENCIDO</span>':''}</div>
    <div class="flex gap-2 flex-wrap mt-3">${open&&!o&&isSup()?`<button onclick="openOt('${b.id}')" class="btn bg-amber-500 text-slate-950">＋ Aperturar OT</button>`:''}${open&&(!o||otCanClose(b))?`<button onclick="openClose('${b.id}')" class="btn ${o?'bg-amber-500 text-slate-950':'bg-slate-700'}">📝 ${o?'Cerrar OT con reporte':'Cerrar con reporte'}</button>`:''}${b.status==='PENDIENTE_VALIDACION'&&isSup()?`<button onclick="openValidate('${b.id}')" class="btn bg-violet-500 text-white">🔎 Validar</button>`:''}<button onclick="makePdfBk('${b.id}')" class="btn bg-slate-700">📄 Backlog (PDF)</button>${o?`<button onclick="makePdfOt('${b.id}')" class="btn bg-slate-700">📄 OT (PDF)</button>`:''}${b.repId&&stById(b.repId)?`<button onclick="makePdfRpt('${b.repId}')" class="btn bg-slate-700">📄 Reporte (PDF)</button>`:''}${open||isAdmin()?`<button onclick="openBack('${b.id}')" class="btn bg-slate-700">✏️ Editar</button>`:''}${isAdmin()&&!open&&b.status!=='ANULADO'?`<button onclick="reopen('backlogs','${b.id}')" class="btn bg-slate-700">↩️ Reabrir</button>`:''}${adm(`<button onclick="delBack('${b.id}')" class="btn bg-red-500/20 text-red-400">🗑️ Eliminar</button>`)}</div>
    <div class="igrid mt-4">${info('Detectado',fmtD(b.observationDate)+(b.detectedBy?' · '+esc(b.detectedBy):''))}${info('Fuente',esc(b.source||'—'))}${info('Horómetro / km',b.hoursAt!==''&&b.hoursAt!=null?fmtH(b.hoursAt):'—')}${info('Tipo de backlog',esc(b.workType||'—'))}
      ${info('Evento / ejecución',esc(b.evento||'—'))}${info('Condición / modo',esc(b.condicion||'—'))}${info('Ubicación',esc(b.ubic||'—'))}${info('Proyecto',esc(b.proyecto||'—'))}${info('Responsabilidad',esc(b.respons||'—'))}${info('Sub sistema',esc(b.subsystem||'—'))}${info('Lugar de inspección',esc(b.lugarInsp||'—'))}${info('Lugar de ejecución',esc(b.lugarEj||'—'))}
      ${info('Fecha límite',fmtD(bkLimit(b))+(v?` (vencido ${bkLate(b)} d)`:''),v?'text-red-400':'')}${info('Antigüedad',bkAge(b)+' días')}${info('HH total',b.hh!==''&&b.hh!=null?esc(b.hh):'—')}${info('Duración tarea',b.durH!==''&&b.durH!=null?esc(b.durH)+' h':'—')}
      ${info('N° requerimiento','<span class="mono">'+esc(b.rqMain||'—')+'</span>')}${info('Programado',fmtD(b.scheduledDate))}${b.cost?info('Costo estimado','$ '+Number(b.cost).toLocaleString('es-PE')):''}</div></div>
  ${open?`<div class="dcard"><p class="ilab mb-2">Mover a</p><div class="flex gap-2 flex-wrap items-center">${moves}${isSup()?`<button type="button" onclick="bkAnul('${b.id}')" class="mvb" style="margin-left:auto;color:#94a3b8">⦸ Anular</button>`:''}</div></div>`:''}
  ${b.status==='ANULADO'?`<div class="dcard" style="border-color:#64748b"><b class="text-slate-300">Backlog anulado</b><p class="text-sm text-slate-400">${esc(b.annulNote||'')} · ${esc(b.annulBy||'')} ${fmtD(b.annulDate)}</p>${isAdmin()?`<button onclick="bkMove('${b.id}','REGISTRADO')" class="btn bg-slate-700 !py-1 mt-2">Reactivar</button>`:''}</div>`:''}
  ${(b.rejectNote&&b.status==='EN_EJECUCION')?`<div class="dcard" style="border-color:rgba(239,68,68,.5);background:rgba(239,68,68,.08)"><b class="text-red-400">Devuelto por el supervisor${b.rejectBy?' ('+esc(b.rejectBy)+')':''}</b><p class="text-sm text-slate-300 mt-1">${esc(b.rejectNote)}</p></div>`:''}
  <div class="dgrid"><div class="space-y-3">
   ${otCard(b)}${rpCard(b)}
   <div class="dcard"><p class="ilab">Reporte original (campo)</p><p class="text-sm whitespace-pre-line mt-1">${esc(b.description)}</p>${b.sintoma||b.causa||b.tipoRep?`<div class="igrid mt-3">${info('Síntoma',esc(b.sintoma||'—'))}${info('Causa',esc(b.causa||'—'))}${info('Tipo de reparación',esc(b.tipoRep||'—'))}</div>`:''}${b.actividad?`<p class="ilab mt-3">Actividad realizada (descripción técnica)</p><p class="text-sm whitespace-pre-line">${esc(b.actividad)}</p>`:''}${b.obsRec?`<p class="ilab mt-3">Observaciones / recomendaciones</p><p class="text-sm whitespace-pre-line">${esc(b.obsRec)}</p>`:''}${(b.parts||[]).length?`<p class="ilab mt-3">Solicitud de partes</p>${b.parts.map((r,i)=>`<p class="text-sm">${i+1}. <span class="mono">${esc(r.np||'—')}</span> · ${esc(r.d)} · ${esc(r.cant)} ${esc(r.med)}</p>`).join('')}`:''}</div>
   ${vbCard(b)}
   <div class="dcard"><div class="flex justify-between items-center"><div><p class="font-semibold">Requerimientos de repuestos y servicios</p><p class="text-xs text-slate-400">Actualiza el estado de cada requerimiento</p></div>${open?`<button onclick="openBack('${b.id}')" class="btn bg-slate-700 !py-1">✏️ Editar</button>`:''}</div>
     ${(b.reqs||[]).length?(b.reqs||[]).map(r=>`<div class="bg-slate-900/50 border border-slate-700 rounded-lg p-3 mt-2"><div class="flex justify-between gap-2 flex-wrap"><div class="min-w-0"><span class="text-xs font-bold ${r.type==='S'?'text-violet-300':'text-orange-300'}">${RQ_T[r.type]}</span> <b class="mono">${esc(r.num)}</b><p class="text-sm">${esc(r.desc||'')}${r.provider?' · <span class="text-slate-400">'+esc(r.provider)+'</span>':''}</p><p class="text-xs ${rqLate(r)?'text-red-400':'text-slate-400'}">Solicitado ${fmtD(r.reqDate)} · estimado ${fmtD(r.estDate)}${rqLate(r)?' ⚠':''}</p></div>
       <div class="rqst">${Object.keys(RQ_ST).map(k=>`<button type="button" ${open?`onclick="bkReqSet('${b.id}','${r.id}','${k}')"`:'disabled'} class="${r.st===k?'on':''}" style="--c:${RQ_ST[k].c}">${RQ_ST[k].l}</button>`).join('')}</div></div></div>`).join(''):'<p class="text-xs text-slate-500 mt-2">Sin requerimientos.</p>'}</div>
   <div class="dcard"><p class="font-semibold">Fotos</p><p class="text-xs text-slate-400 mb-2">Referencias del backlog${bkAfter(b).length?' y evidencia del reporte':''}</p><div class="flex flex-wrap gap-2">${ph(b.photosBefore)}</div>${bkAfter(b).length?`<p class="ilab mt-3 mb-1">Reporte de mantenimiento</p><div class="flex flex-wrap gap-2">${ph(bkAfter(b))}</div>`:''}</div>
   ${bkClosed(b)?`<div class="dcard" style="border-color:rgba(16,185,129,.4)"><p class="font-semibold text-emerald-400">Reporte de cierre</p><p class="text-sm mt-1">${fmtD(b.closeDate)} · ${esc(b.closeTech)}${b.closePos?' ('+esc(b.closePos)+')':''}${b.closeHours!=null&&b.closeHours!==''?' · Horómetro '+fmtH(b.closeHours):''}${b.downtimeH?' · '+esc(b.downtimeH)+' h fuera de servicio':''}</p>${b.closeNotes?`<p class="text-sm text-slate-300 mt-1 whitespace-pre-line">${esc(b.closeNotes)}</p>`:''}
     ${b.supName?`<p class="text-sm mt-2"><b class="text-emerald-400">Validado:</b> ${esc(b.supName)}${b.supPos?' ('+esc(b.supPos)+')':''} · ${fmtD(b.supDate)}${b.supNotes?' · '+esc(b.supNotes):''}</p>`:'<p class="text-sm text-violet-300 mt-2">Pendiente de validación del supervisor.</p>'}
     <div class="flex gap-3 flex-wrap mt-2">${b.closeSignature?`<img src="${esc(b.closeSignature)}" style="height:4rem" class="bg-white rounded">`:''}${b.supSignature?`<img src="${esc(b.supSignature)}" style="height:4rem" class="bg-white rounded">`:''}</div></div>`:''}
  </div><div class="dcard"><div class="flex items-center gap-2"><span class="pgic" style="width:2rem;height:2rem;font-size:15px">🕘</span><div><p class="font-semibold">Trazabilidad</p><p class="text-xs text-slate-400">Cada cambio con fecha y usuario</p></div></div>
    <div class="tl mt-3">${[...(b.log||[])].reverse().map(x=>`<div class="tli"><p class="text-sm">${esc(x.t)}</p><p class="text-xs text-slate-400">${new Date(x.ts).toLocaleString('es-PE',{dateStyle:'medium',timeStyle:'short'})} · ${esc(x.by||'')}</p></div>`).join('')||`<div class="tli"><p class="text-sm">Backlog registrado</p><p class="text-xs text-slate-400">${fmtD(b.observationDate)} · ${esc(b.createdBy||b.detectedBy||'')}</p></div>`}</div></div></div></div>`,'64rem');
  const nb=$('modal').firstElementChild;if(nb&&sc)nb.scrollTop=sc;
}
function bkMove(id,k){
  const b=backlogs.find(x=>x.id===id);if(!b||b.status===k)return;
  if(b.status==='ANULADO'&&!isAdmin())return;
  put('backlogs',{...b,status:k,log:bkLog(b,'Estado: '+((BK_ST[b.status]||{}).l||b.status)+' → '+BK_ST[k].l)});
  setTimeout(()=>bkDetail(id,true),60);
}
function bkAnul(id){
  const b=backlogs.find(x=>x.id===id);if(!b||!isSup())return;
  show(`<h3 class="font-bold">⦸ Anular backlog ${esc(bkNo(b))}</h3><p class="text-xs text-slate-400 mb-3">${esc(b.component)} · ${esc(eqOf(b.fleetId).code)}</p><form onsubmit="event.preventDefault();const m=this.m.value.trim();if(!m)return;const b=backlogs.find(x=>x.id==='${id}');put('backlogs',{...b,status:'ANULADO',annulNote:m,annulBy:me.name,annulDate:today(),log:bkLog(b,'Backlog anulado: '+m)});setTimeout(()=>bkDetail('${id}'),60)" class="space-y-3"><label class="block text-xs text-slate-400 font-semibold">Motivo *<textarea name="m" required maxlength="500" rows="2" class="inp mt-1 font-normal" placeholder="Ej. duplicado, ya corregido en el PM, no procede"></textarea></label>${btns(`bkDetail('${id}')`,'Anular','bg-red-500')}</form>`,'30rem');
}
function bkReqSet(id,rid,k){
  const b=backlogs.find(x=>x.id===id);if(!b)return;const r=(b.reqs||[]).find(x=>x.id===rid);if(!r||r.st===k)return;
  const reqs=b.reqs.map(x=>x.id===rid?{...x,st:k,doneDate:k==='ATENDIDO'?today():''}:x);
  put('backlogs',{...b,reqs,log:bkLog(b,`${RQ_T[r.type]} ${r.num}: ${RQ_ST[k].l}`)});
  if(k==='ATENDIDO'&&(b.status==='ESPERA_REPUESTOS'||b.status==='ESPERA_SERVICIO')&&!reqs.some(rqPend))toast('✔ Todos los requerimientos atendidos: ya puedes mover el backlog a Programado');
  if(bkDetId===id&&$('bkd'))setTimeout(()=>bkDetail(id,true),60);else if(cur==='back')renderBack();
}

/* ---------- Repuestos y servicios ---------- */
let rqF={t:'',st:'PEND',q:''};
function rqSet(k,v){rqF[k]=v;renderBack()}
function rqRows(){
  const L=[];backlogs.filter(b=>b.status!=='ANULADO').forEach(b=>(b.reqs||[]).forEach(r=>L.push({b,r})));
  backlogs.filter(b=>bkOpen(b)&&b.rqMain&&!(b.reqs||[]).some(r=>r.num===b.rqMain)&&(b.status==='ESPERA_REPUESTOS'||b.status==='ESPERA_SERVICIO'))
    .forEach(b=>L.push({b,r:{id:'',type:b.status==='ESPERA_SERVICIO'?'S':'R',num:b.rqMain,desc:'',provider:'',reqDate:b.observationDate,estDate:'',st:'SOLICITADO',main:true}}));
  return L;
}
const rqWait=r=>r.reqDate?Math.max(0,dDiff(r.reqDate,r.st==='ATENDIDO'&&r.doneDate?r.doneDate:today())):0;
function rqView(){
  const all=rqRows(),pend=all.filter(x=>bkOpen(x.b)&&rqPend(x.r)),late=pend.filter(x=>rqLate(x.r)),avg=pend.length?Math.round(pend.reduce((t,x)=>t+rqWait(x.r),0)/pend.length*10)/10:0,s=nk(rqF.q);
  const l=all.filter(({b,r})=>(!rqF.t||r.type===rqF.t)&&(rqF.st==='PEND'?bkOpen(b)&&rqPend(r):rqF.st==='LATE'?bkOpen(b)&&rqLate(r):!rqF.st||r.st===rqF.st)&&(!s||[r.num,r.desc,r.provider,b.id,b.num,eqOf(b.fleetId).code,b.component].some(v=>nk(v).includes(s))))
    .sort((a,b)=>rqPend(b.r)-rqPend(a.r)||rqWait(b.r)-rqWait(a.r));
  const o=(v,t,c)=>`<option value="${v}" ${c===v?'selected':''}>${t}</option>`;
  return `<div class="pghead"><div class="flex items-center gap-3"><span class="pgic">📦</span><div><h2 class="text-xl font-bold">Repuestos y servicios</h2><p class="text-xs text-slate-400">Seguimiento de cada N° de requerimiento vinculado a un backlog</p></div></div><button onclick="exportCsv('rq')" class="btn bg-slate-700">📊 Excel</button></div>
  <div class="kgrid">${kpi('Pendientes repuestos',pend.filter(x=>x.r.type==='R').length,'Solicitados sin recibir','#f97316','📦')}${kpi('Pendientes servicios',pend.filter(x=>x.r.type==='S').length,'Terceros / taller','#a855f7','🛠️')}${kpi('Atrasados',late.length,'Pasó la fecha estimada','#ef4444','⏰')}${kpi('Espera promedio',avg+' d','Desde la solicitud','#94a3b8','⌛')}</div>
  <div class="bg-slate-800 border border-slate-700 rounded-xl p-3 bkfilt" style="grid-template-columns:2fr 1fr 1fr"><input class="inp" placeholder="Buscar N°, repuesto, proveedor o equipo…" value="${esc(rqF.q)}" onchange="rqSet('q',this.value)"><select class="inp" onchange="rqSet('t',this.value)">${o('','Repuestos y servicios',rqF.t)}${o('R','Repuestos',rqF.t)}${o('S','Servicios',rqF.t)}</select><select class="inp" onchange="rqSet('st',this.value)">${o('','Todos los estados',rqF.st)}${o('PEND','Solo pendientes',rqF.st)}${Object.keys(RQ_ST).map(k=>o(k,RQ_ST[k].l,rqF.st)).join('')}${o('LATE','Atrasados',rqF.st)}</select></div>
  ${l.length?`<div class="ltw" style="overflow-x:auto"><table class="ltbl"><thead><tr><th>Tipo</th><th>N° requerimiento</th><th>Backlog / equipo</th><th>Proveedor</th><th>Solicitado</th><th>Estimado</th><th>Espera</th><th>Estado</th></tr></thead><tbody>${l.map(({b,r})=>{const e=eqOf(b.fleetId),ed=bkOpen(b)&&r.id;
    return `<tr><td class="nw"><b class="${r.type==='S'?'text-violet-300':'text-orange-300'}">${RQ_T[r.type]}</b></td><td><b class="mono">${esc(r.num)}</b><span class="lsub">${esc(r.desc||(r.main?'N° principal del backlog':''))}</span></td><td><button type="button" class="lnk" onclick="bkDetail('${b.id}')"><b>${esc(e.code)}</b> · ${esc(b.component)}</button><span class="lsub mono">${esc(bkNo(b))} · ${(BK_ST[b.status]||{}).l||''}</span></td><td>${esc(r.provider||'—')}</td><td class="nw">${fmtD(r.reqDate)}</td><td class="nw ${rqLate(r)?'text-red-400 font-semibold':''}">${fmtD(r.estDate)}${rqLate(r)?' ⚠':''}</td><td class="num nw"><b>${rqWait(r)} d</b></td>
     <td>${ed?`<select class="inp" style="min-width:9.5rem;padding:.3rem .5rem;color:${RQ_ST[r.st].c}" onchange="bkReqSet('${b.id}','${r.id}',this.value)">${Object.keys(RQ_ST).map(k=>`<option value="${k}" ${k===r.st?'selected':''}>${RQ_ST[k].l}</option>`).join('')}</select>`:`<span class="bdg" style="color:${RQ_ST[r.st].c};border-color:${RQ_ST[r.st].c}66">${RQ_ST[r.st].l}</span>`}</td></tr>`}).join('')}</tbody></table></div>`:'<p class="text-sm text-slate-500">Sin requerimientos con estos filtros. Se agregan desde el backlog (Editar → Requerimientos).</p>'}`;
}
function kpi(l,v,sub,c,ic,f){return `<${f?'button type="button" onclick="'+f+'"':'div'} class="kpi"><div class="flex justify-between items-start gap-2"><p class="kpi-l">${l}</p><span class="kpi-i" style="color:${c};background:${c}22">${ic}</span></div><p class="kpi-v" style="color:${c}">${v}</p><p class="kpi-s">${sub}</p></${f?'button':'div'}>`}

/* ---------- Órdenes de trabajo (backlogs + preventivos) ---------- */
let otF={q:'',m:'',st:''};
function otSet(k,v){otF[k]=v;renderBack()}
function otRows(){
  const L=backlogs.filter(b=>b.ot&&b.ot.num).map(b=>({num:b.ot.num,date:b.ot.date,fid:b.fleetId,mot:'Backlog',orig:bkNo(b),tech:otTech(b.ot),mine:myOt(b),rp:b.repId&&stById(b.repId)?b.repId:'',motivo:(b.ot.mot||[]).map(FX_MOT_L).join(', ')||b.workType||'Correctivo',st:b.status==='ANULADO'?'Anulada':b.status==='COMPLETADO'?'Cerrada':b.status==='PENDIENTE_VALIDACION'?'Por validar':'Abierta',rep:bkClosed(b)?(b.repNum?b.repNum+' · ':'')+fmtD(b.closeDate)+' · '+(b.closeTech||''):'',pdf:`makePdfOt('${b.id}')`,ver:`bkDetail('${b.id}')`}));
  pms.forEach(p=>L.push({num:pmOt(p),date:p.scheduledDate,fid:p.fleetId,mot:'Preventivo',orig:p.plan,tech:p.resp||'',mine:false,rp:'',motivo:'Preventivo',st:p.status==='COMPLETADO'?'Cerrada':p.status==='PENDIENTE_VALIDACION'?'Por validar':'Abierta',rep:p.execDate?fmtD(p.execDate)+' · '+(p.closeTech||''):'',pdf:`makePdfPm('${p.id}')`,ver:`openDetailPm('${p.id}')`}));
  return L;
}
function otView(){
  const all=otRows(),s=nk(otF.q),C={Abierta:'#f59e0b','Por validar':'#c084fc',Cerrada:'#10b981',Anulada:'#64748b'};
  const l=all.filter(x=>(!otF.m||(otF.m==='MIAS'?x.mine:x.mot===otF.m))&&(!otF.st||x.st===otF.st)&&(!s||[x.num,x.orig,x.tech,eqOf(x.fid).code].some(v=>nk(v).includes(s)))).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||String(b.num).localeCompare(String(a.num)));
  const o=(v,t,c)=>`<option value="${v}" ${c===v?'selected':''}>${t}</option>`;
  return `<div class="pghead"><div class="flex items-center gap-3"><span class="pgic">📄</span><div><h2 class="text-xl font-bold">Órdenes de trabajo</h2><p class="text-xs text-slate-400">${all.length} OT · backlogs y mantenimientos preventivos en un solo lugar</p></div></div>${isSup()?`<button onclick="tab('pm');setTimeout(()=>openPm(),50)" class="btn bg-amber-500 text-slate-950">＋ Nueva OT preventiva</button>`:''}</div>
  <div class="kgrid">${kpi('OT registradas',all.length,'Total','#e2e8f0','📄')}${kpi('Abiertas',all.filter(x=>x.st==='Abierta').length,'En curso','#f59e0b','🔓')}${kpi('Cerradas con reporte',all.filter(x=>x.st==='Cerrada'||x.st==='Por validar').length,'Incluye por validar','#10b981','✅')}${kpi('Desde backlog',all.filter(x=>x.mot==='Backlog').length,all.filter(x=>x.mot==='Preventivo').length+' preventivas','#60a5fa','🔧')}</div>
  <div class="bg-slate-800 border border-slate-700 rounded-xl p-3 bkfilt" style="grid-template-columns:2fr 1fr 1fr"><input class="inp" placeholder="Buscar N° OT, equipo o backlog…" value="${esc(otF.q)}" onchange="otSet('q',this.value)"><select class="inp" onchange="otSet('m',this.value)">${o('','Todos los orígenes',otF.m)}${o('Backlog','Backlog',otF.m)}${o('Preventivo','Preventivo',otF.m)}${o('MIAS','Asignadas a mí',otF.m)}</select><select class="inp" onchange="otSet('st',this.value)">${o('','Todos los estados',otF.st)}${['Abierta','Por validar','Cerrada','Anulada'].map(k=>o(k,k,otF.st)).join('')}</select></div>
  ${l.length?`<div class="ltw" style="overflow-x:auto"><table class="ltbl"><thead><tr><th>N° OT</th><th>Fecha</th><th>Equipo</th><th>Origen</th><th>Motivo</th><th>Asignada a</th><th>Estado</th><th>Reporte</th><th></th></tr></thead><tbody>${l.slice(0,300).map(x=>{const e=eqOf(x.fid);
    return `<tr><td class="nw"><b class="mono">${esc(x.num)}</b></td><td class="nw">${fmtD(x.date)}</td><td class="nw"><b>${esc(e.code)}</b><span class="lsub">${esc(e.category||'')}</span></td><td><span class="lsub" style="color:#cbd5e1">${x.mot}</span><span class="lsub mono">${esc(x.orig)}</span></td><td>${esc(x.motivo)}</td><td class="${x.mine?'text-amber-400 font-semibold':''}">${esc(x.tech||'—')}</td><td><span class="bdg" style="color:${C[x.st]};border-color:${C[x.st]}66">${x.st}</span></td><td class="text-xs text-slate-400">${esc(x.rep||'—')}</td><td><div class="lact"><button onclick="${x.pdf}" class="btn bg-slate-700 !py-1">📄 OT</button>${x.rp?`<button onclick="makePdfRpt('${x.rp}')" class="btn bg-slate-700 !py-1">📄 Reporte</button>`:''}<button onclick="${x.ver}" class="btn bg-slate-700 !py-1">👁️</button></div></td></tr>`}).join('')}</tbody></table></div>`:'<p class="text-sm text-slate-500">Sin órdenes de trabajo. Se aperturan desde el detalle de cada backlog o al programar un preventivo.</p>'}`;
}

/* ---------- Fallas recurrentes (intervenciones del Reporte de paradas + backlogs) ---------- */
let faF={p:6,fa:'',k:'all',w:30};
function faSet(k,v){faF[k]=k==='fa'||k==='k'?v:Number(v);renderBack()}
function falView(){
  const to=today(),from=faF.p?addDays(to,-Math.round(faF.p*30.4)):(sps.map(s=>(s.fp||'').slice(0,10)).filter(Boolean).sort()[0]||to),days=Math.max(1,dDiff(from,to)+1);
  const eqs=fleet.filter(e=>!faF.fa||e.category===faF.fa),ids=new Set(eqs.map(e=>e.id));
  const st=sps.filter(s=>s.status!=='ABIERTA'&&ids.has(s.fleetId)&&(s.fp||'').slice(0,10)>=from&&(s.fp||'').slice(0,10)<=to&&(faF.k==='all'||s.motivo==='MCI'||s.motivo==='MCP'));
  const hrs=Math.round(st.reduce((t,s)=>t+(Number(s.t)||0),0)*10)/10,cal=eqs.length*days*24,n=st.length;
  const disp=cal?Math.round((1-hrs/cal)*1000)/10:0,mttr=n?Math.round(hrs/n*10)/10:0,mtbf=n?Math.round((cal-hrs)/n*10)/10:0;
  // fallas repetitivas: mismo equipo y mismo sistema que vuelve a fallar dentro de la ventana
  const ev=[...st.map(s=>({fid:s.fleetId,sys:stNorm(s.sistema||'—'),d:(s.fp||'').slice(0,10),ref:s.motivo+' '+fmtD((s.fp||'').slice(0,10)),src:'Parada'})),
            ...backlogs.filter(b=>b.status!=='ANULADO'&&ids.has(b.fleetId)&&b.observationDate>=from&&b.observationDate<=to).map(b=>({fid:b.fleetId,sys:stNorm(b.system),d:b.observationDate,ref:b.id+' · '+fmtD(b.observationDate),src:'Backlog',bid:b.id}))];
  const g={};ev.forEach(x=>{(g[x.fid+'|'+x.sys]=g[x.fid+'|'+x.sys]||[]).push(x)});
  const rep=Object.values(g).map(a=>{a.sort((x,y)=>x.d.localeCompare(y.d));const hit=new Set();for(let i=1;i<a.length;i++)if(dDiff(a[i-1].d,a[i].d)<=faF.w){hit.add(a[i-1]);hit.add(a[i])}return [...hit]}).filter(a=>a.length>1)
    .map(a=>({fid:a[0].fid,sys:a[0].sys,n:a.length,ev:a,open:backlogs.some(b=>b.fleetId===a[0].fid&&bkOpen(b)&&stNorm(b.system)===a[0].sys)})).sort((x,y)=>y.n-x.n);
  const byEq=eqs.map(e=>{const s=st.filter(x=>x.fleetId===e.id),h=s.reduce((t,x)=>t+(Number(x.t)||0),0);return{e,n:s.length,h:Math.round(h*10)/10,disp:Math.round((1-h/(days*24))*1000)/10,mttr:s.length?Math.round(h/s.length*10)/10:0}}).filter(x=>x.n).sort((a,b)=>b.h-a.h);
  const bySys={};st.forEach(s=>{const k=s.sistema||'—';bySys[k]=(bySys[k]||0)+(Number(s.t)||0)});
  const sys=Object.entries(bySys).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const o=(v,t,c)=>`<option value="${v}" ${String(c)===String(v)?'selected':''}>${t}</option>`,fams=[...new Set(fleet.map(e=>e.category).filter(Boolean))].sort();
  return `<div class="pghead"><div class="flex items-center gap-3"><span class="pgic">⚠️</span><div><h2 class="text-xl font-bold">Fallas recurrentes</h2><p class="text-xs text-slate-400">Intervenciones cerradas del Reporte de paradas · ${fmtD(from)} al ${fmtD(to)} (${days} días)</p></div></div></div>
  <div class="bg-slate-800 border border-slate-700 rounded-xl p-3 bkfilt" style="grid-template-columns:repeat(4,minmax(0,1fr))"><label class="text-xs text-slate-400">Período<select class="inp mt-1" onchange="faSet('p',this.value)">${o(3,'Últimos 3 meses',faF.p)}${o(6,'Últimos 6 meses',faF.p)}${o(12,'Últimos 12 meses',faF.p)}${o(0,'Todo el historial',faF.p)}</select></label><label class="text-xs text-slate-400">Flota<select class="inp mt-1" onchange="faSet('fa',this.value)">${o('','Todas las flotas',faF.fa)}${fams.map(k=>o(k,k,faF.fa)).join('')}</select></label><label class="text-xs text-slate-400">Intervenciones<select class="inp mt-1" onchange="faSet('k',this.value)">${o('all','Todas (con reporte)',faF.k)}${o('corr','Solo correctivas (MCI/MCP)',faF.k)}</select></label><label class="text-xs text-slate-400">Falla repetitiva si vuelve en<select class="inp mt-1" onchange="faSet('w',this.value)">${[15,30,60,90].map(d=>o(d,'≤ '+d+' días',faF.w)).join('')}</select></label></div>
  <div class="kgrid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">${kpi('Intervenciones cerradas',n,st.filter(s=>s.motivo==='MCI').length+' no planificadas (MCI)','#e2e8f0','🔧')}${kpi('Horas fuera de servicio',fmtH(hrs),eqs.length+' equipos en el cálculo','#f97316','⏱️')}${kpi('Disponibilidad física',disp+' %','1 − horas fuera / horas calendario','#10b981','📈')}${kpi('MTTR',mttr+' h','horas fuera / intervenciones','#60a5fa','🛠️')}${kpi('MTBF flota',Math.round(mtbf/24*10)/10+' d',fmtH(mtbf)+' h calendario entre intervenciones','#2dd4bf','🔁')}${kpi('Fallas repetitivas',rep.length,rep.filter(x=>x.open).length+' con backlog abierto','#ef4444','⚠️')}</div>
  <div class="dcard"><p class="font-semibold">⚠ Fallas repetitivas</p><p class="text-xs text-slate-400 mb-2">Mismo equipo y mismo sistema con otra falla en ≤ ${faF.w} días · revisar causa raíz y acción correctiva</p>
   ${rep.length?`<div class="ltw" style="overflow-x:auto"><table class="ltbl"><thead><tr><th>Equipo</th><th>Sistema</th><th>Veces</th><th>Eventos (fecha)</th><th>Situación</th></tr></thead><tbody>${rep.map(x=>{const e=eqOf(x.fid);return `<tr><td class="nw"><b>${esc(e.code)}</b><span class="lsub">${esc(e.category||'')}</span></td><td>${esc(x.sys)}</td><td class="num"><b class="text-red-400">${x.n}</b></td><td class="text-xs">${x.ev.map(v=>`<span class="lsub">${v.bid?`<button type="button" class="lnk" onclick="bkDetail('${v.bid}')">${esc(v.ref)}</button>`:esc(v.ref)} <span class="text-slate-500">(${v.src})</span></span>`).join('')}</td><td class="nw">${x.open?'<span class="text-amber-400">● Backlog abierto</span>':'<span class="text-slate-400">○ Sin backlog abierto</span>'}</td></tr>`}).join('')}</tbody></table></div>`:'<p class="text-sm text-slate-500">Sin fallas repetitivas en el período. 👍</p>'}</div>
  <div class="dgrid2"><div class="dcard"><p class="font-semibold mb-2">Equipos con más horas fuera de servicio</p>${byEq.length?`<div class="ltw" style="overflow-x:auto"><table class="ltbl"><thead><tr><th>Equipo</th><th>Interv.</th><th>Horas</th><th>Disp.</th><th>MTTR</th></tr></thead><tbody>${byEq.slice(0,12).map(x=>`<tr><td class="nw"><button type="button" class="lnk" onclick="openEquip('${x.e.id}')"><b>${esc(x.e.code)}</b></button><span class="lsub">${esc(x.e.category||'')}</span></td><td class="num">${x.n}</td><td class="num"><b>${fmtH(x.h)}</b></td><td class="num ${x.disp<95?'text-red-400':'text-emerald-400'}">${x.disp} %</td><td class="num">${x.mttr} h</td></tr>`).join('')}</tbody></table></div>`:'<p class="text-sm text-slate-500">Sin intervenciones cerradas en el período.</p>'}</div>
   <div class="dcard"><p class="font-semibold mb-2">Horas fuera de servicio por sistema</p>${sys.length?hbars(sys.map(([k,v])=>({l:k,v:Math.round(v*10)/10})),'#f97316',' h'):'<p class="text-sm text-slate-500">Sin datos.</p>'}</div></div>`;
}

/* ---------- Gráficos (SVG propio, sin librerías) ---------- */
function hbars(items,color,suf){
  const mx=Math.max(1,...items.map(x=>x.v));
  return `<div class="hb">${items.map((x,i)=>`<div class="hb-r"><span class="hb-l" title="${esc(x.l)}">${esc(x.l)}</span><span class="hb-t"><i style="width:${Math.max(2,x.v/mx*100)}%;background:${typeof color==='function'?color(i,x):color}"></i></span><b class="hb-v">${x.v}${suf||''}</b></div>`).join('')}</div>`;
}
function svgPareto(items){
  if(!items.length)return '<p class="text-sm text-slate-500">Sin backlogs en el mes.</p>';
  const W=560,H=230,pl=28,pr=34,pt=10,pb=70,n=items.length,mx=Math.max(...items.map(x=>x.v)),tot=items.reduce((t,x)=>t+x.v,0),bw=(W-pl-pr)/n;
  let acc=0;const pts=items.map((x,i)=>{acc+=x.v;return [pl+bw*i+bw/2,pt+(1-acc/tot)*(H-pt-pb)]});
  const Y=v=>pt+(1-v/mx)*(H-pt-pb);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${[0,.5,1].map(f=>`<line x1="${pl}" x2="${W-pr}" y1="${pt+(1-f)*(H-pt-pb)}" y2="${pt+(1-f)*(H-pt-pb)}" class="gl"/><text x="${pl-4}" y="${pt+(1-f)*(H-pt-pb)+3}" class="ax" text-anchor="end">${Math.round(mx*f)}</text><text x="${W-pr+4}" y="${pt+(1-f)*(H-pt-pb)+3}" class="ax">${f*100}%</text>`).join('')}
   ${items.map((x,i)=>`<rect x="${pl+bw*i+bw*.18}" y="${Y(x.v)}" width="${bw*.64}" height="${H-pb-Y(x.v)}" rx="3" fill="#f59e0b"><title>${esc(x.l)}: ${x.v}</title></rect><text transform="translate(${pl+bw*i+bw/2},${H-pb+10}) rotate(-35)" class="ax" text-anchor="end">${esc(x.l.length>22?x.l.slice(0,21)+'…':x.l)}</text>`).join('')}
   <polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#ef4444" stroke-width="2"/>${pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#fff" stroke="#ef4444" stroke-width="2"/>`).join('')}</svg>`;
}
function svgTrend(ms){
  const W=640,H=240,pl=30,pr=10,pt=12,pb=40,mx=Math.max(4,...ms.flatMap(m=>[m.g,m.c,m.o])),n=ms.length,gw=(W-pl-pr)/n,Y=v=>pt+(1-v/mx)*(H-pt-pb),bw=gw*.26;
  const st=Math.max(1,Math.ceil(mx/4));const ticks=[];for(let v=0;v<=mx;v+=st)ticks.push(v);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${ticks.map(v=>`<line x1="${pl}" x2="${W-pr}" y1="${Y(v)}" y2="${Y(v)}" class="gl"/><text x="${pl-5}" y="${Y(v)+3}" class="ax" text-anchor="end">${v}</text>`).join('')}
   ${ms.map((m,i)=>{const x=pl+gw*i+gw/2;return `<rect x="${x-bw-2}" y="${Y(m.g)}" width="${bw}" height="${H-pb-Y(m.g)}" rx="3" fill="#f59e0b"><title>Generados ${m.g}</title></rect><rect x="${x+2}" y="${Y(m.c)}" width="${bw}" height="${H-pb-Y(m.c)}" rx="3" fill="#22c55e"><title>Cerrados ${m.c}</title></rect><text x="${x}" y="${H-pb+16}" class="ax" text-anchor="middle">${monL(m.m)}</text>`}).join('')}
   <polyline points="${ms.map((m,i)=>(pl+gw*i+gw/2)+','+Y(m.o)).join(' ')}" fill="none" stroke="#60a5fa" stroke-width="2.2"/>${ms.map((m,i)=>`<circle cx="${pl+gw*i+gw/2}" cy="${Y(m.o)}" r="3.5" fill="#60a5fa"><title>Abiertos fin de mes ${m.o}</title></circle>`).join('')}</svg>
   <div class="legend"><span><i style="background:#f59e0b"></i>Generados</span><span><i style="background:#22c55e"></i>Cerrados</span><span><i style="background:#60a5fa;height:3px"></i>Abiertos fin de mes</span></div>`;
}
function svgDonut(parts,center,sub){
  const tot=parts.reduce((t,p)=>t+p.v,0),R=70,r=50,C=2*Math.PI*((R+r)/2);let off=0;
  return `<div class="donut"><svg viewBox="0 0 180 180" width="170" height="170"><circle cx="90" cy="90" r="${(R+r)/2}" fill="none" stroke="#1e293b" stroke-width="${R-r}"/>${tot?parts.filter(p=>p.v).map(p=>{const len=p.v/tot*C,s=`<circle cx="90" cy="90" r="${(R+r)/2}" fill="none" stroke="${p.c}" stroke-width="${R-r}" stroke-dasharray="${len-2} ${C-len+2}" stroke-dashoffset="${-off}" transform="rotate(-90 90 90)"><title>${p.l}: ${p.v}</title></circle>`;off+=len;return s}).join(''):''}<text x="90" y="92" text-anchor="middle" class="dn-v">${center}</text><text x="90" y="112" text-anchor="middle" class="ax">${sub}</text></svg>
  <div class="legend col">${parts.map(p=>`<span><i style="background:${p.c}"></i>${p.l}<b>${p.v}</b></span>`).join('')}</div></div>`;
}
function svgCols(items){
  const W=360,H=210,pl=24,pt=10,pb=28,mx=Math.max(2,...items.map(x=>x.v)),n=items.length,gw=(W-pl)/n,Y=v=>pt+(1-v/mx)*(H-pt-pb);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${[0,.5,1].map(f=>`<line x1="${pl}" x2="${W}" y1="${Y(mx*f)}" y2="${Y(mx*f)}" class="gl"/><text x="${pl-4}" y="${Y(mx*f)+3}" class="ax" text-anchor="end">${Math.round(mx*f)}</text>`).join('')}${items.map((x,i)=>`<rect x="${pl+gw*i+gw*.2}" y="${Y(x.v)}" width="${gw*.6}" height="${H-pb-Y(x.v)}" rx="3" fill="${x.c}"><title>${x.l}: ${x.v}</title></rect><text x="${pl+gw*i+gw/2}" y="${Y(x.v)-4}" class="ax" text-anchor="middle">${x.v}</text><text x="${pl+gw*i+gw/2}" y="${H-pb+15}" class="ax" text-anchor="middle">${x.l}</text>`).join('')}</svg>`;
}

/* ---------- Dashboard de mantenimiento (planner y supervisor) ---------- */
let dashM='';
function dashMon(m){dashM=m;renderDash()}
function dashBk(){
  const M=dashM||(dashM=today().slice(0,7)),open=backlogs.filter(bkOpen),venc=open.filter(bkVenc),hh=Math.round(open.reduce((t,b)=>t+(Number(b.hh)||0),0)*10)/10;
  const live=backlogs.filter(b=>b.status!=='ANULADO'),gen=live.filter(b=>(b.observationDate||'').startsWith(M)),cl=live.filter(b=>bkClosed(b)&&(b.closeDate||'').startsWith(M));
  const inT=cl.filter(b=>b.closeDate<=bkLimit(b)).length,allCl=live.filter(b=>bkClosed(b)&&b.closeDate),avg=allCl.length?Math.round(allCl.reduce((t,b)=>t+Math.max(0,dDiff(b.observationDate,b.closeDate)),0)/allCl.length*10)/10:0;
  const months=[];for(let i=0;i<12;i++)months.push(monAdd(today().slice(0,7),-i));
  // equipo con más fallas del mes
  const byEq={};gen.forEach(b=>{(byEq[b.fleetId]=byEq[b.fleetId]||[]).push(b)});const eqR=Object.entries(byEq).sort((a,b)=>b[1].length-a[1].length);
  const top=eqR[0],te=top?eqOf(top[0]):null,tl=top?top[1]:[];
  const tsys={};tl.forEach(b=>tsys[b.system]=(tsys[b.system]||0)+1);
  // sistema (pareto)
  const bySys={};gen.forEach(b=>bySys[b.system||'—']=(bySys[b.system||'—']||0)+1);const sysR=Object.entries(bySys).sort((a,b)=>b[1]-a[1]);
  const topSys=sysR[0],topSysEq=topSys?[...new Set(gen.filter(b=>b.system===topSys[0]).map(b=>eqOf(b.fleetId).code))]:[];
  // pendientes por repuestos / servicios
  const pend=t=>{const L=[];open.forEach(b=>{(b.reqs||[]).filter(r=>r.type===t&&rqPend(r)).forEach(r=>L.push({b,r}));if(!(b.reqs||[]).some(r=>r.type===t)&&b.rqMain&&b.status===(t==='R'?'ESPERA_REPUESTOS':'ESPERA_SERVICIO'))L.push({b,r:{num:b.rqMain,reqDate:b.observationDate,estDate:'',provider:'',st:'SOLICITADO'}})});return L.sort((a,b)=>rqWait(b.r)-rqWait(a.r))};
  const pR=pend('R'),pS=pend('S');
  const pTbl=(L,c)=>L.length?`<div class="ptbl"><div class="ptr ph"><span>Equipo / backlog</span><span>N° requerimiento</span><span>Espera</span><span>Llegada est.</span></div>${L.slice(0,7).map(({b,r})=>{const e=eqOf(b.fleetId);return `<button type="button" class="ptr" onclick="bkDetail('${b.id}')"><span class="min-w-0"><b class="mono">${esc(e.code)}</b> <span class="text-slate-400">· ${esc(b.component)}</span><small class="mono">${esc(bkNo(b))}${r.provider?' · '+esc(r.provider):''}</small></span><span><span class="chipm">${esc(r.num)}</span></span><b>${rqWait(r)} d</b><span class="${rqLate(r)?'text-red-400 font-semibold':'text-slate-400'}">${fmtD(r.estDate)}${rqLate(r)?' ⚠':''}</span></button>`}).join('')}</div>${L.length>7?`<button onclick="rqF.t='${c}';rqF.st='PEND';bkGo('req')" class="btn bg-slate-700 !py-1 w-full mt-2">Ver los ${L.length}</button>`:''}`:'<p class="text-sm text-slate-500">Nada pendiente. ✅</p>';
  // tendencia
  const trend=[];for(let i=5;i>=0;i--){const m=monAdd(M,-i),me_=monEnd(m);trend.push({m,g:live.filter(b=>(b.observationDate||'').startsWith(m)).length,c:live.filter(b=>bkClosed(b)&&(b.closeDate||'').startsWith(m)).length,o:live.filter(b=>(b.observationDate||'')<=me_&&!(bkClosed(b)&&b.closeDate&&b.closeDate<=me_)).length})}
  const ageB=[['0–7 días',0,7,'#22c55e'],['8–15 días',8,15,'#f59e0b'],['16–30 días',16,30,'#f97316'],['> 30 días',31,1e9,'#ef4444']].map(([l,a,z,c])=>({l,c,v:open.filter(b=>{const d=bkAge(b);return d>=a&&d<=z}).length}));
  const oldest=[...venc].sort((a,b)=>bkAge(b)-bkAge(a)).slice(0,6);
  const ccard=(ic,t,sub,body,more)=>`<div class="dcard"><div class="flex justify-between items-start gap-2 mb-3"><div class="flex items-center gap-2 min-w-0"><span class="pgic" style="width:2.2rem;height:2.2rem;font-size:16px">${ic}</span><div class="min-w-0"><p class="font-semibold">${t}</p><p class="text-xs text-slate-400">${sub}</p></div></div>${more||''}</div>${body}</div>`;
  return `<div class="hero"><div class="min-w-0"><p class="hero-tag">🔧 Mantenimiento de equipos · ${esc(ROLE_N[me.role]||'')}</p><h2 class="hero-t">Control de flota</h2><p class="text-slate-300"><b>${open.length}</b> backlogs abiertos · <b class="text-red-400">${venc.length}</b> vencidos · <b>${hh}</b> HH de trabajo pendiente</p>
     <div class="flex gap-2 flex-wrap mt-3"><button onclick="openBack()" class="btn bg-amber-500 text-slate-950">＋ Registrar backlog</button><button onclick="bkGo('board')" class="btn bg-slate-700">🗂️ Tablero</button><button onclick="quickAdd()" class="btn bg-slate-700">⚡ Registro rápido</button></div></div>
    <div class="monsel"><button type="button" onclick="dashMon('${monAdd(M,-1)}')">‹</button><div><p>Mes de análisis</p><select onchange="dashMon(this.value)">${months.map(m=>`<option value="${m}" ${m===M?'selected':''}>${monL(m)}</option>`).join('')}</select></div><button type="button" ${M>=today().slice(0,7)?'disabled':''} onclick="dashMon('${monAdd(M,1)}')">›</button></div></div>
  <div class="kgrid">${kpi('Abiertos',open.length,open.filter(b=>b.ot&&b.ot.num).length+' con OT · '+open.filter(b=>!(b.ot&&b.ot.num)).length+' sin OT','#60a5fa','📋',"bkGo('list','OPEN')")}${kpi('Vencidos',venc.length,'Fuera de plazo (P1 4d · P2 7d · P3 24d · P4 45d)','#ef4444','⏰',"bkF.venc=true;bkF.st='';bkGo('list')")}${kpi('Espera repuestos',open.filter(b=>b.status==='ESPERA_REPUESTOS').length,'Con N° de requerimiento','#f97316','📦',"bkGo('list','ESPERA_REPUESTOS')")}${kpi('Espera servicio',open.filter(b=>b.status==='ESPERA_SERVICIO').length,'Terceros / taller','#a855f7','🛠️',"bkGo('list','ESPERA_SERVICIO')")}
    ${kpi('Generados '+monL(M),gen.length,'Observaciones del mes','#f59e0b','🔥')}${kpi('Cerrados '+monL(M),cl.length,'Con reporte firmado','#22c55e','✅')}${kpi('Cierre en plazo',cl.length?Math.round(inT/cl.length*100)+'%':'—','Cerrados del mes dentro del plazo','#2dd4bf','🎯')}${kpi('Días prom. de cierre',avg||'—','Detección → cierre (histórico)','#cbd5e1','⏱️')}</div>
  <div class="dgrid2">${ccard('🏆','Equipo con más fallas · '+monL(M),'Backlogs generados en el mes por equipo',top?`<div class="topeq"><div class="topeq-c"><p class="text-xs font-bold text-red-400">#1 DEL MES</p><p class="mono text-xl font-bold"><button type="button" class="lnk" onclick="openEquip('${te.id||''}')">${esc(te.code)}</button></p><p class="text-xs text-slate-400">${esc(te.brand)} ${esc(te.model)} · ${esc(te.category||'')}</p><div class="flex gap-4 mt-2"><div><b class="text-2xl text-red-400">${tl.length}</b><p class="text-[11px] text-slate-400">fallas</p></div><div><b class="text-2xl">${tl.filter(b=>b.criticality==='P1'||b.criticality==='P2').length}</b><p class="text-[11px] text-slate-400">P1 / P2</p></div><div><b class="text-2xl">${tl.filter(bkOpen).length}</b><p class="text-[11px] text-slate-400">abiertos</p></div></div><p class="text-xs text-slate-400 mt-2">Sistemas: ${Object.entries(tsys).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>esc(k)+' ('+v+')').join(', ')}</p></div>${hbars(eqR.slice(0,10).map(([k,v])=>({l:eqOf(k).code,v:v.length})),(i)=>i===0?'#ef4444':i<3?'#f97316':'#64748b')}</div>`:'<p class="text-sm text-slate-500">Sin backlogs generados en el mes.</p>')}
   ${ccard('⚙️','Sistema con más fallas · '+monL(M),'Pareto: barras = fallas, línea = % acumulado',(topSys?`<div class="crit"><span>⚙️</span><div class="min-w-0"><p class="text-xs font-bold text-amber-400">SISTEMA CRÍTICO DEL MES</p><p class="text-lg font-bold">${esc(topSys[0])}</p><p class="text-xs text-slate-400 truncate">${topSys[1]} fallas (${Math.round(topSys[1]/gen.length*100)} % del mes) · equipos: ${esc(topSysEq.slice(0,5).join(', '))}</p></div></div>`:'')+svgPareto(sysR.slice(0,8).map(([l,v])=>({l,v}))))}</div>
  <div class="dgrid2">${ccard('📦','Pendientes por repuestos','Con N° de requerimiento, días en espera y fecha estimada',pTbl(pR,'R'),`<span class="cnt" style="background:#f97316">${pR.length}</span>`)}${ccard('🛠️','Pendientes por servicios','Con N° de requerimiento, días en espera y fecha estimada',pTbl(pS,'S'),`<span class="cnt" style="background:#a855f7">${pS.length}</span>`)}</div>
  <div class="dgrid3a">${ccard('📈','Tendencia de backlogs (6 meses)','Generados vs cerrados por mes y backlogs abiertos al cierre de cada mes',svgTrend(trend))}${ccard('🚨','Abiertos por prioridad','',svgDonut(PR_K.map(k=>({l:PR_L[k],c:PR_C[k],v:open.filter(b=>b.criticality===k).length})),open.length,'abiertos'))}</div>
  <div class="dgrid3">${ccard('📋','Abiertos por estado','Clic para ver la lista',`<div class="space-y-3">${BK_OPEN.map(k=>{const v=open.filter(b=>b.status===k).length;return `<button type="button" class="stbar" onclick="bkGo('list','${k}')"><span class="flex justify-between"><span>${BK_ST[k].l}</span><b>${v}</b></span><span class="stbar-t"><i style="width:${open.length?Math.max(v?4:0,v/open.length*100):0}%;background:${BK_ST[k].c}"></i></span></button>`}).join('')}</div>`)}
   ${ccard('⏳','Antigüedad de abiertos','Días desde la detección',svgCols(ageB))}
   ${ccard('⏰','Vencidos más antiguos','Atender primero',oldest.length?oldest.map(b=>{const e=eqOf(b.fleetId);return `<button type="button" class="oldr" onclick="bkDetail('${b.id}')"><span class="min-w-0"><b class="mono">${esc(e.code)}</b> <span class="text-slate-400">· ${esc(b.component)}</span><small class="mono">${esc(bkNo(b))} · ${fmtD(b.observationDate)}</small></span>${bkPrBadge(b.criticality)}<b class="text-red-400 nw">${bkAge(b)} d</b></button>`}).join(''):'<p class="text-sm text-slate-500">Sin vencidos. ✅</p>',`<button onclick="bkF.venc=true;bkF.st='';bkGo('list')" class="text-sm text-amber-400">Ver todos →</button>`)}</div>`;
}
function dashOther(){
  return `<h3 class="font-semibold text-slate-300" style="margin-top:.75rem">🧰 Otros controles</h3>
  <div class="kgrid">${kpi('Preventivos vencidos',pms.filter(pmOver).length,pms.filter(p=>p.status==='PROGRAMADO'&&!pmOver(p)).length+' programados','#ef4444','🗓️',"tab('pm')")}${kpi('Por validar',backlogs.filter(b=>b.status==='PENDIENTE_VALIDACION').length+pms.filter(p=>p.status==='PENDIENTE_VALIDACION').length,'Backlogs y preventivos','#c084fc','🛡️',"tab('sup')")}${kpi('Engrase vencido',grCount('VENCIDO'),grCount('PROXIMO')+' por vencer','#fbbf24','🛢️',"tab('gr')")}${kpi('Neumáticos a cambiar',trCount('CAMBIO'),trCount('ALERTA')+' en alerta','#fb923c','🛞',"tab('tr')")}</div>
  <div class="dgrid3">${pmUpcomingHtml()}${grDueHtml()}${trDueHtml()}</div><div class="dgrid2">${dashRep()}${dashValidar()}</div>`;
}

/* ---------- PDF: backlogs abiertos para la reunión de planeamiento ---------- */
function bkPdfOpen(){
  const J=window.jspdf&&window.jspdf.jsPDF;if(!J){note('No se pudo cargar el generador de PDF. Revisa tu conexión y recarga la página.');return}
  const l=backlogs.filter(bkOpen).sort((a,b)=>(PLAZO[a.criticality]||9)-(PLAZO[b.criticality]||9)||bkAge(b)-bkAge(a));
  const doc=new J({unit:'mm',format:'a4',orientation:'landscape'}),W=297,M=10,pt=s=>String(s==null?'':s).replace(/[^\x20-\x7E -ÿ\n]/g,'');let y=0;
  doc.setFillColor(15,23,42);doc.rect(0,0,W,20,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(14);doc.text('BACKLOGS ABIERTOS - REUNION DE PLANEAMIENTO',M,9);
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(`${l.length} abiertos · ${l.filter(bkVenc).length} vencidos · emitido ${fmtD(today())}`,M,15);
  const ws=[24,22,48,38,15,26,20,11,20,26,27],hd=['N°','Equipo','Componente','Sistema','Prior.','Estado','Deteccion','Dias','Limite','N° Req.','OT'];y=28;
  const head=()=>{doc.setFillColor(226,232,240);doc.rect(M,y-4.5,W-2*M,6.5,'F');doc.setTextColor(30,41,59);doc.setFont('helvetica','bold');doc.setFontSize(8);let x=M;hd.forEach((h,i)=>{doc.text(h,x+1,y);x+=ws[i]});y+=5;doc.setFont('helvetica','normal')};head();
  l.forEach(b=>{const e=eqOf(b.fleetId),cells=[bkNo(b),e.code,b.component,b.system,PR_L[b.criticality]||'',(BK_ST[b.status]||{}).l||b.status,fmtD(b.observationDate),bkAge(b),fmtD(bkLimit(b)),b.rqMain||'',b.ot?b.ot.num:'Sin OT'].map((c,i)=>doc.splitTextToSize(pt(c),ws[i]-2));
    const n=Math.max(...cells.map(c=>c.length));if(y+n*3.8>196){doc.addPage();y=14;head()}
    let x=M;cells.forEach((c,i)=>{if(i===7&&bkVenc(b))doc.setTextColor(220,38,38);doc.text(c,x+1,y+3);doc.setTextColor(30,41,59);x+=ws[i]});y+=n*3.8+2;doc.setDrawColor(226,232,240);doc.line(M,y-.5,W-M,y-.5)});
  const n=doc.getNumberOfPages();for(let q=1;q<=n;q++){doc.setPage(q);doc.setFontSize(8);doc.setTextColor(100,116,139);doc.text('Pagina '+q+' de '+n,W/2,205,{align:'center'})}
  fileOut(doc.output('blob'),'Backlogs_abiertos_'+today()+'.pdf','📄 Backlogs abiertos listos');
}
