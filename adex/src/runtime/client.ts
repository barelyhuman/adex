import { html } from 'adex/html'

const pageRoutes = import.meta.glob('./pages/**/*.page.{js,ts,jsx,tsx}')
let mounterPath
async function render() {
  const root = document.getElementById('root')
  mounterPath = root.getAttribute('mounter')
  let loaderData = {}
  try {
    const meta = document.getElementById('__dummy').innerText
    loaderData = JSON.parse(atob(meta))
  } catch (err) {
    console.error(err)
  }

  const modImport: any = await pageRoutes[mounterPath]()
  const Page = modImport.default
  const mountable = html`${() => Page(loaderData)}`
  root.innerHTML = ''
  mountable(root)
}

render()

if (import.meta.hot) {
  import.meta.hot.accept(mounterPath, newModule => {
    // do nothing, ssr rendered so it'll reload itself
  })
}
