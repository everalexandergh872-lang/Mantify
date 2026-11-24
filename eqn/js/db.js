/* =========================================================================
   CAPA DE DATOS – Firestore compartido con Mantify (caché en memoria)
   Misma interfaz que la versión local (EQ.DB.put / bulkPut / del / loadAll…),
   pero los datos viven en la nube y se comparten en tiempo real entre todo
   el personal.

   Organización en Firestore (para no gastar lecturas):
   - Cada almacén es una colección "eqn_<almacén>".
   - Los registros se agrupan en documentos "cubeta" (por día, mes o hash),
     en el mapa r.<id> = JSON del registro. Así se lee un documento por día
     o por mes, y no uno por registro.
   - Las fotos se guardan aparte en "eqn_fotos" y en el registro queda la
     referencia "fx:<id>" (las <img> se resuelven solas, ver EQ.Fotos).
   ========================================================================= */
(function () {
  const STORES = {
    equipos: ['codigo'],
    horometros: ['equipoId'],
    puntos: ['equipoId'],
    engrases: ['equipoId', 'puntoId', 'intervencionId'],
    neumaticos: ['codigo', 'equipoId'],
    inspecciones: ['neumaticoId', 'equipoId', 'sesionId'],
    movimientos: ['neumaticoId', 'equipoId'],
    alertasAtendidas: [],
    engrasesDiarios: ['equipoId', 'fecha'],
    programas: ['mes', 'equipoId'],
    config: [],
    auditoria: ['entidad'],
    migracion: []
  };
  const NO_AUDIT = ['auditoria', 'horometros', 'programas', 'migracion'];
  const S = {}; // caché en memoria
  Object.keys(STORES).forEach(k => S[k] = []);
  const meta = { rev: 0 };
  const COL = s => 'eqn_' + s;
  const MAX_BYTES = 650000, MAX_N = 1200; // límites por cubeta (Firestore admite 1 MB por documento)

  let fb = null, fs = null, user = null;
  const buckets = {};   // store -> Map(bucketId -> Map(id -> obj))
  const sizes = {};     // store -> Map(bucketId -> {b, n})
  const loc = {};       // store -> Map(id -> bucketId)
  Object.keys(STORES).forEach(k => { buckets[k] = new Map(); sizes[k] = new Map(); loc[k] = new Map(); });

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  function nowISO() { return new Date().toISOString(); }
  function hashStr(str) { // cyrb53
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  const fechaDe = o => String(o.fecha || o.mes || '').slice(0, 10);
  function baseBucket(store, o) {
    const f = fechaDe(o);
    switch (store) {
      case 'config': return 'main';
      case 'engrases': case 'auditoria': return /^\d{4}-\d{2}-\d{2}$/.test(f) ? 'd' + f : 'd0000';
      case 'engrasesDiarios': case 'horometros': case 'movimientos': case 'inspecciones': case 'programas':
        return /^\d{4}-\d{2}/.test(f) ? 'm' + f.slice(0, 7) : 'm0000';
      default: return 'h' + (parseInt(hashStr(String(o.id)).slice(-4), 36) % 8);
    }
  }
  function pickBucket(store, o, len) {
    const cur = loc[store].get(o.id);
    const base = baseBucket(store, o);
    // si el registro ya está en una cubeta de la misma familia, se queda ahí
    if (cur && (cur === base || cur.startsWith(base + '~'))) return cur;
    for (let i = 1; i < 50; i++) {
      const b = i === 1 ? base : base + '~' + i;
      const sz = sizes[store].get(b) || { b: 0, n: 0 };
      if (sz.b + len < MAX_BYTES && sz.n < MAX_N) return b;
    }
    return base + '~' + Date.now().toString(36);
  }

  // ---------- Fotos ----------
  const Fotos = { cache: new Map(), saved: new Set(), pend: new Map() };
  const isData = v => typeof v === 'string' && v.startsWith('data:image');
  function extraerFotos(v) {
    if (isData(v)) {
      const id = 'f' + hashStr(v) + v.length.toString(36);
      Fotos.cache.set(id, v);
      if (!Fotos.saved.has(id)) {
        Fotos.saved.add(id);
        if (v.length > 1000000) { toastErr('Una foto es demasiado grande y no se pudo guardar.'); return ''; }
        fs.collection('eqn_fotos').doc(id).set({ d: v, at: Date.now(), by: user ? user.uid : '' }).catch(e => { Fotos.saved.delete(id); errorEscritura(e); });
      }
      return 'fx:' + id;
    }
    if (Array.isArray(v)) return v.map(extraerFotos);
    if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach(k => o[k] = extraerFotos(v[k])); return o; }
    return v;
  }
  Fotos.get = id => {
    if (Fotos.cache.has(id)) return Promise.resolve(Fotos.cache.get(id));
    if (!Fotos.pend.has(id)) Fotos.pend.set(id, fs.collection('eqn_fotos').doc(id).get().then(d => { const v = d.exists ? d.data().d : ''; Fotos.cache.set(id, v); return v; }).catch(() => ''));
    return Fotos.pend.get(id);
  };
  Fotos.resolve = async v => (typeof v === 'string' && v.startsWith('fx:')) ? await Fotos.get(v.slice(3)) : v;
  // Cualquier <img src="fx:…"> que aparezca en pantalla se reemplaza por la foto real
  function fixImg(img) {
    const s = img.getAttribute('src') || '';
    if (!s.startsWith('fx:')) return;
    img.setAttribute('data-fx', s); img.removeAttribute('src');
    Fotos.get(s.slice(3)).then(d => { if (d) img.src = d; else img.alt = 'Foto no disponible'; });
  }
  function watchImgs() {
    const scan = root => { if (root.tagName === 'IMG') fixImg(root); else if (root.querySelectorAll) root.querySelectorAll('img[src^="fx:"]').forEach(fixImg); };
    new MutationObserver(ms => ms.forEach(m => { if (m.type === 'attributes') fixImg(m.target); else m.addedNodes.forEach(n => n.nodeType === 1 && scan(n)); }))
      .observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  }

  // ---------- Errores ----------
  function toastErr(msg) { try { EQ.U.toast(msg, 'bad'); } catch (e) { console.error(msg); } }
  let lastErr = 0;
  function errorEscritura(e) {
    console.error(e);
    if (Date.now() - lastErr < 4000) return; lastErr = Date.now();
    toastErr(e && e.code === 'permission-denied' ? 'No tienes permiso para este cambio (solo supervisor o planner). No se guardó.' : 'No se pudo guardar en la nube: ' + (e && e.message || e));
  }

  // ---------- Conexión ----------
  function host() { try { return window.parent !== window && window.parent.firebase ? window.parent : null; } catch (e) { return null; } }
  async function open() {
    const P = host();
    fb = P ? P.firebase : window.firebase;
    if (!fb || !fb.apps || !fb.apps.length) throw new Error('Abre este módulo desde Mantify (Engrase o Neumáticos).');
    fs = fb.firestore();
    user = fb.auth().currentUser;
    if (!user) user = await new Promise(res => { const t = setTimeout(() => res(null), 15000); const un = fb.auth().onAuthStateChanged(u => { if (u) { clearTimeout(t); un(); res(u); } }); });
    if (!user) throw new Error('Inicia sesión en Mantify para usar este módulo.');
    watchImgs();
    return true;
  }

  let refreshT = null;
  function scheduleRefresh() {
    clearTimeout(refreshT);
    refreshT = setTimeout(() => {
      const busy = document.querySelector('#modalRoot .modal-bg, #modalRoot > *') || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));
      if (busy || !EQ.App || !window.__EQ_READY) { scheduleRefresh(); return; }
      try { EQ.App.refresh(); } catch (e) { console.error(e); }
    }, 700);
  }
  function rebuild(store) {
    const out = [];
    buckets[store].forEach(m => m.forEach(o => out.push(o)));
    S[store] = out;
  }
  function loadAll() {
    return new Promise((resolve, reject) => {
      const pending = new Set(Object.keys(STORES));
      Object.keys(STORES).forEach(store => {
        fs.collection(COL(store)).onSnapshot({ includeMetadataChanges: false }, snap => {
          snap.docChanges().forEach(ch => {
            const bid = ch.doc.id;
            if (ch.type === 'removed') {
              const old = buckets[store].get(bid);
              if (old) old.forEach((_, id) => { if (loc[store].get(id) === bid) loc[store].delete(id); });
              buckets[store].delete(bid); sizes[store].delete(bid); return;
            }
            const r = (ch.doc.data() || {}).r || {};
            const m = new Map(); let b = 0;
            Object.keys(r).forEach(id => {
              const js = r[id]; if (typeof js !== 'string') return;
              try { const o = JSON.parse(js); o.id = o.id || id; m.set(id, o); b += js.length; loc[store].set(id, bid); } catch (e) { }
            });
            // registros que salieron de esta cubeta
            const old = buckets[store].get(bid);
            if (old) old.forEach((_, id) => { if (!m.has(id) && loc[store].get(id) === bid) loc[store].delete(id); });
            buckets[store].set(bid, m); sizes[store].set(bid, { b, n: m.size });
          });
          // un registro movido de cubeta puede figurar en dos: manda la ubicación conocida
          buckets[store].forEach((m, bid) => m.forEach((_, id) => { if (loc[store].get(id) !== bid) m.delete(id); }));
          rebuild(store);
          meta.rev++;
          if (pending.has(store)) { pending.delete(store); if (!pending.size) resolve(); }
          else if (!snap.metadata.hasPendingWrites) scheduleRefresh();
        }, err => {
          console.error('eqn_' + store, err);
          if (pending.has(store)) reject(new Error(err.code === 'permission-denied' ? 'Faltan las reglas de Firestore del módulo de Engrase y Neumáticos (o tu usuario no está activo).' : (err.message || String(err))));
        });
      });
    });
  }

  // ---------- Escritura ----------
  function stage(store, clean) {
    const js = JSON.stringify(clean);
    if (js.length > MAX_BYTES) throw new Error('El registro es demasiado grande para guardarse (' + Math.round(js.length / 1024) + ' KB).');
    const prev = loc[store].get(clean.id);
    const bid = pickBucket(store, clean, js.length);
    // caché local inmediata
    if (prev && prev !== bid) { const pm = buckets[store].get(prev); if (pm) pm.delete(clean.id); }
    if (!buckets[store].has(bid)) buckets[store].set(bid, new Map());
    buckets[store].get(bid).set(clean.id, clean);
    loc[store].set(clean.id, bid);
    const sz = sizes[store].get(bid) || { b: 0, n: 0 }; sizes[store].set(bid, { b: sz.b + js.length, n: sz.n + 1 });
    return { bid, prev: prev && prev !== bid ? prev : null, js };
  }
  function prepare(obj) { return extraerFotos(JSON.parse(JSON.stringify(obj))); }
  const FP = (id) => new fb.firestore.FieldPath('r', id);
  const DEL = () => fb.firestore.FieldValue.delete();
  function remoteSet(store, bid, entries) { // entries: {id: js}
    return fs.collection(COL(store)).doc(bid).set({ r: entries, u: Date.now(), by: user.uid }, { merge: true }).catch(errorEscritura);
  }
  function remoteDel(store, bid, id) {
    return fs.collection(COL(store)).doc(bid).update(FP(id), DEL(), 'u', Date.now()).catch(e => { if (e && e.code !== 'not-found') errorEscritura(e); });
  }

  function summarize(obj) {
    const o = {};
    Object.entries(obj || {}).forEach(([k, v]) => {
      if (typeof v === 'string' && (v.startsWith('data:') || v.startsWith('fx:'))) o[k] = '[imagen]';
      else if (Array.isArray(v) && v.some(x => typeof x === 'string' && (x.startsWith('data:') || x.startsWith('fx:')))) o[k] = '[imágenes]';
      else o[k] = v;
    });
    return o;
  }
  function diff(before, after) {
    const changes = [];
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    keys.forEach(k => {
      if (['actualizado', 'creado', 'por'].includes(k)) return;
      const a = JSON.stringify(summarize({ x: (before || {})[k] }).x);
      const b = JSON.stringify(summarize({ x: (after || {})[k] }).x);
      if (a !== b) changes.push(`${k}: ${a === undefined ? '—' : a} → ${b === undefined ? '—' : b}`);
    });
    return changes;
  }
  function quien() { try { const m = host() && host().MANTIFY && host().MANTIFY.me; return m ? m.name : (user && (user.displayName || user.email)) || ''; } catch (e) { return ''; } }

  async function audit(entidad, entidadId, accion, detalle, motivo) {
    const rec = { id: uid(), fecha: nowISO(), entidad, entidadId, accion, detalle: detalle || '', motivo: motivo || '', usuario: quien() };
    try { const st = stage('auditoria', rec); rebuild('auditoria'); remoteSet('auditoria', st.bid, { [rec.id]: st.js }); } catch (e) { console.error(e); }
  }

  async function put(store, obj, opts = {}) {
    meta.rev++;
    if (!obj.id) obj.id = uid();
    const idx = S[store].findIndex(x => x.id === obj.id);
    const before = idx >= 0 ? S[store][idx] : null;
    obj.actualizado = nowISO();
    if (!obj.creado) obj.creado = before && before.creado ? before.creado : obj.actualizado;
    obj.por = quien();
    const clean = prepare(obj);
    const st = stage(store, clean);
    rebuild(store);
    if (st.prev) remoteDel(store, st.prev, clean.id);
    remoteSet(store, st.bid, { [clean.id]: st.js });
    if (!NO_AUDIT.includes(store) && !opts.noAudit) {
      const ch = before ? diff(before, clean) : [];
      if (!before || ch.length) await audit(store, clean.id, before ? 'Modificación' : 'Creación', before ? ch.join(' | ').slice(0, 1500) : label(store, clean), opts.motivo);
    }
    return clean;
  }

  async function bulkPut(store, arr, opts = {}) {
    meta.rev++;
    const ts = nowISO(), por = quien();
    const groups = {}, dels = [];
    for (const o of arr) {
      if (!o.id) o.id = uid();
      o.actualizado = ts; if (!o.creado) o.creado = ts; o.por = por;
      const clean = prepare(o);
      const st = stage(store, clean);
      (groups[st.bid] = groups[st.bid] || {})[clean.id] = st.js;
      if (st.prev) dels.push([st.prev, clean.id]);
    }
    rebuild(store);
    dels.forEach(([b, id]) => remoteDel(store, b, id));
    // en tandas para no pasar el límite de 1 MB por escritura
    for (const [bid, entries] of Object.entries(groups)) {
      let chunk = {}, bytes = 0;
      for (const [id, js] of Object.entries(entries)) {
        if (bytes + js.length > 800000) { remoteSet(store, bid, chunk); chunk = {}; bytes = 0; }
        chunk[id] = js; bytes += js.length;
      }
      if (Object.keys(chunk).length) remoteSet(store, bid, chunk);
    }
    if (!opts.noAudit) await audit(store, '*', 'Carga masiva', `${arr.length} registros`, opts.motivo);
  }

  async function del(store, id, opts = {}) {
    meta.rev++;
    const before = S[store].find(x => x.id === id);
    const bid = loc[store].get(id);
    if (bid) { const m = buckets[store].get(bid); if (m) m.delete(id); loc[store].delete(id); remoteDel(store, bid, id); }
    rebuild(store);
    if (!NO_AUDIT.includes(store) && !opts.noAudit) await audit(store, id, 'Eliminación', before ? label(store, before) : '', opts.motivo);
  }

  async function clearStore(store) {
    meta.rev++;
    const ids = [...buckets[store].keys()];
    buckets[store].clear(); sizes[store].clear(); loc[store].clear(); S[store] = [];
    for (let i = 0; i < ids.length; i += 400) {
      const b = fs.batch();
      ids.slice(i, i + 400).forEach(bid => b.delete(fs.collection(COL(store)).doc(bid)));
      await b.commit().catch(errorEscritura);
    }
  }

  function label(store, o) {
    switch (store) {
      case 'equipos': return `${o.codigo} – ${o.descripcion || ''}`;
      case 'puntos': return `${o.codigo} – ${o.componente || ''}`;
      case 'neumaticos': return `${o.codigo} (serie ${o.serie || '—'})`;
      case 'engrases': return `Engrase ${o.fecha} – ${o.resultado}`;
      case 'inspecciones': return `Inspección ${o.fecha}`;
      case 'movimientos': return `${o.tipo} ${o.fecha}`;
      case 'engrasesDiarios': return `${o.tipo} ${o.fecha}`;
      case 'programas': return `Programa ${o.mes}`;
      default: return o.nombre || o.id;
    }
  }

  // El respaldo incluye las fotos completas, para que sirva fuera de Mantify
  async function exportAllFull() {
    const data = { app: 'EQ_EngraseNeumaticos', version: 3, exportado: nowISO(), stores: {} };
    for (const k of Object.keys(STORES)) {
      if (k === 'migracion') continue;
      data.stores[k] = [];
      for (const o of S[k]) data.stores[k].push(await resolverFotos(JSON.parse(JSON.stringify(o))));
    }
    return data;
  }
  async function resolverFotos(v) {
    if (typeof v === 'string' && v.startsWith('fx:')) return await Fotos.get(v.slice(3));
    if (Array.isArray(v)) { const out = []; for (const x of v) out.push(await resolverFotos(x)); return out; }
    if (v && typeof v === 'object') { for (const k of Object.keys(v)) v[k] = await resolverFotos(v[k]); return v; }
    return v;
  }
  function exportAll() { // versión sincrónica (sin fotos): se usa solo si no se puede esperar
    const data = { app: 'EQ_EngraseNeumaticos', version: 3, exportado: nowISO(), stores: {} };
    Object.keys(STORES).forEach(k => { if (k !== 'migracion') data.stores[k] = S[k]; });
    return data;
  }

  async function importAll(data, mode) {
    if (!data || !data.stores) throw new Error('Archivo de respaldo no válido (falta "stores").');
    if (mode === 'replace') {
      for (const k of Object.keys(STORES)) if (k !== 'migracion') await clearStore(k);
    }
    for (const k of Object.keys(STORES)) {
      const arr = data.stores[k];
      if (Array.isArray(arr) && arr.length) {
        const groups = {};
        arr.forEach(o => { if (!o || !o.id) return; const clean = prepare(o); const st = stage(k, clean); (groups[st.bid] = groups[st.bid] || {})[clean.id] = st.js; if (st.prev) remoteDel(k, st.prev, clean.id); });
        rebuild(k);
        for (const [bid, entries] of Object.entries(groups)) {
          let chunk = {}, bytes = 0;
          for (const [id, js] of Object.entries(entries)) { if (bytes + js.length > 800000) { remoteSet(k, bid, chunk); chunk = {}; bytes = 0; } chunk[id] = js; bytes += js.length; }
          if (Object.keys(chunk).length) remoteSet(k, bid, chunk);
        }
      }
    }
    meta.rev++;
    await audit('sistema', '*', 'Restauración', `Modo: ${mode === 'replace' ? 'reemplazar' : 'combinar'}`);
  }

  async function wipe() {
    for (const k of Object.keys(STORES)) if (k !== 'migracion') await clearStore(k);
  }

  function getConfig() {
    let c = S.config.find(x => x.id === 'main');
    if (!c) c = JSON.parse(JSON.stringify(EQ.DEFAULT_CONFIG));
    const d = EQ.DEFAULT_CONFIG;
    Object.keys(d).forEach(k => { if (c[k] === undefined) c[k] = JSON.parse(JSON.stringify(d[k])); });
    Object.keys(d.umbrales).forEach(k => { if (c.umbrales[k] === undefined) c.umbrales[k] = d.umbrales[k]; });
    if ((c.version || 1) < 2) {
      d.familias.forEach(f => { if (!c.familias.includes(f)) c.familias.splice(Math.max(0, c.familias.length - 1), 0, f); });
      Object.keys(d.plantillasEngrase).forEach(f => { if (!c.plantillasEngrase[f]) c.plantillasEngrase[f] = JSON.parse(JSON.stringify(d.plantillasEngrase[f])); });
      Object.keys(d.layoutsNeum).forEach(f => { if (c.layoutsNeum[f] === undefined) c.layoutsNeum[f] = JSON.parse(JSON.stringify(d.layoutsNeum[f])); });
      c.version = 2;
    }
    if ((c.version || 1) < 3) {
      if (!c.tiposGrasa.some(g => /premalube/i.test(g.nombre))) c.tiposGrasa.push(JSON.parse(JSON.stringify(d.tiposGrasa.find(g => /premalube/i.test(g.nombre)))));
      c.version = 3;
    }
    c.tiposGrasa.forEach(g => { if (g.precioPunto === undefined) g.precioPunto = 0; if (g.marca === undefined) g.marca = ''; if (g.base === undefined) g.base = ''; });
    if (!Array.isArray(c.tecnicosDet) || (!c.tecnicosDet.length && (c.tecnicos || []).length)) {
      c.tecnicosDet = (c.tecnicos || []).map(n => ({ nombre: n, cargo: /neum/i.test(n) ? 'Técnico de neumáticos' : 'Lubricador', especialidad: /neum/i.test(n) ? 'Neumáticos' : 'Engrase', codigo: '', telefono: '', activo: true }));
    }
    c.tecnicos = c.tecnicosDet.filter(t => t.activo !== false).map(t => t.nombre);
    if (!Array.isArray(c.codigosEliminados)) c.codigosEliminados = [];
    return c;
  }

  EQ.DB = { meta, open, loadAll, put, bulkPut, del, audit, exportAll, exportAllFull, importAll, wipe, uid, S, getConfig, STORES, Fotos, host, user: () => user };
  EQ.S = S;
  EQ.Fotos = Fotos;
})();
