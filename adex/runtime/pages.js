import { pathToRegex } from 'adex/ssr'

const pages = import.meta.glob('#{__PLUGIN_PAGES_ROOT}')

export const routes = normalizeRouteImports(pages, [
  new RegExp('#{__PLUGIN_PAGES_ROOT_REGEX}'),
  '#{__PLUGIN_PAGES_ROOT_REGEX_REPLACER}',
])

// taken from
// https://github.com/cyco130/smf/blob/c4b601f48cd3b3b71bea6d76b52b9a85800813e4/smf/shared.ts#L22
// as it's decently tested and aligns to what we want for our routing
function compareRoutePatterns(a, b) {
  // Non-catch-all routes first: /foo before /$$rest
  const catchAll = Number(a.match(/\$\$(\w+)$/)) - Number(b.match(/\$\$(\w+)$/))
  if (catchAll) return catchAll

  // Split into segments
  const aSegments = a.split('/')
  const bSegments = b.split('/')

  // Routes with fewer dynamic segments first: /foo/bar before /foo/$bar
  const dynamicSegments =
    aSegments.filter(segment => segment.includes('$')).length -
    bSegments.filter(segment => segment.includes('$')).length
  if (dynamicSegments) return dynamicSegments

  // Routes with fewer segments first: /foo/bar before /foo/bar
  const segments = aSegments.length - bSegments.length
  if (segments) return segments

  // Routes with earlier dynamic segments first: /foo/$bar before /$foo/bar
  for (let i = 0; i < aSegments.length; i++) {
    const aSegment = aSegments[i]
    const bSegment = bSegments[i]
    const dynamic =
      Number(aSegment.includes('$')) - Number(bSegment.includes('$'))
    if (dynamic) return dynamic

    // Routes with more dynamic subsegments at this position first: /foo/$a-$b before /foo/$a
    const subsegments = aSegment.split('$').length - bSegment.split('$').length
    if (subsegments) return subsegments
  }

  // Equal as far as we can tell
  return 0
}

function normalizeRouteImports(imports, baseKeyMatcher) {
  return Object.keys(imports)
    .sort(compareRoutePatterns)
    .map(route => {
      const routePath = simplifyPath(route).replace(
        baseKeyMatcher[0],
        baseKeyMatcher[1]
      )

      const regex = pathToRegex(routePath)

      return {
        route,
        regex,
        routePath,
        module: imports[route],
      }
    })
}

function simplifyPath(path) {
  return path
    .replace(/(\.(js|ts)x?)/, '')
    .replace(/index/, '/')
    .replace('//', '/')
    .replace(/\$\$/, '*')
    .replace(/\$/, ':')
}
