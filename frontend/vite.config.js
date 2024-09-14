import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Set this to true to listen on all IP addresses (or use '0.0.0.0')
    port: 3000, // You can change this if you want
  },
})


