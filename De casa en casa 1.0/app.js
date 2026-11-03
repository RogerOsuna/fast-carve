'use strict';
/* De casa en casa 1.0 — organizador de territorios de predicación.
   Datos guardados localmente (localStorage). Sin servidor. */

const KEY = 'dcc_data_v1';
const OVERDUE_DAYS = 120;   // asignado más de 4 meses
const STALE_DAYS = 365;     // sin trabajar más de un año

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const days = d => Math.floor((new Date(today() + 'T00:00:00') - new Date(d + 'T00:00:00')) / 864e5);
const fmt = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/* ---------- Datos ---------- */
let state = load();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.territories) && Array.isArray(s.publishers)) return s;
  } catch (e) { /* datos corruptos o sin acceso */ }
  return { territories: [], publishers: [] };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { toast('No se pudo guardar en este dispositivo'); }
}

const getT = id => state.territories.find(t => t.id === id);
const getP = id => state.publishers.find(p => p.id === id);
const current = t => t.history.find(h => !h.returnedAt);
const lastDone = t => t.history.filter(h => h.returnedAt).map(h => h.returnedAt).sort().pop() || null;

function status(t) {
  const c = current(t);
  if (c) return days(c.assignedAt) > OVERDUE_DAYS ? 'overdue' : 'assigned';
  return 'available';
}
function isStale(t) {
  if (current(t)) return false;
  const d = lastDone(t);
  return d ? days(d) > STALE_DAYS : false;
}
const STATUS = {
  available: { label: 'Disponible', color: '#2e9e5b' },
  assigned: { label: 'Asignado', color: '#2f6fdb' },
  overdue: { label: 'Asignado +4 meses', color: '#e08a1e' }
};
const byNumber = (a, b) => String(a.number).localeCompare(String(b.number), 'es', { numeric: true });

function nextNumber() {
  const nums = state.territories.map(t => parseInt(t.number, 10)).filter(n => !isNaN(n));
  return String((nums.length ? Math.max(...nums) : 0) + 1);
}

/* ---------- Utilidades UI ---------- */
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 2500);
}
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- Navegación ---------- */
let map = null;
function show(view) {
  $$('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + view));
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === view));
  if (view === 'mapa') { initMap(); setTimeout(() => { map && map.invalidateSize(); refreshMap(); }, 50); }
  if (view !== 'mapa' && draw) cancelDraw();
}
$('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) show(b.dataset.view); });

/* ---------- Lista de territorios ---------- */
const ui = { q: '', filter: 'all' };
$('#q').addEventListener('input', e => { ui.q = e.target.value.trim().toLowerCase(); renderList(); });
$('#filter').addEventListener('change', e => { ui.filter = e.target.value; renderList(); });
$('#btn-new').addEventListener('click', () => {
  const t = { id: uid(), number: nextNumber(), name: '', notes: '', polygon: [], addresses: [], history: [] };
  state.territories.push(t); save(); renderAll(); openTerritory(t.id);
});

function renderList() {
  const all = state.territories;
  const counts = { available: 0, assigned: 0, overdue: 0, stale: 0 };
  all.forEach(t => { counts[status(t)]++; if (isStale(t)) counts.stale++; });
  $('#stats').innerHTML = all.length
    ? `<span>${all.length} territorios</span><span>🟢 ${counts.available} disponibles</span><span>🔵 ${counts.assigned} asignados</span>` +
      (counts.overdue ? `<span>🟠 ${counts.overdue} con +4 meses</span>` : '') +
      (counts.stale ? `<span>⏳ ${counts.stale} sin trabajar +1 año</span>` : '')
    : '';

  const list = all.filter(t => {
    if (ui.filter === 'stale' ? !isStale(t) : (ui.filter !== 'all' && status(t) !== ui.filter)) return false;
    if (!ui.q) return true;
    const hay = [t.number, t.name, t.notes, ...t.addresses.map(a => a.text), current(t) ? current(t).pn : ''].join(' ').toLowerCase();
    return hay.includes(ui.q);
  }).sort(byNumber);

  if (!list.length) {
    $('#tlist').innerHTML = `<div class="empty">${all.length ? 'Ningún territorio coincide con la búsqueda.' : 'Aún no hay territorios.<br>Toca <b>+ Nuevo</b> para crear el primero, o carga datos de ejemplo en la pestaña Datos.'}</div>`;
    return;
  }
  $('#tlist').innerHTML = list.map(t => {
    const st = status(t), c = current(t), ld = lastDone(t);
    const line = c
      ? `${esc(c.pn)} · desde ${fmt(c.assignedAt)} (${days(c.assignedAt)} d)`
      : `Última vez completado: ${fmt(ld)}${isStale(t) ? ' ⏳' : ''}`;
    return `<div class="item" data-id="${t.id}">
      <div class="num" style="background:${STATUS[st].color}">${esc(t.number)}</div>
      <div class="info"><div class="t">${esc(t.name) || '<i>Sin nombre</i>'}</div><div class="sub">${line}</div></div>
      <span class="sub">${t.polygon.length >= 3 ? '🗺' : ''}</span></div>`;
  }).join('');
}
$('#tlist').addEventListener('click', e => { const i = e.target.closest('.item'); if (i) openTerritory(i.dataset.id); });

/* ---------- Detalle del territorio ---------- */
const dlg = $('#dlg');
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
let openId = null;

function openTerritory(id) {
  const t = getT(id); if (!t) return;
  openId = id;
  const c = current(t);
  const pubs = [...state.publishers].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const st = status(t);

  const assignBlock = c
    ? `<p><span class="badge" style="background:${STATUS[st].color}">${STATUS[st].label}</span>
       <b>${esc(c.pn)}</b> desde ${fmt(c.assignedAt)} (${days(c.assignedAt)} días)</p>
       <div class="row"><input type="date" id="ret-date" value="${today()}" style="width:auto" max="${today()}">
       <button class="primary" data-act="return">Devolver (completado)</button>
       <button data-act="unassign">Cancelar asignación</button></div>`
    : (pubs.length
      ? `<p><span class="badge" style="background:${STATUS.available.color}">Disponible</span> Última vez completado: ${fmt(lastDone(t))}</p>
         <div class="row"><select id="as-pub" style="flex:1;min-width:140px">${pubs.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
         <input type="date" id="as-date" value="${today()}" style="width:auto" max="${today()}">
         <button class="primary" data-act="assign">Asignar</button></div>`
      : `<p class="sub">Primero añade publicadores en la pestaña <b>Publicadores</b> para poder asignar este territorio.</p>`);

  dlg.innerHTML = `
    <div class="dhead"><h2>Territorio ${esc(t.number)}</h2><button data-act="close" aria-label="Cerrar">×</button></div>
    <div class="dbody">
      <div class="card"><div class="grid2">
        <label>Número<input data-f="number" value="${esc(t.number)}"></label>
        <label>Nombre / zona<input data-f="name" value="${esc(t.name)}" placeholder="Ej. Col. Centro, calles 1–5"></label>
      </div>
      <label>Notas<textarea data-f="notes" placeholder="Edificios con portero, horarios, idiomas…">${esc(t.notes)}</textarea></label></div>

      <div class="card"><h3>Asignación</h3>${assignBlock}</div>

      <div class="card"><h3>Límites en el mapa</h3>
        <div class="row"><button data-act="draw">${t.polygon.length >= 3 ? 'Redibujar límites' : 'Dibujar límites'}</button>
        ${t.polygon.length >= 3 ? '<button data-act="viewmap">Ver en el mapa</button><button data-act="clearpoly">Quitar</button>' : ''}</div>
      </div>

      <div class="card"><h3>Direcciones (${t.addresses.length})</h3>
        <div>${t.addresses.map(a => `<div class="addr ${a.dnc ? 'dnc' : ''}" data-aid="${a.id}">
          <span>${esc(a.text)}</span>
          <button data-act="dnc" title="No pasar">${a.dnc ? 'Reactivar' : 'No pasar'}</button>
          <button data-act="deladdr" aria-label="Eliminar">✕</button></div>`).join('') || '<p class="sub">Sin direcciones registradas.</p>'}</div>
        <textarea id="newaddr" placeholder="Añade direcciones, una por línea" style="margin-top:8px"></textarea>
        <button data-act="addaddr" style="margin-top:6px">Añadir direcciones</button>
      </div>

      <div class="card"><h3>Historial</h3>
        ${t.history.length ? [...t.history].reverse().map(h => `<div class="addr" data-hid="${h.id}">
          <span><b>${esc(h.pn)}</b><br><span class="sub">${fmt(h.assignedAt)} → ${h.returnedAt ? fmt(h.returnedAt) : 'en curso'}</span></span>
          <button data-act="delhist" aria-label="Eliminar">✕</button></div>`).join('') : '<p class="sub">Sin historial todavía.</p>'}
      </div>

      <div class="row"><button data-act="print">🖨 Imprimir tarjeta</button><button class="danger" data-act="deleteT">Eliminar territorio</button></div>
    </div>`;
  if (!dlg.open) dlg.showModal();
}

// Autoguardado de campos
dlg.addEventListener('change', e => {
  const f = e.target.dataset.f; const t = getT(openId);
  if (!f || !t) return;
  t[f] = e.target.value.trim(); save(); renderAll();
  if (f === 'number') $('.dhead h2', dlg).textContent = 'Territorio ' + t.number;
});

dlg.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const t = getT(openId); const act = b.dataset.act;
  const aid = b.closest('[data-aid]')?.dataset.aid, hid = b.closest('[data-hid]')?.dataset.hid;
  let redraw = true;

  switch (act) {
    case 'close': dlg.close(); return;
    case 'assign': {
      const p = getP($('#as-pub', dlg).value); if (!p) return;
      t.history.push({ id: uid(), pid: p.id, pn: p.name, assignedAt: $('#as-date', dlg).value || today(), returnedAt: null });
      break;
    }
    case 'return': {
      const c = current(t); const d = $('#ret-date', dlg).value || today();
      if (d < c.assignedAt) { toast('La devolución no puede ser anterior a la asignación'); return; }
      c.returnedAt = d; break;
    }
    case 'unassign':
      if (!confirm('¿Cancelar esta asignación? Se borrará del historial.')) return;
      t.history = t.history.filter(h => h.returnedAt); break;
    case 'addaddr': {
      const lines = $('#newaddr', dlg).value.split('\n').map(s => s.trim()).filter(Boolean);
      if (!lines.length) return;
      lines.forEach(text => t.addresses.push({ id: uid(), text, dnc: false })); break;
    }
    case 'dnc': { const a = t.addresses.find(x => x.id === aid); a.dnc = !a.dnc; break; }
    case 'deladdr': t.addresses = t.addresses.filter(x => x.id !== aid); break;
    case 'delhist':
      if (!confirm('¿Eliminar este registro del historial?')) return;
      t.history = t.history.filter(x => x.id !== hid); break;
    case 'clearpoly': t.polygon = []; break;
    case 'draw': dlg.close(); startDraw(t.id); return;
    case 'viewmap': dlg.close(); show('mapa'); setTimeout(() => map && map.fitBounds(L.polygon(t.polygon).getBounds().pad(.2)), 120); return;
    case 'print': printCard(t); return;
    case 'deleteT':
      if (!confirm(`¿Eliminar el territorio ${t.number} y todo su historial?`)) return;
      state.territories = state.territories.filter(x => x.id !== t.id);
      save(); renderAll(); dlg.close(); return;
  }
  save(); renderAll(); if (redraw) openTerritory(t.id);
});

/* ---------- Publicadores ---------- */
$('#pform').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#pname').value.trim(); if (!name) return;
  if (state.publishers.some(p => p.name.toLowerCase() === name.toLowerCase())) { toast('Ese publicador ya existe'); return; }
  state.publishers.push({ id: uid(), name }); $('#pname').value = ''; save(); renderAll();
});
function renderPubs() {
  const pubs = [...state.publishers].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  $('#plist').innerHTML = pubs.length ? pubs.map(p => {
    const mine = state.territories.filter(t => current(t)?.pid === p.id).sort(byNumber);
    return `<div class="item" style="cursor:default" data-pid="${p.id}">
      <div class="info"><div class="t">${esc(p.name)}</div>
      <div class="sub">${mine.length ? 'Territorios: ' + mine.map(t => esc(t.number)).join(', ') : 'Sin territorios asignados'}</div></div>
      <button data-act="delp" ${mine.length ? 'disabled title="Tiene territorios asignados"' : ''}>Eliminar</button></div>`;
  }).join('') : '<div class="empty">Añade a los publicadores de la congregación.</div>';
}
$('#plist').addEventListener('click', e => {
  const b = e.target.closest('[data-act="delp"]'); if (!b || b.disabled) return;
  const id = b.closest('[data-pid]').dataset.pid; const p = getP(id);
  if (!confirm(`¿Eliminar a ${p.name}? Su nombre se conserva en el historial.`)) return;
  state.publishers = state.publishers.filter(x => x.id !== id); save(); renderAll();
});

/* ---------- Mapa ---------- */
let polyLayer, drawLayer, draw = null;

function initMap() {
  if (map) return;
  if (typeof L === 'undefined') {
    const m = $('#map-msg'); m.hidden = false;
    m.textContent = 'No se pudo cargar el mapa. Conéctate a internet una vez para descargarlo; después funcionará también sin conexión en las zonas ya vistas.';
    return;
  }
  map = L.map('map', { zoomControl: true }).setView([20, -30], 3);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  polyLayer = L.layerGroup().addTo(map);
  drawLayer = L.layerGroup().addTo(map);
  map.on('click', e => { if (!draw) return; draw.pts.push([e.latlng.lat, e.latlng.lng]); updateDraw(); });
  const withPoly = state.territories.filter(t => t.polygon.length >= 3);
  if (withPoly.length) map.fitBounds(L.featureGroup(withPoly.map(t => L.polygon(t.polygon))).getBounds().pad(.1));
  else locate(true);
}

function refreshMap() {
  if (!map) return;
  polyLayer.clearLayers();
  state.territories.filter(t => t.polygon.length >= 3).forEach(t => {
    if (draw && draw.id === t.id) return;           // se está redibujando
    const col = STATUS[status(t)].color;
    const p = L.polygon(t.polygon, { color: col, weight: 2, fillOpacity: .25, interactive: !draw }).addTo(polyLayer);
    p.bindTooltip(String(t.number), { permanent: true, direction: 'center', className: 'tlabel' });
    p.on('click', () => { if (!draw) openTerritory(t.id); });
  });
}

function locate(quiet) {
  if (!navigator.geolocation || !map) return;
  navigator.geolocation.getCurrentPosition(
    pos => map.setView([pos.coords.latitude, pos.coords.longitude], 16),
    () => { if (!quiet) toast('No se pudo obtener tu ubicación'); },
    { enableHighAccuracy: true, timeout: 10000 });
}
$('#btn-locate').addEventListener('click', () => locate(false));

function startDraw(id) {
  show('mapa');
  const t = getT(id);
  draw = { id, pts: [] };
  $('#drawbar').hidden = false;
  $('#drawmsg').textContent = `Territorio ${t.number}: toca el mapa para marcar cada esquina del límite (mín. 3 puntos).`;
  refreshMap(); updateDraw();
  setTimeout(() => { if (map && t.polygon.length >= 3) map.fitBounds(L.polygon(t.polygon).getBounds().pad(.3)); }, 120);
}
function updateDraw() {
  if (!drawLayer) return;
  drawLayer.clearLayers();
  if (!draw) return;
  const o = { color: '#c0392b', weight: 3 };
  draw.pts.forEach(p => L.circleMarker(p, { radius: 6, ...o, fillOpacity: 1 }).addTo(drawLayer));
  if (draw.pts.length >= 3) L.polygon(draw.pts, { ...o, dashArray: '6', fillOpacity: .2 }).addTo(drawLayer);
  else if (draw.pts.length === 2) L.polyline(draw.pts, o).addTo(drawLayer);
}
function endDraw() { draw = null; $('#drawbar').hidden = true; updateDraw(); refreshMap(); }
function cancelDraw() { const id = draw?.id; endDraw(); if (id) openTerritory(id); }
$('#d-undo').addEventListener('click', () => { if (draw) { draw.pts.pop(); updateDraw(); } });
$('#d-cancel').addEventListener('click', cancelDraw);
$('#d-finish').addEventListener('click', () => {
  if (!draw) return;
  if (draw.pts.length < 3) { toast('Marca al menos 3 puntos'); return; }
  const t = getT(draw.id); t.polygon = draw.pts; save();
  const id = draw.id; endDraw(); renderAll(); openTerritory(id);
});

/* ---------- Tarjeta imprimible ---------- */
function printCard(t) {
  const addrs = t.addresses;
  $('#printarea').innerHTML = `
    <h1>Territorio ${esc(t.number)}</h1>
    <div>${esc(t.name)}</div>
    ${t.notes ? `<p><b>Notas:</b> ${esc(t.notes)}</p>` : ''}
    ${t.polygon.length >= 3 && typeof L !== 'undefined' ? '<div id="pmap"></div>' : ''}
    ${addrs.length ? `<table><tr><th>Dirección</th><th>Visita</th><th>Nota</th></tr>${addrs.map(a => `<tr><td>${esc(a.text)}${a.dnc ? ' <b>(NO PASAR)</b>' : ''}</td><td></td><td></td></tr>`).join('')}</table>` : ''}
    <table><tr><th>Asignado a</th><th>Fecha asignación</th><th>Fecha devolución</th></tr>
    ${t.history.map(h => `<tr><td>${esc(h.pn)}</td><td>${fmt(h.assignedAt)}</td><td>${fmt(h.returnedAt)}</td></tr>`).join('')}</table>`;
  dlg.close();
  document.body.classList.add('printing');
  let pm = null;
  if ($('#pmap')) {
    $('#printarea').style.display = 'block';
    pm = L.map('pmap', { zoomControl: false, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(pm);
    const poly = L.polygon(t.polygon, { color: '#c0392b', weight: 3, fillOpacity: .1 }).addTo(pm);
    pm.fitBounds(poly.getBounds().pad(.1));
  }
  const done = () => {
    document.body.classList.remove('printing');
    $('#printarea').style.display = ''; $('#printarea').innerHTML = '';
    if (pm) pm.remove();
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), pm ? 1200 : 100);   // espera a que carguen las teselas
}

/* ---------- Datos: respaldo, CSV, ejemplo ---------- */
$('#b-export').addEventListener('click', () => {
  download(`de-casa-en-casa-${today()}.json`, JSON.stringify(state, null, 2), 'application/json');
});
$('#b-import').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const s = JSON.parse(await f.text());
    if (!Array.isArray(s.territories) || !Array.isArray(s.publishers)) throw 0;
    if (!confirm('Esto reemplazará todos los datos actuales. ¿Continuar?')) return;
    s.territories.forEach(t => { t.polygon ||= []; t.addresses ||= []; t.history ||= []; });
    state = s; save(); renderAll(); toast('Respaldo importado');
  } catch (err) { toast('Archivo no válido'); }
});
$('#b-csv').addEventListener('click', () => {
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = [['Territorio', 'Nombre', 'Asignado a', 'Fecha de asignación', 'Fecha de devolución']];
  [...state.territories].sort(byNumber).forEach(t => {
    if (!t.history.length) rows.push([t.number, t.name, '', '', '']);
    [...t.history].sort((a, b) => a.assignedAt.localeCompare(b.assignedAt))
      .forEach(h => rows.push([t.number, t.name, h.pn, h.assignedAt, h.returnedAt || '']));
  });
  download(`registro-territorios-${today()}.csv`, '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
});
$('#b-wipe').addEventListener('click', () => {
  if (!confirm('¿Borrar TODOS los territorios y publicadores de este dispositivo?')) return;
  if (!confirm('Esta acción no se puede deshacer. ¿Seguro?')) return;
  state = { territories: [], publishers: [] }; save(); renderAll(); toast('Datos borrados');
});
$('#b-demo').addEventListener('click', () => {
  if (state.territories.length && !confirm('Se añadirán territorios de ejemplo a los existentes. ¿Continuar?')) return;
  const base = [19.4326, -99.1332], d = .004;
  const sq = (r, c) => [[base[0] + r * d, base[1] + c * d], [base[0] + r * d, base[1] + (c + 1) * d], [base[0] + (r + 1) * d, base[1] + (c + 1) * d], [base[0] + (r + 1) * d, base[1] + c * d]];
  const ago = n => { const x = new Date(); x.setDate(x.getDate() - n); return new Date(x.getTime() - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  const pubs = ['Juan Pérez', 'María López', 'Carlos Ruiz'].map(name => ({ id: uid(), name }));
  state.publishers.push(...pubs);
  const n0 = parseInt(nextNumber(), 10);
  const mk = (i, name, r, c, hist) => ({ id: uid(), number: String(n0 + i), name, notes: '', polygon: sq(r, c), addresses: [{ id: uid(), text: `Calle ${name} 1`, dnc: false }, { id: uid(), text: `Calle ${name} 2`, dnc: true }], history: hist });
  state.territories.push(
    mk(0, 'Centro', 0, 0, [{ id: uid(), pid: pubs[0].id, pn: pubs[0].name, assignedAt: ago(30), returnedAt: null }]),
    mk(1, 'Norte', 1, 0, [{ id: uid(), pid: pubs[1].id, pn: pubs[1].name, assignedAt: ago(200), returnedAt: null }]),
    mk(2, 'Este', 0, 1, [{ id: uid(), pid: pubs[2].id, pn: pubs[2].name, assignedAt: ago(500), returnedAt: ago(460) }]),
    mk(3, 'Oeste', 1, 1, []));
  save(); renderAll(); toast('Datos de ejemplo cargados');
});

/* ---------- Arranque ---------- */
function renderAll() { renderList(); renderPubs(); if (map) refreshMap(); }
renderAll(); show('territorios');

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => { });
}
