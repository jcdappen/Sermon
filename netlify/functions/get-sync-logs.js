const { Pool } = require('pg');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...headers, 'Allow': 'GET' },
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    const result = await pool.query('SELECT * FROM sync_log ORDER BY synced_at DESC LIMIT 100');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result.rows),
    };
  } catch (error) {
    console.error('Error fetching sync logs:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch sync logs' }),
    };
  }
};