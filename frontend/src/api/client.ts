// API configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Helper function to build query string
export function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

// API Response type
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  success: boolean;
}

// HTTP Methods
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

// Request options
export interface RequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string | number | boolean | undefined>;
  includeClientId?: boolean; // Whether to automatically include clientId
}

// API client class
export class ApiClient {
  private baseURL: string;
  private clientId: string | null = null;
  
  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
  }
  
  // Set client ID for automatic inclusion in requests
  setClientId(clientId: string): void {
    this.clientId = clientId;
  }
  
  // Get current client ID
  getClientId(): string | null {
    return this.clientId;
  }
  
  private async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    try {
      const { method = 'GET', headers = {}, body, params = {}, includeClientId = true } = options;
      
      // Automatically include clientId if available and requested
      const finalParams = { ...params };
      if (includeClientId && this.clientId) {
        finalParams.clientId = this.clientId;
      }
      
      // Build URL with query parameters
      const queryString = finalParams ? buildQueryString(finalParams) : '';
      const url = `${this.baseURL}${endpoint}${queryString}`;
      
      // Prepare headers
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers,
      };
      
      // Prepare body - also include clientId in body for POST/PUT requests if not in params
      let requestBody: string | undefined = undefined;
      if (body !== undefined) {
        const finalBody = { ...body };
        if (includeClientId && this.clientId && method !== 'GET' && !finalParams.clientId) {
          finalBody.clientId = this.clientId;
        }
        requestBody = JSON.stringify(finalBody);
      }
      
      // Make request
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: requestBody,
      });
      
      // Parse response
      let data: T;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = (await response.text()) as unknown as T;
      }
      
      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          data,
        };
      }
      
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
  
  // GET request
  async get<T = any>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET', params });
  }
  
  // POST request
  async post<T = any>(endpoint: string, body?: any, params?: Record<string, string | number | boolean | undefined>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'POST', body, params });
  }
  
  // PUT request
  async put<T = any>(endpoint: string, body?: any, params?: Record<string, string | number | boolean | undefined>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PUT', body, params });
  }
  
  // DELETE request
  async delete<T = any>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE', params });
  }
}

// Default API client instance
export const apiClient = new ApiClient();

// Helper function to initialize API client with client store
export async function initializeApiWithClientStore() {
  // Dynamic import to avoid circular dependency
  const { useClientStore } = await import('@/stores/client');
  const clientStore = useClientStore();
  
  // Initialize client store if not already done
  if (!clientStore.isInitialized) {
    clientStore.initialize();
  }
  
  // Set client ID in API client
  const clientId = clientStore.getCurrentClientId();
  apiClient.setClientId(clientId);
  
  console.log('[API] API client initialized with clientId:', clientId.substring(0, 8) + '...');
  return apiClient;
}