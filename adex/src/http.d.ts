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
