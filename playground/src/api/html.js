/**
 * @param {import("adex/http").IncomingMessage} req
 * @param {import("adex/http").ServerResponse} res
 */
export default (req, res) => {
  return res.html(`<h1>Html Response</h1>`)
}
