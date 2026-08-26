import type { IncomingMessage, ServerResponse } from 'node:http'
import type sirv from 'sirv'

export type StaticPaths = {
  assets?: string
  islands?: string
  client?: string
}

export type ServeStatic = typeof sirv

export type StaticMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next?: (err?: unknown) => void
) => unknown

/**
 * Static plugin contract — default export of `adex/static` and of any module
 * passed as `kernel.staticServer`.
 */
export type StaticServer = (options: {
  paths?: StaticPaths
}) => StaticMiddleware | StaticMiddleware[]

export type CreateStaticMiddlewaresOptions = {
  paths?: StaticPaths
  serve?: ServeStatic
  options?: Parameters<ServeStatic>[1]
}

/** Adex default static plugin (sirv + URL rewrites). */
export function createStaticMiddlewares(
  options?: CreateStaticMiddlewaresOptions
): StaticMiddleware[]

declare const defaultStaticPlugin: typeof createStaticMiddlewares
export default defaultStaticPlugin

/** Virtual module source for `kernel.staticServer` (defaults to `adex/static`). */
export function resolveStaticServerModuleSource(
  staticServer?: false | string
): string
