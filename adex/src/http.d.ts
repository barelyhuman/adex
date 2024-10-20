export type Methods = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type HandlerKeys = Lowercase<Methods | 'all'>

export type Handlers = {
  [k in HandlerKeys]?: (req: Request) => Response | Promise<Response>
}

export function defineHandlers(
  handlers: Handlers
): (req: Request) => Promise<Response> | Response

export function json<T>(
  data: T,
  status?: number,
  additional?: ResponseInit
): Response

export function readBody<T>(
  req: Request,
  transformer: (data: Uint8Array | undefined) => T
): Promise<T>
