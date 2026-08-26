import { existsSync } from 'node:fs'
import sirv from 'sirv'

const DEFAULT_SERVE_OPTIONS = {
  maxAge: 31536000,
  immutable: true,
}

/**
 * Default production static middleware (sirv + URL prefix rewrites for
 * `/assets` and `/islands`). Used when `kernel.staticServer` is omitted.
 *
 * Custom `kernel.staticServer` modules replace this entire factory and do not
 * inherit the sirv-specific `__originalUrl` / path rewriting.
 *
 * @param {object} [options]
 * @param {{ assets?: string, islands?: string, client?: string }} [options.paths]
 * @param {typeof sirv} [options.serve] Only for the default implementation
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

function passthrough(_req, _res, next) {
  next()
}

/**
 * Virtual module source for `virtual:adex:static-server`.
 * Default export is `({ paths }) => middleware | middleware[]`.
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

  return `export { createStaticMiddlewares as default } from 'adex/static'
`
}
