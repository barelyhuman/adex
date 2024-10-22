/**
 * @param {import("adex/http").IncomingMessage} req
 * @param {import("adex/http").ServerResponse} res
 */
export default (req, res) => {
  return res.text(`Hello from ${req.params.id}`)
}
