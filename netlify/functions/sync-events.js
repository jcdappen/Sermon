const { Pool } = require('pg');
const { ChurchToolsClient } = require('../utils/churchtools-client');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };
    
  // Only allow POST requests for this action
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...headers, 'Allow': 'POST' },
      body: JSON.stringify({ error: 'Method Not Allowed. Please use POST.' })
    };
  }
    
  let pool;
  try {
    pool = new Pool({
      connectionString: process.env.NEON_DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
    });

    const ct = new ChurchToolsClient(
      process.env.CHURCHTOOLS_BASE_URL,
      process.env.CHURCHTOOLS_API_TOKEN
    );

    const year = new Date().getFullYear();
    const fromDate = `${year}-01-01`;
    const toDate = `${year}-12-31`;

    const params = new URLSearchParams({
      'calendar_ids[]': process.env.GOTTESDIENST_CALENDAR_ID,
      'from': fromDate,
      'to': toDate,
      'limit': '1000'
    });
    
    const eventsResponse = await ct.request(`/calendar/events?${params.toString()}`);
    const events = eventsResponse.data || [];

    let syncedCount = 0;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const event of events) {
            await client.query(`
                INSERT INTO sermon_plans (
                  churchtools_event_id, date, title, location, start_time, end_time, last_synced
                ) 
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT (churchtools_event_id) 
                DO UPDATE SET
                  date = EXCLUDED.date,
                  title = EXCLUDED.title,
                  location = EXCLUDED.location,
                  start_time = EXCLUDED.start_time,
                  end_time = EXCLUDED.end_time,
                  last_synced = NOW()
            `, [
                event.id,
                event.startDate.split('T')[0],
                event.caption,
                event.address || '',
                event.startDate,
                event.endDate
            ]);
            syncedCount++;
        }
        
        await client.query(`
          INSERT INTO sync_log (sync_type, status, message, events_count)
          VALUES ('pull_events', 'success', 'Events erfolgreich synchronisiert', $1)
        `, [syncedCount]);

        await client.query('COMMIT');
    } catch (dbError) {
        await client.query('ROLLBACK');
        throw dbError;
    } finally {
        client.release();
    }

    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({
        success: true,
        synced: syncedCount,
        message: `${syncedCount} Events synchronisiert`
      })
    };

  } catch (error) {
    console.error('Sync Error:', error);
    
    if (pool) {
      try {
        await pool.query(`
          INSERT INTO sync_log (sync_type, status, message, error_details)
          VALUES ('pull_events', 'error', $1, $2::jsonb)
        `, [error.message, JSON.stringify({ name: error.name, stack: error.stack })]);
      } catch (logError) {
          console.error("Failed to write error to sync_log:", logError);
      }
    }

    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({
        error: error.message,
        success: false
      })
    };
  }
};