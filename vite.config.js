import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Tijdens lokaal ontwikkelen draai je naast `npm run dev` ook `netlify dev`
// zodat de /api/* endpoints (Netlify Functions) beschikbaar zijn.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
