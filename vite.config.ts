import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Reads .env.local. The empty prefix loads every variable, including NASA_API_KEY.
  // It has no VITE_ prefix on purpose, so it stays on the dev server and is never
  // shipped to the browser.
  const env = loadEnv(mode, '.', '')

  if (!env.NASA_API_KEY) {
    console.warn('NASA_API_KEY is not set in .env.local. Using DEMO_KEY, which is heavily rate-limited.')
  }

  return {
    plugins: [react()],
    server: {
      proxy: {
        // While developing, these stand in for the functions in the api/ folder.
        // Keep them in step with those files.
        '/api/sesame': {
          target: 'https://cds.unistra.fr',
          changeOrigin: true,
          rewrite: (path: string) => {
            // The name resolver wants the name as the whole query string.
            const name = new URL(path, 'http://localhost').searchParams.get('name') ?? ''
            return `/cgi-bin/nph-sesame/-oI/SN?${encodeURIComponent(name)}`
          },
        },
        '/api/simbad': {
          target: 'https://simbad.cds.unistra.fr',
          changeOrigin: true,
          rewrite: () => '/simbad/sim-tap/sync',
        },
        // NASA Image and Video Library: the backup source when APOD is broken. No key needed.
        '/api/nasaimages': {
          target: 'https://images-api.nasa.gov',
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api\/nasaimages/, '/search'),
        },
        // The browser calls /api/apod; the key is added here, on the server side.
        '/api/apod': {
          target: 'https://api.nasa.gov',
          changeOrigin: true,
          rewrite: (path: string) => {
            const url = new URL(path, 'http://localhost')
            url.searchParams.set('api_key', env.NASA_API_KEY || 'DEMO_KEY')
            return `/planetary/apod${url.search}`
          },
        },
      },
    },
  }
})
