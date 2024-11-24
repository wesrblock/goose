// Configuration has been moved to preload.js and exposed via appConfig.

// Helper to construct API endpoints based on new config
export const getApiUrl = (endpoint: string): string => {
  const baseUrl = window.appConfig.DEFAULT_HOST.endsWith('/') ? window.appConfig.DEFAULT_HOST.slice(0, -1) : window.appConfig.DEFAULT_HOST;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};