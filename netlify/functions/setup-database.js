const { Pool } = require('pg');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...headers, 'Allow': 'POST' },
      body: JSON.stringify({ success: false, error: 'Method Not Allowed. Please use POST.' }),
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
  
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create sermon_plans table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sermon_plans (
        id SERIAL PRIMARY KEY,
        churchtools_event_id INTEGER UNIQUE NOT NULL,
        date DATE NOT NULL,
        title VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL,
        preacher_id INTEGER,
        preacher_name VARCHAR(255),
        theme_series VARCHAR(255),
        theme_topic VARCHAR(255),
        sermon_notes TEXT,
        status VARCHAR(50) DEFAULT 'planned' NOT NULL,
        sync_status VARCHAR(50) DEFAULT 'pending' NOT NULL,
        last_synced TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Create sync_log table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id SERIAL PRIMARY KEY,
        sync_type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        message TEXT,
        events_count INTEGER DEFAULT 0,
        error_details JSONB,
        synced_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query('COMMIT');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data: { message: 'Datenbank-Tabellen erfolgreich erstellt.' } }),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database setup error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: `Fehler beim Einrichten der Datenbank: ${error.message}` }),
    };
  } finally {
      client.release();
  }
};