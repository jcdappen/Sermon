
const { Pool } = require('pg');

const { CHURCHTOOLS_BASE_URL, CHURCHTOOLS_API_TOKEN, NEON_DATABASE_URL } = process.env;

// Singleton for DB Pool to reuse connections across function invocations
let pool;

function getDbPool() {
  if (!pool) {
    if (!NEON_DATABASE_URL) {
      throw new Error('NEON_DATABASE_URL environment variable is not set.');
    }
    pool = new Pool({
      connectionString: NEON_DATABASE_URL,
      // Neon requires SSL
      ssl: {
        rejectUnauthorized: false, 
      },
    });
  }
  return pool;
}

class ChurchToolsClient {
  constructor() {
    if (!CHURCHTOOLS_BASE_URL || !CHURCHTOOLS_API_TOKEN) {
      throw new Error('CHURCHTOOLS_BASE_URL and CHURCHTOOLS_API_TOKEN environment variables must be set.');
    }
    this.baseUrl = CHURCHTOOLS_BASE_URL;
    this.headers = {
      'Authorization': `Login ${CHURCHTOOLS_API_TOKEN}`,
      'Content-Type': 'application/json',
    };
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout

    try {
      const response = await fetch(url, {
        ...options,
        headers: this.headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        // Try to parse JSON for more detailed errors from CT
        try {
            const errorJson = JSON.parse(errorBody);
            throw new Error(`ChurchTools API Error: ${response.status} ${response.statusText} - ${errorJson.message || errorBody}`);
        } catch (e) {
            throw new Error(`ChurchTools API Error: ${response.status} ${response.statusText} - ${errorBody}`);
        }
      }

      // Handle cases where response might be empty
      const textBody = await response.text();
      return textBody ? JSON.parse(textBody) : {};

    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('ChurchTools API request timed out after 15 seconds.');
      }
      throw error;
    }
  }

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  post(endpoint, body) {
    return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) });
  }
}

// Standard response formatter
const createResponse = (statusCode, body) => {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    };
};

module.exports = { getDbPool, ChurchToolsClient, createResponse };
