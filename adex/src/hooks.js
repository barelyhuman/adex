class Hook {
  #listeners = new Map()
  constructor() {}

  hook(type = '*', fn) {
    const existingListeners = this.#listeners.get(type) || []
    this.#listeners.set(type, existingListeners.concat(fn))
    return function unsubscribe() {
      const existingListeners = this.#listeners.get(type) || []
      this.#listeners.set(
        type,
        existingListeners.filter(x => fn)
      )
    }
  }

  async emit(type = '*', data) {
    const allListeners = this.#listeners.get('*') || []
    const typeListener = this.#listeners.get(type) || []
    for (let l of allListeners.concat(typeListener)) {
      await l(data)
    }
  }
}

export const hooks = new Hook()

export function onMount(fn) {
  hooks.hook('onMount', fn)
}
