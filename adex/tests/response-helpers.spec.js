import { describe, it } from 'node:test'
import assert from 'node:assert'
import { prepareResponse } from '../src/http.js'

// Mock ServerResponse class
class MockServerResponse {
  constructor() {
    this.statusCode = 200
    this.headers = {}
    this.writtenData = []
    this.ended = false
  }

  setHeader(name, value) {
    this.headers[name] = value
  }

  write(data) {
    this.writtenData.push(data)
  }

  end() {
    this.ended = true
  }
}

describe('HTTP Response Helpers', () => {
  it('badRequest sets 400 status and ends response', () => {
    const res = new MockServerResponse()
    prepareResponse(res)

    res.badRequest()

    assert.strictEqual(res.statusCode, 400)
    assert.strictEqual(res.ended, true)
    assert.strictEqual(res.writtenData.length, 0)
  })

  it('badRequest with message sets 400 status and sends JSON error', () => {
    const res = new MockServerResponse()
    prepareResponse(res)

    res.badRequest('Invalid input')

    assert.strictEqual(res.statusCode, 400)
    assert.strictEqual(res.ended, true)
    assert.strictEqual(res.headers['content-type'], 'application/json')
    assert.strictEqual(
      res.writtenData[0],
      JSON.stringify({ error: 'Invalid input' })
    )
  })

  it('unauthorized sets 401 status', () => {
    const res = new MockServerResponse()
    prepareResponse(res)

    res.unauthorized('Authentication required')

    assert.strictEqual(res.statusCode, 401)
    assert.strictEqual(res.ended, true)
    assert.strictEqual(res.headers['content-type'], 'application/json')
    assert.strictEqual(
      res.writtenData[0],
      JSON.stringify({ error: 'Authentication required' })
    )
  })

  it('forbidden sets 403 status', () => {
    const res = new MockServerResponse()
    prepareResponse(res)

    res.forbidden('Access denied')

    assert.strictEqual(res.statusCode, 403)
    assert.strictEqual(res.ended, true)
    assert.strictEqual(res.headers['content-type'], 'application/json')
    assert.strictEqual(
      res.writtenData[0],
      JSON.stringify({ error: 'Access denied' })
    )
  })

  it('notFound sets 404 status', () => {
    const res = new MockServerResponse()
    prepareResponse(res)

    res.notFound('Resource not found')

    assert.strictEqual(res.statusCode, 404)
    assert.strictEqual(res.ended, true)
    assert.strictEqual(res.headers['content-type'], 'application/json')
    assert.strictEqual(
      res.writtenData[0],
      JSON.stringify({ error: 'Resource not found' })
    )
  })

  it('internalServerError sets 500 status', () => {
    const res = new MockServerResponse()
    prepareResponse(res)

    res.internalServerError('Something went wrong')

    assert.strictEqual(res.statusCode, 500)
    assert.strictEqual(res.ended, true)
    assert.strictEqual(res.headers['content-type'], 'application/json')
    assert.strictEqual(
      res.writtenData[0],
      JSON.stringify({ error: 'Something went wrong' })
    )
  })

  it('status helpers without message only set status and end', () => {
    const res = new MockServerResponse()
    prepareResponse(res)

    res.notFound()

    assert.strictEqual(res.statusCode, 404)
    assert.strictEqual(res.ended, true)
    assert.strictEqual(res.writtenData.length, 0)
    assert.strictEqual(res.headers['content-type'], undefined)
  })
})
