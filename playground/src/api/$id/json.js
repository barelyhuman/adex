/**
 * @param {Request} req
 */
export default req => {
  return new Response(
    JSON.stringify({
      message: `Hello in ${req.params.id}`,
    }),
    {
      headers: {
        'content-type': 'application/json',
      },
    }
  )
}
