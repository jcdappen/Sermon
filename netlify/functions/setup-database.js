

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

    // Create sermon_plans table - this is the target schema.
    // If the table exists, this command does nothing, but older versions might be missing columns.
    await client.query(`
      CREATE TABLE IF NOT EXISTS sermon_plans (
        id SERIAL PRIMARY KEY,
        event_uid VARCHAR(255) UNIQUE NOT NULL,
        date DATE NOT NULL,
        title VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL,
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
    
    // ** Migration Steps **
    // Add preacher_category column if it doesn't exist
    await client.query(`
      ALTER TABLE sermon_plans
      ADD COLUMN IF NOT EXISTS preacher_category VARCHAR(50);
    `);
    
    // Add preacher_id column if it doesn't exist
    await client.query(`
      ALTER TABLE sermon_plans
      ADD COLUMN IF NOT EXISTS preacher_id INTEGER;
    `);


    // Check if the 'event_uid' column exists. If not, this is an older schema.
    const columnCheck = await client.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'sermon_plans' AND column_name = 'event_uid'
    `);

    if (columnCheck.rowCount === 0) {
      console.log("Schema migration needed: 'event_uid' column is missing.");
      // Add the column. It will be nullable for now.
      await client.query(`ALTER TABLE sermon_plans ADD COLUMN event_uid VARCHAR(255);`);
      
      // Add a unique index. This is critical for the `ON CONFLICT` statement in sync-events.js.
      // This will succeed because the new column is all NULLs.
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS sermon_plans_event_uid_idx ON sermon_plans (event_uid);`);
      console.log("Successfully added 'event_uid' column and unique index to 'sermon_plans'.");
    }

    await client.query('COMMIT');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data: { message: 'Datenbank-Tabellen erfolgreich erstellt oder aktualisiert.' } }),
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
