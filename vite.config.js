import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  root: '.',
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'app/index.html'),
      },
    },
  },
})
