import { normalizeRouteImports, renderToString, toStatic } from 'adex/ssr'
import { h } from 'preact'

const apiRoutes = import.meta.glob('/src/api/**/*.{js,ts}')
const pageRoutes = import.meta.glob('/src/pages/**/*.{tsx,jsx,js}')

export async function handler(req, res) {
  res.statusCode = 200

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

function HTMLTemplate({ metas = [], links = [], title, entryPage, children }) {
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
