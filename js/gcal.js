/* =====================================================================
   GCAL – sincronizzazione con Google Calendar (stesso file in JOB, Casa, APROLOCO)
   - L'app crea un SUO calendario su Google (es. "JOB – scadenze") e lo tiene
     allineato: aggiunge, modifica e cancella gli eventi da sola.
   - Permesso richiesto: solo i calendari creati dall'app (calendar.app.created).
     L'app non vede né tocca gli altri tuoi calendari.
   - Nessun server: il telefono parla direttamente con Google.
   ===================================================================== */
const GCAL_CLIENT_ID = ''; // <-- ID client OAuth di Google Cloud (xxxx.apps.googleusercontent.com)

const GCAL = (() => {
  const SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
  const API = 'https://www.googleapis.com/calendar/v3';
  const TZ = 'Europe/Rome';
  let C = null;          // configurazione dell'app
  let st = null;         // stato salvato: {connected, calId, h:{id:hash}, last, tok, exp}
  let tc = null;         // token client di Google
  let tokCb = null, busy = false, again = false, timer = null, lastErr = '';

  /* ---------- stato locale ---------- */
  const K = () => 'gcal_' + C.app;
  function load() { try { st = JSON.parse(localStorage.getItem(K())) || {}; } catch (e) { st = {}; } st.h = st.h || {}; }
  function persist() { try { localStorage.setItem(K(), JSON.stringify(st)); } catch (e) { } }
  const tokenOk = () => st.tok && Date.now() < (st.exp || 0) - 60000;

  /* ---------- utilità ---------- */
  function hash(s, seed) { let h = seed >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); }
  // id evento Google: solo caratteri a-v e 0-9 → uso esadecimale
  const evId = key => 'a' + hash(key, 2166136261) + hash(key, 3141592653) + hash(key, 2718281828);
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  function plusDays(s, n) { const [y, m, d] = s.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); }
  function plusMin(date, time, min) {
    const [y, m, d] = date.split('-').map(Number), [h, mi] = time.split(':').map(Number);
    const x = new Date(y, m - 1, d, h, mi + min);
    return iso(x) + 'T' + pad(x.getHours()) + ':' + pad(x.getMinutes()) + ':00';
  }
  const okDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const okTime = s => typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);

  /* spec evento dell'app → evento Google
     {key, title, date, end?, time?, endTime?, dur?, desc?, rrule?, remindDays?, color?} */
  function body(s) {
    const b = { summary: s.title || '(senza titolo)', description: s.desc || '', status: 'confirmed' };
    const ov = [];
    if (okTime(s.time)) {
      const ed = okDate(s.end) ? s.end : s.date;
      const en = okTime(s.endTime) && (ed + s.endTime) > (s.date + s.time) ? ed + 'T' + s.endTime + ':00' : plusMin(s.date, s.time, s.dur || 60);
      b.start = { dateTime: s.date + 'T' + s.time + ':00', timeZone: TZ };
      b.end = { dateTime: en, timeZone: TZ };
      if (s.remindDays != null) ov.push(s.remindDays * 1440);
      if (s.remindMin != null) ov.push(s.remindMin);
    } else {
      const ed = okDate(s.end) && s.end >= s.date ? s.end : s.date;
      b.start = { date: s.date }; b.end = { date: plusDays(ed, 1) };
      b.transparency = 'transparent'; // non segna "occupato"
      if (s.remindDays != null && s.remindDays >= 1) ov.push(s.remindDays * 1440 - 540); // N giorni prima alle 9:00
    }
    if (s.rrule) b.recurrence = ['RRULE:' + s.rrule];
    b.reminders = { useDefault: false, overrides: ov.filter(m => m >= 0).map(m => ({ method: 'popup', minutes: Math.min(m, 40320) })).slice(0, 5) };
    if (s.color) b.colorId = String(s.color);
    return b;
  }

  function desired() {
    const out = {};
    let list = [];
    try { list = C.events() || []; } catch (e) { console.error('GCAL events()', e); return null; }
    for (const s of list) {
      if (!s || !s.key || !okDate(s.date)) continue;
      let id = evId(C.app + '|' + s.key), k = 2;
      while (out[id]) id = evId(C.app + '|' + s.key + '#' + k++); // chiavi doppie
      const b = body(s);
      out[id] = { b, h: hash(JSON.stringify(b), 5381) + hash(JSON.stringify(b), 33) };
    }
    return out;
  }
  function diff() {
    const want = desired(); if (!want) return { up: [], del: [], n: 0 };
    const up = Object.keys(want).filter(id => st.h[id] !== want[id].h);
    const del = Object.keys(st.h).filter(id => !want[id]);
    return { want, up, del, n: up.length + del.length };
  }

  /* ---------- Google: accesso ---------- */
  function preload() {
    if (!GCAL_CLIENT_ID || (window.google && google.accounts && google.accounts.oauth2) || document.getElementById('gsi-js')) { mkClient(); return; }
    const s = document.createElement('script');
    s.id = 'gsi-js'; s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = mkClient;
    document.head.appendChild(s);
  }
  function mkClient() {
    if (tc || !GCAL_CLIENT_ID || !(window.google && google.accounts && google.accounts.oauth2)) return;
    tc = google.accounts.oauth2.initTokenClient({
      client_id: GCAL_CLIENT_ID, scope: SCOPE,
      callback: r => {
        const cb = tokCb; tokCb = null;
        if (r && r.access_token) { st.tok = r.access_token; st.exp = Date.now() + (r.expires_in || 3600) * 1000; persist(); cb && cb(true); }
        else { lastErr = 'Accesso a Google non riuscito'; ui(); cb && cb(false); }
      },
      error_callback: e => { const cb = tokCb; tokCb = null; lastErr = e && e.type === 'popup_closed' ? 'Accesso annullato' : 'Accesso a Google non riuscito (popup bloccato?)'; ui(); cb && cb(false); }
    });
  }
  // da chiamare DIRETTAMENTE dentro un click (altrimenti il browser blocca la finestra di Google)
  function auth(then, consent) {
    if (tokenOk()) { then(true); return; }
    if (!GCAL_CLIENT_ID) { msg('Manca l\'ID client di Google: configurazione da completare'); return; }
    if (!tc) { preload(); msg('Sto caricando Google… riprova tra un attimo'); return; }
    tokCb = then;
    tc.requestAccessToken({ prompt: consent ? 'consent' : '' });
  }

  async function call(method, path, data) {
    for (let i = 0; i < 4; i++) {
      const r = await fetch(API + path, { method, headers: { Authorization: 'Bearer ' + st.tok, 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
      if (r.status === 429 || (r.status === 403 && i < 3 && /rate|quota/i.test(await r.clone().text()))) { await new Promise(z => setTimeout(z, 800 * (i + 1) * (i + 1))); continue; }
      if (r.status === 401) { st.tok = null; persist(); throw Object.assign(new Error('auth'), { auth: true }); }
      let j = null; if (r.status !== 204) j = await r.json().catch(() => null);
      return { s: r.status, j };
    }
    throw new Error('Google è sovraccarico, riprovo più tardi');
  }

  /* ---------- sincronizzazione ---------- */
  async function ensureCal() {
    if (st.calId) {
      const r = await call('GET', '/calendars/' + encodeURIComponent(st.calId));
      if (r.s === 200) return;
      if (r.s !== 404 && r.s !== 403) throw new Error('Calendario non raggiungibile (' + r.s + ')');
    }
    // calendario mai creato, oppure cancellato da Google → lo ricreo
    const r = await call('POST', '/calendars', { summary: C.calName, description: 'Creato e aggiornato automaticamente dall\'app ' + C.label + '. Le modifiche fatte qui vengono sovrascritte.', timeZone: TZ });
    if (r.s !== 200) throw new Error('Impossibile creare il calendario (' + r.s + ')');
    st.calId = r.j.id; st.h = {}; persist();
  }
  async function run(force) {
    if (!st.connected || !tokenOk()) { ui(); return; }
    if (!force && st.calId && !diff().n) { ui(); return; }
    if (busy) { again = true; return; }
    busy = true; lastErr = ''; ui();
    try {
      await ensureCal();
      const d = diff(), cal = '/calendars/' + encodeURIComponent(st.calId) + '/events';
      const jobs = [
        ...d.up.map(id => async () => {
          const b = d.want[id].b;
          let r = await call('PUT', cal + '/' + id, b);
          if (r.s === 404) r = await call('POST', cal, Object.assign({ id }, b));
          if (r.s === 409) r = await call('PUT', cal + '/' + id, b);
          if (r.s === 200) st.h[id] = d.want[id].h; else console.warn('GCAL up', r.s, r.j);
        }),
        ...d.del.map(id => async () => {
          const r = await call('DELETE', cal + '/' + id);
          if (r.s === 204 || r.s === 200 || r.s === 404 || r.s === 410) delete st.h[id]; else console.warn('GCAL del', r.s, r.j);
        })
      ];
      let k = 0, n = 0;
      const worker = async () => { while (k < jobs.length) { const j = jobs[k++]; await j(); if (++n % 10 === 0) persist(); } };
      await Promise.all([worker(), worker(), worker(), worker()]);
      st.last = Date.now(); persist();
      if (jobs.length && C.toast) C.toast('Google Calendar aggiornato');
    } catch (e) {
      persist();
      lastErr = e.auth ? '' : (e.message || 'Errore di sincronizzazione');
      if (!e.auth) console.error('GCAL', e);
    } finally {
      busy = false; ui();
      if (again) { again = false; setTimeout(run, 300); }
    }
  }

  /* ---------- interfaccia ---------- */
  function msg(t) { if (C && C.toast) C.toast(t); else alert(t); }
  function chip() {
    let el = document.getElementById('gcal-chip');
    if (!el) {
      el = document.createElement('button'); el.id = 'gcal-chip'; el.type = 'button';
      el.style.cssText = 'position:fixed;left:12px;bottom:calc(' + (C.chipBottom || 14) + 'px + env(safe-area-inset-bottom));z-index:9000;border:0;border-radius:20px;padding:9px 14px;font:600 13px system-ui,sans-serif;background:#1a73e8;color:#fff;box-shadow:0 3px 10px rgba(0,0,0,.25);display:none;cursor:pointer';
      el.onclick = () => GCAL.sync();
      document.body.appendChild(el);
    }
    return el;
  }
  function ui() {
    if (!C) return;
    const el = chip(), n = st.connected ? diff().n : 0;
    if (busy) { el.textContent = '⏳ Google Calendar…'; el.style.display = ''; }
    else if (st.connected && n && !tokenOk()) { el.textContent = '📆 Aggiorna Google Calendar (' + n + ')'; el.style.display = ''; }
    else el.style.display = 'none';
    const p = document.getElementById('gcal-panel'); if (p) p.innerHTML = inner();
  }
  function inner() {
    const b = C.btn || 'btn', b2 = C.btn2 || b;
    if (!GCAL_CLIENT_ID) return '<p style="margin:0">Collegamento a Google Calendar non ancora configurato (manca l\'ID client).</p>';
    if (!st.connected) return `<p style="margin:0 0 10px">Le scadenze di ${C.label} compariranno in un calendario dedicato <b>“${C.calName}”</b> sul tuo Google Calendar, aggiornato automaticamente.</p>
      <button type="button" class="${b}" onclick="GCAL.connect()">📆 Collega Google Calendar</button>`;
    const n = diff().n, last = st.last ? new Date(st.last).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'mai';
    return `<p style="margin:0 0 6px">✅ Collegato al calendario <b>“${C.calName}”</b>.</p>
      <p style="margin:0 0 10px;opacity:.75;font-size:.9em">Ultimo aggiornamento: ${last}${n ? ' · ' + n + ' modifiche da inviare' : ' · tutto allineato'}${busy ? ' · in corso…' : ''}</p>
      ${lastErr ? `<p style="margin:0 0 10px;color:#b3261e">${lastErr}</p>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="${b}" onclick="GCAL.sync()">🔄 Sincronizza ora</button>
      <button type="button" class="${b2}" onclick="GCAL.disconnect()">Scollega</button></div>`;
  }

  return {
    /* cfg: {app, label, calName, events: () => [spec…], toast?, btn?, btn2?} */
    init(cfg) {
      C = cfg; load();
      const go = () => { if (st.connected || GCAL_CLIENT_ID) preload(); ui(); if (tokenOk()) run(); };
      if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') GCAL.changed(); });
    },
    /* da chiamare dopo ogni salvataggio dei dati */
    changed() { if (!C || !st.connected) return; clearTimeout(timer); timer = setTimeout(() => { if (tokenOk()) run(); else ui(); }, 1500); },
    connect() { auth(ok => { if (!ok) return; st.connected = true; persist(); run(true); }, true); },
    sync() { if (!st.connected) return GCAL.connect(); auth(ok => { if (ok) run(true); }); },
    disconnect() {
      if (!confirm('Scollegare Google Calendar? Il calendario “' + C.calName + '” resta su Google (puoi cancellarlo da lì), ma non verrà più aggiornato.')) return;
      if (st.tok && window.google && google.accounts && google.accounts.oauth2) try { google.accounts.oauth2.revoke(st.tok, () => { }); } catch (e) { }
      st.connected = false; st.tok = null; st.exp = 0; persist(); ui(); // calId resta: ricollegando si riusa lo stesso calendario
    },
    panel() { setTimeout(ui, 0); return '<div id="gcal-panel">' + inner() + '</div>'; },
    _evId: evId, _body: body
  };
})();
