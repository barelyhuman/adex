import { hydrate as preactHydrate, h } from 'preact'
import 'virtual:adex:global.css'

const pageRoutes = import.meta.glob('/src/pages/**/*.{tsx,jsx,js}')

async function hydrate() {
  const entryPage = document.getElementById('app').dataset.entryPage
  const componentModule = await pageRoutes[entryPage]()
  const Component =
    'default' in componentModule ? componentModule.default : componentModule
  preactHydrate(h(Component), document.getElementById('app'))
}

hydrate()
