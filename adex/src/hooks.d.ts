import { IncomingMessage, ServerResponse } from 'node:http'

export type PageContext = {
  req: IncomingMessage
  html?: string
}

export type APIContext = {
  req: IncomingMessage
  res: ServerResponse
}

export declare const CONSTANTS: {
  beforePageRender: symbol
  afterPageRender: symbol
  beforeApiCall: symbol
  afterApiCall: symbol
}

export declare function hook(
  eventName: string | symbol,
  handler: (data: any) => void | Promise<void>
): void

export declare function beforePageRender(
  fn: (ctx: Omit<PageContext, 'html'>) => void | Promise<void>
): void

export declare function afterPageRender(
  fn: (ctx: PageContext & { html: string }) => void | Promise<void>
): void

export declare function beforeAPICall(
  fn: (ctx: APIContext) => void | Promise<void>
): void

export declare function afterAPICall(
  fn: (ctx: APIContext) => void | Promise<void>
): void

export declare function emitToHooked(eventName: any, data: any): Promise<void>

export declare function resetHooks(): void
