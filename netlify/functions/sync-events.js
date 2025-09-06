const { Pool } = require('pg');
const ical = require('node-ical');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };
    
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...headers, 'Allow': 'POST' },
      body: JSON.stringify({ success: false, error: 'Method Not Allowed. Please use POST.' })
    };
  }

  const requiredEnvVars = [
    'NETLIFY_DATABASE_URL',
    'ICAL_URL'
  ];
  const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
  if (missingEnvVars.length > 0) {
      const msg = `Missing required environment variables: ${missingEnvVars.join(', ')}`;
      console.error(msg);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: msg }),
      };
  }
    
  let pool;
  try {
    pool = new Pool({
      connectionString: process.env.NETLIFY_DATABASE_URL,
    });
    
    const events = await ical.async.fromURL(process.env.ICAL_URL);
    
    let syncedCount = 0;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const event of Object.values(events)) {
            if (event.type !== 'VEVENT') {
                continue;
            }

            const event_uid = event.uid;
            const title = event.summary || 'Unbenannter Gottesdienst';
            const location = event.location || '';
            const startDate = event.start;
            const endDate = event.end;

            if (!event_uid || !startDate || !endDate) {
                console.warn('Skipping event with missing uid, start, or end date:', event);
                continue;
            }

            await client.query(`
                INSERT INTO sermon_plans (
                  event_uid, date, title, location, start_time, end_time,
                  status, sync_status, last_synced
                ) 
                VALUES ($1, $2, $3, $4, $5, $6, 'planned', 'synced', NOW())
                ON CONFLICT (event_uid) 
                DO UPDATE SET
                  date = EXCLUDED.date,
                  title = EXCLUDED.title,
                  location = EXCLUDED.location,
                  start_time = EXCLUDED.start_time,
                  end_time = EXCLUDED.end_time,
                  sync_status = 'synced',
                  last_synced = NOW()
            `, [
                event_uid,
                startDate.toISOString().split('T')[0],
                title,
                location,
                startDate.toISOString(),
                endDate.toISOString()
            ]);
            syncedCount++;
        }
        
        await client.query(`
          INSERT INTO sync_log (sync_type, status, message, events_count)
          VALUES ('pull_events', 'success', 'Events erfolgreich aus iCal-Feed synchronisiert', $1)
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
        data: {
            message: `${syncedCount} Events synchronisiert`,
            synced: syncedCount,
        }
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
        success: false,
        error: `Event synchronization failed: ${error.message}`
      })
    };
  }
};