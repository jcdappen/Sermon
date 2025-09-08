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

    // Update the local database with dedicated columns.
    await pool.query(`
      UPDATE sermon_plans 
      SET 
        preacher_name = $1,
        theme_series = $2,
        theme_topic = $3,
        sermon_notes = $4,
        status = $5,
        preacher_category = $6,
        family_time_topic = $7,
        collection_purpose = $8,
        communion_responsible = $9,
        sync_status = 'pending',
        updated_at = NOW()
      WHERE event_uid = $10
    `, [
      preacherName || null,
      series || null,
      topic || null,
      notes || null,
      status,
      preacherCategory || null,
      family_time || null,
      collection || null,
      communion || null,
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
