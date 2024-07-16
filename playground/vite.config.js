import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { adex } from 'adex'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [adex(), preact()],
})
