'use strict';
/* ===== APROLOCO — eventi: wizard, checklist, documenti, riepilogo, fascicolo ===== */

const POINTS = [
  [1, 'PREPARAZIONE E SOMMINISTRAZIONE'], [2, 'MENU'], [3, 'SPESA'], [4, 'GIORNI DI PREPARAZIONE'], [5, 'SIAE'],
  [6, 'IMPIANTI'], [7, 'CONTATORE'], [8, 'PREZZIARIO'], [9, 'AVVISO AUTORITÀ'], [10, 'CROCE ROSSA'],
  [11, 'PERMESSI COMUNALI'], [12, 'LOCANDINA'], [13, 'SICUREZZA'], [14, 'PIANO SICUREZZA'],
  [15, 'CASSE DIGITALI'], [16, 'FONDO CASSA'], [17, 'PREPARAZIONE SALA'],
];
const DOCS_P1 = ['TIPOLOGIA B', 'ANAGRAFICA', 'NOTIFICA', 'SEGNALAZIONE'];
const DOCS_P11 = ['1174', 'SUOLO PUBBLICO', 'DEROGA SONORA'];
const IMPIANTI = ['GAS ESTERNO', 'GRIGLIE', 'FRIGGITRICE', 'GAZEBO GRANDE', 'GAZEBO LEGGERO', 'IMPIANTO LUCE ACCESSORIO', 'LAVANDINO ESTERNO'];
const PREP_VOCI = ['CUCINA', 'MONTAGGIO', 'ALLESTIMENTO'];
const NOTE_DOC = 'NOTE PROLOCO';
const EXPECTED_DOCS = [NOTE_DOC, ...DOCS_P1, ...DOCS_P11];

/* ---------- WIZARD ---------- */
const WZ = [
  { k: 'nome', q: 'Nome dell\'evento', type: 'text' },
  { k: 'date', q: 'Date e orari dell\'evento', type: 'dates' },
  { k: 'patronale', q: 'È la festa patronale?', type: 'yn' },
  { k: 'tipo', q: 'Festa / Sagra o Altro?', type: 'choice', opts: [['festa', 'Festa / Sagra'], ['altro', 'Altro']] },
  { k: 'prep', q: 'È prevista la preparazione / somministrazione?', type: 'yn' },
  { k: 'locandina', q: 'È prevista una locandina?', type: 'yn' },
  { k: 'musica', q: 'È prevista musica?', type: 'yn' },
  { k: 'impianti', q: 'Sono necessari impianti esterni?', type: 'yn' },
  { k: 'contatore', q: 'È necessario un contatore aggiuntivo?', type: 'yn' },
  { k: 'autorita', q: 'È necessario avvisare le autorità?', type: 'yn' },
  { k: 'croce', q: 'È richiesta la Croce Rossa?', type: 'yn' },
  { k: 'sicurezza', q: 'È richiesta la presenza della sicurezza?', type: 'yn' },
  { k: 'casse', q: 'Servono le casse digitali?', type: 'yn' },
  { k: 'fondo', q: 'Serve il fondo cassa?', type: 'yn' },
  { k: 'sala', q: 'È prevista la preparazione della sala?', type: 'yn' },
];
let WZS = null; // stato del wizard in corso

function enabledFromWizard(w) {
  const on = new Set();
  if (w.patronale) { POINTS.forEach(([n]) => on.add(n)); return on; }
  if (w.tipo === 'festa') { on.add(11); on.add(14); }
  if (w.prep) [1, 2, 3, 4, 8].forEach(n => on.add(n));
  if (w.locandina) on.add(12);
  if (w.musica) { on.add(5); on.add(12); } // la SIAE richiede la locandina
  if (w.impianti) on.add(6);
  if (w.contatore) on.add(7);
  if (w.autorita) on.add(9);
  if (w.croce) on.add(10);
  if (w.sicurezza) on.add(13);
  if (w.casse) on.add(15);
  if (w.fondo) on.add(16);
  if (w.sala) on.add(17);
  return on;
}

function viewWizard() {
  if (!canEdit()) return `<div class="empty">Solo presidente, responsabile contabile e responsabile cucine possono creare eventi.</div>`;
  if (!WZS) WZS = { step: 0, a: { nome: '', inizio: '', fine: '', oraInizio: '', oraFine: '' } };
  const s = WZS, qd = WZ[s.step], a = s.a;
  const total = WZ.length;
  let body = '';
  if (qd.type === 'text') body = `<input class="i" id="wz-in" value="${esc(a.nome)}" placeholder="es. Sagra del Peperone 2027" style="font-size:18px">
     <button class="btn big" data-a="wzNext" style="margin-top:14px">Avanti</button>`;
  else if (qd.type === 'dates') body = `
     <div class="cols"><div>${fld('Primo giorno', 'inizio', a.inizio, 'date', true, 'id="wz-ini"')}</div><div>${fld('Ultimo giorno', 'fine', a.fine, 'date', false, 'id="wz-fin"')}</div>
     <div>${fld('Ora inizio', 'oraInizio', a.oraInizio, 'time', false, 'id="wz-oi"')}</div><div>${fld('Ora fine', 'oraFine', a.oraFine, 'time', false, 'id="wz-of"')}</div></div>
     <p class="small muted">Se l'evento dura un solo giorno lascia vuoto l'ultimo giorno.</p>
     <button class="btn big" data-a="wzNext">Avanti</button>`;
  else if (qd.type === 'yn') body = `<div class="yn"><button class="btn ok" data-a="wzAns" data-v="1">SÌ</button><button class="btn bad" data-a="wzAns" data-v="0">NO</button></div>`;
  else body = `<div class="yn">${qd.opts.map(([v, t]) => `<button class="btn" data-a="wzAns" data-v="${v}">${esc(t)}</button>`).join('')}</div>`;
  return `<div class="wz">
    <div class="prog"><i style="width:${Math.round((s.step) / total * 100)}%"></i></div>
    <div class="small muted">Domanda ${s.step + 1} di ${total}${a.nome && s.step ? ' · ' + esc(a.nome) : ''}</div>
    <div class="q">${esc(qd.q)}</div>
    ${body}
    <div class="row" style="margin-top:18px">${s.step ? '<button class="btn sec" data-a="wzBack">Indietro</button>' : ''}<span class="grow"></span><button class="btn sec" data-a="wzCancel">Annulla</button></div>
  </div>`;
}
A.wzNext = () => {
  const s = WZS, qd = WZ[s.step];
  if (qd.type === 'text') { const v = $('#wz-in').value.trim(); if (!v) return toast('Scrivi il nome dell\'evento'); s.a.nome = v; }
  if (qd.type === 'dates') {
    const ini = $('#wz-ini').value, fin = $('#wz-fin').value || ini;
    if (!ini) return toast('Inserisci il primo giorno dell\'evento');
    if (fin < ini) return toast('L\'ultimo giorno è prima del primo');
    Object.assign(s.a, { inizio: ini, fine: fin, oraInizio: $('#wz-oi').value, oraFine: $('#wz-of').value });
  }
  s.step++; render();
};
A.wzBack = () => { const s = WZS; s.step = Math.max(0, s.step - 1); if (WZ[s.step].k === 'tipo' && s.a.patronale) s.step = 2; render(); };
A.wzCancel = () => { WZS = null; go('#/home'); };
A.wzAns = d => {
  const s = WZS, qd = WZ[s.step];
  s.a[qd.k] = qd.type === 'yn' ? d.v === '1' : d.v;
  if (qd.k === 'patronale' && s.a.patronale) return createEventFromWizard();
  if (s.step === WZ.length - 1) return createEventFromWizard();
  s.step++; render();
};

async function createEventFromWizard() {
  const a = WZS.a;
  const on = enabledFromWizard(a);
  const ev = {
    id: uid(), nome: a.nome, nomeDocs: a.nome, inizio: a.inizio, fine: a.fine, oraInizio: a.oraInizio, oraFine: a.oraFine,
    wizard: { ...a }, enabled: [...on].sort((x, y) => x - y), created: today(), items: {}, att: {},
    menu: { persone: 0, ricette: [] }, prezzi: {}, prezzoMenu: '', bilancio: { spese: [], entrate: [], porzioniPreparate: '', porzioniServite: '' }, chiuso: false,
  };
  DB.events.push(ev);
  if (!(await save('events'))) { DB.events.pop(); return; }
  WZS = null;
  UI.open[ev.id] = new Set();
  go('#/evento/' + ev.id);
  // compilazione automatica dei documenti dal tasto DOCUMENTI
  const names = [...(isOn(ev, 1) ? DOCS_P1 : []), ...(isOn(ev, 11) ? DOCS_P11 : [])];
  if (names.length) await fillAllDocs(ev, names, true);
}

/* ---------- STATO DELLE VOCI ---------- */
const isOn = (ev, n) => ev.enabled.includes(n);
const st = (ev, key) => (ev.items[key] = ev.items[key] || {});
function firstPrepDate(ev) {
  const ds = PREP_VOCI.flatMap(v => (st(ev, 'p4:' + v).dates || []).map(x => x.d)).filter(Boolean).sort();
  return ds[0] || null;
}
function hasAtt(ev, k) { return !!(ev.att && ev.att[k]); }

/* definizione delle voci di ogni punto */
function pointItems(ev, n) {
  const fp = firstPrepDate(ev);
  const pecDue = fp ? addDays(fp, -10) : null, pecNote = fp ? '' : 'si calcola quando compili il punto 4';
  const d30 = addDays(ev.inizio, -30), d40 = addDays(ev.inizio, -40);
  switch (n) {
    case 1: return [
      ...DOCS_P1.map(nm => ({ key: 'p1:' + nm, label: nm, kind: 'pec', doc: nm, due: pecDue, dueNote: pecNote, execLabel: 'PEC inviata il' })),
      { key: 'p1:BONIFICO ASL', label: 'BONIFICO ASL', kind: 'pec', due: pecDue, dueNote: pecNote, execLabel: 'Bonifico fatto il' },
      { key: 'p1:PREPMENU', label: 'PREPARAZIONE MENU', kind: 'gen', gen: 'prepmenu', att: 'prepmenu', genLabel: 'Crea PDF preparazione' },
    ];
    case 2: return [{ key: 'p2:MENU', label: 'MENU', kind: 'menu', att: 'menu' }];
    case 3: return [{ key: 'p3:SPESA', label: 'SPESA', kind: 'spesa', att: 'spesa' }];
    case 4: return PREP_VOCI.map(v => ({ key: 'p4:' + v, label: v, kind: 'prep' }));
    case 5: {
      const portal = st(ev, 'p5:PORTALE');
      return [
        { key: 'p5:LOCANDINA', label: 'LOCANDINA', kind: 'link', att: 'locandina', hint: 'si carica al punto 12' },
        { key: 'p5:PREZZIARIO', label: 'PREZZIARIO', kind: 'link', att: 'prezziario', hint: 'si crea al punto 8' },
        { key: 'p5:PORTALE', label: 'INSERIMENTO NEL PORTALE', kind: 'date', execLabel: 'Pratica inserita il' },
        { key: 'p5:CHIUSURA', label: 'CHIUSURA OPERAZIONI', kind: 'close', due: addDays(ev.fine, 10), alert: 5, locked: !portal.exec, lockNote: 'si abilita dopo l\'inserimento nel portale' },
      ];
    }
    case 6: return IMPIANTI.map(v => ({ key: 'p6:' + v, label: v, kind: 'plan' }));
    case 7: return ['APERTURA PRATICA', 'CONFERMA', 'INSTALLAZIONE'].map(v => ({ key: 'p7:' + v, label: v, kind: 'date', execLabel: 'Data' }));
    case 8: return [{ key: 'p8:PREZZIARIO', label: 'PREZZIARIO', kind: 'prezzi', att: 'prezziario' }];
    case 9: return [
      { key: 'p9:QUESTURA', label: 'COMUNICAZIONE QUESTURA', kind: 'pec', due: d30, execLabel: 'Fatta il' },
      { key: 'p9:CARABINIERI', label: 'COMUNICAZIONE CARABINIERI', kind: 'pec', due: d30, execLabel: 'Fatta il' },
    ];
    case 10: return [{ key: 'p10:CROCE', label: 'RICHIESTA CROCE ROSSA', kind: 'pec', due: d30, execLabel: 'Richiesta il' }];
    case 11: return DOCS_P11.map(nm => ({ key: 'p11:' + nm, label: nm, kind: 'pec', doc: nm, due: d30, execLabel: 'Inviato il' }));
    case 12: return [{ key: 'p12:LOCANDINA', label: 'LOCANDINA', kind: 'upload', att: 'locandina' }];
    case 13: return [{ key: 'p13:CONTRATTO', label: 'CONTRATTO SICUREZZA', kind: 'pec', due: d40, execLabel: 'Firmato il' }];
    case 14: return [{ key: 'p14:PIANO', label: 'PIANO SICUREZZA', kind: 'uploadpec', att: 'pianosicurezza', due: d30, execLabel: 'Fatto il' }];
    case 15: return [{ key: 'p15:CASSE', label: 'RICHIESTA CASSE DIGITALI', kind: 'date', execLabel: 'Data' }];
    case 16: return [{ key: 'p16:FONDO', label: 'FONDO CASSA', kind: 'date', execLabel: 'Data' }];
    case 17: return [{ key: 'p17:SALA', label: 'PREPARAZIONE SALA', kind: 'date', execLabel: 'Data' }];
  }
  return [];
}
function itemDone(ev, it) {
  if (it.kind === 'link') return hasAtt(ev, it.att);
  return !!st(ev, it.key).done;
}
function itemApplies(ev, it) { return !(it.kind === 'plan' && st(ev, it.key).needed === false); }
function canCheck(ev, it) {
  const s = st(ev, it.key);
  switch (it.kind) {
    case 'pec': case 'date': return !!s.exec;
    case 'gen': case 'menu': case 'prezzi': case 'upload': return hasAtt(ev, it.att);
    case 'spesa': return hasAtt(ev, it.att) && !!s.exec;
    case 'prep': return (s.dates || []).some(x => x.d) && !!s.exec;
    case 'plan': return !!s.plan;
    case 'close': return !it.locked;
    case 'uploadpec': return hasAtt(ev, it.att) && !!s.exec;
  }
  return false;
}
function itemDue(ev, it) { const s = st(ev, it.key); return s.custDue || it.due || null; }
function pointStatus(ev, n) {
  if (!isOn(ev, n)) return 'grey';
  const its = pointItems(ev, n).filter(it => itemApplies(ev, it));
  return its.length && its.every(it => itemDone(ev, it)) ? 'ok' : 'warn';
}
function eventStatus(ev) {
  if (ev.fine < today()) return 'bad';
  return ev.enabled.every(n => pointStatus(ev, n) === 'ok') ? 'ok' : 'warn';
}
function eventProgress(ev) {
  const done = ev.enabled.filter(n => pointStatus(ev, n) === 'ok').length;
  return `${done}/${ev.enabled.length}`;
}

/* tutte le scadenze (home e calendario) */
function allDeadlines() {
  const out = [], t = today();
  for (const ev of DB.events) {
    for (const n of ev.enabled) for (const it of pointItems(ev, n)) {
      if (!itemApplies(ev, it) || itemDone(ev, it) || it.kind === 'link') continue;
      const due = itemDue(ev, it); if (!due) continue;
      if (it.kind === 'close' && it.locked) continue;
      out.push({ date: due, label: `${it.label}`, sub: `${ev.nome} · punto ${n}`, type: 'checklist', alert: it.alert || 10, link: `#/evento/${ev.id}/${n}`, evFine: ev.fine });
    }
  }
  for (const s of DB.scadenze) if (!s.done) out.push({ date: s.data, label: s.nota, sub: 'Scadenza fiscale', type: 'fiscale', alert: 10, link: '#/scadenze' });
  for (const c of DB.certs) if (c.scadenza) out.push({ date: c.scadenza, label: `Certificazione ${c.cat} – ${c.persona}`, sub: 'Scade la certificazione', type: 'cert', alert: 90, link: '#/certificazioni' });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
function activeAlerts() {
  const t = today();
  return allDeadlines().filter(d => {
    const left = diffDays(d.date, t);
    if (left > d.alert) return false;
    if (d.type === 'checklist' && left < 0 && diffDays(t, d.evFine) > 30) return false; // evento chiuso da oltre 30 giorni
    if (d.type === 'cert' && left < -365) return false;
    return true;
  });
}

/* ---------- CUCINA (ricette, quantità, prezzi) ---------- */
function baseUnit(q, u) {
  u = String(u || '').trim().toLowerCase();
  if (u === 'g' || u === 'gr') return [q / 1000, 'kg'];
  if (u === 'ml') return [q / 1000, 'l'];
  if (u === 'cl') return [q / 100, 'l'];
  if (u === 'lt') return [q, 'l'];
  return [q, u || 'pz'];
}
const recipeById = id => DB.recipes.find(r => r.id === id);
function recipeNeeds(r, persone) {
  const f = (num(persone) || 10) / 10;
  return (r.ingredienti || []).filter(i => i.nome).map(i => { const [q, u] = baseUnit(num(i.qta) * f, i.unita); return { nome: i.nome.trim(), qta: q, unita: u, forn: i.forn || 'SPESA' }; });
}
function aggregate(list) {
  const m = new Map();
  for (const x of list) {
    const k = norm(x.nome) + '|' + x.unita;
    const cur = m.get(k) || { nome: x.nome, unita: x.unita, forn: x.forn, qta: 0, per: {} };
    cur.qta += x.qta; if (x.ev) cur.per[x.ev] = (cur.per[x.ev] || 0) + x.qta;
    m.set(k, cur);
  }
  return [...m.values()];
}
function eventNeeds(ev) {
  const p = num(ev.menu?.persone);
  if (!p) return [];
  return aggregate((ev.menu.ricette || []).map(recipeById).filter(Boolean).flatMap(r => recipeNeeds(r, p)).map(x => ({ ...x, ev: ev.id })));
}
function priceFor(nome, unita) {
  const ps = DB.prices.filter(p => norm(p.nome) === norm(nome));
  return ps.find(p => baseUnit(1, p.unita)[1] === unita) || null;
}
function priceValue(p, qta) { const k = baseUnit(1, p.unita)[0]; return num(p.prezzo) / k * qta; }
function groupFor(cat) { return (DB.suppliers[cat] || []).length ? cat : 'SPESA'; }
function groupLabel(g) { const s = DB.suppliers[g] || []; return s.length ? `${g} – ${s.map(x => x.nome).join(', ')}` : g; }

/* ---------- DOCUMENTI: variabili e compilazione ---------- */
async function notesVars() {
  const d = findDoc(NOTE_DOC); const vars = {};
  if (!d) return vars;
  try {
    const txt = await (await getFile(d.fileId)).text();
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([^:=#]+?)\s*[:=]\s*(.*)$/); if (!m) continue;
      vars[norm(m[1])] = m[2].trim();
    }
  } catch { }
  return vars;
}
function eventVars(ev) {
  const date = ev.inizio === ev.fine ? fmtD(ev.inizio) : `dal ${fmtD(ev.inizio)} al ${fmtD(ev.fine)}`;
  const orario = [ev.oraInizio, ev.oraFine].filter(Boolean).join(' - ');
  const prep = PREP_VOCI.flatMap(v => (st(ev, 'p4:' + v).dates || []).map(x => x.d)).filter(Boolean).sort();
  const v = {
    NOMEEVENTO: ev.nome, EVENTO: ev.nome, DATAEVENTO: date, DATEEVENTO: date, DATAINIZIO: fmtD(ev.inizio), DATAFINE: fmtD(ev.fine),
    ORAINIZIO: ev.oraInizio || '', ORAFINE: ev.oraFine || '', ORARIO: orario, DATAPREPARAZIONE: prep.length ? fmtD(prep[0]) : '',
    DATAOGGI: fmtD(today()), OGGI: fmtD(today()), DATA: fmtD(today()), ANNO: (ev.inizio || '').slice(0, 4),
  };
  return v;
}
const findDoc = name => DB.docs.find(d => norm(d.nome) === norm(name));

async function setAtt(ev, key, blob, name) {
  const old = ev.att[key];
  const fileId = await putFile(blob, name);
  ev.att[key] = { fileId, name, at: today() };
  if (old && old.fileId !== fileId) delFile(old.fileId);
}
async function fillDocForEvent(ev, docName, notes) {
  const d = findDoc(docName);
  const key = 'doc:' + norm(docName);
  if (!d) return { name: docName, status: 'missing' };
  const vars = { ...notes, ...eventVars(ev) };
  const src = await getFile(d.fileId);
  const fname = safeName(`${ev.nome}_${docName}`) + '.pdf';
  if (d.type === 'text') {
    const r = fillTextTemplate(await src.text(), vars);
    await setAtt(ev, key, await textToPdf(`${docName} – ${ev.nome}`, r.text), fname);
    return { name: docName, status: 'ok', filled: r.filled, total: r.total };
  }
  const fields = await pdfFieldNames(src);
  if (!fields.length) { await setAtt(ev, key, src, fname); return { name: docName, status: 'flat' }; }
  const r = await fillPdfForm(src, vars);
  await setAtt(ev, key, r.blob, fname);
  return { name: docName, status: 'ok', filled: r.filled, total: r.total };
}
async function fillAllDocs(ev, names, quiet) {
  busy(true, 'Compilo i documenti…');
  const res = [];
  try {
    const notes = await notesVars();
    for (const nm of names) { try { res.push(await fillDocForEvent(ev, nm, notes)); } catch (e) { res.push({ name: nm, status: 'err', msg: e.message }); } }
    ev.nomeDocs = ev.nome;
    await save('events');
  } finally { busy(false); }
  render();
  const missing = res.filter(r => r.status === 'missing').map(r => r.name);
  const lines = res.map(r => `<li><b>${esc(r.name)}</b>: ${r.status === 'ok' ? `compilato (${r.filled}/${r.total} campi)` : r.status === 'flat' ? 'allegato, ma il PDF non ha campi compilabili: completarlo a mano' : r.status === 'missing' ? '<span style="color:var(--bad)">manca nel tasto DOCUMENTI</span>' : 'errore: ' + esc(r.msg)}</li>`).join('');
  if (!quiet || missing.length || res.some(r => r.status !== 'ok'))
    modal('Documenti dell\'evento', `<ul>${lines}</ul>${!findDoc(NOTE_DOC) ? '<p class="small">Manca il file <b>NOTE PROLOCO</b> nel tasto DOCUMENTI: i campi con i dati della Pro Loco restano in bianco.</p>' : ''}${missing.length ? '<p class="small">Carica i documenti mancanti nel tasto DOCUMENTI con lo stesso nome, poi premi "Compila" sulla voce.</p>' : ''}`, null, { cancel: 'Chiudi' });
  return res;
}

/* ---------- PDF DELL'EVENTO ---------- */
const evSub = ev => (ev.inizio === ev.fine ? fmtD(ev.inizio) : `dal ${fmtD(ev.inizio)} al ${fmtD(ev.fine)}`) + (ev.oraInizio ? ` · ore ${ev.oraInizio}${ev.oraFine ? ' - ' + ev.oraFine : ''}` : '');
function menuRecipes(ev) { return (ev.menu.ricette || []).map(recipeById).filter(Boolean); }

async function genMenuPdf(ev) {
  const rs = menuRecipes(ev); if (!rs.length) throw new Error('Aggiungi almeno una ricetta al menu');
  const w = await newPdf(ev.nome, 'MENU · ' + evSub(ev));
  for (const c of REC_CATS) { const g = rs.filter(r => r.cat === c); if (!g.length) continue; w.space(6); w.text(c, { size: 13, bold: true, color: C_BRAND, center: true }); g.forEach(r => w.text(r.nome, { size: 12, center: true })); }
  return w.save();
}
async function genPrepPdf(ev) {
  const rs = menuRecipes(ev); if (!rs.length) throw new Error('Il menu (punto 2) è vuoto');
  const w = await newPdf(ev.nome, 'PREPARAZIONE MENU' + (num(ev.menu.persone) ? ` · ${ev.menu.persone} persone` : ''));
  for (const r of rs) { w.h(`${r.nome}  (${r.cat})`); w.text(r.preparazione || '— preparazione non inserita nel ricettario —', { size: 11, after: 4 }); }
  return w.save();
}
function eventShopping(ev) {
  const items = [...eventNeeds(ev), ...DB.cart.extras.filter(x => x.ev === ev.id).map(x => { const [q, u] = baseUnit(num(x.qta), x.unita); return { nome: x.nome, qta: q, unita: u, forn: x.forn || 'SPESA' }; })];
  return aggregate(items);
}
async function genSpesaPdf(ev) {
  const items = eventShopping(ev); if (!items.length) throw new Error('Nessun prodotto: compila il menu (punto 2) con il numero di persone o aggiungi prodotti nel tasto SPESA');
  const w = await newPdf(ev.nome, 'LISTA DELLA SPESA' + (num(ev.menu.persone) ? ` · ${ev.menu.persone} persone` : ''));
  const groups = {};
  items.forEach(x => (groups[groupFor(x.forn)] = groups[groupFor(x.forn)] || []).push(x));
  for (const g of FORN_CATS) { if (!groups[g]) continue; w.h(groupLabel(g)); w.table([{ t: 'Prodotto', w: .7 }, { t: 'Quantità', w: .3, right: true }], groups[g].sort((a, b) => a.nome.localeCompare(b.nome)).map(x => [x.nome, `${qtyFmt(x.qta)} ${x.unita}`])); }
  return w.save();
}
async function genPrezziarioPdf(ev) {
  const rs = menuRecipes(ev); if (!rs.length) throw new Error('Il menu (punto 2) è vuoto');
  const w = await newPdf(ev.nome, 'PREZZIARIO · ' + evSub(ev));
  for (const c of REC_CATS) {
    const g = rs.filter(r => r.cat === c); if (!g.length) continue;
    w.h(c); w.table([{ t: 'Piatto', w: .72 }, { t: 'Prezzo', w: .28, right: true }], g.map(r => [r.nome, ev.prezzi[r.id] ? eur(ev.prezzi[r.id]) : '']));
  }
  if (ev.prezzoMenu) { w.space(8); w.text('PREZZO MENU: ' + eur(ev.prezzoMenu), { size: 15, bold: true, color: C_BRAND }); }
  return w.save();
}
const GEN = { prepmenu: [genPrepPdf, 'Preparazione_menu'], menu: [genMenuPdf, 'Menu'], spesa: [genSpesaPdf, 'Spesa'], prezziario: [genPrezziarioPdf, 'Prezziario'] };

function riepilogoRows(ev) {
  const SI = b => b ? 'SI' : 'NO';
  const sx = k => st(ev, k);
  const dd = d => d ? fmtD(d) : '';
  const prep = PREP_VOCI.map(v => { const ds = (sx('p4:' + v).dates || []).filter(x => x.d); return ds.length ? `${v}: ${ds.map(x => fmtD(x.d) + (x.note ? ' (' + x.note + ')' : '')).join(', ')}` : ''; }).filter(Boolean).join('\n');
  const latest = keys => keys.map(k => sx(k).exec).filter(Boolean).sort().pop();
  const imp = v => { if (!isOn(ev, 6) || sx('p6:' + v).needed === false) return 'NO'; return sx('p6:' + v).plan ? 'SI  ' + fmtD(sx('p6:' + v).plan) : 'SI'; };
  const menu = hasAtt(ev, 'prezziario') ? 'PREZZIARIO (allegato)' : hasAtt(ev, 'menu') ? 'MENU PDF (allegato)' : isOn(ev, 2) ? 'da creare' : 'NO';
  const yd = (on, d) => on ? ('SI' + (d ? '  ' + fmtD(d) : '')) : 'NO';
  return {
    top: [
      ['NOME EVENTO', ev.nome],
      ['DATA PREPARAZIONE', prep || (isOn(ev, 4) ? 'da definire (punto 4)' : '—')],
      ['DATE E ORA EVENTO', evSub(ev)],
      ['MENU\'', menu],
      ['PRESENZA DI SIAE', SI(isOn(ev, 5))],
      ['CERTIFICATI RICHIESTI', `LUCE: ${SI(isOn(ev, 6) && sx('p6:IMPIANTO LUCE ACCESSORIO').needed !== false)}\nGAS: ${SI(isOn(ev, 6) && sx('p6:GAS ESTERNO').needed !== false)}`],
      ['RICHIESTA SICUREZZA', yd(isOn(ev, 13), sx('p13:CONTRATTO').exec)],
      ['RICHIESTA CASSE DIGITALI', yd(isOn(ev, 15), sx('p15:CASSE').exec)],
      ['FONDO CASSA', yd(isOn(ev, 16), sx('p16:FONDO').exec)],
    ],
    infra: [['GAZEBO GRANDE', imp('GAZEBO GRANDE')], ['GAZEBO LEGGERO', imp('GAZEBO LEGGERO')], ['IMPIANTO GAS', imp('GAS ESTERNO')], ['IMPIANTO LUCE', imp('IMPIANTO LUCE ACCESSORIO')], ['GRIGLIE', imp('GRIGLIE')], ['FRIGGITRICE', imp('FRIGGITRICE')], ['LAVANDINO', imp('LAVANDINO ESTERNO')]],
    bottom: [
      ['CONTATORE AGGIUNTIVO', yd(isOn(ev, 7), sx('p7:INSTALLAZIONE').exec)],
      ['PREPARAZIONE SALA', yd(isOn(ev, 17), sx('p17:SALA').exec)],
      ['SPESA', yd(isOn(ev, 3), sx('p3:SPESA').plan || sx('p3:SPESA').exec)],
      ['DOCUMENTI ASL', yd(isOn(ev, 1), latest(DOCS_P1.map(n => 'p1:' + n)))],
      ['DOCUMENTI QUESTURA', yd(isOn(ev, 9), latest(['p9:QUESTURA', 'p9:CARABINIERI']))],
      ['DOCUMENTI COMUNE', yd(isOn(ev, 11), latest(DOCS_P11.map(n => 'p11:' + n)))],
      ['CROCE ROSSA', yd(isOn(ev, 10), sx('p10:CROCE').exec)],
      ['PIANO DI SICUREZZA', yd(isOn(ev, 14), sx('p14:PIANO').exec)],
    ],
  };
}
async function genRiepilogoPdf(ev) {
  const R = riepilogoRows(ev);
  const w = await newPdf('RIEPILOGO PROLOCO', ev.nome);
  R.top.forEach(([k, v]) => w.kv(k + ':', v));
  w.h('INFRASTRUTTURE'); R.infra.forEach(([k, v]) => w.kv(k, v));
  w.space(4); R.bottom.forEach(([k, v]) => w.kv(k + ':', v));
  w.space(10); w.text('Generato da APROLOCO il ' + fmtD(today()), { size: 8, color: C_MUTED });
  return w.save();
}
/* allegati in ordine di checklist */
function attOrder(ev) {
  const order = [];
  const add = (k, label) => { if (ev.att[k] && !order.find(o => o.k === k)) order.push({ k, label, ...ev.att[k] }); };
  for (const [n] of POINTS) {
    if (!isOn(ev, n)) continue;
    if (n === 1) { DOCS_P1.forEach(d => add('doc:' + norm(d), d)); add('prepmenu', 'Preparazione menu'); }
    if (n === 2) add('menu', 'Menu');
    if (n === 3) add('spesa', 'Lista della spesa');
    if (n === 8) add('prezziario', 'Prezziario');
    if (n === 11) DOCS_P11.forEach(d => add('doc:' + norm(d), d));
    if (n === 14) add('pianosicurezza', 'Piano sicurezza');
  }
  return order;
}
async function genFascicolo(ev) {
  busy(true, 'Creo il fascicolo…');
  try {
    const parts = [];
    if (ev.att.locandina) parts.push(await getFile(ev.att.locandina.fileId));
    const riep = await genRiepilogoPdf(ev); parts.push(riep);
    for (const a of attOrder(ev)) { try { parts.push(await getFile(a.fileId)); } catch { } }
    const out = await mergePdfs(parts);
    await setAtt(ev, 'fascicolo', out, safeName(ev.nome + '_FASCICOLO') + '.pdf');
    await setAtt(ev, 'riepilogo', riep, safeName(ev.nome + '_RIEPILOGO') + '.pdf');
    await save('events');
    downloadBlob(out, safeName(ev.nome + '_FASCICOLO') + '.pdf');
    toast('Fascicolo creato');
  } catch (e) { toast('Errore: ' + e.message); }
  finally { busy(false); render(); }
}

/* ---------- VISTA: STORICO EVENTI ---------- */
function viewEventi() {
  const evs = [...DB.events].sort((a, b) => b.inizio.localeCompare(a.inizio));
  const lab = { ok: 'Completa', warn: 'Da terminare', bad: 'Terminato' };
  return `<h2 class="pg">Storico eventi</h2>
  <div class="row small muted" style="margin-bottom:10px;gap:14px"><span><span class="chip bad">rosso</span> evento terminato</span><span><span class="chip warn">giallo</span> checklist da terminare</span><span><span class="chip ok">verde</span> checklist completa, evento da svolgere</span></div>
  <div class="list">${evs.map(ev => { const s = eventStatus(ev); return `<div class="card click s-${s}" data-a="go" data-h="#/evento/${ev.id}">
     <div class="row"><span class="t grow">${esc(ev.nome)}</span><span class="chip ${s}">${lab[s]}</span></div>
     <div class="small muted">${evSub(ev)} · punti completati ${eventProgress(ev)}</div></div>`; }).join('') || '<div class="empty">Nessun evento. Crealo dal tasto NUOVO EVENTO.</div>'}</div>`;
}

/* ---------- VISTA: CHECKLIST ---------- */
function viewEvento(id, openN) {
  const ev = DB.events.find(e => e.id === id);
  if (!ev) return '<div class="empty">Evento non trovato</div>';
  UI.open[ev.id] = UI.open[ev.id] || new Set();
  if (openN) UI.open[ev.id].add(+openN);
  const ro = !canEdit() ? 'disabled' : '';
  const nameChanged = ev.nome !== ev.nomeDocs;
  return `
  <div class="panel">
    <label class="f">Nome dell'evento</label>
    <div class="row"><input class="i grow" id="ev-nome" value="${esc(ev.nome)}" ${ro} data-ch="evNome" data-id="${ev.id}" style="font-weight:800;font-size:17px;flex:1">
      ${nameChanged ? `<button class="btn edit" data-a="evAggiorna" data-id="${ev.id}">AGGIORNA</button>` : ''}</div>
    ${nameChanged ? '<div class="small" style="color:var(--orange);margin-top:4px">Nome modificato: premi AGGIORNA per riportarlo su tutti i documenti.</div>' : ''}
    <div class="row small muted" style="margin-top:8px"><span class="grow">${evSub(ev)}</span>
      <button class="btn sm sec edit" data-a="evDate" data-id="${ev.id}">Modifica date</button>
      <button class="btn sm sec edit" data-a="evPunti" data-id="${ev.id}">Punti attivi</button></div>
  </div>
  ${POINTS.map(([n, t]) => viewPoint(ev, n, t)).join('')}
  <div class="panel" style="margin-top:14px">
    <h3>Allegati</h3>
    ${attOrder(ev).map(a => `<div class="row" style="margin:4px 0"><span class="att" data-a="openAtt" data-id="${ev.id}" data-k="${a.k}">📄 ${esc(a.label)}</span><span class="small muted">${fmtD(a.at)}</span></div>`).join('') || '<div class="small muted">Nessun allegato ancora.</div>'}
    ${ev.att.locandina ? `<div class="row" style="margin:4px 0"><span class="att" data-a="openAtt" data-id="${ev.id}" data-k="locandina">🖼 Locandina</span></div>` : ''}
    ${ev.att.fascicolo ? `<div class="row" style="margin:4px 0"><span class="att" data-a="openAtt" data-id="${ev.id}" data-k="fascicolo">📚 Fascicolo completo</span><span class="small muted">${fmtD(ev.att.fascicolo.at)}</span></div>` : ''}
    <button class="btn big sec" data-a="evRiepilogo" data-id="${ev.id}">CREA RIEPILOGO (PDF)</button>
    <button class="btn big edit" data-a="evFascicolo" data-id="${ev.id}">CREA FASCICOLO</button>
    <p class="small muted">Il fascicolo è un unico PDF: locandina come frontespizio, riepilogo e poi tutti gli allegati nell'ordine della checklist.</p>
  </div>
  <div class="row end edit"><button class="btn sm bad" data-a="evDelete" data-id="${ev.id}">Elimina evento</button></div>`;
}
function viewPoint(ev, n, t) {
  const s = pointStatus(ev, n), open = UI.open[ev.id].has(n) && s !== 'grey';
  const its = isOn(ev, n) ? pointItems(ev, n) : [];
  const done = its.filter(it => itemApplies(ev, it) && itemDone(ev, it)).length, tot = its.filter(it => itemApplies(ev, it)).length;
  return `<div class="pt ${s}" id="pt-${n}">
    <div class="h" data-a="togglePt" data-id="${ev.id}" data-n="${n}"><span class="no">${n}</span><span class="tt">${esc(t)}</span>
      <span class="chip ${s === 'grey' ? '' : s}">${s === 'grey' ? 'non previsto' : `${done}/${tot}`}</span></div>
    ${open ? `<div class="b">${pointExtra(ev, n)}${its.map(it => viewItem(ev, it)).join('')}${pointFooter(ev, n)}</div>` : ''}
  </div>`;
}
function pointExtra(ev, n) {
  if (n === 1) return `<div class="row" style="margin-top:8px"><button class="btn sm sec edit" data-a="fillDocs" data-id="${ev.id}" data-p="1">Ricompila tutti i documenti</button></div>`;
  if (n === 11) return `<div class="row" style="margin-top:8px"><button class="btn sm sec edit" data-a="fillDocs" data-id="${ev.id}" data-p="11">Ricompila tutti i documenti</button></div>`;
  return '';
}
function pointFooter(ev, n) {
  if (n === 4 || n === 6) return `<button class="btn big sec edit" data-a="creaCal" data-id="${ev.id}" data-p="${n}" style="margin-top:10px">CREA CALENDARIO</button>
    ${ev['cal' + n] ? `<div class="small muted">${n === 4 ? 'Date riportate sul calendario e nel riepilogo' : 'Riportato nel riepilogo'} il ${fmtD(ev['cal' + n])}</div>` : ''}`;
  return '';
}
function dueBadge(ev, it) {
  const due = itemDue(ev, it);
  if (!due) return it.dueNote ? `<span class="chip">Data ultima: ${esc(it.dueNote)}</span>` : '';
  if (itemDone(ev, it)) return `<span class="chip">Data ultima ${fmtD(due)}</span>`;
  const left = diffDays(due, today());
  const cls = left < 0 ? 'bad' : left <= (it.alert || 10) ? 'orange' : '';
  return `<span class="chip ${cls}">Data ultima ${fmtD(due)}${left < 0 ? ' · scaduta' : left <= (it.alert || 10) ? ` · ${left} gg` : ''}</span>`;
}
function dateIn(ev, it, field, label, disabled) {
  const v = st(ev, it.key)[field] || '';
  return `<label>${esc(label)}</label><input class="i sm" type="date" value="${v}" ${disabled || !canEdit() ? 'disabled' : ''} data-ch="itDate" data-id="${ev.id}" data-k="${esc(it.key)}" data-f="${field}">`;
}
function attLink(ev, k, label) { return ev.att[k] ? `<span class="att" data-a="openAtt" data-id="${ev.id}" data-k="${k}">📄 ${esc(label || ev.att[k].name)}</span>` : ''; }

function viewItem(ev, it) {
  const s = st(ev, it.key), done = itemDone(ev, it), applies = itemApplies(ev, it);
  const cls = !applies ? 'grey' : done ? 'ok' : 'warn';
  const E = canEdit();
  let body = '';
  const k = esc(it.key);
  switch (it.kind) {
    case 'pec': {
      const dk = it.doc ? 'doc:' + norm(it.doc) : null;
      body = `<div class="ln">${dueBadge(ev, it)}${dateIn(ev, it, 'exec', it.execLabel || 'Eseguita il')}</div>`;
      if (dk) body += `<div class="ln">${ev.att[dk] ? attLink(ev, dk, it.doc + '.pdf') : `<span class="small muted">${findDoc(it.doc) ? 'Documento non ancora compilato' : 'Documento non presente nel tasto DOCUMENTI'}</span>`}
        <button class="btn sm sec edit" data-a="fillOne" data-id="${ev.id}" data-doc="${esc(it.doc)}">Compila</button></div>`;
      break;
    }
    case 'gen': body = `<div class="ln">${attLink(ev, it.att)}<button class="btn sm edit" data-a="gen" data-id="${ev.id}" data-g="${it.gen}">${esc(it.genLabel || 'Crea PDF')}</button></div>`; break;
    case 'menu': body = viewMenuItem(ev); break;
    case 'prezzi': body = viewPrezziItem(ev); break;
    case 'spesa': {
      const groups = [...new Set(eventShopping(ev).map(x => groupFor(x.forn)))];
      body = `<div class="small" style="margin-top:6px"><b>Fornitori interessati:</b> ${groups.length ? groups.map(g => esc(groupLabel(g))).join(' · ') : '<span class="muted">nessuno (menu vuoto o senza numero di persone)</span>'}</div>
      <div class="ln">${attLink(ev, 'spesa', 'Lista spesa.pdf')}<button class="btn sm edit" data-a="gen" data-id="${ev.id}" data-g="spesa">CREA</button></div>
      <div class="ln">${dateIn(ev, it, 'plan', 'Spesa prevista il', !ev.att.spesa)}${dateIn(ev, it, 'exec', 'Spesa completata il', !ev.att.spesa)}</div>`;
      break;
    }
    case 'prep': {
      const ds = s.dates && s.dates.length ? s.dates : [{ d: '', note: '' }];
      body = ds.map((x, i) => `<div class="ln"><label>${i ? (i + 1) + '° giorno' : 'Data prevista'}</label><input class="i sm" type="date" value="${x.d || ''}" ${E ? '' : 'disabled'} data-ch="prepDate" data-id="${ev.id}" data-k="${k}" data-i="${i}">
        <input class="i sm" placeholder="nota / dettagli" value="${esc(x.note || '')}" ${E ? '' : 'disabled'} data-ch="prepNote" data-id="${ev.id}" data-k="${k}" data-i="${i}" style="flex:1;min-width:140px">
        ${i ? `<button class="btn sm sec edit" data-a="prepDel" data-id="${ev.id}" data-k="${k}" data-i="${i}">✕</button>` : ''}</div>`).join('');
      if (ds[0].d) body += `<div class="ln"><button class="btn sm sec edit" data-a="prepAdd" data-id="${ev.id}" data-k="${k}">+ altro giorno</button>${dateIn(ev, it, 'exec', 'Fine operazioni')}</div>`;
      break;
    }
    case 'link': body = `<div class="ln">${ev.att[it.att] ? attLink(ev, it.att) : `<span class="small muted">Non ancora disponibile (${esc(it.hint)})</span>`}</div>`; break;
    case 'date': body = `<div class="ln">${dueBadge(ev, it)}${dateIn(ev, it, 'exec', it.execLabel || 'Data')}</div>`; break;
    case 'close': body = `<div class="ln">${it.locked ? `<span class="small muted">${esc(it.lockNote)}</span>` : dueBadge(ev, it) + '<span class="small muted">avviso 5 giorni prima</span>'}</div>`; break;
    case 'plan': body = `<div class="ln"><label><input type="checkbox" ${s.needed !== false ? 'checked' : ''} ${E ? '' : 'disabled'} data-ch="planNeed" data-id="${ev.id}" data-k="${k}"> previsto</label>
      ${applies ? dateIn(ev, it, 'plan', 'Data') : ''}</div>`; break;
    case 'upload': body = `<div class="ln">${attLink(ev, it.att, 'Locandina')}<button class="btn sm edit" data-a="upAtt" data-id="${ev.id}" data-att="${it.att}">${ev.att[it.att] ? 'Sostituisci' : 'Carica'} PDF</button></div>`; break;
    case 'uploadpec': body = `<div class="ln">${dueBadge(ev, it)}</div><div class="ln">${attLink(ev, it.att, 'Piano sicurezza')}<button class="btn sm edit" data-a="upAtt" data-id="${ev.id}" data-att="${it.att}">${ev.att[it.att] ? 'Sostituisci' : 'Carica'} PDF</button>${dateIn(ev, it, 'exec', it.execLabel || 'Fatto il', !ev.att[it.att])}</div>`; break;
  }
  const check = it.kind === 'link' ? '' : done
    ? `<div class="ln"><span class="done-line">✓ Attività terminata il ${fmtD(s.doneAt)}</span><button class="btn sm sec edit" data-a="undo" data-id="${ev.id}" data-k="${k}">Annulla</button></div>`
    : applies ? `<div class="ln edit"><button class="btn sm ok" data-a="check" data-id="${ev.id}" data-k="${k}" ${canCheck(ev, it) ? '' : 'disabled'}>✓ Concludi</button>
        <button class="btn sm sec" data-a="scad" data-id="${ev.id}" data-k="${k}">⏰ Scadenza${s.custDue ? ' ' + fmtD(s.custDue) : ''}</button></div>` : '';
  return `<div class="it ${cls}"><div class="lab">${esc(it.label)}</div>${body}${check}</div>`;
}
function viewMenuItem(ev) {
  const E = canEdit(), rs = menuRecipes(ev);
  return `<div class="ln"><label>Numero persone</label><input class="i sm" type="number" min="0" style="width:100px" value="${esc(ev.menu.persone || '')}" ${E ? '' : 'disabled'} data-ch="menuPers" data-id="${ev.id}"></div>
   <table class="t" style="margin-top:6px">${rs.map(r => `<tr><td>${esc(r.nome)}</td><td class="small muted">${esc(r.cat)}</td><td class="n edit"><button class="btn sm sec" data-a="menuDel" data-id="${ev.id}" data-r="${r.id}">✕</button></td></tr>`).join('') || '<tr><td class="muted small">Nessun piatto nel menu</td></tr>'}</table>
   <div class="ln"><button class="btn sm sec edit" data-a="menuAdd" data-id="${ev.id}">+ Aggiungi ricetta</button>${attLink(ev, 'menu', 'Menu.pdf')}<button class="btn sm edit" data-a="gen" data-id="${ev.id}" data-g="menu">CREA MENU</button></div>`;
}
function viewPrezziItem(ev) {
  const E = canEdit(), rs = menuRecipes(ev);
  return `<table class="t" style="margin-top:6px">${rs.map(r => `<tr><td>${esc(r.nome)}</td><td class="n"><input class="i sm" style="width:100px" inputmode="decimal" placeholder="€" value="${esc(ev.prezzi[r.id] || '')}" ${E ? '' : 'disabled'} data-ch="prezzo" data-id="${ev.id}" data-r="${r.id}"></td></tr>`).join('') || '<tr><td class="muted small">Il menu (punto 2) è vuoto</td></tr>'}
   <tr><td class="tot">PREZZO MENU</td><td class="n"><input class="i sm" style="width:100px" inputmode="decimal" placeholder="€" value="${esc(ev.prezzoMenu || '')}" ${E ? '' : 'disabled'} data-ch="prezzoMenu" data-id="${ev.id}"></td></tr></table>
   <div class="ln">${attLink(ev, 'prezziario', 'Prezziario.pdf')}<button class="btn sm edit" data-a="gen" data-id="${ev.id}" data-g="prezziario">CREA MENU CON PREZZI</button></div>`;
}

/* ---------- AZIONI CHECKLIST ---------- */
const evById = id => DB.events.find(e => e.id === id);
A.togglePt = d => { const set = UI.open[d.id]; const n = +d.n; set.has(n) ? set.delete(n) : set.add(n); render(); };
CH.evNome = async (d, el) => { const ev = evById(d.id); const v = el.value.trim(); if (!v) { el.value = ev.nome; return; } ev.nome = v; await save('events'); render(); };
A.evAggiorna = async d => {
  const ev = evById(d.id);
  const names = [...(isOn(ev, 1) ? DOCS_P1 : []), ...(isOn(ev, 11) ? DOCS_P11 : [])].filter(nm => ev.att['doc:' + norm(nm)] || findDoc(nm));
  busy(true, 'Aggiorno i documenti…');
  try {
    for (const [g, [fn, label]] of Object.entries(GEN)) if (ev.att[g]) { try { await setAtt(ev, g, await fn(ev), safeName(ev.nome + '_' + label) + '.pdf'); } catch { } }
    for (const k of ['riepilogo', 'fascicolo']) if (ev.att[k]) { delFile(ev.att[k].fileId); delete ev.att[k]; }
  } finally { busy(false); }
  await fillAllDocs(ev, names, true);
  ev.nomeDocs = ev.nome; await save('events'); toast('Nome aggiornato su tutti i documenti. Ricrea il fascicolo se ti serve.'); render();
};
A.evDate = d => {
  const ev = evById(d.id);
  modal('Date e orari', `<div class="cols"><div>${fld('Primo giorno', 'inizio', ev.inizio, 'date', true)}</div><div>${fld('Ultimo giorno', 'fine', ev.fine, 'date')}</div>
    <div>${fld('Ora inizio', 'oraInizio', ev.oraInizio, 'time')}</div><div>${fld('Ora fine', 'oraFine', ev.oraFine, 'time')}</div></div>`, async f => {
    const fine = f.fine || f.inizio; if (fine < f.inizio) { toast('L\'ultimo giorno è prima del primo'); return false; }
    Object.assign(ev, { inizio: f.inizio, fine, oraInizio: f.oraInizio, oraFine: f.oraFine }); await save('events'); render();
  });
};
A.evPunti = d => {
  const ev = evById(d.id);
  modal('Punti attivi della checklist', `<p class="small muted">Impostati dal wizard. Puoi correggerli qui.</p>${POINTS.map(([n, t]) => `<label style="display:flex;gap:8px;padding:5px 0"><input type="checkbox" name="p${n}" ${isOn(ev, n) ? 'checked' : ''}> ${n}. ${esc(t)}</label>`).join('')}`, async f => {
    const on = POINTS.map(([n]) => n).filter(n => f['p' + n]);
    if (on.includes(5) && !on.includes(12)) on.push(12);
    ev.enabled = on.sort((a, b) => a - b); await save('events'); render();
  });
};
A.evDelete = d => {
  const ev = evById(d.id);
  confirmBox(`Eliminare definitivamente "${ev.nome}" con la checklist, gli allegati e il bilancio?`, async () => {
    Object.values(ev.att || {}).forEach(a => delFile(a.fileId));
    DB.events = DB.events.filter(e => e.id !== ev.id); await save('events'); go('#/eventi');
  }, 'Elimina');
};
CH.itDate = async (d, el) => {
  const ev = evById(d.id); const s = st(ev, d.k);
  s[d.f] = el.value || '';
  if (!el.value && d.f === 'exec') { s.done = false; s.doneAt = ''; }
  await save('events'); render();
};
A.check = async d => { const ev = evById(d.id); const s = st(ev, d.k); s.done = true; s.doneAt = today(); await save('events'); render(); };
A.undo = async d => { const ev = evById(d.id); const s = st(ev, d.k); s.done = false; s.doneAt = ''; await save('events'); render(); };
A.scad = d => {
  const ev = evById(d.id); const s = st(ev, d.k);
  modal('Scadenza dell\'attività', `<p class="small muted">La data comparirà nel calendario (⏰) e nel riquadro SCADENZE della home 10 giorni prima.</p>${fld('Da fare entro il', 'data', s.custDue || '', 'date', true)}`, async f => {
    s.custDue = f.data; await save('events'); render();
  });
  if (s.custDue) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sec'; b.textContent = 'Rimuovi'; b.onclick = async () => { s.custDue = ''; await save('events'); closeModal(); render(); }; $('.md .row.end').prepend(b); }
};
CH.prepDate = async (d, el) => { const ev = evById(d.id); const s = st(ev, d.k); s.dates = s.dates || [{ d: '', note: '' }]; s.dates[+d.i] = { ...(s.dates[+d.i] || {}), d: el.value }; await save('events'); render(); };
CH.prepNote = async (d, el) => { const ev = evById(d.id); const s = st(ev, d.k); s.dates = s.dates || [{ d: '', note: '' }]; s.dates[+d.i] = { ...(s.dates[+d.i] || {}), note: el.value }; await save('events'); };
A.prepAdd = async d => { const ev = evById(d.id); const s = st(ev, d.k); s.dates = s.dates || []; s.dates.push({ d: '', note: '' }); render(); };
A.prepDel = async d => { const ev = evById(d.id); const s = st(ev, d.k); s.dates.splice(+d.i, 1); await save('events'); render(); };
CH.planNeed = async (d, el) => { const ev = evById(d.id); const s = st(ev, d.k); s.needed = el.checked; if (!el.checked) { s.done = false; s.plan = ''; } await save('events'); render(); };
CH.menuPers = async (d, el) => { const ev = evById(d.id); ev.menu.persone = num(el.value); await save('events'); render(); };
CH.prezzo = async (d, el) => { const ev = evById(d.id); ev.prezzi[d.r] = el.value.trim(); await save('events'); };
CH.prezzoMenu = async (d, el) => { const ev = evById(d.id); ev.prezzoMenu = el.value.trim(); await save('events'); };
A.menuDel = async d => { const ev = evById(d.id); ev.menu.ricette = ev.menu.ricette.filter(r => r !== d.r); await save('events'); render(); };
A.menuAdd = d => {
  const ev = evById(d.id);
  if (!DB.recipes.length) return toast('Il ricettario è vuoto: aggiungi prima le ricette dal tasto RICETTARIO');
  modal('Aggiungi ricette al menu', REC_CATS.map(c => { const rs = DB.recipes.filter(r => r.cat === c); return rs.length ? `<div style="margin-top:8px"><b class="small">${c}</b>${rs.map(r => `<label style="display:flex;gap:8px;padding:4px 0"><input type="checkbox" name="r_${r.id}" ${ev.menu.ricette.includes(r.id) ? 'checked' : ''}> ${esc(r.nome)}</label>`).join('')}</div>` : ''; }).join(''), async f => {
    ev.menu.ricette = DB.recipes.filter(r => f['r_' + r.id]).map(r => r.id); await save('events'); render();
  }, { noFocus: true });
};
A.gen = async d => {
  const ev = evById(d.id); const [fn, label] = GEN[d.g];
  busy(true, 'Creo il PDF…');
  try { await setAtt(ev, d.g, await fn(ev), safeName(ev.nome + '_' + label) + '.pdf'); await save('events'); toast('PDF creato e allegato alla checklist'); }
  catch (e) { toast(e.message); } finally { busy(false); render(); }
};
A.openAtt = d => { const ev = evById(d.id); const a = ev.att[d.k]; if (a) openFile(a.fileId, a.name); };
A.upAtt = async d => {
  const ev = evById(d.id);
  const f = await pickFile('application/pdf,image/*'); if (!f) return;
  busy(true, 'Carico…');
  try {
    const pdf = await toPdfBlob(f, f.name);
    await setAtt(ev, d.att, pdf, safeName(ev.nome + '_' + (d.att === 'locandina' ? 'Locandina' : 'Piano_sicurezza')) + '.pdf');
    await save('events'); toast('Caricato');
  } catch (e) { toast('Errore: ' + e.message); } finally { busy(false); render(); }
};
A.fillDocs = async d => { const ev = evById(d.id); await fillAllDocs(ev, d.p === '1' ? DOCS_P1 : DOCS_P11); };
A.fillOne = async d => { const ev = evById(d.id); await fillAllDocs(ev, [d.doc]); };
A.creaCal = async d => {
  const ev = evById(d.id); ev['cal' + d.p] = today(); await save('events');
  toast(d.p === '4' ? 'Date riportate sul calendario Proloco e nel riepilogo' : 'Impianti e date riportati nel riepilogo'); render();
};
A.evRiepilogo = async d => {
  const ev = evById(d.id); busy(true, 'Creo il riepilogo…');
  try { const b = await genRiepilogoPdf(ev); if (canEdit()) { await setAtt(ev, 'riepilogo', b, safeName(ev.nome + '_RIEPILOGO') + '.pdf'); await save('events'); } downloadBlob(b, safeName(ev.nome + '_RIEPILOGO') + '.pdf'); }
  catch (e) { toast(e.message); } finally { busy(false); }
};
A.evFascicolo = d => genFascicolo(evById(d.id));

/* impegni sul calendario derivati dagli eventi */
function eventCalendarEntries() {
  const out = [];
  for (const ev of DB.events) {
    daysRange(ev.inizio, ev.fine).forEach(d => out.push({ d, label: ev.nome, ev: ev.id, kind: 'evento' }));
    if (ev.cal4) PREP_VOCI.forEach(v => (st(ev, 'p4:' + v).dates || []).forEach(x => x.d && out.push({ d: x.d, label: `${v[0] + v.slice(1).toLowerCase()} – ${ev.nome}`, ev: ev.id, kind: 'prep', note: x.note })));
  }
  return out;
}
