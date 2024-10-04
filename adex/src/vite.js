import preact from '@preact/preset-vite'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { build } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function adex() {
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
    adexServerBuilder(),
    adexClientBuilder(),
  ]
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
function createVirtualModule(id, content) {
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
function adexClientBuilder() {
  return {
    name: 'adex-client',
    enforce: 'post',
    closeBundle() {
      process.nextTick(async () => {
        await build({
          configFile: false,
          appType: 'custom',
          plugins: [
            createVirtualModule(
              'virtual:adex:client',
              readFileSync(join(__dirname, '../runtime/client.js'), 'utf8')
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
  let options
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
          external: ['preact', 'adex'],
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
    configResolved(config) {
      options = config
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
