// APROLOCO — server di condivisione (Cloudflare Worker + KV)
// Binding KV richiesto: PROLOCO
// Variabili segrete richieste (Settings > Variables and Secrets):
//   PIN_DIRETTIVO   -> sola lettura (tutto il direttivo)
//   PIN_PRESIDENTE  -> modifica
//   PIN_CONTABILE   -> modifica
//   PIN_CUCINE      -> modifica

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Pin, X-File-Type, X-File-Name',
  'Access-Control-Expose-Headers': 'Content-Type, X-File-Type, X-File-Name',
};

const COLLECTIONS = /^[a-z_]{2,40}$/;
const FILE_ID = /^[A-Za-z0-9_-]{4,80}$/;
const MAX_FILE = 24 * 1024 * 1024; // limite KV ~25 MB

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function roleFor(pin, env) {
  if (!pin) return null;
  if (env.PIN_PRESIDENTE && pin === env.PIN_PRESIDENTE) return 'presidente';
  if (env.PIN_CONTABILE && pin === env.PIN_CONTABILE) return 'contabile';
  if (env.PIN_CUCINE && pin === env.PIN_CUCINE) return 'cucine';
  if (env.PIN_DIRETTIVO && pin === env.PIN_DIRETTIVO) return 'direttivo';
  return null;
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '');

    if (path === '' || path === '/') return json({ ok: true, app: 'APROLOCO' });
    if (!env.PROLOCO) return json({ error: 'KV PROLOCO non collegato al Worker' }, 500);

    const role = roleFor(req.headers.get('X-Pin'), env);
    if (!role) return json({ error: 'PIN non valido' }, 401);
    const canEdit = role !== 'direttivo';

    if (path === '/api/login') return json({ role, canEdit });

    let m = path.match(/^\/api\/data\/([^/]+)$/);
    if (m) {
      const key = m[1];
      if (!COLLECTIONS.test(key)) return json({ error: 'nome non valido' }, 400);
      if (req.method === 'GET') {
        const v = await env.PROLOCO.get('data:' + key);
        return new Response(v || 'null', { headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
      }
      if (req.method === 'PUT') {
        if (!canEdit) return json({ error: 'Sola lettura' }, 403);
        const body = await req.text();
        try { JSON.parse(body); } catch { return json({ error: 'JSON non valido' }, 400); }
        await env.PROLOCO.put('data:' + key, body);
        return json({ ok: true });
      }
      return json({ error: 'metodo non supportato' }, 405);
    }

    m = path.match(/^\/api\/file\/([^/]+)$/);
    if (m) {
      const id = m[1];
      if (!FILE_ID.test(id)) return json({ error: 'id non valido' }, 400);
      if (req.method === 'GET') {
        const { value, metadata } = await env.PROLOCO.getWithMetadata('file:' + id, { type: 'arrayBuffer' });
        if (!value) return json({ error: 'file non trovato' }, 404);
        return new Response(value, {
          headers: {
            ...CORS,
            'Content-Type': (metadata && metadata.type) || 'application/octet-stream',
            'X-File-Type': (metadata && metadata.type) || '',
            'X-File-Name': encodeURIComponent((metadata && metadata.name) || id),
            'Cache-Control': 'private, max-age=31536000, immutable',
          },
        });
      }
      if (req.method === 'PUT') {
        if (!canEdit) return json({ error: 'Sola lettura' }, 403);
        const buf = await req.arrayBuffer();
        if (buf.byteLength > MAX_FILE) return json({ error: 'File troppo grande (max 24 MB)' }, 413);
        const type = req.headers.get('X-File-Type') || 'application/octet-stream';
        const name = decodeURIComponent(req.headers.get('X-File-Name') || id);
        await env.PROLOCO.put('file:' + id, buf, { metadata: { type, name, size: buf.byteLength } });
        return json({ ok: true, id });
      }
      if (req.method === 'DELETE') {
        if (!canEdit) return json({ error: 'Sola lettura' }, 403);
        await env.PROLOCO.delete('file:' + id);
        return json({ ok: true });
      }
      return json({ error: 'metodo non supportato' }, 405);
    }

    return json({ error: 'non trovato' }, 404);
  },
};
