import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import istanbul from 'vite-plugin-istanbul'
import type { PluginOption } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const plugins: PluginOption[] = [react()]
  if (mode === 'coverage') {
    plugins.push(
      istanbul({
        include: 'src/**/*',
        extension: ['.js', '.ts', '.tsx'],
        requireEnv: false,
      }),
    )
  }

  const basePath = process.env.VITE_BASE_PATH ?? '/'

  return {
    plugins,
    base: basePath,
  }
})
