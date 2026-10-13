// Überträgt den lokal gespeicherten Prediger einer sermon_plans-Zeile
// in den Dienst "Predigt" des zugehörigen ChurchTools-Events.

const ct = require('./churchtools');

const sameName = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

// Prüft, ob ChurchTools bereits den gewünschten Stand hat. Eine verborgene
// Zuweisung mit gleichem Anzeigenamen gilt als unverändert, damit die echte
// (für den Token-Benutzer unsichtbare) Person nie durch den Platzhalter ersetzt wird.
function isUnchanged(current, wanted) {
  if (!sameName(current.name, wanted.name)) return false;
  if (!wanted.name || current.concealed) return true;
  return (current.personId ?? null) === (wanted.personId ?? null) && current.agreed === wanted.agreed;
}

// currentEs: der aktuelle Event-Dienst aus ChurchTools, falls schon geladen (Sync).
async function pushPreacher(db, row, serviceId, currentEs = null) {
  if (!row.ct_event_id) {
    return { pushed: false, reason: 'Kein ChurchTools-Event verknüpft (bitte zuerst synchronisieren).' };
  }

  let es = currentEs;
  if (!es) {
    const event = await ct.getEvent(row.ct_event_id);
    es = ct.findPreacherService(event, serviceId);
  }
  if (!es) {
    throw new Error(`Event ${row.ct_event_id} hat keinen Dienst "Predigt" in ChurchTools.`);
  }
  const eventServiceId = es.id;

  const wanted = {
    name: row.preacher_name || null,
    personId: row.preacher_person_id ?? null,
    agreed: row.status === 'confirmed' || row.status === 'completed',
  };

  if (!isUnchanged(ct.preacherFromService(es), wanted)) {
    await ct.setPreacher(row.ct_event_id, eventServiceId, wanted);
  }

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
