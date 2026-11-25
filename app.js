/* Evita que la app se muestre dentro de un iframe ajeno (clickjacking) */
if(top!==self)top.location=self.location.href;
/* ---------- Utilidades ---------- */
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const day=s=>new Date(s+'T00:00:00');
// días fuera del plazo de su prioridad (Alta 3 d · Media 7 d · Baja 30 d desde la detección): ver backlog.js
function delay(b){return bkLate(b)}
const CRIT={ALTA:'bg-red-500/10 text-red-400 border-red-500/30',MEDIA:'bg-amber-500/10 text-amber-400 border-amber-500/30',BAJA:'bg-blue-500/10 text-blue-400 border-blue-500/30'};
const STL={PENDIENTE:'PENDIENTE',EN_PROCESO:'EN PROCESO',REGISTRADO:'REGISTRADO',PLANIFICADO:'PLANIFICADO',ESPERA_REPUESTOS:'ESPERA REPUESTOS',ESPERA_SERVICIO:'ESPERA SERVICIO',PROGRAMADO:'PROGRAMADO',EN_EJECUCION:'EN EJECUCIÓN',PENDIENTE_VALIDACION:'POR VALIDAR',COMPLETADO:'CERRADO',ANULADO:'ANULADO'};
const stLabel=k=>({PENDIENTE:'Pendiente',EN_PROCESO:'En proceso',REGISTRADO:'Registrado',PLANIFICADO:'Planificado',ESPERA_REPUESTOS:'Espera repuestos',ESPERA_SERVICIO:'Espera servicio',PROGRAMADO:'Programado',EN_EJECUCION:'En ejecucion',PENDIENTE_VALIDACION:'Pendiente por validacion',COMPLETADO:'Cerrado y validado',ANULADO:'Anulado'}[k]||k);
const STAT={PENDIENTE:'bg-amber-500/10 text-amber-400 border-amber-500/30',EN_PROCESO:'bg-blue-500/10 text-blue-400 border-blue-500/30',PENDIENTE_VALIDACION:'bdg-v',COMPLETADO:'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'};
const badge=(m,k)=>`<span class="bdg ${m[k]||''}">${esc(STL[k]||k.replace(/_/g,' '))}</span>`;
function field(n,l,v='',x='',t='text'){return `<label class="block text-xs text-slate-400 font-semibold">${l}<input class="inp mt-1 font-normal" name="${n}" type="${t}" value="${esc(v)}" maxlength="500" ${x}></label>`}
function sel(n,l,o,v){return `<label class="block text-xs text-slate-400 font-semibold">${l}<select class="inp mt-1 font-normal" name="${n}">${o.map(x=>{const [a,b]=Array.isArray(x)?x:[x,x];return `<option value="${esc(a)}" ${a===v?'selected':''}>${esc(b)}</option>`}).join('')}</select></label>`}
function show(h,w){const m=$('modal');m.innerHTML=`<div class="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-4" style="${w?'max-width:'+w:''}">${h}</div>`;m.classList.remove('hidden');m.classList.add('flex');document.body.style.overflow='hidden'}
function hide(){const m=$('modal');m.classList.add('hidden');m.classList.remove('flex');document.body.style.overflow=''}
const btns=(cancel='hide()',ok='Guardar',c='bg-amber-500')=>`<div class="flex justify-end gap-2 pt-3 border-t border-slate-700" style="position:sticky;bottom:-1rem;background:#1e293b;padding-bottom:1rem;margin-top:.75rem;z-index:5"><button type="button" onclick="${cancel}" class="btn bg-slate-700">Cancelar</button><button class="btn ${c} text-slate-950">${ok}</button></div>`;


/* ---------- Avisos propios (alert/confirm del navegador se bloquean en Google Sites) ---------- */
let _yes=null;
function ask(msg,fn,lab='Eliminar',cl='bg-red-500 text-white'){
  _yes=fn;
  show(`<p class="font-semibold mb-4">${esc(msg)}</p><div class="flex justify-end gap-2"><button type="button" onclick="hide()" class="btn bg-slate-700">Cancelar</button><button type="button" onclick="const f=_yes;_yes=null;hide();f&&f()" class="btn ${cl}">${esc(lab)}</button></div>`);
}
function note(msg){
  show(`<p class="mb-4">${esc(msg)}</p><div class="flex justify-end"><button type="button" onclick="hide()" class="btn bg-amber-500 text-slate-950">Entendido</button></div>`);
}

/* ---------- Datos y sincronización ---------- */
let fleet=[],backlogs=[],pms=[],db=null,auth=null,me=null,unsubs=[],usersList=[],cur='dash';
const isAdmin=()=>!!me&&me.role==='admin',isSup=()=>!!me&&(me.role==='supervisor'||me.role==='admin'),adm=h=>isAdmin()?h:'',sup=h=>isSup()?h:'';
const cfg=window.FIREBASE_CONFIG;
try{ if(cfg.apiKey&&!/REEMPLAZA|TU_API_KEY/.test(cfg.apiKey+cfg.appId)){firebase.initializeApp(cfg);auth=firebase.auth();auth.languageCode='es';db=firebase.firestore();try{db.enablePersistence({synchronizeTabs:true}).catch(()=>{})}catch(_){}} }catch(e){console.error(e)}
const lsGet=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch(e){return []}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
function setSync(ok,msg){$('sync').innerHTML=ok?`<span class="text-emerald-400">● ${msg}</span>`:`<span class="text-amber-400">● ${msg}</span>`}
window.addEventListener('offline',()=>{if(db)setSync(false,'Sin conexión: tus cambios se guardarán al reconectar')});
window.addEventListener('online',()=>{if(db)setSync(true,'Reconectado, sincronizando…')});
const SAFE_ID=/^[\w.\-|]*$/,safeDoc=o=>!!o&&['id','fleetId','backlogId','grLogId'].every(k=>o[k]==null||SAFE_ID.test(String(o[k])));
function listen(col,assign){
  if(db){
    unsubs.push(db.collection(col).onSnapshot(s=>{assign(s.docs.map(d=>d.data()).filter(safeDoc));setSync(true,'Sincronizado en la nube');render();loadedCols.add(col);if(col==='backlogs'||col==='preventive'||col==='stops')numSweepSoon()},
      e=>{console.error(e);const m={'permission-denied':'reglas de Firestore sin publicar o incorrectas','not-found':'la base de datos Firestore no está creada','failed-precondition':'la base de datos no está lista o falta crearla','unavailable':'sin conexión o bloqueada por la red','unauthenticated':'las reglas piden inicio de sesión'};setSync(false,'Error ('+(e.code||'desconocido')+'): '+(m[e.code]||'revisa Firebase'))}));
  }else{assign(lsGet(col).filter(safeDoc));setSync(false,'Modo local (sin sincronizar). Configura Firebase')}
}
const getStore=c=>c==='fleet'?fleet:c==='preventive'?pms:c==='grease'?grs:c==='greasePlans'?gpl:c==='tires'?trs:c==='tireParams'?trp:c==='stops'?sps:backlogs;
function setStore(c,a){if(c==='fleet')fleet=a;else if(c==='preventive')pms=a;else if(c==='grease')grs=a;else if(c==='greasePlans')gpl=a;else if(c==='tires')trs=a;else if(c==='tireParams')trp=a;else if(c==='stops')sps=a;else backlogs=a}
// saneo antes de guardar: quita caracteres de control, limita largo y solo acepta imágenes base64 válidas
const IMG_RE=/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
function clean(v){
  if(typeof v==='string'){if(v.startsWith('data:'))return IMG_RE.test(v)&&v.length<1.5e6?v:'';return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'').slice(0,5000)}
  if(Array.isArray(v))return v.map(clean);
  if(v&&Object.getPrototypeOf(v)===Object.prototype){const o={};for(const k in v)if(Object.prototype.hasOwnProperty.call(v,k)&&k!=='__proto__')o[k]=clean(v[k]);return o}
  return typeof v==='number'&&!isFinite(v)?0:v;
}
function put(col,obj){
  obj=clean(obj);if(!safeDoc(obj))return note('Dato no válido, no se guardó.');
  if(me&&me.uid!=='local'){
    const prev=getStore(col).find(x=>x.id===obj.id);
    obj.updatedBy=me.name;obj.updatedAt=Date.now();if(!prev)obj.createdBy=me.name;
    if(obj.status==='PENDIENTE_VALIDACION'&&(!prev||prev.status!=='PENDIENTE_VALIDACION'))obj.closeUid=me.uid;
  }
  if(db)return db.collection(col).doc(obj.id).set(obj).catch(e=>note('No se pudo guardar: '+e.message));
  const a=getStore(col),i=a.findIndex(x=>x.id===obj.id);
  i>=0?a[i]=obj:a.push(obj);lsSet(col,a);render();
}
function putMany(col,list){
  list=list.map(clean).filter(safeDoc);
  if(db){const jobs=[];for(let i=0;i<list.length;i+=400){const b=db.batch();list.slice(i,i+400).forEach(o=>b.set(db.collection(col).doc(o.id),o));jobs.push(b.commit())}
    return Promise.all(jobs).catch(e=>note('No se pudo guardar: '+e.message))}
  const a=getStore(col);list.forEach(o=>{const i=a.findIndex(x=>x.id===o.id);i>=0?a[i]=o:a.push(o)});lsSet(col,a);render();return Promise.resolve();
}
/* ---------- Numeración correlativa automática (BL- backlogs · OT- órdenes de trabajo · RP- reporte de paradas) ---------- */
const NUM={bk:'BL-',ot:'OT-',rp:'RP-'},loadedCols=new Set();
const numOf=(k,s)=>{const m=new RegExp('^'+NUM[k]+'(\\d+)$').exec(String(s||''));return m?+m[1]:0};
const fmtNum=(k,n)=>NUM[k]+String(n).padStart(4,'0');
const bkNo=b=>b?(b.num||b.id):'',pmOt=p=>p?(p.otNum||'OT-P'+String(p.id).replace(/^PM-/,'')):'',spNo=s=>s?(s.num||''):'';
function numMax(k){let n=0;const f=v=>{n=Math.max(n,numOf(k,v))};
  if(k==='bk')backlogs.forEach(b=>f(b.num));else if(k==='rp')sps.forEach(s=>f(s.num));else{backlogs.forEach(b=>f(b.ot&&b.ot.num));pms.forEach(p=>f(p.otNum))}
  return n}
// Reserva `cant` números seguidos. Un contador en Firestore (counters/{tipo}) evita que dos equipos tomen el mismo número;
// sin conexión o sin la regla publicada, continúa desde el mayor número ya registrado.
async function takeNums(k,cant=1){
  let base=numMax(k);
  if(db&&me&&me.uid!=='local'){
    const tx=db.runTransaction(async t=>{const ref=db.collection('counters').doc(k),d=await t.get(ref),n=Math.max(d.exists?Number(d.data().n)||0:0,numMax(k));t.set(ref,{n:n+cant,at:Date.now()});return n});
    try{base=await Promise.race([tx,new Promise((_,r)=>setTimeout(()=>r(new Error('tiempo agotado')),6000))])}catch(e){console.warn('Numeración sin contador:',(e&&e.code)||e)}
  }
  return Array.from({length:cant},(_,i)=>fmtNum(k,base+1+i));
}
// El planner numera lo que aún no tiene número (registros anteriores, importaciones o creados sin conexión), en orden de fecha.
let numBusy=false,numT=null;
function numSweepSoon(){clearTimeout(numT);numT=setTimeout(numSweep,2500)}
async function numSweep(){
  if(numBusy||!isAdmin()||!db||!['backlogs','preventive','stops'].every(c=>loadedCols.has(c)))return;
  const by=f=>(a,b)=>f(a).localeCompare(f(b)),ts=v=>String(Number(v)||0).padStart(15,'0');
  const nb=backlogs.filter(b=>!numOf('bk',b.num)).sort(by(b=>(b.observationDate||'')+'|'+ts(b.log&&b.log[0]&&b.log[0].ts)+'|'+b.id));
  const ns=sps.filter(s=>!numOf('rp',s.num)).sort(by(s=>(s.fp||'')+'|'+ts(s.ts)+'|'+s.id));
  const no=[...backlogs.filter(b=>b.ot&&b.ot.num&&!numOf('ot',b.ot.num)).map(b=>({d:b.ot.date||b.observationDate||'',b})),...pms.filter(p=>!numOf('ot',p.otNum)).map(p=>({d:p.scheduledDate||'',p}))].sort(by(x=>x.d+'|'+(x.b||x.p).id));
  if(!nb.length&&!ns.length&&!no.length)return;
  numBusy=true;
  try{
    const upB={},upP=[];let upS=[];
    if(nb.length){const n=await takeNums('bk',nb.length);nb.forEach((b,i)=>{upB[b.id]={...b,num:n[i]}})}
    if(no.length){const n=await takeNums('ot',no.length);no.forEach((x,i)=>{if(x.b){const o=upB[x.b.id]||x.b;upB[x.b.id]={...o,ot:{...o.ot,num:n[i],numAnt:o.ot.num}}}else upP.push({...x.p,otNum:n[i]})})}
    if(ns.length){const n=await takeNums('rp',ns.length);upS=ns.map((s,i)=>({...s,num:n[i]}))}
    await Promise.all([putMany('backlogs',Object.values(upB)),putMany('preventive',upP),putMany('stops',upS)]);
  }catch(e){console.error('Numeración',e)}finally{numBusy=false}
}
function del(col,id){
  if(db)return db.collection(col).doc(id).delete().catch(e=>note('No se pudo eliminar: '+e.message));
  const a=getStore(col).filter(x=>x.id!==id);setStore(col,a);lsSet(col,a);render();
}

/* ---------- Navegación ---------- */
function tab(t){
  if(t==='tr'){eqnRoute='neumaticos';t='gr'} // Engrase y Neumáticos es un solo apartado
  if($('t-'+t).style.display==='none')t='dash';
  cur=t;
  for(const k of['dash','back','pm','plan','gr','tr','rep','fleet','sup','adm']){
    $('v-'+k).classList.toggle('hidden',k!==t);
    $('t-'+k).className='btn navb '+(k===t?'bg-amber-500 text-slate-950':'text-slate-300 hover:bg-slate-700');
  }
  try{$('t-'+t).scrollIntoView({block:'nearest',inline:'center'})}catch(_){}
  eqnTab(t);navEdge();try{window.scrollTo(0,0)}catch(_){}
  render();
}
// menú inferior del celular: sombra a la derecha mientras queden opciones ocultas
function navEdge(){const n=$('nav');n.classList.toggle('more-r',n.scrollLeft+n.clientWidth<n.scrollWidth-4)}
$('nav').addEventListener('scroll',navEdge,{passive:true});addEventListener('resize',navEdge);
function renderDash(){if(isAdmin())renderDashAdm();else if(isSup())renderDashSup();else renderDashTec()}
function render(){ renderSide();if(bkDetId&&$('bkd')&&!$('modal').classList.contains('hidden'))bkDetail(bkDetId,true);
  if(cur==='dash')renderDash();else if(cur==='back')renderBack();else if(cur==='sup')renderSup();else if(cur==='adm')renderAdm();else if(cur==='gr')renderGr();else if(cur==='tr')renderTr();else if(cur==='pm')renderPm();else if(cur==='plan')renderPlan();else if(cur==='rep')renderRep();else renderFleet(); supBadge() }
function supBadge(){const n=backlogs.filter(b=>b.status==='PENDIENTE_VALIDACION').length+pms.filter(p=>p.status==='PENDIENTE_VALIDACION').length;
  $('t-sup').innerHTML='<span class="ic">🛡️'+(n?`<span class="bdg" style="border-width:1px;background:#7e22ce;color:#fff;border-color:#7e22ce;position:absolute;top:-6px;left:60%;font-size:10px;padding:0 5px;line-height:15px">${n}</span>`:'')+'</span><span class="lbl">Supervisor</span>'}
const eqOf=id=>fleet.find(f=>f.id===id)||{code:'N/A',brand:'Equipo',model:'eliminado',serialNumber:'N/A'};

/* ---------- Dashboard ---------- */
function bars(counts,colors,total){
  return Object.keys(counts).map(k=>{const n=counts[k],p=total?Math.round(n/total*100):0;
    return `<div><div class="flex justify-between text-xs mb-1"><span>${STL[k]||k.replace(/_/g,' ')}</span><span class="text-slate-400">${n} (${p}%)</span></div><div class="bg-slate-900 h-2 rounded-full overflow-hidden"><div class="${colors[k]} h-full" style="width:${p}%"></div></div></div>`}).join('');
}
function renderDashAdm(){$('v-dash').innerHTML=misCard()+dashBk()+dashOther()}

function pmActs(p){return `${p.status==='PROGRAMADO'?`<button onclick="openClosePm('${p.id}')" class="btn bg-emerald-500/20 text-emerald-400 !py-1">✅ Cerrar OT</button>`:''}
      <button onclick="makePdfPm('${p.id}')" title="Orden de trabajo PDF" class="btn bg-slate-700 !py-1">📄 OT</button><button onclick="openDetailPm('${p.id}')" class="btn bg-slate-700 !py-1">👁️</button>${sup(`<button onclick="openPm('${p.id}')" class="btn bg-slate-700 !py-1">✏️</button>`)}${(isAdmin()&&(p.status==='COMPLETADO'||p.status==='PENDIENTE_VALIDACION'))?`<button onclick="reopen('preventive','${p.id}')" title="Reabrir" class="btn bg-slate-700 !py-1">↩️</button>`:''}${adm(`<button onclick="delPm('${p.id}')" class="btn bg-red-500/20 !py-1">🗑️</button>`)}`}
function fleetActs(e){return `<button onclick="openEquip('${e.id}')" class="btn bg-amber-500/20 text-amber-400 !py-1">📋 Ficha</button>${adm(`<button onclick="openFleet('${e.id}')" class="btn bg-slate-700 !py-1">✏️</button><button onclick="delFleet('${e.id}')" class="btn bg-red-500/20 !py-1">🗑️</button>`)}`}

/* ---------- Vista de tabla (solo laptop, ≥1024 px) ---------- */
function lapTbl(head,rows,empty){return rows.length?`<div class="ltw"><table class="ltbl"><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`:`<p class="text-slate-500 text-sm">${empty}</p>`}
function tblPm(l){$('tbl-pm').innerHTML=lapTbl(['Código','Equipo','Plan','Programado','Situación','Responsable','Actividades','Estado','Acciones'],l.map(p=>{const e=eqOf(p.fleetId),k=pmKey(p),a=actStats(p.acts);
  return `<tr><td><b class="text-amber-400">${esc(pmOt(p))}</b></td><td><b>${esc(e.code)}</b><span class="lsub">${esc(e.brand)} ${esc(e.model)}</span></td><td class="font-semibold">${esc(p.plan)}${(p.rejectNote&&p.status==='PROGRAMADO')?`<span class="lsub text-red-400">⚠️ Devuelto: ${esc(p.rejectNote)}</span>`:''}</td><td class="nw">${fmtD(p.scheduledDate)}${p.scheduledHours!==''&&p.scheduledHours!=null?`<span class="lsub">a las ${fmtH(p.scheduledHours)}</span>`:''}</td><td class="${k==='VENCIDO'?'text-red-400 font-semibold':'text-slate-400'}">${p.status==='PROGRAMADO'?pmWhen(p):'—'}</td><td>${esc(p.responsible||'—')}</td><td class="nw text-slate-400">${p.acts?`${RES_ICO.OK} ${a.OK} · ${RES_ICO.OBS} ${a.OBS} · ${RES_ICO.NA} ${a.NA}`:`${(p.plannedActs||[]).length} programadas`}</td><td>${pmBadge(k)}</td><td><div class="lact">${pmActs(p)}</div></td></tr>`}),'Sin preventivos.')}
function tblFleet(l){const sc={OPERATIVO:'text-emerald-400',INOPERATIVO:'text-red-400',EN_MANTENIMIENTO:'text-amber-400'};
  $('tbl-fleet').innerHTML=lapTbl(['Código','Equipo','Categoría','Nº de serie','Horómetro','Ubicación','Estado','Backlogs','Preventivos','Acciones'],l.map(e=>{const n=backlogs.filter(b=>b.fleetId===e.id&&bkOpen(b)).length,pn=pms.filter(p=>p.fleetId===e.id&&p.status!=='COMPLETADO').length;
  return `<tr><td><b class="text-amber-400">${esc(e.code)}</b></td><td><button type="button" onclick="openEquip('${e.id}')" class="font-semibold lnk">${esc(e.brand)} ${esc(e.model)}</button></td><td>${esc(e.category)}</td><td class="text-slate-400">${esc(e.serialNumber)}</td><td class="nw num">${esc(e.hours)} h</td><td>${esc(e.location||'-')}</td><td class="nw font-semibold ${sc[e.status]||''}">${esc(String(e.status||'').replace('_',' '))}</td><td class="num"><b class="${n?'text-amber-400':'text-slate-500'}">${n}</b></td><td class="num"><b class="${pn?'text-blue-400':'text-slate-500'}">${pn}</b></td><td><div class="lact">${fleetActs(e)}</div></td></tr>`}),'Sin equipos registrados.')}

/* ---------- Apartados donde aparece cada equipo ---------- */
const MODS=[['bk','🔧 Backlogs'],['pm','🗓️ Preventivos'],['gr','🛢️ Engrase'],['tr','🛞 Neumáticos'],['st','🛑 Paradas / intervenciones']];
const MODN=k=>((MODS.find(m=>m[0]===k)||[])[1]||k).replace(/^\S+\s/,'');
const inMod=(e,k)=>!!e&&!(Array.isArray(e.off)&&e.off.includes(k));
const fleetIn=(k,keep)=>fleet.filter(e=>inMod(e,k)||(keep&&e.id===keep));
function modOff(fid,k){
  if(!isAdmin())return;const e=fleet.find(x=>x.id===fid);if(!e)return;
  ask(`¿Quitar ${esc(e.code)} del apartado ${esc(MODN(k))}? Su historial no se borra; puedes volver a agregarlo desde "🧩 Equipos" o editando el equipo.`,()=>{put('fleet',{...e,off:[...new Set([...(e.off||[]),k])]});if(k==='tr'&&trFid===fid)trFid=''},'Quitar','bg-red-500 text-white');
}
function openModEq(k){
  if(!isAdmin())return;if(!fleet.length){note('Primero registra equipos en la pestaña Flota.');return}
  const l=[...fleet].sort((a,b)=>String(a.code).localeCompare(String(b.code)));
  show(`<div class="flex justify-between items-start"><div><h3 class="font-bold">🧩 Equipos en ${esc(MODN(k))}</h3><p class="text-xs text-slate-400">Desmarca los equipos que no aplican a este apartado. No se borra ningún registro: solo dejan de aparecer aquí.</p></div><button type="button" onclick="hide()" class="text-slate-400 text-xl">✕</button></div>
  <form onsubmit="saveModEq(event,'${k}')" class="space-y-3 mt-3"><input class="inp" placeholder="Buscar equipo…" oninput="const q=this.value.toLowerCase();document.querySelectorAll('#mod-l label').forEach(r=>r.style.display=r.textContent.toLowerCase().includes(q)?'':'none')">
  <div class="flex gap-2"><button type="button" onclick="document.querySelectorAll('#mod-l input').forEach(i=>{if(i.closest('label').style.display!=='none')i.checked=true})" class="btn bg-slate-700 !py-1">Marcar todos</button><button type="button" onclick="document.querySelectorAll('#mod-l input').forEach(i=>{if(i.closest('label').style.display!=='none')i.checked=false})" class="btn bg-slate-700 !py-1">Desmarcar todos</button></div>
  <div id="mod-l" class="space-y-1" style="max-height:50vh;overflow-y:auto">${l.map(e=>`<label class="flex items-center gap-2 text-sm bg-slate-900/50 border border-slate-700 rounded-lg p-2"><input type="checkbox" name="${e.id}" ${inMod(e,k)?'checked':''}><b class="text-amber-400">${esc(e.code)}</b> <span class="text-slate-300 truncate">${esc(e.brand)} ${esc(e.model)} · ${esc(e.category)}</span></label>`).join('')}</div>${btns()}</form>`,'32rem');
}
function saveModEq(ev,k){
  ev.preventDefault();if(!isAdmin())return;const on=new Set(new FormData(ev.target).keys());let n=0;
  fleet.forEach(e=>{const want=on.has(e.id);if(want===inMod(e,k))return;const off=(e.off||[]).filter(x=>x!==k);if(!want)off.push(k);put('fleet',{...e,off});n++});
  hide();if(n)toast(`✅ ${n} equipo(s) actualizados en ${MODN(k)}`);
}
const offTxt=e=>(e.off||[]).length?`<p class="text-[11px] text-slate-500 mt-1">No aparece en: ${e.off.map(k=>esc(MODN(k))).join(', ')}</p>`:'';

/* ---------- Flota ---------- */
const FLEET_CATS=['Excavadora','Cargador Frontal','Tractor de Oruga','Camión Minero','Motoniveladora','Perforadora','Volquete','Cisterna de Agua','Minibús','Camioneta','Grupo Electrógeno','Luminaria','Zaranda Móvil','Compresora','Chancadora'];
function renderFleet(){
  const s=$('qf').value.toLowerCase();
  const l=fleet.filter(e=>[e.code,e.brand,e.model,e.serialNumber].some(v=>String(v||'').toLowerCase().includes(s)));
  const sc={OPERATIVO:'text-emerald-400',INOPERATIVO:'text-red-400',EN_MANTENIMIENTO:'text-amber-400'};
  $('list-fleet').innerHTML=l.map(e=>{
    const n=backlogs.filter(b=>b.fleetId===e.id&&bkOpen(b)).length,pn=pms.filter(p=>p.fleetId===e.id&&p.status!=='COMPLETADO').length;
    return `<div class="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div class="flex justify-between mb-2"><span class="bdg bg-amber-500/10 text-amber-400 border-amber-500/30">${esc(e.code)}</span><span class="text-xs font-semibold ${sc[e.status]||''}">${esc(e.status.replace('_',' '))}</span></div>
      <h4 class="font-bold" style="cursor:pointer" onclick="openEquip('${e.id}')">${esc(e.brand)} ${esc(e.model)}</h4>
      <p class="text-xs text-slate-400">${esc(e.category)} · S/N: ${esc(e.serialNumber)}</p>${offTxt(e)}
      <div class="grid grid-cols-2 gap-2 mt-3 text-xs bg-slate-900/60 p-2 rounded-lg"><div><span class="text-slate-500 block">Horómetro</span>${esc(e.hours)} h</div><div><span class="text-slate-500 block">Ubicación</span>${esc(e.location||'-')}</div></div>
      <div class="mt-3 pt-3 border-t border-slate-700 flex justify-between items-center text-xs"><span class="text-slate-400">Backlogs: <b class="text-amber-400">${n}</b> · Preventivos: <b class="text-blue-400">${pn}</b></span>
      <span class="flex gap-1">${fleetActs(e)}</span></div></div>`}).join('')||'<p class="text-slate-500 text-sm">Sin equipos registrados.</p>';
  tblFleet(l);
}
function openFleet(id){if(!isAdmin())return;
  const e=fleet.find(x=>x.id===id)||{};
  show(`<h3 class="font-bold mb-3">${id?'Editar equipo':'Registrar equipo'}</h3>
  <form onsubmit="saveFleet(event,'${id||''}')" class="space-y-3">
    <div class="grid grid-cols-2 gap-3">${field('code','Código *',e.code,'required placeholder="EX-01"')}${field('brand','Marca *',e.brand,'required')}
    ${field('model','Modelo *',e.model,'required')}${field('serialNumber','Nº de serie *',e.serialNumber,'required')}
    ${sel('category','Categoría',FLEET_CATS.includes(e.category)||!e.category?FLEET_CATS:FLEET_CATS.concat([e.category]),e.category)}
    ${field('plate','Placa',e.plate||'','placeholder="Opcional"')}${field('year','Año',e.year||'','min="1950" max="2100" placeholder="Opcional"','number')}${field('provider','Proveedor',e.provider||'','placeholder="Opcional"')}${field('project','Proyecto',e.project||'','placeholder="Opcional"')}${field('hours','Horómetro / Odómetro',e.hours??0,'min="0"','number')}${field('location','Ubicación / Frente',e.location)}
    ${sel('status','Estado operativo',[['OPERATIVO','Operativo'],['INOPERATIVO','Inoperativo'],['EN_MANTENIMIENTO','En mantenimiento']],e.status)}</div>
    <div><p class="text-xs text-slate-400 font-semibold mb-1">Apartados donde aparece este equipo</p><div class="grid grid-cols-2 gap-1">${MODS.map(([k,l])=>`<label class="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" name="mod_${k}" ${inMod(e.id?e:{},k)?'checked':''}> ${l}</label>`).join('')}</div></div>${btns()}</form>`);
}
function saveFleet(ev,id){
  ev.preventDefault();const f=Object.fromEntries(new FormData(ev.target)),old=fleet.find(x=>x.id===id)||{},off=MODS.map(m=>m[0]).filter(k=>!f['mod_'+k]);
  MODS.forEach(m=>delete f['mod_'+m[0]]);
  put('fleet',{...old,...f,id:id||uid('F'),code:f.code.trim().toUpperCase(),hours:Number(f.hours||0),off});hide();
}
function delFleet(id){if(!isAdmin())return;
  const n=backlogs.filter(b=>b.fleetId===id).length+pms.filter(p=>p.fleetId===id).length;
  ask(n?`Este equipo tiene ${n} registro(s) asociados (backlogs o preventivos). ¿Eliminar de todos modos?`:'¿Eliminar este equipo?',()=>del('fleet',id));
}

/* ---------- Borrar todos los equipos (solo planner) ---------- */
function openFleetDelAll(){if(!isAdmin())return;
  if(!fleet.length){note('No hay equipos registrados.');return}
  const ids=new Set(fleet.map(e=>e.id)),n=backlogs.filter(b=>ids.has(b.fleetId)).length+pms.filter(p=>ids.has(p.fleetId)).length;
  show(`<h3 class="font-bold mb-2 text-red-400">🗑️ Borrar todos los equipos</h3>
  <p class="text-sm text-slate-300">Se eliminarán los <b>${fleet.length}</b> equipo(s) de la flota. Esta acción no se puede deshacer.</p>
  ${n?`<p class="text-xs text-amber-400 mt-2">⚠️ Hay ${n} registro(s) asociados (backlogs o preventivos). No se borran, pero quedarán sin equipo.</p>`:''}
  <p class="text-xs text-slate-400 mt-2">Te recomendamos descargar antes un <button type="button" onclick="exportJson()" class="lnk text-amber-400">💾 respaldo completo</button>.</p>
  <label class="block text-xs text-slate-400 mt-3">Escribe <b class="text-red-400">BORRAR</b> para confirmar</label>
  <input id="fdel-txt" class="inp mt-1" autocomplete="off" oninput="const b=$('fdel-go'),ok=this.value.trim().toUpperCase()==='BORRAR';b.disabled=!ok;b.style.opacity=ok?'1':'.5'">
  <div class="flex justify-end gap-2 pt-3 border-t border-slate-700 mt-3"><button type="button" onclick="hide()" class="btn bg-slate-700">Cancelar</button><button id="fdel-go" type="button" onclick="doFleetDelAll()" class="btn bg-red-500 text-white" disabled style="opacity:.5">Borrar ${fleet.length} equipo(s)</button></div>`);
}
function doFleetDelAll(){if(!isAdmin())return;
  if(($('fdel-txt')||{}).value?.trim().toUpperCase()!=='BORRAR')return;
  const ids=fleet.map(e=>e.id),n=ids.length;hide();
  if(db){const jobs=[];for(let i=0;i<ids.length;i+=400){const b=db.batch();ids.slice(i,i+400).forEach(id=>b.delete(db.collection('fleet').doc(id)));jobs.push(b.commit())}
    return Promise.all(jobs).then(()=>note(`Se eliminaron ${n} equipo(s).`)).catch(e=>note('No se pudo eliminar: '+e.message))}
  setStore('fleet',[]);lsSet('fleet',[]);render();note(`Se eliminaron ${n} equipo(s).`);
}

/* ---------- Importar equipos a la flota (CSV o Excel) ---------- */
let fImp=[];
const FST={OPERATIVO:'OPERATIVO',INOPERATIVO:'INOPERATIVO',ENMANTENIMIENTO:'EN_MANTENIMIENTO',MANTENIMIENTO:'EN_MANTENIMIENTO',ENREPARACION:'EN_MANTENIMIENTO',DISPONIBLE:'OPERATIVO',ACTIVO:'OPERATIVO',INACTIVO:'INOPERATIVO',DETENIDO:'INOPERATIVO',PARADO:'INOPERATIVO'};
function openFleetImport(){if(!isAdmin())return;
  fImp=[];
  show(`<h3 class="font-bold mb-1">📥 Importar equipos a la flota</h3>
  <p class="text-xs text-slate-400 mb-3">Sube un Excel (<b>.xlsx</b>) o un <b>CSV</b> con una fila por equipo. La primera fila debe tener los encabezados.</p>
  <div class="bg-slate-900 p-3 rounded-lg text-xs text-slate-300 space-y-1"><p>Columnas de la plantilla: <b>ITEM</b>, <b>FLOTA</b>, <b class="text-amber-400">CÓDIGO INTERNO</b> *, <b>PLACA</b>, <b>SERIE DEL EQUIPO</b>, <b class="text-amber-400">MODELO</b> *, <b class="text-amber-400">MARCA</b> *, <b>AÑO</b>, <b>PROVEEDOR</b>, <b>PROYECTO</b></p>
  <p class="text-slate-400">* obligatorias. ITEM es solo numeración y se ignora. Opcionales extra: HORÓMETRO, UBICACIÓN, ESTADO (Operativo, Inoperativo o En mantenimiento).</p>
  <p class="text-slate-400">Flotas: ${FLEET_CATS.map(esc).join(', ')}.</p></div>
  <label class="flex items-center gap-2 text-xs text-slate-300 mt-3"><input type="checkbox" id="fimp-upd" onchange="fImpFile&&readFleetImport()"> Actualizar los equipos que ya existen (mismo código). Si no, se omiten.</label>
  <div class="grid gap-2 mt-3"><button type="button" onclick="fleetTpl(this)" class="btn bg-slate-700">⬇️ Descargar plantilla (Excel)</button>
  <input type="file" accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onchange="fImpFile=this.files[0]||null;readFleetImport()"></div>
  <div id="fimp-out" class="mt-3"></div>
  <div class="flex justify-end gap-2 pt-3 border-t border-slate-700 mt-3"><button type="button" onclick="hide();fImp=[];fImpFile=null" class="btn bg-slate-700">Cerrar</button><button id="fimp-go" type="button" onclick="doFleetImport()" class="btn bg-amber-500 text-slate-950" disabled style="opacity:.5">Importar</button></div>`,'34rem');
}
let fImpFile=null;
const FTPL_H=['ITEM','FLOTA','CÓDIGO INTERNO','PLACA','SERIE DEL EQUIPO','MODELO','MARCA','AÑO','PROVEEDOR','PROYECTO'];
async function fleetTpl(btn){
  const t=btn&&btn.textContent;if(btn){btn.disabled=true;btn.textContent='Generando…'}
  try{await loadXL();const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('Equipos');
    ws.columns=FTPL_H.map((h,i)=>({header:h,width:[7,16,16,12,26,16,16,8,16,18][i]}));
    ws.addRow([1,'Camioneta','CA-IF-01','P4Y-920','8AJKA3CD5R3119825','Hilux','Toyota',2024,'IF','Transporte']);
    const bd={style:'thin',color:{argb:'FF000000'}},B={top:bd,left:bd,bottom:bd,right:bd};
    ws.getRow(1).eachCell(c=>{c.font={bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF000000'}};c.alignment={horizontal:'center',vertical:'middle',wrapText:true};c.border=B});
    ws.getRow(1).height=30;
    for(let r=2;r<=200;r++)for(let c=1;c<=FTPL_H.length;c++){const x=ws.getCell(r,c);x.border=B;x.alignment={horizontal:'center'};if(r===2)x.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF92D050'}}}
    ws.autoFilter={from:'A1',to:{row:1,column:FTPL_H.length}};ws.views=[{state:'frozen',ySplit:1}];
    ws.getColumn(3).numFmt='@';ws.getColumn(4).numFmt='@';ws.getColumn(5).numFmt='@';
    const buf=await wb.xlsx.writeBuffer(),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));a.download='plantilla_equipos.xlsx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  }catch(e){note('No se pudo generar la plantilla: '+(e.message||e))}
  finally{if(btn){btn.disabled=false;btn.textContent=t}}
}
async function fleetImportRows(f){
  if(/\.xlsx$/i.test(f.name)){
    if(f.size>10e6)throw new Error('El Excel pesa más de 10 MB.');
    const xb=await f.arrayBuffer(),sg=new Uint8Array(xb,0,4);if(sg[0]!==0x50||sg[1]!==0x4B)throw new Error('El archivo no es un Excel válido.');
    await loadXL();const wb=new ExcelJS.Workbook();await wb.xlsx.load(xb);const ws=wb.worksheets[0];if(!ws)throw new Error('El archivo no tiene hojas.');
    const cv=v=>{if(v==null)return '';if(v instanceof Date)return v.toISOString().slice(0,10);if(typeof v==='object'){if(v.result!==undefined)return cv(v.result);if(v.richText)return v.richText.map(x=>x.text).join('');if(v.text!=null)return String(v.text);return ''}return String(v)};
    const rows=[];ws.eachRow({includeEmpty:false},row=>{const r=[];row.eachCell({includeEmpty:true},(c,i)=>{r[i-1]=cv(c.value)});for(let i=0;i<r.length;i++)if(r[i]==null)r[i]='';if(r.some(x=>String(x).trim()!==''))rows.push(r)});return rows;
  }
  if(!/\.(csv|txt)$/i.test(f.name)||f.size>5e6)throw new Error('Solo archivos .xlsx, .csv o .txt (CSV hasta 5 MB).');
  const buf=await f.arrayBuffer();let txt;try{txt=new TextDecoder('utf-8',{fatal:true}).decode(buf)}catch(_){txt=new TextDecoder('windows-1252').decode(buf)}
  return parseCsv(txt);
}
async function readFleetImport(){
  const f=fImpFile,out=$('fimp-out'),go=$('fimp-go');if(!f||!out)return;go.disabled=true;go.style.opacity='.5';go.textContent='Importar';fImp=[];
  out.innerHTML='<p class="text-xs text-slate-400">Leyendo archivo…</p>';
  let rows;try{rows=await fleetImportRows(f)}catch(e){out.innerHTML=`<p class="text-xs text-red-400">${esc(e.message||String(e))}</p>`;return}
  if(rows.length<2){out.innerHTML='<p class="text-xs text-red-400">El archivo no tiene datos: necesita una fila de encabezados y al menos un equipo.</p>';return}
  const hd=rows[0].map(nk),col=n=>{for(const k of n){const i=hd.indexOf(k);if(i>=0)return i}return -1};
  const ix={code:col(['codigointerno','codigo','code','codigoequipo','equipo','codequipo','cod','unidad']),plate:col(['placa','plate','nplaca','nroplaca']),year:col(['ano','anio','year','anofabricacion','anodefabricacion']),prov:col(['proveedor','provider','supplier','empresa','contratista']),proj:col(['proyecto','project','obra']),brand:col(['marca','brand','fabricante']),model:col(['modelo','model']),
    serial:col(['seriedelequipo','serieequipo','serie','nserie','nroserie','numerodeserie','numeroserie','sn','serial','serialnumber','vin','chasis']),cat:col(['categoria','category','tipo','tipoequipo','tipodeequipo','flota','clase']),
    hours:col(['horometro','horometroodometro','odometro','horas','hours','kilometraje','km']),loc:col(['ubicacion','ubicacionfrente','frente','location','lugar']),st:col(['estado','status','estadooperativo','condicion'])};
  if(ix.code<0||ix.brand<0||ix.model<0){out.innerHTML='<p class="text-xs text-red-400">Faltan columnas obligatorias. Usa los encabezados: CÓDIGO INTERNO, MARCA, MODELO (descarga la plantilla).</p>';return}
  const upd=!!($('fimp-upd')&&$('fimp-upd').checked),byCode={};fleet.forEach(e=>byCode[String(e.code).trim().toUpperCase()]=e);
  const catOf=v=>{const k=nk(v);if(!k)return '';return FLEET_CATS.find(c=>nk(c)===k)||FLEET_CATS.find(c=>nk(c).startsWith(k)||k.startsWith(nk(c)))||String(v).trim()};
  const ok=[],bad=[],seen={},warn=[];let nNew=0,nUpd=0,skip=0;
  rows.slice(1).forEach((r,n)=>{const line=n+2,g=i=>i<0?'':String(r[i]??'').trim();
    const code=g(ix.code).toUpperCase().replace(/\s+/g,' ');
    if(!code){bad.push(`Fila ${line}: falta el código`);return}
    if(code.length>40){bad.push(`Fila ${line}: código demasiado largo`);return}
    if(seen[code]){bad.push(`Fila ${line}: el código ${code} está repetido en el archivo (fila ${seen[code]})`);return}seen[code]=line;
    const old=byCode[code];if(old&&!upd){skip++;return}
    const brand=g(ix.brand),model=g(ix.model);
    if(!brand||!model){bad.push(`Fila ${line} (${code}): falta ${!brand?'la marca':'el modelo'}`);return}
    const hs=g(ix.hours).replace(/\s/g,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.');let hours=hs===''?null:Number(hs);
    if(hours!==null&&(isNaN(hours)||hours<0)){warn.push(`Fila ${line} (${code}): horómetro "${g(ix.hours)}" no válido, se deja ${old?'el actual':'en 0'}`);hours=null}
    const stRaw=g(ix.st);let status=stRaw?FST[nk(stRaw).toUpperCase()]:null;
    if(stRaw&&!status)warn.push(`Fila ${line} (${code}): estado "${stRaw}" no reconocido, se usa ${old?'el actual':'Operativo'}`);
    const cat=catOf(g(ix.cat));if(cat&&!FLEET_CATS.includes(cat))warn.push(`Fila ${line} (${code}): categoría "${cat}" no está en la lista estándar (se guarda igual)`);
    let year=g(ix.year).replace(/\.0+$/,'');if(year&&!/^(19|20)\d{2}$/.test(year)){warn.push(`Fila ${line} (${code}): año "${year}" no válido, se omite`);year=''}
    const base=old||{id:uid('F'),hours:0,status:'OPERATIVO',category:FLEET_CATS[0],serialNumber:'S/D',location:''};
    const proj=g(ix.proj)||base.project||'';
    ok.push({...base,code,brand,model,serialNumber:g(ix.serial)||base.serialNumber||'S/D',category:cat||base.category,plate:g(ix.plate).toUpperCase()||base.plate||'',year:year||base.year||'',provider:g(ix.prov)||base.provider||'',project:proj,hours:hours!==null?hours:(Number(base.hours)||0),location:g(ix.loc)||base.location||proj,status:status||base.status||'OPERATIVO'});
    old?nUpd++:nNew++;
  });
  fImp=ok;
  const L=(a,c)=>a.slice(0,8).map(x=>`<p class="${c}">${esc(x)}</p>`).join('')+(a.length>8?`<p class="text-slate-400">… y ${a.length-8} más</p>`:'');
  out.innerHTML=`<div class="bg-slate-900 p-3 rounded-lg text-xs space-y-1"><p class="text-emerald-400 font-semibold">✔ ${ok.length} listo(s): ${nNew} nuevo(s)${upd?`, ${nUpd} a actualizar`:''}</p>${skip?`<p class="text-slate-400">${skip} ya existe(n) en la flota y se omite(n) (marca la casilla para actualizarlos)</p>`:''}
  ${bad.length?`<p class="text-red-400 font-semibold">✖ ${bad.length} con error (no se importan):</p>${L(bad,'text-red-400')}`:''}${warn.length?`<p class="text-amber-400 font-semibold">⚠️ ${warn.length} aviso(s):</p>${L(warn,'text-amber-400')}`:''}
  ${ok.slice(0,5).map(o=>`<p class="text-slate-300">• <b class="text-amber-400">${esc(o.code)}</b> · ${esc(o.brand)} ${esc(o.model)} · ${esc(o.category)}${byCode[o.code]?' <span class="text-blue-400">(actualiza)</span>':''}</p>`).join('')}${ok.length>5?`<p class="text-slate-500">… y ${ok.length-5} más</p>`:''}</div>`;
  if(ok.length){go.disabled=false;go.style.opacity='1';go.textContent='Importar '+ok.length}
}
function doFleetImport(){
  if(!isAdmin()||!fImp.length)return;const list=fImp,n=list.length;fImp=[];fImpFile=null;hide();
  putMany('fleet',list).then(()=>note(`Se importaron ${n} equipo(s) a la flota.`));
}

/* ---------- Fotos (backlogs, preventivos y paradas) ---------- */
let tmp={before:[],after:[]};
function photoBox(key,label){
  return `<div class="border border-slate-700 bg-slate-900/50 p-3 rounded-lg space-y-2"><p class="text-xs text-amber-400 font-semibold">📷 ${label} (máx. ${key==='stop'?5:3})</p>
  <input type="file" accept="image/*" multiple onchange="addPhotos(this,'${key}')" class="text-xs text-slate-400"><div id="pv-${key}" class="flex flex-wrap gap-2"></div></div>`;
}
function pv(key){
  $('pv-'+key).innerHTML=tmp[key].map((s,i)=>`<div class="relative w-16 h-16"><img src="${esc(s)}" class="w-full h-full object-cover rounded border border-slate-600"><button type="button" onclick="tmp['${key}'].splice(${i},1);pv('${key}')" class="absolute -top-1 -right-1 bg-red-600 rounded-full w-5 h-5 text-xs">×</button></div>`).join('');
}
function compress(file){
  return new Promise(res=>{const i=new Image();i.onload=()=>{const k=Math.min(1,640/Math.max(i.width,i.height)),c=document.createElement('canvas');
    c.width=i.width*k;c.height=i.height*k;c.getContext('2d').drawImage(i,0,0,c.width,c.height);URL.revokeObjectURL(i.src);res(c.toDataURL('image/jpeg',.6))};
    i.onerror=()=>res(null);i.src=URL.createObjectURL(file)});
}
async function addPhotos(inp,key){
  for(const f of inp.files){const mx=key==='stop'?5:3;if(tmp[key].length>=mx){note('Máximo '+mx+' fotos');break}if(!/^image\//.test(f.type)||f.size>20e6){note(f.name+': no es una imagen válida o pesa más de 20 MB');continue}const d=await compress(f);if(d)tmp[key].push(d)}
  inp.value='';pv(key);
}
function openDetail(id){bkDetail(id)}

/* ---------- Firma digital (precargada desde el perfil del personal) ---------- */
let sig={c:null,x:null,drawn:false,down:false,dirty:false,src:''};
const mySig=()=>(me&&me.signature)||'';
const sigBox=(l,opt)=>`<div class="border border-slate-700 bg-slate-900/50 p-3 rounded-lg space-y-2"><div class="flex justify-between items-center gap-2 flex-wrap"><p class="text-xs text-emerald-400 font-semibold">✍️ ${l}${opt?'':' *'}</p><div class="flex gap-1"><label class="btn bg-slate-700 !py-1" style="display:inline-flex;align-items:center;cursor:pointer">📷 Subir foto<input type="file" accept="image/*" onchange="sigUpload(this)" style="display:none"></label><button type="button" onclick="sigClear()" class="btn bg-slate-700 !py-1">Borrar</button></div></div><canvas id="sigc" style="width:100%;height:140px;background:#fff;border-radius:.5rem;touch-action:none;display:block"></canvas><p id="sig-hint" class="text-[11px] text-slate-500">Firma con el dedo o el mouse dentro del recuadro blanco, o sube una foto de la firma en papel blanco.</p></div>`;
function sigFit(x,c,img){const k=Math.min(c.width/img.width,c.height/img.height),w=img.width*k,h=img.height*k;x.drawImage(img,(c.width-w)/2,(c.height-h)/2,w,h)}
function sigInit(existing){
  const c=$('sigc');if(!c)return;
  c.width=c.clientWidth||320;c.height=c.clientHeight||140;
  const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
  x.strokeStyle='#0f172a';x.lineWidth=2.5;x.lineCap='round';x.lineJoin='round';
  sig={c,x,drawn:false,down:false,dirty:false,src:existing||''};
  if(existing){sig.drawn=true;const i=new Image();i.onload=()=>{if(sig.c===c&&!sig.dirty)sigFit(x,c,i)};i.src=existing;
    const h=$('sig-hint');if(h){h.textContent='✔ Firma precargada del perfil. Para firmar de nuevo, toca el recuadro o usa Borrar.';h.className='text-[11px] text-emerald-400'}}
  const pos=e=>{const r=c.getBoundingClientRect();return [(e.clientX-r.left)*c.width/r.width,(e.clientY-r.top)*c.height/r.height]};
  c.onpointerdown=e=>{e.preventDefault();try{c.setPointerCapture(e.pointerId)}catch(_){}
    if(sig.src&&!sig.dirty){x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height)} // al volver a firmar se reemplaza la precargada
    sig.down=true;sig.drawn=true;sig.dirty=true;sig.src='';const [a,b]=pos(e);x.beginPath();x.moveTo(a,b);x.lineTo(a+.1,b+.1);x.stroke();x.beginPath();x.moveTo(a,b)};
  c.onpointermove=e=>{if(!sig.down)return;e.preventDefault();const [a,b]=pos(e);x.lineTo(a,b);x.stroke();x.beginPath();x.moveTo(a,b)};
  c.onpointerup=c.onpointercancel=c.onpointerleave=()=>{sig.down=false};
}
function sigClear(){const{c,x}=sig;if(!c)return;x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);sig.drawn=false;sig.dirty=true;sig.src=''}
function sigUpload(inp){
  const f=inp.files[0];inp.value='';const{c,x}=sig;if(!f||!c)return;
  const i=new Image();i.onload=()=>{URL.revokeObjectURL(i.src);x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);sigFit(x,c,i);
    // limpia el fondo de la foto: lo claro pasa a blanco y el trazo a tinta oscura
    try{const d=x.getImageData(0,0,c.width,c.height),p=d.data;for(let k=0;k<p.length;k+=4){const l=.299*p[k]+.587*p[k+1]+.114*p[k+2];if(l>150){p[k]=p[k+1]=p[k+2]=255}else{p[k]=15;p[k+1]=23;p[k+2]=42}p[k+3]=255}x.putImageData(d,0,0)}catch(_){}
    sig.drawn=true;sig.dirty=true;sig.src='';const h=$('sig-hint');if(h){h.textContent='Foto cargada. Si no se ve bien, bórrala y firma a mano.';h.className='text-[11px] text-slate-400'}};
  i.onerror=()=>note('No se pudo leer la imagen de la firma.');i.src=URL.createObjectURL(f);
}
function sigData(){
  if(!sig.dirty&&sig.src)return sig.src; // firma precargada: se guarda exactamente la del perfil
  const c=sig.c,o=document.createElement('canvas');o.width=400;o.height=Math.round(400*c.height/c.width);
  o.getContext('2d').drawImage(c,0,0,o.width,o.height);return o.toDataURL('image/png');
}

function fileOut(blob,name,title){
  const url=URL.createObjectURL(blob);window._pdf={blob,name};
  let canShare=false;try{canShare=!!(navigator.canShare&&navigator.canShare({files:[new File([blob],name,{type:blob.type||'application/pdf'})]}))}catch(_){}
  show(`<h3 class="font-bold text-emerald-400 mb-1">${title}</h3><p class="text-xs text-slate-400 mb-4">${esc(name)}</p>
  <div class="grid gap-2">${canShare?'<button type="button" onclick="shareOT()" class="btn bg-emerald-500 text-slate-950">📲 Compartir (WhatsApp, correo…)</button>':''}<a href="${url}" download="${esc(name)}" class="btn bg-amber-500 text-slate-950 text-center" style="text-decoration:none">⬇️ Descargar</a>
  <a href="${url}" target="_blank" rel="noopener" class="btn bg-slate-700 text-center" style="text-decoration:none">🔍 Abrir en una pestaña nueva</a>
  <button type="button" onclick="hide()" class="btn bg-slate-800 border border-slate-600">Cerrar</button></div>
  <p class="text-[11px] text-slate-500 mt-3">Si "Descargar" no hace nada, usa "Abrir en una pestaña nueva" y guarda desde ahí.</p>`);
}
function shareOT(){
  const p=window._pdf;if(!p)return;
  navigator.share({files:[new File([p.blob],p.name,{type:p.blob.type||'application/pdf'})],title:p.name}).catch(()=>{});
}

const fmtD=s=>s?s.split('-').reverse().join('/'):'-';

/* ---------- Módulo del supervisor ---------- */
let supOk=false;
function renderSup(){
  const el=$('v-sup');
  if(!supOk){el.innerHTML='<p class="text-slate-500 text-sm">Esta sección es solo para supervisores.</p>';return}
  const pend=backlogs.filter(b=>b.status==='PENDIENTE_VALIDACION').sort((a,b)=>(a.closeDate||'').localeCompare(b.closeDate||''));
  const pendPm=pms.filter(p=>p.status==='PENDIENTE_VALIDACION').sort((a,b)=>(a.execDate||'').localeCompare(b.execDate||''));
  const done=backlogs.filter(b=>b.status==='COMPLETADO'&&b.supName).length+pms.filter(p=>p.status==='COMPLETADO'&&p.supName).length;
  el.innerHTML=`<div class="bg-slate-800 border border-slate-700 rounded-xl p-3 flex justify-between items-center gap-2"><div><h3 class="font-bold">🛡️ Validación del supervisor</h3><p class="text-xs text-slate-400">${pend.length+pendPm.length} por validar · ${done} validados</p></div></div>
  ${pend.length?'<h4 class="text-xs text-slate-400 uppercase">Backlogs</h4>':''}<div class="grid gap-3 md:grid-cols-2">${pend.map(b=>{const e=eqOf(b.fleetId);
    return `<div class="bg-slate-800 border border-slate-700 rounded-xl p-4"><div class="flex justify-between items-start gap-2"><div class="min-w-0"><span class="font-bold text-amber-400 text-sm">${esc(bkNo(b))}</span><p class="text-xs text-slate-400 truncate">${esc(e.code)} · ${esc(e.brand)} ${esc(e.model)}</p></div>${bkPrBadge(b.criticality)}</div>
    <p class="font-semibold mt-2">${esc(b.component)}</p><p class="text-xs text-slate-400">${esc(b.system)}</p>
    <p class="text-xs mt-2 text-slate-400">Cerrado por <b class="text-slate-200">${esc(b.closeTech)}</b> el <b class="text-slate-200">${fmtD(b.closeDate)}</b>${b.closeHours!=null&&b.closeHours!==''?` · Horómetro: <b class="text-slate-200">${esc(b.closeHours)}</b>`:''}</p>
    <div class="flex justify-end mt-3"><button onclick="openValidate('${b.id}')" class="btn bg-amber-500 text-slate-950 !py-1">🔎 Revisar y validar</button></div></div>`}).join('')}</div>
  ${pendPm.length?'<h4 class="text-xs text-slate-400 uppercase">Mantenimientos preventivos</h4>':''}<div class="grid gap-3 md:grid-cols-2">${pendPm.map(supPmCard).join('')}</div>
  ${(!pend.length&&!pendPm.length)?'<p class="text-slate-500 text-sm">No hay trabajos pendientes de validación.</p>':''}`;
}
function openValidate(id){
  if(!supOk)return;const b=backlogs.find(x=>x.id===id);if(!b)return;const e=eqOf(b.fleetId);
  const ph=a=>(a&&a.length)?a.map(x=>`<img src="${esc(x)}" class="w-24 h-24 object-cover rounded border border-slate-700">`).join(''):'<p class="text-xs text-slate-500">Sin imágenes</p>';
  let last='';try{last=sessionStorage.getItem('supName')||''}catch(_){}
  show(`<div class="flex justify-between items-start"><div><span class="text-xs font-bold text-amber-400">${esc(bkNo(b))}</span><h3 class="text-lg font-bold">${esc(b.component)}</h3>
  <p class="text-xs text-slate-400">${esc(e.code)} (${esc(e.brand)} ${esc(e.model)} · S/N ${esc(e.serialNumber)})</p></div><button type="button" onclick="hide()" class="text-slate-400 text-xl">✕</button></div>
  <div class="grid grid-cols-2 gap-2 text-xs bg-slate-900 p-3 rounded-lg my-3"><div><span class="text-slate-400 block">Sistema</span>${esc(b.system)}</div><div><span class="text-slate-400 block">Prioridad</span>${bkPrBadge(b.criticality)}</div>
  <div><span class="text-slate-400 block">Detectado</span>${fmtD(b.observationDate)}</div><div><span class="text-slate-400 block">Fecha límite</span>${fmtD(bkLimit(b))}</div>${b.ot?`<div><span class="text-slate-400 block">OT</span>${esc(b.ot.num)}</div>`:''}${b.downtimeH?`<div><span class="text-slate-400 block">Horas fuera de servicio</span>${esc(b.downtimeH)} h</div>`:''}</div>
  <p class="text-xs text-slate-400 uppercase mb-1">Hallazgo</p><p class="text-sm bg-slate-900/50 p-3 rounded-lg border border-slate-700">${esc(b.description)}</p>
  <div class="bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-lg text-xs mt-3"><b class="text-emerald-400">Trabajo del técnico:</b> ${esc(b.closeTech)} · ${fmtD(b.closeDate)}${b.closeHours!=null&&b.closeHours!==''?` · Horómetro: <b>${esc(b.closeHours)}</b>`:''}${b.closeNotes?`<p class="mt-1 text-slate-300">${esc(b.closeNotes)}</p>`:'<p class="mt-1 text-slate-500">Sin notas de reparación.</p>'}</div>
  <h4 class="text-xs text-slate-400 uppercase mt-3 mb-1">Antes</h4><div class="flex flex-wrap gap-2">${ph(b.photosBefore)}</div>
  ${b.repId&&stById(b.repId)?`<div class="flex gap-2 flex-wrap mt-3"><button type="button" onclick="makePdfRpt('${b.repId}')" class="btn bg-slate-700 !py-1">📄 Reporte ${esc(b.repNum||'')}</button>${b.ot&&b.ot.num?`<button type="button" onclick="makePdfOt('${b.id}')" class="btn bg-slate-700 !py-1">📄 ${esc(b.ot.num)}</button>`:''}</div>`:''}<h4 class="text-xs text-slate-400 uppercase mt-3 mb-1">Después (evidencia)</h4><div class="flex flex-wrap gap-2">${ph(bkAfter(b))}</div>
  ${b.closeSignature?`<h4 class="text-xs text-slate-400 uppercase mt-3 mb-1">Firma del técnico</h4><img src="${esc(b.closeSignature)}" style="height:4rem" class="bg-white rounded">`:''}
  <form id="supf" onsubmit="return false" class="space-y-3 mt-4 pt-3 border-t border-slate-700"><p class="text-sm text-amber-400 font-semibold">Validación del supervisor</p>
    <div class="g2">${field('supName','Supervisor *',me.name,'required readonly')}${field('supDate','Fecha de validación *',today(),'required','date')}</div>
    <label class="block text-xs text-slate-400 font-semibold">Observaciones del supervisor <span class="font-normal">(obligatorio si devuelves el trabajo)</span><textarea maxlength="5000" name="supNotes" rows="2" class="inp mt-1 font-normal"></textarea></label>
    ${sigBox('Firma del supervisor (solo para aprobar)')}
    <p id="supmsg" class="text-xs text-red-400 hidden"></p>
    <div class="flex justify-end gap-2 pt-3 border-t border-slate-700" style="position:sticky;bottom:-1rem;background:#1e293b;padding-bottom:1rem;margin-top:.75rem;z-index:5">
      <button type="button" onclick="decide('${b.id}','no')" class="btn bg-red-500/20 text-red-400">↩️ Devolver</button>
      <button type="button" onclick="decide('${b.id}','ok')" class="btn bg-emerald-500 text-slate-950">✅ Aprobar y cerrar</button></div></form>`);
  sigInit(mySig());
}
function supErr(m){const p=$('supmsg');p.textContent=m;p.classList.remove('hidden');p.scrollIntoView({block:'center'})}
function decide(id,how){
  const form=$('supf');if(!form||!supOk)return;if(!form.reportValidity())return;
  const f=Object.fromEntries(new FormData(form)),b=backlogs.find(x=>x.id===id);if(!b)return;if(selfClosed(b)){supErr('No puedes validar un trabajo cerrado por ti. Debe validarlo otro supervisor o el planner.');return}
  const name=me.name,notes=(f.supNotes||'').trim();try{sessionStorage.setItem('supName',name)}catch(_){}
  if(how==='ok'){
    if(!sig.drawn){supErr('Falta la firma del supervisor para aprobar y cerrar el backlog.');return}
    const sg=sigData();put('backlogs',{...b,status:'COMPLETADO',supName:name,supPos:me.position||'',supDate:f.supDate,supNotes:notes,supSignature:sg,rejectNote:'',rejectBy:'',rejectDate:'',log:bkLog(b,'Validado y cerrado por '+name)});
    const rp=stById(b.repId);if(rp)put('stops',{...rp,rev:{name,pos:me.position||'',date:f.supDate,sig:sg}});hide();
  }else{
    if(!notes){supErr('Escribe en Observaciones el motivo por el que devuelves el trabajo al técnico.');return}
    put('backlogs',{...b,status:'EN_EJECUCION',rejectNote:notes,rejectBy:name,rejectDate:f.supDate,closeSignature:'',closeDate:'',supName:'',supDate:'',supNotes:'',supSignature:'',log:bkLog(b,'Devuelto al técnico por '+name+': '+notes)});hide();
  }
}


/* =====================================================================
   MANTENIMIENTOS PREVENTIVOS (programación + OT de mantenimiento)
   ===================================================================== */
const PM_ST={PROGRAMADO:'bg-blue-500/10 text-blue-400 border-blue-500/30',PENDIENTE_VALIDACION:'bdg-v',COMPLETADO:'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',VENCIDO:'bg-red-500/10 text-red-400 border-red-500/30'};
const PM_L={PROGRAMADO:'PROGRAMADO',PENDIENTE_VALIDACION:'POR VALIDAR',COMPLETADO:'COMPLETADO',VENCIDO:'VENCIDO'};
const PM_LONG={PROGRAMADO:'Programado',PENDIENTE_VALIDACION:'Pendiente por validacion',COMPLETADO:'Completado y validado'};
const pmBadge=k=>`<span class="bdg ${PM_ST[k]||''}">${PM_L[k]||esc(k)}</span>`;
const pmOver=p=>p.status==='PROGRAMADO'&&!!p.scheduledDate&&p.scheduledDate<today();
const pmKey=p=>pmOver(p)?'VENCIDO':p.status;
const daysTo=s=>Math.round((day(s)-day(today()))/864e5);
function pmWhen(p){if(p.status!=='PROGRAMADO'||!p.scheduledDate)return '';const d=daysTo(p.scheduledDate);return d<0?`Vencido hace ${-d} día(s)`:d===0?'Es hoy':`Faltan ${d} día(s)`}
const RES_ICO={OK:'✅',OBS:'⚠️',NA:'➖'},RES_LAB={OK:'Realizado',OBS:'Observado',NA:'No aplica'};
const actStats=a=>{const o={OK:0,OBS:0,NA:0};(a||[]).forEach(x=>{if(o[x.res]!=null)o[x.res]++});return o};
const fmtH=h=>(h===''||h==null)?'-':Number(h).toLocaleString('es-PE');

/* ---------- Actividades por defecto según el tipo de equipo ---------- */
const ACT_BASE=['Inspección visual general del equipo','Verificación y corrección de niveles (aceite, refrigerante, hidráulico)','Cambio de aceite y filtro de motor','Cambio de filtros de combustible','Revisión y limpieza del filtro de aire','Inspección de mangueras, fugas y conexiones','Revisión del sistema de frenos','Revisión de neumáticos / tren de rodaje','Revisión del sistema eléctrico, batería y luces','Engrase general','Prueba de funcionamiento y entrega al operador'];
const ACT_CAT={
  'Grupo Electrógeno':['Inspección visual general','Revisión de nivel de aceite y refrigerante','Cambio de aceite y filtros (aceite, combustible, aire)','Revisión de baterías y bornes','Prueba de arranque y transferencia','Revisión de alternador y tablero de control','Medición de voltaje y frecuencia en carga','Inspección de fugas, escape y silenciador','Limpieza general'],
  'Luminaria':['Inspección visual de torre y estructura','Revisión de lámparas y reflectores','Revisión de cableado y conexiones','Revisión del grupo generador acoplado','Revisión del sistema de elevación / mástil','Prueba de encendido y alcance de iluminación','Limpieza general'],
  'Camioneta':['Cambio de aceite y filtros','Revisión de frenos (pastillas y discos)','Revisión de suspensión y dirección','Rotación y presión de neumáticos','Revisión de batería y luces','Verificación de niveles','Inspección de fugas','Prueba de ruta'],
  'Minibús':['Cambio de aceite y filtros','Revisión de frenos (pastillas y discos)','Revisión de suspensión y dirección','Rotación y presión de neumáticos','Revisión de batería, luces y sistema eléctrico','Verificación de niveles','Revisión de asientos, puertas y cinturones','Inspección de fugas','Prueba de ruta'],
  'Cisterna de Agua':[...ACT_BASE,'Revisión de bomba de agua','Revisión de válvulas y mangueras de despacho','Inspección del tanque y soportes'],
  'Volquete':[...ACT_BASE,'Inspección de tolva y pernos de fijación','Revisión del sistema de levante'],
  'Camión Minero':[...ACT_BASE,'Inspección de tolva y pernos de fijación','Revisión del sistema de levante y suspensión'],
};
const ACT_MAQ=[...ACT_BASE,'Revisión del sistema hidráulico y cilindros','Inspección de cuchara / implementos y piezas de desgaste'];
const defActs=cat=>[...(ACT_CAT[cat]||ACT_MAQ)];
const PM_PLANS=['Mantenimiento 250 h','Mantenimiento 500 h','Mantenimiento 1000 h','Mantenimiento 2000 h','Servicio 5,000 km','Servicio 10,000 km','Inspección mensual','Cambio de aceite y filtros','Mantenimiento mensual'];

/* ---------- Lista ---------- */
function renderPm(){
  const s=($('qpm').value||'').toLowerCase(),st=$('fpm').value,ord={VENCIDO:0,PROGRAMADO:1,PENDIENTE_VALIDACION:2,COMPLETADO:3};
  const l=pms.filter(p=>{const e=eqOf(p.fleetId);return (!st||pmKey(p)===st)&&[p.id,p.otNum,e.code,p.plan,p.responsible].some(v=>String(v||'').toLowerCase().includes(s))})
    .sort((a,b)=>(ord[pmKey(a)]-ord[pmKey(b)])||(a.scheduledDate||'').localeCompare(b.scheduledDate||''));
  $('list-pm').innerHTML=l.map(p=>{const e=eqOf(p.fleetId),k=pmKey(p),over=k==='VENCIDO',a=actStats(p.acts);
    return `<div class="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div class="flex justify-between items-start gap-2"><div class="min-w-0"><span class="font-bold text-amber-400 text-sm">${esc(pmOt(p))}</span><p class="text-xs text-slate-400 truncate">${esc(e.code)} · ${esc(e.brand)} ${esc(e.model)}</p></div>${pmBadge(k)}</div>
      <p class="font-semibold mt-2">${esc(p.plan)}</p>
      <p class="text-xs mt-1 text-slate-400">Programado: <b class="text-slate-200">${fmtD(p.scheduledDate)}</b>${p.scheduledHours!==''&&p.scheduledHours!=null?` · a las <b class="text-slate-200">${fmtH(p.scheduledHours)}</b>`:''}</p>
      ${p.status==='PROGRAMADO'?`<p class="text-xs mt-1 font-semibold ${over?'text-red-400':'text-slate-400'}">${pmWhen(p)}</p>`+pmHrsLine(p):''}
      ${p.responsible?`<p class="text-xs text-slate-400">Responsable: ${esc(p.responsible)}</p>`:''}
      ${p.acts?`<p class="text-xs mt-1 text-slate-400">${RES_ICO.OK} ${a.OK} · ${RES_ICO.OBS} ${a.OBS} · ${RES_ICO.NA} ${a.NA} · ${(p.acts||[]).length} actividades</p>`:`<p class="text-xs mt-1 text-slate-500">${(p.plannedActs||[]).length} actividades programadas</p>`}
      ${(p.rejectNote&&p.status==='PROGRAMADO')?`<p class="text-xs mt-2 text-red-400">⚠️ Devuelto por supervisor: ${esc(p.rejectNote)}</p>`:''}
      <div class="cact flex gap-1 justify-end mt-3 flex-wrap">${pmActs(p)}</div></div>`}).join('')||'<p class="text-slate-500 text-sm">Sin mantenimientos preventivos. Usa "+ Programar" o "📥 Importar".</p>';
  tblPm(l);
}
function pmUpcomingHtml(){
  const l=pms.filter(p=>p.status==='PROGRAMADO').sort((a,b)=>(a.scheduledDate||'').localeCompare(b.scheduledDate||'')).slice(0,6);
  return `<div class="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2"><div class="flex justify-between items-center gap-2"><h3 class="font-semibold">🗓️ Próximos preventivos</h3><button onclick="tab('pm')" class="btn bg-slate-700 !py-1">Ver todos</button></div>
  ${l.map(p=>{const e=eqOf(p.fleetId),o=pmOver(p);return `<div class="flex justify-between items-center gap-2 text-sm border-t border-slate-700" style="padding-top:.5rem"><div class="min-w-0"><b class="text-amber-400">${esc(e.code)}</b> <span class="text-slate-300">${esc(p.plan)}</span></div><div class="text-xs text-right whitespace-nowrap ${o?'text-red-400':'text-slate-400'}">${fmtD(p.scheduledDate)}<br>${pmWhen(p)}</div></div>`}).join('')||'<p class="text-slate-500 text-sm">No hay preventivos programados.</p>'}</div>`;
}

/* ---------- Programar / editar ---------- */
let pmDirty=false;
function openPm(id){if(!isSup())return;
  const p=pms.find(x=>x.id===id)||{},pf=fleetIn('pm',p.fleetId);if(!pf.length){note(fleet.length?'Ningún equipo está habilitado en Preventivos (usa 🧩 Equipos).':'Primero registra un equipo en la pestaña Flota.');return}
  const fid=p.fleetId||pf[0].id,eq=eqOf(fid);pmDirty=!!id;
  const acts=(p.plannedActs&&p.plannedActs.length?p.plannedActs:defActs(eq.category)).join('\n');
  show(`<h3 class="font-bold mb-3">${id?'Editar':'Programar'} mantenimiento preventivo</h3>
  <form onsubmit="savePm(event,'${id||''}')" class="space-y-3">
    ${sel('fleetId','Equipo *',pf.map(f=>[f.id,`${f.code} - ${f.brand} ${f.model}`]),fid)}
    <label class="block text-xs text-slate-400 font-semibold">Plan / tipo de mantenimiento *<input class="inp mt-1 font-normal" name="plan" list="pm-plans" required placeholder="Ej: Mantenimiento 250 h" value="${esc(p.plan)}"><datalist id="pm-plans">${PM_PLANS.map(x=>`<option value="${esc(x)}">`).join('')}</datalist></label>
    <div class="g2">${field('scheduledDate','Fecha programada *',p.scheduledDate||today(),'required','date')}${field('scheduledHours','Horómetro / odómetro programado',p.scheduledHours??'','min="0" step="any" inputmode="decimal"','number')}</div>
    <div id="pm-win"></div>
    <div class="g2"><label class="block text-xs text-slate-400 font-semibold">Responsable / técnico<input class="inp mt-1 font-normal" name="responsible" list="dl-pmtec" maxlength="80" value="${esc(p.responsible||'')}" placeholder="Técnico o taller"><datalist id="dl-pmtec">${techList().map(u=>`<option value="${esc(u.name)}">`).join('')}</datalist></label>${field('durH','Duración estimada (h)',p.durH??'','min="0" step="0.5" inputmode="decimal" placeholder="'+PL_PM_H+'"','number')}</div>
    <label class="block text-xs text-slate-400 font-semibold">Actividades programadas (una por línea)<textarea maxlength="5000" name="acts" rows="8" class="inp mt-1 font-normal" oninput="pmDirty=true">${esc(acts)}</textarea></label>
    <label class="block text-xs text-slate-400 font-semibold">Notas<textarea maxlength="5000" name="notes" rows="2" class="inp mt-1 font-normal">${esc(p.notes)}</textarea></label>
    ${btns()}</form>`,'36rem');
  const sl=document.querySelector('#modal select[name=fleetId]');
  if(sl)sl.onchange=function(){const f=fleet.find(x=>x.id===this.value),ta=document.querySelector('#modal textarea[name=acts]');if(f&&(!pmDirty||!ta.value.trim())){ta.value=defActs(f.category).join('\n');pmDirty=false}pmWinRender()};
  const sd=document.querySelector('#modal input[name=scheduledDate]');if(sd)sd.addEventListener('change',pmWinRender);pmWinRender();
}
async function savePm(ev,id){
  ev.preventDefault();const f=Object.fromEntries(new FormData(ev.target)),old0=pms.find(x=>x.id===id)||{},eq=eqOf(f.fleetId);
  const sb=ev.target.querySelector('button:not([type=button])');if(sb)sb.disabled=true;
  const old=numOf('ot',old0.otNum)?old0:{...old0,otNum:(await takeNums('ot'))[0]};
  let acts=(f.acts||'').split('\n').map(x=>x.replace(/^\s*(?:[-*•]|\d+[.)])\s*/,'').trim()).filter(Boolean);if(!acts.length)acts=defActs(eq.category);
  put('preventive',{status:'PROGRAMADO',...old,id:id||'PM-'+Date.now().toString().slice(-7),fleetId:f.fleetId,plan:f.plan.trim(),scheduledDate:f.scheduledDate,
    scheduledHours:f.scheduledHours===''?'':Number(f.scheduledHours),responsible:(f.responsible||'').trim(),durH:f.durH===''||f.durH==null?'':Number(f.durH),plannedActs:acts,notes:(f.notes||'').trim()});
  hide();
}
function delPm(id){if(!isAdmin())return;ask('¿Eliminar este mantenimiento preventivo? Esta acción no se puede deshacer.',()=>del('preventive',id))}

/* ---------- Cierre de la OT (técnico) ---------- */
let pmT={acts:[],parts:[],crew:[]};
function pmRender(kind){
  const el=$('pm-'+kind);if(!el)return;
  if(kind==='acts')el.innerHTML=pmT.acts.map((a,i)=>`<div class="bg-slate-900/50 border border-slate-700 rounded-lg p-3 space-y-2">
    <div class="flex justify-between items-start gap-2">${a.extra?`<input class="inp" placeholder="Describe la actividad adicional" value="${esc(a.d)}" oninput="pmT.acts[${i}].d=this.value">`:`<p class="text-sm font-semibold"><span class="text-amber-400">${i+1}.</span> ${esc(a.d)}</p>`}${a.extra?`<button type="button" onclick="pmDel('acts',${i})" class="btn bg-red-500/20 !py-1">✕</button>`:''}</div>
    <select class="inp" onchange="pmT.acts[${i}].res=this.value">${[['','— elegir resultado —'],['OK','✅ Realizado'],['OBS','⚠️ Observado'],['NA','➖ No aplica']].map(([v,t])=>`<option value="${v}" ${a.res===v?'selected':''}>${t}</option>`).join('')}</select>
    <input class="inp" placeholder="Detalle / observación (obligatorio si es Observado)" value="${esc(a.note)}" oninput="pmT.acts[${i}].note=this.value"></div>`).join('');
  else if(kind==='parts')el.innerHTML=pmT.parts.map((r,i)=>`<div class="bg-slate-900/50 border border-slate-700 rounded-lg p-3 space-y-2">
    <input class="inp" placeholder="Repuesto / insumo (ej. Filtro de aceite)" value="${esc(r.d)}" oninput="pmT.parts[${i}].d=this.value">
    <div class="grid gap-2" style="grid-template-columns:1fr 1fr auto"><input class="inp" type="number" min="0" step="any" inputmode="decimal" placeholder="Cantidad" value="${esc(r.qty)}" oninput="pmT.parts[${i}].qty=this.value"><input class="inp" placeholder="Unidad (un, L, gal)" value="${esc(r.unit)}" oninput="pmT.parts[${i}].unit=this.value"><button type="button" onclick="pmDel('parts',${i})" class="btn bg-red-500/20 !py-1">✕</button></div></div>`).join('');
  else el.innerHTML=pmT.crew.map((r,i)=>`<div class="bg-slate-900/50 border border-slate-700 rounded-lg p-3"><div class="grid gap-2" style="grid-template-columns:1fr 6rem auto"><input class="inp" placeholder="Nombre del técnico" value="${esc(r.n)}" oninput="pmT.crew[${i}].n=this.value"><input class="inp" type="number" min="0" step="any" inputmode="decimal" placeholder="Horas" value="${esc(r.h)}" oninput="pmT.crew[${i}].h=this.value"><button type="button" onclick="pmDel('crew',${i})" class="btn bg-red-500/20 !py-1">✕</button></div></div>`).join('');
}
function pmAdd(kind){pmT[kind].push(kind==='acts'?{d:'',res:'',note:'',extra:true}:kind==='parts'?{d:'',qty:'',unit:''}:{n:'',h:''});pmRender(kind)}
function pmDel(kind,i){pmT[kind].splice(i,1);pmRender(kind)}
function pmErr(m){const p=$('pmerr');p.textContent=m;p.classList.remove('hidden');p.scrollIntoView({block:'center'})}
function openClosePm(id){
  const p=pms.find(x=>x.id===id);if(!p)return;const e=eqOf(p.fleetId);
  tmp={before:[...(p.photosBefore||[])],after:[...(p.photosAfter||[])]};
  pmT={acts:(p.acts&&p.acts.length?p.acts:(p.plannedActs&&p.plannedActs.length?p.plannedActs:defActs(e.category)).map(d=>({d,res:'',note:''}))).map(a=>({d:a.d,res:a.res||'',note:a.note||'',extra:!!a.extra})),
       parts:(p.parts||[]).map(r=>({...r})),crew:(p.crew&&p.crew.length?p.crew:[{n:techVal(''),h:''}]).map(r=>({...r}))};
  const H=t=>`<p class="text-sm font-semibold text-amber-400 mb-2">${t}</p>`;
  show(`<h3 class="font-bold text-emerald-400">✅ Cierre de OT de mantenimiento</h3><p class="text-xs text-slate-400">${esc(pmOt(p))} · ${esc(p.plan)} · ${esc(e.code)} ${esc(e.brand)} ${esc(e.model)}</p>
  <p class="text-xs text-amber-400 mb-3">Al confirmar, queda pendiente de validación del supervisor.</p>
  ${(p.rejectNote&&p.status==='PROGRAMADO')?`<p class="text-xs text-red-400 mb-3">⚠️ Devuelto por supervisor: ${esc(p.rejectNote)}</p>`:''}
  <form onsubmit="savePmClose(event,'${id}')" class="space-y-4">
    <div>${H('Datos de la ejecución')}<div class="space-y-3">
      <div class="g2">${field('execDate','Fecha de ejecución *',p.execDate||today(),`required max="${today()}"`,'date')}${field('closeHours','Horómetro / odómetro al cierre *',p.closeHours??e.hours??'','required min="0" step="any" inputmode="decimal"','number')}</div>
      <div class="g2">${field('startTime','Hora de inicio *',p.startTime||'','required','time')}${field('endTime','Hora de fin *',p.endTime||'','required','time')}</div>
      ${field('closeTech','Técnico responsable *',techVal(p.closeTech),'required'+techRo())}</div></div>
    <div>${H('1. Actividades ejecutadas *')}<div id="pm-acts" class="space-y-2"></div><button type="button" onclick="pmAdd('acts')" class="btn bg-slate-700 w-full mt-2">+ Actividad adicional</button></div>
    <div>${H('2. Repuestos e insumos utilizados')}<div id="pm-parts" class="space-y-2"></div><button type="button" onclick="pmAdd('parts')" class="btn bg-slate-700 w-full mt-2">+ Agregar repuesto / insumo</button></div>
    <div>${H('3. Personal y horas-hombre')}<div id="pm-crew" class="space-y-2"></div><button type="button" onclick="pmAdd('crew')" class="btn bg-slate-700 w-full mt-2">+ Agregar personal</button></div>
    <div>${H('4. Observaciones y recomendaciones')}<div class="space-y-3">
      <label class="block text-xs text-slate-400 font-semibold">Observaciones generales<textarea maxlength="5000" name="closeNotes" rows="3" class="inp mt-1 font-normal">${esc(p.closeNotes)}</textarea></label>
      <label class="block text-xs text-slate-400 font-semibold">Recomendaciones / trabajos pendientes<textarea maxlength="5000" name="recommendations" rows="3" class="inp mt-1 font-normal">${esc(p.recommendations)}</textarea></label></div></div>
    <div>${H('5. Evidencia fotográfica')}<div class="space-y-3">${photoBox('before','Fotos antes (opcional)')}${photoBox('after','Fotos después / evidencia')}</div></div>
    <div>${H('6. Firma')}${sigBox('Firma del técnico')}</div>
    <p id="pmerr" class="text-xs text-red-400 hidden"></p>
    ${btns('hide()','Enviar a validación','bg-emerald-500')}</form>`,'40rem');
  pmRender('acts');pmRender('parts');pmRender('crew');pv('before');pv('after');sigInit(mySig());
}
function savePmClose(ev,id){
  ev.preventDefault();const p=pms.find(x=>x.id===id);if(!p)return;const f=Object.fromEntries(new FormData(ev.target));
  const acts=pmT.acts.filter(a=>a.d.trim()||a.res||a.note.trim());
  if(!acts.length){pmErr('Registra al menos una actividad ejecutada.');return}
  const missing=acts.filter(a=>!a.d.trim()||!a.res);
  if(missing.length){pmErr(`Falta indicar la descripción o el resultado de ${missing.length} actividad(es).`);return}
  if(acts.some(a=>a.res==='OBS'&&!a.note.trim())){pmErr('Las actividades marcadas como "Observado" necesitan un detalle.');return}
  if(!sig.drawn){pmErr('Falta la firma del técnico.');return}
  const parts=pmT.parts.filter(r=>String(r.d).trim()).map(r=>({d:String(r.d).trim(),qty:Number(r.qty)||0,unit:String(r.unit||'').trim()}));
  const crew=pmT.crew.filter(r=>String(r.n).trim()).map(r=>({n:String(r.n).trim(),h:Number(r.h)||0}));
  const [sh,sm]=f.startTime.split(':').map(Number),[eh,em]=f.endTime.split(':').map(Number);let mins=(eh*60+em)-(sh*60+sm);if(mins<0)mins+=1440;
  const hrs=Number(f.closeHours),eq=fleet.find(x=>x.id===p.fleetId);
  if(eq&&hrs>(Number(eq.hours)||0))put('fleet',{...eq,hours:hrs});
  put('preventive',{...p,execDate:f.execDate,startTime:f.startTime,endTime:f.endTime,durationH:Math.round(mins/60*100)/100,closeHours:hrs,closeTech:f.closeTech.trim(),
    acts:acts.map(a=>({d:a.d.trim(),res:a.res,note:a.note.trim(),extra:!!a.extra})),parts,crew,closeNotes:(f.closeNotes||'').trim(),recommendations:(f.recommendations||'').trim(),
    photosBefore:tmp.before,photosAfter:tmp.after,closeSignature:sigData(),closePos:posOf(f.closeTech),status:'PENDIENTE_VALIDACION',supName:'',supDate:'',supNotes:'',supSignature:''});
  note('Cierre de la OT registrado. Quedó PENDIENTE POR VALIDACIÓN del supervisor.');
}

/* ---------- Vista de detalle (también usada por el supervisor) ---------- */
function pmBodyHtml(p){
  const ph=a=>(a&&a.length)?a.map(x=>`<img src="${esc(x)}" class="w-24 h-24 object-cover rounded border border-slate-700">`).join(''):'<p class="text-xs text-slate-500">Sin imágenes</p>';
  const H=t=>`<h4 class="text-xs text-slate-400 uppercase mt-4 mb-1">${t}</h4>`,box='bg-slate-900/50 border border-slate-700 rounded-lg p-3';
  const acts=p.acts&&p.acts.length?p.acts:(p.plannedActs||[]).map(d=>({d,res:'',note:''})),a=actStats(p.acts),hh=(p.crew||[]).reduce((t,r)=>t+(Number(r.h)||0),0);
  return `${p.execDate?`${H('Ejecución')}<div class="grid grid-cols-2 gap-2 text-xs bg-slate-900 p-3 rounded-lg border border-slate-700">
    <div><span class="text-slate-400 block">Fecha</span>${fmtD(p.execDate)}</div><div><span class="text-slate-400 block">Horario</span>${esc(p.startTime)} – ${esc(p.endTime)} (${esc(p.durationH)} h)</div>
    <div><span class="text-slate-400 block">Horómetro al cierre</span>${fmtH(p.closeHours)}</div><div><span class="text-slate-400 block">Técnico</span>${esc(p.closeTech)}${p.closePos?'<br><span class="text-slate-400">'+esc(p.closePos)+'</span>':''}</div></div>`:''}
  ${H(`Actividades${p.acts?` (${RES_ICO.OK} ${a.OK} · ${RES_ICO.OBS} ${a.OBS} · ${RES_ICO.NA} ${a.NA})`:' programadas'}`)}<div class="space-y-2">${acts.map((x,i)=>`<div class="${box}"><p class="text-sm"><b class="text-amber-400">${i+1}.</b> ${esc(x.d)}</p><p class="text-xs ${x.res==='OBS'?'text-amber-400':'text-slate-400'}">${x.res?RES_ICO[x.res]+' '+RES_LAB[x.res]:'Pendiente de ejecutar'}${x.note?' · '+esc(x.note):''}</p></div>`).join('')||'<p class="text-xs text-slate-500">Sin actividades.</p>'}</div>
  ${(p.parts&&p.parts.length)?`${H('Repuestos e insumos')}<div class="space-y-2">${p.parts.map(r=>`<div class="${box} text-sm flex justify-between gap-2"><span>${esc(r.d)}</span><b class="whitespace-nowrap">${esc(r.qty)} ${esc(r.unit)}</b></div>`).join('')}</div>`:''}
  ${(p.crew&&p.crew.length)?`${H(`Personal (${hh} h-h)`)}<div class="space-y-2">${p.crew.map(r=>`<div class="${box} text-sm flex justify-between gap-2"><span>${esc(r.n)}</span><b>${esc(r.h)} h</b></div>`).join('')}</div>`:''}
  ${p.closeNotes?`${H('Observaciones generales')}<p class="text-sm ${box}">${esc(p.closeNotes)}</p>`:''}
  ${p.recommendations?`${H('Recomendaciones / trabajos pendientes')}<p class="text-sm ${box}">${esc(p.recommendations)}</p>`:''}
  ${p.acts?`${H('Fotos antes')}<div class="flex flex-wrap gap-2">${ph(p.photosBefore)}</div>${H('Fotos después')}<div class="flex flex-wrap gap-2">${ph(p.photosAfter)}</div>`:''}
  ${p.closeSignature?`${H('Firma del técnico')}<img src="${esc(p.closeSignature)}" style="height:5rem" class="bg-white rounded">`:''}
  ${p.supName?`<div class="bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-lg text-xs mt-3"><b class="text-emerald-400">Validado por el supervisor:</b> ${esc(p.supName)}${p.supPos?' ('+esc(p.supPos)+')':''} · ${fmtD(p.supDate)}${p.supNotes?`<p class="mt-1 text-slate-300">${esc(p.supNotes)}</p>`:''}</div>`:''}
  ${p.supSignature?`${H('Firma del supervisor')}<img src="${esc(p.supSignature)}" style="height:5rem" class="bg-white rounded">`:''}
  ${(p.rejectNote&&p.status==='PROGRAMADO')?`<div class="bg-red-500/10 border border-red-500/30 p-3 rounded-lg text-xs mt-3"><b class="text-red-400">Devuelto por el supervisor${p.rejectBy?' ('+esc(p.rejectBy)+')':''}:</b><p class="mt-1 text-slate-300">${esc(p.rejectNote)}</p></div>`:''}`;
}
function pmHead(p){const e=eqOf(p.fleetId);
  return `<div class="flex justify-between items-start"><div><span class="text-xs font-bold text-amber-400">${esc(pmOt(p))}</span><h3 class="text-lg font-bold">${esc(p.plan)}</h3>
  <p class="text-xs text-slate-400">${esc(e.code)} (${esc(e.brand)} ${esc(e.model)} · S/N ${esc(e.serialNumber)})</p></div><button type="button" onclick="hide()" class="text-slate-400 text-xl">✕</button></div>
  <div class="grid grid-cols-2 gap-2 text-xs bg-slate-900 p-3 rounded-lg my-3"><div><span class="text-slate-400 block">Estado</span>${pmBadge(pmKey(p))}</div><div><span class="text-slate-400 block">Programado</span>${fmtD(p.scheduledDate)}</div>
  <div><span class="text-slate-400 block">Horómetro programado</span>${fmtH(p.scheduledHours)}</div><div><span class="text-slate-400 block">Responsable</span>${esc(p.responsible||'-')}</div></div>
  ${p.notes?`<p class="text-sm bg-slate-900/50 p-3 rounded-lg border border-slate-700">${esc(p.notes)}</p>`:''}`}
function openDetailPm(id){
  const p=pms.find(x=>x.id===id);if(!p)return;
  show(`${pmHead(p)}${pmBodyHtml(p)}<div class="flex justify-end gap-2 mt-4 flex-wrap">${p.status==='PROGRAMADO'?`<button onclick="openClosePm('${p.id}')" class="btn bg-emerald-500 text-slate-950">✅ Cerrar OT</button>`:''}<button onclick="makePdfPm('${p.id}')" class="btn bg-amber-500 text-slate-950">📄 Generar OT (PDF)</button></div>`,'40rem');
}

/* ---------- Supervisor ---------- */
function supPmCard(p){const e=eqOf(p.fleetId),a=actStats(p.acts);
  return `<div class="bg-slate-800 border border-slate-700 rounded-xl p-4"><div class="flex justify-between items-start gap-2"><div class="min-w-0"><span class="font-bold text-amber-400 text-sm">${esc(pmOt(p))}</span><p class="text-xs text-slate-400 truncate">${esc(e.code)} · ${esc(e.brand)} ${esc(e.model)}</p></div>${pmBadge('PENDIENTE_VALIDACION')}</div>
  <p class="font-semibold mt-2">${esc(p.plan)}</p>
  <p class="text-xs mt-1 text-slate-400">Ejecutado por <b class="text-slate-200">${esc(p.closeTech)}</b> el <b class="text-slate-200">${fmtD(p.execDate)}</b> · Horómetro: <b class="text-slate-200">${fmtH(p.closeHours)}</b></p>
  <p class="text-xs mt-1 text-slate-400">${RES_ICO.OK} ${a.OK} · ${RES_ICO.OBS} ${a.OBS} · ${RES_ICO.NA} ${a.NA}</p>
  <div class="flex justify-end mt-3"><button onclick="openValidatePm('${p.id}')" class="btn bg-amber-500 text-slate-950 !py-1">🔎 Revisar y validar</button></div></div>`}
function openValidatePm(id){
  if(!supOk)return;const p=pms.find(x=>x.id===id);if(!p)return;
  let last='';try{last=sessionStorage.getItem('supName')||''}catch(_){}
  show(`${pmHead(p)}${pmBodyHtml(p)}
  <form id="supf" onsubmit="return false" class="space-y-3 mt-4 pt-3 border-t border-slate-700"><p class="text-sm text-amber-400 font-semibold">Validación del supervisor</p>
    <div class="g2">${field('supName','Supervisor *',me.name,'required readonly')}${field('supDate','Fecha de validación *',today(),'required','date')}</div>
    <label class="block text-xs text-slate-400 font-semibold">Observaciones del supervisor <span class="font-normal">(obligatorio si devuelves el trabajo)</span><textarea maxlength="5000" name="supNotes" rows="2" class="inp mt-1 font-normal"></textarea></label>
    ${sigBox('Firma del supervisor')}
    <p id="supmsg" class="text-xs text-red-400 hidden"></p>
    <div class="flex justify-end gap-2 pt-3 border-t border-slate-700" style="position:sticky;bottom:-1rem;background:#1e293b;padding-bottom:1rem;margin-top:.75rem;z-index:5">
      <button type="button" onclick="decidePm('${p.id}','no')" class="btn bg-red-500/20 text-red-400">↩️ Devolver</button>
      <button type="button" onclick="decidePm('${p.id}','ok')" class="btn bg-emerald-500 text-slate-950">✅ Aprobar y cerrar</button></div></form>`,'40rem');
  sigInit(mySig());
}
function decidePm(id,how){
  const form=$('supf');if(!form||!supOk)return;if(!form.reportValidity())return;
  const f=Object.fromEntries(new FormData(form)),p=pms.find(x=>x.id===id);if(!p)return;if(selfClosed(p)){supErr('No puedes validar un trabajo cerrado por ti. Debe validarlo otro supervisor o el planner.');return}
  const name=me.name,notes=(f.supNotes||'').trim();try{sessionStorage.setItem('supName',name)}catch(_){}
  if(how==='ok'){
    if(!sig.drawn){supErr('Falta la firma del supervisor para aprobar y cerrar la OT.');return}
    put('preventive',{...p,status:'COMPLETADO',supName:name,supPos:me.position||'',supDate:f.supDate,supNotes:notes,supSignature:sigData(),rejectNote:'',rejectBy:'',rejectDate:''});hide();
  }else{
    if(!notes){supErr('Escribe en Observaciones el motivo por el que devuelves la OT al técnico.');return}
    put('preventive',{...p,status:'PROGRAMADO',rejectNote:notes,rejectBy:name,rejectDate:f.supDate,closeSignature:'',supName:'',supDate:'',supNotes:'',supSignature:''});hide();
  }
}

/* ---------- Importar programa desde CSV (Excel) ---------- */
const nk=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,'');
function parseCsv(text){
  text=text.replace(/^﻿/,'');const first=text.split(/\r?\n/)[0]||'';
  const d=[';',',','\t'].map(c=>[c,first.split(c).length]).sort((a,b)=>b[1]-a[1])[0][0];
  const rows=[];let row=[],cur='',q=false;
  for(let i=0;i<text.length;i++){const ch=text[i];
    if(q){if(ch==='"'){if(text[i+1]==='"'){cur+='"';i++}else q=false}else cur+=ch}
    else if(ch==='"')q=true;
    else if(ch===d){row.push(cur);cur=''}
    else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cur);cur='';if(row.some(c=>c.trim()!==''))rows.push(row);row=[]}
    else cur+=ch}
  row.push(cur);if(row.some(c=>c.trim()!==''))rows.push(row);return rows;
}
function parseDate(s){
  s=String(s||'').trim();let m=s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/),y,mo,d;
  if(m){y=+m[1];mo=+m[2];d=+m[3]}else if(m=s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/)){d=+m[1];mo=+m[2];y=+m[3];if(y<100)y+=2000}else return '';
  const dt=new Date(y,mo-1,d);if(dt.getFullYear()!==y||dt.getMonth()!==mo-1||dt.getDate()!==d)return '';
  return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');
}
let impRows=[];
function openImport(){if(!isSup())return;
  const e0=fleet[0]||{code:'EX-01',hours:0};
  const tpl='﻿codigo_equipo;plan;fecha_programada;horometro_programado;responsable;actividades;notas\n'+e0.code+';Mantenimiento 250 h;15/12/2026;'+(Number(e0.hours)||0)+';Taller Central;Cambio de aceite y filtro|Revisión de frenos|Engrase general;Coordinar con operaciones\n';
  const url=URL.createObjectURL(new Blob([tpl],{type:'text/csv;charset=utf-8'}));impRows=[];
  show(`<h3 class="font-bold mb-1">📥 Importar preventivos programados</h3>
  <p class="text-xs text-slate-400 mb-3">Prepara tu programa en Excel y guárdalo como <b>CSV UTF-8</b> (Archivo → Guardar como). Cada fila es un mantenimiento.</p>
  <div class="bg-slate-900 p-3 rounded-lg text-xs text-slate-300 space-y-1"><p><b class="text-amber-400">codigo_equipo</b> * — el código tal como está en Flota (ej. VQ-01)</p><p><b class="text-amber-400">plan</b> * — ej. Mantenimiento 250 h</p><p><b class="text-amber-400">fecha_programada</b> * — DD/MM/AAAA</p>
  <p><b>horometro_programado</b>, <b>responsable</b>, <b>notas</b> — opcionales</p><p><b>actividades</b> — opcional, separadas con | (si lo dejas vacío se usan las actividades estándar del tipo de equipo)</p></div>
  <div class="grid gap-2 mt-3"><a href="${url}" download="plantilla_preventivos.csv" class="btn bg-slate-700 text-center" style="text-decoration:none">⬇️ Descargar plantilla (CSV)</a>
  <a href="${url}" target="_blank" rel="noopener" class="btn bg-slate-800 border border-slate-600 text-center" style="text-decoration:none">🔍 Abrir plantilla en pestaña nueva</a>
  <input type="file" accept=".csv,.txt,text/csv" onchange="readImport(this)"></div>
  <div id="imp-out" class="mt-3"></div>
  <div class="flex justify-end gap-2 pt-3 border-t border-slate-700 mt-3"><button type="button" onclick="hide()" class="btn bg-slate-700">Cerrar</button><button id="imp-go" type="button" onclick="doImportPm()" class="btn bg-amber-500 text-slate-950" disabled style="opacity:.5">Importar</button></div>`);
}
async function readImport(inp){
  const f=inp.files[0];if(!f)return;if(!/\.(csv|txt)$/i.test(f.name)||f.size>5e6){inp.value='';return note('Solo archivos .csv o .txt de hasta 5 MB.')}const out=$('imp-out'),go=$('imp-go');go.disabled=true;go.style.opacity='.5';impRows=[];
  const buf=await f.arrayBuffer();let txt;try{txt=new TextDecoder('utf-8',{fatal:true}).decode(buf)}catch(_){txt=new TextDecoder('windows-1252').decode(buf)}
  const rows=parseCsv(txt);
  if(rows.length<2){out.innerHTML='<p class="text-xs text-red-400">El archivo no tiene datos: necesita una fila de encabezados y al menos un mantenimiento.</p>';return}
  const hd=rows[0].map(nk),col=n=>hd.findIndex(h=>n.includes(h));
  const ix={eq:col(['codigoequipo','equipo','codigo','code','codequipo']),plan:col(['plan','mantenimiento','tipo','tipomantenimiento','planmantenimiento']),date:col(['fechaprogramada','fecha','programado']),
    hours:col(['horometroprogramado','horometro','odometro','horas']),resp:col(['responsable','taller','tecnico']),acts:col(['actividades','tareas']),notes:col(['notas','observaciones','comentarios'])};
  if(ix.eq<0||ix.plan<0||ix.date<0){out.innerHTML='<p class="text-xs text-red-400">Faltan columnas obligatorias. Usa los encabezados: codigo_equipo, plan, fecha_programada (descarga la plantilla).</p>';return}
  const ok=[],bad=[],base=String(Date.now()).slice(-7);let dup=0;
  rows.slice(1).forEach((r,n)=>{const line=n+2,g=i=>i<0?'':String(r[i]||'').trim();
    const e=fleet.find(x=>String(x.code).trim().toLowerCase()===g(ix.eq).toLowerCase());
    if(!e){bad.push(`Fila ${line}: el equipo "${g(ix.eq)}" no existe en la Flota`);return}
    if(!g(ix.plan)){bad.push(`Fila ${line}: falta el plan`);return}
    const dt=parseDate(g(ix.date));if(!dt){bad.push(`Fila ${line}: fecha inválida "${g(ix.date)}" (usa DD/MM/AAAA)`);return}
    const same=o=>o.fleetId===e.id&&o.plan===g(ix.plan)&&o.scheduledDate===dt;
    if(pms.some(same)||ok.some(same)){dup++;return}
    const hrs=g(ix.hours).replace(',','.');let acts=g(ix.acts).split('|').map(x=>x.trim()).filter(Boolean);if(!acts.length)acts=defActs(e.category);
    ok.push({id:'PM-'+base+String(ok.length).padStart(3,'0'),fleetId:e.id,plan:g(ix.plan),scheduledDate:dt,scheduledHours:(hrs!==''&&!isNaN(Number(hrs)))?Number(hrs):'',responsible:g(ix.resp),plannedActs:acts,notes:g(ix.notes),status:'PROGRAMADO'});
  });
  impRows=ok;
  out.innerHTML=`<div class="bg-slate-900 p-3 rounded-lg text-xs space-y-1"><p class="text-emerald-400 font-semibold">✔ ${ok.length} listo(s) para importar</p>${dup?`<p class="text-slate-400">${dup} repetido(s) omitido(s) (mismo equipo, plan y fecha)</p>`:''}${bad.length?`<p class="text-red-400 font-semibold">✖ ${bad.length} con error (no se importan):</p>${bad.slice(0,8).map(x=>`<p class="text-red-400">${esc(x)}</p>`).join('')}${bad.length>8?`<p class="text-slate-400">… y ${bad.length-8} más</p>`:''}`:''}
  ${ok.slice(0,4).map(o=>`<p class="text-slate-300">• ${esc(eqOf(o.fleetId).code)} · ${esc(o.plan)} · ${fmtD(o.scheduledDate)}</p>`).join('')}${ok.length>4?`<p class="text-slate-500">… y ${ok.length-4} más</p>`:''}</div>`;
  if(ok.length){go.disabled=false;go.style.opacity='1';go.textContent='Importar '+ok.length}
}
async function doImportPm(){
  if(!impRows.length)return;const n=impRows.length,nums=await takeNums('ot',n),list=impRows.map((o,i)=>({...o,otNum:nums[i]}));impRows=[];
  putMany('preventive',list).then(()=>note(`Se importaron ${n} mantenimiento(s) preventivo(s).`));
}

/* ---------- PDF de la OT de mantenimiento preventivo ---------- */
function makePdfPm(id){
  const p=pms.find(x=>x.id===id);if(!p)return;
  const J=window.jspdf&&window.jspdf.jsPDF;
  if(!J){note('No se pudo cargar el generador de PDF. Revisa tu conexión a internet y recarga la página.');return}
  const e=eqOf(p.fleetId),doc=new J({unit:'mm',format:'a4'}),W=210,M=15,done=!!p.acts,ot=pmOt(p);let y=0;
  const pt=s=>String(s==null?'':s).replace(/[^\x20-\x7E -ÿ\n]/g,'');
  const need=h=>{if(y+h>280){doc.addPage();y=M+4}};
  doc.setFillColor(15,23,42);doc.rect(0,0,W,28,'F');doc.setTextColor(255,255,255);
  doc.setFont('helvetica','bold');doc.setFontSize(17);doc.text('ORDEN DE TRABAJO',M,13);
  doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text('Mantenimiento preventivo',M,20);
  doc.setFont('helvetica','bold');doc.setFontSize(14);doc.text(ot,W-M,13,{align:'right'});
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text('Emitida: '+fmtD(today()),W-M,20,{align:'right'});
  y=37;
  const sec=t=>{need(14);doc.setFillColor(241,245,249);doc.rect(M,y-5,W-2*M,7.5,'F');doc.setTextColor(180,83,9);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(t,M+2,y);y+=8;doc.setTextColor(30,41,59)};
  const row=(l,v)=>{const t=doc.splitTextToSize(pt(v===''||v==null?'-':v),W-2*M-52);need(t.length*5+2);doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.text(l,M+2,y);doc.setFont('helvetica','normal');doc.text(t,M+52,y);y+=t.length*5+1.5};
  const para=v=>{const t=doc.splitTextToSize(pt(v||'-'),W-2*M-4);doc.setFont('helvetica','normal');doc.setFontSize(9.5);t.forEach(l=>{need(5);doc.text(l,M+2,y);y+=5});y+=2};
  const table=(heads,ws,rows)=>{
    need(14);doc.setFillColor(226,232,240);doc.rect(M,y-4.5,W-2*M,6.5,'F');doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(30,41,59);
    let x=M;heads.forEach((h,i)=>{doc.text(h,x+1.5,y);x+=ws[i]});y+=6;doc.setFont('helvetica','normal');doc.setFontSize(8.5);
    rows.forEach(r=>{const cells=r.map((c,i)=>doc.splitTextToSize(pt(c),ws[i]-3)),n=Math.max(...cells.map(c=>c.length));need(n*4+3);
      let x=M;cells.forEach((c,i)=>{doc.text(c,x+1.5,y);x+=ws[i]});const ly=y+(n-1)*4+2;doc.setDrawColor(226,232,240);doc.line(M,ly,W-M,ly);y=ly+4.5});
    y+=2;
  };
  sec('DATOS DEL EQUIPO');
  row('Codigo:',e.code);row('Equipo:',(e.brand||'')+' '+(e.model||''));row('Nº de serie:',e.serialNumber);row('Categoria:',e.category);row('Ubicacion / Frente:',e.location);
  y+=2;sec('DATOS DEL MANTENIMIENTO');
  row('Codigo PM:',p.id);row('Plan:',p.plan);row('Fecha programada:',fmtD(p.scheduledDate));row('Horometro programado:',fmtH(p.scheduledHours));row('Responsable / taller:',p.responsible);row('Estado:',PM_LONG[p.status]||p.status);
  if(p.notes)row('Notas:',p.notes);
  if(done){y+=2;sec('EJECUCION');row('Fecha de ejecucion:',fmtD(p.execDate));row('Hora inicio / fin:',p.startTime+' - '+p.endTime);row('Duracion (h):',p.durationH);row('Horometro al cierre:',fmtH(p.closeHours));row('Tecnico responsable:',p.closeTech)}
  const acts=p.acts&&p.acts.length?p.acts:(p.plannedActs||[]).map(d=>({d,res:'',note:''})),st=actStats(p.acts);
  y+=2;sec(done?`ACTIVIDADES EJECUTADAS (Realizadas: ${st.OK}  Observadas: ${st.OBS}  No aplica: ${st.NA})`:'ACTIVIDADES PROGRAMADAS');
  table(['N°','Actividad','Resultado','Observacion'],[10,76,26,68],acts.map((a,i)=>[i+1,a.d,a.res?RES_LAB[a.res]:'Pendiente',a.note||'']));
  if(p.parts&&p.parts.length){y+=1;sec('REPUESTOS E INSUMOS UTILIZADOS');table(['N°','Descripcion','Cantidad','Unidad'],[10,110,30,30],p.parts.map((r,i)=>[i+1,r.d,r.qty,r.unit||'-']))}
  if(p.crew&&p.crew.length){const hh=p.crew.reduce((t,r)=>t+(Number(r.h)||0),0);y+=1;sec(`PERSONAL Y HORAS-HOMBRE (Total: ${hh} h-h)`);table(['N°','Nombre','Horas'],[10,140,30],p.crew.map((r,i)=>[i+1,r.n,r.h]))}
  if(p.closeNotes){y+=1;sec('OBSERVACIONES GENERALES');para(p.closeNotes)}
  if(p.recommendations){y+=1;sec('RECOMENDACIONES / TRABAJOS PENDIENTES');para(p.recommendations)}
  const photos=(t,a)=>{if(!a||!a.length)return;y+=1;sec(t);const w=42,h=32,g=4;let x=M+2;need(h+4);a.forEach(src=>{if(x+w>W-M+1){x=M+2;y+=h+g;need(h+4)}try{doc.addImage(src,'JPEG',x,y,w,h)}catch(_){}x+=w+g});y+=h+6};
  photos('FOTOS ANTES',p.photosBefore);photos('FOTOS DESPUES / EVIDENCIA',p.photosAfter);
  if(p.supName){y+=1;sec('VALIDACION DEL SUPERVISOR');row('Supervisor:',p.supName);row('Fecha de validacion:',fmtD(p.supDate));if(p.supNotes){row('Observaciones:',p.supNotes)}}
  else if(p.status==='PENDIENTE_VALIDACION'){y+=1;sec('VALIDACION DEL SUPERVISOR');row('Estado:','Pendiente de validacion por el supervisor')}
  if(p.rejectNote&&p.status==='PROGRAMADO'){y+=1;sec('OT DEVUELTA POR EL SUPERVISOR');row('Supervisor:',p.rejectBy);row('Fecha:',fmtD(p.rejectDate));para(p.rejectNote)}
  y+=4;need(52);sec('FIRMAS');y+=2;
  const bw=(W-2*M-10)/2,top=y;
  [['Tecnico responsable',done?p.closeTech:'',p.closeSignature,done?p.closePos:''],['Supervisor / Aprobacion',p.supName||'',p.supSignature,p.supName?p.supPos:'']].forEach(([lab,nom,img,cg],i)=>{
    const x=M+i*(bw+10);doc.setDrawColor(148,163,184);doc.rect(x,top,bw,30);
    if(img){try{doc.addImage(img,'PNG',x+3,top+2,bw-6,Math.min(26,(bw-6)*0.35))}catch(_){}}
    doc.line(x+4,top+34,x+bw-4,top+34);doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(30,41,59);doc.text(lab,x+bw/2,top+39,{align:'center'});
    doc.setFont('helvetica','normal');doc.text(pt(nom)||'Nombre y firma',x+bw/2,top+44,{align:'center'});
    if(cg){doc.setFontSize(8);doc.setTextColor(100,116,139);doc.text(pt(cg),x+bw/2,top+48.5,{align:'center'})}
  });
  const n=doc.getNumberOfPages();for(let q=1;q<=n;q++){doc.setPage(q);doc.setFontSize(8);doc.setTextColor(100,116,139);doc.text(ot+'  |  Pagina '+q+' de '+n,W/2,290,{align:'center'})}
  fileOut(doc.output('blob'),ot+'_'+String(e.code||'equipo').replace(/[^A-Za-z0-9_-]/g,'')+'.pdf','📄 Orden de trabajo lista');
}

/* =====================================================================
   CONTROL DE ENGRASE (plan por equipo + registro + historial)
   ===================================================================== */
let grs=[],gpl=[],sps=[];
const GR_ST={VENCIDO:'bg-red-500/10 text-red-400 border-red-500/30',PROXIMO:'bg-amber-500/10 text-amber-400 border-amber-500/30',AL_DIA:'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',SINREG:'bg-blue-500/10 text-blue-400 border-blue-500/30',SINPLAN:'bg-slate-900 text-slate-400 border-slate-700'};
const GR_L={VENCIDO:'VENCIDO',PROXIMO:'POR VENCER',AL_DIA:'AL DÍA',SINREG:'SIN REGISTRO',SINPLAN:'SIN PLAN'};
const GR_BAR={VENCIDO:'bg-red-500',PROXIMO:'bg-amber-500',AL_DIA:'bg-emerald-500',SINREG:'bg-blue-500',SINPLAN:'bg-blue-500'};
const GR_GREASE=['Grasa multipropósito EP-2','Grasa de litio EP-2','Grasa con bisulfuro de molibdeno (Moly)','Grasa para rodamientos','Grasa para quinta rueda'];
const GR_PTS={
 'Excavadora':['Pasador pie de pluma','Cilindros de pluma (cabeza y vástago)','Pasador pluma-brazo','Cilindro de brazo','Pasador brazo-cuchara','Bieleta y balancín de cuchara','Cilindro de cuchara','Corona de giro (swing)','Rodillos tensores / rueda guía'],
 'Cargador Frontal':['Pasadores del brazo de carga','Cilindros de levante y volteo','Pasadores del balancín','Articulación central (pines)','Cruceta del cardán','Cojinetes de eje delantero y trasero'],
 'Tractor de Oruga':['Ecualizadora','Pasadores de bastidor','Rueda guía y rodillos','Pines del cilindro de hoja','Pasadores del ripper','Cruceta del cardán'],
 'Camión Minero':['Rótulas de dirección','Cilindros de dirección','Pines de tolva y cilindros de levante','Barra estabilizadora','Rodamientos de ruedas','Cruceta del cardán'],
 'Motoniveladora':['Círculo y rodamientos','Cilindros de hoja','Articulación','Eje delantero','Pivotes de tándem','Cruceta del cardán'],
 'Perforadora':['Cabezal rotatorio','Cilindros de levante del mástil','Pines del mástil','Cadena de avance','Rodillos del tren de rodaje'],
 'Volquete':['Crucetas del cardán','Rótulas de dirección','Terminales de dirección','Pines y bocinas de la tolva','Bujes de suspensión','Pivote de eje','Quinta rueda / ballestas'],
 'Cisterna de Agua':['Crucetas del cardán','Rótulas de dirección','Terminales de dirección','Bujes de suspensión','Pivotes de válvulas y bomba'],
 'Minibús':['Crucetas del cardán','Rótulas superiores e inferiores','Terminales de dirección','Bujes de suspensión'],
 'Camioneta':['Crucetas del cardán','Rótulas','Terminales de dirección','Rodamientos (según modelo)'],
 'Grupo Electrógeno':['Rodamientos del alternador (según fabricante)','Cojinetes del ventilador','Bisagras y cerraduras de la cabina','Articulación del acople / tráiler'],
 'Luminaria':['Mástil telescópico y poleas','Winche de elevación','Articulaciones del tráiler','Pivote de la lanza']};
const GR_LIGHT=['Camioneta','Minibús','Cisterna de Agua','Volquete','Grupo Electrógeno','Luminaria'];
const defGrPts=c=>[...(GR_PTS[c]||['Puntos de engrase generales del equipo'])];
const defGrFreq=c=>GR_LIGHT.includes(c)?{h:0,d:30}:{h:50,d:7};
const fmtISO=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const addDays=(s,n)=>{const d=day(s);d.setDate(d.getDate()+n);return fmtISO(d)};
/* Engrase y Neumáticos: ahora los lleva el módulo integrado (carpeta eqn/). Aquí solo se lee su resumen. */
const eqnSumOf=(k,e)=>{const S=window.EQN_SUM;return S&&e&&e.code?S[k][String(e.code).toUpperCase()]:null};
const grLogs=fid=>{const s=eqnSumOf('gr',fleet.find(x=>x.id===fid));return s?(s.last||[]).map(x=>({date:x.date,hours:x.hours,by:x.by,tipo:x.tipo})):[]};
function grStatus(e){const s=eqnSumOf('gr',e);return s?{k:s.k,lines:(s.lines||[]).map(x=>esc(x))}:{k:window.EQN_SUM?'SINREG':'SINREG',lines:window.EQN_SUM?[]:['Cargando el módulo de engrase…']}}
function grLines(g){
  if(g.lines)return g.lines;const o=[];if(!g.pl||!g.last)return o;
  if(g.remH!=null)o.push(g.remH<0?`Vencido por ${fmtH(Math.round(-g.remH*10)/10)} h`:`Próximo a las ${fmtH(Number(g.last.hours)+Number(g.pl.freqHours))} h (faltan ${fmtH(Math.round(g.remH*10)/10)} h)`);
  if(g.remD!=null){const due=addDays(g.last.date,g.pl.freqDays);o.push(g.remD<0?`Vencido hace ${-g.remD} día(s) (era el ${fmtD(due)})`:`Próximo el ${fmtD(due)} (${g.remD===0?'es hoy':'faltan '+g.remD+' día(s)'})`)}
  return o;
}
const grBadge=k=>`<span class="bdg ${GR_ST[k]}">${GR_L[k]}</span>`;
const grCount=k=>fleetIn('gr').filter(e=>grStatus(e).k===k).length;
function grDueHtml(){
  const l=fleetIn('gr').map(e=>({e,g:grStatus(e)})).filter(x=>x.g.k==='VENCIDO'||x.g.k==='PROXIMO').sort((a,b)=>(a.g.k==='VENCIDO'?0:1)-(b.g.k==='VENCIDO'?0:1)).slice(0,6);
  return `<div class="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2"><div class="flex justify-between items-center gap-2"><h3 class="font-semibold">🛢️ Engrase por atender</h3><button onclick="tab('gr')" class="btn bg-slate-700 !py-1">Ver todos</button></div>
  ${l.map(({e,g})=>`<div class="flex justify-between items-center gap-2 text-sm border-t border-slate-700" style="padding-top:.5rem"><div class="min-w-0"><b class="text-amber-400">${esc(e.code)}</b> <span class="text-slate-300">${esc(e.brand)} ${esc(e.model)}</span></div>${grBadge(g.k)}</div>`).join('')||'<p class="text-slate-500 text-sm">Todos los equipos con plan están al día.</p>'}</div>`;
}

/* =====================================================================
   CONTROL DE NEUMÁTICOS (cocadas, posiciones, parámetros de cambio)
   ===================================================================== */
let trs=[],trp=[],trSub='pos',trFid='',trWarn=false;
const TR_OTR=['Camión Minero','Cargador Frontal','Motoniveladora'],TR_ROAD=['Volquete','Cisterna de Agua'];
const TR_LAY={
 'Volquete':'DEL1-I | DEL1-D\nDEL2-I | DEL2-D\nT1-IE T1-II | T1-DI T1-DE\nT2-IE T2-II | T2-DI T2-DE',
 'Cisterna de Agua':'DEL-I | DEL-D\nT1-IE T1-II | T1-DI T1-DE\nT2-IE T2-II | T2-DI T2-DE\nREP',
 'Camión Minero':'DEL-I | DEL-D\nTRA-IE TRA-II | TRA-DI TRA-DE',
 'Cargador Frontal':'DEL-I | DEL-D\nTRA-I | TRA-D',
 'Motoniveladora':'DEL-I | DEL-D\nT1-I | T1-D\nT2-I | T2-D',
 'Minibús':'DEL-I | DEL-D\nTRA-IE TRA-II | TRA-DI TRA-DE\nREP',
 'Camioneta':'DEL-I | DEL-D\nTRA-I | TRA-D\nREP',
 'Luminaria':'I | D'};
const TR_COL={CAMBIO:'#ef4444',ALERTA:'#f59e0b',SINMED:'#3b82f6',OK:'#10b981',LIBRE:'#475569'};
const TR_ST={CAMBIO:'bg-red-500/10 text-red-400 border-red-500/30',ALERTA:'bg-amber-500/10 text-amber-400 border-amber-500/30',SINMED:'bg-blue-500/10 text-blue-400 border-blue-500/30',OK:'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',STOCK:'bg-slate-900 text-slate-300 border-slate-700',RECAPADO:'bdg-v',DESCARTADO:'bg-slate-900 text-slate-500 border-slate-700'};
const TR_L={CAMBIO:'CAMBIAR',ALERTA:'ALERTA',SINMED:'MEDIR',OK:'OK',STOCK:'EN STOCK',RECAPADO:'EN RECAPADO',DESCARTADO:'DESCARTADO'};
const trBadge=k=>`<span class="bdg ${TR_ST[k]||''}">${TR_L[k]||esc(k)}</span>`;
const num=(v,b)=>(v===''||v==null||isNaN(Number(v)))?b:Number(v);

/* ---------- Parámetros y posiciones ---------- */
function trParam(cat){
  const d=trp.find(x=>x.category===cat)||{},base=TR_OTR.includes(cat)?{min:15,alert:25,diff:8,readDays:7}:TR_ROAD.includes(cat)?{min:4,alert:8,diff:3,readDays:15}:{min:3,alert:5,diff:2,readDays:30};
  return{min:num(d.min,base.min),alert:num(d.alert,base.alert),diff:num(d.diff,base.diff),readDays:num(d.readDays,base.readDays),rotate:num(d.rotate,0),psiMin:num(d.psiMin,0),psiMax:num(d.psiMax,0),
    unit:d.unit||((cat==='Camioneta'||cat==='Minibús')?'km':'h'),layout:d.layout!=null?d.layout:(TR_LAY[cat]||''),custom:!!trp.find(x=>x.category===cat),size:'',cocadaNew:'',own:false};
}
// Parámetros de un equipo: los de su categoría + lo que se cargó libremente en ⚙️ Configuración del equipo
function trParamE(e){
  const P=trParam(e&&e.category),c=e&&e.id?trCfg(e.id):null;if(!c)return P;const o={...P},has=v=>v!==''&&v!=null&&!isNaN(Number(v));
  if(has(c.min))o.min=Number(c.min);if(has(c.alert))o.alert=Number(c.alert);if(has(c.cocadaNew))o.cocadaNew=Number(c.cocadaNew);
  o.size=String(c.size||'');o.own=has(c.min)||has(c.alert);return o;
}
const trCfg=fid=>trp.find(x=>x.fleetId===fid&&String(x.id).startsWith('TC-'));
const trSort=(a,b)=>(a.d||'').localeCompare(b.d||'')||(Number(a.h)||0)-(Number(b.h)||0)||(a.ts||0)-(b.ts||0);
const trMounted=fid=>{const s=eqnSumOf('tr',fleet.find(x=>x.id===fid));return s?s.mounted.map(m=>({_eqn:1,pos:m.pos,code:m.code,_k:m.k,_c:m.c,fleetId:fid})):[]};
const eqnPos=e=>{const s=eqnSumOf('tr',e);return s?Array.from({length:s.pos},(_,i)=>i):[]};
/* ---------- Estado, desgaste y proyección ---------- */
function trRun(t){const e=fleet.find(x=>x.id===t.fleetId);return(Number(t.hoursRun)||0)+(t.status==='MONTADO'&&e?Math.max(0,(Number(e.hours)||0)-(Number(t.mountHours)||0)):0)}
function trCph(t){const h=trRun(t),c=(Number(t.cost)||0)+(Number(t.retreadCost)||0);return h>0&&c>0?c/h:null}
function trHealth(t){
  if(t&&t._eqn)return{k:t._k,c:t._c,flags:[],e:fleet.find(x=>x.id===t.fleetId)||{}};
  if(t.status!=='MONTADO')return{k:t.status,flags:[]};
  const e=fleet.find(x=>x.id===t.fleetId)||{},P=trParamE(e),c=(t.lastCocada===''||t.lastCocada==null)?null:Number(t.lastCocada),flags=[];let k='OK',late=0;
  if(c==null)k='SINMED';else if(c<=P.min)k='CAMBIO';else if(c<=P.alert)k='ALERTA';
  if(t.lastReadDate&&P.readDays){late=-daysTo(t.lastReadDate)-P.readDays;if(k==='OK'&&late>0)k='SINMED'}
  if(c==null)flags.push('Sin medición de cocada');else if(late>0)flags.push(`Medición vencida hace ${late} día(s)`);
  if(t.lastDiff!=null&&P.diff&&Number(t.lastDiff)>P.diff)flags.push(`Desgaste irregular (${t.lastDiff} mm de diferencia): revisar alineamiento / presión / rotar`);
  if(t.lastPsi!==''&&t.lastPsi!=null){if(P.psiMin&&Number(t.lastPsi)<P.psiMin)flags.push(`Presión baja (${t.lastPsi} psi)`);if(P.psiMax&&Number(t.lastPsi)>P.psiMax)flags.push(`Presión alta (${t.lastPsi} psi)`)}
  const mv=t.moveHours!=null?Number(t.moveHours):Number(t.mountHours);
  if(P.rotate&&!isNaN(mv)&&(Number(e.hours)||0)-mv>=P.rotate)flags.push(`Rotación recomendada (cada ${P.rotate} ${P.unit})`);
  let proj=null;
  const sc=t.mountCocada!=null&&t.mountCocada!==''?Number(t.mountCocada):Number(t.cocadaInit),sh=Number(t.mountHours),lh=Number(t.lastReadHours);
  if(c!=null&&!isNaN(sc)&&!isNaN(sh)&&lh>sh&&sc>c){const rate=(sc-c)/(lh-sh),estH=c<=P.min?lh:lh+(c-P.min)/rate;proj={per1000:Math.round(rate*1000*10)/10,estH:Math.round(estH),rem:Math.max(0,Math.round(estH-(Number(e.hours)||0)))}}
  const init=Number(t.cocadaInit)||0,pct=c!=null&&init>P.min?Math.max(0,Math.min(100,Math.round((init-c)/(init-P.min)*100))):null;
  return{k,flags,P,e,proj,c,pct};
}
const trList=()=>fleetIn('tr').flatMap(e=>trMounted(e.id)).map(t=>({t,h:trHealth(t)}));
const trCount=k=>trList().filter(x=>x.h.k===k).length;
function trDueHtml(){
  const ord={CAMBIO:0,ALERTA:1,SINMED:2},l=trList().filter(x=>ord[x.h.k]!=null).sort((a,b)=>ord[a.h.k]-ord[b.h.k]).slice(0,6);
  return `<div class="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2"><div class="flex justify-between items-center gap-2"><h3 class="font-semibold">🛞 Neumáticos por atender</h3><button onclick="eqnOpen('neumaticos')" class="btn bg-slate-700 !py-1">Ver todos</button></div>
  ${l.map(({t,h})=>`<div class="flex justify-between items-center gap-2 text-sm border-t border-slate-700" style="padding-top:.5rem"><div class="min-w-0"><b class="text-amber-400">${esc(h.e.code||'-')}</b> <span class="text-slate-300">${esc(t.pos)} · ${esc(t.code)}</span>${h.c!=null?` <span class="text-slate-400">${h.c} mm</span>`:''}</div>${trBadge(h.k)}</div>`).join('')||'<p class="text-slate-500 text-sm">Sin neumáticos en alerta.</p>'}</div>`;
}

/* ---------- Hoja de medición (PDF) ---------- */
/* ============ INICIO POR ROL, FICHA DE EQUIPO Y REGISTRO RÁPIDO ============ */
const ROLE_N={admin:'Planner',supervisor:'Supervisor',tecnico:'Técnico'},CR_O={P1:0,P2:1,P3:2,P4:3};
const dCard=(t,body,more)=>`<div class="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2"><div class="flex justify-between items-center gap-2"><h3 class="font-semibold">${t}</h3>${more||''}</div>${body}</div>`;
const dRow=(l,r)=>`<div class="flex justify-between items-center gap-2 text-sm border-t border-slate-700" style="padding-top:.5rem"><div class="min-w-0">${l}</div><div class="flex gap-1 items-center" style="flex-shrink:0">${r}</div></div>`;
const dEmpty=t=>`<p class="text-sm text-slate-500">${t}</p>`;

const SYM=(s)=>`<svg width="${s}" height="${s}" viewBox="0 0 64 64" aria-hidden="true" style="flex-shrink:0"><circle cx="32" cy="32" r="23" fill="none" stroke="#2DD4BF" stroke-width="8" stroke-dasharray="9.03 9.03"/><circle cx="32" cy="32" r="21" fill="#2DD4BF"/><path d="M22.5 32.5 L29 39 L42 25.5" fill="none" stroke="#0F2A44" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
let pendF='all',pendLim=8;
function pendSet(k){pendF=k;pendLim=8;renderDash();const e=$('pend');if(e&&e.scrollIntoView)e.scrollIntoView({behavior:'smooth',block:'start'})}
function pendMore(){pendLim+=10;renderDash()}
const PT={ot:['MI OT','#fbbf24','rgba(245,158,11,.2)'],par:['PARADA','#f87171','rgba(239,68,68,.15)'],bk:['BACKLOG','#fbbf24','rgba(245,158,11,.15)'],pm:['PREVENTIVO','#60a5fa','rgba(59,130,246,.15)'],gr:['ENGRASE','#2dd4bf','rgba(45,212,191,.15)'],tr:['NEUMÁTICO','#fb923c','rgba(249,115,22,.15)'],val:['VALIDAR','#c4b5fd','rgba(139,92,246,.18)']};
const pTag=k=>`<span style="font-size:10px;font-weight:700;letter-spacing:.04em;color:${PT[k][1]};background:${PT[k][2]};border-radius:6px;padding:1px 6px;margin-right:.35rem">${PT[k][0]}</span>`;
const pRow=(k,sev,l,r)=>({k,sev,html:`<div class="flex justify-between items-center gap-2 text-sm border-t border-slate-700" style="padding-top:.6rem;padding-bottom:.1rem"><div class="min-w-0" style="word-break:break-word">${l}</div><div class="flex gap-1 items-center" style="flex-shrink:0">${r}</div></div>`});
function pendItems(){
  const L=[];
  misOpen().forEach(b=>{const e=eqOf(b.fleetId);L.push(pRow('ot',0,`${pTag('ot')}<b class="mono">${esc(b.ot.num)}</b> · <b class="text-amber-400">${esc(e.code)}</b> <span class="text-slate-300">${esc(b.component)}</span><p class="text-xs text-slate-400">Asignada a ti · emitida ${fmtD(b.ot.date)}</p>`,`<button onclick="makePdfOt('${b.id}')" class="btn bg-slate-700 !py-1">📄</button><button onclick="openClose('${b.id}')" class="btn bg-emerald-500/20 text-emerald-400 !py-1">📝 Reporte</button>`))});
  stOpen().forEach(s=>L.push(pRow('par',0,`${pTag('par')}<b class="text-amber-400">${esc(s.cod)}</b> <span class="text-slate-300">${esc(s.motivo||'')}</span><p class="text-xs text-slate-400">${esc(s.flota)} · desde ${fmtDT(s.fp)} · ${esc(s.resp)}</p>`,stCan(s)?`<button onclick="openStop('${s.id}','close')" class="btn bg-emerald-500/20 text-emerald-400 !py-1">✅ Cerrar</button>`:`<button onclick="openStopView('${s.id}')" class="btn bg-slate-700 !py-1">👁️</button>`)));
  if(isSup()){
    backlogs.filter(b=>b.status==='PENDIENTE_VALIDACION').forEach(b=>{const e=eqOf(b.fleetId);L.push(pRow('val',1,`${pTag('val')}<b class="text-amber-400">${esc(e.code)}</b> <span class="text-slate-300">${esc(b.component)}</span><p class="text-xs text-slate-400">Backlog ${esc(bkNo(b))} esperando validación</p>`,`<button onclick="openValidate('${b.id}')" class="btn bg-violet-500/20 text-violet-300 !py-1">Revisar</button>`))});
    pms.filter(p=>p.status==='PENDIENTE_VALIDACION').forEach(p=>{const e=eqOf(p.fleetId);L.push(pRow('val',1,`${pTag('val')}<b class="text-amber-400">${esc(e.code)}</b> <span class="text-slate-300">${esc(p.plan)}</span><p class="text-xs text-slate-400">Preventivo esperando validación</p>`,`<button onclick="openValidatePm('${p.id}')" class="btn bg-violet-500/20 text-violet-300 !py-1">Revisar</button>`))});
  }
  bkOpenSorted().forEach(b=>{const e=eqOf(b.fleetId),d=delay(b),ret=b.rejectNote&&b.status==='EN_EJECUCION',sev=ret?0:b.criticality==='P1'?1:d?2:3;
    L.push(pRow('bk',sev,`${pTag('bk')}<b class="text-amber-400">${esc(e.code)}</b> <span class="text-slate-300">${esc(b.component)}</span><p class="text-xs ${ret||d?'text-red-400':'text-slate-400'}">${ret?'⚠️ Devuelto: '+esc(b.rejectNote):(d?'+'+d+' d de atraso · ':'')+esc(PR_L[b.criticality]||b.criticality)+' · '+(STL[b.status]||b.status)}</p>`,(otCanClose(b)?`<button onclick="openClose('${b.id}')" class="btn bg-emerald-500/20 text-emerald-400 !py-1">✅ Cerrar</button>`:`<button onclick="bkDetail('${b.id}')" class="btn bg-slate-700 !py-1">👁️</button>`)))});
  pms.filter(p=>p.status==='PROGRAMADO'&&p.scheduledDate&&(pmOver(p)||daysTo(p.scheduledDate)<=7)).sort((a,b)=>a.scheduledDate.localeCompare(b.scheduledDate)).forEach(p=>{const e=eqOf(p.fleetId),o=pmOver(p);
    L.push(pRow('pm',o?0:3,`${pTag('pm')}<b class="text-amber-400">${esc(e.code)}</b> <span class="text-slate-300">${esc(p.plan)}</span><p class="text-xs ${o?'text-red-400':'text-slate-400'}">${fmtD(p.scheduledDate)} · ${pmWhen(p)}</p>`,`<button onclick="openClosePm('${p.id}')" class="btn bg-emerald-500/20 text-emerald-400 !py-1">✅ Cerrar OT</button>`))});
  fleetIn('gr').map(e=>({e,g:grStatus(e)})).filter(x=>x.g.k==='VENCIDO'||x.g.k==='PROXIMO').forEach(({e,g})=>L.push(pRow('gr',g.k==='VENCIDO'?1:3,`${pTag('gr')}<b class="text-amber-400">${esc(e.code)}</b> <span class="text-slate-300">${esc(e.brand)} ${esc(e.model)}</span>`,grBadge(g.k)+`<button onclick="eqnOpen('engrase','${esc(e.code)}')" class="btn bg-slate-700 !py-1">🛢️</button>`)));
  const ord={CAMBIO:1,ALERTA:2};trList().filter(x=>ord[x.h.k]!=null).forEach(({t,h:q})=>L.push(pRow('tr',ord[q.k],`${pTag('tr')}<b class="text-amber-400">${esc(q.e.code||'-')}</b> <span class="text-slate-300">${esc(t.pos)} · ${esc(t.code)}</span>${q.c!=null?` <span class="text-slate-400">${q.c} mm</span>`:''}`,trBadge(q.k))));
  return L.map((x,i)=>({...x,i})).sort((a,b)=>a.sev-b.sev||a.i-b.i);
}
function dashPend(){
  const all=pendItems(),cnt={all:all.length};all.forEach(x=>cnt[x.k]=(cnt[x.k]||0)+1);
  const chips=[['all','Todo'],['ot','Mis OT'],['par','Paradas'],['val','Validar'],['bk','Backlogs'],['pm','Preventivos'],['gr','Engrase'],['tr','Neumáticos']].filter(c=>c[0]==='all'||cnt[c[0]]);
  if(!chips.some(c=>c[0]===pendF))pendF='all';
  const L=pendF==='all'?all:all.filter(x=>x.k===pendF);
  const chip=c=>`<button onclick="pendSet('${c[0]}')" style="flex-shrink:0;font-size:12px;font-weight:600;border-radius:999px;padding:.3rem .7rem;border:1px solid ${pendF===c[0]?'#2dd4bf':'#334155'};background:${pendF===c[0]?'rgba(45,212,191,.15)':'transparent'};color:${pendF===c[0]?'#5eead4':'#cbd5e1'}">${c[1]} <span style="opacity:.75">${cnt[c[0]]||0}</span></button>`;
  return `<div id="pend" class="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2" style="scroll-margin-top:4.5rem"><div class="flex justify-between items-center gap-2"><h3 class="font-semibold">📌 Pendientes</h3><span class="text-xs text-slate-400">por urgencia</span></div>
  <div style="display:flex;gap:.4rem;overflow-x:auto;padding-bottom:.25rem">${chips.map(chip).join('')}</div>
  ${L.length?L.slice(0,pendLim).map(x=>x.html).join('')+(L.length>pendLim?`<button onclick="pendMore()" class="btn bg-slate-700 w-full">Ver ${Math.min(10,L.length-pendLim)} más (${L.length-pendLim} restantes)</button>`:''):dEmpty('✅ Todo al día. No hay pendientes aquí.')}</div>`;
}
function dashKpis(){
  const o=stOpen().length,alta=backlogs.filter(b=>bkOpen(b)&&b.criticality==='P1').length,venc=pms.filter(pmOver).length,pv=isSup()?backlogs.filter(b=>b.status==='PENDIENTE_VALIDACION').length+pms.filter(p=>p.status==='PENDIENTE_VALIDACION').length:0,gv=grCount('VENCIDO'),tc=trCount('CAMBIO');
  const k=(n,l,c,f)=>`<button onclick="${f}" style="text-align:left;background:#1e293b;border:1px solid ${n?c+'66':'#334155'};border-radius:.75rem;padding:.4rem .6rem;flex:0 0 auto;min-width:96px"><span style="display:block;font-size:20px;font-weight:800;line-height:1.1;color:${n?c:'#64748b'}">${n}</span><span style="display:block;font-size:11px;color:#94a3b8">${l}</span></button>`;
  return `<div class="kpis">${k(o,'Paradas abiertas','#f87171',"pendSet('par')")}${isSup()?k(pv,'Por validar','#c4b5fd',"pendSet('val')"):''}${k(alta,'Backlogs críticos','#f87171',"pendSet('bk')")}${k(venc,'Preventivos vencidos','#f87171',"pendSet('pm')")}${k(gv,'Engrase vencido','#fbbf24',"pendSet('gr')")}${k(tc,'Neumát. a cambiar','#fb923c',"pendSet('tr')")}</div>`;
}
function dashHello(){const d=new Date(),dn=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'][d.getDay()],u=pendItems().filter(x=>x.sev<=1).length;
  return `<div style="background:linear-gradient(135deg,#0F2A44,#13395c);border:1px solid #1e4a73;border-radius:1rem;padding:1rem;display:flex;align-items:center;gap:.8rem">${SYM(44)}<div class="min-w-0"><h2 class="text-lg font-bold" style="color:#f8fafc">Hola, ${esc(String(me.name).split(' ')[0])}</h2><p class="text-xs" style="color:#a9bacb">${dn} ${fmtD(today())} · ${ROLE_N[me.role]||''}</p><p class="text-xs" style="margin-top:.25rem;color:${u?'#fbbf24':'#5eead4'};font-weight:600">${u?u+(u===1?' asunto requiere':' asuntos requieren')+' tu atención':'✅ Todo bajo control'}</p></div></div>`}
function dashQuick(){
  const big=(ic,l,f,c,bg)=>`<button onclick="${f}" style="display:flex;align-items:center;gap:.6rem;text-align:left;background:${bg};border:1px solid ${c}66;border-radius:.9rem;padding:.8rem .9rem;color:#f8fafc;min-height:56px"><span style="font-size:24px">${ic}</span><span style="font-size:14px;font-weight:700;line-height:1.2">${l}</span></button>`;
  const sm=(ic,l,f)=>`<button onclick="${f}" style="background:#1e293b;border:1px solid #334155;border-radius:.8rem;padding:.55rem .2rem;text-align:center;color:#e2e8f0;min-height:62px"><span style="display:block;font-size:20px;line-height:1.3">${ic}</span><span style="display:block;font-size:11px;line-height:1.2">${l}</span></button>`;
  return `<div class="space-y-2"><div style="display:grid;gap:.5rem;grid-template-columns:1fr 1fr">${big('🛑','Iniciar parada',"openStop('','start')",'#ef4444','rgba(239,68,68,.14)')}${big('📝','Registrar intervención',"openStop('','full')",'#2dd4bf','rgba(45,212,191,.12)')}</div>
  <div style="display:grid;gap:.5rem;grid-template-columns:repeat(4,1fr)">${sm('🔧','Backlog',"qaBack()")}${sm('🛢️','Engrase',"qaPick('gr')")}${sm('📏','Neumáticos',"qaPick('tr')")}${sm('⏱️','Horómetro',"qaPick('hrs')")}</div></div>`}
function dashValidar(){
  if(!isSup())return '';
  const l=[...backlogs.filter(b=>b.status==='PENDIENTE_VALIDACION').map(b=>({t:'Backlog '+bkNo(b),e:eqOf(b.fleetId),x:b.component,f:`openValidate('${b.id}')`})),...pms.filter(p=>p.status==='PENDIENTE_VALIDACION').map(p=>({t:'Preventivo',e:eqOf(p.fleetId),x:p.plan,f:`openValidatePm('${p.id}')`}))];
  return dCard('🛡️ Esperan tu validación ('+l.length+')',l.length?l.slice(0,8).map(o=>dRow(`<b class="text-amber-400">${esc(o.e.code)}</b> <span class="text-slate-300">${esc(o.x||'')}</span><p class="text-xs text-slate-400">${o.t}</p>`,`<button onclick="${o.f}" class="btn bg-violet-500/20 text-violet-300 !py-1">Revisar</button>`)).join('')+(l.length>8?`<button onclick="tab('sup')" class="btn bg-slate-700 !py-1">Ver todos</button>`:''):dEmpty('✅ Nada pendiente de validar.'))}
const bkRow=b=>{const e=eqOf(b.fleetId),d=delay(b),ret=b.rejectNote&&b.status==='EN_EJECUCION';
  return dRow(`<b class="text-amber-400">${esc(e.code)}</b> <span class="text-slate-300">${esc(b.component)}</span><p class="text-xs ${ret?'text-red-400':d?'text-red-400':'text-slate-400'}">${ret?'⚠️ Devuelto: '+esc(b.rejectNote):(d?'+'+d+' d de atraso · ':'')+esc(PR_L[b.criticality]||b.criticality)+' · '+(STL[b.status]||b.status)}</p>`,bkOpen(b)?`<button onclick="openClose('${b.id}')" class="btn bg-emerald-500/20 text-emerald-400 !py-1">✅ Cerrar</button>`:`<button onclick="openDetail('${b.id}')" class="btn bg-slate-700 !py-1">👁️</button>`)};
const pmRow=p=>{const e=eqOf(p.fleetId),o=pmOver(p);
  return dRow(`<b class="text-amber-400">${esc(e.code)}</b> <span class="text-slate-300">${esc(p.plan)}</span><p class="text-xs ${o?'text-red-400':'text-slate-400'}">${fmtD(p.scheduledDate)} · ${pmWhen(p)}</p>`,p.status==='PROGRAMADO'?`<button onclick="openClosePm('${p.id}')" class="btn bg-emerald-500/20 text-emerald-400 !py-1">✅ Cerrar OT</button>`:`<button onclick="openDetailPm('${p.id}')" class="btn bg-slate-700 !py-1">👁️</button>`)};
const bkOpenSorted=()=>backlogs.filter(bkOpen).sort((a,b)=>(!!(b.rejectNote&&b.status==='EN_EJECUCION'))-(!!(a.rejectNote&&a.status==='EN_EJECUCION'))||(CR_O[a.criticality]??3)-(CR_O[b.criticality]??3)||delay(b)-delay(a));
const pmSoon=()=>pms.filter(p=>p.status==='PROGRAMADO'&&p.scheduledDate&&daysTo(p.scheduledDate)<=7).sort((a,b)=>a.scheduledDate.localeCompare(b.scheduledDate));
function renderDashTec(){
  const wait=backlogs.filter(b=>b.status==='PENDIENTE_VALIDACION'&&b.closeUid===me.uid).length+pms.filter(p=>p.status==='PENDIENTE_VALIDACION'&&p.closeUid===me.uid).length;
  $('v-dash').innerHTML=dashHello()+misCard()+dashQuick()+dashKpis()+(wait?`<div class="bg-violet-500/10 border border-violet-500/30 rounded-xl p-3 text-sm text-violet-300">⏳ Tienes ${wait} cierre(s) esperando validación del supervisor.</div>`:'')+dashPend();
}
function renderDashSup(){$('v-dash').innerHTML=misCard()+dashBk()+dashOther()}

/* ---------- Registro rápido (+) ---------- */
function quickAdd(){
  if(!fleet.length){note('Primero registra equipos en la pestaña Equipos.');return}
  const b=(ic,l,f)=>`<button onclick="${f}" class="btn bg-slate-700" style="padding:1rem .5rem;text-align:center"><span style="display:block;font-size:26px">${ic}</span><span style="display:block" class="text-xs">${l}</span></button>`;
  show(`<div class="flex justify-between"><h3 class="font-bold">➕ Registro rápido</h3><button type="button" onclick="hide()" class="text-slate-400 text-xl">✕</button></div><div style="display:grid;gap:.6rem;grid-template-columns:1fr 1fr;margin-top:.75rem">${b('🔧','Nuevo backlog','qaBack()')}${b('🛢️','Registrar engrase',"qaPick('gr')")}${b('📏','Medir neumáticos',"qaPick('tr')")}${b('⏱️','Actualizar horómetro',"qaPick('hrs')")}${b('🛑','Iniciar parada',"hide();openStop('','start')")}${b('📝','Registrar intervención',"hide();openStop('','full')")}</div>`,'24rem');
}
function qaBack(){hide();openBack()}
function qaPick(k){
  if(!(k==='hrs'?fleet:fleetIn(k)).length){note(fleet.length?'Ningún equipo está habilitado en este apartado (usa 🧩 Equipos).':'Primero registra equipos en la pestaña Equipos.');return}
  const T={gr:'🛢️ Registrar engrase',tr:'📏 Medir neumáticos',hrs:'⏱️ Actualizar horómetro'};
  show(`<h3 class="font-bold mb-2">${T[k]}</h3><label class="block text-xs text-slate-400 font-semibold">¿De qué equipo?<select id="qa-eq" class="inp mt-1 font-normal">${(k==='hrs'?fleet:fleetIn(k)).map(x=>`<option value="${x.id}">${esc(x.code)} - ${esc(x.brand)} ${esc(x.model)}</option>`).join('')}</select></label>
  <div class="flex justify-end gap-2 pt-3"><button type="button" onclick="hide()" class="btn bg-slate-700">Cancelar</button><button type="button" onclick="qaGo('${k}')" class="btn bg-amber-500 text-slate-950">Continuar</button></div>`,'24rem');
}
function qaGo(k){const id=$('qa-eq').value;hide();const c=(fleet.find(x=>x.id===id)||{}).code;if(k==='gr')eqnOpen('engrase',c);else if(k==='tr')eqnOpen('neumaticos',c);else openHours(id)}
function openHours(fid){
  const e=fleet.find(x=>x.id===fid);if(!e)return;
  show(`<h3 class="font-bold">⏱️ Horómetro de ${esc(e.code)}</h3><p class="text-xs text-slate-400 mb-3">${esc(e.brand)} ${esc(e.model)} · Actual: <b class="text-slate-200">${fmtH(e.hours)}</b></p><form onsubmit="saveHours(event,'${fid}')" class="space-y-3">${field('hours','Nueva lectura *','','required min="0" step="any" inputmode="decimal"','number')}<p id="hr-err" class="text-xs text-red-400 hidden"></p>${btns()}</form>`,'24rem');
}
function saveHours(ev,fid){
  ev.preventDefault();const e=fleet.find(x=>x.id===fid),v=Number(new FormData(ev.target).get('hours')),er=$('hr-err');if(!e)return;
  if(v<(Number(e.hours)||0)&&!isAdmin()){er.textContent='La lectura no puede ser menor a la actual ('+fmtH(e.hours)+'). Si fue un error, pide al planner que la corrija.';er.classList.remove('hidden');return}
  put('fleet',{...e,hours:v});hide();note('Horómetro de '+e.code+' actualizado a '+fmtH(v)+'.');
}

/* ---------- Ficha única del equipo ---------- */
let eqTab='res';
const EQ_TABS=[['res','Resumen'],['bk','Backlogs'],['pm','Preventivos'],['gr','Engrase'],['tr','Neumáticos'],['his','Historial']];
function openEquip(id,t){
  const e=fleet.find(x=>x.id===id);if(!e)return;eqTab=t||'res';
  const bks=backlogs.filter(b=>b.fleetId===id),pmx=pms.filter(q=>q.fleetId===id),op=bks.filter(bkOpen),sc={OPERATIVO:'text-emerald-400',INOPERATIVO:'text-red-400',EN_MANTENIMIENTO:'text-amber-400'};
  const g=grStatus(e),mt=trMounted(id),poss=eqnPos(e),box='bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-sm';
  let body='';
  if(eqTab==='res'){
    const nx=pmx.filter(q=>q.status==='PROGRAMADO').sort((a,b)=>(a.scheduledDate||'').localeCompare(b.scheduledDate||''))[0],cnt={CAMBIO:0,ALERTA:0,SINMED:0};mt.forEach(x=>{const k=trHealth(x).k;if(cnt[k]!=null)cnt[k]++});
    const c=(l,v,x)=>`<div class="${box}"><p class="text-[11px] uppercase text-slate-400 font-semibold">${l}</p><div class="mt-1">${v}</div>${x?`<p class="text-xs text-slate-400 mt-1">${x}</p>`:''}</div>`;
    body=`<div style="display:grid;gap:.5rem;grid-template-columns:1fr 1fr">
     ${c('Backlogs abiertos','<b class="text-xl text-amber-400">'+op.length+'</b>',op.filter(b=>b.criticality==='P1').length+' de prioridad P1')}
     ${c('Próximo preventivo',nx?`<b class="text-blue-400">${fmtD(nx.scheduledDate)}</b>`:'<span class="text-slate-500">Sin programar</span>',nx?esc(nx.plan)+' · '+pmWhen(nx):'')}
     ${c('Engrase',grBadge(g.k),grLines(g)[0]||'')}
     ${c('Neumáticos','<b class="text-xl">'+mt.length+'/'+poss.length+'</b> <span class="text-xs text-slate-400">montados</span>',(cnt.CAMBIO?cnt.CAMBIO+' para cambiar · ':'')+(cnt.ALERTA?cnt.ALERTA+' en alerta · ':'')+(cnt.SINMED?cnt.SINMED+' por medir':''))}
     ${(()=>{const r=relMet([id],addDays(today(),-89),today(),false),f=relMet([id],addDays(today(),-89),today(),true);return c('Confiabilidad (90 días)','<b class="text-xl '+(r.disp==null?'':r.disp>=90?'text-emerald-400':r.disp>=80?'text-amber-400':'text-red-400')+'">'+(r.disp==null?'—':r.disp+'%')+'</b> <span class="text-xs text-slate-400">disponible</span>',`MTBF ${f.mtbf==null?'—':f.mtbf+' h'} · MTTR ${f.mttr==null?'—':f.mttr+' h'} · ${r.n} parada(s)`)})()}
     ${(()=>{const s=eqnSumOf('gr',e)||{},d0=addDays(today(),-365),bc=bks.filter(b=>b.status!=='ANULADO'&&(b.observationDate||'')>=d0).reduce((t,b)=>t+(Number(b.cost)||0),0),m=x=>Number(x||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});return c('Costos (12 meses)','<span class="text-sm">Backlogs <b>$ '+m(bc)+'</b></span>',`Engrase ${esc(s.mon||'S/')} ${m(s.cost12)} (${s.n12||0} reg.) · Neumáticos ${esc(s.neuMon||'S/')} ${m(s.neuCost12)}`)})()}</div>
     <div class="flex gap-2 flex-wrap mt-3"><button onclick="hide();openBack();setTimeout(()=>{const s=document.querySelector('#modal select[name=fleetId]');if(s){s.value='${id}';s.onchange&&s.onchange()}},30)" class="btn bg-amber-500/20 text-amber-400">🔧 Nuevo backlog</button><button onclick="openStop('','start','${id}')" class="btn bg-slate-700">🛑 Iniciar parada</button><button onclick="openHours('${id}')" class="btn bg-slate-700">⏱️ Horómetro</button><button onclick="hide();eqnOpen('engrase','${esc(e.code)}')" class="btn bg-slate-700">🛢️ Engrase</button><button onclick="hide();eqnOpen('neumaticos','${esc(e.code)}')" class="btn bg-slate-700">📏 Medir</button></div>`;
  }else if(eqTab==='bk'){
    const l=[...bks].sort((a,b)=>bkOpen(b)-bkOpen(a)||(b.observationDate||'').localeCompare(a.observationDate||''));
    body=l.map(b=>`<div class="${box} flex justify-between items-center gap-2"><div class="min-w-0"><b class="text-amber-400">${esc(bkNo(b))}</b> <span class="text-slate-300">${esc(b.component)}</span><p class="text-xs text-slate-400">${bkPrBadge(b.criticality)} ${bkStBadge(b.status)} · ${fmtD(b.observationDate)} · ${bkAge(b)} d${bkVenc(b)?' <b class="text-red-400">VENCIDO</b>':''}</p></div><div class="flex gap-1"><button onclick="openDetail('${b.id}')" class="btn bg-slate-700 !py-1">👁️</button>${bkOpen(b)?`<button onclick="openClose('${b.id}')" class="btn bg-emerald-500/20 text-emerald-400 !py-1">✅</button>`:''}</div></div>`).join('')||dEmpty('Sin backlogs para este equipo.');
  }else if(eqTab==='pm'){
    const l=[...pmx].sort((a,b)=>(b.scheduledDate||'').localeCompare(a.scheduledDate||''));
    body=l.map(q=>`<div class="${box} flex justify-between items-center gap-2"><div class="min-w-0"><b class="text-slate-200">${esc(q.plan)}</b><p class="text-xs text-slate-400">${pmBadge(pmKey(q))} ${fmtD(q.scheduledDate)} ${pmWhen(q)}</p></div><div class="flex gap-1"><button onclick="openDetailPm('${q.id}')" class="btn bg-slate-700 !py-1">👁️</button>${q.status==='PROGRAMADO'?`<button onclick="openClosePm('${q.id}')" class="btn bg-emerald-500/20 text-emerald-400 !py-1">✅</button>`:''}</div></div>`).join('')||dEmpty('Sin preventivos para este equipo.');
  }else if(eqTab==='gr'){
    const lg=grLogs(id).slice(0,5);
    body=`<div class="${box}">${grBadge(g.k)}${grLines(g).map(x=>`<p class="text-xs text-slate-300 mt-1">${x}</p>`).join('')}</div><h4 class="text-xs text-slate-400 uppercase mt-3 mb-1">Últimos registros</h4>`+(lg.map(x=>`<div class="${box} mb-2"><b>${fmtD(x.date)}</b>${x.tipo?' · '+esc(x.tipo):''}${x.hours!=null&&x.hours!==''?' · '+fmtH(x.hours)+' h':''} <span class="text-xs text-slate-400">· ${esc(x.by||'')}</span></div>`).join('')||dEmpty('Sin registros de engrase.'))+`<div class="flex gap-2 flex-wrap mt-3"><button onclick="hide();eqnOpen('engrase','${esc(e.code)}')" class="btn bg-amber-500/20 text-amber-400">🛢️ Registrar engrase</button><button onclick="hide();eqnOpen('historial','${esc(e.code)}')" class="btn bg-slate-700">📜 Historial</button></div>`;
  }else if(eqTab==='tr'){
    body=(poss.length?`<div class="${box}">Montados: <b>${mt.length}/${poss.length}</b></div>`+mt.map(x=>{const h=trHealth(x);return `<div class="${box} flex justify-between items-center mt-2"><span><b class="text-amber-400">${esc(x.pos)}</b> <span class="text-slate-300">${esc(x.code)}</span></span><b style="color:${TR_COL[h.k]}">${h.c!=null?h.c+' mm':'—'}</b></div>`}).join(''):dEmpty('Este equipo no tiene posiciones de neumáticos definidas.'))+`<div class="flex gap-2 flex-wrap mt-3"><button onclick="hide();eqnOpen('neumaticos','${esc(e.code)}')" class="btn bg-emerald-500/20 text-emerald-400">📏 Medir / inspeccionar</button><button onclick="hide();eqnOpen('neumaticos','${esc(e.code)}')" class="btn bg-slate-700">🛞 Ver diagrama</button></div>`;
  }else{
    const ev=[...bks.map(b=>({d:b.observationDate,t:`🔧 Backlog ${esc(bkNo(b))}: ${esc(b.component)} — ${esc(STL[b.status]||b.status)}`})),...pmx.map(q=>({d:q.scheduledDate,t:`🗓️ Preventivo ${esc(q.plan)} — ${esc(PM_L[q.status]||q.status)}`})),...grLogs(id).map(x=>({d:x.date,t:`🛢️ Engrase ${esc(x.tipo||'')}${x.hours!=null&&x.hours!==''?' a '+fmtH(x.hours)+' h':''} · ${esc(x.by||'')}`})),...sps.filter(x=>x.fleetId===id).map(x=>({d:(x.fp||'').slice(0,10),t:`🛑 Parada ${esc(x.motivo)} · ${esc(x.sistema||'')}${x.t?' · '+esc(x.t)+' h':''} — ${esc((x.desc||'').slice(0,90))}`})),...((eqnSumOf('gr',e)||{}).neuEv||[]).map(x=>({d:x.date,t:`🛞 ${esc(x.t)}`}))].filter(x=>x.d).sort((a,b)=>b.d.localeCompare(a.d)).slice(0,40);
    body=ev.map(x=>`<div class="${box}"><span class="text-xs text-slate-400">${fmtD(x.d)}</span><p>${x.t}</p></div>`).join('<div style="height:.4rem"></div>')||dEmpty('Aún no hay actividad registrada.');
  }
  show(`<div class="flex justify-between items-start gap-2"><div class="min-w-0"><h3 class="font-bold text-lg"><span class="text-amber-400">${esc(e.code)}</span> · ${esc(e.brand)} ${esc(e.model)}</h3><p class="text-xs text-slate-400">${esc(e.category)} · S/N ${esc(e.serialNumber)} · ${fmtH(e.hours)} h · ${esc(e.location||'-')} · ${stOpen(id).length?'<b class="text-red-400">EN PARADA (mantenimiento)</b>':`<b class="${sc[e.status]||''}">${esc(String(e.status).replace('_',' '))}</b>`}</p></div><button type="button" onclick="hide()" class="text-slate-400 text-xl">✕</button></div>
  <div style="display:flex;gap:.3rem;overflow-x:auto;margin:.75rem 0;padding-bottom:.25rem">${EQ_TABS.filter(([k])=>!MODS.some(m=>m[0]===k)||inMod(e,k)).map(([k,l])=>`<button onclick="openEquip('${id}','${k}')" class="btn ${k===eqTab?'bg-amber-500 text-slate-950':'bg-slate-700'} !py-1" style="flex:0 0 auto">${l}</button>`).join('')}</div>${body}`,'38rem');
}
function openEquipHash(n){const m=/eq=([^&]+)/.exec(location.hash||'');if(!m)return;const id=decodeURIComponent(m[1]);if(fleet.some(x=>x.id===id||x.code===id.toUpperCase())){openEquip((fleet.find(x=>x.id===id||x.code===id.toUpperCase())).id);history.replaceState(null,'',location.pathname)}else if((n||0)<10)setTimeout(()=>openEquipHash((n||0)+1),600)}

/* ============ INTERVENCIONES / REPORTE DE MANTENIMIENTO (mismo formato del Excel) ============ */
const ST_COLS=['Marca temporal','FLOTA','CÓDIGO','TIPO DE PARADA','MOTIVO DE PARADA','SISTEMA / COMPONENTE','DESCRIPCIÓN DE LA TAREA','RESPONSABLE','FRENTE DE TRABAJO','HORÓMETRO DE PARADA','HORÓMETRO DE SALIDA','FECHA Y HORA DE PARADA (día/mes/año Hora: min)','FECHA Y HORA DE SALIDA (día/mes/año Hora: min)','TIEMPO REAL DE LA INTERVENCIÓN (H)','RESPONSABLE DE LA DEMORA','RESPONSABLE DE LA PARADA','LUGAR DE INTERVENCIÓN ','OBSERVACIONES','EVIDENCIA FOTOGRÁFICA'];
const ST_W=[18.9,13,13,13,21.1,25.4,26.8,18.9,21.9,25.1,24.4,37.6,37.6,36.2,29.2,28.9,26,18.9,25.6];
const ST_MOT=[['PM1','MP1 — Preventivo 1'],['PM2','MP2 — Preventivo 2'],['PM3','MP3 — Preventivo 3'],['PM4','MP4 — Preventivo 4'],['MCI','MCI — Correctivo imprevisto'],['MCP','MCP — Correctivo programado'],['MEJORATIVO','MEJORATIVO — Mantenimiento mejorativo'],['PREDICTIVO','PREDICTIVO'],['ENGRASE','LUBRICACIÓN / ENGRASE'],['INSPECCION','INSPECCIÓN'],['BACKLOG','BACKLOG'],['CAMPANA','CAMPAÑA / BOLETÍN'],['OTROS','OTRO']];
const ST_DEM=['PROVEEDOR','MANTENIMIENTO','PRODUCCIÓN','LOGÍSTICA','CONTABILIDAD','CAMABAJA','FACTOR CLIMÁTICO'];
const ST_PAR=['MANTENIMIENTO','PRODUCCIÓN','OPERADOR'];
const ST_SIS=['MOTOR','TRANSMISIÓN','DIFERENCIAL','MANDOS FINALES','BASTIDOR','HIDRÁULICO','NEUMÁTICO','DIRECCIÓN','ELECTRÓNICO','ELÉCTRICO','IMPLEMENTOS','TREN DE RODAMIENTO','LLANTAS','ESTRUCTURA','SUSPENSIÓN','CABINA','A/C','TODOS','GETs','OTROS'];
const ST_FRE=['LOMADAS 4','AMPLIACIÓN LOMADAS 4','ALUVIALES 2'];
const ST_LUG=['TALLER EXTERNO','CAMPO','TALLER MINA'];
const ST_RES=['CRUZ VARAS IVAN JAVIER','DE LA CRUZ ESTACIO LUIS JAVIER','CRUZ CHAHUARES MARCO','CRUZADO VARGAS ALEX RONAL','TANTA MANTILLA JORGE LUIS','DÍAS CHÁVEZ YOSMER HUGO'];
const stSel=(n,l,o,v,req)=>{const a=[...o];if(v&&!a.includes(v))a.push(v);return `<label class="block text-xs text-slate-400 font-semibold">${l}<select class="inp mt-1 font-normal" name="${n}" ${req?'required':''}>${v?'':'<option value="">— elegir —</option>'}${a.map(x=>`<option value="${esc(x)}" ${x===v?'selected':''}>${esc(x)}</option>`).join('')}</select></label>`};
const ST_CAT={'COMPRESORA':'Compresora','CHANCADORA':'Chancadora','CAMIONETA':'Camioneta','VOLQUETE':'Volquete','CARGADOR FRONTAL':'Cargador Frontal','ZARANDA MOVIL':'Zaranda Móvil','TRACTOR':'Tractor de Oruga','EXCAVADORA':'Excavadora','CISTERNA DE AGUA':'Cisterna de Agua','MICRO BUS':'Minibús','TORRE DE ILUMINACIÓN':'Luminaria','GERERADOR':'Grupo Electrógeno'};
const ST_REV=Object.fromEntries(Object.entries(ST_CAT).map(([a,b])=>[b,a]));
const ST_BSYS={'ESTRUCTURA':'Estructura/Cuchara','ELÉCTRICO':'Sistema Eléctrico','MOTOR':'Motor','HIDRÁULICO':'Sistema Hidráulico','IMPLEMENTOS':'Estructura/Cuchara','SUSPENSIÓN':'Suspensión/Neumáticos','LLANTAS':'Suspensión/Neumáticos','MANDOS FINALES':'Tren de Rodaje','TRANSMISIÓN':'Transmisión','FRENOS':'Frenos','TODOS':'Estructura/Cuchara'};
const ST_MES=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
let repDate='',stFlag=false,impData=null;
const stPad=n=>String(n).padStart(2,'0');
const stNow=()=>{const d=new Date();return d.getFullYear()+'-'+stPad(d.getMonth()+1)+'-'+stPad(d.getDate())+'T'+stPad(d.getHours())+':'+stPad(d.getMinutes())};
const stMs=s=>{const m=/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/.exec(s||'');return m?new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5]).getTime():NaN};
const stHrs=(a,b)=>Math.round((stMs(b)-stMs(a))/36e5*100)/100;
const fmtDT=s=>s?fmtD(s.slice(0,10))+' '+s.slice(11,16):'–';
const stNorm=s=>String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
const hash36=s=>{let a=2166136261,b=5381;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b,33)^c}return (a>>>0).toString(36)+(b>>>0).toString(36)};
const stFinding=o=>String(o||'').replace(/materiales?\s*:[\s\S]*$/i,'').replace(/^[\s\-•]+/,'').trim();
const stFleetTxt=e=>e.flotaName||ST_REV[e.category]||String(e.category||'').toUpperCase();
const stOpen=fid=>sps.filter(s=>s.status==='ABIERTA'&&(!fid||s.fleetId===fid));
const stDay=d=>sps.filter(s=>(s.fp||'').slice(0,10)===d).sort((a,b)=>(a.fp||'').localeCompare(b.fp||''));
const stCan=s=>!!me&&(isSup()||s.respUid===me.uid||s.status==='ABIERTA');
function stOfficial(name){
  const toks=stNorm(name).split(' ').filter(Boolean);if(!toks.length)return '';
  const hit=[...new Set(sps.map(s=>s.resp).filter(Boolean))].find(n=>{const w=stNorm(n).split(' ');return toks.every(t=>w.includes(t))});
  return hit||String(name).toUpperCase();
}
function stWarn(s){
  if(s.status==='ABIERTA'||!s.fp||!s.fs)return '';const c=stHrs(s.fp,s.fs);
  if(!(c>0))return 'La salida es anterior o igual a la parada';
  if(s.t!==''&&s.t!=null&&Math.abs(c-Number(s.t))>0.05)return 'Tiempo registrado '+s.t+' h; por las fechas serían '+c+' h';
  return '';
}
const stBadge=m=>{const c=m==='MCI'?['#f87171','rgba(239,68,68,.12)']:m==='ENGRASE'?['#34d399','rgba(16,185,129,.12)']:['#60a5fa','rgba(59,130,246,.12)'];return `<span class="bdg" style="color:${c[0]};background:${c[1]};border-color:${c[0]}55">${esc(m)}</span>`};
function rdBanner(){return ''}
function dashRep(){
  const o=stOpen();
  return dCard('🔧 Paradas abiertas ('+o.length+')',o.length?o.slice(0,6).map(s=>dRow(`<b class="text-amber-400">${esc(s.cod)}</b> ${stBadge(s.motivo)}<p class="text-xs text-slate-400">${esc(s.flota)} · desde ${fmtDT(s.fp)} · ${esc(s.resp)}</p>`,stCan(s)?`<button onclick="openStop('${s.id}','close')" class="btn bg-emerald-500/20 text-emerald-400 !py-1">✅ Cerrar</button>`:'')).join(''):dEmpty('Ningún equipo detenido en este momento.'),`<button onclick="tab('rep')" class="btn bg-slate-700 !py-1">Reporte</button>`);
}
/* ---------- Pestaña Reporte ---------- */
function repGo(d){if(d)repDate=d;renderRep()}
function repShift(n){const x=new Date((repDate||today())+'T12:00:00');x.setDate(x.getDate()+n);const d=fmtISO(x);if(d>today())return;repDate=d;renderRep()}
let repView='day',repQ='',repMot='',repTbl=false,repLim=40;
function repSet(k,v){if(k==='view')repView=v;else if(k==='q')repQ=v;else if(k==='mot')repMot=v;else if(k==='tbl')repTbl=!repTbl;repLim=40;renderRep()}
function repMore(){repLim+=40;renderRep()}
function stCard(s,showDate){
  const ab=s.status==='ABIERTA',w=stWarn(s),ln=(l,v)=>v!==''&&v!=null?`<span style="color:#64748b">${l}</span> ${esc(v)}`:'';
  const meta=[ln('Resp.',s.resp),ln('Frente',s.frente),ln('Lugar',s.lugar),ln('Horóm.',fmtH(s.hp)+(ab?'':' → '+fmtH(s.hs))),ln('Demora',s.rdem),ln('Parada',s.rpar)].filter(Boolean).join(' · ');
  return `<div class="bg-slate-800 border ${ab?'border-red-500/50':'border-slate-700'} rounded-xl p-4 space-y-2" style="word-break:break-word"><div class="flex justify-between items-start gap-2"><div class="min-w-0">${s.num?`<span class="mono text-xs text-slate-400">${esc(s.num)}${s.otNum?' · '+esc(s.otNum):''}</span> `:''}<b class="text-amber-400">${esc(s.cod)}</b> <span class="text-xs text-slate-400">${esc(s.flota)}</span> ${stBadge(s.motivo)}${ab?' <span class="bdg" style="color:#f87171;background:rgba(239,68,68,.12);border-color:#f8717155">PARADA ABIERTA</span>':''}
    <p class="text-xs text-slate-400 mt-1">${showDate?fmtD(s.fp.slice(0,10))+' · ':''}${s.fp.slice(11,16)}${ab?' → en curso':' → '+(s.fs||'').slice(11,16)+' · <b class="text-slate-200">'+s.t+' h</b>'} · ${esc(s.tipo==='PLANIFICADA'?'Planificada':'No planificada')} · ${esc(s.sistema||'')}</p></div>
    <div class="flex gap-1" style="flex-shrink:0"><button onclick="openStopView('${s.id}')" class="btn bg-slate-700 !py-1">👁️</button>${ab?'':`<button onclick="makePdfRpt('${s.id}')" class="btn bg-slate-700 !py-1" title="Reporte en PDF">📄</button>`}${ab&&stCan(s)?`<button onclick="openStop('${s.id}','close')" class="btn bg-emerald-500/20 text-emerald-400 !py-1">✅</button>`:''}${!ab&&stCan(s)?`<button onclick="openStop('${s.id}','edit')" class="btn bg-slate-700 !py-1">✏️</button>`:''}${adm(`<button onclick="delStop('${s.id}')" class="btn bg-red-500/20 !py-1">🗑️</button>`)}</div></div>
    <p class="text-sm text-slate-200" style="white-space:pre-line">${esc((s.desc||'').trim()||'–')}</p>${s.obs&&s.obs.trim()?`<p class="text-xs" style="color:#fcd34d;white-space:pre-line">📌 ${esc(s.obs.trim())}</p>`:''}
    <p class="text-xs text-slate-400" style="line-height:1.6">${meta}${s.backlogId||s.pendDone?' · 🔧 generó backlog':''}${s.bkRef?' · cierra '+esc((backlogs.find(x=>x.id===s.bkRef)||{}).num||'backlog'):''}${(s.photos||[]).length?' · 📷 '+s.photos.length:''}</p>${w?`<p class="text-xs text-amber-400">⚠️ ${esc(w)}</p>`:''}</div>`;
}
function stTable(L){
  const th='padding:8px 10px;text-align:left;border-bottom:1px solid #334155;white-space:nowrap;color:#94a3b8;font-weight:600;position:sticky;top:0;background:#1e293b',td='padding:8px 10px;border-bottom:1px solid #1e293b;vertical-align:top',stk='position:sticky;left:0;background:#1e293b;z-index:1;border-right:1px solid #334155';
  const C=[['N°',s=>`<span class="mono">${esc(spNo(s))}</span>`,'white-space:nowrap'],['EQUIPO',s=>`<b class="text-amber-400">${esc(s.cod)}</b><div style="font-size:10px;color:#94a3b8">${esc(s.flota)}</div>`,'min-width:110px;'+stk],['PARADA',s=>fmtDT(s.fp),'white-space:nowrap'],['SALIDA',s=>s.status==='ABIERTA'?'en curso':fmtDT(s.fs),'white-space:nowrap'],['H',s=>s.t,'text-align:right'],['TIPO',s=>s.tipo==='PLANIFICADA'?'PLAN.':'NO PLAN.','white-space:nowrap'],['MOTIVO',s=>esc(s.motivo),''],['SISTEMA',s=>esc(s.sistema),''],['DESCRIPCIÓN',s=>esc(s.desc),'min-width:260px;white-space:pre-line'],['RESPONSABLE',s=>esc(s.resp),'min-width:150px'],['FRENTE',s=>esc(s.frente),'white-space:nowrap'],['LUGAR',s=>esc(s.lugar),'white-space:nowrap'],['HORÓM. PARADA',s=>fmtH(s.hp),'text-align:right'],['HORÓM. SALIDA',s=>s.status==='ABIERTA'?'':fmtH(s.hs),'text-align:right'],['DEMORA',s=>esc(s.rdem),''],['PARADA POR',s=>esc(s.rpar),''],['OBSERVACIONES',s=>esc(s.obs),'min-width:240px;white-space:pre-line']];
  return `<div style="overflow:auto;max-height:70vh;border:1px solid #334155;border-radius:.75rem"><table style="border-collapse:collapse;font-size:12px;color:#e2e8f0"><thead><tr>${C.map((c,i)=>`<th style="${th}${i===0?';left:0;z-index:3;border-right:1px solid #334155':''}">${c[0]}</th>`).join('')}</tr></thead><tbody>${L.map(s=>`<tr onclick="openStopView('${s.id}')" style="cursor:pointer">${C.map(c=>`<td style="${td};${c[2]}">${c[1](s)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function renderRep(){
  if(!repDate){repDate=today();if(!stDay(today()).length&&sps.length)repDate=sps.map(s=>(s.fp||'').slice(0,10)).sort().pop()||today()}
  const d=repDate,ym=d.slice(0,7),op=stOpen(),inM=s=>(s.fp||'').slice(0,7)===ym&&s.status!=='ABIERTA',M=sps.filter(inM);
  let L=(repView==='day'?stDay(d):sps.filter(s=>repView==='all'||(s.fp||'').slice(0,7)===ym).sort((a,b)=>(b.fp||'').localeCompare(a.fp||''))).filter(s=>s.status!=='ABIERTA');
  if(repMot)L=L.filter(s=>s.motivo===repMot);
  const q=stNorm(repQ);if(q)L=L.filter(s=>stNorm([s.num,s.cod,s.flota,s.desc,s.obs,s.resp,s.sistema,s.frente,s.motivo].join(' ')).includes(q));
  const sum=a=>Math.round(a.reduce((t,s)=>t+(Number(s.t)||0),0)*10)/10,H=sum(M),pl=M.filter(s=>s.tipo==='PLANIFICADA'),by={};M.forEach(s=>by[s.motivo]=(by[s.motivo]||0)+(Number(s.t)||0));
  const week=Array.from({length:7},(_,i)=>{const x=new Date(today()+'T12:00:00');x.setDate(x.getDate()-i);return fmtISO(x)}),seg=(k,l)=>`<button onclick="repSet('view','${k}')" class="btn ${repView===k?'bg-amber-500 text-slate-950':'bg-slate-700'}" style="flex:1;padding:.45rem .2rem;font-size:12px">${l}</button>`;
  const title=repView==='day'?'Intervenciones del '+fmtD(d):repView==='month'?ST_MES[+ym.slice(5,7)-1]+' '+ym.slice(0,4):'Todas las intervenciones';
  $('v-rep').innerHTML=`<div class="bg-slate-800 border border-slate-700 rounded-xl p-3 space-y-3">
    <div class="flex gap-2">${seg('day','Día')}${seg('month','Mes')}${seg('all','Todas')}<button onclick="repSet('tbl')" class="btn ${repTbl?'bg-amber-500 text-slate-950':'bg-slate-700'}" style="padding:.45rem .5rem;font-size:12px">🧾 Tabla</button></div>
    ${repView==='day'?`<div class="flex gap-2 items-center"><button onclick="repShift(-1)" class="btn bg-slate-700">◀</button><input type="date" class="inp" value="${d}" max="${today()}" onchange="repGo(this.value)" style="flex:1"><button onclick="repShift(1)" class="btn bg-slate-700">▶</button></div>`:repView==='month'?`<input type="month" class="inp" value="${ym}" max="${today().slice(0,7)}" onchange="if(this.value)repGo(this.value+'-01')">`:''}
    <div class="flex gap-2"><input class="inp" placeholder="Buscar equipo, texto, responsable…" value="${esc(repQ)}" onchange="repSet('q',this.value)" style="flex:1"><select class="inp" onchange="repSet('mot',this.value)" style="width:auto;max-width:9rem"><option value="">Todos</option>${ST_MOT.map(([k])=>`<option value="${k}" ${k===repMot?'selected':''}>${k}</option>`).join('')}</select></div>
    <div class="flex gap-2"><button onclick="openStop('','start')" class="btn bg-red-500 text-white" style="flex:1;padding:.5rem .4rem;font-size:13px">🛑 Iniciar parada</button><button onclick="openStop('','full')" class="btn bg-amber-500 text-slate-950" style="flex:1;padding:.5rem .4rem;font-size:13px">➕ Intervención</button></div>
    <div class="flex gap-2"><button onclick="makePdfRep('${d}')" class="btn bg-slate-700" style="flex:1;padding:.4rem .3rem;font-size:12px">📄 PDF día</button><button onclick="exportStopsOpen()" class="btn bg-slate-700" style="flex:1;padding:.4rem .3rem;font-size:12px">📊 Excel</button>${adm(`<button onclick="importStopsPick()" class="btn bg-slate-700" style="flex:1;padding:.4rem .3rem;font-size:12px">📥 Importar</button>`)}</div>
    ${repView==='day'?`<div style="display:flex;gap:.3rem;overflow-x:auto">${week.map(x=>{const n=stDay(x).length;return `<button onclick="repGo('${x}')" class="btn ${x===d?'bg-amber-500 text-slate-950':'bg-slate-700'} !py-1" style="flex:0 0 auto;min-height:40px;padding:.2rem .6rem"><span style="font-size:11px">${x.slice(8)}/${x.slice(5,7)}</span> <b style="font-size:11px">${n?'· '+n:''}</b></button>`}).join('')}</div>`:''}</div>
   ${op.length?`<h3 class="text-xs text-red-400 uppercase font-semibold">🔴 Paradas abiertas (${op.length})</h3>${op.map(s=>stCard(s,true)).join('')}`:''}
   <h3 class="text-xs text-slate-400 uppercase font-semibold">${title} · ${L.length} · ${sum(L)} h${repQ||repMot?' (filtrado)':''}</h3>
   ${!L.length?'<p class="text-slate-500 text-sm">No hay intervenciones con esos criterios. Usa 🗓️ Mes o 📋 Todas para ver más.</p>':repTbl?stTable(L.slice(0,repLim)):`<div class="space-y-3">${L.slice(0,repLim).map(s=>stCard(s,repView!=='day')).join('')}</div>`}
   ${L.length>repLim?`<button onclick="repMore()" class="btn bg-slate-700 w-full">Mostrar más (${L.length-repLim} restantes)</button>`:''}
   <div class="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-1"><h3 class="font-semibold">📈 ${ST_MES[+ym.slice(5,7)-1]} ${ym.slice(0,4)}</h3>${M.length?`<p class="text-sm text-slate-300"><b>${M.length}</b> intervenciones · <b>${H}</b> h · <b>${Math.round(pl.length/M.length*100)}%</b> planificadas</p><p class="text-xs text-slate-400">${Object.keys(by).sort((a,b)=>by[b]-by[a]).map(k=>esc(k)+': '+Math.round(by[k]*10)/10+' h').join(' · ')}</p>`:'<p class="text-sm text-slate-500">Sin intervenciones cerradas este mes.</p>'}</div>`;
}
/* ---------- Formulario ---------- */
const stList=(id,a)=>`<datalist id="${id}">${[...new Set(a.filter(Boolean))].map(x=>`<option value="${esc(x)}">`).join('')}</datalist>`;
function stEq(sel){
  const e=fleet.find(x=>x.id===sel.value),f=sel.form;if(!e)return;
  if(!f.dataset.edit||f.hp.value==='')f.hp.value=e.hours??'';
  const last=sps.filter(s=>s.fleetId===e.id).sort((a,b)=>(b.fp||'').localeCompare(a.fp||''))[0];
  if(last){if(!f.frente.value)f.frente.value=last.frente||'';if(!f.lugar.value)f.lugar.value=last.lugar||''}
}
function stMot(sel){const f=sel.form;f.tipo.value=sel.value==='MCI'?'NO PLANIFICADA':'PLANIFICADA'}
function stBacklogFrom(s,e,id){
  const obs=stFinding(s.obs),first=obs.split(/[.\n;]/)[0].trim(),comp=first?(first.length>70?first.slice(0,67)+'…':first):'Observación de intervención',day=s.fp.slice(0,10);
  return{id,fleetId:e.id,system:ST_BSYS[s.sistema]||'Estructura/Cuchara',component:comp,criticality:/(fuga|agriet|urgente|cr[ií]tic|riesgo|inoperativ)/i.test(obs)?'P1':'P2',description:obs+'\n\n(Origen: intervención '+s.motivo+' del '+fmtD(day)+' · '+s.resp+')',observationDate:day,scheduledDate:addDays(day,7),cost:0,status:'REGISTRADO',detectedBy:s.resp,source:'Reporte de parada '+s.motivo,workType:/^MC/.test(s.motivo)?'Correctivo':'Inspección',log:[{t:'Backlog creado desde la intervención '+s.motivo+' del '+fmtD(day),ts:Date.now(),by:me?me.name:''}],photosBefore:s.photos||[],photosAfter:[],closeDate:'',closeTech:'',closeNotes:'',origin:'intervencion',stopId:s.id};
}
function stGreaseFrom(s,id){return{id,fleetId:s.fleetId,date:s.fp.slice(0,10),hours:Number(s.hp)||0,tech:s.resp,techUid:s.respUid||'',grease:'',qty:'',unit:'',points:[],done:0,total:0,notes:'Registrado desde el reporte de mantenimiento.',ts:Date.now(),origin:'intervencion',stopId:s.id}}
function delStop(id){if(!isAdmin())return;ask('¿Eliminar esta intervención?',()=>del('stops',id))}
/* ---------- ExcelJS (carga bajo demanda) ---------- */
function loadXL(){
  return new Promise((ok,no)=>{if(window.ExcelJS)return ok();const sc=document.createElement('script');sc.src='https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';sc.integrity='sha512-dlPw+ytv/6JyepmelABrgeYgHI0O+frEwgfnPdXDTOIZz+eDgfW07QXG02/O8COfivBdGNINy+Vex+lYmJ5rxw==';sc.crossOrigin='anonymous';sc.onload=()=>ok();sc.onerror=()=>no(new Error('No se pudo cargar el módulo de Excel. Revisa tu conexión a internet.'));document.head.appendChild(sc)});
}
/* ---------- Exportar en el mismo formato del Excel ---------- */
function exportStopsOpen(){
  const ms=[...new Set(sps.map(s=>(s.fp||'').slice(0,7)).filter(Boolean))].sort().reverse();
  if(!ms.length){note('Todavía no hay intervenciones para exportar.');return}
  const def=ms.includes((repDate||today()).slice(0,7))?(repDate||today()).slice(0,7):ms[0],ab=stOpen().length;
  show(`<h3 class="font-bold">📊 Exportar reporte de mantenimiento</h3><p class="text-xs text-slate-400 mb-3">Excel con las mismas columnas y formato de tu hoja "Respuestas de formulario 1".</p>
  <label class="block text-xs text-slate-400 font-semibold">Mes<select id="st-ex-m" class="inp mt-1 font-normal">${ms.map(m=>`<option value="${m}" ${m===def?'selected':''}>${ST_MES[+m.slice(5,7)-1]} ${m.slice(0,4)}</option>`).join('')}<option value="ALL">Todos los meses</option></select></label>${ab?`<p class="text-xs text-amber-400 mt-2">⚠️ ${ab} parada(s) abierta(s) no se incluyen hasta cerrarlas.</p>`:''}
  <p id="st-ex-err" class="text-xs text-red-400 hidden mt-2"></p><div class="flex justify-end gap-2 mt-4"><button type="button" onclick="hide()" class="btn bg-slate-700">Cancelar</button><button type="button" id="st-ex-go" onclick="exportStopsDo()" class="btn bg-emerald-500 text-slate-950">Generar Excel</button></div>`,'26rem');
}
async function exportStopsDo(){
  const m=$('st-ex-m').value,b=$('st-ex-go'),er=$('st-ex-err');b.disabled=true;b.textContent='Generando…';
  try{
    await loadXL();
    const list=sps.filter(s=>s.status!=='ABIERTA'&&(m==='ALL'||(s.fp||'').slice(0,7)===m)).sort((a,b)=>(a.ts||0)-(b.ts||0));
    if(!list.length)throw new Error('No hay intervenciones cerradas en ese período.');
    const U=s=>{const x=/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/.exec(s||'');return x?new Date(Date.UTC(+x[1],+x[2]-1,+x[3],+x[4],+x[5])):null},
      UT=ts=>{const d=new Date(ts);return new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate(),d.getHours(),d.getMinutes(),d.getSeconds(),d.getMilliseconds()))},
      num=v=>v===''||v==null||isNaN(Number(v))?null:Number(v);
    const rows=list.map(s=>[UT(s.ts||stMs(s.fp)),s.flota,s.cod,s.tipo,s.motivo,s.sistema,s.desc,s.resp,s.frente,num(s.hp),num(s.hs),U(s.fp),U(s.fs),num(s.t),s.rdem,s.rpar,s.lugar,s.obs&&s.obs.trim()?s.obs:null,s.foto||((s.photos||[]).length?'('+s.photos.length+' foto(s) en la app)':null)]);
    const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('Respuestas de formulario 1',{views:[{state:'frozen',ySplit:1}]});
    ws.addTable({name:'Form_Responses',ref:'A1',headerRow:true,totalsRow:false,style:{theme:'TableStyleLight1',showRowStripes:true},columns:ST_COLS.map(n=>({name:n,filterButton:true})),rows});
    ST_W.forEach((w,i)=>ws.getColumn(i+1).width=w);
    for(let r=1;r<=rows.length+1;r++){const row=ws.getRow(r);row.height=22.5;row.eachCell({includeEmpty:true},(c,ci)=>{c.font={name:'Arial',bold:r===1};c.alignment={vertical:'middle'};if(r>1&&(ci===1||ci===12||ci===13))c.numFmt='m/d/yyyy h:mm:ss'})}
    const buf=await wb.xlsx.writeBuffer(),nm=m==='ALL'?'TODOS':ST_MES[+m.slice(5,7)-1]+'_'+m.slice(0,4);
    hide();fileOut(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'REPORTE_DE_MANTENIMIENTO_-_'+nm+'_respuestas.xlsx','📊 Excel listo ('+list.length+' filas)');
  }catch(e){er.textContent=e.message||String(e);er.classList.remove('hidden');b.disabled=false;b.textContent='Generar Excel'}
}
/* ---------- Importar desde el Excel (solo planner) ---------- */
function importStopsPick(){if(!isAdmin())return;const i=document.createElement('input');i.type='file';i.accept='.xlsx';i.onchange=()=>importXlsx(i);i.click()}
async function importXlsx(inp){
  const file=inp.files&&inp.files[0];if(!file||!isAdmin())return;
  show('<p class="text-sm text-slate-300">Leyendo el Excel…</p>','24rem');
  try{
    if(!/\.xlsx$/i.test(file.name)||file.size>10e6)throw new Error('Solo archivos .xlsx de hasta 10 MB.');const xb=await file.arrayBuffer(),sg=new Uint8Array(xb,0,4);if(sg[0]!==0x50||sg[1]!==0x4B||sg[2]!==3||sg[3]!==4)throw new Error('El archivo no es un Excel válido.');
    await loadXL();const wb=new ExcelJS.Workbook();await wb.xlsx.load(xb);const ws=wb.worksheets[0];if(!ws)throw new Error('El archivo no tiene hojas.');
    const cv=v=>{if(v==null)return '';if(v instanceof Date)return v;if(typeof v==='object'){if(v.result!==undefined)return cv(v.result);if(v.richText)return v.richText.map(x=>x.text).join('');if(v.hyperlink)return v.hyperlink;if(v.text!=null)return String(v.text)}return v};
    const keys=[['ts','MARCA TEMPORAL'],['flota','FLOTA'],['cod','CODIGO'],['tipo','TIPO DE PARADA'],['motivo','MOTIVO DE PARADA'],['sistema','SISTEMA'],['desc','DESCRIPCION'],['resp','RESPONSABLE',1],['frente','FRENTE'],['hp','HOROMETRO DE PARADA'],['hs','HOROMETRO DE SALIDA'],['fp','FECHA Y HORA DE PARADA'],['fs','FECHA Y HORA DE SALIDA'],['t','TIEMPO REAL'],['rdem','RESPONSABLE DE LA DEMORA'],['rpar','RESPONSABLE DE LA PARADA'],['lugar','LUGAR'],['obs','OBSERVACIONES'],['foto','EVIDENCIA']];
    const col={};ws.getRow(1).eachCell({includeEmpty:false},(c,i)=>{const h=stNorm(cv(c.value));for(const[k,p,ex]of keys){if(col[k])continue;if(ex?h===p:h.startsWith(p)){col[k]=i;break}}});
    const miss=['cod','fp','fs','motivo'].filter(k=>!col[k]);if(miss.length)throw new Error('No reconozco las columnas del Excel (faltan: '+miss.join(', ')+'). Debe ser el formato "Respuestas de formulario".');
    const dt=v=>{if(v instanceof Date)return v.getUTCFullYear()+'-'+stPad(v.getUTCMonth()+1)+'-'+stPad(v.getUTCDate())+'T'+stPad(v.getUTCHours())+':'+stPad(v.getUTCMinutes());const m=/(\d{1,2})\/(\d{1,2})\/(\d{4})[ T]+(\d{1,2}):(\d\d)/.exec(String(v));if(m)return m[3]+'-'+stPad(m[2])+'-'+stPad(m[1])+'T'+stPad(m[4])+':'+m[5];const i=/^(\d{4}-\d\d-\d\d)[ T](\d\d:\d\d)/.exec(String(v));return i?i[1]+'T'+i[2]:''};
    const num=v=>{const n=typeof v==='number'?v:parseFloat(String(v).replace(',','.'));return isNaN(n)?'':n};
    const D={fleetNew:[],fleetKnown:0,stops:[],stopsOld:0,backlogs:[],greases:[],warn:[],skipped:0,total:0},seen={},fmap={};
    fleet.forEach(e=>fmap[String(e.code).toUpperCase()]=e.id);
    const newF={};
    ws.eachRow((row,rn)=>{if(rn===1)return;D.total++;const g=k=>col[k]?cv(row.getCell(col[k]).value):'';
      const cod=String(g('cod')).toUpperCase().trim(),fp=dt(g('fp'));if(!cod||!fp){D.skipped++;return}
      let fs=dt(g('fs')),t=num(g('t'));const tsv=g('ts'),tsd=dt(tsv),ts=tsd?stMs(tsd)+(tsv instanceof Date?tsv.getUTCSeconds()*1000+tsv.getUTCMilliseconds():0):stMs(fp);
      const s={ts,flota:String(g('flota')).trim().toUpperCase(),cod,tipo:stNorm(g('tipo'))==='PLANIFICADA'?'PLANIFICADA':'NO PLANIFICADA',motivo:(m=>/^M[OE]J/.test(m)?'MEJORATIVO':m||'OTROS')(String(g('motivo')).trim().toUpperCase()),sistema:String(g('sistema')).trim().toUpperCase(),desc:String(g('desc')),resp:String(g('resp')).trim().toUpperCase(),respUid:'',frente:String(g('frente')).trim().toUpperCase(),hp:num(g('hp')),hs:num(g('hs')),fp,fs,t:t===''?(fs?stHrs(fp,fs):''):t,rdem:String(g('rdem')).trim().toUpperCase()||'MANTENIMIENTO',rpar:String(g('rpar')).trim().toUpperCase()||'MANTENIMIENTO',lugar:String(g('lugar')).trim().toUpperCase(),obs:String(g('obs')),foto:String(g('foto')).trim(),photos:[],status:'CERRADA',src:'excel'};
      const base=cod+'|'+fp+'|'+s.motivo+'|'+s.desc.trim().toLowerCase().slice(0,80)+'|'+s.resp;seen[base]=(seen[base]||0)+1;s.id='ST-'+hash36(base)+(seen[base]>1?'-'+seen[base]:'');
      let fid=fmap[cod];if(!fid){fid='EQ-'+cod.replace(/[^A-Z0-9]/g,'');fmap[cod]=fid;newF[fid]={id:fid,code:cod,brand:'',model:s.flota.charAt(0)+s.flota.slice(1).toLowerCase(),serialNumber:'S/D',category:ST_CAT[s.flota]||(s.flota.charAt(0)+s.flota.slice(1).toLowerCase()),hours:0,location:s.frente,status:'OPERATIVO',flotaName:s.flota}}
      s.fleetId=fid;if(newF[fid]&&typeof s.hs==='number'&&s.hs>newF[fid].hours)newF[fid].hours=s.hs;
      const w=stWarn(s);if(w)D.warn.push(cod+' '+fmtD(fp.slice(0,10))+': '+w);
      if(sps.some(x=>x.id===s.id)){D.stopsOld++;return}
      if(stFinding(s.obs)){s.backlogId='BKX-'+hash36(s.id);D.backlogs.push({s,id:s.backlogId})}
      if(s.motivo==='ENGRASE'){s.grLogId='GRX-'+hash36(s.id);D.greases.push({s,id:s.grLogId})}
      D.stops.push(s)});
    D.fleetNew=Object.values(newF);D.fleetKnown=Object.keys(fmap).length-D.fleetNew.length;impData=D;
    if(!D.total)throw new Error('El archivo no tiene filas de datos.');
    show(`<h3 class="font-bold">📥 Importar reporte de mantenimiento</h3><p class="text-xs text-slate-400 mb-3">${esc(file.name)}</p>
    <div class="space-y-1 text-sm"><p>📄 Filas leídas: <b>${D.total}</b>${D.skipped?` <span class="text-amber-400">(${D.skipped} sin código o sin fecha, se omiten)</span>`:''}</p><p>🚜 Equipos nuevos a crear: <b>${D.fleetNew.length}</b> <span class="text-slate-400">(ya existentes: ${D.fleetKnown})</span></p><p>🔧 Intervenciones nuevas: <b>${D.stops.length}</b>${D.stopsOld?` <span class="text-slate-400">(${D.stopsOld} ya estaban importadas)</span>`:''}</p><p>📌 Backlogs a crear desde hallazgos: <b>${D.backlogs.length}</b> <span class="text-slate-400">(las observaciones que solo dicen "Materiales: …" no generan backlog)</span></p><p>🛢️ Engrases a registrar: <b>${D.greases.length}</b></p>
    ${D.warn.length?`<details class="text-xs text-amber-400 mt-2"><summary>⚠️ ${D.warn.length} fila(s) con inconsistencias (se importan igual)</summary>${D.warn.slice(0,12).map(w=>'<p>'+esc(w)+'</p>').join('')}</details>`:''}</div>
    <p class="text-xs text-slate-400 mt-3">Si vuelves a importar el mismo archivo no se duplica nada.</p>
    <div class="flex justify-end gap-2 mt-4"><button type="button" onclick="hide();impData=null" class="btn bg-slate-700">Cancelar</button><button type="button" onclick="doImport()" class="btn bg-emerald-500 text-slate-950" ${D.stops.length||D.fleetNew.length?'':'disabled'}>Importar</button></div>`,'34rem');
  }catch(e){show(`<h3 class="font-bold text-red-400">No se pudo leer el Excel</h3><p class="text-sm text-slate-300 mt-2">${esc(e.message||String(e))}</p><div class="flex justify-end mt-4"><button onclick="hide()" class="btn bg-slate-700">Cerrar</button></div>`,'26rem')}
}
function doImport(){
  const D=impData;if(!D||!isAdmin())return;impData=null;
  D.fleetNew.forEach(f=>put('fleet',f));
  const fm=Object.fromEntries(fleet.concat(D.fleetNew).map(e=>[e.id,e]));
  D.stops.forEach(s=>put('stops',s));
  D.backlogs.forEach(({s,id})=>put('backlogs',stBacklogFrom(s,fm[s.fleetId]||{id:s.fleetId},id)));
  D.greases.forEach(({s,id})=>put('grease',stGreaseFrom(s,id)));
  D.fleetNew.length||0;
  const hrs={};D.stops.forEach(s=>{if(typeof s.hs==='number')hrs[s.fleetId]=Math.max(hrs[s.fleetId]||0,s.hs)});
  fleet.forEach(e=>{if(hrs[e.id]>(Number(e.hours)||0))put('fleet',{...e,hours:hrs[e.id]})});
  hide();note(`Importación lista: ${D.fleetNew.length} equipos, ${D.stops.length} intervenciones, ${D.backlogs.length} backlogs y ${D.greases.length} engrases.`);
  const f0=D.stops.map(s=>s.fp.slice(0,10)).sort().pop();if(f0){repDate=f0;}if(cur==='rep')render();else tab('rep');
}
/* ---------- PDF del día ---------- */
function makePdfRep(d){
  const J=window.jspdf&&window.jspdf.jsPDF;if(!J){note('No se pudo cargar el generador de PDF. Revisa tu conexión a internet y recarga la página.');return}
  const doc=new J({unit:'mm',format:'a4'}),W=210,M=15,L=stDay(d),C=L.filter(s=>s.status!=='ABIERTA');let y=0;
  const pt=s=>String(s==null?'':s).replace(/[^\x20-\x7E -ÿ\n]/g,''),need=h=>{if(y+h>280){doc.addPage();y=M+4}};
  doc.setFillColor(15,23,42);doc.rect(0,0,W,28,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text('REPORTE DIARIO DE MANTENIMIENTO',M,13);
  doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text('COANSA',M,20);doc.setFontSize(9);doc.text('Fecha: '+fmtD(d),W-M,13,{align:'right'});doc.text('Emitido por: '+pt(me?me.name:''),W-M,20,{align:'right'});y=37;
  const sec=t=>{need(14);doc.setFillColor(241,245,249);doc.rect(M,y-5,W-2*M,7.5,'F');doc.setTextColor(180,83,9);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(t,M+2,y);y+=8;doc.setTextColor(30,41,59)};
  const row=(l,v)=>{const t=doc.splitTextToSize(pt(v===''||v==null?'-':v),W-2*M-52);need(t.length*5+2);doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.text(l,M+2,y);doc.setFont('helvetica','normal');doc.text(t,M+52,y);y+=t.length*5+1.5};
  const para=(t,b,x)=>{const q=doc.splitTextToSize(pt(t),W-2*M-4-(x||0));need(q.length*4.6+2);doc.setFont('helvetica',b?'bold':'normal');doc.setFontSize(9);doc.text(q,M+2+(x||0),y);y+=q.length*4.6+1.2};
  const H=Math.round(C.reduce((t,s)=>t+(Number(s.t)||0),0)*100)/100,by={};C.forEach(s=>by[s.motivo]=(by[s.motivo]||0)+1);
  sec('RESUMEN DEL DIA');row('Intervenciones:',C.length+' cerradas'+(L.length-C.length?' + '+(L.length-C.length)+' abiertas':''));row('Horas de intervencion:',H+' h');row('Planificadas / No planificadas:',C.filter(s=>s.tipo==='PLANIFICADA').length+' / '+C.filter(s=>s.tipo!=='PLANIFICADA').length);row('Por motivo:',Object.keys(by).map(k=>k+' '+by[k]).join(', ')||'-');row('Equipos intervenidos:',[...new Set(L.map(s=>s.cod))].length);y+=2;
  sec('INTERVENCIONES');if(!L.length)para('No hay intervenciones registradas para esta fecha.');
  L.forEach((s,i)=>{para((i+1)+'. '+s.cod+' '+s.flota+' | '+s.motivo+' | '+(s.tipo==='PLANIFICADA'?'Planificada':'No planificada')+' | '+s.fp.slice(11,16)+(s.status==='ABIERTA'?' (abierta)':'-'+(s.fs||'').slice(11,16)+' ('+s.t+' h)'),true);
    para('Sistema: '+(s.sistema||'-')+' | Resp.: '+s.resp+' | '+(s.frente||'-')+' | '+(s.lugar||'-')+' | Horom.: '+fmtH(s.hp)+(s.status==='ABIERTA'?'':' -> '+fmtH(s.hs)),false,4);
    if(s.desc)para(s.desc,false,4);if(s.obs)para('Obs.: '+s.obs,false,4);y+=1.5});
  need(40);y+=16;doc.setDrawColor(100,116,139);doc.line(M+5,y,M+70,y);doc.line(W-M-70,y,W-M-5,y);doc.setFontSize(9);doc.text('Planner de mantenimiento',M+37,y+5,{align:'center'});doc.text('Supervisor (V.B.)',W-M-37,y+5,{align:'center'});
  const n=doc.getNumberOfPages();for(let i=1;i<=n;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(120);doc.text('Pagina '+i+' de '+n,W/2,291,{align:'center'})}
  fileOut(doc.output('blob'),'Reporte_Diario_'+d+'.pdf','📄 Reporte diario listo');
}

/* =====================================================================
   SESIÓN, ROLES Y PANEL DE ADMINISTRACIÓN (Planner)
   ===================================================================== */
const ROLE_L={admin:'Planner / Administrador (control total)',supervisor:'Supervisor / Jefe (valida y programa)',tecnico:'Técnico / personal de campo'};
const PERFIL_D={tecnico:'Registra backlogs, engrases y neumáticos, y cierra trabajos con su firma.',supervisor:'Además valida o devuelve trabajos, programa preventivos y configura planes.',admin:'Control total: personal, flota, eliminaciones, reaperturas y respaldos.'};
const CARGOS=['Técnico mecánico','Técnico electricista','Técnico electrónico','Técnico de neumáticos','Engrasador','Soldador','Operador','Supervisor de mantenimiento','Supervisor eléctrico','Jefe de mantenimiento','Jefe de taller','Planner de mantenimiento','Administrador del sistema'];
const POS_DEF={tecnico:'Técnico mecánico',supervisor:'Supervisor de mantenimiento',admin:'Planner de mantenimiento'};
const roleFromPos=p=>{p=nk(p);return /planner|administrador|admin|gerente/.test(p)?'admin':/supervisor|jefe|coordinador|residente/.test(p)?'supervisor':'tecnico'};
const posOf=n=>(me&&String(n||'').trim()===me.name)?(me.position||''):'';
const ROLE_S={admin:'Planner',supervisor:'Supervisor',tecnico:'Técnico'};
const ROLE_C={admin:'bg-amber-500/10 text-amber-400 border-amber-500/30',supervisor:'bdg-v',tecnico:'bg-blue-500/10 text-blue-400 border-blue-500/30'};
const techVal=old=>(me&&me.role==='tecnico')?me.name:(old||(me&&me.uid!=='local'?me.name:''));
const techRo=()=>(me&&me.role==='tecnico')?' readonly':'';
const selfClosed=o=>!!(o.closeUid&&me&&o.closeUid===me.uid&&me.role!=='admin');
function authMsg(e){
  const m={'auth/invalid-credential':'Usuario o contraseña incorrectos.','auth/wrong-password':'Usuario o contraseña incorrectos.','auth/user-not-found':'Usuario o contraseña incorrectos.',
    'auth/invalid-email':'El correo no es válido.','auth/too-many-requests':'Demasiados intentos. Espera unos minutos o restablece tu contraseña.','auth/network-request-failed':'Sin conexión a internet.',
    'auth/operation-not-allowed':'El acceso con correo y contraseña no está habilitado en Firebase (Authentication → Método de acceso → Correo electrónico).','auth/email-already-in-use':'Ese correo ya tiene una cuenta. Usa "Ingresar".',
    'auth/weak-password':'La contraseña debe tener al menos 6 caracteres.','auth/user-disabled':'Esta cuenta está deshabilitada.','permission-denied':'No tienes permiso para esta acción.'};
  return m[e&&e.code]||('Error: '+((e&&(e.code||e.message))||'desconocido'));
}

/* ---------- Pantalla de acceso ---------- */
function showLogin(html){const l=$('login');l.innerHTML=`<div class="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3" style="width:100%;max-width:24rem"><div style="text-align:center"><div style="display:flex;align-items:center;justify-content:center;gap:.6rem"><svg width="56" height="56" viewBox="0 0 64 64" role="img" aria-label="Mantify"><circle cx="32" cy="32" r="23" fill="none" stroke="#2DD4BF" stroke-width="8" stroke-dasharray="9.03 9.03"/><circle cx="32" cy="32" r="21" fill="#2DD4BF"/><path d="M22.5 32.5 L29 39 L42 25.5" fill="none" stroke="#0F2A44" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span style="font-family:'Space Grotesk',Inter,system-ui,sans-serif;font-weight:700;font-size:40px;line-height:1;letter-spacing:-.045em;color:#F8FAFC" class="mf-word">mantify</span></div><p class="mf-sub" style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#A9BACB;margin-top:.6rem">Control de mantenimiento de equipos</p></div>${html}</div>`;l.style.display='flex';document.body.classList.add('noauth')}
function hideLogin(){$('login').style.display='none';document.body.classList.remove('noauth')}
try{localStorage.removeItem('lastUser')}catch(_){} // versiones anteriores guardaban el último usuario; se limpia
function toast(t){const d=document.createElement('div');d.textContent=t;d.style.cssText='position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:80;background:#10b981;color:#052e1b;font-weight:600;padding:.6rem 1rem;border-radius:.75rem;box-shadow:0 6px 20px #0008;max-width:90%;text-align:center';document.body.appendChild(d);setTimeout(()=>d.remove(),2600)}
function loginForm(mode,msg,email){
  const up=mode==='up';
  showLogin(`<form onsubmit="doLogin(event,'${mode}')" class="space-y-3">
    <p class="text-sm text-slate-300">${up?'Primer ingreso del planner: crea tu cuenta con el correo registrado como administrador.':'Ingresa con tu usuario y contraseña.'}</p>
    <input class="inp" name="email" ${up?'type="email"':'type="text" autocapitalize="none" autocorrect="off" spellcheck="false"'} autocomplete="username" maxlength="100" placeholder="${up?'Correo del planner':'Usuario (ej. jorge.tanta)'}" value="${esc(email||'')}" required>
    <div style="position:relative"><input class="inp" id="lg-pw" name="pass" type="password" maxlength="128" autocomplete="${up?'new-password':'current-password'}" placeholder="Contraseña${up?' (mínimo 6 caracteres)':''}" required minlength="6" style="padding-right:3rem"><button type="button" id="lg-eye" onclick="const i=$('lg-pw'),h=i.type==='password';i.type=h?'text':'password';this.textContent=h?'🙈':'👁️'" aria-label="Mostrar u ocultar contraseña" style="position:absolute;right:0;top:0;bottom:0;width:3rem;font-size:18px">👁️</button></div>
    <p id="lg-err" class="text-xs text-red-400 ${msg?'':'hidden'}">${esc(msg||'')}</p>
    <button id="lg-go" class="btn bg-amber-500 text-slate-950 w-full">${up?'Crear cuenta':'Ingresar'}</button></form>
    <div class="text-xs text-slate-400 space-y-2" style="text-align:center">${up?'<button type="button" onclick="loginForm(\'in\')" class="underline">Ya tengo cuenta</button>':'<button type="button" onclick="resetForm()" class="underline">¿Olvidaste tu contraseña?</button>'}</div>
    ${up||!db?'':'<div class="border-t border-slate-700" style="padding-top:.75rem;text-align:center"><p class="text-xs text-slate-400 mb-2">¿Eres nuevo en el equipo?</p><button type="button" onclick="regForm()" class="btn bg-slate-700 w-full">📝 Crear mi cuenta</button></div>'}`);
  lgWire();
}
/* ---------- Límite de intentos de login ---------- */
// LG_MAX fallos = LG_WAIT s de bloqueo; cada fallo posterior suma LG_WAIT s más. Cambia los números aquí.
// shortcut: el contador vive en memoria y recargar la página lo reinicia; el bloqueo que no se salta es el de Firebase (too-many-requests)
const LG_MAX=5,LG_WAIT=30,lg={f:0,n:0,u:0};let lgTimer=null;
try{localStorage.removeItem('lgLock')}catch(_){} // versión anterior lo guardaba en localStorage
const lgLeft=()=>Math.ceil((lg.u-Date.now())/1000);
function lgFail(){lg.f++;if(lg.f>=LG_MAX){lg.n++;lg.u=Date.now()+lg.n*LG_WAIT*1000}}
function lgOk(){lg.f=lg.n=lg.u=0}
function lgWire(){
  const f=document.querySelector('#login form'),b=$('lg-go'),er=$('lg-err');if(!f||!b||f.getAttribute('onsubmit').indexOf("'in'")<0)return;
  clearInterval(lgTimer);const filled=()=>!!(f.email.value.trim()&&f.pass.value);
  const tick=()=>{const left=lgLeft();
    if(left>0){b.disabled=true;b.textContent='⏳ Espera '+left+' s';er.textContent='⚠️ Alcanzaste el límite de intentos fallidos. Espera '+left+' s para volver a intentar.';er.className='lg-alert';er.setAttribute('role','alert')}
    else{clearInterval(lgTimer);b.textContent='Ingresar';b.disabled=!filled();if(er.classList.contains('lg-alert')){er.className='hidden';er.textContent=''}}};
  f.addEventListener('input',()=>{if(lgLeft()<=0)b.disabled=!filled()});
  tick();if(lgLeft()>0)lgTimer=setInterval(tick,1000);
}
let nextLoginMsg='';
async function doLogin(ev,mode){
  ev.preventDefault();if(lgLeft()>0)return;const f=ev.target,email=toAuthEmail(f.email.value),pass=f.pass.value,btn=$('lg-go');if(!f.email.value.trim()||!pass)return;btn.disabled=true;btn.textContent='Un momento…';
  try{await auth.signInWithEmailAndPassword(email,pass).catch(e=>{const u=f.email.value.trim();if(u.includes('@')||!/credential|user-not-found/.test(e.code||''))throw e;return auth.signInWithEmailAndPassword(uname(u)+DOM_OLD,pass)})}
  catch(e){if(/credential|user-not-found|wrong-password|invalid-email|user-disabled|too-many-requests/.test(e.code||''))lgFail();loginForm('in',authMsg(e),email)}
}
/* ---------- Autorregistro: la persona crea su cuenta y queda pendiente hasta que el planner la apruebe ---------- */
let regBusy=false;
function regForm(msg){
  showLogin(`<form onsubmit="doRegister(event)" class="space-y-3"><p class="text-sm text-slate-300"><b>Crear mi cuenta.</b> Tú eliges tu usuario y tu contraseña. El planner revisará tu solicitud y te dará acceso.</p>
    <input class="inp" name="name" maxlength="80" placeholder="Nombre completo *" required oninput="const u=this.form.username;if(!u.dataset.t)u.value=userBase(this.value)">
    <input class="inp" name="position" list="cargos-r" maxlength="80" placeholder="Cargo * (ej. Técnico electricista)" required><datalist id="cargos-r">${CARGOS.map(x=>`<option value="${esc(x)}">`).join('')}</datalist>
    <label class="block text-xs text-slate-400 font-semibold">Usuario para ingresar<input class="inp mt-1 font-normal" name="username" maxlength="40" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="username" placeholder="ej. jorge.tanta" required oninput="this.dataset.t=1"></label>
    <input class="inp" name="pass" type="password" maxlength="128" minlength="6" autocomplete="new-password" placeholder="Contraseña (mínimo 6 caracteres) *" required>
    <input class="inp" name="pass2" type="password" maxlength="128" minlength="6" autocomplete="new-password" placeholder="Repite la contraseña *" required>
    ${sigBox('Mi firma (opcional)','opt')}
    <p id="rg-err" class="text-xs text-red-400 ${msg?'':'hidden'}">${esc(msg||'')}</p>
    <button id="rg-go" class="btn bg-amber-500 text-slate-950 w-full">Enviar solicitud</button></form>
    <div class="text-xs text-slate-400" style="text-align:center"><button type="button" onclick="regBusy=false;loginForm('in')" class="underline">Ya tengo cuenta: ingresar</button></div>`);
  sigInit('');
}
async function doRegister(ev){
  ev.preventDefault();const F=ev.target,f=Object.fromEntries(new FormData(F)),er=$('rg-err'),go=$('rg-go'),bad=m=>{er.textContent=m;er.classList.remove('hidden');er.scrollIntoView({block:'center'})};
  const name=(f.name||'').trim(),position=(f.position||'').trim(),un=uname(f.username);
  if(!name||!position)return bad('Escribe tu nombre completo y tu cargo.');
  if(un.length<3)return bad('El usuario debe tener al menos 3 letras (solo letras, números, punto o guion).');
  if((f.pass||'').length<6)return bad('La contraseña debe tener al menos 6 caracteres.');
  if(f.pass!==f.pass2)return bad('Las dos contraseñas no coinciden.');
  const signature=sig.drawn?sigData():'';
  regBusy=true;go.disabled=true;go.textContent='Enviando…';
  try{
    const c=await auth.createUserWithEmailAndPassword(un+DOM,f.pass);
    try{await db.collection('users').doc(c.user.uid).set({uid:c.user.uid,name,position,username:un,authEmail:un+DOM,email:un+DOM,pass:await hashPw(f.pass),signature,signatureAt:signature?Date.now():0,role:'tecnico',active:false,pending:true,createdAt:Date.now(),createdBy:'Autorregistro'})}
    catch(e){try{await c.user.delete()}catch(_){}throw e}
    await auth.signOut();
    showLogin(`<p class="text-sm text-emerald-400 font-semibold">✔ Solicitud enviada</p><p class="text-sm text-slate-300">Tu usuario es <b>${esc(un)}</b>. Cuando el planner apruebe tu solicitud podrás ingresar con ese usuario y la contraseña que elegiste.</p><button type="button" onclick="regBusy=false;loginForm('in')" class="btn bg-amber-500 text-slate-950 w-full">Volver al ingreso</button>`);
  }catch(e){
    try{if(auth.currentUser)await auth.signOut()}catch(_){}
    regForm(e&&e.code==='auth/email-already-in-use'?`El usuario "${un}" ya existe. Elige otro (por ejemplo ${un}2).`:e&&e.code==='permission-denied'?'Firebase aún no permite el autorregistro (falta publicar las reglas). Pide al planner que te registre.':authMsg(e));
    const F2=document.querySelector('#login form');if(F2){F2.name.value=name;F2.position.value=position;F2.username.value=un;F2.username.dataset.t=1}
  }
}
function resetForm(msg,ok,email){
  showLogin(`<form onsubmit="doReset(event)" class="space-y-3"><p class="text-sm text-slate-300"><b>Técnicos y supervisores:</b> comunícate con tu planner; él te asignará una contraseña nueva.</p><p class="text-sm text-slate-300"><b>Planner:</b> escribe tu correo y te enviaremos un enlace para crear una nueva contraseña.</p>
    <input class="inp" name="email" type="email" placeholder="Correo del planner" value="${esc(email||'')}" required>
    <p class="text-xs ${ok?'text-emerald-400':'text-red-400'} ${msg?'':'hidden'}">${esc(msg||'')}</p>
    <button class="btn bg-amber-500 text-slate-950 w-full">Enviar enlace</button></form>
    <div class="text-xs text-slate-400" style="text-align:center"><button type="button" onclick="loginForm('in')" class="underline">Volver</button></div>`);
}
async function doReset(ev){ev.preventDefault();const em=ev.target.email.value.trim();
  try{await auth.sendPasswordResetEmail(em);resetForm('Si el correo está registrado, te enviamos el enlace. Revisa también la carpeta de spam.',true,em)}catch(e){resetForm(authMsg(e),false,em)}}
function blocked(msg){showLogin(`<p class="text-sm text-amber-400">${esc(msg)}</p><button type="button" onclick="logout(true)" class="btn bg-slate-700 w-full">Cerrar sesión</button>`)}

/* ---------- Sesión ---------- */
function stopData(){eqnStop();unsubs.forEach(f=>{try{f()}catch(_){}});unsubs=[];loadedCols.clear();fleet=[];backlogs=[];pms=[];grs=[];gpl=[];trs=[];trp=[];sps=[];usersList=[];staffList=[]}
// al salir se borra la copia offline de Firestore para que el siguiente usuario del equipo no vea datos ajenos
// antes se suben los cambios pendientes: clearPersistence borra también la cola offline
async function logout(force){
  if(!auth)return location.reload();
  if(!force){
    if(!navigator.onLine){ask('Estás sin conexión y puede haber cambios sin subir. Si sales ahora se pierden. ¿Salir igual?',()=>logout(true),'Salir igual');return}
    setSync(true,'Subiendo cambios pendientes…');
    try{await Promise.race([db.waitForPendingWrites(),new Promise((_,no)=>setTimeout(()=>no(new Error('timeout')),15000))])}
    catch(_){ask('No se pudieron subir todos los cambios (conexión lenta). Si sales ahora se pierden. ¿Salir igual?',()=>logout(true),'Salir igual');return}
  }
  auth.signOut().then(()=>db.terminate()).then(()=>db.clearPersistence()).catch(e=>console.error(e)).finally(()=>location.reload())}
function initAuth(){
  showLogin('<p class="text-sm text-slate-400" style="text-align:center">Verificando sesión…</p>');
  auth.onAuthStateChanged(async u=>{
    if(regBusy)return; // durante el autorregistro la sesión se abre y cierra sola
    stopData();me=null;
    if(!u){loginForm('in',nextLoginMsg);nextLoginMsg='';return}
    showLogin('<p class="text-sm text-slate-400" style="text-align:center">Cargando tu perfil…</p>');
    try{
      const ref=db.collection('users').doc(u.uid);let s=await ref.get();
      if(!s.exists){blocked('Tu cuenta ('+u.email+') aún no está dada de alta en el sistema. Pide al planner que te registre.');return}
      const p=s.data();
      if(p.pending){blocked('Tu solicitud de acceso está pendiente. El planner debe aprobarla para que puedas ingresar.');return}
      if(p.active===false){blocked('Tu acceso está desactivado. Contacta al planner.');return}
      lgOk(); // Firebase Auth ya validó la clave; el hash de users.pass es solo una copia y no bloquea el ingreso
      me={uid:u.uid,email:u.email,name:p.name||u.email,role:p.role,position:p.position||'',signature:p.signature||''};
      startApp();
    }catch(e){console.error(e);blocked('No se pudo cargar tu perfil. '+authMsg(e))}
  });
}
function applyRole(){
  supOk=isSup();
  $('t-sup').style.display=supOk?'':'none';$('t-sup').style.order=supOk?'1':'';
  $('t-adm').style.display=isAdmin()?'':'none';
  $('t-plan').style.display=isSup()?'':'none';
  $('bt-fleet').style.display=isAdmin()?'':'none';
  if($('bt-fimp'))$('bt-fimp').style.display=isAdmin()?'':'none';
  if($('bt-fdelall'))$('bt-fdelall').style.display=isAdmin()?'':'none';
  $('bt-pm').style.display=supOk?'':'none';
  $('bt-imp').style.display=supOk?'':'none';
  ['bk','gr','pm'].forEach(k=>{const b=$('bt-mod-'+k);if(b)b.style.display=isAdmin()?'':'none'});
  $('userbox').innerHTML=`<button type="button" onclick="openMe()" title="Mi perfil y firma" style="text-align:right;line-height:1.2;max-width:8.5rem;overflow:hidden;min-height:44px"><b class="text-slate-200" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${me.uid!=='local'&&!me.signature?'⚠️ ':''}${esc(me.name)}</b><span class="text-slate-400" style="font-size:10px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(me.position||ROLE_S[me.role]||me.role)}</span></button><button type="button" onclick="themeToggle()" class="btn bg-slate-700 !py-1" title="${isLight()?'Fondo oscuro':'Fondo blanco'}" aria-label="Cambiar fondo blanco u oscuro">${isLight()?'🌙':'☀️'}</button>${auth?'<button onclick="logout()" class="btn bg-slate-700 !py-1">Salir</button>':''}`;
}
function startApp(){
  hideLogin();applyRole();if(me.uid!=='local')toast('👋 Bienvenido(a), '+String(me.name).split(' ')[0]);
  listen('fleet',d=>{fleet=d;eqnPing('onFleet')});listen('backlogs',d=>backlogs=d.map(bkNorm));listen('preventive',d=>pms=d);listen('grease',d=>{grs=d;eqnPing('onOld')});listen('greasePlans',d=>gpl=d);listen('tires',d=>{trs=d;eqnPing('onOld')});eqnBootSoon();listen('tireParams',d=>trp=d);listen('stops',d=>sps=d);
  if(db)unsubs.push(db.collection('users').doc(me.uid).onSnapshot(d=>{if(!d.exists||d.data().active===false){nextLoginMsg='Tu acceso fue desactivado.';logout(true);return}
    const p=d.data();me.name=p.name||me.name;me.position=p.position||'';me.signature=p.signature||'';applyRole()},e=>console.error(e)));
  let lastPend=0;staffListen();
  if(db&&isAdmin())unsubs.push(db.collection('users').onSnapshot(s=>{usersList=s.docs.map(d=>d.data());migratePw();setTimeout(staffSync,1500);if(cur==='adm')renderAdm();
    const np=usersList.filter(u=>u.pending).length;if(np>lastPend)toast('📝 '+np+' solicitud(es) de acceso por aprobar en Admin');lastPend=np},e=>console.error(e)));
  tab('dash');openEquipHash();
  let asked=false;try{asked=sessionStorage.getItem('sigAsk')==='1';sessionStorage.setItem('sigAsk','1')}catch(_){}
  if(db&&me.uid!=='local'&&!me.signature&&!asked)setTimeout(()=>{if(!me.signature&&$('modal').classList.contains('hidden'))ask('Aún no tienes tu firma registrada. Regístrala una sola vez y se cargará sola en tus cierres y validaciones.',openMe,'✍️ Registrar firma','bg-amber-500 text-slate-950')},900);
}

/* ---------- Acciones exclusivas del planner ---------- */
function reopen(col,id){
  const o=getStore(col).find(x=>x.id===id);if(!o||!isAdmin())return;
  ask('¿Reabrir este trabajo? Se borrarán las firmas del cierre y de la validación y volverá al técnico.',()=>{
    const clr={closeSignature:'',supName:'',supDate:'',supNotes:'',supSignature:'',closeUid:'',rejectNote:'Reabierto por el planner ('+me.name+')',rejectBy:me.name,rejectDate:today()};
    put(col,col==='backlogs'?{...o,...clr,status:'EN_EJECUCION',closeDate:'',log:bkLog(o,'Reabierto por '+me.name)}:{...o,...clr,status:'PROGRAMADO'});
  },'Reabrir','bg-amber-500 text-slate-950');
}
// texto que empieza con = + - @ se antepone ' para que Excel no lo ejecute como fórmula (CSV injection); los números se dejan tal cual
const csvCell=v=>{const t=typeof v==='string';v=v==null?'':String(v);if(t&&/^[=+\-@\t\r]/.test(v))v="'"+v;return /[;"\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
const toCsv=rows=>'﻿'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n');
function exportCsv(kind){
  let rows,name;
  if(kind==='back'){name='backlogs';rows=[['N° backlog','Equipo','Familia','Fecha detección','Detectado por','Fuente','Horómetro/km','Sistema','Componente','Observación','Prioridad','Tipo','Requiere parada','Estado','Fecha límite','Vencido','Días abierto','Días fuera de plazo','HH estimadas','N° requerimiento','OT','Responsable OT','Fecha programada','Fecha cierre','Técnico','Horas fuera de servicio','Supervisor','Fecha validación','Costo']];
    backlogs.forEach(b=>{const e=eqOf(b.fleetId);rows.push([bkNo(b),e.code,e.category,b.observationDate,b.detectedBy,b.source,b.hoursAt,b.system,b.component,b.description,PR_L[b.criticality]||b.criticality,b.workType,b.needsStop?'Sí':'No',stLabel(b.status),bkLimit(b),bkVenc(b)?'Sí':'No',bkAge(b),bkLate(b),b.hh,b.rqMain,b.ot?b.ot.num:'',b.ot?b.ot.resp:'',b.scheduledDate,b.closeDate,b.closeTech,b.downtimeH,b.supName,b.supDate,b.cost])})}
  else if(kind==='rq'){name='requerimientos';rows=[['Tipo','N° requerimiento','Descripción','Proveedor','Solicitado','Llegada estimada','Estado','Días de espera','Atrasado','Backlog','Equipo','Componente','Estado del backlog']];
    rqRows().forEach(({b,r})=>{const e=eqOf(b.fleetId);rows.push([RQ_T[r.type],r.num,r.desc,r.provider,r.reqDate,r.estDate,RQ_ST[r.st].l,rqWait(r),rqLate(r)?'Sí':'No',bkNo(b),e.code,b.component,stLabel(b.status)])})}
  else if(kind==='pm'){name='preventivos';rows=[['Código','Equipo','Plan','Fecha programada','Estado','Fecha ejecución','Horómetro cierre','Técnico','Duración (h)','Act. realizadas','Act. observadas','Horas-hombre','Supervisor','Fecha validación']];
    pms.forEach(p=>{const e=eqOf(p.fleetId),a=actStats(p.acts);rows.push([pmOt(p),e.code,p.plan,p.scheduledDate,PM_LONG[p.status]||p.status,p.execDate,p.closeHours,p.closeTech,p.durationH,p.acts?a.OK:'',p.acts?a.OBS:'',(p.crew||[]).reduce((t,r)=>t+(Number(r.h)||0),0),p.supName,p.supDate])})}
  else if(kind==='tr'){name='neumaticos';rows=[['Código','Marca','Diseño','Medida','Tipo','Estado','Equipo','Posición','Cocada nueva (mm)','Cocada actual (mm)','Última medición','Recorrido','Costo ($)','Costo por hora ($)','Recapados']];
    trs.forEach(t=>{const e=eqOf(t.fleetId),c=trCph(t);rows.push([t.code,t.brand,t.design,t.size,t.type,TR_L[t.status]||t.status,t.status==='MONTADO'?e.code:'',t.status==='MONTADO'?t.pos:'',t.cocadaInit,t.lastCocada,t.lastReadDate,Math.round(trRun(t)),(Number(t.cost)||0)+(Number(t.retreadCost)||0),c?c.toFixed(2):'',t.retreads||0])})}
  else if(kind==='trm'){name='mediciones_cocada';rows=[['Neumático','Equipo','Posición','Fecha','Horómetro','Tipo','Medidas (mm)','Mínima (mm)','Diferencia (mm)','psi','Técnico','Observación']];
    trs.forEach(t=>(t.reads||[]).slice().sort(trSort).forEach(r=>{const q=eqOf(r.fid||t.fleetId);rows.push([t.code,q.code,r.pos||t.pos,r.d,r.h,r.ev==='M'?'Montaje':r.ev==='D'?'Desmontaje':'Medición',(r.v||[r.i,r.m,r.e]).filter(x=>x!=null).join(' / '),r.c,r.diff,r.psi,r.by,r.note])}))}
  else if(kind==='gr'){name='engrase';rows=[['Código','Equipo','Fecha','Horómetro','Técnico','Grasa','Cantidad','Unidad','Puntos engrasados','Puntos totales','Puntos sin engrasar','Observaciones']];
    [...grs].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).forEach(r=>{const e=eqOf(r.fleetId);rows.push([e.code,(e.brand||'')+' '+(e.model||''),r.date,r.hours,r.tech,r.grease,r.qty,r.unit,r.done,r.total,(r.points||[]).filter(x=>!x.ok).map(x=>x.d).join(', '),r.notes])})}
  else{name='flota';rows=[[...FTPL_H,'HORÓMETRO','UBICACIÓN','ESTADO']];fleet.forEach((e,i)=>rows.push([i+1,e.category,e.code,e.plate||'',e.serialNumber,e.model,e.brand,e.year||'',e.provider||'',e.project||'',e.hours,e.location,e.status]))}
  fileOut(new Blob([toCsv(rows)],{type:'text/csv;charset=utf-8'}),name+'_'+today()+'.csv','📊 Archivo listo (abre con Excel)');
}
function exportJson(){
  const data={exportadoEl:new Date().toISOString(),exportadoPor:me.name,fleet,backlogs,preventive:pms,grease:grs,greasePlans:gpl,tires:trs,tireParams:trp,stops:sps,users:usersList.map(({pass,...u})=>u)};
  fileOut(new Blob([JSON.stringify(data)],{type:'application/json'}),'respaldo_completo_'+today()+'.json','💾 Respaldo listo');
}

/* ---------- Panel de administración ---------- */
function renderAdm(){
  const el=$('v-adm');if(!isAdmin()){el.innerHTML='';return}
  const ord={admin:0,supervisor:1,tecnico:2},pend=usersList.filter(u=>u.pending),us=[...usersList].filter(u=>!u.pending).sort((a,b)=>(ord[a.role]-ord[b.role])||String(a.name).localeCompare(String(b.name)));
  const act=[...backlogs.map(b=>({t:'Backlog',id:b.id,s:stLabel(b.status),by:b.updatedBy,at:b.updatedAt})),...pms.map(p=>({t:'Preventivo',id:p.id,s:PM_LONG[p.status]||p.status,by:p.updatedBy,at:p.updatedAt})),...trs.map(t=>({t:'Neumático',id:t.code,s:TR_L[t.status]||t.status,by:t.updatedBy,at:t.updatedAt})),...grs.map(g=>({t:'Engrase',id:eqOf(g.fleetId).code,s:g.done+'/'+g.total+' puntos',by:g.updatedBy,at:g.updatedAt})),...fleet.map(f=>({t:'Equipo',id:f.code,s:f.status,by:f.updatedBy,at:f.updatedAt}))]
    .filter(x=>x.at).sort((a,b)=>b.at-a.at).slice(0,12);
  const nosig=us.filter(u=>u.active!==false&&!u.signature).length;
  const Btn=(t,f,c='bg-slate-700')=>`<button onclick="${f}" class="btn ${c} !py-1">${t}</button>`;
  el.innerHTML=`${pend.length?`
  <div class="bg-slate-800 rounded-xl p-4 space-y-2" style="border:1px solid #f59e0b"><h3 class="font-bold text-amber-400">📝 Solicitudes de acceso (${pend.length})</h3><p class="text-xs text-slate-400">Personas que crearon su cuenta desde la pantalla de ingreso. Apruébalas para que puedan entrar.</p>
    ${pend.map(u=>`<div class="border-t border-slate-700 flex justify-between items-start gap-2 flex-wrap" style="padding-top:.6rem"><div class="min-w-0" style="flex:1 1 12rem"><b>${esc(u.name)}</b><p class="text-xs text-slate-300">${esc(u.position||'Sin cargo')}</p><p class="text-xs text-slate-400">Usuario: <b class="text-slate-200">${esc(u.username)}</b> · ${u.createdAt?new Date(u.createdAt).toLocaleString('es-PE',{dateStyle:'short',timeStyle:'short'}):''}</p></div>
      ${u.signature?`<img src="${esc(u.signature)}" alt="firma" style="height:2.6rem;max-width:7rem;object-fit:contain;background:#fff;border-radius:.35rem;padding:2px">`:''}
      <div class="flex gap-1">${Btn('✅ Aprobar',`openApprove('${u.uid}')`,'bg-emerald-500 text-slate-950')}${Btn('✖ Rechazar',`rejectReq('${u.uid}')`,'bg-red-500/20 text-red-400')}</div></div>`).join('')}</div>`:''}
  <div class="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2">
    <div class="flex justify-between items-center gap-2 flex-wrap"><div><h3 class="font-bold">👥 Personal</h3><p class="text-xs text-slate-400">${db?us.length+' registrado(s)'+(nosig?` · <span class="text-amber-400">${nosig} sin firma</span>`:''):'Disponible al conectar Firebase'}</p></div>${db?'<div class="flex gap-2 flex-wrap"><button onclick="renewAll()" class="btn bg-slate-700">🔄 Renovar accesos</button><button onclick="openUsers()" class="btn bg-slate-700">📋 Carga masiva</button><button onclick="openUser()" class="btn bg-amber-500 text-slate-950">+ Agregar persona</button></div>':''}</div>
    ${us.map(u=>`<div class="border-t border-slate-700" style="padding-top:.6rem"><div class="flex justify-between items-start gap-2 flex-wrap">
      <div class="min-w-0" style="flex:1 1 12rem"><b>${esc(u.name)}</b> <span class="bdg ${ROLE_C[u.role]||''}">${esc(ROLE_S[u.role]||u.role)}</span>${u.active===false?' <span class="bdg bg-red-500/10 text-red-400 border-red-500/30">DESACTIVADO</span>':''}
        <p class="text-xs text-slate-300">${esc(u.position||'Sin cargo asignado')}</p><p class="text-xs text-slate-400" style="overflow-wrap:anywhere">${u.username?'Usuario: <b class="text-slate-200">'+esc(u.username)+'</b>':esc(u.email)}</p>
        <p class="text-[11px] ${u.signature?'text-emerald-400':'text-amber-400'}">${u.signature?'✍️ Firma registrada':'⚠️ Sin firma: usa ✏️ para registrarla'}</p></div>
      ${u.signature?`<img src="${esc(u.signature)}" alt="firma" style="height:2.6rem;max-width:7rem;object-fit:contain;background:#fff;border-radius:.35rem;padding:2px">`:''}
      <div class="flex gap-1 flex-wrap justify-end">${Btn('✏️',`openUser('${u.uid}')`)}${Btn('🔑',`openReset('${u.uid}')`)}${u.uid!==me.uid?Btn('🔄',`renewUser('${u.uid}')`)+Btn(u.active===false?'Activar':'Desactivar',`toggleUser('${u.uid}')`)+Btn('🗑️',`delUser('${u.uid}')`,'bg-red-500/20 text-red-400'):''}</div></div></div>`).join('')}
    <p class="text-[11px] text-slate-500">✏️ edita nombre, cargo, perfil y firma. 🔑 asigna una contraseña nueva (necesita la Cloud Function). 🔄 renueva el acceso: crea usuario y contraseña nuevos conservando nombre, cargo, perfil y firma; el acceso anterior deja de funcionar. Las contraseñas se guardan cifradas y solo se ven al crearlas. Desactivar bloquea el acceso sin borrar su historial; 🗑️ elimina a la persona (sus trabajos registrados se conservan). La firma registrada se precarga sola en cierres y validaciones.</p></div>
  <div class="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2"><h3 class="font-bold">💾 Respaldo y exportación</h3>
    <div class="grid gap-2 sm:grid-cols-4">${Btn('📊 Backlogs (Excel)',"exportCsv('back')")}${Btn('📊 Preventivos (Excel)',"exportCsv('pm')")}${Btn('📊 Engrase (Excel)',"exportCsv('gr')")}${Btn('📊 Neumáticos (Excel)',"exportCsv('tr')")}${Btn('📊 Mediciones de cocada',"exportCsv('trm')")}${Btn('📊 Flota (Excel)',"exportCsv('fleet')")}${Btn('📊 Reporte de mantenimiento (Excel)',"exportStopsOpen()")}${Btn('📥 Importar reporte (Excel)',"importStopsPick()")}${Btn('💾 Respaldo completo',"exportJson()",'bg-amber-500 text-slate-950')}</div>
    <p class="text-[11px] text-slate-500">${backlogs.length} backlogs · ${pms.length} preventivos · ${grs.length} engrases · ${trs.length} neumáticos · ${fleet.length} equipos. Descarga un respaldo completo de vez en cuando.</p></div>
  <div class="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2"><h3 class="font-bold">🕘 Actividad reciente</h3>
    ${act.map(x=>`<p class="text-xs text-slate-400 border-t border-slate-700" style="padding-top:.4rem"><b class="text-slate-200">${esc(x.by||'—')}</b> · ${x.t} <span class="text-amber-400">${esc(x.id)}</span> · ${esc(x.s)}<br>${new Date(x.at).toLocaleString('es-PE',{dateStyle:'short',timeStyle:'short'})}</p>`).join('')||'<p class="text-xs text-slate-500">Aún no hay actividad registrada con usuario.</p>'}</div>`;
}
const normRole=r=>{r=nk(r);return r==='admin'||r==='planner'||r==='administrador'?'admin':(r==='supervisor'||r==='jefe')?'supervisor':(r==='tecnico'||r==='tec')?'tecnico':''};
/* ---------- Contraseñas: PBKDF2-SHA256 + sal aleatoria por usuario + pimienta (config.js) ---------- */
// shortcut: la pimienta está en el front y cualquiera que lea config.js la ve; protege la copia guardada en la base, Firebase Auth sigue siendo quien valida la clave real
const PW_IT=210000,b64=a=>btoa(String.fromCharCode(...new Uint8Array(a))),unb64=x=>Uint8Array.from(atob(x),c=>c.charCodeAt(0));
async function pwDerive(pw,salt,it){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw+(window.PASS_PEPPER||'')),'PBKDF2',false,['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:it},k,256))}
async function hashPw(pw){const salt=crypto.getRandomValues(new Uint8Array(16));return 'pbkdf2$'+PW_IT+'$'+b64(salt)+'$'+b64(await pwDerive(pw,salt,PW_IT))}
const isHash=x=>/^pbkdf2\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/.test(x||'');
const DOM='@coansa.com',DOM_OLD='@coansa-backlogs.app'; // DOM_OLD: usuarios creados antes del cambio siguen entrando
const uname=x=>String(x||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim().replace(/\s+/g,'.').replace(/[^a-z0-9._-]/g,'');
const toAuthEmail=id=>{id=String(id||'').trim().toLowerCase();return id.includes('@')?id:uname(id)+DOM};
const userBase=n=>{const w=String(n).trim().split(/\s+/).filter(Boolean);return uname(w.length>1?w[0]+'.'+w[w.length-1]:w[0])};
const genPw=()=>{const C='bcdfghjkmnpqrstvwz',V='aeiou',r=n=>crypto.getRandomValues(new Uint32Array(1))[0]%n;let x='';for(let i=0;i<4;i++)x+=C[r(C.length)]+V[r(V.length)];return x+String(100+r(900))};
function secAuth(){const sec=firebase.apps.find(a=>a.name==='sec')||firebase.initializeApp(cfg,'sec'),a=sec.auth();a.languageCode='es';return a}
function copyTxt(id,btn){const t=$(id);t.select();let ok=false;try{ok=document.execCommand('copy')}catch(_){}try{if(navigator.clipboard){navigator.clipboard.writeText(t.value);ok=true}}catch(_){}if(btn)btn.textContent=ok?'✔ Copiado':'Selecciona y copia (Ctrl+C)'}
function openUsers(){
  const have=new Set(usersList.map(u=>nk(u.name))),
    tpl=[['Walter Tanta','Supervisor de mantenimiento','supervisor'],['Jaime Ventura','Supervisor de mantenimiento','supervisor'],['Jorge Tanta','Técnico mecánico','tecnico'],['Alex Cruzado','Técnico mecánico','tecnico'],['Hugo Díaz','Técnico electricista','tecnico'],['Luis de la Cruz','Técnico mecánico','tecnico'],['Marco Cruz','Técnico mecánico','tecnico'],['Iván Cruz','Técnico mecánico','tecnico']].filter(x=>!have.has(nk(x[0]))).map(x=>x.join('; ')).join('\n');
  show(`<h3 class="font-bold mb-1">📋 Carga masiva de personal</h3><p class="text-xs text-slate-400 mb-2">Una persona por línea: <b>Nombre; cargo; perfil</b>. Perfil: <b>tecnico</b>, <b>supervisor</b> o <b>admin</b> (si lo omites se deduce del cargo). La app genera el <b>usuario</b> y una <b>contraseña</b>; la firma se agrega después con ✏️ o la registra cada persona al ingresar.</p>
  <textarea maxlength="5000" id="bulk" rows="9" class="inp" style="font-size:13px" spellcheck="false">${esc(tpl)}</textarea><div id="bulk-out" class="text-xs space-y-1 mt-2"></div>
  <div class="flex justify-end gap-2 pt-3 border-t border-slate-700 mt-3"><button type="button" onclick="hide()" class="btn bg-slate-700">Cerrar</button><button id="bulk-go" type="button" onclick="createUsers()" class="btn bg-amber-500 text-slate-950">Crear usuarios</button></div>`,'36rem');
}
async function createAccount({name,position,role,signature},taken,extra){
  const sa=secAuth();
  let un=userBase(name)||'usuario',k=2;const b0=un;while(taken.has(un))un=b0+(k++);taken.add(un);
  const pass=genPw();let c;
  try{
    for(;;){try{c=await sa.createUserWithEmailAndPassword(un+DOM,pass);break}
      catch(e){if(e&&e.code==='auth/email-already-in-use'&&k<60){do{un=b0+(k++)}while(taken.has(un));taken.add(un);continue}throw e}}
    const authEmail=un+DOM;
    await db.collection('users').doc(c.user.uid).set({uid:c.user.uid,name,position:position||'',signature:signature||'',signatureAt:signature?Date.now():0,username:un,authEmail,email:authEmail,pass:await hashPw(pass),role,active:true,createdAt:Date.now(),createdBy:me.name,...(extra||{})});
    await sa.signOut();return{name,role,position,un,pass};
  }catch(e){try{await sa.signOut()}catch(_){}throw e}
}
const credsHtml=made=>{window._creds=made;const txt=made.map(m=>`${m.name} (${m.position||ROLE_S[m.role]}) | Usuario: ${m.un} | Contraseña: ${m.pass}`).join('\n');
  return `<p class="text-slate-200 font-semibold mt-2 text-xs">Accesos generados. Guárdalos ahora: las contraseñas se guardan cifradas y no se podrán volver a ver.</p><textarea id="creds" readonly rows="${Math.min(10,made.length+1)}" class="inp" style="font-size:12px">${esc(txt)}</textarea>
  <div class="grid gap-2 mt-1" style="grid-template-columns:1fr 1fr"><button type="button" onclick="copyTxt('creds',this)" class="btn bg-slate-700">📋 Copiar todo</button><button type="button" onclick="exportCreds()" class="btn bg-slate-700">⬇️ Descargar CSV</button></div>`};
async function createUsers(){
  if(!isAdmin())return;
  const lines=$('bulk').value.split('\n').map(x=>x.trim()).filter(Boolean),out=$('bulk-out'),go=$('bulk-go');
  if(!lines.length)return;go.disabled=true;go.style.opacity='.5';out.innerHTML='';
  const log=(ok,t)=>{out.insertAdjacentHTML('beforeend',`<p class="${ok?'text-emerald-400':'text-red-400'}">${ok?'✔':'✖'} ${esc(t)}</p>`)};
  try{secAuth()}catch(e){log(false,'No se pudo iniciar el registro: '+authMsg(e));go.disabled=false;go.style.opacity='1';return}
  const made=[],taken=new Set(usersList.map(u=>u.username).filter(Boolean)),seen=new Set(usersList.map(u=>nk(u.name)));
  for(const ln of lines){
    let parts=ln.split(/[;\t]/).map(x=>(x||'').trim());
    if(parts.length===1){const w=parts[0].split(/\s+/),r=normRole(w[w.length-1]);if(w.length>1&&r)parts=[w.slice(0,-1).join(' '),w[w.length-1]]} // "Juan Diaz tecnico" sin punto y coma
    const name=parts[0];let position='',role='';
    if(!name)continue;
    if(parts.length>=3){position=parts[1];role=parts[2]?normRole(parts[2]):roleFromPos(position);if(parts[2]&&!role){log(false,name+': perfil no válido (usa tecnico, supervisor o admin)');continue}}
    else if(parts.length===2){role=normRole(parts[1]);if(role)position=POS_DEF[role];else{position=parts[1];role=roleFromPos(position)}}
    else{role='tecnico';position=POS_DEF.tecnico}
    if(!position)position=POS_DEF[role];
    if(seen.has(nk(name))){log(false,name+': ya existe');continue}
    try{const m=await createAccount({name,position,role,signature:''},taken);seen.add(nk(name));made.push(m);log(true,`${name}: creado (${position} · ${ROLE_S[role]})`)}
    catch(e){log(false,name+': '+authMsg(e))}
  }
  if(made.length)out.insertAdjacentHTML('beforeend',credsHtml(made));
  go.disabled=false;go.style.opacity='1';go.textContent='Crear más';
}
function exportCreds(){const m=window._creds||[];fileOut(new Blob([toCsv([['Nombre','Cargo','Perfil','Usuario','Contraseña'],...m.map(x=>[x.name,x.position||'',ROLE_S[x.role],x.un,x.pass])])],{type:'text/csv;charset=utf-8'}),'accesos_'+today()+'.csv','🔐 Accesos listos')}
// las claves viejas en texto plano se convierten a hash la primera vez que el planner abre la app
const pwMigrated=new Set();
function migratePw(){usersList.filter(u=>u.pass&&!isHash(u.pass)&&!pwMigrated.has(u.uid)).forEach(async u=>{pwMigrated.add(u.uid);
  try{await db.collection('users').doc(u.uid).update({pass:await hashPw(u.pass)})}catch(e){console.error(e)}})}
// muestra la clave nueva una sola vez para entregarla al usuario
function pwShown(u,np){
  const wa='https://wa.me/?text='+encodeURIComponent(`Hola ${u.name}, tu acceso a Control de Mantenimiento:\nUsuario: ${u.username}\nContraseña: ${np}`);
  show(`<h3 class="font-bold mb-2">✔ Contraseña actualizada</h3><p class="text-xs text-slate-400 mb-2">Compártela ahora; después ya no se podrá ver.</p>
    <textarea id="pw-new" readonly rows="2" class="inp" style="font-size:13px">${esc('Usuario: '+u.username+'\nContraseña: '+np)}</textarea>
    <div class="grid gap-2 mt-2" style="grid-template-columns:1fr 1fr"><button type="button" onclick="copyTxt('pw-new',this)" class="btn bg-slate-700">📋 Copiar</button><a href="${esc(wa)}" target="_blank" rel="noopener" class="btn bg-emerald-500/20 text-emerald-400 text-center" style="text-decoration:none">📲 WhatsApp</a></div>
    <div class="flex justify-end pt-3 border-t border-slate-700 mt-3"><button type="button" onclick="hide()" class="btn bg-slate-700">Cerrar</button></div>`)
}
/* ---------- Asignar contraseña nueva (el planner no ve ni necesita la actual) ----------
   Firebase no deja cambiar la clave de otra persona desde el navegador: lo hace la Cloud Function
   "resetPassword" (functions/index.js), que comprueba en el servidor que quien llama es admin activo. */
function openReset(id){
  const u=usersList.find(x=>x.uid===id);if(!u||!isAdmin())return;
  show(`<h3 class="font-bold">🔑 Nueva contraseña para ${esc(u.name)}</h3><p class="text-xs text-slate-400 mb-3">${esc(ROLE_L[u.role]||u.role)} · Usuario: <b class="text-slate-200">${esc(u.username)}</b></p>
  <label class="block text-xs text-slate-400 font-semibold">Nueva contraseña<input id="rs-a" type="password" maxlength="128" class="inp mt-1 font-normal" autocomplete="new-password"></label>
  <label class="block text-xs text-slate-400 font-semibold mt-3">Confirmar contraseña<input id="rs-b" type="password" maxlength="128" class="inp mt-1 font-normal" autocomplete="new-password"></label>
  <p id="rs-msg" class="text-xs text-slate-400 mt-2">Mínimo 6 caracteres. Su contraseña anterior deja de funcionar.</p>
  <button type="button" onclick="const g=genPw();$('rs-a').value=$('rs-b').value=g" class="btn bg-slate-700 w-full mt-3">🎲 Generar nueva</button>
  <div class="flex justify-end gap-2 pt-3 border-t border-slate-700 mt-3"><button type="button" onclick="hide()" class="btn bg-slate-700">Cerrar</button><button id="rs-go" type="button" onclick="saveReset('${id}')" class="btn bg-amber-500 text-slate-950">Asignar contraseña</button></div>`);
}
async function saveReset(id){
  const u=usersList.find(x=>x.uid===id);if(!u||!isAdmin())return;const a=$('rs-a').value.trim(),b=$('rs-b').value.trim(),m=$('rs-msg'),go=$('rs-go');
  const err=t=>{go.disabled=false;m.className='text-xs text-red-400 mt-2';m.textContent=t};
  if(a.length<6)return err('La contraseña debe tener al menos 6 caracteres.');
  if(a!==b)return err('Las dos contraseñas no coinciden.');
  go.disabled=true;m.className='text-xs text-slate-400 mt-2';m.textContent='Guardando…';
  try{await firebase.functions().httpsCallable('resetPassword')({uid:id,password:a,pass:await hashPw(a)});pwShown(u,a)}
  catch(e){err(e&&e.code==='functions/permission-denied'?'Solo un planner activo puede hacer esto.':e&&/not-found|internal|unavailable/.test(e.code||'')?'Cambiar contraseñas necesita la Cloud Function, y el proyecto de Firebase debe estar en el plan Blaze. Todavía no está publicada.':(e&&e.message)||'No se pudo cambiar la contraseña.')}
}
function openUser(id){
  if(!isAdmin()||!db)return;const u=id?usersList.find(x=>x.uid===id):null;if(id&&!u)return;const self=!!u&&u.uid===me.uid,r=u?u.role:'tecnico';
  show(`<h3 class="font-bold mb-1">${u?'✏️ Editar personal':'➕ Agregar personal'}</h3><p class="text-xs text-slate-400 mb-3">${u?'Cambia los datos o la firma. La firma guardada se precarga sola en cada cierre o validación de esta persona.':'Registra a cualquier persona del equipo. La app le crea un usuario y una contraseña, y su firma quedará precargada en sus cierres y validaciones.'}</p>
  <form onsubmit="saveUser(event,'${id||''}')" class="space-y-3">
    ${field('name','Nombre completo *',u?u.name:'','required')}
    <label class="block text-xs text-slate-400 font-semibold">Cargo * <span class="font-normal">(elige de la lista o escribe uno nuevo)</span><input class="inp mt-1 font-normal" name="position" list="cargos" required placeholder="Ej. Técnico electricista" value="${esc(u?u.position||'':'')}" ${u?'':'oninput="posRole(this)"'}><datalist id="cargos">${CARGOS.map(x=>`<option value="${esc(x)}">`).join('')}</datalist></label>
    <label class="block text-xs text-slate-400 font-semibold">Perfil de acceso *<select class="inp mt-1 font-normal" name="role" ${self?'disabled':''} onchange="this.dataset.t=1;$('perfil-d').textContent=PERFIL_D[this.value]">${Object.keys(ROLE_L).map(k=>`<option value="${k}" ${k===r?'selected':''}>${ROLE_L[k]}</option>`).join('')}</select></label>
    <p id="perfil-d" class="text-[11px] text-slate-500">${PERFIL_D[r]}</p>${self?'<p class="text-[11px] text-slate-500">No puedes cambiar tu propio perfil.</p>':''}
    ${u?`<label class="block text-xs text-slate-400 font-semibold">Usuario<input class="inp mt-1 font-normal" value="${esc(u.username||u.email)}" disabled></label>`:''}
    ${sigBox('Firma','opt')}
    <p class="text-[11px] text-slate-500">La firma es opcional aquí: también la puede registrar la propia persona tocando su nombre (arriba a la derecha) al ingresar.</p>
    <p id="us-err" class="text-xs text-red-400 hidden"></p>${btns('hide()',u?'Guardar':'Crear persona')}</form>`,'36rem');
  sigInit(u?u.signature||'':'');
}
function posRole(inp){const s=inp.form.role;if(!s||s.disabled||s.dataset.t||!inp.value.trim())return;s.value=roleFromPos(inp.value);$('perfil-d').textContent=PERFIL_D[s.value]}
async function saveUser(ev,id){
  ev.preventDefault();if(!isAdmin())return;const F=ev.target,f=Object.fromEntries(new FormData(F)),er=$('us-err'),bad=m=>{er.textContent=m;er.classList.remove('hidden');er.scrollIntoView({block:'center'})};
  const name=(f.name||'').trim(),position=(f.position||'').trim(),signature=sig.drawn?sigData():'',go=F.querySelector('button:not([type=button])');
  if(!name||!position){bad('Completa el nombre y el cargo.');return}
  if(usersList.some(u=>u.uid!==id&&nk(u.name)===nk(name))){bad('Ya existe una persona con ese nombre.');return}
  go.disabled=true;go.style.opacity='.5';
  if(id){
    const u=usersList.find(x=>x.uid===id);if(!u)return;const upd={name,position};if(f.role&&id!==me.uid)upd.role=f.role;
    if(signature!==(u.signature||'')){upd.signature=signature;upd.signatureAt=signature?Date.now():0}
    try{await db.collection('users').doc(id).update(upd);hide();toast('✔ Datos de '+name+' guardados')}catch(e){go.disabled=false;go.style.opacity='1';bad('No se pudo guardar: '+authMsg(e))}
    return;
  }
  go.textContent='Creando…';
  try{const m=await createAccount({name,position,role:f.role||roleFromPos(position),signature},new Set(usersList.map(u=>u.username).filter(Boolean)));
    show(`<h3 class="font-bold text-emerald-400 mb-1">✔ ${esc(m.name)} registrado(a)</h3><p class="text-xs text-slate-400">${esc(m.position)} · ${esc(ROLE_L[m.role])} · ${signature?'firma guardada ✍️':'<span class="text-amber-400">sin firma (la puede registrar al ingresar)</span>'}</p>${credsHtml([m])}
    <div class="flex justify-end gap-2 pt-3 border-t border-slate-700 mt-3"><button type="button" onclick="hide()" class="btn bg-slate-700">Cerrar</button><button type="button" onclick="openUser()" class="btn bg-amber-500 text-slate-950">+ Agregar otra persona</button></div>`,'36rem');
  }catch(e){go.disabled=false;go.style.opacity='1';go.textContent='Crear persona';bad(name+': '+authMsg(e))}
}
/* ---------- Solicitudes de acceso (autorregistro) ---------- */
function openApprove(id){
  const u=usersList.find(x=>x.uid===id);if(!u||!isAdmin())return;const others=usersList.filter(x=>!x.pending&&x.uid!==me.uid).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  const same=others.find(x=>nk(x.name)===nk(u.name)),r=roleFromPos(u.position);
  show(`<h3 class="font-bold mb-1">✅ Aprobar a ${esc(u.name)}</h3><p class="text-xs text-slate-400 mb-3">Usuario: <b class="text-slate-200">${esc(u.username)}</b> (con la contraseña que la persona eligió)</p>
  <form onsubmit="saveApprove(event,'${id}')" class="space-y-3">
    <label class="block text-xs text-slate-400 font-semibold">Cargo *<input class="inp mt-1 font-normal" name="position" list="cargos-a" required value="${esc(u.position||'')}"><datalist id="cargos-a">${CARGOS.map(x=>`<option value="${esc(x)}">`).join('')}</datalist></label>
    <label class="block text-xs text-slate-400 font-semibold">Perfil de acceso *<select class="inp mt-1 font-normal" name="role" onchange="$('perfil-d').textContent=PERFIL_D[this.value]">${Object.keys(ROLE_L).map(k=>`<option value="${k}" ${k===(same?same.role:r)?'selected':''}>${ROLE_L[k]}</option>`).join('')}</select></label>
    <p id="perfil-d" class="text-[11px] text-slate-500">${PERFIL_D[same?same.role:r]}</p>
    <label class="block text-xs text-slate-400 font-semibold">¿Reemplaza a un usuario anterior? <span class="font-normal">(si olvidó su contraseña)</span><select class="inp mt-1 font-normal" name="replace"><option value="">No, es una persona nueva</option>${others.map(x=>`<option value="${x.uid}" ${same&&same.uid===x.uid?'selected':''}>${esc(x.name)} · ${esc(x.position||ROLE_S[x.role]||'')}</option>`).join('')}</select></label>
    <p class="text-[11px] text-slate-500">Si eliges a alguien, se copia su firma (si la nueva cuenta no trae una) y se borra el usuario anterior.</p>
    <p id="ap-err" class="text-xs text-red-400 hidden"></p>${btns('hide()','Aprobar acceso','bg-emerald-500')}</form>`,'34rem');
}
async function saveApprove(ev,id){
  ev.preventDefault();const f=Object.fromEntries(new FormData(ev.target)),u=usersList.find(x=>x.uid===id),old=f.replace?usersList.find(x=>x.uid===f.replace):null,er=$('ap-err');if(!u||!isAdmin())return;
  const upd={active:true,pending:false,role:f.role,position:(f.position||'').trim(),approvedBy:me.name,approvedAt:Date.now()};
  if(old&&!u.signature&&old.signature){upd.signature=old.signature;upd.signatureAt=old.signatureAt||Date.now()}
  if(old)upd.replacedUid=old.uid;
  try{await db.collection('users').doc(id).update(upd);if(old)await db.collection('users').doc(old.uid).delete();hide();toast('✔ '+u.name+' ya puede ingresar con el usuario '+u.username)}
  catch(e){er.textContent='No se pudo aprobar: '+authMsg(e);er.classList.remove('hidden')}
}
function rejectReq(id){const u=usersList.find(x=>x.uid===id);if(!u||!isAdmin())return;
  ask(`¿Rechazar la solicitud de ${u.name}? No podrá ingresar.`,()=>db.collection('users').doc(id).delete().catch(e=>note('No se pudo rechazar: '+authMsg(e))),'Rechazar')}

/* ---------- Renovar accesos: usuario y contraseña nuevos conservando el perfil ----------
   Sin Cloud Function no se puede cambiar la clave de otra cuenta, así que se crea una cuenta nueva,
   se le copia el perfil (nombre, cargo, perfil, firma) y se borra el perfil anterior: el acceso viejo deja de funcionar. */
async function renewOne(u,taken){
  const m=await createAccount({name:u.name,position:u.position||'',role:u.role,signature:u.signature||''},taken,{signatureAt:u.signatureAt||(u.signature?Date.now():0),active:u.active!==false,renewedFrom:u.uid,renewedAt:Date.now()});
  await db.collection('users').doc(u.uid).delete();
  return m;
}
function renewUser(id){
  const u=usersList.find(x=>x.uid===id);if(!u||!isAdmin()||id===me.uid)return;
  ask(`¿Renovar el acceso de ${u.name}? Se le crea un usuario y una contraseña nuevos (conserva cargo, perfil y firma). Su acceso actual dejará de funcionar.`,async()=>{
    show('<p class="text-sm text-slate-300">Renovando acceso…</p>');
    try{const m=await renewOne(u,new Set(usersList.map(x=>x.username).filter(Boolean)));
      show(`<h3 class="font-bold text-emerald-400 mb-1">✔ Acceso renovado</h3><p class="text-xs text-slate-400">${esc(m.name)} · ${esc(m.position||ROLE_S[m.role])}</p>${credsHtml([m])}<div class="flex justify-end pt-3 border-t border-slate-700 mt-3"><button type="button" onclick="hide()" class="btn bg-slate-700">Cerrar</button></div>`,'34rem')}
    catch(e){note('No se pudo renovar el acceso de '+u.name+': '+authMsg(e))}
  },'🔄 Renovar','bg-amber-500 text-slate-950');
}
function renewAll(){
  if(!isAdmin())return;const list=usersList.filter(u=>!u.pending&&u.uid!==me.uid);
  if(!list.length){note('No hay más personal registrado.');return}
  ask(`Se crearán usuarios y contraseñas NUEVOS para ${list.length} persona(s) (todas menos tú). Conservan nombre, cargo, perfil y firma, pero sus accesos actuales dejarán de funcionar. Al final podrás copiar o descargar los accesos nuevos. ¿Continuar?`,async()=>{
    show(`<h3 class="font-bold mb-2">🔄 Renovando accesos…</h3><p class="text-xs text-amber-400 mb-2">No cierres esta ventana hasta que termine.</p><div id="rn-out" class="text-xs space-y-1"></div><div id="rn-end"></div>`,'36rem');
    const out=$('rn-out'),log=(ok,t)=>out.insertAdjacentHTML('beforeend',`<p class="${ok?'text-emerald-400':'text-red-400'}">${ok?'✔':'✖'} ${esc(t)}</p>`),made=[],taken=new Set(usersList.map(x=>x.username).filter(Boolean));
    for(const u of list){try{const m=await renewOne(u,taken);made.push(m);log(true,`${u.name}: usuario ${m.un}`)}catch(e){log(false,u.name+': '+authMsg(e))}}
    $('rn-end').innerHTML=(made.length?credsHtml(made):'')+'<div class="flex justify-end pt-3 border-t border-slate-700 mt-3"><button type="button" onclick="hide()" class="btn bg-slate-700">Cerrar</button></div>';
  },'🔄 Renovar todos','bg-amber-500 text-slate-950');
}

/* ---------- Mi perfil: cada persona registra o actualiza su propia firma ---------- */
function openMe(){
  if(!me||me.uid==='local'||!db){note('Disponible al conectar Firebase.');return}
  show(`<div class="flex justify-between items-start"><div><h3 class="font-bold">👤 Mi perfil</h3><p class="text-xs text-slate-400">${esc(me.name)} · ${esc(me.position||'Sin cargo')}<br>${esc(ROLE_L[me.role]||me.role)}</p></div><button type="button" onclick="hide()" class="text-slate-400 text-xl">✕</button></div>
  <p class="text-xs text-slate-400 my-3">Tu firma se precarga automáticamente al cerrar o validar trabajos y aparece en las órdenes de trabajo PDF con tu nombre y cargo.</p>
  ${sigBox('Mi firma')}<p id="me-err" class="text-xs text-red-400 hidden mt-2"></p>
  <div class="flex justify-between gap-2 pt-3 border-t border-slate-700 mt-3 flex-wrap"><button type="button" onclick="logout()" class="btn bg-slate-800 border border-slate-600">Cerrar sesión</button><div class="flex gap-2"><button type="button" onclick="hide()" class="btn bg-slate-700">Cancelar</button><button type="button" onclick="saveMe()" class="btn bg-amber-500 text-slate-950">Guardar firma</button></div></div>`);
  sigInit(mySig());
}
async function saveMe(){
  const er=$('me-err'),err=m=>{er.textContent=m;er.classList.remove('hidden')};
  if(!sig.drawn){err('Firma dentro del recuadro blanco (o sube una foto) antes de guardar.');return}
  const s=sigData();if(s===me.signature){hide();return}
  try{await db.collection('users').doc(me.uid).update({signature:s,signatureAt:Date.now()});me.signature=s;applyRole();hide();toast('✔ Firma guardada')}
  catch(e){err(e&&e.code==='permission-denied'?'Firebase no permite que guardes tu propia firma todavía. Pídele al planner que la registre (Admin → ✏️) o que actualice las reglas.':'No se pudo guardar: '+authMsg(e))}
}
/* ---------- Eliminar personal ----------
   Con la Cloud Function "deleteUser" se borra también su cuenta de Firebase Auth. Sin ella (plan Spark) se borra su perfil:
   la cuenta queda sin perfil y la app ya no la deja entrar. Los trabajos, firmas e historial que registró se conservan. */
function delUser(id){
  const u=usersList.find(x=>x.uid===id);if(!u||!isAdmin()||id===me.uid)return;
  if(u.role==='admin'&&usersList.filter(x=>x.role==='admin'&&x.active!==false&&!x.pending).length<=1&&u.active!==false){note('No puedes eliminar al único planner activo.');return}
  show(`<h3 class="font-bold text-red-400">🗑️ Eliminar a ${esc(u.name)}</h3><p class="text-xs text-slate-400 mb-3">${esc(u.position||ROLE_S[u.role]||'')} · Usuario: <b class="text-slate-200">${esc(u.username||u.email)}</b></p>
  <div class="bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-sm space-y-1"><p>• Ya no podrá ingresar a la app (si tiene la sesión abierta, se cierra).</p><p>• Se borran su perfil, su usuario y su firma registrada.</p><p>• <b>Se conservan</b> los backlogs, cierres, firmas en las OT e historial que registró.</p></div>
  <p class="text-xs text-slate-400 mt-3">Si solo quieres bloquearlo por un tiempo, usa <b>Desactivar</b>.</p>
  <label class="block text-xs text-slate-400 font-semibold mt-3">Para confirmar escribe <b class="text-red-400">ELIMINAR</b><input id="du-ok" class="inp mt-1 font-normal" autocomplete="off" autocapitalize="characters" oninput="$('du-go').disabled=this.value.trim().toUpperCase()!=='ELIMINAR';$('du-go').style.opacity=$('du-go').disabled?'.5':'1'"></label>
  <p id="du-msg" class="text-xs text-red-400 hidden mt-2"></p>
  <div class="flex justify-end gap-2 pt-3 border-t border-slate-700 mt-3"><button type="button" onclick="hide()" class="btn bg-slate-700">Cancelar</button><button id="du-go" type="button" disabled style="opacity:.5" onclick="doDelUser('${id}')" class="btn bg-red-500 text-white">Eliminar definitivamente</button></div>`,'30rem');
}
async function doDelUser(id){
  const u=usersList.find(x=>x.uid===id);if(!u||!isAdmin()||id===me.uid)return;const go=$('du-go'),m=$('du-msg');go.disabled=true;go.textContent='Eliminando…';
  let full=false;
  try{if(firebase.functions){await firebase.functions().httpsCallable('deleteUser')({uid:id});full=true}}
  catch(e){if(e&&e.code==='functions/permission-denied'){m.textContent='Solo un planner activo puede eliminar personal.';m.classList.remove('hidden');go.textContent='Eliminar definitivamente';return}}
  try{if(!full)await db.collection('users').doc(id).delete();hide();toast('🗑️ '+u.name+' fue eliminado'+(full?'':' (ya no puede ingresar)'))}
  catch(e){m.textContent='No se pudo eliminar: '+authMsg(e);m.classList.remove('hidden');go.disabled=false;go.textContent='Eliminar definitivamente'}
}
function toggleUser(id){const u=usersList.find(x=>x.uid===id);if(!u||id===me.uid)return;
  db.collection('users').doc(id).update({active:u.active===false}).catch(e=>note('No se pudo guardar: '+authMsg(e)))}
function resendPw(id){const u=usersList.find(x=>x.uid===id);if(!u)return;
  auth.sendPasswordResetEmail(u.email).then(()=>note('Enviamos a '+u.email+' un correo para crear o cambiar su contraseña.')).catch(e=>note(authMsg(e)))}

/* ---------- Inicio ---------- */
if(db&&auth)initAuth();else{me={uid:'local',name:'Modo local',role:'admin'};startApp()}

/* ---------- Service worker ---------- */
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
/* ---------- Alto del encabezado (variable --hh) ---------- */
(()=>{const h=document.querySelector('header'),f=()=>document.documentElement.style.setProperty('--hh',h.offsetHeight+'px');addEventListener('resize',f);addEventListener('load',f);new ResizeObserver(f).observe(h)})();
