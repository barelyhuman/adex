import { after, before, describe, it } from 'node:test'
import assert from 'node:assert'

import { devServerURL, launchDemoDevServer } from './utils.js'
import { snapshot } from '@barelyhuman/node-snapshot'

describe('devMode ssr minimal', async () => {
  let devServerProc
  before(async () => {
    devServerProc = await launchDemoDevServer('tests/fixtures/minimal')
  })
  after(async () => {
    devServerProc.kill()
  })

  await it('gives a non-static ssr response', async ctx => {
    const response = await fetch(devServerURL).then(d => d.text())
    snapshot(ctx, response)
  })

  await it('gives a static SSR response', async ctx => {
    const response2 = await fetch(new URL('/about', devServerURL)).then(d =>
      d.text()
    )
    snapshot(ctx, response2)
  })

  await it('blank styles', async ctx => {
    const response = await fetch(
      new URL('/virtual:adex:global.css', devServerURL)
    ).then(d => d.text())
    snapshot(
      ctx,
      response.replaceAll(
        '\\u0000virtual:adex:global.css',
        'virtual:adex:global.css'
      )
    )
  })

  await it('API route returns JSON with 200', async () => {
    const response = await fetch(new URL('/api/ping', devServerURL))
    const json = await response.json()

    assert.strictEqual(response.status, 200)
    assert.strictEqual(json.ok, true)
    assert.strictEqual(json.method, 'GET')
  })

  await it('unknown route returns 404', async () => {
    const response = await fetch(
      new URL('/this-route-does-not-exist', devServerURL)
    )
    assert.strictEqual(response.status, 404)
  })
})
