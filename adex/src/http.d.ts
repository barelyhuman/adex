import {
  IncomingMessage as HTTPIncomingMessage,
  ServerResponse as HTTPServerResponse,
} from 'http'

export type IncomingMessage = HTTPIncomingMessage & {
  parseBodyJSON: <T, K extends keyof T>() => Promise<Record<K, T[K]>>
}

export type ServerResponse = HTTPServerResponse & {
  html: (data: string) => void
  json: (data: any) => void
  text: (data: string) => void
  redirect: (url: string, statusCode: number) => void
  badRequest: (message?: string) => void
  unauthorized: (message?: string) => void
  forbidden: (message?: string) => void
  notFound: (message?: string) => void
  internalServerError: (message?: string) => void
}

export function prepareRequest(req: IncomingMessage): void
export function prepareResponse(res: ServerResponse): void

/**
 * Convert a Node.js IncomingMessage to a Fetch API Request.
 * Used by adapter kernels to bridge from Node HTTP to Fetch.
 */
export function nodeRequestToFetch(req: HTTPIncomingMessage): Promise<Request>

/**
 * Write a Fetch API Response to a Node.js ServerResponse.
 * Skips internal x-adex-* headers. Used by adapter kernels.
 */
export function fetchResponseToNode(
  response: Response,
  res: HTTPServerResponse
): Promise<void>
