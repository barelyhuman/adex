// Production runtime for the Deno adapter.
// This file contains only Deno-compatible code — no Node.js APIs, no Buffer.
// The dev-mode Vite plugin (which runs on Node.js) lives in ./dev.js.

import { createDenoDevServerPlugin } from './dev.js'

// ─── Adapter factory ──────────────────────────────────────────────────────────

/**
 * Adapter factory — pass to adex({ adapter: deno() }) in vite.config.js
 * Returns an AdapterConfig object the core framework uses at build time.
 * @param {import('./index.d.ts').DenoAdapterOptions} [options]
 * @returns {import('./index.d.ts').AdapterConfig}
 */
export function deno(options = {}) {
  return {
    name: 'adex-adapter-deno',

    devServerPlugin({ islands }) {
      return createDenoDevServerPlugin({ islands })
    },

    /**
     * Extend the Rollup SSR build options for Deno compatibility:
     *  - preserveModules: true  → Rollup emits one file per module and leaves
     *    import specifiers (jsr:, npm:, https://, node:) untouched, so user
     *    code can freely use Deno-style imports without Rollup erroring on
     *    unknown protocols.
     *  - external additions: https?:// and node: specifiers that may appear
     *    in user pages / API routes.
     *  - sanitizeFileName: replaces ':' (invalid on Windows / confusing on
     *    Unix) in virtual module IDs with '_'.
     * The adex core will emit an index.js shim pointing at the real entry
     * when the entry is not already named index.js (preserveModules case).
     */
    rollupOptions(base) {
      const baseExternal = Array.isArray(base.external)
        ? base.external
        : base.external
          ? [base.external]
          : []
      return {
        ...base,
        external: [...baseExternal, /^https?:\/\//, /^node:/],
        output: {
          ...(Array.isArray(base.output) ? {} : (base.output ?? {})),
          preserveModules: true,
          sanitizeFileName: name => name.replace(/[:<>|?*]/g, '_'),
        },
      }
    },

    serverEntry({ islands }) {
      return `import { createServer } from 'adex-adapter-deno'
import { join } from 'jsr:@std/path'
import { env } from 'adex/env'

import 'virtual:adex:font.css'
import 'virtual:adex:global.css'

// Deno 1.40+ exposes import.meta.dirname; fall back to URL parsing for older versions.
const __dirname = import.meta.dirname ?? new URL('.', import.meta.url).pathname

const PORT = parseInt(env.get('PORT', '3000'), 10)
const HOSTNAME = env.get('HOST', 'localhost')

function readJSON(p) {
  try { return JSON.parse(Deno.readTextFileSync(p)) } catch { return {} }
}

const adexManifest = readJSON(join(__dirname, 'adex.manifest.json'))
const serverManifest = readJSON(join(__dirname, 'manifest.json'))
const clientManifest = adexManifest?.client?.bundle
  ? readJSON(join(__dirname, adexManifest.client.manifestPath))
  : {}

const paths = {
  assets: join(__dirname, './assets'),
  islands: join(__dirname, './islands'),
  client: join(__dirname, adexManifest?.client?.outDir ?? '../client'),
}

const server = createServer({
  port: PORT,
  hostname: HOSTNAME,
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

// ─── Production server ────────────────────────────────────────────────────────

/**
 * Build the injected HTML strings for CSS/JS assets from the Vite manifests.
 *
 * @param {object} manifest
 * @param {string} filePath
 * @returns {{ links: string[], scripts: string[] }}
 */
function manifestToHTML(manifest, filePath) {
  let links = []
  let scripts = []

  const rootServerFile = 'virtual:adex:server'
  if (manifest[rootServerFile]) {
    const graph = manifest[rootServerFile]
    links = links.concat(
      (graph.css || []).map(d => `<link rel="stylesheet" href="/${d}" />`)
    )
  }

  const rootClientFile = 'virtual:adex:client'
  if (manifest[rootClientFile]) {
    const graph = manifest[rootClientFile]
    links = links.concat(
      (graph.css || []).map(d => `<link rel="stylesheet" href="/${d}" />`)
    )
  }

  if (manifest[filePath]) {
    const graph = manifest[filePath]
    links = links.concat(
      (graph.css || []).map(d => `<link rel="stylesheet" href="/${d}" />`)
    )

    const depsHasCSS = (manifest[filePath].imports || [])
      .map(d => manifest[d])
      .filter(d => d?.css?.length)

    if (depsHasCSS.length) {
      links = links.concat(
        depsHasCSS.map(d =>
          d.css.map(p => `<link rel="stylesheet" href="/${p}" />`).join('\n')
        )
      )
    }

    scripts = scripts.concat(
      `<script src="${manifest[filePath].file}" type="module"></script>`
    )
  }

  return { scripts, links }
}

/**
 * Inject manifest-driven CSS/JS asset tags into an HTML string.
 *
 * @param {string} template
 * @param {string} pageRoute
 * @param {object} serverManifest
 * @param {object} clientManifest
 * @returns {string}
 */
function addDependencyAssets(
  template,
  pageRoute,
  serverManifest,
  clientManifest
) {
  if (!pageRoute) return template

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

/**
 * Serve a static file from a directory using Deno's standard library.
 * Returns a Response if found, null if not.
 *
 * @param {Request} request
 * @param {string} dir     — absolute path to the directory root
 * @param {string} prefix  — URL prefix to strip before resolving (e.g. '/assets')
 * @returns {Promise<Response | null>}
 */
async function serveStatic(request, dir, prefix = '') {
  const { serveDir } = await import('jsr:@std/http/file-server')
  return serveDir(request, {
    fsRoot: dir,
    urlRoot: prefix.replace(/^\//, ''),
    quiet: true,
  })
}

/**
 * Production Deno server factory.
 *
 * @param {import('./index.d.ts').DenoServerOptions} options
 * @returns {{ run(): void; fetch: (req: Request) => Promise<Response> }}
 */
export const createServer = ({
  port = 3000,
  hostname = '127.0.0.1',
  adex = {
    manifests: { server: {}, client: {} },
    paths: {},
    client: { bundle: true, islands: false },
  },
} = {}) => {
  /** @type {((req: Request) => Promise<Response>) | null} */
  let fetchHandler = null

  async function getFetchHandler() {
    if (fetchHandler) return fetchHandler

    // @ts-expect-error injected by vite
    const { handler } = await import('virtual:adex:handler')

    const { manifests, paths, client } = adex

    /**
     * @param {Request} request
     * @returns {Promise<Response>}
     */
    async function handle(request) {
      const url = new URL(request.url)
      const pathname = url.pathname

      // 1. /assets/** — server-emitted static assets (fonts, etc.)
      if (pathname.startsWith('/assets/') && paths.assets) {
        try {
          const resp = await serveStatic(request, paths.assets, '/assets')
          if (resp && resp.status !== 404) return resp
        } catch {
          // fall through to app handler
        }
      }

      // 2. /islands/** — island JS bundles
      if (client.islands && pathname.startsWith('/islands/') && paths.islands) {
        try {
          const resp = await serveStatic(request, paths.islands, '/islands')
          if (resp && resp.status !== 404) return resp
        } catch {
          // fall through
        }
      }

      // 3. Client bundle — CSS, hashed JS, etc.
      if (client.bundle && paths.client) {
        try {
          const resp = await serveStatic(request, paths.client, '')
          if (resp && resp.status !== 404) return resp
        } catch {
          // fall through
        }
      }

      // 4. App handler (SSR pages + API routes)
      const response = await handler(request)
      const pageRoute = response.headers.get('x-adex-page-route')

      if (!pageRoute) {
        // API response or 404 — strip internal headers and return
        return new Response(response.body, {
          status: response.status,
          headers: Object.fromEntries(
            [...response.headers.entries()].filter(
              ([k]) => !k.startsWith('x-adex-')
            )
          ),
        })
      }

      // Page response — inject manifest CSS/JS asset tags
      const html = await response.text()
      const finalHTML = addDependencyAssets(
        html,
        pageRoute,
        manifests.server,
        manifests.client
      )

      return new Response(finalHTML, {
        status: response.status,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    }

    fetchHandler = handle
    return fetchHandler
  }

  return {
    async run() {
      const handle = await getFetchHandler()
      // @ts-expect-error Deno global — not present in Node type definitions
      Deno.serve({ port, hostname }, handle)
      console.log(`Listening on http://${hostname}:${port}`)
    },
    // Exposed so the server entry can `export default server.fetch` for
    // edge/serverless runtimes that call the handler directly.
    fetch: async request => {
      const handle = await getFetchHandler()
      return handle(request)
    },
  }
}
