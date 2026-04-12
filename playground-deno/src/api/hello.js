import { env } from 'adex/env'

/**
 * @param {Request} request
 */
export default request => {
  return Response.json({
    pong: true,
    appUrl: env.get('APP_URL'),
  })
}
