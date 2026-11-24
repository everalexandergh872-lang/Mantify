/* =========================================================================
   UTILIDADES DE INTERFAZ
   ========================================================================= */
(function () {
  const U = {};
  U.esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.num = (v, d = 0) => (v === null || v === undefined || v === '' || isNaN(v)) ? '—' : Number(v).toLocaleString('es-PE', { minimumFractionDigits: d, maximumFractionDigits: d });
  U.money = v => (v === null || v === undefined || isNaN(v)) ? '—' : `${EQ.DB.getConfig().moneda} ${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  U.moneyC = (v, sym) => (v === null || v === undefined || v === '' || isNaN(v)) ? '—' : `${sym || EQ.DB.getConfig().moneda} ${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  U.usd = v => U.moneyC(v, EQ.DB.getConfig().monedaUSD || 'US$'); // importes en dólares
  U.moneyN = v => U.moneyC(v, EQ.DB.getConfig().monedaNeum || EQ.DB.getConfig().moneda); // costos de neumáticos (S/ o US$)
  U.pad = n => String(n).padStart(2, '0');
  U.toISODate = d => `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}-${U.pad(d.getDate())}`;
  U.today = () => U.toISODate(new Date());
  // Fecha leída de Excel (Date local o UTC a medianoche) → 'YYYY-MM-DD'
  U.xlDate = d => {
    if (!(d instanceof Date) || isNaN(d)) return '';
    if (d.getHours() === 0 && d.getMinutes() === 0) return U.toISODate(d);                       // medianoche local
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) return `${d.getUTCFullYear()}-${U.pad(d.getUTCMonth() + 1)}-${U.pad(d.getUTCDate())}`; // medianoche UTC
    if (d.getHours() === 23 && d.getMinutes() >= 50) return U.toISODate(new Date(d.getTime() + 3600e3)); // redondeo de Excel
    return U.toISODate(d);                                                                          // fecha con hora
  };
  U.parseDate = s => { if (!s) return null; const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (!m) return null; return new Date(+m[1], +m[2] - 1, +m[3]); };
  U.addDays = (s, n) => { const d = U.parseDate(s) || new Date(); d.setDate(d.getDate() + Math.round(n)); return U.toISODate(d); };
  U.daysBetween = (a, b) => { const da = U.parseDate(a), db = U.parseDate(b); if (!da || !db) return null; return Math.round((db - da) / 86400000); };
  U.fdate = s => { const d = U.parseDate(s); if (!d) return '—'; return `${U.pad(d.getDate())}/${U.pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
  U.fdatetime = s => { if (!s) return '—'; const d = new Date(s); return `${U.pad(d.getDate())}/${U.pad(d.getMonth() + 1)}/${d.getFullYear()} ${U.pad(d.getHours())}:${U.pad(d.getMinutes())}`; };
  U.monthKey = s => (s || '').slice(0, 7);
  U.monthName = k => { if (!k) return ''; const [y, m] = k.split('-'); return ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'][+m - 1] + ' ' + y.slice(2); };
  U.lastMonths = n => { const out = []; const d = new Date(); d.setDate(1); for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(`${x.getFullYear()}-${U.pad(x.getMonth() + 1)}`); } return out; };
  U.nextMonths = n => { const out = []; const d = new Date(); d.setDate(1); for (let i = 0; i < n; i++) { const x = new Date(d.getFullYear(), d.getMonth() + i, 1); out.push(`${x.getFullYear()}-${U.pad(x.getMonth() + 1)}`); } return out; };
  U.toNum = v => { if (v === '' || v === null || v === undefined) return null; const n = Number(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
  U.opts = (list, sel, empty) => (empty !== undefined ? `<option value="">${U.esc(empty)}</option>` : '') + list.map(o => {
    const v = typeof o === 'object' ? o.v : o, t = typeof o === 'object' ? o.t : o;
    return `<option value="${U.esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${U.esc(t)}</option>`;
  }).join('');
  U.pill = (cls, txt) => `<span class="pill ${cls}">${U.esc(txt)}</span>`;

  // ---------- Toast ----------
  U.toast = (msg, type = '') => {
    const el = document.createElement('div');
    el.className = 'toast ' + type; el.textContent = msg;
    document.getElementById('toastRoot').appendChild(el);
    setTimeout(() => el.remove(), type === 'bad' ? 6000 : 3500);
  };

  // ---------- Modal ----------
  U.modal = ({ title, body, size = '', buttons = [], onOpen, onClose }) => {
    const root = document.getElementById('modalRoot');
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${size}" role="dialog"><div class="modal-head"><h2>${U.esc(title)}</h2><button class="close" title="Cerrar">×</button></div>
      <div class="modal-body">${body}</div>${buttons.length ? '<div class="modal-foot"></div>' : ''}</div>`;
    root.appendChild(back);
    const m = back.querySelector('.modal');
    const close = () => { back.remove(); if (onClose) onClose(); };
    back.querySelector('.close').onclick = close;
    back.addEventListener('mousedown', e => { if (e.target === back) back.dataset.down = '1'; });
    back.addEventListener('mouseup', e => { if (e.target === back && back.dataset.down) close(); back.dataset.down = ''; });
    const foot = back.querySelector('.modal-foot');
    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.className = 'btn ' + (b.cls || ''); btn.textContent = b.label;
      btn.onclick = async () => {
        if (!b.onClick) { close(); return; }
        btn.disabled = true;
        try { const r = await b.onClick(m, close); if (r !== false) close(); }
        catch (e) { if (!(e instanceof Error) || /^(Registro|Corrija|Fecha|Posición|Neumático|No |Ya |El |La |Lectura|Horómetro|Kilometraje|Debe|Indique|Configure|Hay|Se |Valor|Profundidad|Costo|Precios|Códigos|Nombres|Incremento|Kilometraje)/.test(e.message) === false) console.error(e); U.toast(e.message || String(e), 'bad'); }
        finally { btn.disabled = false; }
      };
      foot.appendChild(btn);
    });
    if (onOpen) onOpen(m, close);
    const first = m.querySelector('input:not([type=hidden]):not([readonly]),select,textarea');
    if (first) setTimeout(() => first.focus(), 50);
    return { el: m, close };
  };
  U.confirm = (msg, title = 'Confirmar') => new Promise(res => {
    let done = false;
    U.modal({ title, size: 'sm', body: `<p>${msg}</p>`, onClose: () => { if (!done) res(false); }, buttons: [
      { label: 'Cancelar', cls: 'btn-outline', onClick: () => { done = true; res(false); } },
      { label: 'Aceptar', cls: 'btn-orange', onClick: () => { done = true; res(true); } }] });
  });
  U.prompt = (msg, def = '', title = 'Ingresar dato', required = true) => new Promise(res => {
    let done = false;
    U.modal({ title, size: 'sm', body: `<div class="fld"><label>${U.esc(msg)}</label><input id="__p" value="${U.esc(def)}"></div>`, onClose: () => { if (!done) res(null); }, buttons: [
      { label: 'Cancelar', cls: 'btn-outline', onClick: () => { done = true; res(null); } },
      { label: 'Aceptar', cls: 'btn-orange', onClick: m => { const v = m.querySelector('#__p').value.trim(); if (required && !v) { U.toast('Dato obligatorio', 'bad'); return false; } done = true; res(v); } }] });
  });

  // ---------- Formularios ----------
  U.field = (name, label, opts = {}) => {
    const { type = 'text', value = '', req = false, options, hint = '', cls = '', attrs = '', empty } = opts;
    let input;
    if (type === 'select') input = `<select name="${name}" ${attrs}>${U.opts(options || [], value, empty === undefined ? '— Seleccione —' : empty)}</select>`;
    else if (type === 'textarea') input = `<textarea name="${name}" ${attrs}>${U.esc(value)}</textarea>`;
    else if (type === 'datalist') { const id = 'dl_' + name + '_' + Math.random().toString(36).slice(2, 7); input = `<input name="${name}" list="${id}" value="${U.esc(value)}" ${attrs}><datalist id="${id}">${(options || []).map(o => `<option value="${U.esc(o)}">`).join('')}</datalist>`; }
    else input = `<input type="${type}" name="${name}" value="${U.esc(value)}" ${type === 'number' ? 'step="any"' : ''} ${attrs}>`;
    return `<div class="fld ${cls}"><label>${U.esc(label)}${req ? ' <span class="req">*</span>' : ''}</label>${input}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  };
  U.formData = el => {
    const o = {};
    el.querySelectorAll('[name]').forEach(i => {
      if (i.type === 'checkbox') o[i.name] = i.checked;
      else if (i.type === 'number') o[i.name] = U.toNum(i.value);
      else o[i.name] = i.value.trim();
    });
    return o;
  };
  U.markInvalid = (el, names) => {
    el.querySelectorAll('.invalid').forEach(i => i.classList.remove('invalid'));
    names.forEach(n => { const i = el.querySelector(`[name="${n}"]`); if (i) i.classList.add('invalid'); });
  };
  U.requireFields = (el, data, fields) => {
    const miss = fields.filter(f => data[f] === null || data[f] === undefined || data[f] === '');
    U.markInvalid(el, miss);
    if (miss.length) throw new Error('Registro incompleto: complete los campos obligatorios marcados en rojo.');
  };

  // ---------- Fotografías ----------
  U.readPhoto = (file, max = 1024) => new Promise((res, rej) => {
    if (!file) { res(null); return; }
    if (!file.type.startsWith('image/')) { rej(new Error('El archivo no es una imagen')); return; }
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const sc = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => rej(new Error('No se pudo leer la imagen'));
      img.src = r.result;
    };
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
  U.readPhotos = async (files) => { const out = []; for (const f of Array.from(files || [])) out.push(await U.readPhoto(f)); return out.filter(Boolean); };
  U.showPhoto = src => U.modal({ title: 'Evidencia fotográfica', size: 'lg', body: `<img src="${src}" style="max-width:100%;display:block;margin:auto">` });

  // ---------- Tabla con búsqueda y orden ----------
  // cols: [{k, t, num, fmt:(v,row)=>html, sort:(row)=>val, nosort}]
  U.table = (container, { cols, rows, search = true, pageSize = 0, empty = 'Sin registros', id, tools = '', rowClass, exportName }) => {
    const st = { q: '', sk: null, sd: 1 };
    const wrap = typeof container === 'string' ? document.querySelector(container) : container;
    const getVal = (c, r) => c.sort ? c.sort(r) : r[c.k];
    function draw() {
      let data = rows.slice();
      if (st.q) {
        const q = st.q.toLowerCase();
        data = data.filter(r => cols.some(c => { const v = c.text ? c.text(r) : (c.fmt ? String(c.fmt(r[c.k], r)).replace(/<[^>]*>/g, '') : r[c.k]); return String(v === undefined || v === null ? '' : v).toLowerCase().includes(q); }));
      }
      if (st.sk !== null) {
        const c = cols[st.sk];
        data.sort((a, b) => { const x = getVal(c, a), y = getVal(c, b); if (x === y) return 0; if (x === null || x === undefined || x === '') return 1; if (y === null || y === undefined || y === '') return -1; return (x > y ? 1 : -1) * st.sd; });
      }
      const body = data.length ? data.map(r => `<tr class="${rowClass ? rowClass(r) : ''}">${cols.map(c => `<td class="${c.num ? 'num' : ''}">${c.fmt ? c.fmt(r[c.k], r) : U.esc(r[c.k] === null || r[c.k] === undefined ? '' : r[c.k])}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${cols.length}" class="muted" style="text-align:center;padding:20px">${U.esc(empty)}</td></tr>`;
      wrap.querySelector('tbody').innerHTML = body;
      wrap.querySelector('.tbl-foot').textContent = `${data.length} de ${rows.length} registros`;
      wrap._filtered = data;
    }
    wrap.innerHTML = `${search || tools || exportName ? `<div class="tbl-tools">${search ? '<input type="search" placeholder="Buscar en la tabla…">' : ''}${tools}<span class="spacer"></span>${exportName ? '<button class="btn btn-outline btn-sm" data-x="csv">CSV</button><button class="btn btn-outline btn-sm" data-x="xlsx">Excel</button>' : ''}</div>` : ''}
      <div class="tbl-wrap"><table class="tbl" ${id ? `id="${id}"` : ''}><thead><tr>${cols.map((c, i) => `<th data-i="${i}" class="${c.num ? 'num' : ''} ${c.nosort ? 'nosort' : ''}">${U.esc(c.t)}</th>`).join('')}</tr></thead><tbody></tbody></table></div><div class="tbl-foot"></div>`;
    const s = wrap.querySelector('input[type=search]');
    if (s) s.addEventListener('input', () => { st.q = s.value.trim(); draw(); });
    wrap.querySelectorAll('th').forEach(th => th.addEventListener('click', () => {
      const i = +th.dataset.i; if (cols[i].nosort) return;
      if (st.sk === i) st.sd *= -1; else { st.sk = i; st.sd = 1; }
      wrap.querySelectorAll('th').forEach(x => x.textContent = cols[+x.dataset.i].t);
      th.textContent = cols[i].t + (st.sd > 0 ? ' ▲' : ' ▼');
      draw();
    }));
    if (exportName) {
      const exp = (type) => {
        const ec = cols.filter(c => !c.noexport);
        const aoa = [ec.map(c => c.t)].concat((wrap._filtered || rows).map(r => ec.map(c => {
          if (c.text) return c.text(r);
          const v = c.fmt ? String(c.fmt(r[c.k], r)).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&') : r[c.k];
          return v === undefined || v === null ? '' : v;
        })));
        if (type === 'csv') U.downloadCSV(aoa, exportName + '.csv'); else U.downloadXLSX([{ name: exportName.slice(0, 30), aoa }], exportName + '.xlsx');
      };
      wrap.querySelector('[data-x=csv]').onclick = () => exp('csv');
      wrap.querySelector('[data-x=xlsx]').onclick = () => exp('xlsx');
    }
    draw();
    return { redraw: draw, wrap };
  };

  // ---------- Descargas ----------
  U.download = (content, name, mime) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
  U.csvCell = v => { const s = String(v === null || v === undefined ? '' : v); return /[";\n,]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  U.downloadCSV = (aoa, name) => U.download('﻿' + aoa.map(r => r.map(U.csvCell).join(';')).join('\r\n'), name, 'text/csv;charset=utf-8');
  U.downloadXLSX = (sheets, name) => {
    if (!window.XLSX) { U.toast('Librería Excel no disponible', 'bad'); return; }
    const wb = XLSX.utils.book_new();
    const used = new Set();
    sheets.forEach(s => {
      let n = (s.name || 'Hoja').replace(/[\\\/\?\*\[\]:]/g, '').slice(0, 31) || 'Hoja';
      let k = 1; while (used.has(n)) n = n.slice(0, 28) + '_' + (k++); used.add(n);
      const ws = XLSX.utils.aoa_to_sheet(s.aoa);
      if (s.aoa.length) ws['!cols'] = s.aoa[0].map((_, i) => ({ wch: Math.min(45, Math.max(10, ...s.aoa.slice(0, 200).map(r => String(r[i] === undefined ? '' : r[i]).length + 2))) }));
      XLSX.utils.book_append_sheet(wb, ws, n);
    });
    XLSX.writeFile(wb, name);
  };
  U.readFileText = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsText(file, 'utf-8'); });
  U.readFileBuffer = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsArrayBuffer(file); });
  U.pickFile = (accept, multiple = false) => new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = multiple;
    i.onchange = () => res(multiple ? Array.from(i.files) : i.files[0]); i.click();
  });

  // ---------- Gráficos ----------
  U.charts = {};
  U.PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
  U.STATUS = { verde: '#1e9e5a', amarillo: '#d9a000', rojo: '#d63c3c', gris: '#9aa3b2' };
  U.destroyCharts = () => { Object.values(U.charts).forEach(c => { try { c.destroy(); } catch (e) { } }); U.charts = {}; };
  U.chart = (canvasId, cfg) => {
    const el = document.getElementById(canvasId);
    if (!el || !window.Chart) return null;
    if (U.charts[canvasId]) U.charts[canvasId].destroy();
    const base = {
      responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
      plugins: { legend: { display: (cfg.data.datasets || []).length > 1, position: 'bottom', labels: { boxWidth: 12, color: '#56637a' } }, tooltip: { mode: 'index', intersect: false } },
      scales: cfg.type === 'doughnut' || cfg.type === 'pie' ? undefined : {
        x: { grid: { display: false }, ticks: { color: '#56637a', maxRotation: 50, autoSkip: true } },
        y: { beginAtZero: true, grid: { color: '#eef1f5' }, ticks: { color: '#56637a' } }
      }
    };
    cfg.options = deepMerge(base, cfg.options || {});
    (cfg.data.datasets || []).forEach((d, i) => {
      if (cfg.type === 'bar') { d.borderRadius = d.borderRadius === undefined ? 4 : d.borderRadius; d.maxBarThickness = 38; if (!d.backgroundColor) d.backgroundColor = U.PALETTE[i % 8]; }
      if (cfg.type === 'line') { d.borderWidth = 2; d.pointRadius = 4; d.tension = .25; if (!d.borderColor) d.borderColor = U.PALETTE[i % 8]; if (!d.backgroundColor) d.backgroundColor = U.PALETTE[i % 8]; }
    });
    U.charts[canvasId] = new Chart(el, cfg);
    return U.charts[canvasId];
  };
  function deepMerge(a, b) {
    if (b === undefined) return a;
    if (typeof a !== 'object' || a === null || Array.isArray(b) || typeof b !== 'object' || b === null) return b;
    const o = Object.assign({}, a);
    Object.keys(b).forEach(k => o[k] = deepMerge(a ? a[k] : undefined, b[k]));
    return o;
  }

  U.emptyState = (icon, title, sub, btn = '') => `<div class="empty-state"><div class="big">${icon}</div><div style="font-weight:600;font-size:15px">${U.esc(title)}</div><div class="muted mt-s">${sub}</div>${btn ? `<div class="mt">${btn}</div>` : ''}</div>`;

  EQ.U = U;
})();
