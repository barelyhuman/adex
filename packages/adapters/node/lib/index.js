import { existsSync } from 'node:fs'
import http from 'node:http'
import { resolve } from 'node:path'

let islandMode = false

/**
 * Convert a Node.js IncomingMessage to a Fetch API Request.
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<Request>}
 */
async function nodeRequestToFetch(req) {
  const protocol = req.socket?.encrypted ? 'https' : 'http'
  const host = req.headers['host'] ?? 'localhost'
  const url = new URL(req.url, `${protocol}://${host}`)

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v)
    } else if (value != null) {
      headers.set(key, value)
    }
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  let body = undefined
  if (hasBody) {
    body = await new Promise((resolve, reject) => {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => resolve(Buffer.concat(chunks)))
      req.on('error', reject)
    })
  }

  return new Request(url.href, {
    method: req.method,
    headers,
    body: body ?? null,
  })
}

/**
 * Write a Fetch API Response to a Node.js ServerResponse.
 * Skips x-adex-* internal headers.
 * @param {Response} response
 * @param {import('node:http').ServerResponse} res
 * @returns {Promise<void>}
 */
async function fetchResponseToNode(response, res) {
  res.statusCode = response.status
  for (const [key, value] of response.headers.entries()) {
    if (key.startsWith('x-adex-')) continue
    res.setHeader(key, value)
  }
  if (response.body) {
    const buf = Buffer.from(await response.arrayBuffer())
    res.write(buf)
  }
  res.end()
}

/**
 * Adapter factory — pass to adex({ adapter: node() }) in vite.config.js
 * Returns an AdapterConfig object the core framework uses at build time.
 * @param {import('./index.d.ts').NodeAdapterOptions} [options]
 * @returns {import('./index.d.ts').AdapterConfig}
 */
export function node(options = {}) {
  return {
    name: 'adex-adapter-node',
    module: 'adex-adapter-node',
    devServerPlugin({ islands }) {
      return createNodeDevServerPlugin({ islands })
    },
  }
}

/**
 * Creates the Vite dev server plugin for the node adapter.
 * This is the relocated + updated equivalent of the old adexDevServer plugin
 * that used to live in adex/src/vite.js. It owns how requests are served
 * in dev mode for a Node.js environment.
 *
 * @param {{ islands: boolean }} options
 * @returns {import('vite').Plugin}
 */
function createNodeDevServerPlugin({ islands = false } = {}) {
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

/**
 * @param {{ manifests: object, paths: object, client: import('./index.d.ts').AdapterClientInfo }} adexConfig
 */
async function createHandler({
  manifests,
  paths,
  client = { bundle: true, islands: false },
}) {
  const { sirv, useMiddleware } = await import('adex/ssr')
  // @ts-expect-error injected by vite
  const { handler } = await import('virtual:adex:handler')

  const serverAssets = sirv(paths.assets, {
    maxAge: 31536000,
    immutable: true,
    onNoMatch: defaultHandler,
  })

  let islandsWereGenerated = client.islands && existsSync(paths.islands)

  // @ts-ignore
  let islandAssets = (req, res, next) => {
    next()
  }

  if (islandsWereGenerated) {
    islandMode = true
    islandAssets = sirv(paths.islands, {
      maxAge: 31536000,
      immutable: true,
      onNoMatch: defaultHandler,
    })
  }

  let clientWasGenerated = client.bundle && existsSync(paths.client)

  // @ts-ignore
  let clientAssets = (req, res, next) => {
    next()
  }

  if (clientWasGenerated) {
    clientAssets = sirv(paths.client, {
      maxAge: 31536000,
      immutable: true,
      onNoMatch: defaultHandler,
    })
  }

  async function defaultHandler(req, res) {
    const fetchRequest = await nodeRequestToFetch(req)
    const response = await handler(fetchRequest)
    const pageRoute = response.headers.get('x-adex-page-route')

    if (!pageRoute) {
      // API response or 404 — write directly
      await fetchResponseToNode(response, res)
      return
    }

    // Page response — inject manifest CSS/JS assets
    const html = await response.text()
    const finalHTML = addDependencyAssets(
      html,
      pageRoute,
      manifests.server,
      manifests.client
    )
    res.setHeader('content-type', 'text/html')
    res.write(finalHTML)
    res.end()
  }

  return useMiddleware(
    async (req, res, next) => {
      // @ts-expect-error shared-state between the middlewares
      req.__originalUrl = req.url
      // @ts-expect-error shared-state between the middlewares
      req.url = req.__originalUrl.replace(/(\/?assets\/?)/, '/')
      return serverAssets(req, res, next)
    },
    async (req, res, next) => {
      // @ts-expect-error shared-state between the middlewares
      req.url = req.__originalUrl.replace(/(\/?islands\/?)/, '/')
      return islandAssets(req, res, next)
    },
    async (req, res, next) => {
      return clientAssets(req, res, next)
    },
    async (req, res) => {
      // @ts-expect-error shared-state between the middlewares
      req.url = req.__originalUrl
      return defaultHandler(req, res)
    }
  )
}

function manifestToHTML(manifest, filePath) {
  let links = []
  let scripts = []

  const rootServerFile = 'virtual:adex:server'
  if (manifest[rootServerFile]) {
    const graph = manifest[rootServerFile]
    links = links.concat(
      (graph.css || []).map(
        d =>
          `<link
            rel="stylesheet"
            href="/${d}"
          />`
      )
    )
  }

  const rootClientFile = 'virtual:adex:client'
  if (!islandMode && manifest[rootClientFile]) {
    const graph = manifest[rootClientFile]
    links = links.concat(
      (graph.css || []).map(
        d =>
          `<link
            rel="stylesheet"
            href="/${d}"
          />`
      )
    )
  }

  if (manifest[filePath]) {
    const graph = manifest[filePath]
    links = links.concat(
      (graph.css || []).map(
        d =>
          `<link
            rel="stylesheet"
            href="/${d}"
          />`
      )
    )
    const depsHasCSS = (manifest[filePath].imports || [])
      .map(d => manifest[d])
      .filter(d => d.css?.length)

    if (depsHasCSS.length) {
      links = links.concat(
        depsHasCSS.map(d =>
          d.css
            .map(
              p =>
                `<link
          rel="stylesheet"
          href="/${p}"
        />`
            )
            .join('\n')
        )
      )
    }

    scripts = scripts.concat(
      `<script src="${manifest[filePath].file}" type="module"></script>`
    )
  }
  return {
    scripts,
    links,
  }
}

function addDependencyAssets(
  template,
  pageRoute,
  serverManifest,
  clientManifest
) {
  if (!pageRoute) {
    return template
  }

  const filePath = pageRoute.startsWith('/') ? pageRoute.slice(1) : pageRoute

  const { links: serverLinks } = manifestToHTML(serverManifest, filePath)

  const { links: clientLinks, scripts: clientScripts } = manifestToHTML(
    clientManifest,
    filePath
  )

  const links = [...serverLinks, ...clientLinks]
  const scripts = [...clientScripts]

  return template.replace(
    '</head>',
    links.join('\n') + scripts.join('\n') + '</head>'
  )
}

export const createServer = ({
  port = '3000',
  host = '127.0.0.1',
  adex = {
    manifests: {
      server: {},
      client: {},
    },
    paths: {},
    client: { bundle: true, islands: false },
  },
} = {}) => {
  // createHandler is async (uses dynamic imports); wrap in a lazy-init server
  let server

  async function getServer() {
    if (!server) {
      const handler = await createHandler(adex)
      server = http.createServer(handler)
    }
    return server
  }

  return {
    async run() {
      const s = await getServer()
      return s.listen(port, host, () => {
        console.log(`Listening on ${host}:${port}`)
      })
    },
    fetch: undefined,
  }
}
