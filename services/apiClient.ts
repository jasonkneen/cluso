export interface ApiClient {
  get(url: string, headers?: Record<string, string>): Promise<any>;
  post(url: string, body: any, headers?: Record<string, string>): Promise<any>;
  put(url: string, body: any, headers?: Record<string, string>): Promise<any>;
  delete(url: string, headers?: Record<string, string>): Promise<any>;
}

class FetchApiClient implements ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  private async request(url: string, options: RequestInit): Promise<any> {
    const fullUrl = this.baseUrl ? `${this.baseUrl}${url}` : url;
    try {
      const response = await fetch(fullUrl, options);
      if (!response.ok) {
        throw new Error(`API Request failed: ${response.status} ${response.statusText}`);
      }
      // Handle empty responses
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  }

  async get(url: string, headers: Record<string, string> = {}): Promise<any> {
    return this.request(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });
  }

  async post(url: string, body: any, headers: Record<string, string> = {}): Promise<any> {
    return this.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });
  }

  async put(url: string, body: any, headers: Record<string, string> = {}): Promise<any> {
    return this.request(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });
  }

  async delete(url: string, headers: Record<string, string> = {}): Promise<any> {
    return this.request(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });
  }
}

export const apiClient = new FetchApiClient();
