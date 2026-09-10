import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import nodemailer from 'nodemailer';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const INBOX = join(root, 'data', 'contact-requests.jsonl');

/** Where contact requests land. Override with CONTACT_TO if it ever moves. */
export const DEFAULT_TO = 'info@disetechcr.com';

const TIPO_LABELS = {
  materiales: 'Materiales eléctricos',
  instalacion: 'Instalación / servicio',
  residencial: 'Proyecto residencial',
  comercial: 'Proyecto comercial',
  otro: 'Otro',
};

/**
 * Sends a contact request to info@disetechcr.com over SMTP.
 *
 * Set SMTP_HOST (plus the usual credentials) and CONTACT_FROM to turn delivery
 * on. With no host configured the request is appended to
 * `data/contact-requests.jsonl` (gitignored) and logged, so nothing is lost
 * while the mailbox is still being set up.
 *
 * A delivery that fails is written to that same file before the error is
 * re-thrown: an expired password or an outage must not evaporate an enquiry.
 */
export async function sendContactRequest(request) {
  const to = process.env.CONTACT_TO || DEFAULT_TO;

  if (isConfigured()) {
    try {
      await deliverOverSmtp(request, to);
      return { delivered: true, via: 'smtp', to };
    } catch (error) {
      await store({ ...request, deliveryError: error.message });
      throw error;
    }
  }

  await store(request);
  console.warn(
    `[mailer] no SMTP host configured — request for ${to} stored in ` +
      'data/contact-requests.jsonl. See .env.example to enable delivery.',
  );
  return { delivered: false, via: 'file', to };
}

export function isConfigured() {
  return Boolean(process.env.SMTP_HOST);
}

export function smtpOptions() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // 465 is TLS from the first byte; 587 and 25 open in the clear and upgrade
  // through STARTTLS.
  const secure = port === 465;

  // Never hand credentials to a server that will not encrypt the session. The
  // loopback exemption is what makes a local SMTP sink testable.
  const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1';

  return {
    host,
    port,
    secure,
    requireTLS: !secure && !isLoopback,
    ...(user ? { auth: { user, pass } } : {}),
    pool: true,
    maxConnections: 2,
  };
}

/**
 * Built once and reused: a fresh transport per enquiry would pay for a new TCP
 * and TLS handshake every time. nodemailer pools the connection behind this.
 */
let transporter = null;

function getTransporter() {
  transporter ??= nodemailer.createTransport(smtpOptions());
  return transporter;
}

/** Drops the pooled connection so a process can exit; used by the tests. */
export function resetTransport() {
  transporter?.close?.();
  transporter = null;
}

async function deliverOverSmtp(request, to) {
  const from = process.env.CONTACT_FROM;
  if (!from) {
    throw new Error('[mailer] SMTP_HOST is set but CONTACT_FROM is missing.');
  }

  await getTransporter().sendMail({
    from,
    to,
    // replying in the mail client goes straight back to the person who wrote in
    replyTo: request.email,
    subject: subjectFor(request),
    text: bodyFor(request),
  });
}

export function subjectFor(request) {
  const tipo = TIPO_LABELS[request.tipo] ?? request.tipo;
  return `Solicitud web · ${tipo} · ${request.nombre}`;
}

export function bodyFor(request) {
  return [
    `Nombre:    ${request.nombre}`,
    `Empresa:   ${request.empresa || '—'}`,
    `Correo:    ${request.email}`,
    `Teléfono:  ${request.telefono}`,
    `Tipo:      ${TIPO_LABELS[request.tipo] ?? request.tipo}`,
    `Consiente: ${request.consent ? 'sí' : 'no'}`,
    `Recibido:  ${request.receivedAt}`,
    '',
    'Mensaje:',
    request.mensaje,
  ].join('\n');
}

async function store(request) {
  await mkdir(dirname(INBOX), { recursive: true });
  await appendFile(INBOX, `${JSON.stringify(request)}\n`, 'utf8');
}
