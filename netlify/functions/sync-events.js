const { Pool } = require('pg');
const ct = require('./lib/churchtools');
const { pushPreacher, markSyncError } = require('./lib/preacher-sync');
const { ensureChurchToolsColumns } = require('./lib/schema');

// YYYY-MM-DD in deutscher Zeitzone (vermeidet Datumsverschiebung durch UTC).
const toBerlinDate = (date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(date);

const statusFromPreacher = ({ name, agreed }, currentStatus) => {
  if (!name) return 'planned';
  if (currentStatus === 'completed') return 'completed';
  return agreed ? 'confirmed' : 'assigned';
};

// Synchronisiert ein einzelnes ChurchTools-Event mit der Datenbank.
// Rückgabe: { status: 'pulled' | 'pushed' | 'error', error?: string }
async function syncEvent(db, event, serviceId) {
  const eventUid = `ct-${event.id}`;
  const start = new Date(event.startDate);
  const end = new Date(event.endDate || event.startDate);
  const title = event.name || 'Unbenannter Gottesdienst';
  const es = ct.findPreacherService(event, serviceId);
  const ctPreacher = ct.preacherFromService(es);
  const noServiceError = `Kein Dienst "Predigt" (ID ${serviceId}) im ChurchTools-Event. Vorhandene Dienst-IDs: ${ct.listServiceIds(event)}`;

  // Bestehende (iCal-)Zeile zum gleichen Termin übernehmen, damit lokale
  // Angaben wie Serie, Thema, Kollekte oder Notizen erhalten bleiben.
  let { rows } = await db.query('SELECT * FROM sermon_plans WHERE event_uid = $1', [eventUid]);
  if (rows.length === 0) {
    ({ rows } = await db.query(`
      UPDATE sermon_plans SET event_uid = $1
      WHERE id = (
        SELECT id FROM sermon_plans
        WHERE event_uid NOT LIKE 'ct-%' AND start_time = $2
        ORDER BY id LIMIT 1
      )
      RETURNING *
    `, [eventUid, start.toISOString()]));
  }

  if (rows.length === 0) {
    await db.query(`
      INSERT INTO sermon_plans (
        event_uid, date, title, location, start_time, end_time,
        ct_event_id, ct_event_service_id,
        preacher_name, preacher_person_id, status,
        sync_status, sync_error, last_synced
      )
      VALUES ($1, $2, $3, '', $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
    `, [
      eventUid, toBerlinDate(start), title, start.toISOString(), end.toISOString(),
      event.id, es?.id ?? null,
      ctPreacher.name, ctPreacher.personId, statusFromPreacher(ctPreacher),
      es ? 'synced' : 'error',
      es ? null : noServiceError,
    ]);
    return es ? { status: 'pulled' } : { status: 'error', error: noServiceError };
  }

  const row = rows[0];

  // Termindaten kommen immer aus ChurchTools.
  await db.query(`
    UPDATE sermon_plans
    SET date = $1, title = $2, start_time = $3, end_time = $4,
        ct_event_id = $5, ct_event_service_id = $6
    WHERE id = $7
  `, [toBerlinDate(start), title, start.toISOString(), end.toISOString(), event.id, es?.id ?? null, row.id]);

  if (!es) {
    await markSyncError(db, row.id, noServiceError);
    return { status: 'error', error: noServiceError };
  }

  // Lokale, noch nicht übertragene Änderung → nach ChurchTools schreiben.
  // Beim ersten Abgleich einer übernommenen (iCal-)Zeile gilt ein lokal
  // eingetragener Prediger ebenfalls als ausstehend, solange CT leer ist.
  const firstLinkWithLocalPreacher = !row.ct_event_id && row.preacher_name && !ctPreacher.name;
  if (row.sync_status === 'pending' || row.sync_status === 'error' || firstLinkWithLocalPreacher) {
    try {
      await pushPreacher(db, { ...row, ct_event_id: event.id, ct_event_service_id: es.id }, serviceId, es);
      return { status: 'pushed' };
    } catch (err) {
      await markSyncError(db, row.id, err.message);
      return { status: 'error', error: `Übertragung nach ChurchTools: ${err.message}` };
    }
  }

  // Sonst ist ChurchTools führend für den Prediger.
  const preacherChanged = (row.preacher_name || null) !== ctPreacher.name;
  await db.query(`
    UPDATE sermon_plans
    SET preacher_name = $1,
        preacher_person_id = $2,
        status = $3,
        preacher_category = CASE WHEN $6 THEN NULL ELSE preacher_category END,
        sync_status = 'synced',
        sync_error = NULL,
        last_synced = NOW(),
        updated_at = CASE WHEN $4 THEN NOW() ELSE updated_at END
    WHERE id = $5
  `, [ctPreacher.name, ctPreacher.personId, statusFromPreacher(ctPreacher, row.status), preacherChanged, row.id, !ctPreacher.name]);
  return { status: 'pulled' };
}

// Häufigste Fehlergründe (max. 3, gekürzt) für Protokoll und Hinweis im Frontend.
function summarizeFailures(failures) {
  const byMessage = new Map();
  for (const { error } of failures) {
    const key = String(error).slice(0, 300);
    byMessage.set(key, (byMessage.get(key) || 0) + 1);
  }
  return [...byMessage.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([msg, n]) => `${msg} (${n}×)`)
    .join(' | ');
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
  ];
  const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
  if (!ct.hasToken()) missingEnvVars.push('CHURCHTOOLS_API_TOKEN');
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

    await ensureChurchToolsColumns(pool);

    const { calendarId, serviceId } = await ct.resolveIds();

    const months = parseInt(process.env.CT_SYNC_MONTHS, 10) || 12;
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const to = new Date();
    to.setMonth(to.getMonth() + months);

    const events = await ct.getServiceEvents(calendarId, toBerlinDate(from), toBerlinDate(to));

    const counts = { pulled: 0, pushed: 0, error: 0 };
    const failures = [];
    for (const ctEvent of events) {
      try {
        const result = await syncEvent(pool, ctEvent, serviceId);
        counts[result.status]++;
        if (result.error) failures.push({ eventId: ctEvent.id, error: result.error });
      } catch (err) {
        console.error(`Sync-Fehler bei Event ${ctEvent.id}:`, err);
        counts.error++;
        failures.push({ eventId: ctEvent.id, error: err.message });
      }
    }

    const synced = counts.pulled + counts.pushed;
    let message = `${synced} Gottesdienste mit ChurchTools synchronisiert (${counts.pushed} Prediger nach ChurchTools übertragen)` +
      (counts.error ? `, ${counts.error} mit Fehler` : '');
    if (failures.length) {
      message += `: ${summarizeFailures(failures)}`;
    }

    await pool.query(`
      INSERT INTO sync_log (sync_type, status, message, events_count, error_details)
      VALUES ('pull_events', $1, $2, $3, $4::jsonb)
    `, [
      counts.error ? 'warning' : 'success',
      message,
      synced,
      failures.length ? JSON.stringify({ failures: failures.slice(0, 20) }) : null,
    ]);

    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({
        success: true,
        data: {
            message,
            synced,
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
  } finally {
    if (pool) await pool.end().catch(() => {});
  }
};

exports.syncEvent = syncEvent;
