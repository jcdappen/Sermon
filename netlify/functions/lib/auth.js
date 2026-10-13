// Sitzungen für Sermon: signiertes Cookie (HMAC-SHA256 mit SESSION_SECRET).
// Inhalt nur Personen-ID und Ablaufzeit – keine Namen, kein Passwort.

const crypto = require('crypto');

const COOKIE_NAME = 'sermon_session';
const SESSION_HOURS = 12;
const MIN_SECRET_LENGTH = 32;

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

function getSecret() {
  const secret = process.env.SESSION_SECRET || '';
  return secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

// Erlaubte ChurchTools-Personen (Standard: 1572 "Kalender Öffentlich").
function allowedPersonIds() {
  return String(process.env.CT_LOGIN_PERSON_IDS || '1572')
    .split(',')
    .map(v => parseInt(v.trim(), 10))
    .filter(Number.isInteger);
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const sign = (payload, secret) => crypto.createHmac('sha256', secret).update(payload).digest('base64url');

function createSessionCookie(personId) {
  const secret = getSecret();
  if (!secret) throw new Error('SESSION_SECRET fehlt oder ist zu kurz.');
  const payload = b64url(JSON.stringify({ pid: personId, exp: Date.now() + SESSION_HOURS * 3600 * 1000 }));
  const value = `${payload}.${sign(payload, secret)}`;
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

function readCookie(event, name) {
  const header = event.headers?.cookie || event.headers?.Cookie || '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

// Liefert { personId } bei gültiger, nicht abgelaufener Sitzung einer erlaubten Person, sonst null.
function getSession(event) {
  const secret = getSecret();
  const value = readCookie(event, COOKIE_NAME);
  if (!secret || !value) return null;
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!Number.isInteger(data.pid) || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
  if (!allowedPersonIds().includes(data.pid)) return null;
  return { personId: data.pid };
}

// Für geschützte Functions: gibt entweder { session } oder { response } (401/500) zurück.
function requireSession(event) {
  if (!getSecret()) {
    return {
      response: {
        statusCode: 500,
        headers: JSON_HEADERS,
        body: JSON.stringify({ success: false, error: 'SESSION_SECRET ist nicht (ausreichend lang) konfiguriert.' }),
      },
    };
  }
  const session = getSession(event);
  if (!session) {
    return {
      response: {
        statusCode: 401,
        headers: JSON_HEADERS,
        body: JSON.stringify({ success: false, error: 'Nicht angemeldet.' }),
      },
    };
  }
  return { session };
}

module.exports = {
  JSON_HEADERS,
  allowedPersonIds,
  createSessionCookie,
  clearSessionCookie,
  getSession,
  requireSession,
  getSecret,
};
