import { existsSync } from 'node:fs'
import sirv from 'sirv'

const DEFAULT_SERVE_OPTIONS = {
  maxAge: 31536000,
  immutable: true,
}

/**
 * Adex's default production static plugin.
 *
 * Includes sirv plus the `/assets` and `/islands` URL-prefix rewrites that
 * sirv needs when rooted at a build output directory. This is what runs when
 * `kernel.staticServer` is omitted.
 *
 * Switch away with `adex({ kernel: { staticServer: './my-static.js' } })` or
 * disable with `staticServer: false`. Custom factories do not inherit these
 * rewrites — they receive the original `req.url`.
 *
 * @param {object} [options]
 * @param {{ assets?: string, islands?: string, client?: string }} [options.paths]
 * @param {typeof sirv} [options.serve]
 * @param {Parameters<typeof sirv>[1]} [options.options]
 * @returns {Array<(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next?: Function) => any>}
 */
export function createStaticMiddlewares({
  paths = {},
  serve = sirv,
  options = {},
} = {}) {
  const serveOptions = {
    ...DEFAULT_SERVE_OPTIONS,
    ...options,
  }

  const serverAssets = paths.assets
    ? serve(paths.assets, serveOptions)
    : passthrough

  const islandAssets =
    paths.islands && existsSync(paths.islands)
      ? serve(paths.islands, serveOptions)
      : passthrough

  const clientAssets =
    paths.client && existsSync(paths.client)
      ? serve(paths.client, serveOptions)
      : passthrough

  return [
    async (req, res, next) => {
      // sirv is rooted at the directory; strip public URL prefixes for lookup
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
      // @ts-expect-error shared-state between the middlewares
      req.url = req.__originalUrl
      return clientAssets(req, res, next)
    },
  ]
}

/** Default static plugin entry (same as `createStaticMiddlewares`). */
export default createStaticMiddlewares

function passthrough(_req, _res, next) {
  next()
}

/**
 * Virtual module source for `virtual:adex:static-server`.
 * Resolves which static plugin to use (`adex/static` by default).
 *
 * @param {false | string | undefined} staticServer
 * @returns {string}
 */
export function resolveStaticServerModuleSource(staticServer) {
  if (staticServer === false) {
    return `export default function staticServer() {
  return []
}
`
  }

  if (typeof staticServer === 'string' && staticServer.length > 0) {
    return `export { default } from ${JSON.stringify(staticServer)}
`
  }

  return `export { default } from 'adex/static'
`
}
