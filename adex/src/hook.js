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
 * Register a hook to run before page render
 * @param {(context: any) => any|Promise<any>} fn
 */
export function beforePageRender(fn) {
  hook(CONSTANTS.beforePageRender, fn)
}

/**
 * Register a hook to run after page render
 * @param {(context: any) => any|Promise<any>} fn
 */
export function afterPageRender(fn) {
  hook(CONSTANTS.afterPageRender, fn)
}

/**
 * Register a hook to run before API call
 * @param {(context: any) => any|Promise<any>} fn
 */
export function beforeAPICall(fn) {
  hook(CONSTANTS.beforeApiCall, fn)
}

/**
 * Register a hook to run after API call
 * @param {(context: any) => any|Promise<any>} fn
 */
export function afterAPICall(fn) {
  hook(CONSTANTS.afterApiCall, fn)
}

/**
 * Emit an event to all registered hooks
 * @param {symbol} eventName
 * @param {any} data
 */
export async function emitToHooked(eventName, data) {
  const handlers = hookListeners.get(eventName) || []
  for (let handler of handlers) {
    await handler(data)
  }
}
