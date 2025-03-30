import { App as AdexApp } from 'adex/app'
import { h } from 'preact'
import { hydrate as preactHydrate } from 'adex/router'
import { ThemeProvider } from '@preachjs/themes'

export { prerender } from 'adex/app'

import 'virtual:adex:global.css'

export const App = ({ url }) => {
  return (
    <ThemeProvider>
      <AdexApp url={url} />
    </ThemeProvider>
  )
}

async function hydrate() {
  preactHydrate(h(App, null), document.getElementById('app'))
}

if (typeof window !== 'undefined') {
  hydrate()
}
