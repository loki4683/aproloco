'use strict';
/* ===== APROLOCO — lettura di file Excel (.xlsx) e CSV senza librerie esterne ===== */

async function inflateRaw(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
/* legge i file contenuti in uno zip (un .xlsx è uno zip di file XML) */
async function unzip(buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Il file non è un Excel .xlsx valido');
  const count = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  const files = {}, dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
    files[name] = { method, csize, off };
    p += 46 + nl + el + cl;
  }
  return {
    names: Object.keys(files),
    async text(name) {
      const f = files[name]; if (!f) return null;
      const lnl = dv.getUint16(f.off + 26, true), lel = dv.getUint16(f.off + 28, true);
      const start = f.off + 30 + lnl + lel, data = u8.subarray(start, start + f.csize);
      const raw = f.method === 0 ? data : await inflateRaw(data);
      return dec.decode(raw);
    },
  };
}
const xmlDoc = s => new DOMParser().parseFromString(s, 'application/xml');
const tags = (node, t) => Array.from(node.getElementsByTagNameNS('*', t));
function colIndex(ref) { const m = /^([A-Z]+)/.exec(ref || ''); if (!m) return -1; let n = 0; for (const ch of m[1]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; }

async function readXlsx(buf) {
  const z = await unzip(buf);
  const wb = xmlDoc(await z.text('xl/workbook.xml') || '<x/>');
  const rels = xmlDoc(await z.text('xl/_rels/workbook.xml.rels') || '<x/>');
  const relMap = {}; tags(rels, 'Relationship').forEach(r => relMap[r.getAttribute('Id')] = r.getAttribute('Target'));
  const ssXml = await z.text('xl/sharedStrings.xml');
  const shared = ssXml ? tags(xmlDoc(ssXml), 'si').map(si => tags(si, 't').map(t => t.textContent).join('')) : [];
  const sheets = [];
  for (const s of tags(wb, 'sheet')) {
    const rid = s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || s.getAttribute('r:id');
    let target = relMap[rid] || ''; target = target.replace(/^\/?xl\//, '').replace(/^\//, '');
    const xml = await z.text('xl/' + target); if (!xml) continue;
    const rows = [];
    for (const r of tags(xmlDoc(xml), 'row')) {
      const ri = (+r.getAttribute('r') || rows.length + 1) - 1; const row = [];
      for (const c of tags(r, 'c')) {
        const ci = colIndex(c.getAttribute('r')); const t = c.getAttribute('t'); const v = tags(c, 'v')[0]?.textContent;
        let val;
        if (t === 's') val = shared[+v] ?? '';
        else if (t === 'inlineStr') val = tags(c, 't').map(x => x.textContent).join('');
        else if (t === 'b') val = v === '1' ? 'VERO' : 'FALSO';
        else if (t === 'str' || t === 'e') val = v ?? '';
        else val = v == null ? '' : (isNaN(+v) ? v : +v);
        row[ci < 0 ? row.length : ci] = val;
      }
      rows[ri] = Array.from(row, x => x ?? '');
    }
    sheets.push({ name: s.getAttribute('name'), rows: Array.from(rows, r => r || []) });
  }
  if (!sheets.length) throw new Error('Nessun foglio leggibile nel file');
  return sheets;
}
function readCsv(text) {
  const first = text.split(/\r?\n/)[0] || '';
  const sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : (first.includes('\t') ? '\t' : ',');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; continue; }
    if (ch === '"') q = true; else if (ch === sep) { row.push(cur); cur = ''; } else if (ch === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; } else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return [{ name: 'CSV', rows }];
}
async function readSpreadsheet(file) {
  if (/\.csv$|\.txt$/i.test(file.name) || /csv|text\/plain/.test(file.type)) return readCsv(await file.text());
  if (/\.xls$/i.test(file.name)) throw new Error('Il vecchio formato .xls non è supportato: in Excel usa "Salva con nome" → "Cartella di lavoro Excel (.xlsx)" oppure CSV');
  return readXlsx(await file.arrayBuffer());
}

/* --- conversioni dei valori delle celle --- */
function cellNumber(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').replace(/[€\s]/g, '').replace(/EUR/i, '');
  if (!s) return NaN;
  let neg = false; if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = parseFloat(s); return isNaN(n) ? NaN : (neg ? -n : n);
}
function cellDate(v) {
  if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000); return d.toISOString().slice(0, 10); }
  const s = String(v ?? '').trim(); let m;
  if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/))) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${pad(m[2])}-${pad(m[1])}`; }
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
  return '';
}
