import { normalizeRouteImports, renderToString, toStatic } from 'adex/ssr'
import { h } from 'preact'

const apiRoutes = import.meta.glob('/src/api/**/*.{js,ts}')
const pageRoutes = import.meta.glob('/src/pages/**/*.{tsx,jsx,js}')

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

  if (pageRouteMap[matchedInPages]) {
    const module = await pageRouteMap[matchedInPages].module()
    const render = 'default' in module ? module.default : module
    const routeParams = getRouteParams(baseURL, pageRouteMap, matchedInPages)
    const htmlString = renderToString(
      h(
        HTMLTemplate,
        {
          entryPage: pageRouteMap[matchedInPages].route,
          routeParams: Buffer.from(
            JSON.stringify(routeParams),
            'utf8'
          ).toString('base64'),
        },
        h(render, { routeParams })
      )
    )
    return { html: htmlString, pageRoute: pageRouteMap[matchedInPages].route }
  } else if (apiRouteMap[matchedInAPI]) {
    const module = await apiRouteMap[matchedInAPI].module()
    const routeParams = getRouteParams(baseURL, apiRouteMap, matchedInAPI)
    req.params = routeParams
    return {
      serverHandler:
        'default' in module ? module.default : (_, res) => res.end(),
    }
  }

  const { metas, links, title } = toStatic()

  return {
    html: renderToString(
      h(
        HTMLTemplate,
        {
          metas,
          links,
          title,
        },
        '404 | Not Found'
      )
    ),
  }
}

function HTMLTemplate({
  metas = [],
  links = [],
  title,
  entryPage,
  routeParams,
  children,
}) {
  return h(
    'html',
    {},
    h(
      'head',
      {},
      h('title', {}, title),
      ...links.map(props => h('link', { ...props })),
      ...metas.map(props => h('meta', { ...props }))
    ),
    h(
      'body',
      {},
      h(
        'div',
        {
          'id': 'app',
          'data-entry-page': entryPage,
          'data-route-params': routeParams,
        },
        ...[].concat(children)
      )
    )
  )
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
