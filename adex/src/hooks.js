const hookListeners = new Map()

export const CONSTANTS = {
  beforePageRender: Symbol('before-page-render'),
  afterPageRender: Symbol('after-page-render'),
  beforeApiCall: Symbol('before-api-call'),
  afterApiCall: Symbol('after-api-call'),
}

/**
 * Register a hook handler for a given event
 * @param {symbol} eventName
 * @param {(context: any) => any|Promise<any>} handler
 */
export function hook(eventName, handler) {
  const handlers = hookListeners.get(eventName) || []
  handlers.push(handler)
  hookListeners.set(eventName, handlers)
}

/**
 * @param {(context: any) => any|Promise<any>} fn
 */
export function beforePageRender(fn) {
  hook(CONSTANTS.beforePageRender, fn)
}

/**
 * @param {(context: any) => any|Promise<any>} fn
 */
export function afterPageRender(fn) {
  hook(CONSTANTS.afterPageRender, fn)
}

/**
 * @param {(context: any) => any|Promise<any>} fn
 */
export function beforeAPICall(fn) {
  hook(CONSTANTS.beforeApiCall, fn)
}

/**
 * @param {(context: any) => any|Promise<any>} fn
 */
export function afterAPICall(fn) {
  hook(CONSTANTS.afterApiCall, fn)
}

/**
 * @param {symbol} eventName
 * @param {any} data
 */
export async function emitToHooked(eventName, data) {
  const handlers = hookListeners.get(eventName) || []
  for (const handler of handlers) {
    await handler(data)
  }
}

export function resetHooks() {
  hookListeners.clear()
}
