export { toStatic } from 'hoofd/preact'
export { renderToString } from 'preact-render-to-string'

export function normalizeRouteImports<Routes>(
  obj: Routes,
  matcher: [RegExp, string]
): Record<
  string,
  {
    route: string
    regex: {
      pattern: RegExp
      keys: string[]
    }
    routePath: string
    module: () => Promise<{
      default: () => any
    }>
  }
>
