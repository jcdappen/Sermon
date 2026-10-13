const { JSON_HEADERS, getSession } = require('./lib/auth');

// Gibt zurück, ob eine gültige Sitzung besteht (für den Start der Oberfläche).
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: { ...JSON_HEADERS, Allow: 'GET' }, body: JSON.stringify({ success: false, error: 'Method Not Allowed' }) };
  }
  const session = getSession(event);
  return {
    statusCode: 200,
    headers: JSON_HEADERS,
    body: JSON.stringify({ success: true, data: { loggedIn: Boolean(session) } }),
  };
};
