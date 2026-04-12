import { CONSTANTS, emitToHooked } from 'adex/hook'
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

/**
 * Core request handler — Fetch API native.
 * Receives a standard Request, returns a standard Response.
 * Page responses carry an `x-adex-page-route` header so the adapter
 * kernel can inject manifest assets before sending to the client.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function handler(request) {
  const { pathname } = new URL(request.url)
  const baseURL = normalizeRequestUrl(pathname)

  const { metas, links, title, lang } = toStatic()

  if (baseURL.startsWith('/api') || baseURL.startsWith('api')) {
    const matchedInAPI = apiRoutes.find(d => {
      return d.regex.pattern.test(baseURL)
    })

    if (matchedInAPI) {
      const module = await matchedInAPI.module()
      const context = { request }
      await emitToHooked(CONSTANTS.beforeApiCall, context)
      const handlerFn =
        'default' in module
          ? module.default
          : () => new Response('Not found', { status: 404 })
      const response = await handlerFn(context.request)
      await emitToHooked(CONSTANTS.afterApiCall, {
        request: context.request,
        response,
      })
      return response
    }

    return new Response('Not found', { status: 404 })
  }

  const matchedInPages = pageRoutes.find(d => {
    return d.regex.pattern.test(baseURL)
  })

  if (matchedInPages) {
    const routeParams = getRouteParams(baseURL, matchedInPages)

    // @ts-expect-error
    globalThis.location = new URL(request.url)

    const context = { request }
    await emitToHooked(CONSTANTS.beforePageRender, context)

    const rendered = await renderToStringAsync(
      h(App, { url: new URL(context.request.url).pathname }),
      {}
    )

    let htmlString = HTMLTemplate({
      metas,
      links,
      title,
      lang,
      entryPage: matchedInPages.route,
      routeParams: btoa(JSON.stringify(routeParams)),
      body: rendered,
    })

    const pageContext = { request: context.request, html: htmlString }
    await emitToHooked(CONSTANTS.afterPageRender, pageContext)
    htmlString = pageContext.html

    return new Response(htmlString, {
      status: 200,
      headers: {
        'content-type': 'text/html',
        'x-adex-page-route': matchedInPages.route,
      },
    })
  }

  return new Response(
    HTMLTemplate({
      metas,
      links,
      title,
      lang,
      body: '404 | Not Found',
    }),
    {
      status: 404,
      headers: { 'content-type': 'text/html' },
    }
  )
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
      return `${acc}<${tagName}${Object.keys(tag).reduce(
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
