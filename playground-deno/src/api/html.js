import { afterAPICall } from 'adex/hook'

afterAPICall(ctx => {
  console.log('called after api')
})

/**
 * @param {Request} request
 */
export default request => {
  return new Response(`<h1>Html Response</h1>`, {
    headers: { 'content-type': 'text/html' },
  })
}
