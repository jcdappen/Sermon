const ct = require('./lib/churchtools');
const { requireSession } = require('./lib/auth');

// Personensuche in ChurchTools für die Prediger-Auswahl.
// Datenminimierung: Es werden nur ID und Anzeigename zurückgegeben.
exports.handler = async (event, context) => {
  // Nur für angemeldete Nutzer (ChurchTools-Login, siehe lib/auth.js).
  const auth = requireSession(event);
  if (auth.response) return auth.response;

  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...headers, 'Allow': 'GET' },
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' }),
    };
  }

  if (!ct.hasToken()) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: ct.TOKEN_MISSING_MESSAGE }),
    };
  }

  const query = String(event.queryStringParameters?.q ?? '').trim();
  if (query.length < 3) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data: [] }),
    };
  }

  try {
    const persons = await ct.searchPersons(query.slice(0, 100), 10);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data: persons }),
    };
  } catch (error) {
    console.error('Person search error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Personensuche in ChurchTools fehlgeschlagen.' }),
    };
  }
};
