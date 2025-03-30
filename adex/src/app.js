import {
  ErrorBoundary,
  LocationProvider,
  Route,
  Router,
  join,
  lazy,
  prerender as ssr,
} from 'adex/router'
import { h } from 'preact'

const baseURL = import.meta.env.BASE_URL ?? '/'

const normalizeURLPath = url => (url ? join(baseURL, url) : undefined)

const removeBaseURL = url => {
  if (typeof url !== 'string') {
    return undefined
  }
  if (url.startsWith(baseURL)) {
    const result = url.slice(baseURL.length)
    return result === '' ? '/' : result
  }
  const baseURLWithoutSlash = baseURL.endsWith('/')
    ? baseURL.slice(0, -1)
    : baseURL
  if (url.startsWith(baseURLWithoutSlash)) {
    const result = url.slice(baseURLWithoutSlash.length)
    return result === '' ? '/' : result
  }
  return undefined
}

// @ts-expect-error injected by vite
import { routes } from '~routes'

function ComponentWrapper({ url = '' }) {
  return h(
    LocationProvider,
    {
      // @ts-expect-error LocationProvider doesn't expose this
      url: normalizeURLPath(url),
    },
    h(
      ErrorBoundary,
      null,
      h(
        Router,
        null,
        routes.map(d => {
          return h(Route, {
            path: normalizeURLPath(d.routePath),
            component: lazy(d.module),
          })
        })
      )
    )
  )
}

export const App = ({ url = '' }) => {
  return h(ComponentWrapper, {
    url: url,
  })
}
export const prerender = async ({ url }) => {
  const { html, links: discoveredLinks } = await ssr(
    h(ComponentWrapper, {
      url: url,
    })
  )
  return {
    html,
    links: new Set(
      [...discoveredLinks].map(d => removeBaseURL(d)).filter(Boolean)
    ),
  }
}
