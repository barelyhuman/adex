import { env } from 'adex/env'
/**
 * @param {import("adex/http").IncomingMessage} req
 * @param {import("adex/http").ServerResponse} res
 */
export default (req, res) => {
  return res.json({
    pong: true,
    appUrl: env.get('APP_URL'),
  })
}
