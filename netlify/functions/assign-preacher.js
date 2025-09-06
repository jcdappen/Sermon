const { Pool } = require('pg');
const { ChurchToolsClient } = require('../utils/churchtools-client');

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
    const { eventId, preacherId, preacherName, sermonDetails } = JSON.parse(event.body);
    
    pool = new Pool({
      connectionString: process.env.NETLIFY_DATABASE_URL
    });

    const ct = new ChurchToolsClient(
      process.env.CHURCHTOOLS_BASE_URL,
      process.env.CHURCHTOOLS_API_TOKEN
    );

    // 1. Format sermon details for the ChurchTools service comment field
    const sermonComment = [
        sermonDetails.series ? `Serie: ${sermonDetails.series}` : null,
        sermonDetails.topic ? `Thema: ${sermonDetails.topic}` : null,
        sermonDetails.notes ? `Notizen: ${sermonDetails.notes}` : null
    ].filter(Boolean).join(' | ');

    // 2. To assign a preacher, we POST to the event's services endpoint.
    await ct.request(`/events/${eventId}/services`, {
      method: 'POST',
      body: JSON.stringify({
        personId: preacherId,
        serviceId: parseInt(process.env.PREACHER_SERVICE_TYPE_ID, 10),
        comment: sermonComment,
        agreed: true,
      }),
    });

    // 3. Create a combined notes string for the local database to store all details
    // in a single field, avoiding schema change requirements.
    const combinedNotes = [
        sermonDetails.notes ? `Notizen: ${sermonDetails.notes}` : null,
        sermonDetails.family_time ? `Familytime: ${sermonDetails.family_time}` : null,
        sermonDetails.collection ? `Kollekte: ${sermonDetails.collection}` : null,
        sermonDetails.communion ? `Abendmahl: ${sermonDetails.communion}` : null
    ].filter(Boolean).join(' | ');

    // 4. Update the local database. Responsibilities are stored in the combined sermon_notes field
    // to prevent crashes if the corresponding database columns do not exist.
    await pool.query(`
      UPDATE sermon_plans 
      SET 
        preacher_id = $1,
        preacher_name = $2,
        theme_series = $3,
        theme_topic = $4,
        sermon_notes = $5,
        status = 'assigned',
        sync_status = 'synced',
        updated_at = NOW()
      WHERE churchtools_event_id = $6
    `, [
      preacherId,
      preacherName,
      sermonDetails.series,
      sermonDetails.topic,
      combinedNotes,
      eventId
    ]);

    await pool.query(`
      INSERT INTO sync_log (sync_type, status, message, events_count)
      VALUES ('assign_preacher', 'success', $1, 1)
    `, [`Prediger ${preacherName} zu Event ${eventId} zugewiesen`]);

    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({
        success: true,
        data: { message: 'Prediger erfolgreich zugewiesen' }
      })
    };

  } catch (error) {
    console.error('Assignment Error:', error);
    if(pool) {
      try {
        const { eventId } = JSON.parse(event.body || '{}');
        await pool.query(`
          INSERT INTO sync_log (sync_type, status, message, error_details)
          VALUES ('assign_preacher', 'error', $1, $2::jsonb)
        `, [`Fehler bei Zuweisung für Event ${eventId || 'unbekannt'}: ${error.message}`, JSON.stringify({ name: error.name, stack: error.stack })]);
      } catch (logError) {
        console.error("Failed to write error to sync_log:", logError);
      }
    }
    
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({
        success: false,
        error: `Failed to assign preacher: ${error.message}`,
      })
    };
  }
};