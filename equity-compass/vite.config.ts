import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
    },
    define: {
      // Correctly map the process.env.API_KEY to the loaded environment variable
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Prevent crash for other process.env access, but don't overwrite API_KEY
      'process.env': {}
    }
  }
})