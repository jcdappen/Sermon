class ChurchToolsClient {
  constructor(baseUrl, apiToken) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiToken = apiToken;
    this.headers = {
      'Authorization': `Login ${apiToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  async request(endpoint, options = {}, retries = 3) {
    const url = `${this.baseUrl}/api${endpoint}`;

    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          headers: this.headers,
          ...options
        });

        if (!response.ok) {
          // Retry on server errors (5xx) or rate-limiting (429)
          if ((response.status >= 500 || response.status === 429) && i < retries - 1) {
            const delay = 1000 * Math.pow(2, i);
            console.warn(`ChurchTools API request to ${endpoint} failed with status ${response.status}. Retrying in ${delay}ms...`);
            await new Promise(res => setTimeout(res, delay));
            continue;
          }
          
          const errorBody = await response.text();
          console.error(`ChurchTools API Error: ${response.status} - ${response.statusText}`, errorBody);
          try {
              const parsedError = JSON.parse(errorBody);
              throw new Error(parsedError.message || `ChurchTools API Error: ${response.status}`);
          } catch(e) {
              throw new Error(`ChurchTools API Error: ${response.status} - ${errorBody}`);
          }
        }
        
        if (response.status === 204) {
            return null;
        }

        return await response.json();
      } catch (networkError) {
        if (i < retries - 1) {
          const delay = 1000 * Math.pow(2, i);
          console.warn(`ChurchTools API request to ${endpoint} failed with network error. Retrying in ${delay}ms...`, networkError);
          await new Promise(res => setTimeout(res, delay));
          continue;
        }
        console.error(`ChurchTools API request to ${endpoint} failed after ${retries} attempts.`, networkError);
        throw networkError;
      }
    }
  }
}

module.exports = { ChurchToolsClient };