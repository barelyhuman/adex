import { renderToString } from 'adex/ssr'
import { getEntryHTML, ms, routerUtils, Youch } from 'adex/utils'
import { basename, extname, resolve } from 'node:path'
import qs from 'node:querystring'
import middleware from 'virtual:adex:middleware-entry'

import { normalizePath } from 'vite'

const viteDevServer = import.meta.env.DEV

const pageRoutes = import.meta.glob('./pages/**/*.page.{js,ts,jsx,tsx}')
const apiRoutes = import.meta.glob('./pages/**/*.api.{js,ts,jsx,tsx}')

export const sirvOptions = {
  maxAge: ms('1m')
}

const buildTemplate = ({
  page = '',
  mounter = '',
  prefillData = {},
  headTags = []
} = {}) => {
  return getEntryHTML()
    .replace(
      '<!--app-head-->',
      headTags.join('\n')
    )
    .replace(
      '<!--app-body-->',
      `
      <div id="root" ${mounter ? `mounter="${mounter}"` : ''}>${page}</div>
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
        return normalized.map((x) => {
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
        return normalized.map((x) => {
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

  const pageLoader = async (mod, handlerMeta, req, res) => {
    const url = req.url

    const headTags = []

    const manifest = await import('virtual:adex:server-manifest').then((d) =>
      'default' in d ? d.default : d
    ).catch((_) => undefined)
    // Clean up the route normalization ,
    // duplicate code
    if (import.meta.env.DEV) {
      const graphMod = await import('virtual:adex:dev-module-graph')
      const graph = graphMod.graph
      const matchedKey = Object.keys(graph).filter((x) => {
        return x.endsWith('.page' + extname(x))
      }).find((key) => {
        let base = key
          .replace(/(.js|.ts)x?$/, '')
          .replace(/^(src\/pages)/, '')
          .replace(/\.page$/, '')
          .replace(/\/index$/, '/')
          .replace(/\/$/, '')
        if (!base) {
          base = '/'
        }
        const matcher = routerUtils.paramMatcher(base, {
          decode: decodeURIComponent
        })
        return matcher(url)
      })
      if (graph[matchedKey]) {
        headTags.push(`<script type="module">
          ${graph[matchedKey].map((d) => `import "${d}"`)}
        </script>`)
      }
    } else if (manifest) {
      const matchedKey = Object.keys(manifest).filter((x) => {
        return x.endsWith(
          '.page' + extname(x)
        )
      }).find((key) => {
        let base = key
          .replace(/(.js|.ts)x?$/, '')
          .replace(/^(src\/pages)/, '')
          .replace(/\.page$/, '')
          .replace(/\/index$/, '/')
          .replace(/\/$/, '')

        if (!base) {
          base = '/'
        }
        const matcher = routerUtils.paramMatcher(base, {
          decode: decodeURIComponent
        })
        return matcher(url)
      })

      if (manifest[matchedKey]) {
        manifest[matchedKey].css.forEach((path) => {
          headTags.push(`<link rel="stylesheet" href="/${path}">`)
        })
      }
    }

    const str = renderToString(mod.default())
    const html = buildTemplate({
      page: str,
      headTags
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
      const promise = new Promise((resolve) => {
        _resolve = resolve
      })

      middleware(req, res, () => {
        _resolve()
      })

      await promise

      let mappedHandler
      let usingApi = false
      const hasMappedPage = routesWithURL.find((item) => {
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
        const hasMappedAPI = apiRoutesWithURL.find((item) => {
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
