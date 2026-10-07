import { defineConfig, loadEnv, type Plugin } from 'vite'
import path from 'path'
import { copyFileSync, existsSync, unlinkSync } from 'node:fs'
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
  const coachBuild = mode === 'stage4-test' || mode === 'stage4-release'
  if (coachBuild) {
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    const url = mode === 'stage4-release' ? env.VITE_SUPABASE_URL : env.VITE_STAGE4_SUPABASE_URL
    const key = mode === 'stage4-release' ? env.VITE_SUPABASE_ANON_KEY : env.VITE_STAGE4_SUPABASE_KEY
    const expectedUrl = mode === 'stage4-release'
      ? 'https://pwgqwcvultxihntvaewo.supabase.co'
      : 'https://viouquduxutuslafiooy.supabase.co'
    if (url !== expectedUrl || !key?.startsWith('sb_publishable_')) {
      throw new Error(`${mode} requires its designated project URL and publishable key. No fallback is allowed.`)
    }
  }
  return {
    plugins: [
      ...(coachBuild ? ([{
        name: 'stage4-offline-asset-list',
        generateBundle(_options, bundle) {
          const page = mode === 'stage4-release' ? 'release.html' : 'stage4.html'
          const manifest = mode === 'stage4-release' ? 'release-assets.json' : 'stage4-assets.json'
          this.emitFile({ type: 'asset', fileName: manifest, source: JSON.stringify([`/${page}`, ...Object.keys(bundle).map(name => `/${name}`)]) })
        },
      }] satisfies Plugin[]) : []),
      ...(mode === 'stage4-release' ? ([{
        name: 'release-root-entry',
        writeBundle(options) {
          const outDir = path.resolve(options.dir ?? 'dist')
          copyFileSync(path.join(outDir, 'release.html'), path.join(outDir, 'index.html'))
          const testWorker = path.join(outDir, 'sw-stage4.js')
          if (existsSync(testWorker)) unlinkSync(testWorker)
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
        ...(coachBuild ? { '@/lib/supabase': path.resolve(__dirname, 'src/stage4/adminClient.ts') } : {}),
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
    },

    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],
    build: coachBuild ? { rollupOptions: { input: path.resolve(__dirname, mode === 'stage4-release' ? 'release.html' : 'stage4.html') } } : undefined,
  }
})
