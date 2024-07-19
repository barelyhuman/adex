import { CONSTANTS, emitToHooked } from 'adex/hook'
import { normalizeRouteImports, renderToString, toStatic } from 'adex/ssr'
import { h } from 'preact'

const apiRoutes = import.meta.glob('/src/api/**/*.{js,ts}')
const pageRoutes = import.meta.glob('/src/pages/**/*.{tsx,jsx,js}')

const html = String.raw

export async function handler(req, res) {
  res.statusCode = 200

  prepareRequest(req)
  prepareResponse(res)

  const { pageRouteMap, apiRouteMap } = await getRouterMaps()
  const baseURL = req.url

  const matchedInPages = Object.keys(pageRouteMap).find(d => {
    return pageRouteMap[d].regex.pattern.test(baseURL)
  })

  const matchedInAPI = Object.keys(apiRouteMap).find(d => {
    return apiRouteMap[d].regex.pattern.test(baseURL)
  })

  const { metas, links, title, lang } = toStatic()

  if (pageRouteMap[matchedInPages]) {
    const module = await pageRouteMap[matchedInPages].module()
    const render = 'default' in module ? module.default : module
    const routeParams = getRouteParams(baseURL, pageRouteMap, matchedInPages)

    const htmlString = HTMLTemplate({
      metas,
      links,
      title,
      lang,
      entryPage: pageRouteMap[matchedInPages].route,
      routeParams: Buffer.from(JSON.stringify(routeParams), 'utf8').toString(
        'base64'
      ),
      body: renderToString(h(render, { routeParams })),
    })
    const modifiableContext = {
      req: req,
      html: htmlString,
    }
    await emitToHooked(CONSTANTS.pageRender, modifiableContext)
    return {
      html: modifiableContext.html,
      pageRoute: pageRouteMap[matchedInPages].route,
    }
  } else if (apiRouteMap[matchedInAPI]) {
    const module = await apiRouteMap[matchedInAPI].module()
    const routeParams = getRouteParams(baseURL, apiRouteMap, matchedInAPI)
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
        <div
          id="app"
          data-entry-page="${entryPage}"
          data-route-params="${routeParams}"
        >
          ${body}
        </div>
      </body>
    </html>
  `
}

async function getRouterMaps() {
  const apiRouteMap = normalizeRouteImports(apiRoutes, [
    /^\/(src\/api)/,
    '/api',
  ])
  const pageRouteMap = normalizeRouteImports(pageRoutes, [
    /^\/(src\/pages)/,
    '',
  ])
  return {
    pageRouteMap,
    apiRouteMap,
  }
}

function getRouteParams(baseURL, routeMap, routeMapKey) {
  const matchedParams = baseURL.match(routeMap[routeMapKey].regex.pattern)
  const routeParams = regexToParams(routeMap, routeMapKey, matchedParams)
  return routeParams
}

function regexToParams(routeMap, routeMapKey, regexMatchGroup) {
  return routeMap[routeMapKey].regex.keys.reduce((acc, key, index) => {
    acc[key] = regexMatchGroup[index + 1]
    return acc
  }, {})
}

/**
 *
 * @param {import("node:http").IncomingMessage} req
 */
function prepareRequest(req) {
  req.parseBodyJSON = async function () {
    return new Promise((resolve, reject) => {
      let jsonChunk = ''
      req.on('data', chunk => {
        jsonChunk += chunk
      })
      req.on('error', err => {
        const oldStack = err.stack
        const newError = new Error(
          `failed to parse json body with error: ${err.message}`
        )
        newError.stack = oldStack + newError.stack
        reject(newError)
      })
      req.on('end', () => {
        try {
          const parsedJSON = JSON.parse(Buffer.from(jsonChunk).toString('utf8'))
          resolve(parsedJSON)
        } catch (err) {
          reject(err)
        }
      })
    })
  }
}

/**
 *
 * @param {import("node:http").ServerResponse} res
 */
function prepareResponse(res) {
  res.html = data => {
    if (typeof data !== 'string') {
      throw new Error('[res.html] only accepts html string')
    }
    res.setHeader('content-type', 'text/html')
    res.write(data)
    res.end()
  }
  res.text = data => {
    let _data = data
    if (typeof data !== 'string') {
      _data = JSON.stringify(data)
    }
    res.setHeader('content-type', 'text/plain')
    res.write(_data)
    res.end()
  }
  res.json = data => {
    const str = JSON.stringify(data)
    res.setHeader('content-type', 'application/json')
    res.write(str)
    res.end()
  }
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
