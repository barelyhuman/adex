import { describe, it } from 'node:test'
import assert from 'node:assert'
import { EventEmitter } from 'node:events'
import { nodeRequestToFetch, fetchResponseToNode } from '../src/http.js'

/**
 * Minimal mock of Node's IncomingMessage, enough for nodeRequestToFetch.
 */
function mockIncomingMessage({
  method = 'GET',
  url = '/',
  headers = { host: 'localhost' },
  body = null,
  encrypted = false,
} = {}) {
  const req = new EventEmitter()
  req.method = method
  req.url = url
  req.headers = headers
  req.socket = { encrypted }

  // Emit body chunks on next tick so callers can attach listeners first
  if (body != null && method !== 'GET' && method !== 'HEAD') {
    process.nextTick(() => {
      req.emit('data', Buffer.from(body))
      req.emit('end')
    })
  } else {
    process.nextTick(() => req.emit('end'))
  }

  return req
}

/**
 * Minimal mock of Node's ServerResponse.
 */
class MockServerResponse {
  constructor() {
    this.statusCode = 200
    this.headers = {}
    this.chunks = []
    this.ended = false
  }
  setHeader(name, value) {
    this.headers[name.toLowerCase()] = value
  }
  write(data) {
    this.chunks.push(data)
  }
  end() {
    this.ended = true
  }
  body() {
    return Buffer.concat(this.chunks.map(c => Buffer.from(c))).toString('utf8')
  }
}

describe('nodeRequestToFetch', () => {
  it('converts a GET request with no body', async () => {
    const req = mockIncomingMessage({ method: 'GET', url: '/hello' })
    const fetchReq = await nodeRequestToFetch(req)

    assert.strictEqual(fetchReq.method, 'GET')
    assert.ok(fetchReq.url.endsWith('/hello'))
    assert.strictEqual(fetchReq.body, null)
  })

  it('reconstructs URL from req.url and Host header', async () => {
    const req = mockIncomingMessage({
      method: 'GET',
      url: '/path?q=1',
      headers: { host: 'example.com' },
    })
    const fetchReq = await nodeRequestToFetch(req)

    assert.strictEqual(new URL(fetchReq.url).host, 'example.com')
    assert.strictEqual(new URL(fetchReq.url).pathname, '/path')
    assert.strictEqual(new URL(fetchReq.url).search, '?q=1')
  })

  it('uses https scheme when socket is encrypted', async () => {
    const req = mockIncomingMessage({
      method: 'GET',
      url: '/',
      headers: { host: 'secure.example.com' },
      encrypted: true,
    })
    const fetchReq = await nodeRequestToFetch(req)

    assert.ok(fetchReq.url.startsWith('https://'))
  })

  it('copies request headers', async () => {
    const req = mockIncomingMessage({
      method: 'GET',
      url: '/',
      headers: {
        'host': 'localhost',
        'x-custom-header': 'my-value',
        'accept': 'application/json',
      },
    })
    const fetchReq = await nodeRequestToFetch(req)

    assert.strictEqual(fetchReq.headers.get('x-custom-header'), 'my-value')
    assert.strictEqual(fetchReq.headers.get('accept'), 'application/json')
  })

  it('buffers POST body into the Request', async () => {
    const payload = JSON.stringify({ hello: 'world' })
    const req = mockIncomingMessage({
      method: 'POST',
      url: '/api/data',
      headers: { 'host': 'localhost', 'content-type': 'application/json' },
      body: payload,
    })
    const fetchReq = await nodeRequestToFetch(req)

    assert.strictEqual(fetchReq.method, 'POST')
    const text = await fetchReq.text()
    assert.strictEqual(text, payload)
  })

  it('HEAD request has no body', async () => {
    const req = mockIncomingMessage({ method: 'HEAD', url: '/' })
    const fetchReq = await nodeRequestToFetch(req)

    assert.strictEqual(fetchReq.method, 'HEAD')
    assert.strictEqual(fetchReq.body, null)
  })
})

describe('fetchResponseToNode', () => {
  it('copies status code', async () => {
    const response = new Response('', { status: 201 })
    const res = new MockServerResponse()
    await fetchResponseToNode(response, res)

    assert.strictEqual(res.statusCode, 201)
    assert.strictEqual(res.ended, true)
  })

  it('copies response headers, skipping x-adex-* headers', async () => {
    const response = new Response('', {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-adex-page-route': '/should-be-skipped',
        'x-custom': 'kept',
      },
    })
    const res = new MockServerResponse()
    await fetchResponseToNode(response, res)

    assert.strictEqual(res.headers['content-type'], 'application/json')
    assert.strictEqual(res.headers['x-custom'], 'kept')
    assert.strictEqual(res.headers['x-adex-page-route'], undefined)
  })

  it('writes body buffer to res', async () => {
    const response = new Response('hello adex', { status: 200 })
    const res = new MockServerResponse()
    await fetchResponseToNode(response, res)

    assert.strictEqual(res.body(), 'hello adex')
    assert.strictEqual(res.ended, true)
  })

  it('handles a 404 response with no body', async () => {
    const response = new Response(null, { status: 404 })
    const res = new MockServerResponse()
    await fetchResponseToNode(response, res)

    assert.strictEqual(res.statusCode, 404)
    assert.strictEqual(res.ended, true)
    assert.strictEqual(res.body(), '')
  })
})
