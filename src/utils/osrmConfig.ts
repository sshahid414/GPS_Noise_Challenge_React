/** Dev uses Vite proxy (/osrm) to avoid browser CORS on OSRM. */
export const OSRM_BASE = import.meta.env.DEV
  ? '/osrm'
  : 'https://router.project-osrm.org';
