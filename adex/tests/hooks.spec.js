import assert from 'node:assert'
import { after, describe, it } from 'node:test'

import {
  afterAPICall,
  afterPageRender,
  beforeAPICall,
  beforePageRender,
  CONSTANTS,
  emitToHooked,
  resetHooks,
} from '../src/hooks.js'

describe('hooks registry', () => {
  after(() => {
    resetHooks()
  })

  it('runs afterPageRender handlers in order and allows mutating html', async () => {
    resetHooks()
    /** @type {string[]} */
    const seen = []
    afterPageRender(ctx => {
      seen.push('first')
      ctx.html += '<!--first-->'
    })
    afterPageRender(ctx => {
      seen.push('second')
      ctx.html += '<!--second-->'
    })

    const ctx = { html: '<html></html>' }
    await emitToHooked(CONSTANTS.afterPageRender, ctx)

    assert.deepStrictEqual(seen, ['first', 'second'])
    assert.strictEqual(ctx.html, '<html></html><!--first--><!--second-->')
  })

  it('resetHooks drops previously registered listeners', async () => {
    resetHooks()
    let called = false
    beforePageRender(() => {
      called = true
    })
    resetHooks()
    await emitToHooked(CONSTANTS.beforePageRender, {})
    assert.strictEqual(called, false)
  })

  it('runs API hooks with the given context', async () => {
    resetHooks()
    const req = { url: '/api/hello' }
    const res = { headers: {} }
    beforeAPICall(ctx => {
      ctx.res.headers['x-before'] = '1'
    })
    afterAPICall(ctx => {
      ctx.res.headers['x-after'] = '1'
    })

    const ctx = { req, res }
    await emitToHooked(CONSTANTS.beforeApiCall, ctx)
    await emitToHooked(CONSTANTS.afterApiCall, ctx)

    assert.strictEqual(res.headers['x-before'], '1')
    assert.strictEqual(res.headers['x-after'], '1')
  })
})
