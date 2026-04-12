/**
 * @param {Request} request
 */
export default request => {
  const { pathname } = new URL(request.url)
  // route: /api/:id/hello — id is the second path segment
  const id = pathname.split('/')[2]
  return new Response(`Hello from ${id}`, {
    headers: { 'content-type': 'text/plain' },
  })
}
