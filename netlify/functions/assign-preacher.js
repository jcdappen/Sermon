const { Pool } = require('pg');
const ct = require('./lib/churchtools');
const { pushPreacher, markSyncError } = require('./lib/preacher-sync');

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
        preacherPersonId,
        series,
        topic,
        notes,
        family_time,
        collection,
        communion,
        status,
        preacherCategory
    } = sermonDetails;

    const cleanName = (preacherName || '').trim() || null;
    const personId = cleanName && Number.isInteger(preacherPersonId) ? preacherPersonId : null;

    pool = new Pool({
      connectionString: process.env.NETLIFY_DATABASE_URL
    });

    // Update the local database with dedicated columns.
    const { rows } = await pool.query(`
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
        preacher_person_id = $10,
        sync_status = 'pending',
        updated_at = NOW()
      WHERE event_uid = $11
      RETURNING *
    `, [
      cleanName,
      series || null,
      topic || null,
      notes || null,
      cleanName ? status : 'planned',
      preacherCategory || null,
      family_time || null,
      collection || null,
      communion || null,
      personId,
      eventUid
    ]);

    if (rows.length === 0) {
      throw new Error(`Event ${eventUid} nicht gefunden.`);
    }

    // Prediger direkt in den ChurchTools-Dienst übertragen.
    let ctMessage = '';
    let logStatus = 'success';
    if (!process.env.CHURCHTOOLS_TOKEN) {
      ctMessage = ' (ChurchTools nicht konfiguriert, nur lokal gespeichert)';
      logStatus = 'warning';
    } else {
      try {
        const { serviceId } = await ct.resolveIds();
        const result = await pushPreacher(pool, rows[0], serviceId);
        if (!result.pushed) {
          ctMessage = ` (nicht übertragen: ${result.reason})`;
          logStatus = 'warning';
        } else {
          ctMessage = ' und an ChurchTools übertragen';
        }
      } catch (ctError) {
        console.error('ChurchTools push error:', ctError);
        await markSyncError(pool, rows[0].id, ctError.message);
        ctMessage = ` (ChurchTools-Fehler: ${ctError.message})`;
        logStatus = 'error';
      }
    }

    // Bewusst ohne Personennamen im Protokoll (Datenminimierung).
    await pool.query(`
      INSERT INTO sync_log (sync_type, status, message, events_count)
      VALUES ('assign_preacher', $1, $2, 1)
    `, [logStatus, `Predigtplan für Event ${eventUid} gespeichert${ctMessage}`]);

    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({
        success: true,
        data: { message: `Prediger gespeichert${ctMessage}`, ctSynced: logStatus === 'success' }
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
  } finally {
    if (pool) await pool.end().catch(() => {});
  }
};
