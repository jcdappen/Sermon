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
    if (!process.env.CHURCHTOOLS_BASE_URL || !process.env.CHURCHTOOLS_API_TOKEN) {
      throw new Error('ChurchTools base URL or API token is not configured in environment variables.');
    }
      
    const ct = new ChurchToolsClient(
      process.env.CHURCHTOOLS_BASE_URL,
      process.env.CHURCHTOOLS_API_TOKEN
    );

    const whoami = await ct.request('/whoami');
    
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({
        success: true,
        message: 'Successfully connected to ChurchTools API.',
        data: whoami,
      })
    };

  } catch (error) {
    console.error('ChurchTools Connection Test Error:', error);
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({
        success: false,
        error: `Failed to connect to ChurchTools API: ${error.message}`
      })
    };
  }
};