/**
 * npm test
 *
 * Covers the branch that decides whether a contact request is emailed or parked
 * on disk, the SMTP connection options, and a real end-to-end send against a
 * throwaway SMTP server — the parts that are expensive to get wrong and
 * impossible to notice until a real enquiry goes missing.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  sendContactRequest,
  smtpOptions,
  subjectFor,
  bodyFor,
  resetTransport,
  DEFAULT_TO,
} from './mailer.js';

const here = dirname(fileURLToPath(import.meta.url));
const INBOX = join(here, '..', 'data', 'contact-requests.jsonl');
const SINK_PORT = 2526;

const REQUEST = {
  nombre: 'Ana Rojas',
  empresa: 'Constructora X',
  email: 'ana@example.com',
  telefono: '+506 8888 8888',
  tipo: 'comercial',
  mensaje: 'Necesito cotizar tablero y breakers.',
  consent: true,
  receivedAt: '2026-09-10T00:00:00.000Z',
};

const ENV_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'CONTACT_FROM', 'CONTACT_TO'];

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
  resetTransport();
}

let sink;

before(async () => {
  await rm(join(here, '..', 'data'), { recursive: true, force: true });
  sink = spawn(process.execPath, [join(here, 'smtp-sink.js')], {
    env: { ...process.env, SINK_PORT: String(SINK_PORT) },
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  await new Promise((resolve) => sink.stdout.once('data', resolve));
});

after(async () => {
  resetTransport();
  sink.kill();
  await rm(join(here, '..', 'data'), { recursive: true, force: true });
});

test('with nothing configured it parks the enquiry, addressed to info@disetechcr.com', async () => {
  clearEnv();
  const result = await sendContactRequest(REQUEST);
  assert.equal(result.to, DEFAULT_TO);
  assert.equal(result.delivered, false);
  assert.equal(result.via, 'file');
  assert.match(await readFile(INBOX, 'utf8'), /Ana Rojas/);
});

test('port 465 goes straight to TLS, 587 upgrades with STARTTLS', () => {
  clearEnv();
  process.env.SMTP_HOST = 'smtp.example.com';

  process.env.SMTP_PORT = '465';
  assert.deepEqual(
    { secure: smtpOptions().secure, requireTLS: smtpOptions().requireTLS },
    { secure: true, requireTLS: false },
  );

  process.env.SMTP_PORT = '587';
  assert.deepEqual(
    { secure: smtpOptions().secure, requireTLS: smtpOptions().requireTLS },
    { secure: false, requireTLS: true },
    'credentials must never cross the network unencrypted',
  );

  process.env.SMTP_USER = 'buzon';
  process.env.SMTP_PASS = 'secreto';
  assert.deepEqual(smtpOptions().auth, { user: 'buzon', pass: 'secreto' });
});

test('sends over SMTP to the inbox, with the enquirer as reply-to', async () => {
  clearEnv();
  Object.assign(process.env, {
    SMTP_HOST: 'localhost',
    SMTP_PORT: String(SINK_PORT),
    CONTACT_FROM: 'web@disetechcr.com',
  });

  const received = new Promise((resolve) => {
    let buffer = '';
    const onData = (chunk) => {
      buffer += chunk.toString();
      if (buffer.includes('============')) {
        sink.stdout.off('data', onData);
        resolve(buffer);
      }
    };
    sink.stdout.on('data', onData);
  });

  const result = await sendContactRequest(REQUEST);
  assert.equal(result.delivered, true);
  assert.equal(result.via, 'smtp');
  assert.equal(result.to, DEFAULT_TO);

  const wire = await received;
  assert.match(wire, /^To: info@disetechcr\.com$/m);
  assert.match(wire, /^From: web@disetechcr\.com$/m);
  assert.match(wire, /^Reply-To: ana@example\.com$/m);
  assert.match(wire, /tablero y breakers/);
});

test('a failed send is still recoverable from disk', async () => {
  clearEnv();
  await rm(join(here, '..', 'data'), { recursive: true, force: true });
  Object.assign(process.env, {
    SMTP_HOST: 'localhost',
    SMTP_PORT: '1', // nothing listening
    CONTACT_FROM: 'web@disetechcr.com',
  });

  await assert.rejects(() => sendContactRequest(REQUEST));

  const parked = JSON.parse(await readFile(INBOX, 'utf8'));
  assert.equal(parked.nombre, 'Ana Rojas');
  assert.ok(parked.deliveryError, 'the reason it failed is recorded alongside it');
});

test('a host without a sender fails loudly instead of silently', async () => {
  clearEnv();
  process.env.SMTP_HOST = 'smtp.example.com';
  await assert.rejects(() => sendContactRequest(REQUEST), /CONTACT_FROM is missing/);
});

test('subject and body carry the details', () => {
  assert.equal(subjectFor(REQUEST), 'Solicitud web · Proyecto comercial · Ana Rojas');
  const body = bodyFor(REQUEST);
  assert.match(body, /Constructora X/);
  assert.match(body, /\+506 8888 8888/);
  assert.match(body, /tablero y breakers/);
});
