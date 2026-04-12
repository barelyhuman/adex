// Dev-mode Vite plugin for the Deno adapter.
// Vite's dev server always runs on Node.js, so this file uses Node-only APIs
// (adex/http bridge, node:path) and is never imported in the Deno production runtime.

import { nodeRequestToFetch, fetchResponseToNode } from 'adex/http'
import { resolve } from 'node:path'

/**
 * Creates the Vite dev server plugin for the Deno adapter.
 * Even though the production target is Deno, the dev server is always
 * Node.js (Vite), so we use the same Node ↔ Fetch bridge as the node adapter.
 *
 * @param {{ islands: boolean }} options
 * @returns {import('vite').Plugin}
 */
export function createDenoDevServerPlugin({ islands = false } = {}) {
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
            const fetchRequest = await nodeRequestToFetch(req)
            const response = await module.handler(fetchRequest)
            const pageRoute = response.headers.get('x-adex-page-route')

            if (!pageRoute) {
              // API response or 404 — write directly to node res
              await fetchResponseToNode(response, res)
              return
            }

            // Page response — inject dev CSS preload links + HMR client script
            const cssLinks = devCSSMap.get(pageRoute) ?? []
            let html = await response.text()

            html = html.replace(
              '</head>',
              `
              <link rel="preload" href="/virtual:adex:global.css" as="style" onload="this.rel='stylesheet'" />
              ${cssLinks
                .map(
                  d =>
                    `<link rel="preload" href="/${d}" as="style" onload="this.rel='stylesheet'"/>`
                )
                .join('')}
              </head>`
            )

            if (!islands) {
              html = html.replace(
                '</body>',
                `<script type='module' src="/virtual:adex:client"></script></body>`
              )
            }

            const finalHTML = await server.transformIndexHtml(req.url, html)
            res.setHeader('content-type', 'text/html')
            res.write(finalHTML)
            res.end()
          } catch (err) {
            server.ssrFixStacktrace(err)
            next(err)
          }
        })
      }
    },
  }
}
