const ct = require('./lib/churchtools');

// Personensuche in ChurchTools für die Prediger-Auswahl.
// Datenminimierung: Es werden nur ID und Anzeigename zurückgegeben.
exports.handler = async (event, context) => {
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

  if (!process.env.CHURCHTOOLS_TOKEN) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Missing required environment variables: CHURCHTOOLS_TOKEN' }),
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
