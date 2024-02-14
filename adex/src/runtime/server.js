import { renderToString } from 'adex/ssr'
import { getEntryHTML, ms, routerUtils, Youch } from 'adex/utils'
import { basename, resolve } from 'node:path'
import qs from 'node:querystring'
import middleware from 'virtual:adex:middleware-entry'

// VITE VIRTUAL
// @ts-ignore
import clientManifest from 'virtual:adex:client-manifest'

import { normalizePath } from 'vite'
const viteDevServer = import.meta.env.DEV

const pageRoutes = import.meta.glob('./pages/**/*.page.{js,ts,jsx,tsx}')
const apiRoutes = import.meta.glob('./pages/**/*.api.{js,ts,jsx,tsx}')
const assetBaseURL = import.meta.env.BASE_URL ?? '/'

export const sirvOptions = {
  maxAge: ms('1m')
}

const buildTemplate = ({
  page = '',
  mounter = '',
  clientEntry = '',
  prefillData = {}
} = {}) => {
  return getEntryHTML()
    .replace('<!--app-head-->', '')
    .replace(
      '<!--app-body-->',
      `
      <div id="root" mounter="${mounter}">${page}</div>
      <script type="module" defer src="${clientEntry}"></script>
      <script type="application/json" id="__dummy">
        ${btoa(encodeURIComponent(JSON.stringify(prefillData, null, 2)))}
      </script>
      ${
        viteDevServer
          ? `
    <script type="module" src="/@vite/client"></script>
    `
          : ''
      }
    `
    )
}

async function buildHandler ({ routes }) {
  const routesForManifest = Object.entries(pageRoutes).map(
    ([path, modImport]) => {
      return {
        name: basename(path),
        relativePath: normalizePath(path),
        importer: modImport,
        absolutePath: resolve(process.cwd(), path),
        isDirectory: false
      }
    }
  )

  const apiRouteManifest = Object.entries(apiRoutes).map(
    ([path, modImport]) => {
      return {
        name: basename(path),
        relativePath: normalizePath(path),
        importer: modImport,
        absolutePath: resolve(process.cwd(), path),
        isDirectory: false
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
          x.url = x.url
            .replace(/\.page$/, '')
            .replace(/\/index$/, '/')
            .replace(/\/$/, '')
          if (!x.url) {
            x.url = '/'
          }
          return x
        })
      },
      transformer: routerUtils.expressTransformer,
      sorter: routerUtils.defaultURLSorter
    }
  )

  const apiRoutesWithURL = routerUtils.generateRoutes(
    '/pages',
    apiRouteManifest,
    {
      normalizer: (basePath, paths) => {
        const normalized = routerUtils.normalizeURLPaths(
          basePath,
          paths,
          routerUtils.defaultURLSorter
        )
        return normalized.map(x => {
          x.url = x.url
            .replace(/\.api$/, '')
            .replace(/\/index$/, '/')
            .replace(/\/$/, '')
          if (!x.url) {
            x.url = '/'
          }
          return x
        })
      },
      transformer: routerUtils.expressTransformer,
      sorter: routerUtils.defaultURLSorter
    }
  )

  let clientEntryPath
  if (viteDevServer) {
    clientEntryPath = assetBaseURL + 'virtual:adex:client-entry'
  } else if (clientManifest) {
    const hasEntryFile = Object.values(clientManifest).find(v => v.isEntry)
    if (hasEntryFile) {
      clientEntryPath = hasEntryFile.file
    }
  }

  const pageLoader = async (mod, handlerMeta, req, res) => {
    let loadedData = {}
    try {
      loadedData = 'loader' in mod ? await mod.loader({ req }) : {}
    } catch (err) {
      err.message = `Failed to execute loader for url:\`${req.url}\` with page module: \`${handlerMeta.relativePath}\` with error ${err.message}`
      throw err
    }
    const str = renderToString(mod.default({ serverProps: loadedData }))
    const html = buildTemplate({
      page: str,
      mounter: handlerMeta.relativePath,
      clientEntry: clientEntryPath,
      prefillData: loadedData
    })
    res.setHeader('content-type', 'text/html')
    res.write(html)
    res.end()
  }

  const apiLoader = async (mod, handlerMeta, req, res) => {
    const methodKey = req.method.toLowerCase()
    if (methodKey in mod) {
      await mod[methodKey]({ req, res })
      return
    }
    return res.end()
  }

  return async (req, res, next) => {
    try {
      const [baseURL, query] = req.url.split('?')
      req.query = Object.assign({}, qs.parse(query))

      let _resolve
      const promise = new Promise(resolve => {
        _resolve = resolve
      })

      middleware(req, res, () => {
        _resolve()
      })

      await promise

      let mappedHandler
      let usingApi = false
      const hasMappedPage = routesWithURL.find(item => {
        const matcher = routerUtils.paramMatcher(item.url, {
          decode: decodeURIComponent
        })

        const matched = matcher(baseURL)
        if (matched) {
          req.params = matched.params
        }
        return matched
      })

      mappedHandler = hasMappedPage

      if (!hasMappedPage) {
        const hasMappedAPI = apiRoutesWithURL.find(item => {
          const matcher = routerUtils.paramMatcher(item.url, {
            decode: decodeURIComponent
          })

          const matched = matcher(baseURL)
          if (matched) {
            req.params = matched.params
          }
          return matched
        })

        if (!hasMappedAPI) {
          return res.end()
        }

        usingApi = true
        mappedHandler = hasMappedAPI
      }

      const mod = await mappedHandler.importer()

      if (usingApi) {
        await apiLoader(mod, mappedHandler, req, res)
      } else {
        await pageLoader(mod, mappedHandler, req, res)
      }
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
    } finally {
      next()
    }
  }
}

export default await buildHandler({ routes: pageRoutes })
