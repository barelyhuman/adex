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

/** Full static stack factory — what `kernel.staticServer` modules must default-export. */
export type StaticServer = (options: {
  paths?: StaticPaths
}) => StaticMiddleware | StaticMiddleware[]

export type CreateStaticMiddlewaresOptions = {
  paths?: StaticPaths
  /** Only for the default sirv implementation. */
  serve?: ServeStatic
  options?: Parameters<ServeStatic>[1]
}

export function createStaticMiddlewares(
  options?: CreateStaticMiddlewaresOptions
): StaticMiddleware[]

/** Virtual module source for `kernel.staticServer`. */
export function resolveStaticServerModuleSource(
  staticServer?: false | string
): string
