import { sendContactRequest } from './mailer.js';

const MAX_BODY_BYTES = 16 * 1024;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_CHARS = /^[+\d\s().-]+$/;

const TIPOS = new Set(['materiales', 'instalacion', 'residencial', 'comercial', 'otro']);

const LIMITS = {
  nombre: 120,
  empresa: 160,
  email: 254,
  telefono: 40,
  mensaje: 4000,
};

// ------------------------------------------------------------- rate limiting

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = Number(process.env.CONTACT_RATE_LIMIT ?? 5);

/**
 * ponytail: in-memory per-IP counter. Fine for one process on one box, which is
 * what this is. Move to Redis (or the platform's own rate limiter) the day this
 * runs on more than one instance.
 */
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const seen = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  seen.push(now);
  hits.set(ip, seen);

  // opportunistic sweep so the map cannot grow without bound
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (!times.some((t) => now - t < WINDOW_MS)) hits.delete(key);
    }
  }

  return seen.length > MAX_PER_WINDOW;
}

// ------------------------------------------------------------------ cleaning

/** Trim, collapse control characters into spaces, and cap length. */
function clean(value, max) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, max);
}

function validate(raw) {
  const data = {
    nombre: clean(raw.nombre, LIMITS.nombre),
    empresa: clean(raw.empresa, LIMITS.empresa),
    email: clean(raw.email, LIMITS.email),
    telefono: clean(raw.telefono, LIMITS.telefono),
    tipo: clean(raw.tipo, 32),
    mensaje: clean(raw.mensaje, LIMITS.mensaje),
    consent: raw.consent === 'on' || raw.consent === true,
  };

  const errors = {};
  if (data.nombre.length < 2) errors.nombre = 'Nombre requerido.';
  if (!EMAIL.test(data.email)) errors.email = 'Correo inválido.';

  const digits = data.telefono.replace(/\D/g, '');
  if (!PHONE_CHARS.test(data.telefono) || digits.length < 8 || digits.length > 15) {
    errors.telefono = 'Teléfono inválido.';
  }

  if (!TIPOS.has(data.tipo)) errors.tipo = 'Tipo de solicitud inválido.';
  if (data.mensaje.length < 10) errors.mensaje = 'Mensaje demasiado corto.';

  return { data, errors };
}

// ------------------------------------------------------------------ handler

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('payload too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function handleContact(req, res, ip) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  if (rateLimited(ip)) {
    return json(res, 429, { error: 'rate_limited' });
  }

  let raw;
  try {
    raw = JSON.parse(await readBody(req));
  } catch {
    return json(res, 400, { error: 'invalid_body' });
  }

  // Honeypot. Bots fill every input they find; people never see this one.
  // Answer 200 so the bot has no signal that it was caught.
  if (typeof raw.website === 'string' && raw.website.trim()) {
    console.warn(`[contact] honeypot tripped from ${ip}`);
    return json(res, 200, { ok: true });
  }

  const { data, errors } = validate(raw);
  if (Object.keys(errors).length) {
    return json(res, 422, { error: 'validation_failed', fields: errors });
  }

  try {
    const result = await sendContactRequest({ ...data, ip, receivedAt: new Date().toISOString() });
    return json(res, 200, { ok: true, delivered: result.delivered });
  } catch (error) {
    console.error('[contact] send failed:', error.message);
    return json(res, 502, { error: 'send_failed' });
  }
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}
