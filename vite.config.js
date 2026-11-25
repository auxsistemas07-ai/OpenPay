import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Solo desarrollo: permite abrir la página desde el teléfono por el túnel de ngrok (https),
    // necesario porque el GPS del navegador solo funciona en sitios seguros.
    allowedHosts: ['.ngrok-free.dev'],
    // Desde el teléfono la página llama /api en su mismo dominio y Vite lo reenvía al backend.
    proxy: { '/api': { target: process.env.API_PROXY || 'http://localhost:5088', changeOrigin: true } },
  },
})
