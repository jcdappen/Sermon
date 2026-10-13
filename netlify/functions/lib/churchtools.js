// Gemeinsamer ChurchTools-Client für die Netlify Functions.
// Gleiches Muster wie im Gruppenmodul (scripts/fetch-groups.js):
// Base-URL + "Authorization: Login {Token}".
// Token aus CHURCHTOOLS_API_TOKEN (bestehende Netlify-Variable) oder CHURCHTOOLS_TOKEN.
// Der Token bleibt ausschließlich serverseitig (Netlify-Umgebungsvariable).

// Basis-URL ohne abschließendes "/" bzw. "/api" (CHURCHTOOLS_BASE_URL ist bereits in Netlify hinterlegt).
const BASE_URL = (process.env.CT_BASE_URL || process.env.CHURCHTOOLS_BASE_URL || 'https://gemeindekonkordia.church.tools')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');
const API_BASE = `${BASE_URL}/api`;

const CALENDAR_NAME = process.env.CT_CALENDAR_NAME || 'Gottesdienst';
const PREACHER_SERVICE_NAME = process.env.CT_PREACHER_SERVICE_NAME || 'Predigt';
// Dienstgruppe "Predigt" (ID 6) – grenzt die Suche nach dem Dienst ein.
const PREACHER_SERVICE_GROUP_ID = parseInt(process.env.CT_PREACHER_SERVICE_GROUP_ID || '6', 10);

const TOKEN_MISSING_MESSAGE = 'Missing required environment variables: CHURCHTOOLS_API_TOKEN';

function hasToken() {
  return Boolean(process.env.CHURCHTOOLS_API_TOKEN || process.env.CHURCHTOOLS_TOKEN);
}

function getToken() {
  const token = process.env.CHURCHTOOLS_API_TOKEN || process.env.CHURCHTOOLS_TOKEN;
  if (!token) {
    throw new Error(TOKEN_MISSING_MESSAGE);
  }
  return token;
}

async function request(method, endpoint, { params = {}, body } = {}) {
  const url = new URL(`${API_BASE}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach(item => url.searchParams.append(k, item));
    else if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Login ${getToken()}`,
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`ChurchTools API ${res.status} ${method} ${url.pathname}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const apiGet = (endpoint, params) => request('GET', endpoint, { params });

// Sucht per Name: zuerst exakt, dann "enthält" (z. B. "Predigt" für "Prediger"
// über den Wortstamm). Bei Fehlschlag werden die vorhandenen Namen mit ID genannt,
// damit die passende ID per Umgebungsvariable gesetzt werden kann.
function findByName(items, name, label, envVar, stems = []) {
  const norm = v => String(v ?? '').trim().toLowerCase();
  const wanted = norm(name);
  const candidates = [
    i => norm(i.name) === wanted,
    i => norm(i.name).includes(wanted),
    ...stems.map(stem => i => norm(i.name).includes(stem)),
  ];
  for (const test of candidates) {
    const matches = items.filter(test);
    if (matches.length === 1) return matches[0].id;
    if (matches.length > 1) {
      const list = matches.map(m => `"${m.name}" (ID ${m.id})`).join(', ');
      throw new Error(`${label} "${name}" ist in ChurchTools nicht eindeutig: ${list}. Bitte die richtige ID in Netlify als ${envVar} setzen.`);
    }
  }
  const available = items.map(i => `"${i.name}" (ID ${i.id})`).join(', ') || '(keine sichtbar – Rechte des Token-Benutzers prüfen)';
  throw new Error(`${label} "${name}" wurde in ChurchTools nicht gefunden. Vorhanden: ${available}. Bitte die richtige ID in Netlify als ${envVar} setzen.`);
}

// Ermittelt Kalender-ID (Gottesdienst) und Dienst-ID (Predigt) per Name,
// sofern sie nicht per CT_CALENDAR_ID / CT_PREACHER_SERVICE_ID gesetzt sind.
// Der Dienst "Predigt" hat in ChurchTools die ID 1 (Standard);
// CT_PREACHER_SERVICE_ID=auto schaltet auf die Suche per Name um.
async function resolveIds() {
  let calendarId = parseInt(process.env.CT_CALENDAR_ID, 10);
  let serviceId = parseInt(process.env.CT_PREACHER_SERVICE_ID || '1', 10);

  if (isNaN(calendarId)) {
    const res = await apiGet('/calendars');
    calendarId = findByName(res?.data ?? [], CALENDAR_NAME, 'Kalender', 'CT_CALENDAR_ID');
  }
  if (isNaN(serviceId)) {
    const res = await apiGet('/services');
    const all = res?.data ?? [];
    const inGroup = all.filter(svc => svc.serviceGroupId === PREACHER_SERVICE_GROUP_ID);
    serviceId = findByName(inGroup.length ? inGroup : all, PREACHER_SERVICE_NAME, 'Dienst', 'CT_PREACHER_SERVICE_ID', ['predig']);
  }
  return { calendarId, serviceId };
}

function eventCalendarId(event) {
  const cal = event.calendar ?? {};
  return parseInt(cal.domainIdentifier ?? cal.id ?? event.calendarId, 10);
}

// Alle Events des Gottesdienst-Kalenders im Zeitraum, inkl. Dienste.
async function getServiceEvents(calendarId, from, to) {
  // /events ist nicht paginiert; "include" erwartet einen einfachen String.
  const res = await apiGet('/events', { from, to, include: 'eventServices' });
  const events = res?.data ?? [];
  return events.filter(e => eventCalendarId(e) === calendarId && !e.isCanceled);
}

async function getEvent(eventId) {
  const res = await apiGet(`/events/${eventId}`, { include: 'eventServices' });
  return res?.data ?? res;
}

// Dienst-ID eines Event-Dienstes – ChurchTools liefert sie je nach Version
// als Zahl, als String oder verschachtelt unter "service".
function eventServiceServiceId(es) {
  return Number(es.serviceId ?? es.service?.id ?? es.service?.domainIdentifier);
}

// Liefert den ersten Dienst "Predigt" eines Events (oder null).
function findPreacherService(event, serviceId) {
  const services = event.eventServices ?? [];
  const matching = services.filter(s => eventServiceServiceId(s) === Number(serviceId));
  if (matching.length === 0) return null;
  // Bevorzugt einen bereits besetzten Eintrag, damit der eigentliche Prediger gefunden wird.
  return matching.find(s => s.personId || s.name) ?? matching[0];
}

// Für Fehlermeldungen: die im Event vorhandenen Dienst-IDs (ohne Personendaten).
function listServiceIds(event) {
  const ids = [...new Set((event.eventServices ?? []).map(eventServiceServiceId).filter(id => !isNaN(id)))];
  return ids.length ? ids.join(', ') : 'keine (eventServices fehlen in der API-Antwort)';
}

// Normalisiert die Prediger-Daten eines Event-Dienstes.
// Verborgene Zuweisungen (person.icon "user-shield", wenn der Token-Benutzer die
// Person nicht sehen darf) liefern nur einen Platzhalter – dessen ID ist laut
// ChurchTools-Schema keine echte Personen-ID und wird daher nicht übernommen.
function preacherFromService(es) {
  if (!es) return { name: null, personId: null, agreed: false, concealed: false };
  const concealed = es.person?.icon === 'user-shield';
  const name = (es.person?.title || es.name || '').trim() || null;
  const rawPersonId = concealed ? null : (es.personId ?? es.person?.domainIdentifier ?? null);
  const personId = rawPersonId !== null && !isNaN(Number(rawPersonId)) ? Number(rawPersonId) : null;
  // "agreed" ist laut Schema veraltet; "isAccepted" hat Vorrang.
  const agreed = Boolean(es.isAccepted ?? es.agreed);
  return { name, personId: name ? personId : null, agreed, concealed: Boolean(name && concealed) };
}

async function setPreacherViaRest(eventId, eventServiceId, { name, personId, agreed }) {
  return request('PUT', `/events/${eventId}/services/${eventServiceId}`, {
    body: {
      personId: personId ?? null,
      name: personId ? null : (name || null),
      agreed: Boolean(agreed),
    },
  });
}

// Fallback für Instanzen ohne REST-Endpunkt: Legacy-AJAX "churchservice/ajax".
async function setPreacherViaAjax(eventServiceId, { name, personId, agreed }) {
  const form = new URLSearchParams();
  form.set('func', 'updateEventService');
  form.set('id', String(eventServiceId));
  form.set('name', name || '');
  form.set('cdb_person_id', personId ? String(personId) : '');
  form.set('zugesagt_yn', agreed ? '1' : '0');
  form.set('reason', '');

  const res = await fetch(`${BASE_URL}/?q=churchservice/ajax`, {
    method: 'POST',
    headers: {
      Authorization: `Login ${getToken()}`,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  const text = await res.text().catch(() => '');
  let json = null;
  try { json = JSON.parse(text); } catch { /* kein JSON */ }
  if (!res.ok || (json && json.status && json.status !== 'success')) {
    throw new Error(`ChurchTools AJAX ${res.status} updateEventService: ${(json?.message || text).slice(0, 300)}`);
  }
  return json;
}

// Schreibt den Prediger in den Dienst des Events.
// CT_SERVICE_WRITE_MODE: "auto" (Standard: REST, bei 404/405 AJAX), "rest" oder "ajax".
async function setPreacher(eventId, eventServiceId, preacher) {
  const mode = (process.env.CT_SERVICE_WRITE_MODE || 'auto').toLowerCase();
  if (mode === 'ajax') return setPreacherViaAjax(eventServiceId, preacher);
  try {
    return await setPreacherViaRest(eventId, eventServiceId, preacher);
  } catch (err) {
    if (mode === 'auto' && (err.status === 404 || err.status === 405)) {
      return setPreacherViaAjax(eventServiceId, preacher);
    }
    throw err;
  }
}

// Personensuche: gibt bewusst nur ID und Anzeigename zurück (Datenminimierung).
async function searchPersons(query, limit = 10) {
  const res = await apiGet('/search', { query, 'domain_types[]': ['person'] });
  const items = res?.data ?? [];
  return items
    .filter(i => i.domainType === 'person')
    .map(i => ({ id: parseInt(i.domainIdentifier, 10), name: String(i.title ?? '').trim() }))
    .filter(p => !isNaN(p.id) && p.name)
    .slice(0, limit);
}

module.exports = {
  TOKEN_MISSING_MESSAGE,
  hasToken,
  resolveIds,
  getServiceEvents,
  getEvent,
  findPreacherService,
  listServiceIds,
  preacherFromService,
  setPreacher,
  searchPersons,
};
