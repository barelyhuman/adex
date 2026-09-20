import { describe, it, after } from 'node:test'
import assert from 'node:assert'
import { env } from '../src/env.js'

describe('env', () => {
  const key = 'ADEX_TEST_ENV_KEY'

  after(() => {
    delete process.env[key]
  })

  it('get returns process.env value when set', () => {
    process.env[key] = 'from-env'
    assert.strictEqual(env.get(key), 'from-env')
  })

  it('get returns default when key is missing', () => {
    delete process.env[key]
    assert.strictEqual(env.get(key, 'fallback'), 'fallback')
  })

  it('get returns empty string as default when omitted', () => {
    delete process.env[key]
    assert.strictEqual(env.get(key), '')
  })

  it('set writes to process.env', () => {
    env.set(key, 'written')
    assert.strictEqual(process.env[key], 'written')
    assert.strictEqual(env.get(key), 'written')
  })
})
