import { describe, it } from 'node:test'
import assert from 'node:assert'
import { EventEmitter } from 'node:events'
import { prepareRequest } from '../src/http.js'

describe('HTTP Request Helpers', () => {
  it('parseBodyJSON resolves parsed JSON body', async () => {
    const req = new EventEmitter()
    prepareRequest(req)

    const resultPromise = req.parseBodyJSON()
    req.emit('data', Buffer.from('{"hello":"world"}'))
    req.emit('end')

    assert.deepStrictEqual(await resultPromise, { hello: 'world' })
  })

  it('parseBodyJSON rejects invalid JSON', async () => {
    const req = new EventEmitter()
    prepareRequest(req)

    const resultPromise = req.parseBodyJSON()
    req.emit('data', Buffer.from('{not-json'))
    req.emit('end')

    await assert.rejects(resultPromise)
  })
})
