import { defineConfig } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main:    resolve(__dirname, 'app/index.html'),
        account: resolve(__dirname, 'app/account/index.html'),
        rules:   resolve(__dirname, 'app/rules/index.html'),
      }
    }
  }
})
