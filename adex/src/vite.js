import {
  DEFAULT_TRANSPILED_IDENTIFIERS,
  IMPORT_PATH_PLACEHOLDER,
  findIslands,
  generateClientTemplate,
  getIslandName,
  getServerTemplatePlaceholder,
  injectIslandAST,
  isFunctionIsland,
  readSourceFile,
} from '@dumbjs/preland'
import { addImportToAST, codeFromAST } from '@dumbjs/preland/ast'
import preact from '@preact/preset-vite'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { readFile, rm } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { build, mergeConfig } from 'vite'
import { fonts as addFontsPlugin } from './fonts.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const cwd = process.cwd()
const islandsDir = join(cwd, '.islands')
let runningIslandBuild = false

/**
 * Resolve the adapter, defaulting to adex-adapter-node if none is provided.
 * Cached after first resolution so it is only imported once per Vite session.
 * Throws a clear, actionable error if the default cannot be found.
 * @param {import("./vite.js").AdapterConfig | undefined} adapter
 * @returns {Promise<import("./vite.js").AdapterConfig>}
 */
async function ensureAdapter(adapter) {
  if (adapter) return adapter
  try {
    const mod = await import('adex-adapter-node')
    return mod.node()
  } catch {
    throw new Error(
      "[adex] No adapter was provided and 'adex-adapter-node' could not be found.\n" +
        'Install it:       npm add adex-adapter-node\n' +
        'Or pass it explicitly:  adex({ adapter: node() })'
    )
  }
}

/**
 * Creates a proxy Vite plugin that forwards all dev-server hooks to the
 * adapter's devServerPlugin. The adapter is resolved lazily on first use so
 * that the default (adex-adapter-node) can be imported asynchronously when no
 * adapter is explicitly provided.
 *
 * @param {{ adapter: import("./vite.js").AdapterConfig | undefined, islands: boolean }} options
 * @returns {import("vite").Plugin}
 */
function createAdapterDevServerPlugin({ adapter, islands }) {
  /** @type {import("vite").Plugin | null} */
  let inner = null

  async function getInner() {
    if (inner) return inner
    const resolved = await ensureAdapter(adapter)
    inner = resolved.devServerPlugin({ islands })
    return inner
  }

  return {
    name: 'adex-adapter-dev-server',
    apply: 'serve',
    enforce: 'pre',
    async config(...args) {
      const p = await getInner()
      return p.config?.call(this, ...args)
    },
    async configResolved(...args) {
      const p = await getInner()
      return p.configResolved?.call(this, ...args)
    },
    async resolveId(...args) {
      const p = await getInner()
      return p.resolveId?.call(this, ...args)
    },
    configureServer(server) {
      // configureServer must return a function (or void) synchronously in
      // Vite's plugin contract, but the return value can itself be async.
      return async () => {
        const plugin = await getInner()
        const result = plugin.configureServer?.call(this, server)
        if (typeof result === 'function') await result()
      }
    },
  }
}

/**
 * @param {import("./vite.js").AdexOptions} [options]
 * @returns {(import("vite").Plugin)[]}
 */
export function adex({ fonts, islands = false, ssr = true, adapter } = {}) {
  // @ts-expect-error probably because of the `.filter`
  return [
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
      'src/global.css'
    ),
    createUserDefaultVirtualModule(
      'virtual:adex:client',
      readFileSync(join(__dirname, '../runtime/client.js'), 'utf8'),
      '/src/_app'
    ),
    createVirtualModule(
      'adex/app',
      readFileSync(join(__dirname, '../runtime/app.js'), 'utf8')
    ),
    createVirtualModule(
      'virtual:adex:handler',
      readFileSync(join(__dirname, '../runtime/handler.js'), 'utf8')
    ),
    // virtual:adex:server — content is adapter-owned, resolved lazily so the
    // default adapter (adex-adapter-node) can be imported async if not provided.
    {
      name: 'adex-virtual-server-entry',
      enforce: 'pre',
      resolveId(id) {
        if (id === 'virtual:adex:server' || id === '/virtual:adex:server') {
          return '\0virtual:adex:server'
        }
      },
      async load(id) {
        if (id !== '\0virtual:adex:server') return
        const resolved = await ensureAdapter(adapter)
        return resolved.serverEntry({ islands })
      },
    },
    addFontsPlugin(fonts),
    // Dev-server plugin — adapter-owned. If no adapter is given, the default
    // (adex-adapter-node) is resolved async on first hook invocation.
    // We wrap it in a proxy plugin so all hooks (config, configResolved,
    // resolveId, configureServer) are forwarded to the real plugin object.
    createAdapterDevServerPlugin({ adapter, islands }),
    adexBuildPrep({ islands }),
    adexClientBuilder({ ssr, islands }),
    islands && adexIslandsBuilder(),

    // SSR/Render Server Specific plugins
    ssr && adexServerBuilder({ fonts, adapter, islands }),
  ].filter(Boolean)
}

/**
 * @returns {import("vite").Plugin}
 */
function adexClientBuilder({ ssr = true, islands = false } = {}) {
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
        // @ts-expect-error invalid types by vite? figure this out
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
 * @returns {import("vite").Plugin}
 */
function adexBuildPrep({ islands = false }) {
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

/**
 * @returns {import("vite").Plugin[]}
 */
function adexIslandsBuilder() {
  const clientVirtuals = {}
  let isBuild = false
  let outDir
  return [
    {
      name: 'adex-islands',
      enforce: 'pre',
      config(d, e) {
        outDir = d.build?.outDir ?? 'dist'
        isBuild = e.command === 'build'
      },
      transform(code, id, viteEnv) {
        if (!/\.(js|ts)x$/.test(id)) return

        // if being imported by the client, don't send
        // back the transformed server code, send the
        // original component
        if (!viteEnv?.ssr) return

        const islands = findIslands(readSourceFile(id), {
          isFunctionIsland: node =>
            isFunctionIsland(node, {
              transpiledIdentifiers:
                DEFAULT_TRANSPILED_IDENTIFIERS.concat('_jsxDEV'),
            }),
        })
        if (!islands.length) return

        islands.forEach(node => {
          //@ts-expect-error FIX: in preland
          injectIslandAST(node.ast, node)
          const clientCode = generateClientTemplate(node.id).replace(
            IMPORT_PATH_PLACEHOLDER,
            id
          )

          mkdirSync(islandsDir, { recursive: true })
          writeFileSync(
            join(islandsDir, getIslandName(node.id) + '.js'),
            clientCode,
            'utf8'
          )

          clientVirtuals[node.id] = clientCode
        })

        const addImport = addImportToAST(islands[0].ast)
        addImport('h', 'preact', { named: true })
        addImport('Fragment', 'preact', { named: true })

        let serverTemplateCode = codeFromAST(islands[0].ast)
        islands.forEach(island => {
          serverTemplateCode = serverTemplateCode.replace(
            getServerTemplatePlaceholder(island.id),
            !isBuild
              ? `/virtual:adex:island-${island.id}`
              : `/islands/${getIslandName(island.id) + '.js'}`
          )
        })

        return {
          code: serverTemplateCode,
        }
      },
    },
    {
      name: 'adex-island-builds',
      enforce: 'post',
      writeBundle: {
        sequential: true,
        async handler() {
          if (Object.keys(clientVirtuals).length === 0) return
          if (runningIslandBuild) return

          await build(
            mergeConfig(
              {},
              {
                configFile: false,
                plugins: [preact()],
                build: {
                  ssr: false,
                  outDir: join(outDir, 'islands'),
                  emptyOutDir: true,
                  rollupOptions: {
                    output: {
                      format: 'esm',
                      entryFileNames: '[name].js',
                    },
                    input: Object.fromEntries(
                      Object.entries(clientVirtuals).map(([k, v]) => {
                        const key = getIslandName(k)
                        return [key, join(islandsDir, key + '.js')]
                      })
                    ),
                  },
                },
              }
            )
          )
        },
      },
    },
    {
      name: 'adex-island-virtuals',
      resolveId(id) {
        if (
          id.startsWith('virtual:adex:island') ||
          id.startsWith('/virtual:adex:island')
        ) {
          return `\0${id}`
        }
      },
      load(id) {
        if (
          (id.startsWith('\0') && id.startsWith('\0virtual:adex:island')) ||
          id.startsWith('\0/virtual:adex:island')
        ) {
          const compName = id
            .replace('\0', '')
            .replace(/\/?(virtual\:adex\:island\-)/, '')

          if (clientVirtuals[compName]) {
            return {
              code: clientVirtuals[compName],
            }
          }
        }
      },
    },
  ]
}

/**
 * @returns {import("vite").Plugin}
 */
export function createVirtualModule(id, content) {
  return {
    name: `adex-virtual-${id}`,
    enforce: 'pre',
    resolveId(requestId) {
      if (requestId === id || requestId === '/' + id) {
        return `\0${id}`
      }
    },
    load(requestId) {
      if (requestId === `\0${id}`) {
        return content
      }
    },
  }
}

/**
 * @returns {import("vite").Plugin}
 */
function createUserDefaultVirtualModule(id, content, userPath) {
  return {
    name: `adex-virtual-user-default-${id}`,
    enforce: 'pre',
    async resolveId(requestId) {
      if (
        requestId === id ||
        requestId === '/' + id ||
        requestId === userPath
      ) {
        const userPathResolved = await this.resolve(userPath)
        return userPathResolved ?? `\0${id}`
      }
    },
    load(requestId) {
      if (requestId === `\0${id}`) {
        return content
      }
    },
  }
}

/**
 * @param {object} options
 * @param {import('vite').UserConfig} options.config
 * @returns {import("vite").Plugin}
 */
function adexClientSSRBuilder(opts) {
  let options
  return {
    name: 'adex-client',
    enforce: 'post',
    config(conf) {
      return {
        appType: 'custom',
        build: {
          outDir: join(conf.build.outDir ?? 'dist', 'client'),
          emptyOutDir: true,
          ssr: false,
          manifest: 'manifest.json',
          rollupOptions: {
            input: {
              index: 'virtual:adex:client',
            },
            output: {
              entryFileNames: '[name]-[hash].js',
              format: 'esm',
            },
          },
        },
      }
    },
    configResolved(config) {
      options = config
    },
    closeBundle() {
      // process.nextTick(async () => {
      //   const usablePlugins = options.plugins
      //     .filter(d => !d.name.startsWith('vite:'))
      //     .filter(d => !d.name.startsWith('adex-') || d.name === 'adex-fonts')
      // await build(
      //   mergeConfig(opts, {
      //     plugins: [
      // ...usablePlugins,
      // createVirtualModule(
      //   'virtual:adex:client',
      //   readFileSync(join(__dirname, '../runtime/client.js'), 'utf8')
      // ),
      // createUserDefaultVirtualModule(
      //   'virtual:adex:index.html',
      //   '',
      //   'src/index.html'
      // ),
      // preact({ prefreshEnabled: false }),
      // ],
      // build: {
      //   outDir: 'dist/client',
      //   emptyOutDir: true,
      //   ssr: false,
      //   manifest: 'manifest.json',
      //   rollupOptions: {
      //     input: {
      //       index: 'virtual:adex:client',
      //     },
      //     output: {
      //       entryFileNames: '[name]-[hash].js',
      //       format: 'esm',
      //     },
      //   },
      // },
      // })
      // )
      // })
    },
  }
}

/**
 * @param {object} options
 * @param {import("./fonts.js").Options} options.fonts
 * @param {import("./vite.js").AdapterConfig} options.adapter
 * @param {boolean} options.islands
 * @returns {import("vite").Plugin}
 */
function adexServerBuilder({ fonts, adapter, islands }) {
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

      const sanitizedPlugins = (cfg.plugins ?? [])
        .filter(d => d.adexServer === false)
        .filter(d => !d.name.startsWith('vite:'))
        .filter(d => !d.name.startsWith('adex-'))

      await build({
        configFile: false,
        ssr: {
          external: ['preact', 'adex', 'preact-render-to-string'],
          noExternal: adapter?.name ? [adapter.name] : [],
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
            readFileSync(join(__dirname, '../runtime/app.js'), 'utf8')
          ),
          createUserDefaultVirtualModule(
            'virtual:adex:client',
            readFileSync(join(__dirname, '../runtime/client.js'), 'utf8'),
            '/src/_app'
          ),
          createVirtualModule(
            'virtual:adex:handler',
            readFileSync(join(__dirname, '../runtime/handler.js'), 'utf8')
          ),
          // virtual:adex:server — delegate to adapter.serverEntry() so adapters
          // own their own bootstrap code. ensureAdapter() handles the default.
          {
            name: 'adex-virtual-server-entry',
            enforce: 'pre',
            resolveId(id) {
              if (
                id === 'virtual:adex:server' ||
                id === '/virtual:adex:server'
              ) {
                return '\0virtual:adex:server'
              }
            },
            async load(id) {
              if (id !== '\0virtual:adex:server') return
              const resolved = await ensureAdapter(adapter)
              return resolved.serverEntry({ islands })
            },
          },
          // Emit adex.manifest.json into the server output so the adapter
          // kernel knows at runtime whether a client bundle was built.
          {
            name: 'adex-manifest-sidecar',
            generateBundle() {
              this.emitFile({
                type: 'asset',
                fileName: 'adex.manifest.json',
                source: JSON.stringify({
                  client: {
                    bundle: !islands,
                    islands: !!islands,
                    manifestPath: '../client/manifest.json',
                    outDir: '../client',
                  },
                }),
              })
            },
          },
          addFontsPlugin(fonts),
          islands && adexIslandsBuilder(),
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

/**
 * @returns {import("vite").Plugin[]}
 */
function adexGuards() {
  return [
    {
      name: 'adex-guard-env',
      enforce: 'pre',
      async transform(code, id) {
        // ignore usage of `process.env` in node_modules
        // Still risky but hard to do anything about
        const nodeMods = resolve(cwd, 'node_modules')
        if (id.startsWith(nodeMods)) return

        // ignore usage of `process.env` in `adex/env`
        const envLoadId = await this.resolve('adex/env')
        if (id === envLoadId?.id) return

        if (code.includes('process.env')) {
          this.error(
            'Avoid using `process.env` to access environment variables and secrets. Use `adex/env` instead'
          )
        }
      },
      writeBundle() {
        const pagesPath = resolve(cwd, 'src/pages')
        const info = this.getModuleInfo('adex/env')
        const viteRef = this

        function checkTree(importPath, importStack = []) {
          if (importPath.startsWith(pagesPath)) {
            throw new Error(
              `Cannot use/import \`adex/env\` on the client side, importerStack: ${importStack.join(' -> ')}`
            )
          }
          viteRef
            .getModuleInfo(importPath)
            .importers.forEach(d =>
              checkTree(d, [...importStack, importPath, d])
            )
        }
        if (info) {
          info.importers.forEach(i => checkTree(i))
        }
      },
    },
  ]
}

/**
 * @returns {import("vite").Plugin}
 */
function preactPages({
  root = '/src/pages',
  id: virtualId = '~routes',
  extensions = ['js', 'ts', 'tsx', 'jsx'],
  replacer = '',
} = {}) {
  return {
    name: 'adex-routes',
    enforce: 'pre',
    resolveId(id) {
      if (id !== virtualId) {
        return
      }
      return `/0${virtualId}`
    },
    async load(id) {
      if (id !== `/0${virtualId}`) {
        return
      }

      const extsString = extensions.join(',')
      const code = (
        await readFile(join(__dirname, '../runtime/pages.js'), 'utf8')
      )
        .replaceAll('#{__PLUGIN_PAGES_ROOT}', root + `/**/*.{${extsString}}`)
        .replaceAll('#{__PLUGIN_PAGES_ROOT_REGEX}', `^${root}`)
        .replaceAll('#{__PLUGIN_PAGES_ROOT_REGEX_REPLACER}', replacer)

      return {
        code,
      }
    },
  }
}
