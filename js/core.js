'use strict';
/* ===== APROLOCO — utilità, archivio dati, interfaccia di base ===== */

const APP_VERSION = '1.0.0';
const DEFAULT_SERVER = 'https://proloco.loki4683.workers.dev';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const norm = s => String(s ?? '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '');
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? 0 : n; };
const eur = v => (Math.round(num(v) * 100) / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const qtyFmt = v => (Math.round(v * 1000) / 1000).toLocaleString('it-IT', { maximumFractionDigits: 3 });

/* --- date (sempre stringhe AAAA-MM-GG) --- */
const pad = n => String(n).padStart(2, '0');
const isoOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = () => isoOf(new Date());
const parseIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const addDays = (iso, n) => { if (!iso) return null; const d = parseIso(iso); d.setDate(d.getDate() + n); return isoOf(d); };
const diffDays = (a, b) => Math.round((parseIso(a) - parseIso(b)) / 86400000); // a - b
const fmtD = iso => { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const daysRange = (a, b) => { const out = []; if (!a) return out; let d = a; const end = b && b >= a ? b : a; while (d <= end && out.length < 400) { out.push(d); d = addDays(d, 1); } return out; };

/* --- configurazione locale (per dispositivo) --- */
const CFG = (() => { try { return JSON.parse(localStorage.getItem('aproloco_cfg') || '{}'); } catch { return {}; } })();
function saveCfg() { try { localStorage.setItem('aproloco_cfg', JSON.stringify(CFG)); } catch { } }
const isLocal = () => CFG.mode === 'local';
const canEdit = () => isLocal() || !!CFG.canEdit;
const ROLE_LABEL = { presidente: 'Presidente', contabile: 'Resp. contabile', cucine: 'Resp. cucine', direttivo: 'Direttivo (sola lettura)', locale: 'Prova locale' };

/* --- IndexedDB (cache e modalità locale) --- */
let _idb;
function idb() {
  if (_idb) return _idb;
  _idb = new Promise((res, rej) => {
    const r = indexedDB.open('aproloco', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('data'); r.result.createObjectStore('files'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return _idb;
}
async function idbGet(store, key) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction(store).objectStore(store).get(key); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); }
async function idbPut(store, key, val) { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(val, key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
async function idbDel(store, key) { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).delete(key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }

/* --- server --- */
async function api(path, opts = {}) {
  const url = (CFG.server || DEFAULT_SERVER).replace(/\/+$/, '') + path;
  const r = await fetch(url, { ...opts, headers: { 'X-Pin': CFG.pin || '', ...(opts.headers || {}) } });
  if (!r.ok) { let m = 'Errore server ' + r.status; try { m = (await r.json()).error || m; } catch { } throw new Error(m); }
  return r;
}

/* --- archivio --- */
const FORN_CATS = ['SPESA', 'PANE', 'CARNE', 'VINI', 'BIRRA', 'PASTA FRESCA'];
const REC_CATS = ['ANTIPASTI', 'PRIMI', 'SECONDI', 'DOLCI', 'GRIGLIA', 'COCKTAIL', 'VINI', 'BIRRA'];
const DEFAULTS = {
  events: [], bookings: [], recipes: [], suppliers: Object.fromEntries(FORN_CATS.map(c => [c, []])), prices: [], preventivi: [],
  cart: { extras: [], bought: {} }, docs: [], bilancio: { years: {} }, scadenze: [],
  magazzino: { MAGAZZINO: [], FREEZER: [], DISPENSA: [] }, certs: [], manuali: [],
};
const DB = {};
const A = {};   // azioni sui click (data-a)
const CH = {};  // azioni sulle modifiche dei campi (data-ch)
const UI = { open: {} };
const clone = o => JSON.parse(JSON.stringify(o));

async function loadAll() {
  const keys = Object.keys(DEFAULTS);
  if (isLocal()) {
    for (const k of keys) DB[k] = (await idbGet('data', k)) ?? clone(DEFAULTS[k]);
    return;
  }
  const results = await Promise.allSettled(keys.map(k => api('/api/data/' + k).then(r => r.json())));
  let failed = 0;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i], r = results[i];
    if (r.status === 'fulfilled') { DB[k] = r.value ?? clone(DEFAULTS[k]); idbPut('data', 'cache:' + k, DB[k]).catch(() => { }); }
    else { failed++; DB[k] = (await idbGet('data', 'cache:' + k).catch(() => null)) ?? clone(DEFAULTS[k]); }
  }
  for (const k of keys) for (const dk of Object.keys(DEFAULTS[k] || {})) if (!Array.isArray(DEFAULTS[k]) && DB[k] && DB[k][dk] === undefined) DB[k][dk] = clone(DEFAULTS[k][dk]);
  if (failed) toast('Server non raggiungibile: mostro gli ultimi dati salvati su questo dispositivo');
}

async function save(...keys) {
  for (const k of keys) {
    if (isLocal()) { await idbPut('data', k, DB[k]); continue; }
    if (!canEdit()) { toast('Sola lettura: non puoi modificare'); return false; }
    try {
      await api('/api/data/' + k, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(DB[k]) });
      idbPut('data', 'cache:' + k, DB[k]).catch(() => { });
    } catch (e) { toast('Salvataggio non riuscito: ' + e.message); return false; }
  }
  return true;
}

/* --- file (PDF, testi, immagini) --- */
async function putFile(blob, name) {
  const id = uid();
  const type = blob.type || (/\.pdf$/i.test(name) ? 'application/pdf' : 'application/octet-stream');
  if (!isLocal()) {
    await api('/api/file/' + id, { method: 'PUT', headers: { 'X-File-Type': type, 'X-File-Name': encodeURIComponent(name || id) }, body: blob });
  }
  await idbPut('files', id, { blob: new Blob([blob], { type }), name, type });
  return id;
}
async function getFile(id) {
  const c = await idbGet('files', id).catch(() => null);
  if (c) return c.blob;
  if (isLocal()) throw new Error('File non trovato');
  const r = await api('/api/file/' + id);
  const type = r.headers.get('X-File-Type') || r.headers.get('Content-Type') || '';
  const blob = new Blob([await r.arrayBuffer()], { type });
  idbPut('files', id, { blob, type }).catch(() => { });
  return blob;
}
async function delFile(id) {
  if (!id) return;
  idbDel('files', id).catch(() => { });
  if (!isLocal()) { try { await api('/api/file/' + id, { method: 'DELETE' }); } catch { } }
}
async function openFile(id, name) {
  try {
    busy(true, 'Apro il file…');
    const blob = await getFile(id);
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) downloadBlob(blob, name || 'documento.pdf');
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  } catch (e) { toast('Impossibile aprire il file: ' + e.message); }
  finally { busy(false); }
}
function downloadBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
function pickFile(accept) {
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept || '';
    i.onchange = () => res(i.files[0] || null); i.click();
  });
}
const safeName = s => String(s || 'documento').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, '_').slice(0, 80);

/* --- interfaccia: toast, attesa, finestre --- */
let _tt;
function toast(msg) {
  let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.remove('hidden'); clearTimeout(_tt); _tt = setTimeout(() => t.classList.add('hidden'), 3800);
}
function busy(on, msg) {
  let b = $('.busy');
  if (!on) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement('div'); b.className = 'busy'; document.body.appendChild(b); }
  b.innerHTML = `<div>${esc(msg || 'Attendere…')}</div>`;
}
function closeModal() { $$('.ov').forEach(o => o.remove()); }
/* modal(html, onSubmit(formData, form) -> false per non chiudere) */
function modal(title, body, onSubmit, opts = {}) {
  closeModal();
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<form class="md" novalidate><h3>${esc(title)}</h3>${body}
    <div class="row end" style="margin-top:14px">
      <button type="button" class="btn sec" data-close>${esc(opts.cancel || 'Annulla')}</button>
      ${onSubmit ? `<button type="submit" class="btn ${opts.danger ? 'bad' : ''}">${esc(opts.ok || 'Salva')}</button>` : ''}
    </div></form>`;
  document.body.appendChild(ov);
  const form = $('form', ov);
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-close]')) closeModal(); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    for (const el of $$('[required]', form)) {
      if (!String(el.value || '').trim()) { el.focus(); toast('Compila il campo obbligatorio: ' + (el.dataset.label || el.name)); return; }
    }
    const fd = Object.fromEntries(new FormData(form).entries());
    const r = await onSubmit(fd, form);
    if (r !== false) closeModal();
  });
  setTimeout(() => { const f = $('input:not([type=hidden]),select,textarea', form); if (f && !opts.noFocus) f.focus(); }, 50);
  return form;
}
function confirmBox(msg, onYes, okLabel = 'Conferma') {
  modal('Conferma', `<p>${esc(msg)}</p>`, async () => { await onYes(); }, { ok: okLabel, danger: true, noFocus: true });
}
const fld = (label, name, val = '', type = 'text', req = false, extra = '') =>
  `<label class="f">${esc(label)}${req ? ' *' : ''}</label><input class="i" name="${name}" type="${type}" value="${esc(val)}" ${req ? 'required' : ''} data-label="${esc(label)}" ${extra}>`;
const sel = (label, name, options, val = '', req = false) =>
  `<label class="f">${esc(label)}${req ? ' *' : ''}</label><select class="i" name="${name}" ${req ? 'required' : ''} data-label="${esc(label)}">${options.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select>`;

/* --- icone --- */
const ICON = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/></svg>',
};
const TILE_ICON = {
  evento: `<svg viewBox="0 0 64 64"><rect x="8" y="12" width="48" height="44" rx="7" fill="#f3d9a8"/><rect x="8" y="12" width="48" height="13" rx="7" fill="#9c2b23"/><rect x="18" y="6" width="5" height="12" rx="2.5" fill="#5b3a26"/><rect x="41" y="6" width="5" height="12" rx="2.5" fill="#5b3a26"/><circle cx="32" cy="40" r="11" fill="#c8812a"/><path d="M32 33v14M25 40h14" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>`,
  calendario: `<svg viewBox="0 0 64 64"><rect x="8" y="12" width="48" height="44" rx="7" fill="#fffdf8" stroke="#5b3a26" stroke-width="3"/><rect x="8" y="12" width="48" height="12" rx="6" fill="#9c2b23"/><g><rect x="15" y="30" width="9" height="8" rx="2" fill="#2f8f4e"/><rect x="28" y="30" width="9" height="8" rx="2" fill="#e8c43a"/><rect x="41" y="30" width="9" height="8" rx="2" fill="#e46a60"/><rect x="15" y="42" width="9" height="8" rx="2" fill="#1d1a17"/><rect x="28" y="42" width="9" height="8" rx="2" fill="#2f8f4e"/><rect x="41" y="42" width="9" height="8" rx="2" fill="#2f8f4e"/></g></svg>`,
  ricettario: `<svg viewBox="0 0 64 64"><path d="M12 10h34a6 6 0 0 1 6 6v38H18a6 6 0 0 1-6-6z" fill="#c8812a"/><path d="M18 54a6 6 0 0 1 0-12h34v12z" fill="#fffdf8" stroke="#5b3a26" stroke-width="2"/><path d="M26 18c0 6 2 8 6 8s6-2 6-8" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M32 26v10" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`,
  spesa: `<svg viewBox="0 0 64 64"><path d="M6 12h8l6 30h30l6-22H17" fill="none" stroke="#5b3a26" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 22h35l-5 17H22z" fill="#2f8f4e"/><circle cx="24" cy="51" r="5" fill="#9c2b23"/><circle cx="46" cy="51" r="5" fill="#9c2b23"/></svg>`,
  storico: `<svg viewBox="0 0 64 64"><rect x="12" y="8" width="40" height="50" rx="6" fill="#fffdf8" stroke="#5b3a26" stroke-width="3"/><rect x="24" y="4" width="16" height="9" rx="3" fill="#9c2b23"/><path d="M19 25l4 4 7-8" stroke="#2f8f4e" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M19 38l4 4 7-8" stroke="#e8c43a" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M34 27h11M34 40h11" stroke="#7a6a5c" stroke-width="3" stroke-linecap="round"/></svg>`,
  documenti: `<svg viewBox="0 0 64 64"><path d="M8 18a5 5 0 0 1 5-5h13l5 6h20a5 5 0 0 1 5 5v25a5 5 0 0 1-5 5H13a5 5 0 0 1-5-5z" fill="#c8812a"/><rect x="18" y="24" width="30" height="22" rx="3" fill="#fffdf8"/><path d="M23 31h20M23 37h14" stroke="#9c2b23" stroke-width="3" stroke-linecap="round"/></svg>`,
  bilancio: `<svg viewBox="0 0 64 64"><path d="M32 8v46M14 54h36" stroke="#5b3a26" stroke-width="4" stroke-linecap="round"/><path d="M12 18h40" stroke="#5b3a26" stroke-width="3.5" stroke-linecap="round"/><path d="M6 36l8-18 8 18z" fill="#2f8f4e"/><path d="M42 36l8-18 8 18z" fill="#e46a60"/><circle cx="32" cy="12" r="4" fill="#9c2b23"/></svg>`,
  magazzino: `<svg viewBox="0 0 64 64"><path d="M6 26L32 10l26 16v30H6z" fill="#c8812a"/><rect x="15" y="30" width="34" height="26" fill="#fffdf8"/><rect x="19" y="42" width="11" height="10" fill="#9c2b23"/><rect x="34" y="42" width="11" height="10" fill="#2f8f4e"/><rect x="26" y="32" width="12" height="9" fill="#e8c43a"/></svg>`,
  cert: `<svg viewBox="0 0 64 64"><rect x="8" y="10" width="48" height="36" rx="5" fill="#fffdf8" stroke="#5b3a26" stroke-width="3"/><path d="M16 22h32M16 30h20" stroke="#7a6a5c" stroke-width="3" stroke-linecap="round"/><circle cx="44" cy="42" r="10" fill="#9c2b23"/><path d="M38 50l-3 10 9-4 9 4-3-10" fill="#c8812a"/><path d="M40 42l3 3 5-6" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>`,
  manuali: `<svg viewBox="0 0 64 64"><rect x="10" y="10" width="14" height="44" rx="3" fill="#9c2b23"/><rect x="26" y="14" width="12" height="40" rx="3" fill="#c8812a"/><rect x="40" y="10" width="13" height="44" rx="3" fill="#2f8f4e" transform="rotate(8 46 32)"/><path d="M13 20h8M29 24h6" stroke="#fff" stroke-width="2.5"/></svg>`,
};
