export {
  hydrate,
  Router,
  ErrorBoundary,
  Route,
  lazy,
  LocationProvider,
  useLocation,
  useRoute,
  prerender,
} from 'preact-iso'

export const join = (...parts) => {
  if (parts.some(part => part == null)) {
    throw new Error(
      'Expected join to get valid paths, but received undefined or null'
    )
  }
  return parts.join('/').replace(/\/{2,}/g, '/')
}
