import { after, before, describe, it } from 'node:test'
import assert from 'node:assert'

import { devServerURL, launchDemoDevServer } from './utils.js'

describe('devMode behaviours', async () => {
  let devServerProc
  before(async () => {
    devServerProc = await launchDemoDevServer('tests/fixtures/behaviours')
  })
  after(async () => {
    devServerProc.kill()
  })

  await it('GET /api/hello returns JSON', async () => {
    const response = await fetch(new URL('/api/hello', devServerURL))
    assert.strictEqual(response.status, 200)
    assert.match(response.headers.get('content-type') || '', /application\/json/)
    assert.deepStrictEqual(await response.json(), { pong: true })
  })

  await it('GET /api/html returns HTML via res.html', async () => {
    const response = await fetch(new URL('/api/html', devServerURL))
    assert.strictEqual(response.status, 200)
    assert.match(response.headers.get('content-type') || '', /text\/html/)
    assert.strictEqual(await response.text(), '<h1>Html Response</h1>')
  })

  await it('GET /api/:id/hello includes route params in text', async () => {
    const response = await fetch(new URL('/api/abc/hello', devServerURL))
    assert.strictEqual(response.status, 200)
    assert.match(response.headers.get('content-type') || '', /text\/plain/)
    assert.strictEqual(await response.text(), 'Hello from abc')
  })

  await it('POST /api/echo parses JSON body', async () => {
    const response = await fetch(new URL('/api/echo', devServerURL), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ echo: true, n: 1 }),
    })
    assert.strictEqual(response.status, 200)
    assert.match(response.headers.get('content-type') || '', /application\/json/)
    assert.deepStrictEqual(await response.json(), { echo: true, n: 1 })
  })

  await it('GET /api/missing returns 404 Not found', async () => {
    const response = await fetch(new URL('/api/missing', devServerURL))
    assert.strictEqual(response.status, 404)
    assert.strictEqual(await response.text(), 'Not found')
  })

  await it('GET /:id/hello page includes the param in SSR HTML', async () => {
    const response = await fetch(new URL('/xyz/hello', devServerURL))
    assert.strictEqual(response.status, 200)
    const html = await response.text()
    assert.match(html, /Hello from xyz/)
  })

  await it('unknown page returns 404 | Not Found', async () => {
    const response = await fetch(new URL('/does-not-exist', devServerURL))
    assert.strictEqual(response.status, 200)
    const html = await response.text()
    assert.match(html, /404 \| Not Found/)
  })
})
