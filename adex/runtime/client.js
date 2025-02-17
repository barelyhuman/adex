import { h } from 'preact'
import {
  LocationProvider,
  Router,
  Route,
  lazy,
  hydrate as preactHydrate,
  ErrorBoundary,
} from 'adex/router'

import 'virtual:adex:global.css'

// @ts-expect-error injected by vite
import { routes } from '~routes'

function ComponentWrapper({ url = '' }) {
  return h(
    LocationProvider,
    //@ts-expect-error no types for non-jsx function
    { url: url },
    h(
      ErrorBoundary,
      {},
      h(
        Router,
        {},
        routes.map(d =>
          h(Route, { path: d.routePath, component: lazy(d.module) })
        )
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
