const { JSON_HEADERS, clearSessionCookie } = require('./lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { ...JSON_HEADERS, Allow: 'POST' }, body: JSON.stringify({ success: false, error: 'Method Not Allowed' }) };
  }
  return {
    statusCode: 200,
    headers: { ...JSON_HEADERS, 'Set-Cookie': clearSessionCookie() },
    body: JSON.stringify({ success: true, data: { loggedOut: true } }),
  };
};
