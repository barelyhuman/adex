import preact from '@preact/preset-vite'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { build } from 'vite'
import { fonts as addFontsPlugin } from './fonts.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * @param {import("./vite").AdexOptions} [options]
 * @returns
 */
export function adex({ fonts } = {}) {
  return [
    createUserDefaultVirtualModule(
      'virtual:adex:global.css',
      '',
      'src/global.css'
    ),
    createVirtualModule(
      'virtual:adex:handler',
      readFileSync(join(__dirname, '../runtime/handler.js'), 'utf8')
    ),
    createVirtualModule(
      'virtual:adex:server',
      readFileSync(join(__dirname, '../runtime/server.js'), 'utf8')
    ),
    createVirtualModule(
      'virtual:adex:client',
      readFileSync(join(__dirname, '../runtime/client.js'), 'utf8')
    ),
    fonts && Object.keys(fonts).length > 0 && addFontsPlugin(fonts),
    adexServerBuilder(),
    adexClientBuilder(),
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
 * @returns {import("vite").Plugin}
 */
function adexClientBuilder() {
  let options
  return {
    name: 'adex-client',
    enforce: 'post',
    configResolved(config) {
      options = config
    },
    closeBundle() {
      process.nextTick(async () => {
        const usablePlugins = options.plugins
          .filter(d => !d.name.startsWith('vite:'))
          .filter(d => !d.name.startsWith('adex-') || d.name === 'adex-fonts')
        await build({
          configFile: false,
          appType: 'custom',
          base: '/client',
          plugins: [
            ...usablePlugins,
            createVirtualModule(
              'virtual:adex:client',
              readFileSync(join(__dirname, '../runtime/client.js'), 'utf8')
            ),
            createUserDefaultVirtualModule(
              'virtual:adex:index.html',
              '',
              'src/index.html'
            ),
            createUserDefaultVirtualModule(
              'virtual:adex:global.css',
              '',
              'src/global.css'
            ),
            preact(),
          ],
          build: {
            outDir: 'dist/client',
            ssr: false,
            target: 'esnext',
            manifest: 'manifest.json',
            rollupOptions: {
              input: {
                index: 'virtual:adex:client',
              },
              output: {
                entryFileNames: '[name].js',
                format: 'esm',
              },
            },
          },
        })
      })
    },
  }
}

/**
 * @returns {import("vite").Plugin}
 */
function adexServerBuilder() {
  let input = 'src/entry-server.js'
  return {
    name: `adex-server`,
    enforce: 'pre',
    /**
     * @returns {import("vite").UserConfig}
     */
    config(conf, env) {
      if (env.command === 'build') {
        input = 'virtual:adex:server'
      }
      return {
        appType: 'custom',
        ssr: {
          external: ['preact', 'adex', 'preact-render-to-string'],
        },
        build: {
          assetsDir: 'assets',
          ssrEmitAssets: true,
          ssr: true,
          manifest: 'manifest.json',
          ssrManifest: 'ssr.manifest.json',
          outDir: 'dist/server',
          rollupOptions: {
            input: {
              index: input,
            },
          },
        },
      }
    },
    configureServer(server) {
      return () => {
        server.middlewares.use(async function (req, res, next) {
          const module = await server.ssrLoadModule('virtual:adex:handler')
          if (!module) {
            return next()
          }
          try {
            const { html, serverHandler } = await module.handler(req, res)
            if (serverHandler) {
              return serverHandler(req, res)
            }
            let withScripts = html.replace(
              '</body>',
              `<script type='module' src="/virtual:adex:client"></script></body>`
            )
            const finalHTML = await server.transformIndexHtml(
              req.url,
              withScripts
            )
            res.setHeader('content-type', 'text/html')
            res.write(finalHTML)
            return res.end()
          } catch (err) {
            server.ssrFixStacktrace(err)
            next(err)
          }
        })
      }
    },
  }
}
