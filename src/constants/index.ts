// API base intelligent resolution: relative if served from backend port 4000 or production, absolute for Vite dev server (port 5173)
export const API_BASE = window.location.port === '4000' || window.location.port === ''
  ? ''
  : `http://${window.location.hostname}:4000`;
