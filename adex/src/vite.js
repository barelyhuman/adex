import {
  DEFAULT_TRANSPILED_IDENTIFIERS,
  findIslands,
  generateClientTemplate,
  injectIslandAST,
  isFunctionIsland,
} from '@dumbjs/preland'
import { addImportToAST, codeFromAST } from '@dumbjs/preland/ast'
import preact from '@preact/preset-vite'
import { transform as cssTransform } from 'lightningcss'
import fs, { readFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path, { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, normalizePath, transformWithEsbuild } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))
const JS_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx']

/**
 * @returns {import("vite").Plugin[]}
 */
export function adex() {
  return [
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
      entry: '/src/app',
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
    preact(),
    resolveServerManifest(),
    resolveClientManifest(),
    _adex(),
  ]
}

// https://github.com/rakkasjs/rakkasjs/blob/1c552cc19e4f9165cf5d001fe3af5bc86fe7f527/packages/rakkasjs/src/vite-plugin/virtual-default-entry.ts#L11
function virtualDefaultEntry({
  defaultContent = '',
  entry = '',
  virtualName = '',
  resolveName = true,
} = {}) {
  let fallback
  const exists = false

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

// https://github.com/rakkasjs/rakkasjs/blob/1c552cc19e4f9165cf5d001fe3af5bc86fe7f527/packages/rakkasjs/src/vite-plugin/resolve-client-manifest.ts#L11
function resolveClientManifest() {
  let resolvedConfig
  let dev = false
  const moduleId = 'virtual:adex:client-manifest'
  return {
    name: 'adex:resolve-client-manifest',
    enforce: 'pre',
    config(cfg, env) {
      dev = env.command === 'serve'
    },
    resolveId(id, _, options) {
      if (id === moduleId) {
        if (dev || !options.ssr) {
          return id
        }
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

function resolveServerManifest() {
  let resolvedConfig
  let dev = false
  const moduleId = 'virtual:adex:server-manifest'
  return {
    name: 'adex:resolve-server-manifest',
    enforce: 'post',
    config(cfg, env) {
      dev = env.command === 'serve'
    },
    resolveId(id, _, options) {
      if (id === moduleId) {
        if (dev || !options.ssr) {
          return id
        }

        return path.resolve(
          resolvedConfig.root,
          resolvedConfig.build.outDir,
          'manifest.json'
        )
      }
    },

    load(id) {
      if (id === moduleId) {
        return 'export default undefined'
      }
    },

    configResolved(config) {
      resolvedConfig = config
    },
  }
}

/**
 * @returns {import("vite").Plugin[]}
 */
function _adex(options) {
  const islands = new Map()
  const cssImports = new Map()
  const cssCodeMap = new Map()
  let devServer
  return [
    adexServer(devServer),
    adexAnalyse(islands, cssImports),
    adexBundle(islands),
    adexStyles(cssCodeMap),
    resolveDevModuleGraph(cssImports, cssCodeMap),
  ]
}

/**
 * @returns {import("vite").Plugin}
 */
function adexServer(devServer) {
  return {
    name: 'adex-server',
    enforce: 'post',
    apply: 'serve',
    config() {
      return {
        appType: 'custom',
      }
    },
    configureServer(_server) {
      devServer = _server
      return () => {
        _server.middlewares.use(async (req, res, next) => {
          try {
            const mod = await devServer
              .ssrLoadModule('virtual:adex:server-entry', {
                fixStacktrace: true,
              })
              .then(mod => ('default' in mod ? mod.default : mod))
            await mod(req, res, next)

            if (!res.writableEnded) {
              res.statusCode = 404
              return res.end()
            }
          } catch (error) {
            // Forward the error to Vite
            next(error)
          }
        })
      }
    },
  }
}

/**
 * @param {Map<string,any>} islands
 * @param {Set<string>} cssImports
 * @returns {import("vite").Plugin}
 */
function adexAnalyse(islands, cssImports) {
  let currentConfig
  const rawVirtualId = getIslandVirtualName('')
  return {
    name: 'adex-analyse',
    enforce: 'pre',
    configResolved(config) {
      currentConfig = config
    },
    async resolveId(id, importer) {
      if (id.endsWith('.css')) {
        const existingCSSImports = cssImports.get(importer) || new Set()
        const resolved = await this.resolve(id, importer)
        if (!resolved) return
        existingCSSImports.add(resolved.id)
        cssImports.set(importer, existingCSSImports)
        return
      }
      if (!(id.startsWith(rawVirtualId) && id.startsWith('/' + rawVirtualId)))
        return
      return id
    },
    async load(id, env) {
      if (id.indexOf(rawVirtualId) === 0) {
        return id
      }

      const normalizedId = id.replace(/^\//, '').replace(rawVirtualId, '')
      const hasIsland = islands.get(normalizedId)

      if (!hasIsland) return

      return transformWithEsbuild(hasIsland.template, id, {
        jsx: 'automatic',
        jsxImportSource: 'preact',
      })
    },
    async transform(source, id, ctx) {
      if (!ctx.ssr) return

      const extension = extname(normalizePath(id))
      if (!JS_EXTENSIONS.includes(extension)) return

      let islandsInCode = []
      try {
        islandsInCode = findIslands(source, {
          isFunctionIsland: ast =>
            isFunctionIsland(ast, {
              transpiledIdentifiers:
                DEFAULT_TRANSPILED_IDENTIFIERS.concat('_jsxDEV'),
            }),
        })
      } catch (err) {}

      if (!islandsInCode.length) return

      islandsInCode.forEach(island => {
        injectIslandAST(island.ast, island)
        const addImport = addImportToAST(island.ast)
        addImport('h', 'preact', { named: true })
        addImport('Fragment', 'preact', { named: true })

        let clientTemplate = generateClientTemplate(island.id)
        clientTemplate = clientTemplate.replace('<~~{importPath}~~>', `${id}`)
        islands.set(island.id, {
          ...island,
          virtualName: getIslandVirtualName(island.id),
          template: clientTemplate,
        })
      })

      let code = codeFromAST(islandsInCode[0].ast)

      islandsInCode.forEach(island => {
        if (currentConfig.mode === 'development') {
          code = code.replace(
            `<~{${island.id}}~>`,
            `/${getIslandVirtualName(island.id)}`
          )
        } else {
          code = code.replace(`<~{${island.id}}~>`, `/${island.id}.js`)
        }
      })

      return {
        code,
      }
    },
  }
}

/**
 * @param {Map<string,unknown>} islands
 * @returns {import("vite").Plugin}
 */
function adexBundle(islands) {
  const directories = {
    client: 'dist/client',
    server: 'dist/server',
  }
  return {
    name: 'adex-bundle',
    apply: 'build',
    enforce: 'post',
    config() {
      return {
        appType: 'custom',
        define: {
          __ADEX_CLIENT_BUILD_OUTPUT_DIR: JSON.stringify(directories.client),
          __ADEX_SERVER_BUILD_OUTPUT_DIR: JSON.stringify(directories.server),
        },
        build: {
          copyPublicDir: true,
          outDir: directories.server,
          ssr: true,
          manifest: 'manifest.json',
          ssrManifest: 'ssr.manifest.json',
          ssrEmitAssets: true,
          target: 'node18',
          rollupOptions: {
            input: {
              index: 'virtual:adex:runner-entry',
            },
            external: ['adex/utils', 'preact'],
          },
        },
      }
    },
    async closeBundle() {
      await mkdir('dist/client/assets', { recursive: true })

      if (!islands.size) {
        fs.existsSync('dist/.client-assets') &&
          (await fs.promises.cp('dist/.client-assets', 'dist/client/assets', {
            recursive: true,
          }))
        return
      }

      const asInputs = Object.fromEntries(
        Array.from(islands.entries()).map(([k, v]) => {
          return [k, `virtual:adex:__island:${v.id}`]
        })
      )

      await build({
        plugins: [
          adexIslandVirtuals(islands),
          preact(),
          {
            name: 'adex-style-copier',
            async closeBundle() {
              fs.existsSync('dist/.client-assets') &&
                (await fs.promises.cp(
                  'dist/.client-assets',
                  'dist/client/assets',
                  {
                    recursive: true,
                  }
                ))
            },
          },
        ],
        configFile: false,
        build: {
          outDir: 'dist/client',
          ssr: false,
          target: 'esnext',
          manifest: true,
          ssrManifest: 'manifest.json',
          rollupOptions: {
            input: asInputs,
            output: {
              entryFileNames: '[name].js',
              format: 'esm',
            },
          },
        },
      })
    },
  }
}

/**
 * @param {Map<string,unknown>} islands
 */
function adexIslandVirtuals(islands) {
  const virtualIslands = Object.fromEntries(
    Array.from(islands.entries()).map(([k, v]) => [
      getIslandVirtualName(v.id),
      v.template,
    ])
  )
  const rawVirtualId = getIslandVirtualName('')
  return {
    name: 'adex-island-virtuals',
    enforce: 'pre',
    resolveId(id) {
      if (!id.includes(rawVirtualId)) return
      return id
    },
    load(id) {
      if (!(id in virtualIslands)) {
        return
      }

      return transformWithEsbuild(virtualIslands[id], id, {
        jsx: 'automatic',
        jsxImportSource: 'preact',
        jsxFactory: 'h',
        jsxFragment: 'Fragment',
      })
    },
  }
}

function getIslandVirtualName(name) {
  return `virtual:adex:__island:${name}`
}

/**
 * @param {Set<string>} cssCodeMap
 * @return {import("vite").Plugin}
 */
function adexStyles(cssCodeMap) {
  let resolvedConfig
  return {
    name: 'adex-styles',
    enforce: 'post',
    configResolved(config) {
      resolvedConfig = config
    },
    resolveId(id, importer) {
      if (id.endsWith('.css')) {
        return this.resolve(id, importer)
      }
    },
    transform(code, id, env) {
      if (!id.endsWith('.css')) return
      if (resolvedConfig.mode === 'development') return
      const justCSS = code
        .replace('export default "', '')
        .replace(/["]$/, '')
        .replace(/\\\\n/gm, '')
        .replace(/\\n/gm, '')
      const minifiedCode = cssTransform({
        filename: id,
        code: Buffer.from(justCSS),
        minify: true,
        sourmap: true,
      })
      cssCodeMap.set(id, minifiedCode.code.toString())
      return {
        code,
      }
    },
  }
}

/**
 * @param {Set<string>} cssImports
 * @param {Set<string>} cssCodeMap
 * @return {import("vite").Plugin}
 */
function resolveDevModuleGraph(cssImports, cssCodeMap) {
  const moduleId = 'virtual:adex:dev-module-graph'
  let resolvedConfig
  return {
    name: 'adex-dev-module-graph',
    enforce: 'post',
    apply: 'serve',
    configResolved(config) {
      resolvedConfig = config
    },
    async resolveId(id) {
      if (id === moduleId || id === '/' + moduleId) {
        return moduleId
      }
    },
    async load(id) {
      if (id === moduleId) {
        const importEntries = Object.fromEntries(cssImports.entries())

        const obj = Object.fromEntries(
          Object.entries(importEntries).map(([k, v]) => {
            const key = k.replace(join(resolvedConfig.root, 'src/pages'), '')
            if (v instanceof Set) {
              return [key, Array.from(v.entries()).map(x => x[1])]
            }
            return [key, v]
          })
        )

        const cssMap = Object.fromEntries(cssCodeMap.entries())

        return `
          export const graph = ${JSON.stringify(obj)}
          export const css =  ${JSON.stringify(cssMap)}
        `
      }
    },
  }
}
