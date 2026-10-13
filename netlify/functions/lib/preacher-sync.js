// Überträgt den lokal gespeicherten Prediger einer sermon_plans-Zeile
// in den Dienst "Prediger" des zugehörigen ChurchTools-Events.

const ct = require('./churchtools');

async function pushPreacher(db, row, serviceId) {
  if (!row.ct_event_id) {
    return { pushed: false, reason: 'Kein ChurchTools-Event verknüpft (bitte zuerst synchronisieren).' };
  }

  let eventServiceId = row.ct_event_service_id;
  if (!eventServiceId) {
    const event = await ct.getEvent(row.ct_event_id);
    const es = ct.findPreacherService(event, serviceId);
    if (!es) {
      throw new Error(`Event ${row.ct_event_id} hat keinen Dienst "Prediger" in ChurchTools.`);
    }
    eventServiceId = es.id;
  }

  await ct.setPreacher(row.ct_event_id, eventServiceId, {
    name: row.preacher_name,
    personId: row.preacher_person_id,
    agreed: row.status === 'confirmed' || row.status === 'completed',
  });

  await db.query(`
    UPDATE sermon_plans
    SET ct_event_service_id = $1, sync_status = 'synced', sync_error = NULL, last_synced = NOW()
    WHERE id = $2
  `, [eventServiceId, row.id]);

  return { pushed: true };
}

async function markSyncError(db, rowId, message) {
  await db.query(`
    UPDATE sermon_plans SET sync_status = 'error', sync_error = $1 WHERE id = $2
  `, [message.slice(0, 1000), rowId]);
}

module.exports = { pushPreacher, markSyncError };
