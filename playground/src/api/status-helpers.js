/**
 * @param {import("adex/http").IncomingMessage} req
 * @param {import("adex/http").ServerResponse} res
 */
export default (req, res) => {
  const { pathname, searchParams } = new URL(req.url, 'http://localhost')
  const type = searchParams.get('type')
  const message = searchParams.get('message')

  switch (type) {
    case 'badRequest':
      return res.badRequest(message)
    case 'unauthorized':
      return res.unauthorized(message)
    case 'forbidden':
      return res.forbidden(message)
    case 'notFound':
      return res.notFound(message)
    case 'internalServerError':
      return res.internalServerError(message)
    default:
      return res.json({
        usage: 'Add ?type=badRequest&message=Custom%20message to test status helpers',
        available: ['badRequest', 'unauthorized', 'forbidden', 'notFound', 'internalServerError']
      })
  }
}