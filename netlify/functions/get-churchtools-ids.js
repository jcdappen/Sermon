
const { ChurchToolsClient, createResponse } = require('./utils');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return createResponse(405, { success: false, error: 'Method Not Allowed' });
    }

    try {
        const client = new ChurchToolsClient();
        let messages = [];

        // 1. Find Calendar ID for "Gottesdienst"
        const calendarsResponse = await client.get('/api/calendars');
        const calendar = calendarsResponse.data.find(c => c.name.toLowerCase().includes('gottesdienst'));
        if (!calendar) {
            throw new Error('Konnte keinen Kalender mit "Gottesdienst" im Namen finden.');
        }
        const calendarId = calendar.id;
        messages.push(`Gottesdienst-Kalender gefunden: "${calendar.name}" (ID: ${calendarId})`);

        // 2. Find Service Type ID for "Prediger"
        const serviceTypesResponse = await client.get('/api/service/types');
        // Search for "prediger", "pastor" as fallbacks
        const preacherKeywords = ['prediger', 'pastor'];
        let preacherService = null;
        for (const keyword of preacherKeywords) {
            preacherService = serviceTypesResponse.data.find(s => s.name.toLowerCase().includes(keyword));
            if (preacherService) break;
        }
        
        if (!preacherService) {
            throw new Error('Konnte keinen Dienst-Typ für "Prediger" oder "Pastor" finden.');
        }
        const preacherServiceTypeId = preacherService.id;
        messages.push(`Prediger-Dienst gefunden: "${preacherService.name}" (ID: ${preacherServiceTypeId})`);
        
        const data = {
            GOTTESDIENST_CALENDAR_ID: calendarId,
            PREACHER_SERVICE_TYPE_ID: preacherServiceTypeId,
        };

        return createResponse(200, {
            success: true,
            message: 'Alle IDs erfolgreich ermittelt. Bitte als Environment Variables setzen.',
            data,
            details: messages
        });
    } catch (error) {
        return createResponse(500, { success: false, error: error.message });
    }
};
