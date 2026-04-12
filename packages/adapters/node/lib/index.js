import { existsSync } from 'node:fs'
import http from 'node:http'
import { createNodeDevServerPlugin } from './dev.js'
import { nodeRequestToFetch, fetchResponseToNode } from 'adex/http'

let islandMode = false

/**
 * Adapter factory — pass to adex({ adapter: node() }) in vite.config.js
 * Returns an AdapterConfig object the core framework uses at build time.
 * @param {import('./index.d.ts').NodeAdapterOptions} [options]
 * @returns {import('./index.d.ts').AdapterConfig}
 */
export function node(options = {}) {
  return {
    name: 'adex-adapter-node',
    devServerPlugin({ islands }) {
      return createNodeDevServerPlugin({ islands })
    },
    serverEntry({ islands }) {
      return `import { createServer } from 'adex-adapter-node'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { env } from 'adex/env'

import 'virtual:adex:font.css'
import 'virtual:adex:global.css'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PORT = parseInt(env.get('PORT', '3000'), 10)
const HOST = env.get('HOST', 'localhost')

function readJSON(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return {} }
}

const adexManifest = readJSON(join(__dirname, 'adex.manifest.json'))
const serverManifest = readJSON(join(__dirname, 'manifest.json'))
const clientManifest = adexManifest?.client?.bundle
  ? readJSON(join(join(__dirname, adexManifest.client.manifestPath)))
  : {}

const paths = {
  assets: join(__dirname, './assets'),
  islands: join(__dirname, './islands'),
  client: join(__dirname, adexManifest?.client?.outDir ?? '../client'),
}

const server = createServer({
  port: PORT,
  host: HOST,
  adex: {
    manifests: { server: serverManifest, client: clientManifest },
    paths,
    client: adexManifest?.client ?? { bundle: false, islands: false },
  },
})

if ('run' in server) { server.run() }
export default server.fetch
`
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
