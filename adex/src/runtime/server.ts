import { renderToString } from 'adex/ssr'
import viteDevServer from 'vavite/vite-dev-server'
import { Options } from 'sirv'
import { basename } from 'node:path'
import { resolve } from 'node:path'
import { getEntryHTML, ms, routerUtils, Youch } from 'adex/utils'
import qs from 'node:querystring'

// VITE VIRTUAL
// @ts-ignore
import clientManifest from 'virtual:adex:client-manifest'

import { normalizePath } from 'vite'

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
  return getEntryHTML()
    .replace('<!--app-head-->', '')
    .replace(
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
  const routesForManifest = Object.entries(pageRoutes).map(
    ([path, modImport]) => {
      return {
        name: basename(path),
        relativePath: normalizePath(path),
        importer: modImport,
        absolutePath: resolve(process.cwd(), path),
        isDirectory: false,
      }
    }
  )

  const routesWithURL = routerUtils.generateRoutes(
    '/pages',
    routesForManifest,
    {
      normalizer: (basePath, paths) => {
        const normalized = routerUtils.normalizeURLPaths(
          basePath,
          paths,
          routerUtils.defaultURLSorter
        )
        return normalized.map(x => {
          x.url = x.url.replace(/\.page$/, '').replace(/\/index$/, '/')
          return x
        })
      },
      transformer: routerUtils.expressTransformer,
      sorter: routerUtils.defaultURLSorter,
    }
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
      const [baseURL, query] = req.url.split('?')
      req.query = Object.assign({}, qs.parse(query))

      const hasMappedPage = routesWithURL.find(item => {
        const matcher = routerUtils.paramMatcher(item.url, {
          decode: decodeURIComponent,
        })

        const matched = matcher(baseURL)
        if (matched) {
          req.params = matched.params
        }
        return matched
      })
      if (!hasMappedPage) return res.end()
      const mod = (await hasMappedPage.importer()) as {
        default: (loaderData: any) => any
        loader: ({ req }) => any
      }

      let loadedData = {}
      try {
        loadedData = 'loader' in mod ? await mod.loader({ req }) : {}
      } catch (err) {
        const newError = new Error(
          `Failed to execute loader for url:\`${req.url}\` with page module: \`${hasMappedPage.relativePath}\``
        )
        newError.stack += '\n' + err.stack
        throw newError
      }
      const str = renderToString(mod.default(loadedData))
      const html = buildTemplate({
        page: str,
        mounter: hasMappedPage.relativePath,
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
