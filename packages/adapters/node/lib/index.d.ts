import type { IncomingMessage, ServerResponse } from 'node:http'

type StaticMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next?: (err?: unknown) => void
) => unknown

type StaticServer = (options: {
  paths?: {
    assets?: string
    islands?: string
    client?: string
  }
}) => StaticMiddleware | StaticMiddleware[]

type AdexServerOptions = {
  manifests?: {
    server?: Record<string, unknown>
    client?: Record<string, unknown>
  }
  paths?: {
    assets?: string
    islands?: string
    client?: string
  }
  /** From `virtual:adex:static-server` — `({ paths }) => middleware | middleware[]`. */
  staticServer?: StaticServer
}

type ServerOut = {
  run: () => unknown
  fetch: undefined
}

export const createServer: (options?: {
  port?: number | string
  host?: string
  adex?: AdexServerOptions
}) => ServerOut
