// Get API base URL from environment variable or use current domain
export const API_URL = import.meta.env.VITE_API_URL || (() => {
  // In production on Netlify, the backend would be at the same domain or a different domain
  // For now, return empty string to use relative paths
  return '';
})();

/**
 * Fetch wrapper that automatically prepends API_URL
 */
export async function apiFetch(
  endpoint: string,
  options?: RequestInit
): Promise<Response> {
  const url = API_URL ? `${API_URL}${endpoint}` : endpoint;
  return fetch(url, options);
}

/**
 * Fetch with JSON response parsing
 */
export async function apiFetchJson<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await apiFetch(endpoint, options);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
