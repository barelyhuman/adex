const isClient = typeof window !== 'undefined'

if (isClient) {
  throw new Error('[adex] Cannot use/import `adex/env` on the client side')
}

export const env = {
  get(key, defaultValue = '') {
    if (isClient) return ''
    return process.env[key] ?? defaultValue
  },
  set(key, value) {
    if (isClient) return ''
    return (process.env[key] = value)
  },
}
