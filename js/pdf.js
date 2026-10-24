'use strict';
/* ===== APROLOCO — creazione, compilazione e unione dei PDF (pdf-lib) ===== */

const { PDFDocument, StandardFonts, rgb, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } = PDFLib;
const A4 = [595.28, 841.89];
const C_BRAND = rgb(0.61, 0.17, 0.14), C_INK = rgb(0.16, 0.13, 0.1), C_MUTED = rgb(0.45, 0.4, 0.35), C_LINE = rgb(0.85, 0.8, 0.72);

/* rende il testo compatibile con i font standard del PDF */
function pdfSafe(font, s) {
  s = String(s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/\t/g, '    ');
  let out = '';
  for (const ch of s) {
    if (ch === '\n') { out += ch; continue; }
    try { font.widthOfTextAtSize(ch, 10); out += ch; } catch { out += '?'; }
  }
  return out;
}

class PdfWriter {
  async init(title, subtitle) {
    this.doc = await PDFDocument.create();
    this.doc.setTitle(title || 'APROLOCO'); this.doc.setProducer('APROLOCO'); this.doc.setCreator('APROLOCO');
    this.f = await this.doc.embedFont(StandardFonts.Helvetica);
    this.fb = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.m = 48; this.title = title; this.newPage();
    if (title) {
      this.text(title, { size: 20, bold: true, color: C_BRAND });
      if (subtitle) this.text(subtitle, { size: 11, color: C_MUTED });
      this.rule(); this.y -= 6;
    }
    return this;
  }
  newPage() { this.page = this.doc.addPage(A4); this.y = A4[1] - this.m; }
  need(h) { if (this.y - h < this.m + 20) this.newPage(); }
  wrap(str, font, size, width) {
    const lines = [];
    for (const para of pdfSafe(font, str).split('\n')) {
      const words = para.split(' '); let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (font.widthOfTextAtSize(test, size) <= width) { line = test; continue; }
        if (line) lines.push(line);
        if (font.widthOfTextAtSize(w, size) > width) { // parola lunghissima
          let part = ''; for (const ch of w) { if (font.widthOfTextAtSize(part + ch, size) > width) { lines.push(part); part = ''; } part += ch; } line = part;
        } else line = w;
      }
      lines.push(line);
    }
    return lines;
  }
  text(str, o = {}) {
    const size = o.size || 11, font = o.bold ? this.fb : this.f, x = this.m + (o.indent || 0);
    const width = (o.width || (A4[0] - this.m * 2 - (o.indent || 0)));
    const lh = size * 1.35;
    for (const line of this.wrap(str, font, size, width)) {
      this.need(lh);
      let xx = x;
      if (o.center) xx = (A4[0] - font.widthOfTextAtSize(line, size)) / 2;
      this.page.drawText(line, { x: xx, y: this.y - size, size, font, color: o.color || C_INK });
      this.y -= lh;
    }
    if (o.after) this.y -= o.after;
  }
  h(str) { this.y -= 6; this.need(40); this.text(str, { size: 14, bold: true, color: C_BRAND, after: 2 }); }
  rule() { this.need(8); this.page.drawLine({ start: { x: this.m, y: this.y - 2 }, end: { x: A4[0] - this.m, y: this.y - 2 }, thickness: 1, color: C_LINE }); this.y -= 8; }
  space(n = 8) { this.y -= n; }
  /* righe "etichetta: valore" */
  kv(label, value, o = {}) {
    const size = 11, lw = o.lw || 190, x = this.m;
    const vl = this.wrap(value ?? '', this.f, size, A4[0] - this.m * 2 - lw);
    const ll = this.wrap(label, this.fb, size, lw - 8);
    const n = Math.max(vl.length, ll.length), lh = size * 1.4;
    this.need(n * lh + 6);
    ll.forEach((l, i) => this.page.drawText(l, { x, y: this.y - size - i * lh, size, font: this.fb, color: C_INK }));
    vl.forEach((l, i) => this.page.drawText(l, { x: x + lw, y: this.y - size - i * lh, size, font: this.f, color: o.color || C_INK }));
    this.y -= n * lh + 4;
    this.page.drawLine({ start: { x, y: this.y + 1 }, end: { x: A4[0] - this.m, y: this.y + 1 }, thickness: .5, color: C_LINE });
    this.y -= 4;
  }
  /* tabella semplice: cols = [{t:'Titolo', w:0.5, right:true}], rows = [[..]] */
  table(cols, rows, o = {}) {
    const W = A4[0] - this.m * 2, size = o.size || 10, lh = size * 1.35, pad = 4;
    const widths = cols.map(c => c.w * W);
    const drawRow = (cells, bold, fill) => {
      const wrapped = cells.map((c, i) => this.wrap(c ?? '', bold ? this.fb : this.f, size, widths[i] - pad * 2));
      const h = Math.max(...wrapped.map(w => w.length)) * lh + pad * 2;
      this.need(h);
      if (fill) this.page.drawRectangle({ x: this.m, y: this.y - h, width: W, height: h, color: fill });
      let x = this.m;
      wrapped.forEach((lines, i) => {
        lines.forEach((l, j) => {
          const font = bold ? this.fb : this.f;
          const xx = cols[i].right ? x + widths[i] - pad - font.widthOfTextAtSize(l, size) : x + pad;
          this.page.drawText(l, { x: xx, y: this.y - pad - size - j * lh + 2, size, font, color: C_INK });
        });
        x += widths[i];
      });
      this.y -= h;
      this.page.drawLine({ start: { x: this.m, y: this.y }, end: { x: this.m + W, y: this.y }, thickness: .5, color: C_LINE });
    };
    drawRow(cols.map(c => c.t), true, rgb(0.95, 0.91, 0.84));
    rows.forEach(r => drawRow(r, false, null));
    this.y -= 6;
  }
  async save() {
    const pages = this.doc.getPages();
    pages.forEach((p, i) => {
      const s = `${pdfSafe(this.f, this.title || '')}  -  pag. ${i + 1}/${pages.length}`;
      p.drawText(s, { x: this.m, y: 22, size: 8, font: this.f, color: C_MUTED });
    });
    return new Blob([await this.doc.save()], { type: 'application/pdf' });
  }
}
async function newPdf(title, subtitle) { return new PdfWriter().init(title, subtitle); }

/* --- testo semplice -> PDF --- */
async function textToPdf(title, text) {
  const w = await newPdf(title);
  w.text(text, { size: 11 });
  return w.save();
}

/* --- immagine -> PDF (per locandine caricate come foto) --- */
async function imageToPdf(blob) {
  const doc = await PDFDocument.create();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let img;
  if (/png/i.test(blob.type)) img = await doc.embedPng(bytes);
  else if (/jpe?g/i.test(blob.type)) img = await doc.embedJpg(bytes);
  else { // altri formati: converto in JPEG con il canvas
    const bmp = await createImageBitmap(blob); const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0); const jb = await new Promise(r => c.toBlob(r, 'image/jpeg', .9));
    img = await doc.embedJpg(new Uint8Array(await jb.arrayBuffer()));
  }
  const page = doc.addPage(A4);
  const s = Math.min((A4[0] - 40) / img.width, (A4[1] - 40) / img.height);
  page.drawImage(img, { x: (A4[0] - img.width * s) / 2, y: (A4[1] - img.height * s) / 2, width: img.width * s, height: img.height * s });
  return new Blob([await doc.save()], { type: 'application/pdf' });
}
async function toPdfBlob(blob, name) {
  if (/pdf/i.test(blob.type) || /\.pdf$/i.test(name || '')) return blob;
  if (/^image\//.test(blob.type)) return imageToPdf(blob);
  if (/^text\//.test(blob.type) || /\.txt$/i.test(name || '')) return textToPdf(name || 'Documento', await blob.text());
  throw new Error('Formato non supportato');
}

/* --- elenco campi compilabili di un PDF --- */
async function pdfFieldNames(blob) {
  try {
    const doc = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true });
    return doc.getForm().getFields().map(f => f.getName());
  } catch { return []; }
}

/* --- compilazione: PDF con campi o testo con {{CHIAVI}} --- */
async function fillPdfForm(blob, vars) {
  const doc = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true });
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let filled = 0; const fields = form.getFields();
  for (const f of fields) {
    const key = norm(f.getName());
    const val = lookupVar(vars, key);
    if (val == null || val === '') continue;
    try {
      if (f instanceof PDFTextField) { f.setText(pdfSafe(font, val)); filled++; }
      else if (f instanceof PDFCheckBox) { if (/^(SI|SÌ|X|TRUE|1|YES)$/i.test(String(val).trim())) { f.check(); filled++; } }
      else if (f instanceof PDFDropdown) { f.select(String(val)); filled++; }
      else if (f instanceof PDFRadioGroup) { f.select(String(val)); filled++; }
    } catch { }
  }
  try { form.updateFieldAppearances(font); } catch { }
  return { blob: new Blob([await doc.save()], { type: 'application/pdf' }), filled, total: fields.length };
}
function lookupVar(vars, key) {
  if (key in vars) return vars[key];
  // corrispondenza parziale (es. campo "NomeEvento1" -> NOMEEVENTO)
  const k2 = key.replace(/\d+$/, '');
  if (k2 in vars) return vars[k2];
  return null;
}
function fillTextTemplate(text, vars) {
  let filled = 0, total = 0;
  const out = text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, k) => { total++; const v = lookupVar(vars, norm(k)); if (v == null || v === '') return '______________'; filled++; return v; });
  return { text: out, filled, total };
}

/* --- unione di più PDF in un fascicolo --- */
async function mergePdfs(blobs) {
  const out = await PDFDocument.create();
  for (const b of blobs) {
    try {
      const src = await PDFDocument.load(await b.arrayBuffer(), { ignoreEncryption: true });
      try { src.getForm().flatten(); } catch { }
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach(p => out.addPage(p));
    } catch (e) { console.warn('PDF non unito', e); }
  }
  return new Blob([await out.save()], { type: 'application/pdf' });
}
