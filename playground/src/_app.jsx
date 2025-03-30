import { App as AdexApp } from 'adex/app'
import { h } from 'preact'
import { hydrate as preactHydrate } from 'adex/router'

export { prerender } from 'adex/app'

import 'virtual:adex:global.css'

export const App = ({ url }) => {
  return <AdexApp url={url} />
}

async function hydrate() {
  preactHydrate(h(App, null), document.getElementById('app'))
}

if (typeof window !== 'undefined') {
  hydrate()
}
