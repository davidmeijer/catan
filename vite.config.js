import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The app uses only React and TS; Vite defaults work great.
export default defineConfig({
  plugins: [react()],
})
