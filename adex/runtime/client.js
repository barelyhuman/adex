import { h } from 'preact'
import {
  LocationProvider,
  Router,
  Route,
  lazy,
  hydrate as preactHydrate,
  ErrorBoundary,
  join,
  prerender as ssr,
} from 'adex/router'

import 'virtual:adex:global.css'

const baseURL = import.meta.env.BASE_URL ?? '/'

const normalizeURLPath = url => (url ? join(baseURL, url) : undefined)

// @ts-expect-error injected by vite
import { routes } from '~routes'

function ComponentWrapper({ url = '' }) {
  return h(
    LocationProvider,
    //@ts-expect-error no types for non-jsx function
    { url: normalizeURLPath(url) },
    h(
      ErrorBoundary,
      {},
      h(
        Router,
        {},
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
  return h(ComponentWrapper, { url })
}

async function hydrate() {
  preactHydrate(h(ComponentWrapper, {}), document.getElementById('app'))
}

if (typeof window !== 'undefined') {
  hydrate()
}

export const prerender = async ({ url }) => {
  const { html, links: discoveredLinks } = await ssr(
    h(ComponentWrapper, { url: url })
  )

  return {
    html,
    links: new Set([...(discoveredLinks ?? [])]),
  }
}
