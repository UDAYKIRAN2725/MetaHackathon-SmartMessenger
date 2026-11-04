import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// /api (REST + WebSocket) goes to the FastAPI backend, so the browser sees one origin
// and the HTTP-only session cookie works without CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', ws: true },
    },
  },
});
