
const { getDbPool, ChurchToolsClient, createResponse } = require('./utils');

const { GOTTESDIENST_CALENDAR_ID, PREACHER_SERVICE_TYPE_ID } = process.env;

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return createResponse(405, { success: false, error: 'Method Not Allowed' });
    }

    if (!GOTTESDIENST_CALENDAR_ID || !PREACHER_SERVICE_TYPE_ID) {
        return createResponse(400, { success: false, error: 'GOTTESDIENST_CALENDAR_ID and PREACHER_SERVICE_TYPE_ID must be set as environment variables. Run "Get IDs" first.' });
    }

    const pool = getDbPool();
    const dbClient = await pool.connect();
    const ctClient = new ChurchToolsClient();

    const logSync = async (status, message, count = 0) => {
        try {
            await dbClient.query(
                'INSERT INTO sync_log (sync_type, status, message, events_count) VALUES ($1, $2, $3, $4)',
                ['churchtools_events_pull', status, message, count]
            );
        } catch (logError) {
            console.error("Failed to write to sync_log:", logError);
        }
    };

    try {
        const fromDate = new Date();
        const toDate = new Date();
        toDate.setFullYear(fromDate.getFullYear() + 1);
        const from = fromDate.toISOString().split('T')[0];
        const to = toDate.toISOString().split('T')[0];

        const eventsResponse = await ctClient.get(`/api/events?calendar_ids[]=${GOTTESDIENST_CALENDAR_ID}&from=${from}&to=${to}`);
        const events = eventsResponse.data;

        if (!events || events.length === 0) {
            await logSync('success', 'No upcoming events found in ChurchTools calendar.', 0);
            return createResponse(200, { success: true, message: 'Keine bevorstehenden Events zum Synchronisieren gefunden.', events_processed: 0 });
        }

        await dbClient.query('BEGIN');
        let upsertedCount = 0;

        for (const event of events) {
            const preacherService = event.eventServices?.find(s => s.serviceId === parseInt(PREACHER_SERVICE_TYPE_ID, 10));
            
            const preacherId = preacherService?.person?.domainIdentifier || null;
            const preacherName = preacherService?.person?.title || null;
            const themeTopic = preacherService?.comment || null;

            const query = `
                INSERT INTO sermon_plans (churchtools_event_id, date, title, start_time, end_time, preacher_id, preacher_name, theme_topic, sync_status, last_synced)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'synced', NOW())
                ON CONFLICT (churchtools_event_id) DO UPDATE SET
                    date = EXCLUDED.date,
                    title = EXCLUDED.title,
                    start_time = EXCLUDED.start_time,
                    end_time = EXCLUDED.end_time,
                    preacher_id = EXCLUDED.preacher_id,
                    preacher_name = EXCLUDED.preacher_name,
                    theme_topic = EXCLUDED.theme_topic,
                    sync_status = 'synced',
                    last_synced = NOW(),
                    updated_at = NOW()
                WHERE 
                    sermon_plans.preacher_id IS DISTINCT FROM EXCLUDED.preacher_id OR
                    sermon_plans.preacher_name IS DISTINCT FROM EXCLUDED.preacher_name OR
                    sermon_plans.theme_topic IS DISTINCT FROM EXCLUDED.theme_topic OR
                    sermon_plans.title IS DISTINCT FROM EXCLUDED.title OR
                    sermon_plans.start_time IS DISTINCT FROM EXCLUDED.start_time;
            `;

            const values = [
                event.id,
                new Date(event.startDate),
                event.name,
                event.startDate,
                event.endDate,
                preacherId,
                preacherName,
                themeTopic,
            ];

            const res = await dbClient.query(query, values);
            if (res.rowCount > 0) {
              upsertedCount++;
            }
        }

        await logSync('success', `Successfully synced ${events.length} events from ChurchTools. ${upsertedCount} were updated/inserted.`, events.length);
        await dbClient.query('COMMIT');

        return createResponse(200, { 
            success: true, 
            message: `Synchronisation erfolgreich. ${upsertedCount} von ${events.length} Events wurden neu erstellt oder aktualisiert.`,
            events_processed: events.length,
            events_upserted: upsertedCount
        });

    } catch (error) {
        await dbClient.query('ROLLBACK');
        await logSync('error', error.message);
        return createResponse(500, { success: false, error: 'Synchronisation fehlgeschlagen.', details: error.message });
    } finally {
        dbClient.release();
    }
};
