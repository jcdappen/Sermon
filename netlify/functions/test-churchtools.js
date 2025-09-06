
const { ChurchToolsClient, createResponse } = require('./utils');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return createResponse(405, { success: false, error: 'Method Not Allowed' });
  }
  
  try {
    const client = new ChurchToolsClient();
    const data = await client.get('/api/whoami');
    return createResponse(200, { 
        success: true, 
        message: `Verbindung erfolgreich hergestellt als: ${data.data.firstName} ${data.data.lastName}`,
        data 
    });
  } catch (error) {
    return createResponse(500, { success: false, error: error.message });
  }
};
