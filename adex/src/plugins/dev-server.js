import { resolve } from 'path'

/**
 * Create a development server plugin
 *
 * @param {object} options - Configuration options
 * @param {boolean} [options.islands=false] - Whether to enable islands architecture
 * @returns {import("vite").Plugin}
 */
export function createDevServer({ islands = false } = {}) {
  const devCSSMap = new Map()
  let cfg

  return {
    name: 'adex-dev-server',
    apply: 'serve',
    enforce: 'pre',

    config() {
      return {
        ssr: {
          noExternal: ['adex/app'],
        },
      }
    },

    configResolved(_cfg) {
      cfg = _cfg
    },

    async resolveId(id, importer, meta) {
      if (id.endsWith('.css')) {
        if (!importer) return
        const importerFromRoot = importer.replace(resolve(cfg.root), '')
        const resolvedCss = await this.resolve(id, importer, meta)
        if (resolvedCss) {
          devCSSMap.set(
            importerFromRoot,
            (devCSSMap.get(importer) ?? []).concat(resolvedCss.id)
          )
        }
        return
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
            const { html, serverHandler, pageRoute } = await module.handler(
              req,
              res
            )

            if (serverHandler) {
              return serverHandler(req, res)
            }

            const cssLinks = devCSSMap.get(pageRoute) ?? []
            let renderedHTML = html.replace(
              '</head>',
              `
              <link rel="preload" href="/virtual:adex:global.css" as="style" onload="this.rel='stylesheet'" />
              ${cssLinks.map(d => {
                return `<link rel="preload" href="/${d}" as="style" onload="this.rel='stylesheet'"/>`
              })}
              </head>
            `
            )

            if (!islands) {
              renderedHTML = html.replace(
                '</body>',
                `<script type='module' src="/virtual:adex:client"></script></body>`
              )
            }

            const finalRenderedHTML = await server.transformIndexHtml(
              req.url,
              renderedHTML
            )

            res.setHeader('content-type', 'text/html')
            res.write(finalRenderedHTML)
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
