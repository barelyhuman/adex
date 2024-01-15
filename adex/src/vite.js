import fs, { existsSync, readFileSync } from 'node:fs'
import path, { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { adexLoader } from './lib/adex-loader.js'
import { build, mergeConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function adex() {
  return [
    adexMultibuild(),
    adexLoader(),
    virtualDefaultEntry({
      entry: '/src/server',
      virtualName: 'server-entry',
      resolveName: true,
      defaultContent: readFileSync(
        join(__dirname, './runtime/server.js'),
        'utf8'
      ),
    }),
    virtualDefaultEntry({
      entry: '/src/client',
      virtualName: 'client-entry',
      resolveName: true,
      defaultContent: readFileSync(
        join(__dirname, './runtime/client.js'),
        'utf8'
      ),
    }),
    virtualDefaultEntry({
      entry: '/src/middleware',
      virtualName: 'middleware-entry',
      resolveName: true,
      defaultContent: readFileSync(
        join(__dirname, './runtime/middleware.js'),
        'utf8'
      ),
    }),
    virtualDefaultEntry({
      entry: '/src/runner',
      virtualName: 'runner-entry',
      resolveName: true,
      defaultContent: readFileSync(
        join(__dirname, './runtime/runner.js'),
        'utf8'
      ),
    }),
    resolveClientManifest(),
  ]
}

/**
 * @returns {import("vite").Plugin[]}
 */
function adexMultibuild(options) {
  let currMode, resolvedConfig, command
  return [
    {
      name: 'adex-multibuild',
      enforce: 'post',
      config(_config) {
        return {
          appType: 'custom',
          build: {
            manifest: 'vite.manifest.json',
            outDir: 'dist/client',
            rollupOptions: {
              input: {
                index: 'virtual:adex:client-entry',
              },
            },
          },
        }
      },
      configResolved(config) {
        currMode = config.mode
        resolvedConfig = config
        command = config.command
      },
      configureServer(server) {
        return async () => {
          const mod = await server.ssrLoadModule('virtual:adex:server-entry')
          server.middlewares.use(async (req, res, next) => {
            await mod.default(req, res)
            if (!res.writableEnded) {
              res.write('Not Found')
              res.statusCode = 404
              res.end()
              next()
            }
          })
        }
      },
      async closeBundle() {
        if (command !== 'build') return
        await build({
          appType: 'custom',
          build: {
            target: 'node18',
            outDir: 'dist/server',
            ssr: true,
            rollupOptions: {
              input: {
                server: 'virtual:adex:runner-entry',
                handler: 'virtual:adex:server-entry',
              },
              external: ['adex/utils'],
            },
          },
          configFile: false,
          plugins: [
            adexLoader(),
            virtualDefaultEntry({
              entry: '/src/runner.js',
              virtualName: 'runner-entry',
              resolveName: true,
              defaultContent: readFileSync(
                join(__dirname, './runtime/runner.js'),
                'utf8'
              ),
            }),
            virtualDefaultEntry({
              entry: '/src/server.js',
              virtualName: 'server-entry',
              resolveName: true,
              defaultContent: readFileSync(
                join(__dirname, './runtime/server.js'),
                'utf8'
              ),
            }),
            virtualDefaultEntry({
              entry: '/src/client.js',
              virtualName: 'client-entry',
              resolveName: true,
              defaultContent: readFileSync(
                join(__dirname, './runtime/client.js'),
                'utf8'
              ),
            }),
            virtualDefaultEntry({
              entry: '/src/middleware.js',
              virtualName: 'middleware-entry',
              resolveName: true,
              defaultContent: readFileSync(
                join(__dirname, './runtime/middleware.js'),
                'utf8'
              ),
            }),
            resolveClientManifest(),
          ],
        })
      },
    },
  ]
}

//https://github.com/rakkasjs/rakkasjs/blob/1c552cc19e4f9165cf5d001fe3af5bc86fe7f527/packages/rakkasjs/src/vite-plugin/virtual-default-entry.ts#L11
function virtualDefaultEntry({
  defaultContent = '',
  entry = '',
  virtualName = '',
  resolveName = true,
} = {}) {
  let fallback
  let exists = false

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
        return userEntry || fallback
      }
    },

    async load(id) {
      if (id === fallback && !exists) {
        return defaultContent
      }
    },
  }
}

//https://github.com/rakkasjs/rakkasjs/blob/1c552cc19e4f9165cf5d001fe3af5bc86fe7f527/packages/rakkasjs/src/vite-plugin/resolve-client-manifest.ts#L11
function resolveClientManifest() {
  let resolvedConfig

  let moduleId = 'virtual:adex:client-manifest'
  return {
    name: 'adex:resolve-client-manifest',
    enforce: 'pre',
    resolveId(id, _, options) {
      if (id === moduleId) {
        return this.resolve(
          path.resolve(resolvedConfig.root, 'dist/manifest.json')
        )
      }
    },

    load(id) {
      if (id === moduleId) {
        return 'export default undefined'
      }
    },

    config(config, env) {
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
