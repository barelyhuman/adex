import { readFileSync } from 'node:fs'
import path, { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { vavite } from 'vavite'
import fs from 'node:fs'
import { adexLoader } from './lib/adex-loader.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function adex() {
  return [
    adexLoader(),
    configInject(),
    vavite({
      clientAssetsDir: './dist/client',
      handlerEntry: 'virtual:adex:server-entry',
      reloadOn: 'static-deps-change',
      serveClientAssetsInDev: true,
    }),
    virtualDefaultEntry({
      entry: '/src/server.ts',
      virtualName: 'server-entry',
      defaultContent: readFileSync(
        join(__dirname, './runtime/server.ts'),
        'utf8'
      ),
    }),
    virtualDefaultEntry({
      entry: '/src/index.html',
      virtualName: 'entry-template',
      resolveName: false,
      defaultContent: readFileSync(
        join(__dirname, './runtime/index.html'),
        'utf8'
      ),
    }),
    virtualDefaultEntry({
      entry: '/src/client.ts',
      virtualName: 'client-entry',
      defaultContent: readFileSync(
        join(__dirname, './runtime/client.ts'),
        'utf8'
      ),
    }),
    importRawHTML(),
    resolveClientManifest(),
  ]
}

/**
 * @returns {import("vite").Plugin}
 */
function configInject() {
  return {
    name: 'adex-injector',
    enforce: 'pre',
    config(_, env) {
      // required for vavite to build
      if (env.mode !== 'multibuild') {
        return
      }
      return {
        appType: 'custom',
        buildSteps: [
          {
            name: 'client',
            config: {
              build: {
                outDir: 'dist/client',
                manifest: true,
                rollupOptions: { input: 'virtual:adex:client-entry' },
              },
            },
          },
          {
            name: 'server',
            config: {
              build: {
                target: 'node18',
                ssr: true,
                outDir: 'dist/server',
                rollupOptions: {
                  external: ['adex/utils'],
                },
              },
            },
          },
        ],
      }
    },
  }
}

//https://github.com/rakkasjs/rakkasjs/blob/1c552cc19e4f9165cf5d001fe3af5bc86fe7f527/packages/rakkasjs/src/vite-plugin/virtual-default-entry.ts#L11
function virtualDefaultEntry({
  defaultContent = '',
  entry = '',
  virtualName = '',
  resolveName = true,
} = {}) {
  let fallback

  return {
    name: 'adex:default-entry',

    enforce: 'pre',

    async configResolved(config) {
      if (resolveName) {
        fallback = path.resolve(config.root, entry.slice(1)).replace(/\\/g, '/')
      } else {
        fallback = 'virtual:adex:' + virtualName
      }
    },

    async resolveId(id) {
      if (
        id === 'virtual:adex:' + virtualName ||
        id === '/virtual:adex:' + virtualName ||
        id === entry
      ) {
        const userEntry = await this.resolve(entry)
        return userEntry ?? fallback
      }
    },

    async load(id) {
      if (id === fallback) {
        return defaultContent
      }
    },
  }
}

//https://github.com/rakkasjs/rakkasjs/blob/1c552cc19e4f9165cf5d001fe3af5bc86fe7f527/packages/rakkasjs/src/vite-plugin/resolve-client-manifest.ts#L11
function resolveClientManifest() {
  let resolvedConfig
  let dev = false

  let moduleId = 'virtual:adex:client-manifest'
  return {
    name: 'adex:resolve-client-manifest',

    enforce: 'pre',

    resolveId(id, _, options) {
      if (id === moduleId) {
        if (dev || !options.ssr) {
          return id
        } else {
          return this.resolve(
            path.resolve(resolvedConfig.root, 'dist/manifest.json')
          )
        }
      }
    },

    load(id) {
      if (id === moduleId) {
        return 'export default undefined'
      }
    },

    config(config, env) {
      dev = env.command === 'serve'

      if (!config.build?.ssr) {
        return {
          build: {
            manifest: 'vite.manifest.json',
          },
        }
      }
    },

    configResolved(config) {
      resolvedConfig = config
    },

    async closeBundle() {
      if (resolvedConfig.command === 'serve' || resolvedConfig.build.ssr) {
        return
      }

      const from = path.resolve(
        resolvedConfig.root,
        resolvedConfig.build.outDir,
        'vite.manifest.json'
      )

      await fs.promises
        .rename(from, resolvedConfig.root + '/dist/manifest.json')
        .catch(() => {
          // Ignore if the file doesn't exist
        })
    },
  }
}

/**
 * @returns {import("vite").Plugin}
 */
function importRawHTML() {
  return {
    name: 'adex-import-raw-html',
    transform(code, id) {
      if (id.endsWith('.html')) {
        code = `export default \`${code}\``
      }
      return {
        code,
      }
    },
  }
}
