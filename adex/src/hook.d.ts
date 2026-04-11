export type PageRenderContext = {
  request: Request
  html?: string
}

export type APIContext = {
  request: Request
  response?: Response
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
  fn: (ctx: Omit<PageRenderContext, 'html'>) => void
): Promise<void>

export declare function afterPageRender(
  fn: (ctx: PageRenderContext) => void
): Promise<void>

export declare function beforeAPICall(
  fn: (ctx: Omit<APIContext, 'response'>) => void
): Promise<void>

export declare function afterAPICall(
  fn: (ctx: APIContext) => void
): Promise<void>

export declare function emitToHooked(eventName: any, data: any): Promise<void>
