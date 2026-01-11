/**
 * Frontend settings - mirrors backend pattern.
 *
 * Set via environment variables (VITE_ prefix for Vite):
 *   VITE_SHOW_DEV_BANNER=true
 *   VITE_API_URL=http://localhost:8000
 */

const env = typeof import.meta !== 'undefined' ? (import.meta as any).env : {};

export const settings = {
  // Show the dev banner with timing/cost metrics on ReviewScreen
  showDevBanner: env.VITE_SHOW_DEV_BANNER !== 'false',  // Default: true

  // Backend API URL
  apiUrl: env.VITE_API_URL || 'http://localhost:8000',
};
