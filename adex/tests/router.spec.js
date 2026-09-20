import { describe, it } from 'node:test'
import assert from 'node:assert'
import { join } from '../src/router.js'

describe('router.join', () => {
  it('joins path parts with a single slash', () => {
    assert.strictEqual(join('foo', 'bar'), 'foo/bar')
    assert.strictEqual(join('/foo/', '/bar'), '/foo/bar')
    assert.strictEqual(join('/foo/', '/bar/', 'baz'), '/foo/bar/baz')
  })

  it('throws when a part is null or undefined', () => {
    assert.throws(() => join('foo', null), {
      message:
        'Expected join to get valid paths, but received undefined or null',
    })
    assert.throws(() => join(undefined, 'bar'), {
      message:
        'Expected join to get valid paths, but received undefined or null',
    })
  })
})
