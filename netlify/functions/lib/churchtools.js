// Gemeinsamer ChurchTools-Client für die Netlify Functions.
// Gleiches Muster wie im Gruppenmodul (scripts/fetch-groups.js):
// Base-URL + "Authorization: Login {Token}".
// Token aus CHURCHTOOLS_API_TOKEN (bestehende Netlify-Variable) oder CHURCHTOOLS_TOKEN.
// Der Token bleibt ausschließlich serverseitig (Netlify-Umgebungsvariable).

const BASE_URL = (process.env.CT_BASE_URL || 'https://gemeindekonkordia.church.tools').replace(/\/+$/, '');
const API_BASE = `${BASE_URL}/api`;

const CALENDAR_NAME = process.env.CT_CALENDAR_NAME || 'Gottesdienst';
const PREACHER_SERVICE_NAME = process.env.CT_PREACHER_SERVICE_NAME || 'Prediger';

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

async function getAllPages(endpoint, params = {}) {
  const results = [];
  let page = 1;
  while (true) {
    const data = await apiGet(endpoint, { ...params, page, limit: 100 });
    const items = data?.data ?? data;
    if (!Array.isArray(items) || items.length === 0) break;
    results.push(...items);
    const meta = data?.meta?.pagination;
    if (!meta || page >= meta.lastPage) break;
    page++;
  }
  return results;
}

function findByName(items, name, label) {
  const wanted = name.trim().toLowerCase();
  const matches = items.filter(i => String(i.name ?? '').trim().toLowerCase() === wanted);
  if (matches.length === 1) return matches[0].id;
  if (matches.length === 0) {
    throw new Error(`${label} "${name}" wurde in ChurchTools nicht gefunden.`);
  }
  throw new Error(`${label} "${name}" ist in ChurchTools nicht eindeutig (IDs: ${matches.map(m => m.id).join(', ')}). Bitte die ID per Umgebungsvariable setzen.`);
}

// Ermittelt Kalender-ID (Gottesdienst) und Dienst-ID (Prediger) per Name,
// sofern sie nicht per CT_CALENDAR_ID / CT_PREACHER_SERVICE_ID gesetzt sind.
async function resolveIds() {
  let calendarId = parseInt(process.env.CT_CALENDAR_ID, 10);
  let serviceId = parseInt(process.env.CT_PREACHER_SERVICE_ID, 10);

  if (isNaN(calendarId)) {
    const res = await apiGet('/calendars');
    calendarId = findByName(res?.data ?? [], CALENDAR_NAME, 'Kalender');
  }
  if (isNaN(serviceId)) {
    const res = await apiGet('/services');
    serviceId = findByName(res?.data ?? [], PREACHER_SERVICE_NAME, 'Dienst');
  }
  return { calendarId, serviceId };
}

function eventCalendarId(event) {
  const cal = event.calendar ?? {};
  return parseInt(cal.domainIdentifier ?? cal.id ?? event.calendarId, 10);
}

// Alle Events des Gottesdienst-Kalenders im Zeitraum, inkl. Dienste.
async function getServiceEvents(calendarId, from, to) {
  const events = await getAllPages('/events', {
    from,
    to,
    'include[]': ['eventServices'],
  });
  return events.filter(e => eventCalendarId(e) === calendarId && !e.isCanceled);
}

async function getEvent(eventId) {
  const res = await apiGet(`/events/${eventId}`, { 'include[]': ['eventServices'] });
  return res?.data ?? res;
}

// Liefert den ersten Dienst "Prediger" eines Events (oder null).
function findPreacherService(event, serviceId) {
  const services = event.eventServices ?? [];
  const matching = services.filter(s => s.serviceId === serviceId);
  if (matching.length === 0) return null;
  // Bevorzugt einen bereits besetzten Eintrag, damit der eigentliche Prediger gefunden wird.
  return matching.find(s => s.personId || s.name) ?? matching[0];
}

// Normalisiert die Prediger-Daten eines Event-Dienstes.
function preacherFromService(es) {
  if (!es) return { name: null, personId: null, agreed: false };
  const name = (es.person?.title || es.name || '').trim() || null;
  const personId = es.personId ?? (es.person?.domainIdentifier ? parseInt(es.person.domainIdentifier, 10) : null);
  return { name, personId: name ? personId ?? null : null, agreed: Boolean(es.agreed) };
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
  preacherFromService,
  setPreacher,
  searchPersons,
};
