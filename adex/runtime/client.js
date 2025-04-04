import { App } from 'adex/app'
import { h } from 'preact'
import { hydrate as preactHydrate } from 'adex/router'

export { App, prerender } from 'adex/app'

import 'virtual:adex:global.css'

async function hydrate() {
  preactHydrate(h(App, null), document.getElementById('app'))
}
if (typeof window !== 'undefined') {
  hydrate()
}
