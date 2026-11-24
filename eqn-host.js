/* ============ ENGRASE Y NEUMÁTICOS (módulo integrado en eqn/) ============
   El módulo corre en un marco dentro de Mantify, con la misma sesión y la misma
   base de datos. Se carga en segundo plano al entrar, para que el inicio, los
   pendientes y la ficha del equipo muestren su estado. */
window.MANTIFY={get me(){return me},get fleet(){return fleet},get grease(){return grs},get tires(){return trs},isSup:()=>isSup(),isAdmin:()=>isAdmin()};
window.EQN_SUM=null;
let eqnRoute=null,eqnBootT=null,eqnSumT=null,eqnErr='';
const eqnFrame=()=>document.getElementById('eqn-frame');
const eqnWin=()=>{try{const f=eqnFrame();return f&&f.contentWindow&&f.contentWindow.EQ&&f.contentWindow.__EQ_READY?f.contentWindow:null}catch(_){return null}};
function eqnBoot(){
  if(!me||me.uid==='local'||!db)return;
  const f=eqnFrame();if(!f||f.getAttribute('src'))return;
  f.setAttribute('src','eqn/index.html'+(eqnRoute?'#/'+eqnRoute:''));
}
function eqnBootSoon(){clearTimeout(eqnBootT);eqnBootT=setTimeout(eqnBoot,1200)}
function eqnStop(){const f=eqnFrame();if(f){f.removeAttribute('src');try{f.contentWindow.location.replace('about:blank')}catch(_){}}window.EQN_SUM=null;eqnRoute=null}
// el módulo avisa cuando cambian sus datos
window.eqnSummary=(sum,err)=>{
  if(err){eqnErr=err;window.EQN_SUM=null}else{eqnErr='';window.EQN_SUM=sum}
  clearTimeout(eqnSumT);eqnSumT=setTimeout(()=>{if(cur!=='gr'&&cur!=='tr')render()},300);
};
function eqnPing(fn){const w=eqnWin();if(!w)return;try{if(fn==='theme')w.EQ.Bridge.theme();else w.EQ.Bridge[fn]()}catch(e){console.warn(e)}}
function eqnSize(){
  const h=document.getElementById('eqn-host');if(!h||h.classList.contains('hidden'))return;
  const top=h.getBoundingClientRect().top+window.scrollY,nav=document.getElementById('nav'),mob=matchMedia('(max-width:639px)').matches;
  const bottom=mob&&nav?nav.getBoundingClientRect().height:0;
  eqnFrame().style.height=Math.max(360,window.innerHeight-top-bottom-10)+'px';
}
addEventListener('resize',eqnSize);
function eqnTab(t){
  const on=t==='gr'||t==='tr',h=document.getElementById('eqn-host');if(!h)return;
  h.classList.toggle('hidden',!on);document.querySelector('main').classList.toggle('eqn-wide',on);
  if(!on)return;
  const route=t==='tr'?'neumaticos':'engrase';
  eqnShow(route);
}
function eqnShow(route,code){
  eqnRoute=route;const f=eqnFrame();
  if(!f.getAttribute('src'))eqnBoot();
  const w=eqnWin();
  if(w){try{w.EQ.Bridge.open(route,code)}catch(e){console.warn(e)}}
  else if(f.getAttribute('src')){ // aún cargando: se abre la vista cuando esté listo
    let n=0;const iv=setInterval(()=>{const x=eqnWin();if(x){clearInterval(iv);try{x.EQ.Bridge.open(eqnRoute,code)}catch(_){}}else if(++n>80)clearInterval(iv)},250);
  }
  $('eqn-err').classList.toggle('hidden',!eqnErr);$('eqn-err').textContent=eqnErr?'⚠️ '+eqnErr:'';
  setTimeout(eqnSize,30);
}
// abre una vista del módulo (opcionalmente con un equipo) desde cualquier parte de Mantify
function eqnOpen(route,code){
  const t=route==='neumaticos'?'tr':'gr';
  if(cur!==t)tab(t);
  eqnShow(route,code);
}
function renderGr(){eqnSize()}
function renderTr(){eqnSize()}
