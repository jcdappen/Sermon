
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
      body: JSON.stringify({ success: false, error: 'Method Not Allowed. Please use POST.' })
    };
  }

  const requiredEnvVars = [
    'NETLIFY_DATABASE_URL',
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
    const { eventUid, preacherName, sermonDetails } = JSON.parse(event.body);
    
    pool = new Pool({
      connectionString: process.env.NETLIFY_DATABASE_URL
    });

    // Create a combined notes string for the local database to store all details
    // in a single field, avoiding schema change requirements.
    const combinedNotes = [
        sermonDetails.notes ? `Notizen: ${sermonDetails.notes}` : null,
        sermonDetails.family_time ? `Familytime: ${sermonDetails.family_time}` : null,
        sermonDetails.collection ? `Kollekte: ${sermonDetails.collection}` : null,
        sermonDetails.communion ? `Abendmahl: ${sermonDetails.communion}` : null
    ].filter(Boolean).join(' | ');

    // Update the local database. Responsibilities are stored in the combined sermon_notes field
    // to prevent crashes if the corresponding database columns do not exist.
    await pool.query(`
      UPDATE sermon_plans 
      SET 
        preacher_name = $1,
        theme_series = $2,
        theme_topic = $3,
        sermon_notes = $4,
        status = 'assigned',
        sync_status = 'pending',
        updated_at = NOW()
      WHERE event_uid = $5
    `, [
      preacherName,
      sermonDetails.series,
      sermonDetails.topic,
      combinedNotes,
      eventUid
    ]);

    await pool.query(`
      INSERT INTO sync_log (sync_type, status, message, events_count)
      VALUES ('assign_preacher', 'success', $1, 1)
    `, [`Prediger ${preacherName} zu Event zugewiesen (UID: ${eventUid})`]);

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
        const { eventUid } = JSON.parse(event.body || '{}');
        await pool.query(`
          INSERT INTO sync_log (sync_type, status, message, error_details)
          VALUES ('assign_preacher', 'error', $1, $2::jsonb)
        `, [`Fehler bei Zuweisung für Event ${eventUid || 'unbekannt'}: ${error.message}`, JSON.stringify({ name: error.name, stack: error.stack })]);
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
