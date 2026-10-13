const ct = require('./lib/churchtools');
const { JSON_HEADERS, allowedPersonIds, createSessionCookie, getSecret } = require('./lib/auth');

// Anmeldung mit ChurchTools-Zugangsdaten. Zugelassen sind nur die Personen aus
// CT_LOGIN_PERSON_IDS (Standard: 1572). Benutzername und Passwort werden weder
// gespeichert noch protokolliert.
exports.handler = async (event) => {
  const reply = (statusCode, body, extraHeaders = {}) => ({
    statusCode,
    headers: { ...JSON_HEADERS, ...extraHeaders },
    body: JSON.stringify(body),
  });

  if (event.httpMethod !== 'POST') {
    return reply(405, { success: false, error: 'Method Not Allowed' }, { Allow: 'POST' });
  }
  if (!getSecret()) {
    return reply(500, { success: false, error: 'SESSION_SECRET ist nicht (ausreichend lang) konfiguriert.' });
  }

  let username, password, totpCode;
  try {
    ({ username, password, totpCode } = JSON.parse(event.body || '{}'));
  } catch {
    return reply(400, { success: false, error: 'Ungültige Anfrage.' });
  }
  if (!username || !password) {
    return reply(400, { success: false, error: 'Bitte Benutzername und Passwort eingeben.' });
  }

  try {
    const result = await ct.verifyLogin(String(username).trim(), String(password), totpCode);
    if (!result.ok) {
      if (result.needsTotp) {
        return reply(401, {
          success: false,
          needsTotp: true,
          error: result.error === 'totp_invalid' ? 'Der Bestätigungscode ist falsch.' : 'Bitte den Bestätigungscode (2FA) eingeben.',
        });
      }
      return reply(401, { success: false, error: 'Benutzername oder Passwort ist falsch.' });
    }
    if (!allowedPersonIds().includes(result.personId)) {
      return reply(403, { success: false, error: 'Dieses ChurchTools-Konto hat keinen Zugriff auf den Predigtplaner.' });
    }
    return reply(200, { success: true, data: { personId: result.personId } }, { 'Set-Cookie': createSessionCookie(result.personId) });
  } catch (error) {
    console.error('Login error:', error.message);
    return reply(502, { success: false, error: 'ChurchTools ist gerade nicht erreichbar.' });
  }
};
