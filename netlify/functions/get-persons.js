const { Pool } = require('pg');
const { ChurchToolsClient } = require('../utils/churchtools-client');

// This function needs to be customized. It checks if a person is in a specific group.
// You should create a PREACHER_GROUP_ID environment variable with the ID of your preacher group in ChurchTools.
function checkPreacherStatus(person) {
  const preacherGroupId = process.env.PREACHER_GROUP_ID;
  if (!preacherGroupId) {
    return true; // Default to true if no group is specified
  }
  // The 'groups' property must be requested via 'includes' in the API call.
  return person.groups?.some(group => group.id === parseInt(preacherGroupId, 10)) || false;
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...headers, 'Allow': 'GET' },
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' }),
    };
  }
  
  const { CHURCHTOOLS_BASE_URL, CHURCHTOOLS_API_TOKEN } = process.env;
  if (!CHURCHTOOLS_BASE_URL || !CHURCHTOOLS_API_TOKEN) {
    const errorMessage = 'ChurchTools API credentials (CHURCHTOOLS_BASE_URL, CHURCHTOOLS_API_TOKEN) are not configured in environment variables.';
    console.error(errorMessage);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: errorMessage }),
    };
  }

  try {
    const ct = new ChurchToolsClient(
      CHURCHTOOLS_BASE_URL,
      CHURCHTOOLS_API_TOKEN
    );

    const params = new URLSearchParams({
      'limit': '1000',
      'status_ids[]': '1', // Status "Mitglied"
      'includes[]': 'groups', // Include group memberships to check for preacher status
    });

    const response = await ct.request(`/persons?${params.toString()}`);
    const rawPersons = response.data || [];
    
    const persons = rawPersons.map(person => ({
      id: person.id,
      first_name: person.firstName,
      last_name: person.lastName,
      name: `${person.firstName} ${person.lastName}`.trim(),
      email: person.email,
      can_preach: checkPreacherStatus(person),
      last_updated: new Date().toISOString()
    }));

    // Optional: Update the local cache table `churchtools_persons`
    // This logic is commented out because the `churchtools_persons` table is not
    // defined in the provided database schema, and would cause a runtime error.
    /*
    let pool = new Pool({
      connectionString: process.env.NETLIFY_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const person of persons) {
            await client.query(`
                INSERT INTO churchtools_persons (id, first_name, last_name, email, can_preach, last_updated)
                VALUES ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    email = EXCLUDED.email,
                    can_preach = EXCLUDED.can_preach,
                    last_updated = NOW();
            `, [person.id, person.first_name, person.last_name, person.email, person.can_preach]);
        }
        await client.query('COMMIT');
    } catch (dbError) {
        await client.query('ROLLBACK');
        console.error("Failed to update persons cache:", dbError);
    } finally {
        client.release();
    }
    */

    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({
        success: true,
        data: persons.filter(p => p.can_preach) // Only return people who can preach to the frontend
      })
    };

  } catch (error) {
    console.error("Get Persons Error:", error);
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({
        success: false,
        error: `Failed to get persons from ChurchTools: ${error.message}`,
      })
    };
  }
};