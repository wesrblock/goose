// Default host for the Goose API
const DEFAULT_HOST = 'http://127.0.0.1:3000';

// Get the host from environment variable or use default
export const GOOSE_API_HOST = import.meta.env.VITE_GOOSE_HOST || DEFAULT_HOST;

// Control whether to start the embedded server (defaults to yes if not set)
export const START_EMBEDDED_SERVER = (import.meta.env.VITE_START_EMBEDDED_SERVER || 'yes').toLowerCase() === 'yes';

// Helper to construct API endpoints
export const getApiUrl = (endpoint: string): string => {
  const baseUrl = GOOSE_API_HOST.endsWith('/') ? GOOSE_API_HOST.slice(0, -1) : GOOSE_API_HOST;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};