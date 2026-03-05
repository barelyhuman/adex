import { join, dirname } from 'path'
import { build, mergeConfig } from 'vite'
import { readFileSync } from 'fs'
import preact from '@preact/preset-vite'

import {
  createVirtualModule,
  createUserDefaultVirtualModule,
} from '../utils/virtual-modules.js'
import { preactPages } from './preact-pages.js'
import { getServerTemplate } from '../utils/server-template.js'
import { fileURLToPath } from 'url'

/**
 * Create a server builder plugin
 *
 * @param {object} options - Configuration options
 * @param {import("../fonts.js").Options} [options.fonts] - Font options
 * @param {string} [options.adapter='node'] - Server adapter
 * @param {boolean} [options.islands=false] - Whether to enable islands
 * @param {function} [options.islandBuilderFactory] - Factory for island builder plugins
 * @param {function} [options.fontsPluginFactory] - Factory for fonts plugin
 * @returns {import("vite").Plugin}
 */
export function createServerBuilder({
  fonts,
  adapter,
  islands,
  islandBuilderFactory,
  fontsPluginFactory,
}) {
  let input = 'src/entry-server.js'
  let cfg

  return {
    name: `adex-server`,
    enforce: 'pre',
    apply: 'build',

    config(conf, env) {
      if (env.command === 'build') {
        input = 'virtual:adex:server'
      }
    },

    configResolved(config) {
      cfg = config
    },

    async generateBundle() {
      const defOut = cfg.build?.outDir ?? 'dist'
      const serverOutDir = defOut.endsWith('client')
        ? join(dirname(defOut), 'server')
        : join(defOut, 'server')

      console.log(`\nBuilding Server: ${serverOutDir}\n`)

      const runtimeFolder = join(
        dirname(fileURLToPath(import.meta.url)),
        '../../runtime'
      )

      // Filter out vite internal plugins and adex plugins that shouldn't be reused
      const sanitizedPlugins = (cfg.plugins ?? [])
        .filter(d => d.adexServer === false)
        .filter(d => !d.name.startsWith('vite:'))
        .filter(d => !d.name.startsWith('adex-'))

      await build({
        configFile: false,
        ssr: {
          external: ['preact', 'adex', 'preact-render-to-string'],
          noExternal: [`adex-adapter-${adapter}`],
        },
        resolve: cfg.resolve,
        appType: 'custom',
        plugins: [
          preact(),
          preactPages({
            root: '/src/pages',
            id: '~routes',
          }),
          preactPages({
            root: '/src/api',
            id: '~apiRoutes',
            replacer: '/api',
          }),
          createUserDefaultVirtualModule(
            'virtual:adex:global.css',
            '',
            '/src/global.css'
          ),
          createVirtualModule(
            'adex/app',
            readFileSync(join(runtimeFolder, 'app.js'), 'utf8')
          ),
          createUserDefaultVirtualModule(
            'virtual:adex:client',
            readFileSync(join(runtimeFolder, 'client.js'), 'utf8'),
            '/src/_app'
          ),
          createVirtualModule(
            'virtual:adex:handler',
            readFileSync(join(runtimeFolder, 'handler.js'), 'utf8')
          ),
          createVirtualModule(
            'virtual:adex:server',
            getServerTemplate(`adex-adapter-${adapter}`)
          ),
          fontsPluginFactory(fonts),
          islands && islandBuilderFactory(),
          ...sanitizedPlugins,
        ],
        build: {
          outDir: serverOutDir,
          emptyOutDir: false,
          assetsDir: 'assets',
          ssrEmitAssets: true,
          ssr: true,
          manifest: 'manifest.json',
          ssrManifest: 'ssr.manifest.json',
          rollupOptions: {
            input: {
              index: input,
            },
            external: ['adex/ssr'],
          },
        },
      })
    },
  }
}
