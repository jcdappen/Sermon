// Spalten für die ChurchTools-Verknüpfung (Event, Dienst "Predigt", Person).
// Idempotent – wird von setup-database sowie vor Sync und Zuweisung ausgeführt,
// damit bestehende Datenbanken ohne manuellen Schritt aktualisiert werden.
async function ensureChurchToolsColumns(db) {
  await db.query(`
    ALTER TABLE sermon_plans
    ADD COLUMN IF NOT EXISTS ct_event_id INTEGER,
    ADD COLUMN IF NOT EXISTS ct_event_service_id INTEGER,
    ADD COLUMN IF NOT EXISTS preacher_person_id INTEGER,
    ADD COLUMN IF NOT EXISTS sync_error TEXT;
  `);
}

module.exports = { ensureChurchToolsColumns };
