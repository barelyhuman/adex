import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    hookTimeout: 30_000,
  },
})
