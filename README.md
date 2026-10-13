<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1tD2dBWz1LSWlvVWiO5mQrypqKHaYNfSa

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## ChurchTools-Sync (Gottesdienst ⇄ Dienst „Prediger“)

Der Predigtplaner lädt die Gottesdienste direkt über die ChurchTools-API (gleiches Muster wie im Gruppenmodul) und gleicht den Dienst **„Prediger“** in beide Richtungen ab.

### Umgebungsvariablen (Netlify → Site configuration → Environment variables)

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `NETLIFY_DATABASE_URL` | ja | Postgres-Verbindung (wie bisher) |
| `CHURCHTOOLS_API_TOKEN` | ja | Login-Token eines ChurchTools-Benutzers (Header `Authorization: Login …`). Alternativ wird `CHURCHTOOLS_TOKEN` akzeptiert. |
| `CT_BASE_URL` | nein | Standard: `https://gemeindekonkordia.church.tools` |
| `CT_CALENDAR_ID` / `CT_CALENDAR_NAME` | nein | Kalender der Gottesdienste; Standard: Suche nach Name „Gottesdienst“ |
| `CT_PREACHER_SERVICE_ID` / `CT_PREACHER_SERVICE_NAME` | nein | Dienst des Predigers; Standard: Suche nach Name „Prediger“ |
| `CT_SYNC_MONTHS` | nein | Wie viele Monate im Voraus synchronisiert werden (Standard: 12, plus 30 Tage rückwirkend) |
| `CT_SERVICE_WRITE_MODE` | nein | `auto` (Standard: REST, bei 404/405 Legacy-AJAX `updateEventService`), `rest` oder `ajax` |

`ICAL_URL` wird nicht mehr benötigt.

Der Token-Benutzer braucht in ChurchTools Rechte zum Sehen des Gottesdienst-Kalenders/der Events, zum Bearbeiten der Dienste („Prediger“) und zur Personensuche.

### Ablauf

1. Nach dem Deploy einmal **„Datenbank jetzt einrichten“** ausführen (legt die neuen Spalten `ct_event_id`, `ct_event_service_id`, `preacher_person_id`, `sync_error` an).
2. **„Events synchronisieren“**:
   - Events des Gottesdienst-Kalenders werden geladen (`event_uid = ct-<EventID>`).
   - Bisherige iCal-Einträge mit gleicher Startzeit werden übernommen – Serie, Thema, Kollekte, Familytime, Abendmahl und Notizen bleiben erhalten.
   - Lokal geänderte, noch nicht übertragene Einträge (`pending`/`error`) werden nach ChurchTools geschrieben, sonst ist ChurchTools für den Prediger führend.
   - Status: in CT zugesagt → „Bestätigt“, eingetragen aber nicht zugesagt → „Angefragt“.
3. **Prediger zuweisen** schreibt sofort in den Dienst „Prediger“ des Events. Auswahl aus der ChurchTools-Personensuche verknüpft die Person; freier Text wird als Name (Gast) eingetragen.
4. Fehler (z. B. Event ohne Dienst „Prediger“) werden in der Planansicht als „Nicht in ChurchTools“ markiert und im Sync-Protokoll vermerkt.

### Datenschutz (DSGVO)

- Der ChurchTools-Token liegt nur serverseitig in Netlify und wird nie an den Browser übertragen.
- Die Personensuche (`search-persons`) liefert ausschließlich ID und Anzeigenamen (max. 10 Treffer, ab 3 Zeichen) – keine Kontaktdaten oder Bilder. Gespeichert werden nur Name und Personen-ID des zugewiesenen Predigers.
- Das Sync-Protokoll enthält keine Personennamen.
- **Wichtig:** Netlify Functions sind öffentlich aufrufbar. Da nun Personendaten aus ChurchTools abrufbar sind, sollte die Seite zugangsgeschützt sein (z. B. Netlify Password Protection oder Netlify Identity).
