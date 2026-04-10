/**
 * @param {Request} request
 */
export default request => {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const message = searchParams.get('message')
  const errorBody = msg => (msg ? JSON.stringify({ error: msg }) : null)
  const jsonHeaders = { 'content-type': 'application/json' }

  switch (type) {
    case 'badRequest':
      return new Response(errorBody(message), {
        status: 400,
        headers: jsonHeaders,
      })
    case 'unauthorized':
      return new Response(errorBody(message), {
        status: 401,
        headers: jsonHeaders,
      })
    case 'forbidden':
      return new Response(errorBody(message), {
        status: 403,
        headers: jsonHeaders,
      })
    case 'notFound':
      return new Response(errorBody(message), {
        status: 404,
        headers: jsonHeaders,
      })
    case 'internalServerError':
      return new Response(errorBody(message), {
        status: 500,
        headers: jsonHeaders,
      })
    default:
      return Response.json({
        usage:
          'Add ?type=badRequest&message=Custom%20message to test status helpers',
        available: [
          'badRequest',
          'unauthorized',
          'forbidden',
          'notFound',
          'internalServerError',
        ],
      })
  }
}
