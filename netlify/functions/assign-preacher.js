

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
    const { eventUid, sermonDetails } = JSON.parse(event.body);
    const { 
        preacherId,
        preacherName,
        series,
        topic,
        notes,
        family_time,
        collection,
        communion,
        status,
        preacherCategory 
    } = sermonDetails;

    pool = new Pool({
      connectionString: process.env.NETLIFY_DATABASE_URL
    });

    // Create a combined notes string for the local database to store all details
    // in a single field, avoiding schema change requirements.
    const combinedNotes = [
        notes ? `Notizen: ${notes}` : null,
        family_time ? `Familytime: ${family_time}` : null,
        collection ? `Kollekte: ${collection}` : null,
        communion ? `Abendmahl: ${communion}` : null
    ].filter(Boolean).join(' | ');

    // Update the local database.
    await pool.query(`
      UPDATE sermon_plans 
      SET 
        preacher_id = $1,
        preacher_name = $2,
        theme_series = $3,
        theme_topic = $4,
        sermon_notes = $5,
        status = $6,
        preacher_category = $7,
        sync_status = 'pending',
        updated_at = NOW()
      WHERE event_uid = $8
    `, [
      preacherId,
      preacherName,
      series,
      topic,
      combinedNotes,
      status,
      preacherCategory,
      eventUid
    ]);

    await pool.query(`
      INSERT INTO sync_log (sync_type, status, message, events_count)
      VALUES ('assign_preacher', 'success', $1, 1)
    `, [`Prediger ${preacherName || 'N/A'} zu Event zugewiesen (UID: ${eventUid})`]);

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
