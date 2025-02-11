export const env = {}

if (import.meta.server) {
  env.get = (key, defaultValue = '') => {
    return process.env[key] ?? defaultValue
  }
  env.set = (key, value) => {
    return (process.env[key] = value)
  }
} else {
  env.get = (key, defaultValue = '') => {
    return import.meta.env[key] ?? defaultValue
  }
  env.set = (key, value) => {
    return (import.meta.env[key] = value)
  }
}
