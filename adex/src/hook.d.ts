import { IncomingMessage } from 'node:http'

export type Context = {
  req: IncomingMessage
  html: string
}

export type APIContext = {
  req: IncomingMessage
}

export declare const CONSTANTS: {
  pageRender: symbol
  apiCall: symbol
}

export declare function hook(
  eventName: string | symbol,
  handler: (data: any) => void | Promise<void>
): void

export declare function beforePageRender(
  fn: (ctx: Context) => void
): Promise<void>

export declare function beforeAPICall(
  fn: (ctx: APIContext) => void
): Promise<void>

export declare function emitToHooked(eventName: any, data: any): Promise<void>
