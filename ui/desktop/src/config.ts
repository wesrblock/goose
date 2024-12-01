
// Helper to construct API endpoints
export const getApiUrl = (endpoint: string, setDirectory): string => {  
  const baseUrl = window.appConfig.get('GOOSE_API_HOST') + ':' + window.goosedPort;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};