/* =====================================================================
   FORMATOS: Backlog (F-MT-21), Orden de trabajo (F-MT-24) y
   Reporte de mantenimiento (F-MT-25), con sus PDF en la misma estructura
   (sin cajetín). Flujo: Backlog → (opcional) OT asignada a un técnico →
   el técnico cierra la OT con el Reporte de mantenimiento → validación.
   También: directorio de personal, "Mis OT" y tema de fondo blanco.
   Se carga ANTES de app.js: aquí solo hay declaraciones.
   ===================================================================== */

/* ---------- Catálogos de los formatos ---------- */
const FX_MOT=[['PM1','MP1'],['PM2','MP2'],['PM3','MP3'],['PM4','MP4'],['ENGRASE','LUBRICACIÓN'],['INSPECCION','INSPECCIÓN'],['BACKLOG','BACKLOG'],['MCI','CORRECTIVO INMEDIATO (MCI)'],['MCP','CORRECTIVO PROG. (MCP)'],['PREDICTIVO','PREDICTIVO'],['MEJORATIVO','MEJORATIVO'],['CAMPANA','CAMPAÑA'],['OTROS','OTRO']];
const FX_MOT_L=k=>((FX_MOT.find(m=>m[0]===k)||[])[1])||k||'';
const FX_SIS_OT=['MOTOR','TRANSMISIÓN','DIFERENCIAL','MANDOS FINALES','HIDRÁULICO','DIRECCIÓN','FRENOS','SUSPENSIÓN','ELÉCTRICO','ELECTRÓNICO','GETS','REFRIGERACIÓN','TREN DE RODAJE','IMPLEMENTOS','NEUMÁTICOS / LLANTAS','BASTIDOR / CHASIS','CABINA','A/C','ENGRASE / LUBRICACIÓN','SEGURIDAD (alarmas, extintor)'];
const FX_SIS_RP=FX_SIS_OT.map(x=>x==='GETS'?'NEUMÁTICO':x);
const FX_BK2SIS={'Motor':'MOTOR','Sistema de enfriamiento':'REFRIGERACIÓN','Sistema de combustible':'MOTOR','Admisión y escape':'MOTOR','Sistema de lubricación':'ENGRASE / LUBRICACIÓN','Tren de fuerza / Transmisión':'TRANSMISIÓN','Diferenciales y mandos finales':'DIFERENCIAL','Sistema hidráulico':'HIDRÁULICO','Sistema de frenos':'FRENOS','Sistema de dirección':'DIRECCIÓN','Suspensión':'SUSPENSIÓN','Tren de rodaje / Orugas':'TREN DE RODAJE','Neumáticos y aros':'NEUMÁTICOS / LLANTAS','Sistema eléctrico':'ELÉCTRICO','Sistema de arranque y carga':'ELÉCTRICO','Aire acondicionado':'A/C','Cabina y ergonomía':'CABINA','Estructura / Chasis / Bastidor':'BASTIDOR / CHASIS','Implementos (tolva, cucharón, hoja)':'IMPLEMENTOS','Sistema de seguridad (alarmas, luces, extintores)':'SEGURIDAD (alarmas, extintor)','Sistema contra incendio (AFEX)':'SEGURIDAD (alarmas, extintor)','GPS / Telemetría':'ELECTRÓNICO','Carrocería':'BASTIDOR / CHASIS'};
const FX_SIS2BK=Object.fromEntries(Object.entries(FX_BK2SIS).reverse().map(([a,b])=>[b,a]));
const OT_PERS=['MECÁNICO','ELECTRICISTA','SOLDADOR','LUBRICADOR'];
const OT_APO=['GRÚA / MONTACARGA','CAMABAJA','COMPRESORA','TORQUÍMETRO','EQ. DIAGNÓSTICO (laptop)','KIT MUESTRA DE ACEITE','GATAS / CABALLETES','LAVADORA A PRESIÓN'];
const FX_EQST=['OPERATIVO','OPERATIVO CON RESTRICCIÓN','INOPERATIVO'];
const OT_TEST=['PENDIENTE','EN PROCESO','EJECUTADO','NO EJECUTADO'];
const FX_TURNO=['DÍA','NOCHE'];
const RP_CAUSA=['DESGASTE NATURAL','MALA OPERACIÓN','FALTA DE MANTTO.','FATIGA / ROTURA','CONTAMINACIÓN','CALIDAD REPUESTO','MALA INSTALACIÓN','OTRO'];
const RP_PAR=['PROVEEDOR','MANTENIMIENTO','OPERADOR','PRODUCCIÓN','OTRO'];
const RP_DEM=['CAMABAJA','LOGÍSTICA','MANTENIMIENTO','PROVEEDOR','OTRO'],RP_DEM_L={'LOGÍSTICA':'LOGÍSTICA / REP.','MANTENIMIENTO':'MANTTO.'};
const RP_PRU=['PRUEBA DE FUNCIONAMIENTO OK','NIVELES DE FLUIDOS VERIFICADOS','SIN FUGAS','TORQUES VERIFICADOS','SIN CÓDIGOS DE FALLA ACTIVOS','BLOQUEO (LOTO) RETIRADO','ÁREA LIMPIA / RESIDUOS SEGREGADOS','GUARDAS Y TAPAS INSTALADAS','REGISTRO DE HORÓMETRO ACTUALIZADO'];
const FX_ET=['ANTES','DURANTE','DESPUÉS'];

/* ---------- Controles de formulario reutilizables ---------- */
// Opciones tipo "marcar con X": radio (una) o checkbox (varias)
function fxOpts(name,opts,sel,type){
  const on=v=>Array.isArray(sel)?sel.includes(v):sel===v;
  return `<div class="fxo">${opts.map(o=>{const [v,l]=Array.isArray(o)?o:[o,o];return `<label class="fxc"><input type="${type||'radio'}" name="${name}" value="${esc(v)}" ${on(v)?'checked':''}><span>${esc(l)}</span></label>`}).join('')}</div>`;
}
const fxVals=(F,name)=>[...F.querySelectorAll(`input[name="${name}"]:checked`)].map(x=>x.value);
// Filas dinámicas (tareas, repuestos, pendientes…)
let RW={};
function rwInit(key,arr,cols,min){RW[key]={a:(arr||[]).map(x=>({...x})),cols,min:min||1};while(RW[key].a.length<RW[key].min)RW[key].a.push({});rwRender(key)}
function rwRender(key){
  const R=RW[key],el=$('rw-'+key);if(!R||!el)return;
  el.innerHTML=`<div class="rwh"><span class="rwn">#</span>${R.cols.map(c=>`<span style="flex:${c.f||1}">${esc(c.ph)}</span>`).join('')}<span style="width:44px"></span></div>`+R.a.map((r,i)=>`<div class="rwr"><span class="rwn">${i+1}</span>${R.cols.map(c=>c.opts
    ?`<select class="inp" style="flex:${c.f||1}" aria-label="${esc(c.ph)}" onchange="RW['${key}'].a[${i}]['${c.k}']=this.value"><option value="">${esc(c.ph)}</option>${c.opts.map(o=>`<option ${o===r[c.k]?'selected':''}>${esc(o)}</option>`).join('')}</select>`
    :`<input class="inp" style="flex:${c.f||1}" aria-label="${esc(c.ph)}" placeholder="${esc(c.ph)}" value="${esc(r[c.k]??'')}" maxlength="${c.t?20:1000}" ${c.t?'type="number" step="any" min="0" inputmode="decimal"':''} ${c.list?'list="'+c.list+'"':''} oninput="RW['${key}'].a[${i}]['${c.k}']=this.value">`).join('')}<button type="button" class="btn bg-red-500/20 !py-1" title="Quitar fila" onclick="RW['${key}'].a.splice(${i},1);rwRender('${key}')">✕</button></div>`).join('')
    +`<button type="button" class="btn bg-slate-700 !py-1 mt-1" onclick="RW['${key}'].a.push({});rwRender('${key}')">＋ Agregar fila</button>`;
}
const rwGet=key=>!RW[key]?[]:RW[key].a.map(r=>{const o={};RW[key].cols.forEach(c=>o[c.k]=String(r[c.k]??'').trim());return o}).filter(o=>Object.values(o).some(Boolean));
// Fotos con la condición "¿adjuntar fotos?" y, si aplica, etapa (ANTES / DURANTE / DESPUÉS) y descripción
let PHX={};
function phxBox(key,label,arr,on,noLbl){
  PHX[key]={a:(arr||[]).map(p=>typeof p==='string'?{src:p,et:'ANTES',d:''}:{...p}),noLbl:!!noLbl};
  return `<div class="fsec"><label class="flex items-center gap-2 font-semibold" style="cursor:pointer"><input type="checkbox" id="phx-on-${key}" ${on?'checked':''} onchange="$('phx-b-${key}').style.display=this.checked?'':'none'" style="width:22px;height:22px;accent-color:#f59e0b"> 📷 ${label}</label>
  <p class="text-[11px] text-slate-400 mt-1">Marca la casilla solo si quieres adjuntar fotos. Sin marcar, el documento sale sin panel fotográfico.</p>
  <div id="phx-b-${key}" style="display:${on?'':'none'}" class="mt-2 space-y-2"><input type="file" accept="image/*" multiple onchange="phxAdd(this,'${key}')"><div id="phx-${key}" class="phxg"></div></div></div>`;
}
function phxRender(key){
  const P=PHX[key],el=$('phx-'+key);if(!P||!el)return;
  el.innerHTML=P.a.map((p,i)=>`<div class="phxc"><div class="relative"><img src="${esc(p.src)}" alt="Foto ${i+1}"><button type="button" onclick="PHX['${key}'].a.splice(${i},1);phxRender('${key}')" class="absolute -top-1 -right-1 bg-red-600 rounded-full w-5 h-5 text-xs" aria-label="Quitar foto">×</button></div>
    <p class="text-[11px] font-bold text-slate-400 mt-1">FOTO ${i+1}</p>${P.noLbl?'':`<select class="inp" onchange="PHX['${key}'].a[${i}].et=this.value">${FX_ET.map(x=>`<option ${x===p.et?'selected':''}>${x}</option>`).join('')}</select><input class="inp mt-1" placeholder="Qué se observa" maxlength="200" value="${esc(p.d||'')}" oninput="PHX['${key}'].a[${i}].d=this.value">`}</div>`).join('')||'<p class="text-xs text-slate-500">Sin fotos todavía.</p>';
}
async function phxAdd(inp,key){
  const P=PHX[key];if(!P)return;
  for(const f of inp.files){if(P.a.length>=6){note('Máximo 6 fotos por documento.');break}if(!/^image\//.test(f.type)||f.size>20e6){note(f.name+': no es una imagen válida o pesa más de 20 MB');continue}const d=await compress(f);if(d)P.a.push({src:d,et:'ANTES',d:''})}
  inp.value='';phxRender(key);
}
const phxOn=key=>!!($('phx-on-'+key)||{}).checked;
const phxGet=key=>((PHX[key]||{}).a||[]).filter(p=>p&&p.src).map(p=>({src:p.src,et:p.et||'ANTES',d:String(p.d||'').trim()}));
// Firestore acepta hasta 1 MB por documento: se avisa antes de intentar guardar
const docBig=o=>{try{return JSON.stringify(o).length>950000}catch(_){return false}};
const fxDT=s=>s?fmtD(String(s).slice(0,10))+(String(s).length>10?' '+String(s).slice(11,16):''):'';
const stById=id=>id?sps.find(s=>s.id===id):null;

/* ---------- Directorio del personal (para asignar OT) ---------- */
// El planner publica una copia sin datos sensibles (nombre, cargo, perfil) en staff/{uid}; así los supervisores también pueden asignar.
let staffList=[],staffOk=false;
function staffListen(){
  if(!db||!me||me.uid==='local')return;
  unsubs.push(db.collection('staff').onSnapshot(s=>{staffList=s.docs.map(d=>d.data()).filter(x=>x&&x.uid);staffOk=true},e=>{staffOk=false;console.warn('Directorio del personal no disponible:',e&&e.code)}));
}
function staffSync(){
  if(!db||!isAdmin()||!usersList.length)return;
  const want=usersList.filter(u=>!u.pending&&u.uid).map(u=>({id:u.uid,uid:u.uid,name:u.name||'',position:u.position||'',role:u.role||'tecnico',active:u.active!==false,sig:u.signature||''}));
  const same=(a,b)=>a&&b&&a.name===b.name&&a.position===b.position&&a.role===b.role&&a.active===b.active&&(a.sig||'')===(b.sig||'');
  want.filter(w=>!same(w,staffList.find(x=>x.uid===w.uid))).forEach(w=>db.collection('staff').doc(w.uid).set(w).catch(()=>{}));
  staffList.filter(x=>!want.some(w=>w.uid===x.uid)).forEach(x=>db.collection('staff').doc(x.uid).delete().catch(()=>{}));
}
// Firma precargada por nombre: busca a la persona en el personal registrado (exacto o por palabras del nombre)
function sigOfName(name){
  const k=nk(name);if(!k)return null;
  const L=(isAdmin()&&usersList.length?usersList.filter(u=>!u.pending).map(u=>({name:u.name,sig:u.signature||''})):staffList.map(u=>({name:u.name,sig:u.sig||''})));
  if(me&&me.uid!=='local')L.push({name:me.name,sig:mySig()});
  const P=L.filter(u=>u.name&&u.sig);let hit=P.find(u=>nk(u.name)===k);
  if(!hit){const t=stNorm(name).split(' ').filter(x=>x.length>1);if(t.length>=2){const m=P.filter(u=>{const w=stNorm(u.name).split(' ');return t.every(x=>w.includes(x))});if(m.length===1)hit=m[0]}}
  return hit||null;
}
function techList(){
  const L=(isAdmin()&&usersList.length?usersList.filter(u=>!u.pending).map(u=>({uid:u.uid,name:u.name,position:u.position,role:u.role,active:u.active!==false})):staffList).filter(u=>u.active&&u.name);
  if(me&&me.uid!=='local'&&!L.some(u=>u.uid===me.uid))L.push({uid:me.uid,name:me.name,position:me.position,role:me.role,active:true});
  const o={tecnico:0,supervisor:1,admin:2};return L.sort((a,b)=>(o[a.role]??3)-(o[b.role]??3)||String(a.name).localeCompare(String(b.name)));
}

/* ---------- OT asignadas ("Mis OT") ---------- */
const otTech=o=>o?(o.techName||o.resp||''):'';
const myOt=b=>!!(b&&b.ot&&b.ot.num&&me&&(b.ot.techUid?b.ot.techUid===me.uid:(!!otTech(b.ot)&&nk(otTech(b.ot))===nk(me.name))));
const otCanClose=b=>!!b&&(isSup()||!b.ot||myOt(b)||(!b.ot.techUid&&!otTech(b.ot)));
const misOts=()=>backlogs.filter(myOt);
const misOpen=()=>misOts().filter(bkOpen);
function otNotify(){
  if(!me||me.uid==='local'||!loadedCols.has('backlogs'))return;
  const k='otSeen_'+me.uid,ids=misOpen().map(b=>b.ot.num);let seen=null;
  try{seen=JSON.parse(localStorage.getItem(k)||'null')}catch(_){}
  if(Array.isArray(seen)){const nw=ids.filter(n=>!seen.includes(n));if(nw.length)toast(nw.length===1?'📋 Te asignaron la '+nw[0]+'. Revísala en "Mis OT".':'📋 Tienes '+nw.length+' OT nuevas asignadas. Revisa "Mis OT".')}
  try{localStorage.setItem(k,JSON.stringify(ids))}catch(_){}
}
function misCard(){
  const L=misOpen();if(!L.length)return '';
  return `<div class="dcard" style="border-color:rgba(245,158,11,.55)"><div class="flex justify-between items-center gap-2"><div><p class="font-semibold">📋 Mis órdenes de trabajo (${L.length})</p><p class="text-xs text-slate-400">OT asignadas a ti. Ciérralas con el reporte de mantenimiento.</p></div><button onclick="bkGo('mis')" class="btn bg-slate-700 !py-1">Ver todas</button></div>
  ${L.slice(0,5).map(b=>{const e=eqOf(b.fleetId);return `<div class="flex justify-between items-center gap-2 text-sm border-t border-slate-700 mt-2" style="padding-top:.6rem"><div class="min-w-0"><b class="mono">${esc(b.ot.num)}</b> · <b class="text-amber-400">${esc(e.code)}</b> <span class="text-slate-300">${esc(b.component)}</span><p class="text-xs text-slate-400">${bkPrBadge(b.criticality)} Emitida ${fmtD(b.ot.date)}${b.ot.fp?' · parada '+esc(fxDT(b.ot.fp)):''}</p></div><div class="flex gap-1" style="flex-shrink:0"><button onclick="makePdfOt('${b.id}')" class="btn bg-slate-700 !py-1" title="OT en PDF">📄</button><button onclick="openClose('${b.id}')" class="btn bg-emerald-500/20 text-emerald-400 !py-1">📝 Reporte</button></div></div>`}).join('')}</div>`;
}
function misView(){
  const all=misOts().sort((a,b)=>bkOpen(b)-bkOpen(a)||String(b.ot.num).localeCompare(String(a.ot.num))),op=all.filter(bkOpen);
  return `<div class="pghead"><div class="flex items-center gap-3"><span class="pgic">📋</span><div><h2 class="text-xl font-bold">Mis órdenes de trabajo</h2><p class="text-xs text-slate-400">${op.length} abiertas · ${all.length-op.length} cerradas · asignadas a ${esc(me?me.name:'')}</p></div></div></div>
  ${all.length?`<div class="grid gap-3 md:grid-cols-2">${all.slice(0,60).map(b=>{const e=eqOf(b.fleetId),o=b.ot,rp=stById(b.repId);return `<div class="bkcard" style="border-left:4px solid ${bkOpen(b)?'#f59e0b':'#10b981'}" onclick="if(!event.target.closest('button'))bkDetail('${b.id}')">
    <div class="flex justify-between items-start gap-2"><div class="min-w-0"><span class="mono text-xs text-slate-400">${esc(o.num)} · ${esc(bkNo(b))}</span><p class="font-bold"><span class="text-amber-400">${esc(e.code)}</span> <span class="text-xs text-slate-400">${esc(e.category||'')}</span></p></div>${bkPrBadge(b.criticality)}</div>
    <p class="font-semibold mt-1">${esc(b.component)}</p><p class="text-xs text-slate-400 clamp2">${esc(o.sint||b.description)}</p>
    <p class="text-xs text-slate-400 mt-1">Emitida ${fmtD(o.date)} por ${esc(o.by||'—')}${o.fp?' · parada '+esc(fxDT(o.fp)):''}</p>
    <div class="flex gap-1 flex-wrap items-center mt-2">${bkStBadge(b.status)}${rp?` <span class="chipm">${esc(rp.num||'Reporte')}</span>`:''}</div>
    <div class="cact flex gap-1 justify-end mt-3 flex-wrap"><button onclick="makePdfOt('${b.id}')" class="btn bg-slate-700 !py-1">📄 OT</button>${rp?`<button onclick="makePdfRpt('${rp.id}')" class="btn bg-slate-700 !py-1">📄 Reporte</button>`:''}${bkOpen(b)?`<button onclick="openClose('${b.id}')" class="btn bg-emerald-500/20 text-emerald-400 !py-1">📝 Cerrar con reporte</button>`:''}</div></div>`}).join('')}</div>`
  :'<p class="text-sm text-slate-500">No tienes órdenes de trabajo asignadas. Cuando el planner o el supervisor te asigne una OT, aparecerá aquí.</p>'}`;
}

/* ---------- Tarjetas del detalle del backlog ---------- */
const bkAfter=b=>{const r=stById(b&&b.repId);return r&&(r.photos||[]).length?r.photos:(b&&b.photosAfter)||[]};
function otCard(b){
  const o=b.ot&&b.ot.num?b.ot:null,open=bkOpen(b),info=(l,x)=>`<div><p class="ilab">${l}</p><p>${x}</p></div>`;
  return `<div class="dcard"><div class="flex justify-between items-start gap-2 flex-wrap"><div><p class="ilab">Orden de trabajo (F-MT-24)</p>${o?`<p class="text-lg font-bold mono">${esc(o.num)} <span class="text-sm font-normal text-slate-400">emitida el ${fmtD(o.date)}</span></p>`:`<p class="text-sm text-slate-400">${open?'Aún no tiene OT. El planner o el supervisor deciden si se apertura.':'Se cerró sin OT.'}</p>`}</div>
   <div class="flex gap-1 flex-wrap">${open&&isSup()?`<button onclick="openOt('${b.id}')" class="btn ${o?'bg-slate-700':'bg-amber-500 text-slate-950'} !py-1">${o?'✏️ Editar OT':'＋ Aperturar OT'}</button>`:''}${o?`<button onclick="makePdfOt('${b.id}')" class="btn bg-slate-700 !py-1">📄 PDF</button>`:''}${o&&open&&otCanClose(b)?`<button onclick="openClose('${b.id}')" class="btn bg-emerald-500/20 text-emerald-400 !py-1">📝 Cerrar con reporte</button>`:''}</div></div>
   ${o?`<div class="igrid mt-3">${info('Asignada a',`<b class="${myOt(b)?'text-amber-400':''}">${esc(otTech(o)||'—')}</b>${myOt(b)?' (tú)':''}`)}${info('Elaborado por',esc(o.by||'—'))}${info('Turno',esc(o.turno||'—'))}${info('Lugar',esc(o.lugar||o.place||'—'))}
     ${info('Parada',esc(fxDT(o.fp)||'—'))}${info('Tipo de parada',esc(o.tipoPar||'—'))}${info('Motivo',esc((o.mot||[]).map(FX_MOT_L).join(', ')||'—'))}${info('Estado OT',bkOpen(b)?'<span class="text-amber-400">Abierta</span>':'<span class="text-emerald-400">Cerrada</span>')}</div>
     ${(o.tareas||[]).length?`<p class="ilab mt-3">Tareas a ejecutar</p>${o.tareas.map((t,i)=>`<p class="text-sm">${i+1}. ${esc(t.d)}${t.r?' <span class="text-slate-400">· '+esc(t.r)+'</span>':''}${t.h?' <span class="text-slate-400">· '+esc(t.h)+' h</span>':''}</p>`).join('')}`:o.acts?`<p class="ilab mt-3">Actividades</p><p class="text-sm whitespace-pre-line">${esc(o.acts)}</p>`:''}`:''}</div>`;
}
function rpCard(b){
  const r=stById(b.repId);if(!r)return '';
  return `<div class="dcard" style="border-color:rgba(16,185,129,.45)"><div class="flex justify-between items-start gap-2 flex-wrap"><div><p class="ilab">Reporte de mantenimiento (F-MT-25)</p><p class="text-lg font-bold mono">${esc(r.num||'—')} <span class="text-sm font-normal text-slate-400">${esc(fxDT(r.fp))} → ${esc(fxDT(r.fs))} · ${esc(r.t)} h</span></p><p class="text-xs text-slate-400">Ejecutado por ${esc(r.resp)} · estado final: ${esc(r.estFin||'—')}</p></div>
  <div class="flex gap-1"><button onclick="openStopView('${r.id}')" class="btn bg-slate-700 !py-1">👁️ Ver</button><button onclick="makePdfRpt('${r.id}')" class="btn bg-slate-700 !py-1">📄 PDF</button></div></div></div>`;
}
function vbCard(b){
  const one=(t,v,k,can)=>`<div class="bg-slate-900/50 border border-slate-700 rounded-lg p-3"><p class="ilab">${t}</p>${v&&v.name?`<p class="text-sm"><b>${esc(v.name)}</b> · ${fmtD(v.date)}</p>${v.sig?`<img src="${esc(v.sig)}" alt="Firma" style="height:2.6rem" class="bg-white rounded mt-1">`:'<p class="text-xs text-slate-500">Sin firma</p>'}`:`<p class="text-sm text-slate-500">Pendiente</p>`}${can?`<button type="button" onclick="bkVb('${b.id}','${k}')" class="btn bg-slate-700 !py-1 mt-2">✍️ ${v&&v.name?'Volver a firmar':'Dar V°B°'}</button>`:''}</div>`;
  const e=b.elab||{name:b.detectedBy,date:b.observationDate},a=bkApr(b),st=BK_APR[a];
  const canPl=isAdmin()&&a==='PLANNER',canSu=!!me&&me.role==='supervisor'&&a==='SUPERVISOR';
  const dev=(canPl||canSu)?`<button type="button" onclick="bkObs('${b.id}')" class="btn bg-red-500/20 text-red-300 !py-1 mt-2">↩️ Observar / devolver</button>`:'';
  const one2=(t,v,k,can,lbl)=>one(t,v,k,false).replace(/<\/div>$/,'')+(can?`<button type="button" onclick="bkVb('${b.id}','${k}')" class="btn bg-emerald-500 text-slate-950 !py-1 mt-2">✍️ ${lbl}</button>`:'')+(can?dev:'')+'</div>';
  return `<div class="dcard" ${st?`style="border-color:${st.c}88"`:''}><div class="flex justify-between items-center gap-2 flex-wrap"><p class="font-semibold">Aprobaciones del backlog</p>${st?`<span class="bdg" style="color:${st.c};background:${st.c}1f;border-color:${st.c}66">${st.l}</span>`:''}</div>
   ${a==='OBSERVADO'&&b.aprObs?`<p class="text-xs text-red-300 mt-1">↩️ Observado por ${esc(b.aprObs.by)} (${fmtD(b.aprObs.date)}): ${esc(b.aprObs.note)}. El solicitante debe corregirlo y guardarlo de nuevo con su firma.</p>`:''}
   <p class="text-xs text-slate-400 mb-2">Flujo: técnico firma → V°B° planner → V°B° supervisor / jefe de área. Se imprimen en el PDF.</p>
   <div class="g3">${one('Elaborado por (solicitante)',e,'elab',false)}${one2('V°B° Planner de mantenimiento',b.vbPl,'vbPl',canPl,'Dar V°B° y enviar al supervisor')}${one2('V°B° Supervisor / jefe de área',b.vbSup,'vbSup',canSu,'Dar V°B° (aprobar)')}</div></div>`;
}
const BK_APR={PLANNER:{l:'⏳ Por V°B° del planner',c:'#f59e0b'},SUPERVISOR:{l:'⏳ Por V°B° del supervisor',c:'#60a5fa'},APROBADO:{l:'✔ Aprobado',c:'#10b981'},OBSERVADO:{l:'↩️ Observado',c:'#ef4444'}};
const bkApr=b=>b.apr||(b.vbSup&&b.vbSup.name?'APROBADO':'');
const bkAprBadge=b=>{const s=BK_APR[bkApr(b)];return s&&bkApr(b)!=='APROBADO'?`<span class="bdg" style="color:${s.c};background:${s.c}1f;border-color:${s.c}66">${s.l}</span>`:''};
function bkVb(id,k){
  const b=backlogs.find(x=>x.id===id);if(!b)return;const a=bkApr(b);
  if(k==='vbPl'&&!(isAdmin()&&a==='PLANNER')){note('Este backlog no está pendiente del V°B° del planner.');return}
  if(k==='vbSup'&&!(me&&me.role==='supervisor'&&a==='SUPERVISOR')){note(a==='PLANNER'?'Primero debe dar su V°B° el planner.':'Solo el supervisor o jefe de área da este V°B°.');return}
  if(!mySig()){ask('Para dar tu V°B° primero registra tu firma en tu perfil.',openMe,'✍️ Registrar firma','bg-amber-500 text-slate-950');return}
  const pl=k==='vbPl';
  put('backlogs',{...b,[k]:{name:me.name,pos:me.position||'',date:today(),sig:mySig()},apr:pl?'SUPERVISOR':'APROBADO',aprObs:null,log:bkLog(b,pl?'V°B° del planner · '+me.name+' · enviado al supervisor / jefe de área':'V°B° del supervisor · '+me.name+' · backlog aprobado')});
  toast(pl?'✔ V°B° dado. Enviado al supervisor.':'✔ Backlog aprobado');setTimeout(()=>bkDetail(id,true),60);
}
function bkObs(id){
  const b=backlogs.find(x=>x.id===id);if(!b)return;
  show(`<h3 class="font-bold mb-2">↩️ Observar / devolver ${esc(bkNo(b))}</h3><p class="text-xs text-slate-400 mb-2">Vuelve al solicitante (${esc(b.detectedBy||'')}) para que lo corrija y lo firme de nuevo.</p>
   <textarea id="bk-obs" rows="3" maxlength="1000" class="inp" placeholder="¿Qué debe corregir?"></textarea><p id="bk-obs-e" class="text-xs text-red-400 hidden">Escribe la observación.</p>
   <div class="flex justify-end gap-2 mt-3"><button type="button" onclick="bkDetail('${id}')" class="btn bg-slate-700">Cancelar</button><button type="button" onclick="bkObsGo('${id}')" class="btn bg-red-500 text-white">Devolver</button></div>`,'30rem');
}
function bkObsGo(id){
  const b=backlogs.find(x=>x.id===id),t=($('bk-obs').value||'').trim();if(!b)return;if(!t){$('bk-obs-e').classList.remove('hidden');return}
  put('backlogs',{...b,apr:'OBSERVADO',vbPl:null,vbSup:null,aprObs:{by:me.name,date:today(),note:t},log:bkLog(b,'Observado por '+me.name+': '+t)});
  toast('↩️ Backlog devuelto al solicitante');setTimeout(()=>bkDetail(id),60);
}

/* ---------- Orden de trabajo (F-MT-24): aperturar / editar y asignar ---------- */
function openOt(id){
  const b=backlogs.find(x=>x.id===id);if(!b)return;if(!isSup()){note('Solo el planner o un supervisor pueden aperturar o editar la OT.');return}
  const o=b.ot||{},e=eqOf(b.fleetId),T=techList(),pers=o.pers||{};
  const lastP=[...backlogs.map(x=>x.ot&&x.ot.proy),...sps.map(s=>s.frente)].filter(Boolean);
  const tarDef=o.tareas||(b.actividad?b.actividad.split(/\n+/).map(s=>s.replace(/^[\s\-•\d.)]+/,'').trim()).filter(Boolean).map(d=>({d})):[{d:`Intervenir ${b.component.toLowerCase()} (${b.system.toLowerCase()})`}]);
  const techSel=T.length?`<select class="inp mt-1 font-normal" name="techUid" required><option value="">— Selecciona al técnico —</option>${T.map(u=>`<option value="${esc(u.uid)}" ${u.uid===o.techUid?'selected':''}>${esc(u.name)}${u.position?' · '+esc(u.position):''}</option>`).join('')}${o.techName&&!o.techUid?`<option value="" selected disabled>${esc(o.techName)} (sin cuenta)</option>`:''}</select>`
    :`<input class="inp mt-1 font-normal" name="techName" required maxlength="80" list="dl-otres" value="${esc(otTech(o))}" placeholder="Nombre completo del técnico">${stList('dl-otres',[...ST_RES,...backlogs.map(x=>x.ot&&otTech(x.ot))])}`;
  show(`<div class="flex justify-between items-start"><div><h3 class="font-bold text-lg">${o.num?'✏️ Editar':'＋ Aperturar'} orden de trabajo</h3><p class="text-xs text-slate-400">${esc(bkNo(b))} · ${esc(e.code)} · ${esc(b.component)} · formato F-MT-24</p></div><button type="button" onclick="bkDetail('${id}')" class="text-slate-400 text-xl">✕</button></div>
  <form onsubmit="saveOt(event,'${id}')" class="space-y-4 mt-3">
   ${fsec('👷','Asignación',`<label class="block text-xs text-slate-400 font-semibold">Responsable de ejecución (técnico asignado) *${techSel}</label><p class="text-[11px] text-slate-400">La OT le aparecerá en "Mis OT" de su aplicativo y la cerrará con el reporte de mantenimiento.${T.length?'':' (No se pudo cargar la lista del personal: escribe el nombre tal como figura en su cuenta).'}</p>`)}
   ${fsec(1,'Datos generales',`<div class="g3"><label class="block text-xs text-slate-400 font-semibold">N° OT<input class="inp mt-1 font-normal mono" value="${esc(o.num||'Se asigna al guardar ('+fmtNum('ot',numMax('ot')+1)+')')}" readonly tabindex="-1" style="opacity:.75"></label>${field('date','Fecha de emisión *',o.date||today(),'required','date')}${sel('turno','Turno',FX_TURNO,o.turno||'DÍA')}</div>
     <div class="g2"><label class="block text-xs text-slate-400 font-semibold">N° parada<input class="inp mt-1 font-normal mono" value="${esc(o.parada||('Se asigna al guardar ('+fmtNum('pa',numMax('pa')+1)+')'))}" readonly tabindex="-1" style="opacity:.75"></label>${field('prov','Proveedor / contratista',o.prov??'EMPRESA')}</div>
     <label class="block text-xs text-slate-400 font-semibold">Proyecto / frente${lst('proy',lastP,o.proy??b.proyecto??'','Ej. Canteras y rellenos Tía María')}</label>
     <p class="text-[11px] text-slate-400">Equipo: <b class="text-slate-200">${esc(e.code)}</b> · ${esc(e.category||'')} · ${esc(e.brand)} ${esc(e.model)} · S/N ${esc(e.serialNumber||'—')}${e.plate?' · Placa '+esc(e.plate):''} (se toman de la ficha del equipo)</p>`)}
   ${fsec(2,'Datos de la parada',`<div class="g2">${field('fp','Fecha y hora de parada',o.fp||'','','datetime-local')}${field('hp','Horómetro / km actual',o.hp??b.hoursAt??e.hours??'','min="0" step="any" inputmode="decimal"','number')}</div>
     <div><p class="text-xs text-slate-400 font-semibold mb-1">Tipo de parada</p>${fxOpts('tipoPar',['PLANIFICADA','NO PLANIFICADA'],o.tipoPar||'PLANIFICADA','radio')}</div>
     <div class="g2"><label class="block text-xs text-slate-400 font-semibold">Lugar de intervención${lst('lugar',ST_LUG,o.lugar||o.place||'')}</label>${sel('estEq','Estado del equipo al parar',['',...FX_EQST],o.estEq||'')}</div>`)}
   ${fsec(3,'Motivo de parada (marcar con X)',`${fxOpts('mot',FX_MOT.filter(m=>m[0]!=='OTROS'),o.mot||['BACKLOG'],'checkbox')}${field('motOtro','Otro',o.motOtro||'')}`)}
   ${fsec(4,'Descripción de la falla',`<label class="block text-xs text-slate-400 font-semibold">Síntoma / falla reportada<textarea name="sint" rows="2" maxlength="2000" class="inp mt-1 font-normal">${esc(o.sint??(b.sintoma||b.description||''))}</textarea></label>
     <div class="g2">${field('repPor','Reportado por',o.repPor??b.detectedBy??'')}${field('alarma','Código de alarma / falla',o.alarma??'N/A')}</div>
     <p class="text-xs text-slate-400 font-semibold">Sistema afectado</p>${fxOpts('sis',FX_SIS_OT,o.sis||(FX_BK2SIS[b.system]?[FX_BK2SIS[b.system]]:[]),'checkbox')}
     <div class="g2">${field('sisOtro','Otro sistema',o.sisOtro||'')}${field('comp','Componente',o.comp??b.component??'')}</div>`)}
   ${fsec(5,'Recursos requeridos',`<p class="text-xs text-slate-400 font-semibold">Personal / especialidad (cantidad)</p><div class="g2">${OT_PERS.map(k=>field('p_'+k,k.charAt(0)+k.slice(1).toLowerCase(),pers[k]??'','min="0" step="1" inputmode="numeric"','number')).join('')}</div>
     <div class="g2">${field('persOtro','Otro personal',o.persOtro||'','placeholder="Ej. Carrocero externo"')}${field('persOtroC','Cantidad (otro)',o.persOtroC??'','min="0" step="1" inputmode="numeric"','number')}</div>
     <p class="text-xs text-slate-400 font-semibold">Equipos / herramientas de apoyo</p>${fxOpts('apo',OT_APO,o.apo||[],'checkbox')}${field('apoOtro','Otro equipo / herramienta',o.apoOtro||'')}`)}
   ${fsec(6,'Tareas a ejecutar (adicionales al programa)',`<div id="rw-ottar"></div>`)}
   ${fsec(8,'Repuestos y materiales a utilizar',`<div id="rw-otrep"></div>`)}
   ${fsec(9,'Recomendaciones técnicas',`<div id="rw-otrec"></div>`)}
   ${fsec(10,'Conformidad',`<div class="g2">${field('by','Elaborado por (planner / supervisor)',o.by||me.name,'readonly')}${field('jefe','V°B° Jefe de mantenimiento',o.jefe||'','placeholder="Nombre (opcional)"')}</div><p class="text-[11px] text-slate-400">Tu firma del perfil se imprime en "Elaborado por". El responsable de ejecución firma al cerrar con el reporte.</p>`)}
   ${phxBox('otf','Panel fotográfico (opcional, hasta 6)',o.fotos||[],!!o.conFotos)}
   <p id="ot-err" class="text-xs text-red-400 hidden"></p>${btns(`bkDetail('${id}')`,o.num?'Guardar OT':'Aperturar y asignar OT')}</form>`,'50rem');
  rwInit('ottar',tarDef,[{k:'d',ph:'Descripción de la tarea',f:3},{k:'r',ph:'Responsable',f:1.2},{k:'h',ph:'H estim.',f:.6,t:1},{k:'e',ph:'Estado',f:1,opts:OT_TEST}],3);
  rwInit('otrep',o.reps||(b.parts||[]).map(p=>({c:p.np,d:p.d,q:p.cant,u:p.med})),[{k:'c',ph:'Código / N° parte',f:1.2},{k:'d',ph:'Descripción',f:2.4},{k:'q',ph:'Cant.',f:.6,t:1},{k:'u',ph:'Und',f:.6},{k:'s',ph:'¿En stock?',f:.8,opts:['SÍ','NO']},{k:'rq',ph:'N° req.',f:1}],2);
  rwInit('otrec',o.recs||(b.obsRec?[{d:b.obsRec}]:[]),[{k:'d',ph:'Recomendación',f:3},{k:'p',ph:'Prioridad',f:1,opts:PR_K}],1);
  phxRender('otf');
}
async function saveOt(ev,id){
  ev.preventDefault();const b=backlogs.find(x=>x.id===id);if(!b||!isSup())return;const F=ev.target,f=Object.fromEntries(new FormData(F)),er=$('ot-err'),bad=m=>{er.textContent=m;er.classList.remove('hidden');er.scrollIntoView({block:'center'})};
  const T=techList(),tu=f.techUid?T.find(u=>u.uid===f.techUid):null,old=b.ot||{};
  const techName=tu?tu.name:(f.techName!=null?String(f.techName).trim():otTech(old));if(!techName)return bad('Asigna la OT a un técnico.');
  const tareas=rwGet('ottar');if(!tareas.length)return bad('Escribe al menos una tarea a ejecutar.');
  const pers={};OT_PERS.forEach(k=>{const v=f['p_'+k];if(v!==''&&v!=null&&Number(v)>0)pers[k]=Number(v)});
  const fotOn=phxOn('otf');
  const sb=F.querySelector('button:not([type=button])');if(sb)sb.disabled=true;
  const num=old.num||(await takeNums('ot'))[0],nw=!old.num,parada=old.parada||(await takeNums('pa'))[0];
  const ot={...old,num,date:f.date,turno:f.turno||'',parada,prov:(f.prov||'').trim(),proy:(f.proy||'').trim(),
    fp:f.fp||'',hp:f.hp===''?'':Number(f.hp),tipoPar:f.tipoPar||'',lugar:(f.lugar||'').trim().toUpperCase(),estEq:f.estEq||'',
    mot:fxVals(F,'mot'),motOtro:(f.motOtro||'').trim(),sint:(f.sint||'').trim(),repPor:(f.repPor||'').trim(),alarma:(f.alarma||'').trim(),sis:fxVals(F,'sis'),sisOtro:(f.sisOtro||'').trim(),comp:(f.comp||'').trim(),
    pers,persOtro:(f.persOtro||'').trim(),persOtroC:f.persOtroC===''?'':Number(f.persOtroC),apo:fxVals(F,'apo'),apoOtro:(f.apoOtro||'').trim(),
    tareas,reps:rwGet('otrep'),recs:rwGet('otrec'),techUid:tu?tu.uid:(f.techName!=null?'':old.techUid||''),techName,jefe:(f.jefe||'').trim(),
    by:old.by||me.name,byPos:old.byPos||me.position||'',bySig:old.by&&old.by!==me.name?(old.bySig||''):mySig(),byDate:old.byDate||f.date,
    conFotos:fotOn,fotos:fotOn?phxGet('otf'):[],
    // compatibilidad con vistas anteriores
    resp:techName,esp:old.esp||'',place:(f.lugar||'').trim(),approved:(f.jefe||'').trim(),start:f.date,end:old.end||'',acts:tareas.map((t,i)=>(i+1)+'. '+t.d).join('\n'),loto:old.loto!==false,ats:old.ats!==false};
  const reasg=!nw&&old.techName&&old.techName!==techName;
  const st=nw&&b.status==='REGISTRADO'?'PLANIFICADO':b.status;
  const nb={...b,ot,status:st,scheduledDate:b.scheduledDate||f.date,log:bkLog(b,nw?'OT '+num+' aperturada y asignada a '+techName:reasg?'OT '+num+' reasignada a '+techName:'OT '+num+' editada')};
  if(docBig(nb)){if(sb)sb.disabled=false;return bad('La OT tiene demasiadas fotos o muy pesadas. Quita alguna e intenta otra vez.')}
  put('backlogs',nb);
  toast(nw?'✔ OT '+num+' aperturada y asignada a '+techName:'✔ OT '+num+' guardada');
  setTimeout(()=>bkDetail(id),60);
}

/* ---------- Reporte de mantenimiento (F-MT-25) ---------- */
// Cerrar un backlog: siempre con reporte de mantenimiento (si tiene OT, queda enlazado a ella)
function openClose(id){
  const b=backlogs.find(x=>x.id===id);if(!b)return;if(!bkOpen(b)){note('Este backlog ya está cerrado o anulado.');return}
  if(b.ot&&b.ot.num&&!otCanClose(b)){note('Esta OT está asignada a '+otTech(b.ot)+'. Solo esa persona, un supervisor o el planner pueden cerrarla.');return}
  const r=stById(b.repId);
  if(r&&r.status!=='ABIERTA'){openStop(r.id,'edit',null,b.id);return}
  const op=stOpen(b.fleetId)[0];
  openStop(op&&!op.bkRef?op.id:'',op&&!op.bkRef?'close':'full',b.fleetId,b.id);
}
function openStop(id,mode,fid,bkId){
  const old=sps.find(x=>x.id===id)||{},b=backlogs.find(x=>x.id===(bkId||old.bkRef))||null,o=b&&b.ot&&b.ot.num?b.ot:null;
  fid=fid||old.fleetId||(b&&b.fleetId);const e0=fleet.find(x=>x.id===fid)||null;
  if(!fleet.length){note('Primero registra equipos en la pestaña Equipos.');return}
  if(id&&!stCan(old)&&!(b&&otCanClose(b))){note('Solo el responsable, un supervisor o el planner pueden editar este reporte.');return}
  stFlag=false;
  const now=stNow(),ro=(me&&me.role==='tecnico')?' readonly':'',lastS=e0?sps.filter(x=>x.fleetId===e0.id).sort((a,c)=>(c.fp||'').localeCompare(a.fp||''))[0]:null;
  const eqSel=`<label class="block text-xs text-slate-400 font-semibold">Equipo *<select class="inp mt-1 font-normal" name="fleetId" required onchange="stEq(this)" ${b?'style="pointer-events:none;opacity:.8" tabindex="-1"':''}>${id||fid?'':'<option value="">Selecciona…</option>'}${fleetIn('st',fid).map(e=>`<option value="${e.id}" ${e.id===fid?'selected':''}>${esc(e.code)} · ${esc(stFleetTxt(e))}</option>`).join('')}</select></label>`;
  if(mode==='start'){
    const s={tipo:'NO PLANIFICADA',motivo:'MCI',...old};
    show(`<div class="flex justify-between"><h3 class="font-bold">🛑 Iniciar parada</h3><button type="button" onclick="hide()" class="text-slate-400 text-xl">✕</button></div>
    <form onsubmit="saveStop(event,'${id||''}','start')" class="space-y-3 mt-2">${eqSel}
     <div class="g2"><label class="block text-xs text-slate-400 font-semibold">Motivo de parada *<select class="inp mt-1 font-normal" name="motivo" onchange="stMot(this)">${ST_MOT.map(([k,l])=>`<option value="${k}" ${k===s.motivo?'selected':''}>${esc(l)}</option>`).join('')}</select></label>${sel('tipo','Tipo de parada *',['PLANIFICADA','NO PLANIFICADA'],s.tipo)}</div>
     <div class="g2">${stSel('frente','Proyecto / frente *',ST_FRE,s.frente||(lastS&&lastS.frente)||ST_FRE[0],1)}${stSel('lugar','Lugar de intervención *',ST_LUG,s.lugar||(lastS&&lastS.lugar)||'CAMPO',1)}</div>
     <div class="g2">${field('fp','Fecha y hora de parada *',s.fp||now,`required max="${now}"`,'datetime-local')}${field('hp','Horómetro de parada *',s.hp??(e0?e0.hours:''),'required min="0" step="any" inputmode="decimal"','number')}</div>
     ${field('resp','Responsable *',s.resp||stOfficial(me&&me.name),'required list="dl-res"'+ro)}
     <label class="block text-xs text-slate-400 font-semibold">Síntoma / falla reportada (opcional)<textarea maxlength="2000" name="sint" rows="2" class="inp mt-1 font-normal">${esc(s.sint||'')}</textarea></label>
     ${stList('dl-res',[...ST_RES,...sps.map(x=>x.resp)])}<p id="st-err" class="text-xs text-red-400 hidden"></p>${btns('hide()','Iniciar parada','bg-red-500')}</form>`,'38rem');
    return;
  }
  if(!b){openRegDia(id,mode,fid,old,e0,lastS);return}
  // valores por defecto: del reporte existente, de la OT o de la parada abierta
  const s={tipo:'PLANIFICADA',motivo:'MCI',rdem:'MANTENIMIENTO',rpar:'MANTENIMIENTO',turno:'DÍA',...old};
  if(!id&&!b)s.tipo='NO PLANIFICADA';
  if(o&&!old.otNum){
    const m=(o.mot||[])[0];if(m)s.motivo=m;if(o.tipoPar)s.tipo=o.tipoPar;if(o.fp&&!s.fp)s.fp=o.fp;if(o.hp!==''&&o.hp!=null&&s.hp==null)s.hp=o.hp;
    if(o.lugar&&!s.lugar)s.lugar=o.lugar;if(o.proy&&!s.frente)s.frente=o.proy;if(o.turno)s.turno=o.turno;
    if(!s.sistemas)s.sistemas=(o.sis||[]).map(x=>x==='GETS'?'NEUMÁTICO':x);if(!s.comp)s.comp=o.comp||b.component;if(!s.sint)s.sint=o.sint||'';
    if(!s.tareas)s.tareas=(o.tareas||[]).map(t=>({d:t.d,tec:t.r||otTech(o),hh:t.h||''}));
  }else if(b&&!old.bkRef){if(!s.comp)s.comp=b.component;if(!s.sint)s.sint=b.sintoma||b.description;if(!s.sistemas&&FX_BK2SIS[b.system])s.sistemas=[FX_BK2SIS[b.system]];if(!s.motivo||s.motivo==='MCI')s.motivo='BACKLOG';s.tipo=s.tipo||'PLANIFICADA'}
  if(!s.sistemas)s.sistemas=s.sistema?[s.sistema]:[];
  if(!s.tareas)s.tareas=s.desc?[{d:s.desc,tec:s.resp||'',hh:''}]:[];
  if(!s.pend)s.pend=s.obs?[{d:stFinding(s.obs)}].filter(x=>x.d):[];
  const ej=s.ejec||{},ttl=b?(o?'📝 Reporte de mantenimiento · cierre de '+esc(o.num):'📝 Reporte de mantenimiento · cierre de '+esc(bkNo(b))):{close:'✅ Cerrar parada · reporte de mantenimiento',full:'📝 Reporte de mantenimiento',edit:'✏️ Editar reporte de mantenimiento'}[mode]||'📝 Reporte de mantenimiento';
  const nrp=s.num||'Se asigna al guardar ('+fmtNum('rp',numMax('rp')+1)+')';
  show(`<div class="flex justify-between items-start"><div><h3 class="font-bold text-lg">${ttl}</h3><p class="text-xs text-slate-400">Formato F-MT-25${b?' · '+esc(bkNo(b))+' · '+esc(b.component):''}</p></div><button type="button" onclick="hide()" class="text-slate-400 text-xl">✕</button></div>
  <form onsubmit="saveStop(event,'${id||''}','${mode}','${b?b.id:''}')" class="space-y-4 mt-3" ${id?'data-edit="1"':''}>
   ${fsec(1,'Datos generales del equipo',`${eqSel}
     <div class="g3"><label class="block text-xs text-slate-400 font-semibold">N° reporte<input class="inp mt-1 font-normal mono" value="${esc(nrp)}" readonly tabindex="-1" style="opacity:.75"></label><label class="block text-xs text-slate-400 font-semibold">N° OT<input class="inp mt-1 font-normal mono" value="${esc(o?o.num:(s.otNum||'Sin OT'))}" readonly tabindex="-1" style="opacity:.75"></label>${sel('turno','Turno',FX_TURNO,s.turno||'DÍA')}</div>
     <div class="g2">${stSel('frente','Proyecto / cliente *',ST_FRE,s.frente||(lastS&&lastS.frente)||ST_FRE[0],1)}${stSel('lugar','Lugar de intervención *',ST_LUG,s.lugar||(lastS&&lastS.lugar)||'CAMPO',1)}</div>`)}
   ${fsec(2,'Control de tiempos y disponibilidad',`<div class="g2">${field('fp','Inicio: fecha y hora de parada *',s.fp||now,`required max="${now}" oninput="rpCalc()"`,'datetime-local')}${field('fs','Fin: fecha y hora de salida (entrega a operaciones) *',s.fs||now,`required max="${now}" oninput="rpCalc()"`,'datetime-local')}</div>
     <div class="g2">${field('hp','Horómetro / km inicial *',s.hp??(e0?e0.hours:''),'required min="0" step="any" inputmode="decimal" oninput="rpCalc()"','number')}${field('hs','Horómetro / km final',s.hs??'','min="0" step="any" inputmode="decimal" placeholder="= inicial" oninput="rpCalc()"','number')}</div>
     <div class="g2">${field('tEf','Tiempo efectivo de reparación (h)',s.tEf??'','min="0" step="0.1" inputmode="decimal" oninput="rpCalc()"','number')}<div class="rpcalc"><p>Tiempo total fuera de servicio: <b id="rp-tt">–</b></p><p>Tiempo de demora / espera: <b id="rp-td">–</b></p><p>Dif. horómetro / km (prueba): <b id="rp-dh">–</b></p></div></div>
     <div class="g2">${field('proxMp','Próximo MP a (horóm. / km)',s.proxMp??'','min="0" step="any" inputmode="decimal"','number')}${sel('proxTipo','Tipo próximo MP',['','MP1','MP2','MP3','MP4'],s.proxTipo||'')}</div>`)}
   ${fsec(3,'Clasificación de la intervención',`<div><p class="text-xs text-slate-400 font-semibold mb-1">Tipo de parada</p>${fxOpts('tipo',['PLANIFICADA','NO PLANIFICADA'],s.tipo,'radio')}</div>
     <div><p class="text-xs text-slate-400 font-semibold mb-1">Motivo de parada *</p>${fxOpts('motivo',FX_MOT.map(([k,l])=>[k,k==='MCI'?'CORRECTIVO IMPREVISTO (MCI)':k==='MCP'?'CORRECTIVO PROGRAM. (MCP)':k==='CAMPANA'?'CAMPAÑA / BOLETÍN':l]),s.motivo,'radio')}</div>${field('motOtro','Otro motivo',s.motOtro||'')}`)}
   ${fsec(4,'Sistema intervenido',`${fxOpts('sis',FX_SIS_RP,s.sistemas,'checkbox')}<div class="g2">${field('sisOtro','Otro sistema',s.sisOtro||'')}${field('comp','Componente',s.comp||'')}</div>`)}
   ${fsec(5,'Análisis de falla (obligatorio en correctivos MCI / MCP)',`<label class="block text-xs text-slate-400 font-semibold">Síntoma / falla reportada<textarea maxlength="2000" name="sint" rows="2" class="inp mt-1 font-normal">${esc(s.sint||'')}</textarea></label>
     ${field('modo','Modo de falla encontrado',s.modo||'')}
     <p class="text-xs text-slate-400 font-semibold">Causa raíz</p>${fxOpts('causa',RP_CAUSA,s.causas||[],'checkbox')}${field('causaOtro','Otra causa',s.causaOtro||'')}
     <label class="block text-xs text-slate-400 font-semibold">Acción para evitar recurrencia<textarea maxlength="2000" name="accion" rows="2" class="inp mt-1 font-normal">${esc(s.accion||'')}</textarea></label>`)}
   ${fsec(6,'Responsabilidad de la parada y de la demora',`<div><p class="text-xs text-slate-400 font-semibold mb-1">Responsable de la parada</p>${fxOpts('rpar',RP_PAR,RP_PAR.includes(s.rpar)?s.rpar:'OTRO','radio')}</div>${field('rparOtro','Otro (parada)',s.rparOtro||(RP_PAR.includes(s.rpar)?'':s.rpar||''))}
     <div><p class="text-xs text-slate-400 font-semibold mb-1">Responsable de la demora</p>${fxOpts('rdem',RP_DEM.map(x=>[x,RP_DEM_L[x]||x]),RP_DEM.includes(s.rdem)?s.rdem:'OTRO','radio')}</div>${field('rdemOtro','Otro (demora)',s.rdemOtro||(RP_DEM.includes(s.rdem)?'':s.rdem||''))}
     <label class="block text-xs text-slate-400 font-semibold">Motivo de demora<textarea maxlength="2000" name="motDem" rows="2" class="inp mt-1 font-normal">${esc(s.motDem||'')}</textarea></label>`)}
   ${fsec(7,'Detalle de trabajos realizados *',`<div id="rw-rptar"></div>`)}
   ${fsec(9,'Pruebas, verificación y liberación del equipo',`${fxOpts('pru',RP_PRU,s.pruebas||[],'checkbox')}<div><p class="text-xs text-slate-400 font-semibold mb-1 mt-2">Estado final del equipo *</p>${fxOpts('estFin',FX_EQST,s.estFin||'OPERATIVO','radio')}</div>`)}
   ${fsec(10,'Observaciones y trabajos pendientes (backlog)',`<div id="rw-rppend"></div>${s.pendDone?'<p class="text-xs text-slate-400">🔧 Los pendientes de este reporte ya generaron backlogs.</p>':`<label class="flex items-center gap-2 text-sm"><input type="checkbox" name="mkb" checked style="width:20px;height:20px;accent-color:#f59e0b"> Generar un backlog por cada pendiente</label>`}`)}
   ${fsec(11,'Conformidad',`<div class="g2">${field('resp','Ejecutado por (técnico líder) *',s.resp||(o?otTech(o):'')||stOfficial(me&&me.name),'required list="dl-res"'+ro)}${field('ejDate','Fecha',ej.date||(s.fs||now).slice(0,10),'','date')}</div>
     ${sigBox('Firma del técnico líder',!b)}<p class="text-[11px] text-slate-400">"Revisado por (supervisor / jefe mantto.)" se firma cuando el supervisor valida el trabajo.</p>`)}
   ${phxBox('rpf','Panel fotográfico (opcional, hasta 6)',s.fotos||(s.photos||[]).map(x=>({src:x,et:'DESPUÉS',d:''})),s.conFotos!=null?s.conFotos:!!(s.photos||[]).length)}
   ${stList('dl-res',[...ST_RES,...sps.map(x=>x.resp),...techList().map(u=>u.name)])}
   <p id="st-err" class="text-xs text-red-400 hidden"></p>${btns('hide()',b?'Cerrar y enviar a validación':'Guardar reporte','bg-emerald-500')}</form>`,'50rem');
  rwInit('rptar',s.tareas,[{k:'d',ph:'Descripción de la tarea (qué se hizo, dónde y con qué resultado)',f:3},{k:'tec',ph:'Técnico',f:1.3,list:'dl-res'},{k:'hh',ph:'H-H',f:.6,t:1}],3);
  rwInit('rppend',s.pend,[{k:'d',ph:'Observación / trabajo pendiente',f:3},{k:'p',ph:'Prioridad',f:.9,opts:PR_K},{k:'r',ph:'Repuesto requerido',f:1.5}],1);
  phxRender('rpf');sigInit(ej.sig||(!s.resp||nk(s.resp)===nk(me.name)||nk(s.resp)===nk(stOfficial(me.name))||(b&&myOt(b))?mySig():''));rpCalc();
}
/* ---------- Registro de intervenciones diaria (misma estructura del formulario de Google) ---------- */
const RD_MOT=['PM1','PM2','PM3','PM4','MCI','MCP','MEJORATIVO','PREDICTIVO','ENGRASE','OTROS'];
function openRegDia(id,mode,fid,old,e0,lastS){
  const now=stNow(),ro=(me&&me.role==='tecnico')?' readonly':'',s={tipo:'NO PLANIFICADA',motivo:'MCI',rdem:'MANTENIMIENTO',rpar:'MANTENIMIENTO',...old};
  const eqs=fleetIn('st',fid),fl=[...new Set(eqs.map(stFleetTxt))].sort((a,c)=>a.localeCompare(c,'es')),f0=e0?stFleetTxt(e0):'';
  const mot=RD_MOT.includes(s.motivo)?RD_MOT:RD_MOT.concat([s.motivo]);
  const sis=s.sistema||(s.sistemas||[])[0]||'',desc=s.desc!=null&&s.desc!==''?s.desc:(s.tareas||[]).map(x=>x.d).filter(Boolean).join('\n');
  const q=(n,t,body)=>`<div class="fsec"><p class="fsec-h"><span>${n}</span>${t}</p><div class="space-y-2">${body}</div></div>`;
  const ttl={close:'✅ Cerrar parada · Registro de intervenciones diaria',edit:'✏️ Editar registro de intervención diaria'}[mode]||'📝 Registro de intervenciones diaria';
  const nrp=s.num||'Se asigna al guardar ('+fmtNum('rp',numMax('rp')+1)+')';
  show(`<div class="flex justify-between items-start"><div><h3 class="font-bold text-lg">${ttl}</h3><p class="text-xs text-slate-400">N° ${esc(nrp)}</p></div><button type="button" onclick="hide()" class="text-slate-400 text-xl">✕</button></div>
  <form onsubmit="saveRegDia(event,'${id||''}','${mode}')" class="space-y-3 mt-3" ${id?'data-edit="1"':''}>
   ${q(1,'FLOTA *',`<select class="inp font-normal" name="rdFlota" required onchange="rdFlota(this)" ${id?'':''}><option value="">— elegir —</option>${fl.map(x=>`<option value="${esc(x)}" ${x===f0?'selected':''}>${esc(x)}</option>`).join('')}</select>`)}
   ${q(2,'CÓDIGO *',`<select class="inp font-normal" name="fleetId" required onchange="stEq(this);rdCode(this)"><option value="">— elegir —</option>${eqs.map(e=>`<option value="${e.id}" data-fl="${esc(stFleetTxt(e))}" ${e.id===fid?'selected':''} ${f0&&stFleetTxt(e)!==f0?'hidden':''}>${esc(e.code)}</option>`).join('')}</select><p class="text-[11px] text-slate-400">Códigos del apartado Equipos</p>`)}
   ${q(3,'TIPO DE PARADA *',fxOpts('tipo',['PLANIFICADA','NO PLANIFICADA'],s.tipo,'radio'))}
   ${q(4,'MOTIVO DE PARADA *',fxOpts('motivo',mot,s.motivo,'radio'))}
   ${q(5,'SISTEMA / COMPONENTE *',stSel('sistema','',ST_SIS,sis,1))}
   ${q(6,'DESCRIPCIÓN DE LA TAREA *',`<textarea maxlength="3000" name="desc" rows="3" required class="inp font-normal">${esc(desc)}</textarea>`)}
   ${q(7,'RESPONSABLE *',`<input class="inp font-normal" name="resp" list="dl-res" required value="${esc(s.resp||stOfficial(me&&me.name))}"${ro}>`)}
   ${q(8,'FRENTE DE TRABAJO *',`<input class="inp font-normal" name="frente" list="dl-fre" required maxlength="80" autocomplete="off" placeholder="Elige o escribe el frente" value="${esc(s.frente||(lastS&&lastS.frente)||'')}"><p class="text-[11px] text-slate-400">Elige de la lista o escribe uno nuevo</p>${stList('dl-fre',[...ST_FRE,...sps.map(x=>x.frente),...fleet.map(x=>x.project)].map(x=>String(x||'').trim().toUpperCase()))}`)}
   <div class="g2">${q(9,'HORÓMETRO DE PARADA *',`<input class="inp font-normal" name="hp" type="number" min="0" step="any" inputmode="decimal" required value="${esc(s.hp??(e0?e0.hours:''))}">`)}${q(10,'HORÓMETRO DE SALIDA *',`<input class="inp font-normal" name="hs" type="number" min="0" step="any" inputmode="decimal" required value="${esc(s.hs??'')}">`)}</div>
   <div class="g2">${q(11,'FECHA Y HORA DE PARADA *',`<input class="inp font-normal" name="fp" type="datetime-local" required max="${now}" value="${esc(s.fp||now)}" oninput="rdCalc()">`)}${q(12,'FECHA Y HORA DE SALIDA *',`<input class="inp font-normal" name="fs" type="datetime-local" required max="${now}" value="${esc(s.fs||now)}" oninput="rdCalc()">`)}</div>
   ${q(13,'TIEMPO REAL DE LA INTERVENCIÓN (H) *',`<input class="inp font-normal" name="tEf" type="number" min="0" step="0.01" inputmode="decimal" required value="${esc(s.tEf!==''&&s.tEf!=null?s.tEf:(s.t||''))}" ${s.tEf!==''&&s.tEf!=null?'data-man="1"':''} oninput="this.dataset.man=1"><p class="text-[11px] text-slate-400">Fuera de servicio según las fechas: <b id="rd-tt">–</b> (se llena solo; puedes corregirlo)</p>`)}
   <div class="g2">${q(14,'RESPONSABLE DE LA DEMORA *',stSel('rdem','',ST_DEM,s.rdem,1))}${q(15,'RESPONSABLE DE LA PARADA *',stSel('rpar','',ST_PAR,s.rpar,1))}</div>
   ${q(16,'LUGAR DE INTERVENCIÓN *',stSel('lugar','',ST_LUG,s.lugar||(lastS&&lastS.lugar)||'',1))}
   ${q(17,'OBSERVACIONES',`<textarea maxlength="3000" name="obs" rows="2" class="inp font-normal">${esc(s.obs||'')}</textarea>`)}
   ${phxBox('rpf','18 · EVIDENCIA FOTOGRÁFICA (opcional, hasta 6)',s.fotos||(s.photos||[]).map(x=>({src:x,et:'DESPUÉS',d:''})),s.conFotos!=null?s.conFotos:!!(s.photos||[]).length)}
   ${stList('dl-res',[...ST_RES,...sps.map(x=>x.resp),...techList().map(u=>u.name)])}
   <p id="st-err" class="text-xs text-red-400 hidden"></p>${btns('hide()','Guardar registro','bg-emerald-500')}</form>`,'44rem');
  phxRender('rpf');rdCalc();
}
function rdFlota(sel){const F=sel.form,c=F.fleetId;[...c.options].forEach(o=>{if(o.value)o.hidden=!!sel.value&&o.dataset.fl!==sel.value});if(c.selectedOptions[0]&&c.selectedOptions[0].hidden)c.value=''}
function rdCode(sel){const o=sel.selectedOptions[0];if(o&&o.dataset.fl)sel.form.rdFlota.value=o.dataset.fl}
function rdCalc(){const F=document.querySelector('#modal form');if(!F||!F.tEf||!$('rd-tt'))return;
  const t=F.fp.value&&F.fs.value?stHrs(F.fp.value,F.fs.value):NaN;$('rd-tt').textContent=t>0?t+' h':'–';if(t>0&&!F.tEf.dataset.man)F.tEf.value=t}
async function saveRegDia(ev,id,mode){
  ev.preventDefault();const F=ev.target,f=Object.fromEntries(new FormData(F)),er=$('st-err'),bad=m=>{er.textContent=m;er.classList.remove('hidden');er.scrollIntoView({block:'center'})};
  const e=fleet.find(x=>x.id===f.fleetId);if(!e){bad('Elige el código del equipo.');return}
  const old=sps.find(x=>x.id===id)||{},now=stNow(),up=v=>String(v||'').trim().toUpperCase();
  if(!f.tipo){bad('Marca el tipo de parada.');return}if(!f.motivo){bad('Marca el motivo de parada.');return}
  const desc=(f.desc||'').trim();if(!desc){bad('Escribe la descripción de la tarea.');return}
  const hp=Number(f.hp),hs=Number(f.hs);if(f.hp===''||isNaN(hp)){bad('Ingresa el horómetro de parada.');return}if(f.hs===''||isNaN(hs)){bad('Ingresa el horómetro de salida.');return}
  if(hs<hp){bad('El horómetro de salida ('+fmtH(hs)+') no puede ser menor al de parada ('+fmtH(hp)+').');return}
  const fp=f.fp,fs=f.fs;if(!fp||!fs){bad('Ingresa la fecha y hora de parada y de salida.');return}
  if(fp>now||fs>now){bad('Las fechas no pueden ser futuras.');return}if(stMs(fs)<=stMs(fp)){bad('La salida debe ser posterior a la parada.');return}
  const t=stHrs(fp,fs),tEf=Number(f.tEf);if(f.tEf===''||isNaN(tEf)||tEf<0){bad('Ingresa el tiempo real de la intervención (h).');return}
  if(tEf>t+0.01){bad('El tiempo real de la intervención ('+tEf+' h) no puede superar el tiempo entre parada y salida ('+t+' h).');return}
  if(sps.some(x=>x.id!==id&&x.fleetId===e.id&&x.fp===fp&&x.motivo===f.motivo)){bad('Ya existe una intervención de este equipo con la misma hora de parada y motivo (posible duplicado).');return}
  const warn=[];if(t>24)warn.push('la intervención dura '+t+' h');
  if(sps.some(x=>x.id!==id&&x.fleetId===e.id&&x.fp&&stMs(x.fp)<stMs(fs)&&(x.fs?stMs(x.fs):Infinity)>stMs(fp)))warn.push('se cruza con otra intervención del mismo equipo');
  if(warn.length&&!stFlag){stFlag=true;bad('Revisa: '+warn.join('; ')+'. Si es correcto, presiona Guardar otra vez.');return}
  const fotOn=phxOn('rpf'),fotos=fotOn?phxGet('rpf'):[],obs=(f.obs||'').trim(),resp=(f.resp||'').trim(),sistema=f.sistema||'OTROS';
  const rec={...old,id:id||'ST-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),ts:old.ts||Date.now(),fleetId:e.id,flota:stFleetTxt(e),cod:e.code,
    tipo:f.tipo,motivo:f.motivo,sistema,sistemas:[sistema],desc,tareas:[{d:desc,tec:resp,hh:tEf}],resp,respUid:old.respUid||me.uid,frente:up(f.frente),lugar:up(f.lugar),
    hp,hs,fp,fs,t,tEf,tDem:Math.max(0,Math.round((t-tEf)*100)/100),rdem:f.rdem,rpar:f.rpar,obs,pend:obs===(old.obs||'')?(old.pend||[]):[],
    status:'CERRADA',src:old.src||'app',fmt:'RD',estFin:old.estFin||'OPERATIVO',ejec:{...(old.ejec||{}),name:resp,date:fs.slice(0,10)},conFotos:fotOn,fotos,photos:fotos.map(p=>p.src)};
  if(docBig(rec)){bad('El registro tiene demasiadas fotos o muy pesadas. Quita alguna e intenta otra vez.');return}
  const sb=F.querySelector('button:not([type=button])');if(sb)sb.disabled=true;let extra='';
  if(!numOf('rp',rec.num))rec.num=(await takeNums('rp'))[0];
  if(rec.motivo==='ENGRASE'&&!old.grLogId){const gid='GR-'+Date.now().toString().slice(-8);put('grease',stGreaseFrom(rec,gid));rec.grLogId=gid;extra=' Se registró también en Engrase.'}
  put('stops',rec);if(hs>(Number(e.hours)||0))put('fleet',{...e,hours:hs});
  repDate=fp.slice(0,10);hide();note('Registro '+rec.num+' guardado ('+t+' h).'+extra);
  if(cur==='rep'||cur==='back'||cur==='dash')render();
}
function rpCalc(){
  const F=document.querySelector('#modal form');if(!F||!F.fs||!$('rp-tt'))return;
  const t=F.fp.value&&F.fs.value?stHrs(F.fp.value,F.fs.value):NaN,ef=F.tEf.value===''?NaN:Number(F.tEf.value),hp=Number(F.hp.value),hs=F.hs.value===''?hp:Number(F.hs.value);
  $('rp-tt').textContent=t>0?t+' h':'–';$('rp-td').textContent=t>0&&!isNaN(ef)?Math.max(0,Math.round((t-ef)*100)/100)+' h':'–';$('rp-dh').textContent=F.hp.value!==''&&!isNaN(hs)?Math.round((hs-hp)*100)/100+'':'–';
}
async function saveStop(ev,id,mode,bkId){
  ev.preventDefault();const F=ev.target,f=Object.fromEntries(new FormData(F)),er=$('st-err'),bad=m=>{er.textContent=m;er.classList.remove('hidden');er.scrollIntoView({block:'center'})};
  const e=fleet.find(x=>x.id===f.fleetId);if(!e){bad('Elige el equipo.');return}
  const closing=mode!=='start',old=sps.find(x=>x.id===id)||{},now=stNow(),b=backlogs.find(x=>x.id===(bkId||old.bkRef))||null;
  if(f.fp>now){bad('La fecha y hora de parada no puede ser futura.');return}
  const hp=Number(f.hp);if(f.hp===''||isNaN(hp)){bad('Ingresa el horómetro de parada.');return}
  let hs='',t='',fs='',tareas=[],pend=[],sistemas=[],causas=[];
  if(closing){
    fs=f.fs;if(!fs){bad('Ingresa la fecha y hora de salida.');return}
    if(fs>now){bad('La salida no puede ser futura.');return}
    if(stMs(fs)<=stMs(f.fp)){bad('La salida debe ser posterior a la parada.');return}
    hs=f.hs===''?hp:Number(f.hs);if(hs<hp){bad('El horómetro final ('+fmtH(hs)+') no puede ser menor al inicial ('+fmtH(hp)+').');return}
    t=stHrs(f.fp,fs);tareas=rwGet('rptar');pend=rwGet('rppend');sistemas=fxVals(F,'sis');causas=fxVals(F,'causa');
    if(!tareas.some(x=>x.d)){bad('Describe al menos un trabajo realizado (sección 7).');return}
    if(!f.motivo){bad('Marca el motivo de parada.');return}
    if(!sistemas.length&&!(f.sisOtro||'').trim()){bad('Marca el sistema intervenido (sección 4).');return}
    if((f.motivo==='MCI'||f.motivo==='MCP')&&(!(f.sint||'').trim()||(!causas.length&&!(f.causaOtro||'').trim()))){bad('En correctivos (MCI / MCP) el análisis de falla es obligatorio: escribe el síntoma y marca la causa raíz.');return}
    if(f.tEf!==''&&Number(f.tEf)>t+0.01){bad('El tiempo efectivo de reparación ('+f.tEf+' h) no puede superar el tiempo total fuera de servicio ('+t+' h).');return}
    if(b&&!sig.drawn){bad('Falta la firma del técnico líder (sección 11).');return}
  }
  if(sps.some(x=>x.id!==id&&x.fleetId===e.id&&x.fp===f.fp&&x.motivo===f.motivo)){bad('Ya existe una intervención de este equipo con la misma hora de parada y motivo (posible duplicado).');return}
  const warn=[],a0=stMs(f.fp),a1=closing?stMs(fs):Infinity;
  if(closing&&t>24)warn.push('la intervención dura '+t+' h');
  if(sps.some(x=>x.id!==id&&x.fleetId===e.id&&x.fp&&stMs(x.fp)<a1&&(x.fs?stMs(x.fs):Infinity)>a0))warn.push('se cruza con otra intervención del mismo equipo');
  if(warn.length&&!stFlag){stFlag=true;bad('Revisa: '+warn.join('; ')+'. Si es correcto, presiona Guardar otra vez.');return}
  const fotOn=closing?phxOn('rpf'):!!old.conFotos,fotos=closing?(fotOn?phxGet('rpf'):[]):(old.fotos||[]);
  const up=v=>String(v||'').trim().toUpperCase();
  const rpar=f.rpar==='OTRO'?(up(f.rparOtro)||'OTRO'):(f.rpar||old.rpar||'MANTENIMIENTO'),rdem=f.rdem==='OTRO'?(up(f.rdemOtro)||'OTRO'):(f.rdem||old.rdem||'MANTENIMIENTO');
  const rec={...old,id:id||'ST-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),ts:old.ts||Date.now(),fleetId:e.id,flota:stFleetTxt(e),cod:e.code,
    tipo:f.tipo||old.tipo||'PLANIFICADA',motivo:f.motivo||old.motivo||'OTROS',motOtro:(f.motOtro||'').trim(),turno:f.turno||old.turno||'',
    frente:up(f.frente),lugar:up(f.lugar),resp:(f.resp||'').trim(),respUid:old.respUid||me.uid,hp,hs,fp:f.fp,fs,t,status:closing?'CERRADA':'ABIERTA',src:old.src||'app',
    sint:(f.sint||'').trim()};
  if(closing){
    const tEf=f.tEf===''?'':Number(f.tEf);
    Object.assign(rec,{sistemas,sisOtro:(f.sisOtro||'').trim(),sistema:(sistemas[0]||up(f.sisOtro)||'OTROS'),comp:(f.comp||'').trim(),modo:(f.modo||'').trim(),causas,causaOtro:(f.causaOtro||'').trim(),accion:(f.accion||'').trim(),
      tEf,tDem:tEf===''?'':Math.max(0,Math.round((t-tEf)*100)/100),proxMp:f.proxMp===''?'':Number(f.proxMp),proxTipo:f.proxTipo||'',
      rpar,rparOtro:f.rpar==='OTRO'?(f.rparOtro||'').trim():'',rdem,rdemOtro:f.rdem==='OTRO'?(f.rdemOtro||'').trim():'',motDem:(f.motDem||'').trim(),
      tareas,desc:tareas.map(x=>x.d).filter(Boolean).join('\n'),pruebas:fxVals(F,'pru'),estFin:f.estFin||'OPERATIVO',pend,obs:pend.map(x=>'- '+x.d+(x.r?' (repuesto: '+x.r+')':'')).join('\n'),
      ejec:{name:(f.resp||'').trim(),date:f.ejDate||fs.slice(0,10),sig:sig.drawn?sigData():''},conFotos:fotOn,fotos,photos:fotos.map(p=>p.src)});
    if(b){rec.bkRef=b.id;if(b.ot&&b.ot.num)rec.otNum=b.ot.num}
  }else Object.assign(rec,{sistema:old.sistema||'',desc:old.desc||'',obs:old.obs||'',photos:old.photos||[]});
  if(docBig(rec)){bad('El reporte tiene demasiadas fotos o muy pesadas. Quita alguna e intenta otra vez.');return}
  let extra='';const sb=F.querySelector('button:not([type=button])');if(sb)sb.disabled=true;
  if(!numOf('rp',rec.num))rec.num=(await takeNums('rp'))[0];
  if(closing&&f.mkb&&!old.pendDone&&pend.length){
    const nums=await takeNums('bk',pend.length);
    pend.forEach((p,i)=>{const nb=bkFromPend(rec,e,p,'BKL-'+(Date.now()+i).toString().slice(-7));nb.num=nums[i];put('backlogs',nb)});
    rec.pendDone=true;extra+=' Se crearon '+pend.length+' backlog(s) con los pendientes ('+nums.join(', ')+').';
  }
  if(closing&&rec.motivo==='ENGRASE'&&!old.grLogId){const gid='GR-'+Date.now().toString().slice(-8);put('grease',stGreaseFrom(rec,gid));rec.grLogId=gid;extra+=' Se registró también en Engrase.'}
  put('stops',rec);
  if((closing?hs:hp)>(Number(e.hours)||0))put('fleet',{...e,hours:closing?hs:hp});
  if(closing&&b&&bkOpen(b)){
    const nb={...b,repId:rec.id,repNum:rec.num,closeDate:fs.slice(0,10),closeTech:rec.resp,closePos:posOf(rec.resp),closeHours:hs,downtimeH:t,closeNotes:rec.desc,closeSignature:rec.ejec.sig,photosAfter:[],
      status:'PENDIENTE_VALIDACION',supName:'',supDate:'',supNotes:'',supSignature:'',log:bkLog(b,(b.ot&&b.ot.num?'OT '+b.ot.num+' cerrada':'Backlog cerrado')+' con el reporte '+rec.num+' por '+rec.resp+' · pasa a validación del supervisor')};
    if(b.ot&&b.ot.num)nb.ot={...b.ot,repNum:rec.num};
    put('backlogs',nb);extra=' '+(b.ot&&b.ot.num?'La '+b.ot.num:'El backlog '+bkNo(b))+' quedó pendiente de validación del supervisor.'+extra;
  }
  repDate=f.fp.slice(0,10);hide();
  note(mode==='start'?'Parada '+rec.num+' iniciada: '+e.code+' figura en mantenimiento hasta que la cierres.':'Reporte '+rec.num+' guardado ('+(t||0)+' h).'+extra);
  if(cur==='rep'||cur==='back'||cur==='dash')render();else if(mode==='start')tab('rep');
}
function bkFromPend(s,e,p,id){
  const d=p.d,day=s.fs.slice(0,10),comp=d.split(/[.\n;]/)[0].trim(),sy=FX_SIS2BK[(s.sistemas||[])[0]]||'Estructura / Chasis / Bastidor';
  return{id,fleetId:e.id,system:sy,component:comp.length>70?comp.slice(0,67)+'…':(comp||'Pendiente del reporte '+s.num),criticality:PR_K.includes(p.p)?p.p:'P2',
    description:d+'\n\n(Origen: reporte de mantenimiento '+s.num+(s.otNum?' · '+s.otNum:'')+' del '+fmtD(day)+' · '+s.resp+')',sintoma:'',causa:'',actividad:'',obsRec:'',
    parts:p.r?[{np:'',d:p.r,cant:'',med:''}]:[],observationDate:day,scheduledDate:'',cost:0,status:'REGISTRADO',detectedBy:s.resp,source:'Reporte de mantenimiento '+s.num,
    workType:p.r?BK_TYPE[3]:BK_TYPE[0],hoursAt:s.hs,ubic:'',proyecto:s.frente||'',lugarInsp:s.lugar||'',respons:'EMPRESA',rrhh:{},eqSop:[],conFotos:false,
    elab:{name:s.resp,date:day,sig:(s.ejec||{}).sig||''},apr:'PLANNER',log:[{t:'Backlog creado desde el reporte '+s.num+' · enviado al V°B° del planner',ts:Date.now(),by:me?me.name:''}],photosBefore:[],photosAfter:[],closeDate:'',closeTech:'',closeNotes:'',origin:'reporte',stopId:s.id};
}
function openStopView(id){
  const s=sps.find(x=>x.id===id);if(!s)return;const w=stWarn(s),row=(l,v)=>`<div class="flex justify-between gap-3 text-sm border-t border-slate-700" style="padding:.4rem 0"><span class="text-slate-400">${l}</span><span class="text-slate-200" style="text-align:right;white-space:pre-line">${esc(v===''||v==null?'–':v)}</span></div>`;
  const b=backlogs.find(x=>x.id===s.bkRef),open=s.status==='ABIERTA';
  show(`<div class="flex justify-between items-start gap-2"><div><p class="mono text-xs text-slate-400">${esc(s.num||'')}${s.otNum?' · '+esc(s.otNum):''}</p><h3 class="font-bold"><span class="text-amber-400">${esc(s.cod)}</span> · ${esc(s.flota)}</h3><p class="text-xs text-slate-400">${stBadge(s.motivo)} ${open?'<b class="text-red-400">PARADA ABIERTA</b>':''}</p></div><button type="button" onclick="hide()" class="text-slate-400 text-xl">✕</button></div>${w?`<p class="text-xs text-amber-400 mt-2">⚠️ ${esc(w)}</p>`:''}
  <div class="mt-2">${row('Tipo de parada',s.tipo)}${row('Sistema intervenido',(s.sistemas||[]).join(', ')||s.sistema)}${s.comp?row('Componente',s.comp):''}${row('Ejecutado por',s.resp)}${row('Proyecto / frente',s.frente)}${row('Lugar',s.lugar)}${row('Parada',fmtDT(s.fp)+' · '+fmtH(s.hp)+' h')}${row('Salida',open?'En curso':fmtDT(s.fs)+' · '+fmtH(s.hs)+' h')}${row('Tiempo fuera de servicio (h)',s.t)}${s.tEf!==''&&s.tEf!=null?row('Tiempo efectivo / demora (h)',s.tEf+' / '+s.tDem):''}${row('Responsable de la parada',s.rpar)}${row('Responsable de la demora',s.rdem)}${s.estFin?row('Estado final',s.estFin):''}${s.rev&&s.rev.name?row('Revisado por',s.rev.name+' · '+fmtD(s.rev.date)):''}</div>
  ${s.sint?`<h4 class="text-xs text-slate-400 uppercase mt-3 mb-1">Síntoma / falla</h4><p class="text-sm text-slate-200" style="white-space:pre-line">${esc(s.sint)}</p>`:''}
  <h4 class="text-xs text-slate-400 uppercase mt-3 mb-1">Trabajos realizados</h4>${(s.tareas||[]).length?s.tareas.map((x,i)=>`<p class="text-sm text-slate-200">${i+1}. ${esc(x.d)}${x.tec?' <span class="text-slate-400">· '+esc(x.tec)+'</span>':''}${x.hh?' <span class="text-slate-400">· '+esc(x.hh)+' H-H</span>':''}</p>`).join(''):`<p class="text-sm text-slate-200" style="white-space:pre-line">${esc(s.desc||'–')}</p>`}
  ${s.obs?`<h4 class="text-xs text-slate-400 uppercase mt-3 mb-1">Observaciones y pendientes</h4><p class="text-sm text-slate-200" style="white-space:pre-line">${esc(s.obs)}</p>`:''}
  ${(s.photos||[]).length?`<div class="flex flex-wrap gap-2 mt-3">${s.photos.map(p=>`<img src="${esc(p)}" alt="Foto" class="w-24 h-24 object-cover rounded border border-slate-600">`).join('')}</div>`:''}${s.foto?`<p class="text-xs mt-3"><a class="underline text-blue-400" href="${esc(s.foto)}" target="_blank" rel="noopener">📷 Ver evidencia (enlace original)</a></p>`:''}
  <div class="flex justify-end gap-2 mt-4 flex-wrap">${!open?`<button onclick="makePdfRpt('${s.id}')" class="btn bg-slate-700">📄 PDF</button>`:''}${b?`<button onclick="bkDetail('${b.id}')" class="btn bg-slate-700">🔧 Ver backlog</button>`:s.backlogId?`<button onclick="bkDetail('${s.backlogId}')" class="btn bg-slate-700">🔧 Ver backlog</button>`:''}${!open&&isSup()&&!b&&!(s.rev&&s.rev.name)?`<button onclick="rpRev('${s.id}')" class="btn bg-violet-500/20 text-violet-300">✍️ Firmar revisión</button>`:''}${!open&&stCan(s)?`<button onclick="openStop('${s.id}','edit')" class="btn bg-slate-700">✏️ Editar</button>`:''}${open&&stCan(s)?`<button onclick="openStop('${s.id}','close')" class="btn bg-emerald-500 text-slate-950">✅ Cerrar parada</button>`:''}<button onclick="hide()" class="btn bg-slate-700">Cerrar</button></div>`,'40rem');
}
function rpRev(id){
  const s=sps.find(x=>x.id===id);if(!s||!isSup())return;
  if(!mySig()){ask('Para firmar la revisión primero registra tu firma en tu perfil.',openMe,'✍️ Registrar firma','bg-amber-500 text-slate-950');return}
  put('stops',{...s,rev:{name:me.name,pos:me.position||'',date:today(),sig:mySig()}});toast('✔ Revisión firmada');setTimeout(()=>openStopView(id),80);
}

/* ---------- PDF con la estructura de los formatos (sin cajetín) ---------- */
const PDFC={sec:[31,56,100],lab:[221,230,241],bd:[110,120,135],tx:[20,24,33]};
function pdfKit(){
  const J=window.jspdf&&window.jspdf.jsPDF;if(!J){note('No se pudo cargar el generador de PDF. Revisa tu conexión a internet y recarga la página.');return null}
  const doc=new J({unit:'mm',format:'a4'}),W=210,H=297,M=10,CW=W-2*M,FS=7,LH=.42;let y=M;
  const t=s=>String(s==null?'':s).replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[–—]/g,'-').replace(/≤/g,'<=').replace(/≥/g,'>=').replace(/[•·]/g,'-').replace(/[^\x09\x0A\x20-\x7E\xA0-\xFF]/g,'');
  const K={doc,W,M,CW,t};
  K.need=h=>{if(y+h>H-12){doc.addPage();y=M;return true}return false};
  K.gap=h=>{y+=h||2.5};
  K.title=(a,b)=>{doc.setDrawColor(...PDFC.bd);doc.setLineWidth(.3);doc.rect(M,y,CW,10);doc.setFont('helvetica','bold');doc.setFontSize(12.5);doc.setTextColor(...PDFC.sec);doc.text(t(a),W/2,y+6.7,{align:'center'});
    if(b){doc.setFontSize(9);doc.setTextColor(...PDFC.tx);doc.text(t(b),W-M-2,y+6.5,{align:'right'})}y+=12};
  K.sec=(s,min)=>{K.need(min||16);doc.setFillColor(...PDFC.sec);doc.rect(M,y,CW,5.4,'F');doc.setFont('helvetica','bold');doc.setFontSize(7.6);doc.setTextColor(255,255,255);doc.text(t(s),W/2,y+3.75,{align:'center'});y+=5.4};
  // celdas: {v, w (fracción del ancho), lab (etiqueta gris), b (negrita), al ('left'|'center'|'right'), sz, nb (sin borde)}
  K.row=(cells,minH)=>{
    const ws=cells.map(c=>c.w*CW),ln=cells.map((c,i)=>{doc.setFont('helvetica',c.lab||c.b?'bold':'normal');doc.setFontSize(c.sz||FS);return doc.splitTextToSize(t(c.v),Math.max(2,ws[i]-2))});
    const h=Math.max(minH||5,...ln.map((l,i)=>l.length*(cells[i].sz||FS)*LH+1.8));K.need(h);let x=M;
    cells.forEach((c,i)=>{const w=ws[i],fs=c.sz||FS;if(c.lab||c.fill){doc.setFillColor(...(c.fill||PDFC.lab));doc.rect(x,y,w,h,'F')}
      if(!c.nb){doc.setDrawColor(...PDFC.bd);doc.setLineWidth(.2);doc.rect(x,y,w,h)}
      doc.setFont('helvetica',c.lab||c.b?'bold':'normal');doc.setFontSize(fs);doc.setTextColor(...PDFC.tx);
      const al=c.al||'left',lh=fs*LH,ty=c.top?y+1+lh*.8:y+(h-ln[i].length*lh)/2+lh*.78,tx=al==='center'?x+w/2:al==='right'?x+w-1:x+1;
      if(ln[i].length&&ln[i].some(Boolean))doc.text(ln[i],tx,ty,{align:al});x+=w});
    y+=h;return h};
  K.lab=(v,w,al)=>({v,w,lab:true,al:al||'left'});
  K.val=(v,w,al)=>({v:v===''||v==null?'':v,w,al:al||'left'});
  K.chk=(on,w)=>({v:on?'X':'',w,al:'center',b:true,sz:8.5});
  // grupo de opciones en una fila: [etiqueta][casilla] repetido
  K.pairs=(items,sel,lw,cw)=>items.flatMap(it=>{const [v,l]=Array.isArray(it)?it:[it,it];return [{v:l,w:lw,al:'center',sz:6.3},K.chk(Array.isArray(sel)?sel.includes(v):sel===v,cw)]});
  const fit=(src,x,yy,w,h)=>{try{const p=doc.getImageProperties(src),k=Math.min(w/p.width,h/p.height),iw=p.width*k,ih=p.height*k;doc.addImage(src,/^data:image\/png/.test(src)?'PNG':'JPEG',x+(w-iw)/2,yy+(h-ih)/2,iw,ih)}catch(_){}};
  K.sigs=cols=>{
    const n=cols.length,w=CW/n,hH=7,bH=22,rH=5;K.need(hH+bH+2*rH+1);let x=M;
    cols.forEach(c=>{doc.setDrawColor(...PDFC.bd);doc.setLineWidth(.2);doc.setFillColor(...PDFC.lab);doc.rect(x,y,w,hH,'FD');doc.setFont('helvetica','bold');doc.setFontSize(6.8);doc.setTextColor(...PDFC.tx);
      doc.text(doc.splitTextToSize(t(c.h),w-2),x+w/2,y+(hH-(doc.splitTextToSize(t(c.h),w-2).length*6.8*LH))/2+6.8*LH*.78,{align:'center'});
      doc.rect(x,y+hH,w,bH);if(c.sig)fit(c.sig,x+3,y+hH+1.5,w-6,bH-3);
      [['NOMBRE:',c.name],['FECHA:',c.date?fmtD(c.date):'']].forEach(([l,v],j)=>{const yy=y+hH+bH+j*rH;doc.setFillColor(...PDFC.lab);doc.rect(x,yy,w*.28,rH,'FD');doc.rect(x+w*.28,yy,w*.72,rH);doc.setFont('helvetica','bold');doc.setFontSize(6.6);doc.text(l,x+1,yy+3.4);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text(doc.splitTextToSize(t(v||''),w*.72-2)[0]||'',x+w*.28+1,yy+3.4)});
      x+=w});
    y+=hH+bH+2*rH};
  // panel fotográfico: 2 columnas; si hay etiquetas, fila FOTO n | etapa | descripción
  K.photos=(list,lbl)=>{
    const w=CW/2,ih=lbl?58:62,rh=lbl?5:0;
    for(let i=0;i<list.length;i+=2){K.need(ih+rh+.5);[0,1].forEach(j=>{const p=list[i+j],x=M+j*w;if(!p&&j)return;doc.setDrawColor(...PDFC.bd);doc.setLineWidth(.2);doc.rect(x,y,w,ih);if(p)fit(p.src||p,x+2,y+2,w-4,ih-4);
      if(lbl){const yy=y+ih;doc.setFillColor(...PDFC.lab);doc.rect(x,yy,w*.16,rh,'FD');doc.rect(x+w*.16,yy,w*.2,rh);doc.rect(x+w*.36,yy,w*.64,rh);doc.setFont('helvetica','bold');doc.setFontSize(6.6);doc.setTextColor(...PDFC.tx);
        doc.text('FOTO '+(i+j+1),x+w*.08,yy+3.4,{align:'center'});if(p){doc.setFont('helvetica','normal');doc.text(t(p.et||''),x+w*.26,yy+3.4,{align:'center'});doc.text(doc.splitTextToSize(t(p.d||''),w*.64-2)[0]||'',x+w*.36+1,yy+3.4)}}});
      y+=ih+rh}};
  K.out=(name,ttl,ref)=>{const n=doc.getNumberOfPages();for(let p=1;p<=n;p++){doc.setPage(p);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(110,120,135);doc.text(t(ref+'  |  Página '+p+' de '+n),W/2,H-5,{align:'center'})}
    fileOut(doc.output('blob'),String(name).replace(/[^A-Za-z0-9_.-]/g,'_'),ttl)};
  K.pad=(arr,n)=>{const a=[...arr];while(a.length<n)a.push(null);return a};
  return K;
}
const eqPlate=e=>e.plate||e.placa||'';

/* PDF: FORMATO DE BACKLOG (F-MT-21) */
function makePdfBk(id){
  const b=backlogs.find(x=>x.id===id);if(!b)return;const K=pdfKit();if(!K)return;const e=eqOf(b.fleetId),{lab,val,chk}=K;
  K.title('FORMATO DE BACKLOG',bkNo(b));
  K.row([lab('N° Backlog',.14),val(bkNo(b),.19,'center'),lab('Estado',.11),val((BK_ST[b.status]||{}).l||b.status,.22,'center'),lab('N° OT',.11),val(b.ot&&b.ot.num?b.ot.num:'',.23,'center')]);
  K.row([lab('Fecha detección',.14),val(fmtD(b.observationDate),.19,'center'),lab('Ubicación',.11),val(b.ubic||'',.22,'center'),lab('Proyecto',.11),val(b.proyecto||'',.23,'center')]);
  K.row([lab('Responsabilidad',.14),chk(b.respons!=='PROVEEDOR',.04),val('EMPRESA',.15),chk(b.respons==='PROVEEDOR',.04),val('PROVEEDOR',.15),{v:'',w:.48,nb:true}]);
  K.gap();K.sec('DATOS GENERALES');
  K.row([lab('EQUIPO',.2,'center'),lab('FLOTA',.2,'center'),lab('MODELO',.2,'center'),lab('HORÓMETRO',.2,'center'),lab('LUGAR DE INSPECCIÓN',.2,'center')]);
  K.row([val(e.code,.2,'center'),val(e.category||'',.2,'center'),val(((e.brand||'')+' '+(e.model||'')).trim(),.2,'center'),val(b.hoursAt!==''&&b.hoursAt!=null?fmtH(b.hoursAt):'',.2,'center'),val(b.lugarInsp||'',.2,'center')]);
  K.row([lab('PRIORIDAD (Lead time)',.25,'center'),lab('TIPO DE BACKLOG',.25,'center'),lab('EVENTO / EJECUCIÓN',.25,'center'),lab('CONDICIÓN / MODO',.25,'center')]);
  for(let i=0;i<7;i++){const c=[];[[PR_K.map(k=>[k,PR_F[k]]),b.criticality],[BK_TYPE,b.workType],[BK_EVT,b.evento],[BK_CON,b.condicion]].forEach(([L,v])=>{const it=L[i];if(!it){c.push({v:'',w:.25,nb:true});return}const [k,l]=Array.isArray(it)?it:[it,it];c.push(chk(v===k,.035),val(l,.215))});K.row(c,4.6)}
  K.gap();K.sec('DATOS DE LA ACTIVIDAD');
  K.row([lab('COMPONENTE',.34,'center'),lab('SISTEMA',.33,'center'),lab('SUB SISTEMA',.33,'center')]);
  K.row([val(b.component,.34,'center'),val(b.system,.33,'center'),val(b.subsystem||'',.33,'center')]);
  K.row([lab('SÍNTOMA',.34,'center'),lab('CAUSA',.33,'center'),lab('TIPO REPARACIÓN',.33,'center')]);
  K.row([val(b.sintoma||'',.34,'center'),val(b.causa||'',.33,'center'),val(b.tipoRep||'',.33,'center')]);
  K.row([lab('Reporte original (campo)',.2),{...val(b.description,.8),top:1}],10);
  K.row([lab('Actividad realizada (descripción técnica)',.2),{...val(b.actividad||'',.8),top:1}],14);
  K.row([lab('Observaciones / Recomendaciones',.2),{...val(b.obsRec||'',.8),top:1}],10);
  K.gap();K.sec('DATOS DE LOS RECURSOS');
  K.row([lab('TIEMPO ESTIMADO / LUGAR',.34,'center'),lab('RECURSOS HUMANOS',.33,'center'),lab('EQUIPOS SOPORTE',.33,'center')]);
  const rh=b.rrhh||{},tot=BK_HR.reduce((s,k)=>s+(Number(rh[k])||0),0),es=b.eqSop||[];
  const left=[[lab('Duración tarea (h)',.2),val(b.durH,.14,'center')],[lab('HH total',.2),val(b.hh,.14,'center')],[chk((b.lugarEj||'Site')==='Site',.04),val('Site',.13),chk(b.lugarEj==='Externo',.04),val('Externo',.13)]];
  for(let i=0;i<6;i++){const c=[...(left[i]||[{v:'',w:.34,nb:true}])];
    c.push(lab(i<5?BK_HR[i]:'Total personal',.23),val(i<5?(rh[BK_HR[i]]||''):(tot||''),.1,'center'));
    c.push(...(i<5?[chk(es.includes(BK_EQS[i]),.04),val(BK_EQS[i],.29)]:[lab('Otros',.08),val(b.eqOtros||'',.25)]));K.row(c)}
  K.gap();K.sec('SOLICITUD DE PARTES');
  K.row([lab('ÍTEM',.07,'center'),lab('N° PARTE',.2,'center'),lab('DESCRIPCIÓN',.53,'center'),lab('CANT.',.1,'center'),lab('MEDIDA',.1,'center')]);
  K.pad(b.parts||[],6).forEach((p,i)=>K.row([val(i+1,.07,'center'),val(p?p.np:'',.2,'center'),val(p?p.d:'',.53),val(p?p.cant:'',.1,'center'),val(p?p.med:'',.1,'center')]));
  K.gap();K.sec('APROBACIONES',48);
  const el=b.elab||{name:b.detectedBy,date:b.observationDate},vp=b.vbPl||{},vs=b.vbSup||{};
  K.sigs([{h:'Elaborado por (Solicitante)',name:el.name,date:el.date,sig:el.sig},{h:'V°B° Planner de Mantenimiento',name:vp.name,date:vp.date,sig:vp.sig},{h:'V°B° Supervisor de Mantenimiento',name:vs.name,date:vs.date,sig:vs.sig}]);
  const fot=(b.conFotos!==false)?(b.photosBefore||[]):[];
  if(fot.length){K.gap();K.sec('REFERENCIAS, FOTOS, ANEXOS',72);K.photos(fot,false)}
  K.out('Backlog_'+bkNo(b)+'_'+e.code+'.pdf','📄 Backlog listo',bkNo(b)+' - '+e.code);
}

/* PDF: ORDEN DE TRABAJO (F-MT-24) */
function makePdfOt(id){
  const b=backlogs.find(x=>x.id===id);if(!b)return;if(!b.ot||!b.ot.num){makePdfBk(id);return}
  const K=pdfKit();if(!K)return;const e=eqOf(b.fleetId),o=b.ot,{lab,val,chk}=K,sys=o.sis||[],mot=o.mot||[];
  K.title('ORDEN DE TRABAJO',o.num);
  K.sec('1. DATOS GENERALES');
  K.row([lab('N° PARADA',.13),val(o.parada||'',.16,'center'),lab('N° OT',.08),val(o.num,.14,'center'),lab('FECHA EMISIÓN',.12),val(fmtD(o.date),.15,'center'),lab('TURNO',.08),val(o.turno||'',.14,'center')]);
  K.row([lab('CÓDIGO EQUIPO',.13),val(e.code,.16),lab('FLOTA / TIPO',.12),val(String(e.category||'').toUpperCase(),.25),lab('MARCA',.1),val(e.brand,.24)]);
  K.row([lab('MODELO',.13),val(e.model,.16),lab('N° SERIE',.12),val(e.serialNumber||'',.25),lab('PLACA',.1),val(eqPlate(e),.24)]);
  K.row([lab('PROVEEDOR / CONTRATISTA',.13),val(o.prov||'',.28),lab('PROYECTO / FRENTE',.15),val(o.proy||'',.44)]);
  K.gap();K.sec('2. DATOS DE LA PARADA');
  K.row([lab('FECHA Y HORA DE PARADA',.25),val(fxDT(o.fp),.2,'center'),{v:'',w:.55,nb:true}]);
  K.row([lab('HORÓMETRO / KM ACTUAL',.25),val(o.hp!==''&&o.hp!=null?fmtH(o.hp):'',.2,'center'),{v:'',w:.55,nb:true}]);
  K.row([lab('TIPO DE PARADA',.25),...K.pairs(['PLANIFICADA','NO PLANIFICADA'],o.tipoPar,.16,.04),{v:'',w:.35,nb:true}]);
  K.row([lab('LUGAR DE INTERVENCIÓN',.25),val(o.lugar||o.place||'',.2,'center'),lab('ESTADO DEL EQUIPO AL PARAR',.25),val(o.estEq||'',.3,'center')]);
  K.gap();K.sec('3. MOTIVO DE PARADA  (marcar con "X")');
  K.row(K.pairs(FX_MOT.slice(0,7),mot,.1028,.04));
  K.row(K.pairs([['MCI','CORRECTIVO INMEDIATO (MCI)'],['MCP','CORRECTIVO PROG. (MCP)'],['PREDICTIVO','PREDICTIVO'],['MEJORATIVO','MEJORATIVO'],['CAMPANA','CAMPAÑA']],mot,.16,.04));
  K.row([lab('OTRO:',.12),val(o.motOtro||'',.88)]);
  K.gap();K.sec('4. DESCRIPCIÓN DE LA FALLA  (en caso de MCI, MCP, predictivo o mejorativo)');
  K.row([lab('SÍNTOMA / FALLA REPORTADA',.2),{...val(o.sint||'',.8),top:1}],9);
  K.row([lab('REPORTADO POR',.2),val(o.repPor||'',.3),lab('CÓDIGO DE ALARMA / FALLA',.2),val(o.alarma||'',.3)]);
  K.row([{v:'SISTEMA AFECTADO  (marcar con "X")',w:1,lab:true,al:'center'}]);
  for(let i=0;i<20;i+=4)K.row(K.pairs(FX_SIS_OT.slice(i,i+4),sys,.21,.04));
  K.row([lab('OTRO:',.1),val(o.sisOtro||'',.4),lab('COMPONENTE',.15),val(o.comp||'',.35)]);
  K.gap();K.sec('5. RECURSOS REQUERIDOS');
  const pr=o.pers||{},ap=o.apo||[];
  K.row([lab('PERSONAL / ESPECIALIDAD',.3,'center'),lab('CANT.',.12,'center'),lab('EQUIPOS / HERRAMIENTAS DE APOYO  (marcar con "X")',.58,'center')]);
  for(let i=0;i<4;i++)K.row([val(OT_PERS[i],.3),val(pr[OT_PERS[i]]||'',.12,'center'),...K.pairs(OT_APO.slice(i*2,i*2+2),ap,.25,.04)]);
  K.row([lab('OTRO:',.1),val(o.persOtro||'',.2),val(o.persOtroC||'',.12,'center'),lab('OTRO:',.1),val(o.apoOtro||'',.48)]);
  K.gap();K.sec('6. TAREAS A EJECUTAR (ADICIONALES AL PROGRAMA)');
  K.row([lab('ITEM',.06,'center'),lab('DESCRIPCIÓN DE LA TAREA',.52,'center'),lab('RESPONSABLE',.17,'center'),lab('H ESTIM.',.1,'center'),lab('ESTADO',.15,'center')]);
  K.pad(o.tareas||[],8).forEach((r,i)=>K.row([val(i+1,.06,'center'),val(r?r.d:'',.52),val(r?r.r:'',.17,'center'),val(r?r.h:'',.1,'center'),val(r?r.e:'',.15,'center')]));
  K.gap();K.sec('8. REPUESTOS Y MATERIALES A UTILIZAR');
  K.row([lab('ITEM',.06,'center'),lab('CÓDIGO / N° PARTE',.16,'center'),lab('DESCRIPCIÓN',.38,'center'),lab('CANT.',.08,'center'),lab('UND',.08,'center'),lab('¿EN STOCK?',.11,'center'),lab('N° REQ.',.13,'center')]);
  K.pad(o.reps||[],5).forEach((r,i)=>K.row([val(i+1,.06,'center'),val(r?r.c:'',.16,'center'),val(r?r.d:'',.38),val(r?r.q:'',.08,'center'),val(r?r.u:'',.08,'center'),val(r?r.s:'',.11,'center'),val(r?r.rq:'',.13,'center')]));
  K.gap();K.sec('9. RECOMENDACIONES TÉCNICAS');
  K.row([lab('ITEM',.06,'center'),lab('RECOMENDACIÓN',.74,'center'),lab('PRIORIDAD',.2,'center')]);
  K.pad(o.recs||[],4).forEach((r,i)=>K.row([val(i+1,.06,'center'),val(r?r.d:'',.74),val(r?(PR_L[r.p]||r.p):'',.2,'center')]));
  K.gap();K.sec('10. CONFORMIDAD',48);
  const done=bkClosed(b);
  K.sigs([{h:'ELABORADO POR (PLANNER / SUPERVISOR)',name:o.by,date:o.byDate||o.date,sig:o.bySig},{h:'RESPONSABLE DE EJECUCIÓN',name:otTech(o),date:done?b.closeDate:'',sig:done?b.closeSignature:''},{h:'V°B° JEFE DE MANTENIMIENTO',name:o.jefe||(b.supName||''),date:b.supName?b.supDate:'',sig:b.supName&&(!o.jefe||o.jefe===b.supName)?b.supSignature:''}]);
  const fot=o.conFotos?(o.fotos||[]):[];
  if(fot.length){K.gap();K.sec('11. PANEL FOTOGRÁFICO',72);K.row([{v:'Fotos de la intervención indicando si es ANTES, DURANTE o DESPUÉS y lo que se observa.',w:1,al:'center',sz:6.5}]);K.photos(fot,true)}
  K.out(o.num+'_'+e.code+'.pdf','📄 Orden de trabajo lista',o.num+' - '+e.code);
}
function makePdf(id){const b=backlogs.find(x=>x.id===id);if(b&&b.ot&&b.ot.num)makePdfOt(id);else makePdfBk(id)}

/* PDF: REPORTE DE MANTENIMIENTO (F-MT-25) */
function makePdfRpt(id){
  const s=sps.find(x=>x.id===id);if(!s)return;if(s.status==='ABIERTA'){note('La parada sigue abierta. Ciérrala para generar el reporte de mantenimiento.');return}
  const K=pdfKit();if(!K)return;const e=fleet.find(x=>x.id===s.fleetId)||{code:s.cod,category:s.flota},{lab,val,chk}=K,b=backlogs.find(x=>x.id===s.bkRef);
  const sys=s.sistemas||(s.sistema?[s.sistema]:[]),cs=s.causas||[],pr=s.pruebas||[],dH=s.hs!==''&&s.hp!==''&&s.hs!=null?Math.round((Number(s.hs)-Number(s.hp))*100)/100:'';
  K.title(s.fmt==='RD'?'REGISTRO DE INTERVENCIÓN DIARIA':'REPORTE DE MANTENIMIENTO',s.num||'');
  K.sec('1. DATOS GENERALES DEL EQUIPO');
  K.row([lab('N° REPORTE',.13),val(s.num||'',.14,'center'),lab('N° OT',.08),val(s.otNum||'',.14,'center'),lab('FECHA',.08),val(fmtD((s.fs||s.fp||'').slice(0,10)),.15,'center'),lab('TURNO',.08),val(s.turno||'',.2,'center')]);
  K.row([lab('CÓDIGO EQUIPO',.13),val(e.code,.14),lab('FLOTA / TIPO',.12),val(s.flota||String(e.category||'').toUpperCase(),.27),lab('MARCA',.1),val(e.brand||'',.24)]);
  K.row([lab('MODELO',.13),val(e.model||'',.14),lab('N° SERIE',.12),val(e.serialNumber||'',.27),lab('PLACA',.1),val(eqPlate(e),.24)]);
  K.row([lab('PROYECTO / CLIENTE',.13),val(s.frente||'',.4),lab('LUGAR DE INTERV.',.14),val(s.lugar||'',.33)]);
  K.gap();K.sec('2. CONTROL DE TIEMPOS Y DISPONIBILIDAD');
  K.row([lab('INICIO DE INTERVENCIÓN',.5,'center'),lab('FIN DE INTERVENCIÓN (ENTREGA A OPERACIONES)',.5,'center')]);
  K.row([lab('FECHA Y HORA DE PARADA',.25),val(fxDT(s.fp),.25,'center'),lab('FECHA Y HORA DE SALIDA',.25),val(fxDT(s.fs),.25,'center')]);
  K.row([lab('HORÓMETRO / KM INICIAL',.25),val(fmtH(s.hp),.25,'center'),lab('HORÓMETRO / KM FINAL',.25),val(fmtH(s.hs),.25,'center')]);
  K.row([lab('TIEMPO TOTAL FUERA DE SERVICIO (h)',.2),val(s.t,.1,'center'),lab('TIEMPO EFECTIVO DE REPARACIÓN (h)',.2),val(s.tEf??'',.1,'center'),lab('TIEMPO DE DEMORA / ESPERA (h)',.24),val(s.tDem??'',.16,'center')]);
  K.row([lab('DIF. HORÓMETRO / KM (prueba)',.2),val(dH,.1,'center'),lab('PRÓXIMO MP A (horóm./km)',.2),val(s.proxMp!==''&&s.proxMp!=null?fmtH(s.proxMp):'',.1,'center'),lab('TIPO PRÓXIMO MP',.24),val(s.proxTipo||'',.16,'center')]);
  K.gap();K.sec('3. CLASIFICACIÓN DE LA INTERVENCIÓN  (marcar con "X")');
  K.row([lab('TIPO DE PARADA',.16),...K.pairs(['PLANIFICADA','NO PLANIFICADA'],s.tipo,.18,.04),{v:'',w:.4,nb:true}]);
  K.row([lab('MOTIVO DE PARADA',.16),...K.pairs([['PM1','MP1'],['PM2','MP2'],['PM3','MP3'],['PM4','MP4'],['ENGRASE','LUBRICACIÓN'],['INSPECCION','INSPECCIÓN']],s.motivo,.1,.04)]);
  K.row([{v:'',w:.16,lab:true},...K.pairs([['MCI','CORRECTIVO IMPREVISTO (MCI)'],['MCP','CORRECTIVO PROGRAM. (MCP)'],['PREDICTIVO','PREDICTIVO'],['MEJORATIVO','MEJORATIVO']],s.motivo,.17,.04)]);
  K.row([{v:'',w:.16,lab:true},...K.pairs([['BACKLOG','BACKLOG'],['CAMPANA','CAMPAÑA / BOLETÍN']],s.motivo,.17,.04),lab('OTRO:',.08),val(s.motivo==='OTROS'?(s.motOtro||'OTRO'):(s.motOtro||''),.34)]);
  K.gap();K.sec('4. SISTEMA INTERVENIDO  (marcar con "X")');
  for(let i=0;i<20;i+=4)K.row(K.pairs(FX_SIS_RP.slice(i,i+4),sys,.21,.04));
  K.row([lab('OTRO:',.1),val(s.sisOtro||(sys.length?'':s.sistema||''),.4),lab('COMPONENTE',.15),val(s.comp||'',.35)]);
  K.gap();K.sec('5. ANÁLISIS DE FALLA  (obligatorio en correctivos MCI / MCP)');
  K.row([lab('SÍNTOMA / FALLA REPORTADA',.25),val(s.sint||'',.75)]);
  K.row([lab('MODO DE FALLA ENCONTRADO',.25),val(s.modo||'',.75)]);
  K.row([lab('CAUSA RAÍZ',.25),...K.pairs(RP_CAUSA.slice(0,4),cs,.1475,.04)]);
  K.row([{v:'',w:.25,lab:true},...K.pairs(RP_CAUSA.slice(4,7),cs,.1475,.04),{v:'OTRO: '+(s.causaOtro||''),w:.1475,al:'center',sz:6.3},K.chk(cs.includes('OTRO')||!!s.causaOtro,.04)]);
  K.row([lab('ACCIÓN PARA EVITAR RECURRENCIA',.25),val(s.accion||'',.75)]);
  K.gap();K.sec('6. RESPONSABILIDAD DE LA PARADA Y DE LA DEMORA  (marcar con "X")');
  const inL=(L,v)=>L.includes(v)?v:(v?'OTRO':'');
  K.row([lab('RESP. DE LA PARADA',.16),...K.pairs(RP_PAR.map(x=>[x,x==='OTRO'&&!RP_PAR.includes(s.rpar)&&s.rpar?'OTRO: '+s.rpar:x]),inL(RP_PAR,s.rpar),.128,.04)]);
  K.row([lab('RESP. DE LA DEMORA',.16),...K.pairs(RP_DEM.map(x=>[x,x==='OTRO'&&!RP_DEM.includes(s.rdem)&&s.rdem?'OTRO: '+s.rdem:(RP_DEM_L[x]||x)]),inL(RP_DEM,s.rdem),.128,.04)]);
  K.row([lab('MOTIVO DE DEMORA',.16),val(s.motDem||'',.84)],7);
  K.gap();K.sec('7. DETALLE DE TRABAJOS REALIZADOS');
  K.row([lab('ITEM',.06,'center'),lab('DESCRIPCIÓN DE LA TAREA (qué se hizo, dónde y con qué resultado)',.6,'center'),lab('TÉCNICO',.22,'center'),lab('H-H',.12,'center')]);
  const tar=(s.tareas&&s.tareas.length)?s.tareas:(s.desc?[{d:s.desc,tec:s.resp,hh:''}]:[]);
  K.pad(tar,8).forEach((r,i)=>K.row([val(i+1,.06,'center'),val(r?r.d:'',.6),val(r?r.tec:'',.22,'center'),val(r?r.hh:'',.12,'center')]));
  K.gap();K.sec('9. PRUEBAS, VERIFICACIÓN Y LIBERACIÓN DEL EQUIPO  (marcar con "X")');
  for(let i=0;i<9;i+=3)K.row(K.pairs(RP_PRU.slice(i,i+3),pr,.2933,.04));
  K.row([lab('ESTADO FINAL DEL EQUIPO',.16),...K.pairs(FX_EQST,s.estFin,.24,.04)]);
  K.gap();K.sec('10. OBSERVACIONES Y TRABAJOS PENDIENTES (BACKLOG)');
  K.row([lab('ITEM',.06,'center'),lab('OBSERVACIÓN / TRABAJO PENDIENTE',.54,'center'),lab('PRIORIDAD',.14,'center'),lab('REPUESTO REQUERIDO',.26,'center')]);
  const pd=(s.pend&&s.pend.length)?s.pend:(s.obs?[{d:s.obs}]:[]);
  K.pad(pd,4).forEach((r,i)=>K.row([val(i+1,.06,'center'),val(r?r.d:'',.54),val(r?(PR_L[r.p]||r.p||''):'',.14,'center'),val(r?r.r:'',.26)]));
  K.gap();K.sec('11. CONFORMIDAD',48);
  const ej=s.ejec||{name:s.resp,date:(s.fs||'').slice(0,10)},rv=s.rev&&s.rev.name?s.rev:(b&&b.supName?{name:b.supName,date:b.supDate,sig:b.supSignature}:{});
  K.sigs([{h:'EJECUTADO POR (TÉCNICO LIDER)',name:ej.name||s.resp,date:ej.date,sig:ej.sig},{h:'REVISADO POR (SUPERVISOR / JEFE MANTTO.)',name:rv.name,date:rv.date,sig:rv.sig}]);
  const fot=s.conFotos!==false?(s.fotos&&s.fotos.length?s.fotos:(s.photos||[]).map(x=>({src:x,et:'',d:''}))):[];
  if(fot.length){K.gap();K.sec('PANEL FOTOGRÁFICO',72);K.photos(fot,true)}
  K.out((s.num||'Reporte')+'_'+e.code+'.pdf','📄 Reporte de mantenimiento listo',(s.num||'Reporte')+' - '+e.code);
}

/* ---------- Tema: fondo blanco / oscuro ---------- */
const isLight=()=>document.documentElement.classList.contains('light');
function themeToggle(){
  const on=!isLight();document.documentElement.classList.toggle('light',on);
  try{localStorage.setItem('theme',on?'light':'dark')}catch(_){}
  const m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',on?'#ffffff':'#0F2A44');
  if(me)applyRole();render();eqnPing('theme');
}
