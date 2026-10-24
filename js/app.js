'use strict';
/* ===== APROLOCO — navigazione e pagine ===== */

function go(h) { if (location.hash === h) render(); else location.hash = h; }
A.go = d => go(d.h);

const TITLES = {
  home: 'APROLOCO', wizard: 'Nuovo evento', calendario: 'Calendario', ricettario: 'Ricettario', ricette: 'Ricette', ricetta: 'Ricetta', 'ricetta-edit': 'Ricetta',
  fornitori: 'Fornitori', preventivatore: 'Preventivatore menu', listino: 'Listino prezzi', 'storico-menu': 'Storico menu', preventivo: 'Preventivo',
  spesa: 'Spesa', eventi: 'Storico eventi', evento: 'Checklist evento', documenti: 'Documenti', bilancio: 'Bilancio', 'bilancio-eventi': 'Bilancio eventi',
  'bilancio-evento': 'Bilancio evento', 'bilancio-annuale': 'Bilancio annuale', scadenze: 'Calendario scadenze', magazzino: 'Magazzino',
  certificazioni: 'Certificazioni', manuali: 'Manuali', impostazioni: 'Impostazioni',
};
const PARENT = { ricette: '#/ricettario', ricetta: '#/ricette', 'ricetta-edit': '#/ricette', fornitori: '#/ricettario', preventivatore: '#/ricettario', listino: '#/preventivatore', 'storico-menu': '#/ricettario', preventivo: '#/storico-menu', evento: '#/eventi', 'bilancio-eventi': '#/bilancio', 'bilancio-evento': '#/bilancio-eventi', 'bilancio-annuale': '#/bilancio', scadenze: '#/bilancio' };

function render() {
  const app = $('#app');
  if (!CFG.mode) { app.innerHTML = viewLogin(); return; }
  const [, page = 'home', p1, p2] = (location.hash || '#/home').split('/');
  document.body.classList.toggle('ro', !canEdit());
  const views = {
    home: viewHome, wizard: viewWizard, calendario: viewCalendario, ricettario: viewRicettario, ricette: () => viewRicette(p1), ricetta: () => viewRicetta(p1),
    'ricetta-edit': () => viewRicettaEdit(p1, p2), fornitori: viewFornitori, preventivatore: viewPreventivatore, listino: viewListino, 'storico-menu': viewStoricoMenu,
    preventivo: () => viewPreventivo(p1), spesa: viewSpesa, eventi: viewEventi, evento: () => viewEvento(p1, p2), documenti: viewDocumenti, bilancio: viewBilancio,
    'bilancio-eventi': viewBilancioEventi, 'bilancio-evento': () => viewBilancioEvento(p1), 'bilancio-annuale': () => viewBilancioAnnuale(p1), scadenze: viewScadenze,
    magazzino: viewMagazzino, certificazioni: viewCertificazioni, manuali: viewManuali, impostazioni: viewImpostazioni,
  };
  const v = views[page] || viewHome;
  const title = page === 'ricette' && p1 ? decodeURIComponent(p1) : TITLES[page] || 'APROLOCO';
  const back = page === 'home' ? '' : `<button class="ib" data-a="back" data-p="${page}" aria-label="Indietro">${ICON.back}</button>`;
  const sy = page === (UI.lastPage || '') ? window.scrollY : 0;
  app.innerHTML = `<header class="top">${back}<h1>${esc(title)}</h1><span class="role">${esc(ROLE_LABEL[CFG.role] || '')}</span>
     ${page !== 'home' ? `<button class="ib" data-a="go" data-h="#/home" aria-label="Home">${ICON.home}</button>` : `<button class="ib" data-a="reload" aria-label="Aggiorna">${ICON.refresh}</button><button class="ib" data-a="go" data-h="#/impostazioni" aria-label="Impostazioni">${ICON.gear}</button>`}</header>
     <main>${isLocal() ? '<div class="banner">Modalità prova: i dati restano solo su questo dispositivo. Collega il server dalle Impostazioni per condividerli con il direttivo.</div>' : ''}${v()}</main>`;
  if (UI.lastPage === page) window.scrollTo(0, sy); else window.scrollTo(0, 0);
  UI.lastPage = page;
  if (page === 'evento' && p2 && UI.scrollTo !== location.hash) { UI.scrollTo = location.hash; const el = $('#pt-' + p2); if (el) el.scrollIntoView({ block: 'start' }); }
}
A.back = d => { const p = PARENT[d.p]; if (d.p === 'ricette' && location.hash.split('/')[2]) return go('#/ricette'); if (d.p === 'ricetta-edit' && location.hash.split('/')[2]) { const r = recipeById(location.hash.split('/')[2]); if (r) return go('#/ricetta/' + r.id); } if (d.p === 'ricetta') { const r = recipeById(location.hash.split('/')[2]); if (r) return go('#/ricette/' + encodeURIComponent(r.cat)); } go(p || '#/home'); };
A.reload = async () => { busy(true, 'Aggiorno…'); try { await loadAll(); } finally { busy(false); } render(); toast('Dati aggiornati'); };

/* ---------- ACCESSO ---------- */
function viewLogin() {
  return `<header class="top"><h1>APROLOCO</h1></header><main><div class="wz">
   <div class="panel"><h2>Accesso</h2>
   <p class="small muted">Il direttivo entra con il PIN di consultazione. Presidente, responsabile contabile e responsabile cucine con il proprio PIN, che permette di modificare.</p>
   ${fld('Indirizzo del server', 'server', CFG.server || DEFAULT_SERVER, 'url', true, 'id="lg-srv"')}
   ${fld('PIN', 'pin', '', 'password', true, 'id="lg-pin" inputmode="numeric" autocomplete="current-password"')}
   <button class="btn big" data-a="login">ENTRA</button></div>
   <div class="panel"><h3>Solo per provare</h3><p class="small muted">Usa l'app senza server: i dati restano su questo dispositivo e non vengono condivisi.</p>
   <button class="btn big sec" data-a="loginLocal">PROVA IN LOCALE</button></div></div></main>`;
}
A.login = async () => {
  const server = $('#lg-srv').value.trim(), pin = $('#lg-pin').value.trim();
  if (!server || !pin) return toast('Inserisci indirizzo del server e PIN');
  Object.assign(CFG, { server, pin });
  busy(true, 'Verifico il PIN…');
  try {
    const r = await (await api('/api/login')).json();
    Object.assign(CFG, { mode: 'remote', role: r.role, canEdit: r.canEdit }); saveCfg();
    await loadAll(); go('#/home');
  } catch (e) { toast('Accesso non riuscito: ' + e.message); }
  finally { busy(false); }
};
A.loginLocal = async () => { Object.assign(CFG, { mode: 'local', role: 'locale', canEdit: true }); saveCfg(); await loadAll(); go('#/home'); };
function viewImpostazioni() {
  return `<div class="panel"><h3>Accesso</h3><p>Ruolo: <b>${esc(ROLE_LABEL[CFG.role] || '')}</b>${isLocal() ? '' : `<br><span class="small muted">Server: ${esc(CFG.server)}</span>`}</p>
   <button class="btn sec" data-a="logout">${isLocal() ? 'Collega il server / cambia accesso' : 'Esci / cambia PIN'}</button></div>
   <div class="panel"><h3>Installazione</h3><p class="small">Su PC (Chrome o Edge): icona "Installa" nella barra dell'indirizzo. Su Android: menu ⋮ → "Installa app" o "Aggiungi a schermata Home".</p>
   ${UI.installEvt ? '<button class="btn" data-a="install">INSTALLA L\'APP</button>' : ''}</div>
   <div class="panel"><h3>Backup</h3><p class="small muted">Scarica tutti i dati (senza i file PDF) in un file JSON.</p><button class="btn sec" data-a="backup">Scarica backup</button>
   ${canEdit() ? '<button class="btn sec" data-a="restore">Ripristina da backup</button>' : ''}</div>
   <p class="small muted">APROLOCO v${APP_VERSION}</p>`;
}
A.logout = () => { delete CFG.mode; delete CFG.pin; delete CFG.role; delete CFG.canEdit; saveCfg(); go('#/home'); };
A.install = async () => { if (UI.installEvt) { UI.installEvt.prompt(); UI.installEvt = null; render(); } };
A.backup = () => downloadBlob(new Blob([JSON.stringify(DB, null, 1)], { type: 'application/json' }), `APROLOCO_backup_${today()}.json`);
A.restore = async () => {
  const f = await pickFile('application/json,.json'); if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    confirmBox('Sostituire tutti i dati attuali con quelli del backup?', async () => { for (const k of Object.keys(DEFAULTS)) if (data[k] !== undefined) DB[k] = data[k]; await save(...Object.keys(DEFAULTS)); render(); toast('Backup ripristinato'); }, 'Ripristina');
  } catch { toast('File di backup non valido'); }
};

/* ---------- HOME ---------- */
const HOME_TILES = [
  ['NUOVO EVENTO', '#/wizard', 'evento'], ['CALENDARIO', '#/calendario', 'calendario'], ['RICETTARIO', '#/ricettario', 'ricettario'], ['SPESA', '#/spesa', 'spesa'],
  ['STORICO EVENTI', '#/eventi', 'storico'], ['DOCUMENTI', '#/documenti', 'documenti'], ['BILANCIO', '#/bilancio', 'bilancio'], ['MAGAZZINO', '#/magazzino', 'magazzino'],
  ['CERTIFICAZIONI', '#/certificazioni', 'cert'], ['MANUALI', '#/manuali', 'manuali'],
];
function viewHome() {
  const al = activeAlerts(), t = today();
  return `<div class="panel"><h2>⏰ Scadenze</h2>
    ${al.map(a => { const left = diffDays(a.date, t); return `<div class="alert ${left < 0 ? 'late' : ''} ${a.type === 'cert' ? 'cert' : ''}" data-a="go" data-h="${a.link}">
      <div><b>${esc(a.label)}</b><span class="small muted">${esc(a.sub)}</span></div><span class="d">${fmtD(a.date)}<br><span class="small">${left < 0 ? 'scaduta da ' + (-left) + ' gg' : left === 0 ? 'oggi' : 'tra ' + left + ' gg'}</span></span></div>`; }).join('') || '<div class="small muted">Nessuna scadenza nei prossimi giorni.</div>'}
  </div>
  <div class="tiles">${HOME_TILES.map(([t, h, ic], i) => `<div class="tile" data-a="${i === 0 ? 'newEvent' : 'go'}" data-h="${h}">${TILE_ICON[ic]}<span>${t}</span></div>`).join('')}</div>`;
}
A.newEvent = () => { if (!canEdit()) return toast('Solo presidente, resp. contabile e resp. cucine possono creare eventi'); WZS = null; go('#/wizard'); };

/* ---------- CALENDARIO ---------- */
function calendarIndex() {
  const idx = {};
  const at = d => (idx[d] = idx[d] || { pro: [], terzi: [], comune: [], scad: [] });
  eventCalendarEntries().forEach(e => at(e.d).pro.push(e));
  DB.bookings.forEach(b => { if (b.tipo === 'proloco') at(b.d).pro.push({ label: b.nome || b.nota || 'Impegno Proloco', booking: b }); else at(b.d)[b.tipo].push(b); });
  allDeadlines().forEach(s => at(s.date).scad.push(s));
  return idx;
}
function dayClass(info) {
  if (!info) return 'c-free';
  if (info.comune.length) return 'c-comune';
  if (info.pro.length && info.terzi.length) return 'c-both';
  if (info.pro.length) return 'c-pro';
  if (info.terzi.length) return 'c-terzi';
  return 'c-free';
}
function viewCalendario() {
  const now = new Date();
  if (UI.calY == null) { UI.calY = now.getFullYear(); UI.calM = now.getMonth(); }
  const y = UI.calY, m = UI.calM, idx = calendarIndex(), t = today();
  const first = new Date(y, m, 1), startDow = (first.getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
  let cells = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(d => `<div class="wd">${d}</div>`).join('');
  for (let i = 0; i < startDow; i++) cells += '<div class="day out"></div>';
  for (let d = 1; d <= days; d++) {
    const iso = `${y}-${pad(m + 1)}-${pad(d)}`, info = idx[iso];
    const lbl = info ? [...info.terzi.map(b => `${b.nome} ${eur(b.importo)}`), ...info.comune.map(b => 'Comune' + (b.nome ? ': ' + b.nome : '')), ...info.pro.map(p => p.label)] : [];
    cells += `<div class="day ${dayClass(info)} ${iso === t ? 'today' : ''}" data-a="calDay" data-d="${iso}"><span class="num">${d}</span>${info && info.scad.length ? '<span class="clk">⏰</span>' : ''}
      ${lbl.slice(0, 2).map(l => `<span class="lbl">${esc(l)}</span>`).join('')}${lbl.length > 2 ? `<span class="lbl">+${lbl.length - 2}</span>` : ''}</div>`;
  }
  return `<div class="calhead"><button class="btn sec sm" data-a="calMove" data-v="-1">◀</button><h3>${MESI[m]} ${y}</h3><button class="btn sec sm" data-a="calMove" data-v="1">▶</button></div>
  <div class="cal">${cells}</div>
  <div class="row" style="margin-top:12px"><button class="btn edit grow" data-a="prenota">PRENOTA</button><button class="btn sec" data-a="calToday">Oggi</button></div>
  <div class="legend">
    <span><i style="background:#cdebd5"></i>Libero</span><span><i style="background:#f7df7a"></i>Salone affittato a terzi</span>
    <span><i style="background:#e46a60"></i>Evento / impegno Proloco</span><span><i style="background:linear-gradient(135deg,#e46a60 0 50%,#f7df7a 50% 100%)"></i>Evento Proloco + affitto a terzi</span>
    <span><i style="background:#1d1a17"></i>Salone impegnato dal Comune</span><span><i style="display:grid;place-items:center;font-style:normal">⏰</i>Scadenza</span>
  </div>`;
}
A.calMove = d => { UI.calM += +d.v; if (UI.calM < 0) { UI.calM = 11; UI.calY--; } if (UI.calM > 11) { UI.calM = 0; UI.calY++; } render(); };
A.calToday = () => { UI.calY = null; render(); };
A.calDay = d => {
  const info = calendarIndex()[d.d] || { pro: [], terzi: [], comune: [], scad: [] };
  const del = b => canEdit() ? ` <button type="button" class="btn sm sec" data-a="bookDel" data-id="${b.id}">Elimina</button>` : '';
  let html = '';
  if (info.pro.length) html += `<h4>Proloco</h4>${info.pro.map(p => `<div class="card" style="margin:4px 0">${p.ev ? `<a href="#/evento/${p.ev}" data-close>${esc(p.label)}</a>` : esc(p.label)}${p.note ? ` <span class="small muted">${esc(p.note)}</span>` : ''}${p.booking ? del(p.booking) : ''}</div>`).join('')}`;
  if (info.terzi.length) html += `<h4>Affitto a terzi</h4>${info.terzi.map(b => `<div class="card" style="margin:4px 0"><b>${esc(b.nome)}</b> · ${eur(b.importo)}${b.nota ? `<div class="small muted">${esc(b.nota)}</div>` : ''}${del(b)}</div>`).join('')}`;
  if (info.comune.length) html += `<h4>Comune</h4>${info.comune.map(b => `<div class="card" style="margin:4px 0">${esc(b.nome || 'Salone impegnato dal Comune')}${b.nota ? ` <span class="small muted">${esc(b.nota)}</span>` : ''}${del(b)}</div>`).join('')}`;
  if (info.scad.length) html += `<h4>⏰ Scadenze</h4>${info.scad.map(s => `<div class="card" style="margin:4px 0"><a href="${s.link}" data-close>${esc(s.label)}</a> <span class="small muted">${esc(s.sub)}</span></div>`).join('')}`;
  if (!html) html = '<p class="muted">Giorno libero.</p>';
  if (canEdit()) html += `<div class="row" style="margin-top:12px">${!info.pro.length ? `<button type="button" class="btn sm" data-a="prenota" data-d="${d.d}" data-t="terzi">Prenota a terzi</button>` : ''}
    <button type="button" class="btn sm sec" data-a="prenota" data-d="${d.d}" data-t="comune">Comune</button><button type="button" class="btn sm sec" data-a="prenota" data-d="${d.d}" data-t="proloco">Impegno Proloco</button></div>`;
  modal(fmtD(d.d), html, null, { cancel: 'Chiudi' });
};
A.prenota = d => {
  if (!canEdit()) return;
  const form = modal('Prenota il salone', `
    ${sel('Tipo', 'tipo', [['terzi', 'Affitto a terzi'], ['comune', 'Comune'], ['proloco', 'Impegno Proloco']], d.t || 'terzi', true)}
    <div class="cols"><div>${fld('Dal giorno', 'dal', d.d || today(), 'date', true)}</div><div>${fld('Al giorno (facoltativo)', 'al', '', 'date')}</div></div>
    <div id="pr-nome">${fld('Nome di chi prenota / descrizione', 'nome', '', 'text')}</div>
    <div id="pr-imp">${fld('Quanto paga (€)', 'importo', '', 'text', false, 'inputmode="decimal"')}</div>
    ${fld('Nota', 'nota', '')}`, async f => {
    const terzi = f.tipo === 'terzi';
    if (terzi && !f.nome.trim()) { toast('Per l\'affitto a terzi il nome è obbligatorio'); return false; }
    if (terzi && !String(f.importo).trim()) { toast('Per l\'affitto a terzi l\'importo è obbligatorio'); return false; }
    const days = daysRange(f.dal, f.al || f.dal);
    const idx = calendarIndex();
    if (terzi) { const busyD = days.filter(x => idx[x] && idx[x].pro.length); if (busyD.length) { toast('Giorno con evento Proloco: ' + busyD.map(fmtD).join(', ')); return false; } }
    const g = uid();
    days.forEach(x => DB.bookings.push({ id: uid(), g, tipo: f.tipo, d: x, nome: f.nome.trim(), importo: terzi ? num(f.importo) : 0, nota: f.nota.trim() }));
    await save('bookings'); render();
  });
  const upd = () => { const t = $('[name=tipo]', form).value; $('#pr-imp', form).classList.toggle('hidden', t !== 'terzi'); $('label', $('#pr-nome', form)).textContent = t === 'terzi' ? 'Nome di chi prenota *' : 'Descrizione'; $('label', $('#pr-imp', form)).textContent = 'Quanto paga (€) *'; };
  $('[name=tipo]', form).addEventListener('change', upd); upd();
};
A.bookDel = d => { const b = DB.bookings.find(x => x.id === d.id); confirmBox(`Eliminare la prenotazione del ${fmtD(b.d)}?`, async () => { DB.bookings = DB.bookings.filter(x => x.id !== d.id); await save('bookings'); render(); }, 'Elimina'); };

/* ---------- RICETTARIO ---------- */
function viewRicettario() {
  return `<div class="bigbtns"><button class="btn" data-a="go" data-h="#/ricette">RICETTE</button><button class="btn" data-a="go" data-h="#/fornitori">FORNITORI</button>
   <button class="btn" data-a="go" data-h="#/preventivatore">PREVENTIVATORE MENU</button><button class="btn" data-a="go" data-h="#/storico-menu">STORICO MENU</button></div>`;
}
function viewRicette(cat) {
  if (!cat) return `<div class="bigbtns">${REC_CATS.map(c => `<button class="btn sec" data-a="go" data-h="#/ricette/${encodeURIComponent(c)}">${c} <span class="chip">${DB.recipes.filter(r => r.cat === c).length}</span></button>`).join('')}</div>`;
  cat = decodeURIComponent(cat);
  const rs = DB.recipes.filter(r => r.cat === cat).sort((a, b) => a.nome.localeCompare(b.nome));
  return `<div class="list">${rs.map(r => `<div class="card click" data-a="go" data-h="#/ricetta/${r.id}"><div class="t">${esc(r.nome)}</div><div class="small muted">${(r.ingredienti || []).length} ingredienti · per 10 persone</div></div>`).join('') || '<div class="empty">Nessuna ricetta in questa categoria.</div>'}</div>
   <button class="btn big edit" data-a="go" data-h="#/ricetta-edit/new/${encodeURIComponent(cat)}">+ AGGIUNGI RICETTA</button>`;
}
function viewRicetta(id) {
  const r = recipeById(id); if (!r) return '<div class="empty">Ricetta non trovata</div>';
  return `<h2 class="pg">${esc(r.nome)} <span class="chip">${esc(r.cat)}</span></h2>
  <div class="panel"><h3>Ingredienti (per 10 persone)</h3><table class="t">${(r.ingredienti || []).map(i => `<tr><td>${esc(i.nome)}</td><td class="n">${esc(i.qta)} ${esc(i.unita)}</td><td class="small muted">${esc(i.forn || 'SPESA')}</td></tr>`).join('')}</table></div>
  <div class="panel"><h3>Preparazione</h3><div style="white-space:pre-wrap">${esc(r.preparazione || '—')}</div></div>
  <div class="row edit"><button class="btn" data-a="go" data-h="#/ricetta-edit/${r.id}">Modifica</button><button class="btn bad" data-a="recDel" data-id="${r.id}">Elimina</button></div>`;
}
const UNITA = ['g', 'kg', 'ml', 'cl', 'l', 'pz'];
function ingRow(i = {}) {
  return `<div class="row ing" style="margin:6px 0"><input class="i" style="flex:2;min-width:140px" placeholder="Ingrediente" value="${esc(i.nome || '')}" data-n="nome">
   <input class="i" style="width:84px;flex:none" inputmode="decimal" placeholder="Q.tà" value="${esc(i.qta ?? '')}" data-n="qta">
   <select class="i" style="width:76px;flex:none" data-n="unita">${UNITA.map(u => `<option ${u === (i.unita || 'g') ? 'selected' : ''}>${u}</option>`).join('')}</select>
   <select class="i" style="width:140px;flex:none" data-n="forn">${FORN_CATS.map(c => `<option ${c === (i.forn || 'SPESA') ? 'selected' : ''}>${c}</option>`).join('')}</select>
   <button class="btn sm sec" data-a="ingDel">✕</button></div>`;
}
function viewRicettaEdit(id, cat) {
  if (!canEdit()) return '<div class="empty">Sola lettura</div>';
  const r = id === 'new' ? { nome: '', cat: decodeURIComponent(cat || 'PRIMI'), ingredienti: [], preparazione: '' } : recipeById(id);
  if (!r) return '<div class="empty">Ricetta non trovata</div>';
  return `<div class="panel" id="rec-form" data-id="${esc(id)}">
   ${fld('Nome della ricetta', 'nome', r.nome, 'text', true, 'id="rec-nome"')}
   ${sel('Categoria', 'cat', REC_CATS, r.cat, true).replace('<select', '<select id="rec-cat"')}
   <label class="f">Ingredienti per 10 persone (il fornitore indica in quale lista della spesa finiscono)</label>
   <div id="ings">${(r.ingredienti.length ? r.ingredienti : [{}]).map(ingRow).join('')}</div>
   <button class="btn sm sec" data-a="ingAdd">+ ingrediente</button>
   <label class="f">Preparazione (una attività per riga)</label><textarea class="i" id="rec-prep" style="min-height:180px">${esc(r.preparazione)}</textarea>
   <div class="row end" style="margin-top:12px"><button class="btn" data-a="recSave">Salva ricetta</button></div></div>`;
}
A.ingAdd = () => $('#ings').insertAdjacentHTML('beforeend', ingRow());
A.ingDel = (d, el) => el.closest('.ing').remove();
A.recSave = async () => {
  const id = $('#rec-form').dataset.id, nome = $('#rec-nome').value.trim();
  if (!nome) return toast('Scrivi il nome della ricetta');
  const ingredienti = $$('#ings .ing').map(row => Object.fromEntries($$('[data-n]', row).map(e => [e.dataset.n, e.value.trim()]))).filter(i => i.nome);
  const data = { nome, cat: $('#rec-cat').value, ingredienti, preparazione: $('#rec-prep').value.trim() };
  let r = id === 'new' ? null : recipeById(id);
  if (r) Object.assign(r, data); else { r = { id: uid(), ...data }; DB.recipes.push(r); }
  if (await save('recipes')) { toast('Ricetta salvata'); go('#/ricetta/' + r.id); }
};
A.recDel = d => { const r = recipeById(d.id); confirmBox(`Eliminare la ricetta "${r.nome}"?`, async () => { DB.recipes = DB.recipes.filter(x => x.id !== r.id); await save('recipes'); go('#/ricette/' + encodeURIComponent(r.cat)); }, 'Elimina'); };

function viewFornitori() {
  const c = UI.forn || FORN_CATS[0];
  const list = DB.suppliers[c] || [];
  return `<div class="tabs">${FORN_CATS.map(x => `<button class="${x === c ? 'on' : ''}" data-a="fornTab" data-c="${x}">${x} (${(DB.suppliers[x] || []).length})</button>`).join('')}</div>
   <div class="list">${list.map(s => `<div class="card"><div class="row"><span class="t grow">${esc(s.nome)}</span><span class="edit"><button class="btn sm sec" data-a="fornEdit" data-c="${c}" data-id="${s.id}">Modifica</button></span></div>
     <div class="small muted">${[s.tel && '📞 ' + esc(s.tel), s.email && '✉ ' + esc(s.email), s.indirizzo && esc(s.indirizzo)].filter(Boolean).join(' · ')}</div>${s.note ? `<div class="small">${esc(s.note)}</div>` : ''}</div>`).join('') || `<div class="empty">Nessun fornitore per ${c}.${c !== 'SPESA' ? ' I prodotti di questa tipologia finiscono nella voce SPESA.' : ''}</div>`}</div>
   <button class="btn big edit" data-a="fornEdit" data-c="${c}">+ AGGIUNGI FORNITORE</button>`;
}
A.fornTab = d => { UI.forn = d.c; render(); };
A.fornEdit = d => {
  const list = DB.suppliers[d.c] = DB.suppliers[d.c] || [];
  const s = list.find(x => x.id === d.id) || {};
  modal(s.id ? 'Modifica fornitore' : 'Nuovo fornitore ' + d.c, `${fld('Nome', 'nome', s.nome, 'text', true)}${fld('Telefono', 'tel', s.tel, 'tel')}${fld('Email', 'email', s.email, 'email')}${fld('Indirizzo', 'indirizzo', s.indirizzo)}${fld('Note', 'note', s.note)}
    ${s.id ? `<button type="button" class="btn sm bad" style="margin-top:12px" data-a="fornDel" data-c="${d.c}" data-id="${s.id}">Elimina fornitore</button>` : ''}`, async f => {
    if (s.id) Object.assign(s, f); else list.push({ id: uid(), ...f }); await save('suppliers'); render();
  });
};
A.fornDel = async d => { DB.suppliers[d.c] = DB.suppliers[d.c].filter(x => x.id !== d.id); closeModal(); await save('suppliers'); render(); };

/* --- preventivatore --- */
function costOf(ricette, persone) {
  const needs = aggregate(ricette.map(recipeById).filter(Boolean).flatMap(r => recipeNeeds(r, persone)));
  let tot = 0; const missing = [], stale = [], rows = [];
  for (const n of needs) {
    const p = priceFor(n.nome, n.unita);
    if (!p) { missing.push(n); rows.push({ ...n, costo: null }); continue; }
    const c = priceValue(p, n.qta); tot += c;
    if (!p.data || diffDays(today(), p.data) > 30) stale.push({ ...n, p });
    rows.push({ ...n, costo: c, p });
  }
  return { tot, perPers: persone ? tot / persone : 0, missing, stale, rows };
}
function viewPreventivatore() {
  const P = UI.prev = UI.prev || { persone: '', sel: [] };
  const pers = num(P.persone);
  const res = pers && P.sel.length ? costOf(P.sel, pers) : null;
  return `<div class="panel"><label class="f">Per quante persone si vuole cucinare?</label>
   <input class="i" type="number" min="1" value="${esc(P.persone)}" data-ch="prevPers" style="font-size:18px;max-width:200px"></div>
   ${pers ? `<div class="panel"><h3>Quali ricette mettere nel menu?</h3>${DB.recipes.length ? REC_CATS.map(c => { const rs = DB.recipes.filter(r => r.cat === c); return rs.length ? `<div style="margin-top:6px"><b class="small">${c}</b>${rs.map(r => `<label style="display:flex;gap:8px;padding:4px 0"><input type="checkbox" ${P.sel.includes(r.id) ? 'checked' : ''} data-ch="prevSel" data-id="${r.id}"> ${esc(r.nome)}</label>`).join('')}</div>` : ''; }).join('') : '<div class="small muted">Il ricettario è vuoto.</div>'}</div>` : ''}
   ${res ? `<div class="panel"><h3>Costo stimato</h3>
     <table class="t"><tr><th>Materia prima</th><th class="n">Quantità</th><th class="n">Costo</th></tr>${res.rows.map(r => `<tr><td>${esc(r.nome)}${r.p && (!r.p.data || diffDays(today(), r.p.data) > 30) ? ' <span class="chip orange">prezzo vecchio</span>' : ''}</td><td class="n">${qtyFmt(r.qta)} ${r.unita}</td><td class="n">${r.costo == null ? '<span class="chip bad">manca prezzo</span>' : eur(r.costo)}</td></tr>`).join('')}
     <tr class="tot"><td>TOTALE</td><td></td><td class="n">${eur(res.tot)}</td></tr></table>
     <div class="result ok">Costo stimato per persona: ${eur(res.perPers)}</div>
     ${res.missing.length ? `<p class="small" style="color:var(--bad)">Mancano ${res.missing.length} prezzi nel listino: il costo è sottostimato.</p>` : ''}
     ${res.stale.length ? `<p class="small" style="color:var(--orange)">${res.stale.length} prezzi hanno più di 30 giorni: aggiornali nel listino.</p>` : ''}
     <div class="row"><button class="btn sec" data-a="go" data-h="#/listino">Listino prezzi</button><span class="grow"></span><button class="btn edit" data-a="prevSave">Salva preventivo</button></div></div>`
      : `<button class="btn sec" data-a="go" data-h="#/listino">Listino prezzi</button>`}`;
}
CH.prevPers = (d, el) => { UI.prev.persone = el.value; render(); };
CH.prevSel = (d, el) => { const P = UI.prev; P.sel = el.checked ? [...new Set([...P.sel, d.id])] : P.sel.filter(x => x !== d.id); render(); };
A.prevSave = () => {
  const P = UI.prev, res = costOf(P.sel, num(P.persone));
  modal('Salva preventivo', `${fld('Nome dell\'evento', 'evento', '', 'text', true, 'list="ev-list"')}<datalist id="ev-list">${DB.events.map(e => `<option value="${esc(e.nome)}">`).join('')}</datalist>${fld('Data', 'data', today(), 'date', true)}`, async f => {
    const ev = DB.events.find(e => e.nome === f.evento);
    DB.preventivi.push({ id: uid(), evento: f.evento.trim(), evId: ev ? ev.id : '', data: f.data, persone: num(P.persone), ricette: [...P.sel], nomiRicette: P.sel.map(id => recipeById(id)?.nome).filter(Boolean), costoTot: res.tot, costoPers: res.perPers, mancanti: res.missing.length });
    await save('preventivi'); toast('Preventivo salvato nello storico menu'); go('#/storico-menu');
  });
};
function viewListino() {
  const used = new Map();
  DB.recipes.forEach(r => (r.ingredienti || []).forEach(i => { if (!i.nome) return; const u = baseUnit(1, i.unita)[1]; used.set(norm(i.nome) + '|' + u, { nome: i.nome, unita: u }); }));
  const missing = [...used.values()].filter(x => !priceFor(x.nome, x.unita));
  const ps = [...DB.prices].sort((a, b) => a.nome.localeCompare(b.nome));
  return `<p class="small muted">Prezzi delle materie prime (Piemonte). Indica la fonte (es. listino Camera di Commercio, ISMEA, fornitore) e la data: i prezzi con più di 30 giorni sono segnati in arancione.</p>
  ${missing.length ? `<div class="panel"><h3>Ingredienti senza prezzo (${missing.length})</h3><div class="row">${missing.map(x => `<button class="btn sm sec edit" data-a="priceEdit" data-nome="${esc(x.nome)}" data-u="${x.unita}">+ ${esc(x.nome)} (${x.unita})</button>`).join('')}</div></div>` : ''}
  <div class="panel"><table class="t"><tr><th>Prodotto</th><th class="n">Prezzo</th><th>Fonte</th><th>Data</th></tr>
  ${ps.map(p => { const old = !p.data || diffDays(today(), p.data) > 30; return `<tr class="${canEdit() ? 'click' : ''}" ${canEdit() ? `data-a="priceEdit" data-id="${p.id}" style="cursor:pointer"` : ''}><td>${esc(p.nome)}</td><td class="n">${eur(p.prezzo)}/${esc(p.unita)}</td><td class="small">${esc(p.fonte || '')}</td><td>${old ? `<span class="chip orange">${fmtD(p.data)}</span>` : fmtD(p.data)}</td></tr>`; }).join('') || '<tr><td colspan="4" class="muted small">Nessun prezzo inserito</td></tr>'}</table></div>
  <div class="row edit"><button class="btn" data-a="priceEdit">+ AGGIUNGI PREZZO</button><button class="btn sec" data-a="priceCsv">Importa listino (CSV)</button></div>
  <p class="small muted">CSV: una riga per prodotto, separata da punto e virgola: <code>nome;unità (kg, l, pz);prezzo;fonte;data (gg/mm/aaaa)</code></p>`;
}
A.priceEdit = d => {
  if (!canEdit()) return;
  const p = DB.prices.find(x => x.id === d.id) || { nome: d.nome || '', unita: d.u || 'kg', prezzo: '', fonte: '', data: today() };
  modal(p.id ? 'Modifica prezzo' : 'Nuovo prezzo', `${fld('Prodotto (stesso nome usato nelle ricette)', 'nome', p.nome, 'text', true)}
    <div class="cols"><div>${sel('Unità', 'unita', ['kg', 'l', 'pz'], p.unita, true)}</div><div>${fld('Prezzo (€ per unità)', 'prezzo', p.prezzo, 'text', true, 'inputmode="decimal"')}</div></div>
    ${fld('Fonte', 'fonte', p.fonte, 'text', false, 'placeholder="es. CCIAA Torino – listino settimanale"')}${fld('Data rilevazione', 'data', p.data, 'date', true)}
    ${p.id ? `<button type="button" class="btn sm bad" style="margin-top:12px" data-a="priceDel" data-id="${p.id}">Elimina</button>` : ''}`, async f => {
    const v = { nome: f.nome.trim(), unita: f.unita, prezzo: num(f.prezzo), fonte: f.fonte.trim(), data: f.data };
    if (p.id) Object.assign(p, v); else DB.prices.push({ id: uid(), ...v });
    await save('prices'); render();
  });
};
A.priceDel = async d => { DB.prices = DB.prices.filter(x => x.id !== d.id); closeModal(); await save('prices'); render(); };
A.priceCsv = async () => {
  const f = await pickFile('.csv,text/csv,text/plain'); if (!f) return;
  const lines = (await f.text()).split(/\r?\n/).filter(l => l.trim()); let n = 0;
  for (const l of lines) {
    const [nome, unita, prezzo, fonte, data] = l.split(/[;\t]/).map(s => (s || '').trim());
    if (!nome || !num(prezzo)) continue;
    let iso = today(); const m = (data || '').match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/); if (m) iso = `${m[3]}-${pad(m[2])}-${pad(m[1])}`; else if (/^\d{4}-\d\d-\d\d$/.test(data || '')) iso = data;
    const u = ['kg', 'l', 'pz'].includes((unita || '').toLowerCase()) ? unita.toLowerCase() : 'kg';
    const ex = DB.prices.find(p => norm(p.nome) === norm(nome) && p.unita === u);
    const v = { nome, unita: u, prezzo: num(prezzo), fonte: fonte || f.name, data: iso };
    if (ex) Object.assign(ex, v); else DB.prices.push({ id: uid(), ...v }); n++;
  }
  await save('prices'); toast(`${n} prezzi importati`); render();
};
function viewStoricoMenu() {
  const ps = [...DB.preventivi].sort((a, b) => b.data.localeCompare(a.data));
  return `<div class="list">${ps.map(p => `<div class="card click" data-a="go" data-h="#/preventivo/${p.id}"><div class="row"><span class="t grow">${esc(p.evento)}</span><span class="chip">${fmtD(p.data)}</span></div>
    <div class="small muted">${p.persone} persone · ${eur(p.costoPers)} a persona · totale ${eur(p.costoTot)}</div></div>`).join('') || '<div class="empty">Nessun preventivo salvato. Creali dal PREVENTIVATORE MENU.</div>'}</div>`;
}
function viewPreventivo(id) {
  const p = DB.preventivi.find(x => x.id === id); if (!p) return '<div class="empty">Preventivo non trovato</div>';
  const now = costOf(p.ricette, p.persone);
  return `<h2 class="pg">${esc(p.evento)}</h2><div class="panel"><p>Data: <b>${fmtD(p.data)}</b> · Persone: <b>${p.persone}</b></p>
   <h3>Menu</h3><ul>${p.nomiRicette.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
   <table class="t"><tr><td>Costo per persona al momento del preventivo</td><td class="n tot">${eur(p.costoPers)}</td></tr><tr><td>Costo per persona con i prezzi di oggi</td><td class="n tot">${eur(now.perPers)}</td></tr></table></div>
   <div class="row edit"><button class="btn" data-a="prevApply" data-id="${p.id}">Usa come menu di un evento</button><button class="btn sec" data-a="prevOpen" data-id="${p.id}">Apri nel preventivatore</button><button class="btn bad" data-a="prevDel" data-id="${p.id}">Elimina</button></div>`;
}
A.prevOpen = d => { const p = DB.preventivi.find(x => x.id === d.id); UI.prev = { persone: String(p.persone), sel: [...p.ricette] }; go('#/preventivatore'); };
A.prevDel = d => confirmBox('Eliminare il preventivo?', async () => { DB.preventivi = DB.preventivi.filter(x => x.id !== d.id); await save('preventivi'); go('#/storico-menu'); }, 'Elimina');
A.prevApply = d => {
  const p = DB.preventivi.find(x => x.id === d.id);
  if (!DB.events.length) return toast('Nessun evento creato');
  modal('Applica al menu dell\'evento', sel('Evento', 'ev', DB.events.map(e => [e.id, e.nome + ' – ' + fmtD(e.inizio)]), p.evId || DB.events[0].id, true) + '<p class="small muted">Il menu (punto 2) e il numero di persone dell\'evento verranno sostituiti.</p>', async f => {
    const ev = evById(f.ev); ev.menu = { persone: p.persone, ricette: [...p.ricette] }; await save('events'); toast('Menu applicato a ' + ev.nome);
  }, { ok: 'Applica' });
};

/* ---------- SPESA ---------- */
function cartData() {
  const t = today();
  const active = DB.events.filter(e => e.fine >= t);
  const all = [...active.flatMap(eventNeeds), ...DB.cart.extras.map(x => { const [q, u] = baseUnit(num(x.qta), x.unita); return { nome: x.nome, qta: q, unita: u, forn: x.forn || 'SPESA', ev: x.ev || '_extra', extraId: x.id }; })];
  const items = aggregate(all);
  const groups = {};
  items.forEach(x => (groups[groupFor(x.forn)] = groups[groupFor(x.forn)] || []).push(x));
  return { groups, active };
}
function viewSpesa() {
  const { groups, active } = cartData();
  const evName = id => id === '_extra' ? 'altro' : (evById(id)?.nome || '?');
  const multi = active.filter(e => eventNeeds(e).length).length > 1;
  const key = (g, x) => g + '|' + norm(x.nome) + '|' + x.unita;
  return `<p class="small muted">Carrello unico, alimentato dai menu degli eventi in programma${multi ? ' (con il "di cui" per ogni evento)' : ''} e dai prodotti aggiunti a mano.</p>
   ${FORN_CATS.filter(g => groups[g]).map(g => `<div class="panel"><h3>${esc(groupLabel(g))}</h3>
     ${groups[g].sort((a, b) => a.nome.localeCompare(b.nome)).map(x => { const k = key(g, x), b = !!DB.cart.bought[k]; const per = Object.entries(x.per); return `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line)">
       <input type="checkbox" ${b ? 'checked' : ''} ${canEdit() ? '' : 'disabled'} data-ch="cartBuy" data-k="${esc(k)}" style="width:22px;height:22px">
       <div class="grow" style="${b ? 'text-decoration:line-through;opacity:.6' : ''}"><b>${esc(x.nome)}</b> — ${qtyFmt(x.qta)} ${x.unita}
       ${per.length > 1 || (multi && per.length) ? `<div class="small muted">di cui: ${per.map(([e, q]) => `${esc(evName(e))} ${qtyFmt(q)} ${x.unita}`).join(' · ')}</div>` : ''}</div></div>`; }).join('')}</div>`).join('') || '<div class="empty">Il carrello è vuoto. Si riempie con il menu (punto 2) degli eventi in programma, oppure con il tasto AGGIUNGI.</div>'}
   ${DB.cart.extras.length ? `<div class="panel"><h3>Aggiunti a mano</h3>${DB.cart.extras.map(x => `<div class="row small" style="padding:3px 0"><span class="grow">${esc(x.nome)} ${x.qta ? '— ' + esc(x.qta) + ' ' + esc(x.unita) : ''} <span class="muted">(${esc(x.forn)}${x.ev ? ' · ' + esc(evName(x.ev)) : ''})</span></span><button class="btn sm sec edit" data-a="cartDel" data-id="${x.id}">✕</button></div>`).join('')}</div>` : ''}
   <div class="row edit"><button class="btn grow" data-a="cartAdd">+ AGGIUNGI</button><button class="btn sec" data-a="cartReset">Azzera spunte</button></div>`;
}
CH.cartBuy = async (d, el) => { if (el.checked) DB.cart.bought[d.k] = today(); else delete DB.cart.bought[d.k]; await save('cart'); render(); };
A.cartAdd = () => {
  const evs = DB.events.filter(e => e.fine >= today());
  modal('Aggiungi alla spesa', `${fld('Prodotto', 'nome', '', 'text', true)}<div class="cols"><div>${fld('Quantità', 'qta', '', 'text', false, 'inputmode="decimal"')}</div><div>${sel('Unità', 'unita', UNITA, 'pz')}</div></div>
   ${sel('Tipologia / fornitore', 'forn', FORN_CATS, 'SPESA')}${sel('Per l\'evento', 'ev', [['', '— nessuno —'], ...evs.map(e => [e.id, e.nome])], '')}`, async f => {
    DB.cart.extras.push({ id: uid(), nome: f.nome.trim(), qta: f.qta, unita: f.unita, forn: f.forn, ev: f.ev }); await save('cart'); render();
  });
};
A.cartDel = async d => { DB.cart.extras = DB.cart.extras.filter(x => x.id !== d.id); await save('cart'); render(); };
A.cartReset = () => confirmBox('Togliere tutte le spunte dal carrello?', async () => { DB.cart.bought = {}; await save('cart'); render(); }, 'Azzera');

/* ---------- DOCUMENTI ---------- */
const NOTE_TEMPLATE = `# NOTE PROLOCO - dati usati per compilare i documenti
# Una riga per dato, nel formato   NOME CAMPO: valore
# Il NOME CAMPO deve coincidere con il nome del campo nel PDF (lo vedi con il tasto "Campi" nella pagina DOCUMENTI).
# Maiuscole, spazi e trattini non contano: "Codice fiscale" = "CODICE_FISCALE".
DENOMINAZIONE: Pro Loco di
CODICE FISCALE:
PARTITA IVA:
SEDE:
COMUNE:
CAP:
PROVINCIA:
PEC:
EMAIL:
TELEFONO:
PRESIDENTE:
PRESIDENTE NATO A:
PRESIDENTE NATO IL:
PRESIDENTE CODICE FISCALE:
PRESIDENTE RESIDENZA:
IBAN:
LUOGO EVENTO:
# Inseriti in automatico per ogni evento: NOME EVENTO, DATA EVENTO, DATA INIZIO, DATA FINE,
# ORA INIZIO, ORA FINE, ORARIO, DATA PREPARAZIONE, DATA OGGI, ANNO
`;
function viewDocumenti() {
  const docs = [...DB.docs].sort((a, b) => a.nome.localeCompare(b.nome));
  return `<div class="panel"><h3>Documenti usati dalla checklist</h3>
   ${EXPECTED_DOCS.map(n => { const d = findDoc(n); return `<div class="row" style="padding:4px 0"><span class="chip ${d ? 'ok' : 'bad'}">${d ? 'caricato' : 'manca'}</span><b class="grow">${esc(n)}</b>
     ${!d && n === NOTE_DOC ? '<button class="btn sm edit" data-a="noteCreate">Crea</button>' : ''}${!d && n !== NOTE_DOC ? `<button class="btn sm sec edit" data-a="docAdd" data-n="${esc(n)}">Carica</button>` : ''}</div>`; }).join('')}
   <p class="small muted">Il NOME è il riferimento con cui la checklist sceglie il file: deve essere uguale a quello in elenco. I PDF con campi compilabili vengono compilati in automatico con i dati di NOTE PROLOCO e dell'evento; i file di testo possono usare segnaposto come <code>{{NOME EVENTO}}</code>.</p></div>
   <div class="list">${docs.map(d => `<div class="card"><div class="row"><span class="t grow">${esc(d.nome)}</span><span class="chip">${d.type === 'text' ? 'testo' : 'PDF'}</span></div>
     <div class="small muted">Caricato il ${fmtD(d.created)}${d.type === 'pdf' ? ` · ${d.fields?.length ? d.fields.length + ' campi compilabili' : 'nessun campo compilabile'}` : ''}</div>
     <div class="row" style="margin-top:6px"><button class="btn sm sec" data-a="docOpen" data-id="${d.id}">Apri</button>
      ${d.type === 'pdf' && d.fields?.length ? `<button class="btn sm sec" data-a="docFields" data-id="${d.id}">Campi</button>` : ''}
      ${d.type === 'text' ? `<button class="btn sm sec edit" data-a="docEditText" data-id="${d.id}">Modifica testo</button>` : ''}
      <button class="btn sm sec edit" data-a="docReplace" data-id="${d.id}">Sostituisci</button><button class="btn sm bad edit" data-a="docDel" data-id="${d.id}">Elimina</button></div></div>`).join('') || '<div class="empty">Nessun documento caricato.</div>'}</div>
   <button class="btn big edit" data-a="docAdd">+ AGGIUNGI DOCUMENTO</button>`;
}
async function docMeta(file) {
  const isPdf = /pdf/i.test(file.type) || /\.pdf$/i.test(file.name);
  const isText = /^text\//.test(file.type) || /\.(txt|csv|md)$/i.test(file.name);
  if (!isPdf && !isText) throw new Error('Carica un file PDF o di testo (.txt)');
  return { type: isPdf ? 'pdf' : 'text', fields: isPdf ? await pdfFieldNames(file) : [] };
}
A.docAdd = d => {
  const form = modal('Aggiungi documento', `${fld('NOME (riferimento per il sistema)', 'nome', d.n || '', 'text', true, 'list="doc-names"')}<datalist id="doc-names">${EXPECTED_DOCS.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <label class="f">File (PDF o testo) *</label><input class="i" type="file" name="file" accept="application/pdf,.pdf,text/plain,.txt" id="doc-file">`, async f => {
    const file = $('#doc-file').files[0]; if (!file) { toast('Scegli il file'); return false; }
    if (findDoc(f.nome)) { toast('Esiste già un documento con questo nome: usa "Sostituisci"'); return false; }
    busy(true, 'Carico…');
    try { const meta = await docMeta(file); const fileId = await putFile(file, file.name); DB.docs.push({ id: uid(), nome: f.nome.trim().toUpperCase(), fileId, fileName: file.name, created: today(), ...meta }); await save('docs'); }
    catch (e) { toast(e.message); return false; } finally { busy(false); }
    render();
  });
};
A.docReplace = async d => {
  const doc = DB.docs.find(x => x.id === d.id); const file = await pickFile('application/pdf,.pdf,text/plain,.txt'); if (!file) return;
  busy(true, 'Carico…');
  try { const meta = await docMeta(file); const old = doc.fileId; doc.fileId = await putFile(file, file.name); Object.assign(doc, meta, { fileName: file.name, created: today() }); delFile(old); await save('docs'); toast('Documento sostituito'); }
  catch (e) { toast(e.message); } finally { busy(false); render(); }
};
A.docDel = d => { const doc = DB.docs.find(x => x.id === d.id); confirmBox(`Eliminare "${doc.nome}"?`, async () => { delFile(doc.fileId); DB.docs = DB.docs.filter(x => x.id !== d.id); await save('docs'); render(); }, 'Elimina'); };
A.docOpen = d => { const doc = DB.docs.find(x => x.id === d.id); openFile(doc.fileId, doc.fileName); };
A.docFields = d => { const doc = DB.docs.find(x => x.id === d.id); modal('Campi di ' + doc.nome, `<p class="small muted">Per compilarli scrivi in NOTE PROLOCO una riga "NOME CAMPO: valore" con questi nomi.</p><ul class="small">${doc.fields.map(f => `<li><code>${esc(f)}</code></li>`).join('')}</ul>`, null, { cancel: 'Chiudi' }); };
async function textDocEditor(title, text, onSave) {
  modal(title, `<textarea class="i" name="txt" style="min-height:50vh;font-family:monospace;font-size:13px">${esc(text)}</textarea>`, async f => { await onSave(f.txt); render(); }, { noFocus: true });
}
A.noteCreate = () => textDocEditor('NOTE PROLOCO', NOTE_TEMPLATE, async txt => {
  const fileId = await putFile(new Blob([txt], { type: 'text/plain' }), 'NOTE_PROLOCO.txt');
  DB.docs.push({ id: uid(), nome: NOTE_DOC, fileId, fileName: 'NOTE_PROLOCO.txt', created: today(), type: 'text', fields: [] }); await save('docs');
});
A.docEditText = async d => {
  const doc = DB.docs.find(x => x.id === d.id);
  const txt = await (await getFile(doc.fileId)).text();
  textDocEditor(doc.nome, txt, async t => { const old = doc.fileId; doc.fileId = await putFile(new Blob([t], { type: 'text/plain' }), doc.fileName || doc.nome + '.txt'); doc.created = today(); delFile(old); await save('docs'); });
};

/* ---------- BILANCIO ---------- */
const CAT_SPESE = ['Alimentari', 'Vettovaglie', 'Intrattenimento', 'Amministrative', 'Tecniche', 'Altro'];
const CAT_ENTRATE = ['Contributo', 'Incasso', 'Sponsor'];
const sum = l => l.reduce((a, x) => a + num(x.euro), 0);
function viewBilancio() {
  return `<div class="bigbtns"><button class="btn" data-a="go" data-h="#/bilancio-eventi">BILANCIO EVENTI</button><button class="btn" data-a="go" data-h="#/bilancio-annuale">BILANCIO ANNUALE</button><button class="btn" data-a="go" data-h="#/scadenze">CALENDARIO SCADENZE</button></div>`;
}
function viewBilancioEventi() {
  const evs = [...DB.events].sort((a, b) => b.inizio.localeCompare(a.inizio));
  return `<div class="row small muted" style="margin-bottom:8px;gap:14px"><span><span class="chip ok">verde</span> aperto</span><span><span class="chip bad">rosso</span> chiuso</span></div>
  <div class="list">${evs.map(ev => { const b = ev.bilancio, diff = sum(b.entrate) - sum(b.spese); return `<div class="card click ${ev.chiuso ? 's-bad' : 's-ok'}" data-a="go" data-h="#/bilancio-evento/${ev.id}">
    <div class="row"><span class="t grow">${esc(ev.nome)}</span><span class="chip ${ev.chiuso ? 'bad' : 'ok'}">${ev.chiuso ? 'chiuso' : 'aperto'}</span></div>
    <div class="small muted">${fmtD(ev.inizio)} · ${diff >= 0 ? 'utile' : 'perdita'} ${eur(Math.abs(diff))}</div></div>`; }).join('') || '<div class="empty">Nessun evento.</div>'}</div>`;
}
function entryCol(title, list, add, del) {
  return `<div class="panel"><h3>${title}</h3><table class="t">${list.map(x => `<tr><td>${esc(x.nota)}${x.cat ? ` <span class="chip">${esc(x.cat)}</span>` : ''}<div class="small muted">${fmtD(x.data)}</div></td><td class="n">${eur(x.euro)}</td><td class="n edit"><button class="btn sm sec" data-a="${del.a}" ${del.attrs} data-e="${x.id}">✕</button></td></tr>`).join('') || '<tr><td class="muted small">Nessuna voce</td></tr>'}
   <tr class="tot"><td>TOTALE</td><td class="n">${eur(sum(list))}</td><td></td></tr></table>
   <button class="btn sm edit" style="margin-top:8px" data-a="${add.a}" ${add.attrs}>+ AGGIUNGI</button></div>`;
}
function resultBox(entrate, spese) {
  const diff = entrate - spese;
  return `<div class="result ${diff >= 0 ? 'ok' : 'bad'}">${diff >= 0 ? 'UTILE' : 'PERDITA'}: ${eur(Math.abs(diff))}</div>`;
}
function viewBilancioEvento(id) {
  const ev = evById(id); if (!ev) return '<div class="empty">Evento non trovato</div>';
  const b = ev.bilancio, E = canEdit();
  return `<h2 class="pg">${esc(ev.nome)} <span class="chip ${ev.chiuso ? 'bad' : 'ok'}">${ev.chiuso ? 'chiuso' : 'aperto'}</span></h2>
  <div class="cols">${entryCol('SPESE', b.spese, { a: 'entAdd', attrs: `data-id="${ev.id}" data-t="spese"` }, { a: 'entDel', attrs: `data-id="${ev.id}" data-t="spese"` })}
   ${entryCol('ENTRATE', b.entrate, { a: 'entAdd', attrs: `data-id="${ev.id}" data-t="entrate"` }, { a: 'entDel', attrs: `data-id="${ev.id}" data-t="entrate"` })}</div>
  ${resultBox(sum(b.entrate), sum(b.spese))}
  <div class="panel" style="margin-top:12px"><h3>Note</h3><div class="cols">
   <div><label class="f">Porzioni preparate</label><input class="i" type="number" value="${esc(b.porzioniPreparate)}" ${E ? '' : 'disabled'} data-ch="bilNote" data-id="${ev.id}" data-f="porzioniPreparate"></div>
   <div><label class="f">Porzioni servite</label><input class="i" type="number" value="${esc(b.porzioniServite)}" ${E ? '' : 'disabled'} data-ch="bilNote" data-id="${ev.id}" data-f="porzioniServite"></div></div>
   <label class="f">Altre note</label><textarea class="i" ${E ? '' : 'disabled'} data-ch="bilNote" data-id="${ev.id}" data-f="note">${esc(b.note || '')}</textarea></div>
  <button class="btn big edit ${ev.chiuso ? 'sec' : 'bad'}" data-a="evChiudi" data-id="${ev.id}">${ev.chiuso ? 'RIAPRI EVENTO' : 'CHIUDI EVENTO'}</button>`;
}
function entryModal(tipo, onSave) {
  const sp = tipo === 'spese';
  modal(sp ? 'Nuova spesa' : 'Nuova entrata', `${fld(sp ? 'Nota libera pagamento' : 'Nota libera', 'nota', '', 'text', true)}
   <div class="cols"><div>${fld('Euro', 'euro', '', 'text', true, 'inputmode="decimal"')}</div><div>${fld(sp ? 'Data pagamento' : 'Data incasso', 'data', today(), 'date', true)}</div></div>
   ${sel('Categoria (facoltativa)', 'cat', [['', '—'], ...(sp ? CAT_SPESE : CAT_ENTRATE)], '')}`, async f => {
    if (!num(f.euro)) { toast('Importo non valido'); return false; }
    await onSave({ id: uid(), nota: f.nota.trim(), euro: num(f.euro), data: f.data, cat: f.cat });
    render();
  });
}
A.entAdd = d => { const ev = evById(d.id); entryModal(d.t, async e => { ev.bilancio[d.t].push(e); await save('events'); }); };
A.entDel = d => confirmBox('Eliminare la voce?', async () => { const ev = evById(d.id); ev.bilancio[d.t] = ev.bilancio[d.t].filter(x => x.id !== d.e); await save('events'); render(); }, 'Elimina');
CH.bilNote = async (d, el) => { const ev = evById(d.id); ev.bilancio[d.f] = el.value; await save('events'); };
A.evChiudi = async d => { const ev = evById(d.id); ev.chiuso = !ev.chiuso; ev.chiusoIl = ev.chiuso ? today() : ''; await save('events'); render(); };

function yearsAvailable() {
  const ys = new Set([String(new Date().getFullYear())]);
  DB.events.forEach(e => ys.add(e.inizio.slice(0, 4))); DB.bookings.forEach(b => ys.add(b.d.slice(0, 4))); Object.keys(DB.bilancio.years || {}).forEach(y => ys.add(y));
  return [...ys].sort().reverse();
}
function viewBilancioAnnuale(y) {
  y = y || String(new Date().getFullYear());
  const Y = (DB.bilancio.years[y] = DB.bilancio.years[y] || { spese: [], entrate: [] });
  const evs = DB.events.filter(e => e.inizio.slice(0, 4) === y);
  const affitti = DB.bookings.filter(b => b.tipo === 'terzi' && b.d.slice(0, 4) === y);
  const aff = affitti.reduce((a, b) => a + num(b.importo), 0);
  const speseEv = evs.reduce((a, e) => a + sum(e.bilancio.spese), 0), entrEv = evs.reduce((a, e) => a + sum(e.bilancio.entrate), 0);
  const totS = speseEv + sum(Y.spese), totE = entrEv + aff + sum(Y.entrate);
  const evRows = (k) => evs.map(e => `<tr><td><a href="#/bilancio-evento/${e.id}">${esc(e.nome)}</a></td><td class="n">${eur(sum(e.bilancio[k]))}</td><td></td></tr>`).join('');
  const extra = (k) => Y[k].map(x => `<tr><td>${esc(x.nota)}${x.cat ? ` <span class="chip">${esc(x.cat)}</span>` : ''}<div class="small muted">${fmtD(x.data)}</div></td><td class="n">${eur(x.euro)}</td><td class="n edit"><button class="btn sm sec" data-a="yDel" data-y="${y}" data-t="${k}" data-e="${x.id}">✕</button></td></tr>`).join('');
  return `<div class="tabs">${yearsAvailable().map(x => `<button class="${x === y ? 'on' : ''}" data-a="go" data-h="#/bilancio-annuale/${x}">${x}</button>`).join('')}</div>
  <div class="cols">
   <div class="panel"><h3>SPESE ${y}</h3><table class="t">${evRows('spese')}${extra('spese')}<tr class="tot"><td>TOTALE</td><td class="n">${eur(totS)}</td><td></td></tr></table><button class="btn sm edit" style="margin-top:8px" data-a="yAdd" data-y="${y}" data-t="spese">+ AGGIUNGI</button></div>
   <div class="panel"><h3>ENTRATE ${y}</h3><table class="t">${evRows('entrate')}<tr><td>Affitti salone a terzi <span class="small muted">(${affitti.length} giorni dal calendario)</span></td><td class="n">${eur(aff)}</td><td></td></tr>${extra('entrate')}<tr class="tot"><td>TOTALE</td><td class="n">${eur(totE)}</td><td></td></tr></table><button class="btn sm edit" style="margin-top:8px" data-a="yAdd" data-y="${y}" data-t="entrate">+ AGGIUNGI</button></div>
  </div>${resultBox(totE, totS)}<p class="small muted">Gli anni precedenti restano consultabili dalle linguette in alto.</p>`;
}
A.yAdd = d => entryModal(d.t, async e => { DB.bilancio.years[d.y] = DB.bilancio.years[d.y] || { spese: [], entrate: [] }; DB.bilancio.years[d.y][d.t].push(e); await save('bilancio'); });
A.yDel = d => confirmBox('Eliminare la voce?', async () => { const Y = DB.bilancio.years[d.y]; Y[d.t] = Y[d.t].filter(x => x.id !== d.e); await save('bilancio'); render(); }, 'Elimina');

function viewScadenze() {
  const t = today(), ss = [...DB.scadenze].sort((a, b) => a.data.localeCompare(b.data));
  return `<p class="small muted">Le scadenze fiscali compaiono nel calendario (⏰) e nel riquadro SCADENZE della home 10 giorni prima.</p>
  <div class="list">${ss.map(s => { const left = diffDays(s.data, t); const cls = s.done ? 's-ok' : left < 0 ? 's-bad' : left <= 10 ? 's-warn' : ''; return `<div class="card ${cls}"><div class="row"><span class="t grow" style="${s.done ? 'text-decoration:line-through' : ''}">${esc(s.nota)}</span><span class="chip">${fmtD(s.data)}</span></div>
    <div class="row edit" style="margin-top:6px"><button class="btn sm ${s.done ? 'sec' : 'ok'}" data-a="scDone" data-id="${s.id}">${s.done ? 'Riapri' : '✓ Fatta'}</button><button class="btn sm sec" data-a="scDel" data-id="${s.id}">Elimina</button></div></div>`; }).join('') || '<div class="empty">Nessuna scadenza fiscale inserita.</div>'}</div>
  <button class="btn big edit" data-a="scAdd">+ AGGIUNGI</button>`;
}
A.scAdd = () => modal('Nuova scadenza fiscale', `${fld('Nota', 'nota', '', 'text', true)}${fld('Data scadenza', 'data', '', 'date', true)}`, async f => { DB.scadenze.push({ id: uid(), nota: f.nota.trim(), data: f.data, done: false }); await save('scadenze'); render(); });
A.scDone = async d => { const s = DB.scadenze.find(x => x.id === d.id); s.done = !s.done; await save('scadenze'); render(); };
A.scDel = d => confirmBox('Eliminare la scadenza?', async () => { DB.scadenze = DB.scadenze.filter(x => x.id !== d.id); await save('scadenze'); render(); }, 'Elimina');

/* ---------- MAGAZZINO ---------- */
const MAG_CATS = ['MAGAZZINO', 'FREEZER', 'DISPENSA'];
function viewMagazzino() {
  const c = UI.mag || MAG_CATS[0], list = [...(DB.magazzino[c] || [])].sort((a, b) => a.nome.localeCompare(b.nome)), E = canEdit();
  return `<div class="tabs">${MAG_CATS.map(x => `<button class="${x === c ? 'on' : ''}" data-a="magTab" data-c="${x}">${x} (${(DB.magazzino[x] || []).length})</button>`).join('')}</div>
  <div class="list">${list.map(x => `<div class="card mag-item ${x.qta === 0 ? 's-grey' : 's-ok'}"><span class="t">${esc(x.nome)}</span>
    ${x.qta !== '' && x.qta != null ? `<span class="qty">${E ? `<button data-a="magQ" data-c="${c}" data-id="${x.id}" data-v="-1">−</button>` : ''}<b style="min-width:34px;text-align:center">${x.qta}</b>${E ? `<button data-a="magQ" data-c="${c}" data-id="${x.id}" data-v="1">+</button>` : ''}</span>` : '<span class="small muted">—</span>'}
    <button class="btn sm sec edit" data-a="magEdit" data-c="${c}" data-id="${x.id}">✎</button></div>`).join('') || '<div class="empty">Nessun bene inserito.</div>'}</div>
  <button class="btn big edit" data-a="magEdit" data-c="${c}">+ AGGIUNGI</button>`;
}
A.magTab = d => { UI.mag = d.c; render(); };
A.magQ = async d => { const x = DB.magazzino[d.c].find(i => i.id === d.id); x.qta = Math.max(0, num(x.qta) + +d.v); await save('magazzino'); render(); };
A.magEdit = d => {
  const list = DB.magazzino[d.c] = DB.magazzino[d.c] || [];
  const x = list.find(i => i.id === d.id) || {};
  modal(x.id ? 'Modifica' : 'Aggiungi in ' + d.c, `${fld('Tipo di bene', 'nome', x.nome, 'text', true)}${fld('Quantità in pezzi (facoltativa)', 'qta', x.qta ?? '', 'number', false, 'min="0"')}
   ${x.id ? `<button type="button" class="btn sm bad" style="margin-top:12px" data-a="magDel" data-c="${d.c}" data-id="${x.id}">Elimina</button>` : ''}`, async f => {
    const v = { nome: f.nome.trim(), qta: f.qta === '' ? '' : num(f.qta) };
    if (x.id) Object.assign(x, v); else list.push({ id: uid(), ...v }); await save('magazzino'); render();
  });
};
A.magDel = async d => { DB.magazzino[d.c] = DB.magazzino[d.c].filter(i => i.id !== d.id); closeModal(); await save('magazzino'); render(); };

/* ---------- CERTIFICAZIONI ---------- */
const CERT_CATS = ['PRIMO SOCCORSO', 'INCENDIO RISCHIO ALTO', 'HACCP'];
function viewCertificazioni() {
  const c = UI.cert || CERT_CATS[0], t = today();
  const list = DB.certs.filter(x => x.cat === c).sort((a, b) => (a.scadenza || '').localeCompare(b.scadenza || ''));
  return `<div class="tabs">${CERT_CATS.map(x => `<button class="${x === c ? 'on' : ''}" data-a="certTab" data-c="${x}">${x} (${DB.certs.filter(y => y.cat === x).length})</button>`).join('')}</div>
  <p class="small muted">Avviso nel riquadro SCADENZE della home 90 giorni prima della scadenza.</p>
  <div class="list">${list.map(x => { const left = x.scadenza ? diffDays(x.scadenza, t) : null; const cls = left == null ? '' : left < 0 ? 's-bad' : left <= 90 ? 's-warn' : 's-ok'; return `<div class="card ${cls}">
    <div class="row"><span class="t grow">${esc(x.persona)}</span><span class="chip ${left < 0 ? 'bad' : left <= 90 ? 'warn' : 'ok'}">scade ${fmtD(x.scadenza)}</span></div>
    <div class="row" style="margin-top:6px">${x.fileId ? `<button class="btn sm sec" data-a="fileOpen" data-f="${x.fileId}" data-n="${esc(x.fileName || '')}">Apri attestato</button>` : '<span class="small muted">nessun file</span>'}<span class="grow"></span><button class="btn sm sec edit" data-a="certEdit" data-id="${x.id}">Modifica</button></div></div>`; }).join('') || '<div class="empty">Nessuna certificazione.</div>'}</div>
  <button class="btn big edit" data-a="certEdit" data-c="${c}">+ AGGIUNGI CERTIFICAZIONE</button>`;
}
A.certTab = d => { UI.cert = d.c; render(); };
A.fileOpen = d => openFile(d.f, d.n);
A.certEdit = d => {
  const x = DB.certs.find(i => i.id === d.id) || { cat: d.c };
  modal(x.id ? 'Modifica certificazione' : 'Nuova certificazione', `${sel('Categoria', 'cat', CERT_CATS, x.cat, true)}${fld('Nome della persona', 'persona', x.persona, 'text', true)}${fld('Data di scadenza', 'scadenza', x.scadenza, 'date', true)}
    <label class="f">Attestato (PDF o foto)${x.fileId ? ' – lascia vuoto per tenere quello attuale' : ''}</label><input class="i" type="file" id="cert-file" accept="application/pdf,image/*">
    ${x.id ? `<button type="button" class="btn sm bad" style="margin-top:12px" data-a="certDel" data-id="${x.id}">Elimina</button>` : ''}`, async f => {
    const file = $('#cert-file').files[0];
    busy(true, 'Salvo…');
    try {
      if (file) { const old = x.fileId; x.fileId = await putFile(file, file.name); x.fileName = file.name; if (old) delFile(old); }
      Object.assign(x, { cat: f.cat, persona: f.persona.trim(), scadenza: f.scadenza });
      if (!x.id) { x.id = uid(); DB.certs.push(x); }
      await save('certs');
    } catch (e) { toast(e.message); return false; } finally { busy(false); }
    UI.cert = f.cat; render();
  });
};
A.certDel = async d => { const x = DB.certs.find(i => i.id === d.id); if (x.fileId) delFile(x.fileId); DB.certs = DB.certs.filter(i => i.id !== d.id); closeModal(); await save('certs'); render(); };

/* ---------- MANUALI ---------- */
function viewManuali() {
  const ms = [...DB.manuali].sort((a, b) => b.data.localeCompare(a.data));
  return `<div class="list">${ms.map(m => `<div class="card"><div class="row"><span class="t grow">${esc(m.nome)}</span><span class="chip">${esc(m.tipo || '')}</span></div>
    <div class="small muted">Caricato il ${fmtD(m.data)}${m.note ? ' · ' + esc(m.note) : ''}</div>
    <div class="row" style="margin-top:6px"><button class="btn sm sec" data-a="fileOpen" data-f="${m.fileId}" data-n="${esc(m.fileName || '')}">Apri</button><span class="grow"></span><button class="btn sm bad edit" data-a="manDel" data-id="${m.id}">Elimina</button></div></div>`).join('') || '<div class="empty">Nessun manuale caricato.</div>'}</div>
  <button class="btn big edit" data-a="manAdd">+ AGGIUNGI MANUALE</button>`;
}
A.manAdd = () => modal('Nuovo manuale', `${fld('Nome', 'nome', '', 'text', true, 'placeholder="es. Gazebo grande 6x12"')}${sel('Tipo', 'tipo', ['Montaggio', 'Utilizzo', 'Montaggio e utilizzo'], 'Montaggio')}${fld('Note', 'note', '')}
   <label class="f">File *</label><input class="i" type="file" id="man-file" accept="application/pdf,image/*,.txt">`, async f => {
  const file = $('#man-file').files[0]; if (!file) { toast('Scegli il file'); return false; }
  busy(true, 'Carico…');
  try { const fileId = await putFile(file, file.name); DB.manuali.push({ id: uid(), nome: f.nome.trim(), tipo: f.tipo, note: f.note.trim(), fileId, fileName: file.name, data: today() }); await save('manuali'); }
  catch (e) { toast(e.message); return false; } finally { busy(false); }
  render();
});
A.manDel = d => { const m = DB.manuali.find(x => x.id === d.id); confirmBox(`Eliminare "${m.nome}"?`, async () => { delFile(m.fileId); DB.manuali = DB.manuali.filter(x => x.id !== d.id); await save('manuali'); render(); }, 'Elimina'); };

/* ---------- AVVIO ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const fn = A[el.dataset.a]; if (!fn) return;
  e.preventDefault();
  Promise.resolve(fn(el.dataset, el, e)).catch(err => { console.error(err); busy(false); toast('Errore: ' + err.message); });
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-ch]'); if (!el) return;
  const fn = CH[el.dataset.ch]; if (!fn) return;
  Promise.resolve(fn(el.dataset, el, e)).catch(err => { console.error(err); toast('Errore: ' + err.message); });
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'wz-in') A.wzNext(); if (e.key === 'Enter' && e.target.id === 'lg-pin') A.login(); });
window.addEventListener('hashchange', render);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); UI.installEvt = e; });
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !CFG.mode || isLocal() || $('.ov')) return;
  if (Date.now() - (UI.lastLoad || 0) < 30000) return;
  UI.lastLoad = Date.now(); await loadAll(); render();
});

(async function start() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
  if (CFG.mode) { busy(true, 'Carico i dati…'); try { await loadAll(); UI.lastLoad = Date.now(); } catch (e) { toast(e.message); } finally { busy(false); } }
  render();
})();
