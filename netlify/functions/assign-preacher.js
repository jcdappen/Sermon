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
      body: JSON.stringify({ error: 'Method Not Allowed. Please use POST.' })
    };
  }

  let pool;
  try {
    const { eventId, preacherId, preacherName, sermonDetails } = JSON.parse(event.body);
    
    pool = new Pool({
      connectionString: process.env.NEON_DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });

    const ct = new ChurchToolsClient(
      process.env.CHURCHTOOLS_BASE_URL,
      process.env.CHURCHTOOLS_API_TOKEN
    );

    // 1. Assign service in ChurchTools
    // Note: The CT API uses 'service_id' for the service type when assigning.
    await ct.request(`/calendar/events/${eventId}/signup`, {
      method: 'POST',
      body: JSON.stringify({
        person_id: preacherId,
        service_id: process.env.PREACHER_SERVICE_TYPE_ID,
        agree: true, // This confirms the assignment
      })
    });

    // 2. Update event description in ChurchTools with sermon details
    if (sermonDetails.topic || sermonDetails.series) {
        const sermonInfo = `\n\n--- Predigt-Details ---\nPredigt: ${sermonDetails.topic || 'Thema folgt'}\nSerie: ${sermonDetails.series || 'Einzelpredigt'}\n${sermonDetails.notes ? `Notizen: ${sermonDetails.notes}` : ''}`.trim();
        
        const existingEvent = await ct.request(`/calendar/events/${eventId}`);
        let currentDescription = existingEvent.data?.description || '';

        // Simple strategy: remove old details block and append new one.
        currentDescription = currentDescription.split('\n\n--- Predigt-Details ---')[0].trim();
        const newDescription = currentDescription + sermonInfo;

        await ct.request(`/calendar/events/${eventId}`, {
            method: 'PUT',
            body: JSON.stringify({
            description: newDescription
            })
        });
    }

    // 3. Update the local database
    await pool.query(`
      UPDATE sermon_plans 
      SET 
        preacher_id = $1,
        preacher_name = $2,
        theme_series = $3,
        theme_topic = $4,
        sermon_notes = $5,
        family_time_responsible = $6,
        collection_responsible = $7,
        communion_responsible = $8,
        status = 'assigned',
        sync_status = 'synced',
        updated_at = NOW()
      WHERE churchtools_event_id = $9
    `, [
      preacherId,
      preacherName,
      sermonDetails.series,
      sermonDetails.topic,
      sermonDetails.notes,
      sermonDetails.family_time,
      sermonDetails.collection,
      sermonDetails.communion,
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
        message: 'Prediger erfolgreich zugewiesen'
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
        error: error.message,
        success: false
      })
    };
  }
};