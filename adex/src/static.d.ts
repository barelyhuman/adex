import type { IncomingMessage, ServerResponse } from 'node:http'
import type sirv from 'sirv'

export type StaticPaths = {
  assets?: string
  islands?: string
  client?: string
}

export type ServeStatic = typeof sirv

export type CreateStaticMiddlewaresOptions = {
  paths?: StaticPaths
  /** Static file server factory. Defaults to `sirv`. */
  serve?: ServeStatic
  /** Options passed to each `serve` call. */
  options?: Parameters<ServeStatic>[1]
}

export type StaticMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next?: (err?: unknown) => void
) => unknown

export function createStaticMiddlewares(
  options?: CreateStaticMiddlewaresOptions
): StaticMiddleware[]
