/**
 * @param {Request} request
 */
export default request => {
  const { pathname } = new URL(request.url)
  // route: /api/:id/json — id is the second path segment
  const id = pathname.split('/')[2]
  return Response.json({ message: `Hello in ${id}` })
}
