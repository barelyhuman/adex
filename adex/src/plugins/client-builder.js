import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import { mergeConfig, build } from 'vite'
import preact from '@preact/preset-vite'
import { existsSync } from 'fs'
import { rm } from 'fs/promises'

/**
 * Create a plugin for building the client in SSR mode
 *
 * @param {object} options - Options for client builder
 * @param {boolean} [options.ssr=true] - Whether to enable SSR
 * @param {boolean} [options.islands=false] - Whether to enable islands architecture
 * @returns {import("vite").Plugin}
 */
export function createClientBuilder({ ssr = true, islands = false } = {}) {
  let baseUrl = '/'
  return {
    name: 'adex-client-builder',
    config(cfg) {
      const out = cfg.build.outDir ?? 'dist'
      return {
        appType: 'custom',
        build: {
          write: !islands,
          manifest: 'manifest.json',
          outDir: join(out, 'client'),
          rollupOptions: {
            input: 'virtual:adex:client',
          },
          output: {
            entryFileNames: '[name]-[hash].js',
            format: 'esm',
          },
        },
      }
    },
    configResolved(cfg) {
      baseUrl = cfg.base
      return
    },
    generateBundle(opts, bundle) {
      let clientEntryPath
      for (const key in bundle) {
        if (
          ['_virtual_adex_client', '_app'].includes(bundle[key].name) &&
          'isEntry' in bundle[key] &&
          bundle[key].isEntry
        ) {
          clientEntryPath = key
        }
      }

      const links = [
        // @ts-expect-error Vite types don't include viteMetadata but it exists at runtime
        ...(bundle[clientEntryPath]?.viteMetadata?.importedCss ?? new Set()),
      ].map(d => {
        return `<link rel="stylesheet" href="${join(baseUrl, d)}" />`
      })

      if (!ssr) {
        this.emitFile({
          type: 'asset',
          fileName: 'index.html',
          source: `<html>
            <head>
              ${links.join('\n')}
            </head>
            <body>
              <div id="app"></div>
              <script src="${join(baseUrl, clientEntryPath)}" type="module"></script>
            </body>
          </html>`,
        })
      }
    },
  }
}

/**
 * Create a build preparation plugin
 *
 * @param {object} options - Configuration options
 * @param {boolean} [options.islands=false] - Whether to enable islands architecture
 * @returns {import("vite").Plugin}
 */
export function createBuildPrep({ islands = false }) {
  return {
    name: 'adex-build-prep',
    apply: 'build',
    async configResolved(config) {
      if (!islands) return

      // Making it order safe
      const outDirNormalized = config.build.outDir.endsWith('/server')
        ? dirname(config.build.outDir)
        : config.build.outDir

      // remove the `client` dir if islands are on,
      // we don't generate the client assets and
      // their existence adds the client entry into the bundle
      const clientDir = join(outDirNormalized, 'client')
      if (!existsSync(clientDir)) return
      await rm(clientDir, {
        recursive: true,
        force: true,
      })
    },
  }
}
