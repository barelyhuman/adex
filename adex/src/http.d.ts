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
}

export function prepareRequest(req: IncomingMessage): void
export function prepareResponse(res: ServerResponse): void
