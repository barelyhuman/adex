const pageRoutes = import.meta.glob('./pages/**/*.page.{js,ts,jsx,tsx}')
import { hooks } from 'adex/hooks'

let mounterPath

render()

async function render() {
  const root = document.getElementById('root')
  mounterPath = root.getAttribute('mounter')
  let loaderData = {}
  try {
    const meta = document.getElementById('__dummy').innerText
    loaderData = JSON.parse(decodeURIComponent(atob(meta)))
  } catch (err) {
    console.error(err)
  }
  const pathInPageMap = normalizePath(mounterPath)
  const modImport = await pageRoutes[pathInPageMap]()
  const Page = modImport.default
  const mountable = Page(loaderData)
  root.innerHTML = ''
  mountable(root)
  hooks.emit('onMount', {})
}

function normalizePath(path) {
  let result = String(path)
  if (/^[./][/]?/.test(result)) {
    result = result.replace(/^[./][/]?/, '')
  }
  return './' + result
}

if (import.meta.hot) {
  import.meta.hot.accept(mounterPath, newModule => {
    // do nothing, ssr rendered so it'll reload itself
  })
}
