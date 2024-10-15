/**
 * @param {Request} req
 */
export default req => {
  return new Response(`Hello from ${req.params.id}`)
}
