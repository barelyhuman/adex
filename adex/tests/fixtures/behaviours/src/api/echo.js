/**
 * @param {import("adex/http").IncomingMessage} req
 * @param {import("adex/http").ServerResponse} res
 */
export default async (req, res) => {
  const body = await req.parseBodyJSON()
  return res.json(body)
}
