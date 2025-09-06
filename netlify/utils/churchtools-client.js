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

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}/api${endpoint}`;
    
    const response = await fetch(url, {
      headers: this.headers,
      ...options
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`ChurchTools API Error: ${response.status} - ${response.statusText}`, errorBody);
        throw new Error(`ChurchTools API Error: ${response.status} - ${response.statusText}`);
    }
    
    // Handle cases like PUT requests that return no content on success
    if (response.status === 204) {
        return null;
    }

    return await response.json();
  }
}

module.exports = { ChurchToolsClient };
