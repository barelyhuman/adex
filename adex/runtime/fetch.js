import { ofetch as _ofetch } from 'ofetch'
import { env } from 'adex/env'

const constructBaseURL = () => {
  if (import.meta.server) {
    const origin = env.get('HOST', 'localhost')
    const port = env.get('PORT', '3000')
    return new URL(`http:${origin}${port ? `:${port}` : ''}`).toString()
  }
  return window.location.toString()
}

const baseURL = constructBaseURL()
export const $fetch = _ofetch.create({
  baseURL: baseURL,
})
