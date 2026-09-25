import { defineConfig, loadEnv, type Plugin } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  if (mode === 'stage4-test') {
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    if (env.VITE_STAGE4_SUPABASE_URL !== 'https://viouquduxutuslafiooy.supabase.co' ||
        !env.VITE_STAGE4_SUPABASE_KEY?.startsWith('sb_publishable_')) {
      throw new Error('Stage 4 test mode requires the isolated test project URL and publishable key. No fallback is allowed.')
    }
  }
  return {
    plugins: [
      ...(mode === 'stage4-test' ? ([{
        name: 'stage4-offline-asset-list',
        generateBundle(_options, bundle) {
          this.emitFile({ type: 'asset', fileName: 'stage4-assets.json', source: JSON.stringify(['/stage4.html', ...Object.keys(bundle).map(name => `/${name}`)]) })
        },
      }] satisfies Plugin[]) : []),
      figmaAssetResolver(),
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used – do not remove them
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
    },

    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],
    build: mode === 'stage4-test' ? { rollupOptions: { input: path.resolve(__dirname, 'stage4.html') } } : undefined,
  }
})
