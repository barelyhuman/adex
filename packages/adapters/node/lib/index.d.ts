import type { IncomingMessage, ServerResponse } from 'node:http'

type ServeStatic = (
  dir: string,
  opts?: Record<string, unknown>
) => (
  req: IncomingMessage,
  res: ServerResponse,
  next?: (err?: unknown) => void
) => unknown

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
  /** Static file server factory from `virtual:adex:static-server` (defaults to sirv). */
  serve?: ServeStatic
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
