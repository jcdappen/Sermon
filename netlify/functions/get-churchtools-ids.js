const { ChurchToolsClient } = require('../utils/churchtools-client');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };
    
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...headers, 'Allow': 'GET' },
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' })
    };
  }
    
  try {
    const ct = new ChurchToolsClient(
      process.env.CHURCHTOOLS_BASE_URL,
      process.env.CHURCHTOOLS_API_TOKEN
    );

    const calendarsResponse = await ct.request('/calendars');
    const serviceTypesResponse = await ct.request('/service/types');

    const calendars = calendarsResponse.data || [];
    const serviceTypes = serviceTypesResponse.data || [];
    
    // Attempt to find the relevant IDs based on common names
    const gottesdienstCalendar = calendars.find(c => c.name.toLowerCase().includes('gottesdienst'));
    const preacherService = serviceTypes.find(s => s.name.toLowerCase().includes('prediger') || s.name.toLowerCase().includes('pastor'));

    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({
        success: true,
        message: 'Fetched available calendars and service types.',
        data: {
          suggestions: {
            GOTTESDIENST_CALENDAR_ID: gottesdienstCalendar ? gottesdienstCalendar.id : 'Not found - please find manually.',
            PREACHER_SERVICE_TYPE_ID: preacherService ? preacherService.id : 'Not found - please find manually.',
          },
          allCalendars: calendars.map(c => ({ id: c.id, name: c.name })),
          allServiceTypes: serviceTypes.map(s => ({ id: s.id, name: s.name })),
        }
      })
    };

  } catch (error) {
    console.error('Get ChurchTools IDs Error:', error);
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({
        success: false,
        error: `Failed to fetch IDs from ChurchTools: ${error.message}`
      })
    };
  }
};