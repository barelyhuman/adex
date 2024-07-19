const hookListeners = new Map()

export const CONSTANTS = {
  pageRender: Symbol('page-render'),
  apiCall: Symbol('api-call'),
}

/**
 * @param {string|symbol} eventName
 * @param {(data:any)=>void|Promise<void>} handler
 */
export function hook(eventName, handler) {
  const handlers = hookListeners.get(eventName) || []
  handlers.push(handler)
  hookListeners.set(eventName, handlers)
}

/**
 * @param {(ctx: Context)=> void} fn
 */
export async function beforePageRender(fn) {
  hook(CONSTANTS.pageRender, fn)
}

/**
 * @param {(ctx: APIContext)=> void} fn
 */
export async function beforeAPICall(fn) {
  hook(CONSTANTS.apiCall, fn)
}

export async function emitToHooked(eventName, data) {
  const handlers = hookListeners.get(eventName) || []
  for (let handler of handlers) {
    await handler(data)
  }
}
