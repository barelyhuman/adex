import { renderToString } from 'adex/ssr'
import viteDevServer from 'vavite/vite-dev-server'
import { Options } from 'sirv'
import { ms, Youch } from 'adex/utils'

// VITE VIRTUAL
// @ts-ignore
import clientManifest from 'virtual:adex:client-manifest'
// VITE VIRTUAL
// @ts-ignore
import entryTemplate from 'virtual:adex:entry-template'

const pageRoutes = import.meta.glob('./pages/**/*.page.{js,ts,jsx,tsx}')
const assetBaseURL = import.meta.env.BASE_URL ?? '/'

export const sirvOptions: Options = {
  maxAge: ms('1m'),
}

const buildTemplate = ({
  page = '',
  mounter = '',
  clientEntry = '',
  prefillData = {},
} = {}) => {
  return entryTemplate.replace('<!--app-head-->', '').replace(
    '<!--app-body-->',
    `
      <div id="root" mounter="${mounter}">${page}</div>
      <script type="module" defer src="${clientEntry}"></script>
      <script type="application/json" id="__dummy">
        ${btoa(JSON.stringify(prefillData, null, 2))}
      </script>
      ${
        viteDevServer
          ? `
    <script type="module" src="/@vite/client" />
    `
          : ''
      }
    `
  )
}

async function buildHandler({ routes }) {
  const routeMap = Object.fromEntries(
    Object.entries(pageRoutes).map(([path, modImport]) => {
      let finalUrl = path
        .replace(/^[.]?[\/]?(pages)/, '')
        .replace(/(\.page\.)(js|ts)x?$/, '')
      if (finalUrl.endsWith('index')) {
        finalUrl = finalUrl.slice(0, -'index'.length)
      }
      return [
        finalUrl,
        {
          path,
          importer: modImport,
        },
      ]
    })
  )

  let clientEntryPath
  if (viteDevServer) {
    clientEntryPath = assetBaseURL + 'virtual:adex:client-entry'
  } else {
    const hasEntryFile = Object.values(clientManifest).find(v => v.isEntry)
    if (hasEntryFile) {
      clientEntryPath = hasEntryFile.file
    }
  }

  return async (req, res) => {
    try {
      const hasMappedPage = routeMap[req.url]
      if (!hasMappedPage) return res.end()
      const mod = (await hasMappedPage.importer()) as {
        default: (loaderData: any) => any
        loader: ({ req }) => any
      }

      let loadedData = {}
      try {
        loadedData = 'loader' in mod ? await mod.loader({ req }) : {}
      } catch (err) {
        throw new Error(
          `Failed to execute loader for url:\`${req.url}\` with page module: \`${hasMappedPage.path}\``
        )
      }
      const str = renderToString(mod.default(loadedData))
      const html = buildTemplate({
        page: str,
        mounter: hasMappedPage.path,
        clientEntry: clientEntryPath,
        prefillData: loadedData,
      })
      res.setHeader('content-type', 'text/html')
      res.write(html)
      res.end()
    } catch (err) {
      console.error(err)
      if (import.meta.env.DEV) {
        const youch = new Youch(err, req)
        const html = await youch.toHTML()
        res.writeHead(200, { 'content-type': 'text/html' })
        res.write(html)
        res.end()
        return
      }
      res.statusCode = 500
      res.write('Something went wrong!')
      res.end()
      return
    }
  }
}

export default await buildHandler({ routes: pageRoutes })
