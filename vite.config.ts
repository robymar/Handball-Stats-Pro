import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {}
  },
  base: '/', // Rutas absolutas para que funcione el routing en sub-rutas como /match/:id
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000
  }
});