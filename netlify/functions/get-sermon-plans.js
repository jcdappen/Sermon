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
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' }),
    };
  }

  if (!process.env.NETLIFY_DATABASE_URL) {
    const msg = 'Database connection string (NETLIFY_DATABASE_URL) is not configured in environment variables.';
    console.error(msg);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: msg }),
    };
  }

  const pool = new Pool({
    connectionString: process.env.NETLIFY_DATABASE_URL,
  });

  try {
    const result = await pool.query('SELECT * FROM sermon_plans ORDER BY date ASC');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data: result.rows }),
    };
  } catch (error) {
    console.error('Error fetching sermon plans:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: `Failed to fetch sermon plans: ${error.message}` }),
    };
  }
};