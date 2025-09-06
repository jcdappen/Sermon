
const { getDbPool, createResponse } = require('./utils');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'GET') {
        return createResponse(405, { success: false, error: 'Method Not Allowed' });
    }
    
    const pool = getDbPool();
    const client = await pool.connect();

    try {
        const result = await client.query('SELECT * FROM sermon_plans ORDER BY date ASC');
        return createResponse(200, { success: true, data: result.rows });
    } catch (error) {
        return createResponse(500, { success: false, error: 'Konnte Events nicht aus der Datenbank laden.', details: error.message });
    } finally {
        client.release();
    }
};
