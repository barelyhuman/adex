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

const withComponents = routes.map(d => {
  return {
    ...d,
    component: lazy(d.module),
  }
})

function ComponentWrapper({ url = '' }) {
  return h(
    LocationProvider,
    { url: url },
    h(
      ErrorBoundary,
      {},
      h(
        Router,
        { url: url },
        withComponents.map(d =>
          h(Route, { path: d.routePath, component: d.component })
        )
      )
    )
  )
}

export const App = ({ url = '' }) => {
  return h(ComponentWrapper, { url })
}

async function hydrate() {
  // const entryPage = document.getElementById('app').dataset.entryPage
  // const routeParams = document.getElementById('app').dataset.routeParams
  // const componentModule = await routes[entryPage]()
  // const Component =
  //   'default' in componentModule ? componentModule.default : componentModule
  // {
  //   routeParams: routeParams ? JSON.parse(atob(routeParams)) : {},
  // }
  preactHydrate(h(ComponentWrapper, {}), document.getElementById('app'))
}
if (typeof window !== 'undefined') {
  hydrate()
}
