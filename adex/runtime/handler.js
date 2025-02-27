import { CONSTANTS, emitToHooked } from 'adex/hook'
import { prepareRequest, prepareResponse } from 'adex/http'
import { toStatic } from 'adex/ssr'
import { renderToStringAsync } from 'adex/utils/isomorphic'
import { h } from 'preact'

// @ts-expect-error injected by vite
import { App } from 'virtual:adex:client'

// @ts-expect-error injected by vite
import { routes as apiRoutes } from '~apiRoutes'
// @ts-expect-error injected by vite
import { routes as pageRoutes } from '~routes'

const html = String.raw

export async function handler(req, res) {
  res.statusCode = 200

  prepareRequest(req)
  prepareResponse(res)

  const [url, search] = req.url.split('?')
  const baseURL = normalizeRequestUrl(url)

  const { metas, links, title, lang } = toStatic()

  if (baseURL.startsWith('/api') || baseURL.startsWith('api')) {
    const matchedInAPI = apiRoutes.find(d => {
      return d.regex.pattern.test(baseURL)
    })
    if (matchedInAPI) {
      const module = await matchedInAPI.module()
      const routeParams = getRouteParams(baseURL, matchedInAPI)
      req.params = routeParams
      const modifiableContext = {
        req: req,
      }
      await emitToHooked(CONSTANTS.apiCall, modifiableContext)
      return {
        serverHandler:
          'default' in module ? module.default : (_, res) => res.end(),
      }
    }
    return {
      serverHandler: (_, res) => {
        res.statusCode = 404
        res.end('Not found')
      },
    }
  }

  const matchedInPages = pageRoutes.find(d => {
    return d.regex.pattern.test(baseURL)
  })

  if (matchedInPages) {
    const routeParams = getRouteParams(baseURL, matchedInPages)

    // @ts-expect-error
    global.location = new URL(req.url, 'http://localhost')

    const rendered = await renderToStringAsync(h(App, { url: req.url }), {})

    const htmlString = HTMLTemplate({
      metas,
      links,
      title,
      lang,
      entryPage: matchedInPages.route,
      routeParams: Buffer.from(JSON.stringify(routeParams), 'utf8').toString(
        'base64'
      ),
      body: rendered,
    })
    const modifiableContext = {
      req: req,
      html: htmlString,
    }
    await emitToHooked(CONSTANTS.pageRender, modifiableContext)
    return {
      html: modifiableContext.html,
      pageRoute: matchedInPages.route,
    }
  }

  return {
    html: HTMLTemplate({
      metas,
      links,
      title,
      lang,
      body: '404 | Not Found',
    }),
  }
}

function HTMLTemplate({
  metas = [],
  links = [],
  title = '',
  lang = '',
  entryPage = '',
  routeParams = {},
  body = '',
}) {
  const headString = stringify(title, metas, links)
  return html`
    <!doctype html>
    <html lang="${lang ?? 'en'}">
      <head>
        <meta charset="UTF-8" />
        ${headString}
      </head>
      <body>
        <div id="app">${body}</div>
      </body>
    </html>
  `
}

function getRouteParams(baseURL, matchedRoute) {
  const matchedParams = baseURL.match(matchedRoute.regex.pattern)
  const routeParams = regexToParams(matchedRoute, matchedParams)
  return routeParams
}

function regexToParams(matchedRoute, regexMatchGroup) {
  return matchedRoute.regex.keys.reduce((acc, key, index) => {
    acc[key] = regexMatchGroup[index + 1]
    return acc
  }, {})
}

const stringify = (title, metas, links) => {
  const stringifyTag = (tagName, tags) =>
    tags.reduce((acc, tag) => {
      ;`${acc}<${tagName}${Object.keys(tag).reduce(
        (properties, key) => `${properties} ${key}="${tag[key]}"`,
        ''
      )}>`
    }, '')

  return `
    <title>${title}</title>

    ${stringifyTag('meta', metas)}
    ${stringifyTag('link', links)}
  `
}

function normalizeRequestUrl(url) {
  return url.replace(/\/(index\.html)$/, '/')
}
