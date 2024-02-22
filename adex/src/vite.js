import fs, { readFileSync } from 'node:fs'
import path, { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, loadConfigFromFile, mergeConfig } from 'vite'
import { adexLoader } from './lib/adex-loader.js'
import preact from '@preact/preset-vite'
import {
  DEFAULT_TRANSPILED_IDENTIFIERS,
  findIslands,
  generateClientTemplate,
  injectIslandAST,
  isFunctionIsland,
  readSourceFile
} from '@dumbjs/preland'
import { addImportToAST, codeFromAST } from '@dumbjs/preland/ast'

const __dirname = dirname(fileURLToPath(import.meta.url))
/**
 * @returns {import("vite").Plugin[]}
 */
export function adex () {
  return [
    preact(),
    adexMultibuild(),
    adexLoader(),
    adexIslandExtractor(),
    virtualDefaultEntry({
      entry: '/src/server',
      virtualName: 'server-entry',
      resolveName: true,
      defaultContent: readFileSync(
        join(__dirname, './runtime/server.js'),
        'utf8'
      )
    }),
    virtualDefaultEntry({
      entry: '/src/client',
      virtualName: 'client-entry',
      resolveName: true,
      defaultContent: readFileSync(
        join(__dirname, './runtime/client.js'),
        'utf8'
      )
    }),
    virtualDefaultEntry({
      entry: '/src/middleware',
      virtualName: 'middleware-entry',
      resolveName: true,
      defaultContent: readFileSync(
        join(__dirname, './runtime/middleware.js'),
        'utf8'
      )
    }),
    virtualDefaultEntry({
      entry: '/src/runner',
      virtualName: 'runner-entry',
      resolveName: true,
      defaultContent: readFileSync(
        join(__dirname, './runtime/runner.js'),
        'utf8'
      )
    }),
    resolveClientManifest()
  ]
}

/**
 * @returns {import("vite").Plugin[]}
 */
function adexMultibuild (options) {
  let command
  return [
    {
      name: 'adex-multibuild',
      enforce: 'post',
      config () {
        return {
          appType: 'custom',
          define: {
            __ADEX_CLIENT_BUILD_OUTPUT_DIR: JSON.stringify('dist/client')
          },
          build: {
            target: 'node18',
            ssr: true,
            // manifest: 'vite.manifest.json',
            outDir: 'dist/server',
            rollupOptions: {
              input: {
                index: 'virtual:adex:runner-entry',
                handler: 'virtual:adex:server-entry'
              },
              external: ['adex/utils']
            }
          }
        }
      },
      configResolved (config) {
        command = config.command
      },
      configureServer (server) {
        return async () => {
          server.middlewares.use(async (req, res, next) => {
            try {
              const mod = await server.ssrLoadModule(
                'virtual:adex:server-entry'
              )
              await mod.default(req, res)
              if (!res.writableEnded) {
                res.write('Not Found')
                res.statusCode = 404
                res.end()
                next()
              }
            } catch (err) {
              if (err instanceof Error) {
                server.ssrFixStacktrace(err)
              }
            }
          })
        }
      },
      async closeBundle () {
        if (command !== 'build') return

        islandsToGenerate.forEach(f => {
          const outputFile = path.join('dist', f.id)
          fs.mkdirSync(dirname(outputFile), {
            recursive: true
          })
          fs.writeFileSync(outputFile, f.template, 'utf-8')
        })

        const config = await loadConfigFromFile()
        config.config.plugins = config.config.plugins
          .flat(2)
          .filter((x) => x.name !== 'adex-multibuild')

        const input = Object.fromEntries(islandsToGenerate.map(d => [basename(d.id), path.join('dist', d.id)]))

        await build({
          appType: 'custom',
          configFile: false,
          plugins: [preact()],
          build: {
            target: 'node18',
            outDir: 'dist/client/assets',
            ssr: false,
            rollupOptions: {
              input,
              output: {
                format: 'esm',
                entryFileNames: '[name]',
                chunkFileNames: '[name].js'
              },
              external: ['adex/utils']
            }
          }
        })

        await new Promise((resolve) => process.stdout.write('', resolve))
      }
    }
  ]
}

// https://github.com/rakkasjs/rakkasjs/blob/1c552cc19e4f9165cf5d001fe3af5bc86fe7f527/packages/rakkasjs/src/vite-plugin/virtual-default-entry.ts#L11
function virtualDefaultEntry ({
  defaultContent = '',
  entry = '',
  virtualName = '',
  resolveName = true
} = {}) {
  let fallback
  const exists = false

  return {
    name: 'adex:default-entry',
    enforce: 'pre',
    async configResolved (config) {
      if (resolveName) {
        fallback = path.resolve(config.root, entry.slice(1)).replace(
          /\\/g,
          '/'
        )
      } else {
        fallback = 'virtual:adex:' + virtualName
      }
    },

    async resolveId (id) {
      if (
        id === 'virtual:adex:' + virtualName ||
        id === '/virtual:adex:' + virtualName ||
        id === entry
      ) {
        const userEntry = await this.resolve(entry)
        return userEntry || fallback
      }
    },

    async load (id) {
      if (id === fallback && !exists) {
        return defaultContent
      }
    }
  }
}

// https://github.com/rakkasjs/rakkasjs/blob/1c552cc19e4f9165cf5d001fe3af5bc86fe7f527/packages/rakkasjs/src/vite-plugin/resolve-client-manifest.ts#L11
function resolveClientManifest () {
  let resolvedConfig
  let dev = false
  const moduleId = 'virtual:adex:client-manifest'
  return {
    name: 'adex:resolve-client-manifest',
    enforce: 'pre',
    config (cfg, env) {
      dev = env.command === 'serve'
    },
    resolveId (id, _, options) {
      if (id === moduleId) {
        if (dev || !options.ssr) {
          return id
        }
        return this.resolve(
          path.resolve(resolvedConfig.root, 'dist/manifest.json')
        )
      }
    },

    load (id) {
      if (id === moduleId) {
        return 'export default undefined'
      }
    },

    configResolved (config) {
      resolvedConfig = config
    },

    async closeBundle () {
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
    }
  }
}

const islandsToGenerate = []
/**
 * @returns {import("vite").Plugin}
 */
function adexIslandExtractor () {
  let mode
  return {
    name: 'adex-island-extractor',
    configResolved (config) {
      mode = config.mode
      console.log({ mode })
    },
    load (id, env) {
      if (
        id.startsWith('virtual:adex:') ||
        id.startsWith('/virtual:adex')
      ) {
        return null
      }

      const existsInIslands = islandsToGenerate.findIndex((x) =>
        x.id === id || id === '/' + x.id
      )
      if (existsInIslands > -1) {
        return {
          code: islandsToGenerate[existsInIslands].template
        }
      }
    },
    transform (code, id, ctx) {
      const existsInIslands = islandsToGenerate.findIndex((x) =>
        x.id === id || id === '/' + x.id
      )
      if (existsInIslands > -1) {
        return {
          code
        }
      }

      if (id.startsWith('\x00')) {
        return
      }

      if (!(/\.(js|ts)x?$/).test(id)) {
        return
      }

      const source = readSourceFile(id)
      const islands = findIslands(source, {
        isFunctionIsland: (ast) =>
          isFunctionIsland(ast, {
            transpiledIdentifiers: [].concat(
              DEFAULT_TRANSPILED_IDENTIFIERS,
              '_jsxDEV'
            )
          })
      })

      if (!islands.length) {
        return
      }

      const generateKey = (id) => `assets/${id}.island.jsx`

      islands.forEach((island) => {
        injectIslandAST(island.ast, island)
        const addImport = addImportToAST(island.ast)
        addImport('h', 'preact', { named: true })
        addImport('Fragment', 'preact', { named: true })
        let generatedTemplate = generateClientTemplate(island.id).replace(
          '<~~{importPath}~~>',
          id
        )
        if (mode === 'development') {
          generatedTemplate = generatedTemplate.replace('render(restoreTree(this.component, this.baseProps), this, undefined)', 'render(restoreTree(this.component, this.baseProps), this, this)')
        }
        islandsToGenerate.push({
          id: generateKey(island.id),
          name: island.id,
          template: generatedTemplate

        })
      })

      let serverTemplate = codeFromAST(islands[0].ast)

      islands.forEach((island) => {
        serverTemplate = serverTemplate.replace(
          `<~{${island.id}}~>`,
          generateKey(island.id)
        )
      })

      return {
        code: serverTemplate
      }
    }
  }
}
