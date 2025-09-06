const { Pool } = require('pg');
const { ChurchToolsClient } = require('../utils/churchtools-client');

function parseSermonDetailsFromComment(comment) {
  const details = { series: null, topic: null, notes: null };
  if (!comment) return details;
  
  const parts = comment.split('|').map(p => p.trim());
  for (const part of parts) {
    if (part.toLowerCase().startsWith('serie:')) {
      details.series = part.substring('serie:'.length).trim();
    } else if (part.toLowerCase().startsWith('thema:')) {
      details.topic = part.substring('thema:'.length).trim();
    } else if (part.toLowerCase().startsWith('notizen:')) {
      details.notes = part.substring('notizen:'.length).trim();
    }
  }
  return details;
}

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
    'CHURCHTOOLS_BASE_URL',
    'CHURCHTOOLS_API_TOKEN',
    'GOTTESDIENST_CALENDAR_ID',
    'PREACHER_SERVICE_TYPE_ID'
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

    const ct = new ChurchToolsClient(
      process.env.CHURCHTOOLS_BASE_URL,
      process.env.CHURCHTOOLS_API_TOKEN
    );

    const year = new Date().getFullYear();
    const fromDate = `${year}-01-01`;
    const toDate = `${year}-12-31`;

    const params = new URLSearchParams({
      'calendar_ids[]': process.env.GOTTESDIENST_CALENDAR_ID,
      from: fromDate,
      to: toDate,
      limit: '1000',
      'includes[]': 'eventServices' // Request service information
    });
    
    const eventsResponse = await ct.request(`/events?${params.toString()}`);
    const events = eventsResponse.data || [];

    let syncedCount = 0;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const event of events) {
            const preacherService = event.eventServices?.find(s => s.serviceId === parseInt(process.env.PREACHER_SERVICE_TYPE_ID, 10));
            
            let preacherId = null;
            let preacherName = null;
            let sermonDetails = { series: null, topic: null, notes: null };
            let status = 'planned';

            if (preacherService && preacherService.person) {
                preacherId = preacherService.person.id;
                preacherName = preacherService.person.title;
                status = preacherService.agreed ? 'confirmed' : 'assigned';
                if(preacherService.comment) {
                    sermonDetails = parseSermonDetailsFromComment(preacherService.comment);
                }
            }
            
            const location = event.calendar?.name || event.address || '';
            const title = event.name || event.caption || 'Unbenannter Gottesdienst';

            await client.query(`
                INSERT INTO sermon_plans (
                  churchtools_event_id, date, title, location, start_time, end_time, 
                  preacher_id, preacher_name, theme_series, theme_topic, sermon_notes, status,
                  last_synced
                ) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
                ON CONFLICT (churchtools_event_id) 
                DO UPDATE SET
                  date = EXCLUDED.date,
                  title = EXcluded.title,
                  location = EXCLUDED.location,
                  start_time = EXCLUDED.start_time,
                  end_time = EXCLUDED.end_time,
                  preacher_id = EXCLUDED.preacher_id,
                  preacher_name = EXCLUDED.preacher_name,
                  theme_series = EXCLUDED.theme_series,
                  theme_topic = EXCLUDED.theme_topic,
                  sermon_notes = EXCLUDED.sermon_notes,
                  status = EXCLUDED.status,
                  last_synced = NOW()
            `, [
                event.id,
                event.startDate.split('T')[0],
                title,
                location,
                event.startDate,
                event.endDate,
                preacherId,
                preacherName,
                sermonDetails.series,
                sermonDetails.topic,
                sermonDetails.notes,
                status
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
        data: {
            synced: syncedCount,
            message: `${syncedCount} Events synchronisiert`
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