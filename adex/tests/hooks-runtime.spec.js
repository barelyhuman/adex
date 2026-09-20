import { after, before, describe, it } from 'node:test'
import assert from 'node:assert'

import { buildFixture, launchDemoDevServer, launchProdServer } from './utils.js'

const HOOK_STYLE = 'adex-hooks-test'
const HOOK_HEADER = 'x-adex-hook'

/**
 * @param {string | URL} origin
 */
async function assertHookedPage(origin) {
  const response = await fetch(new URL('/', origin))
  assert.strictEqual(response.status, 200)
  const html = await response.text()
  assert.match(html, /Hooks Home/)
  assert.match(
    html,
    new RegExp(`<style id="${HOOK_STYLE}">\\.hooked\\{color:red\\}</style>`)
  )
}

/**
 * @param {string | URL} origin
 */
async function assertHookedApi(origin) {
  const response = await fetch(new URL('/api/hello', origin))
  assert.strictEqual(response.status, 200)
  assert.strictEqual(response.headers.get(HOOK_HEADER), 'before-api')
  assert.deepStrictEqual(await response.json(), { pong: true })
}

/**
 * @param {string | URL} origin
 */
async function assertHookedNotFound(origin) {
  const response = await fetch(new URL('/missing-page', origin))
  assert.strictEqual(response.status, 200)
  const html = await response.text()
  assert.match(html, /404 \| Not Found/)
  assert.match(html, new RegExp(`id="${HOOK_STYLE}"`))
}

describe('hooks runtime', { concurrency: false }, () => {
  describe('devMode', async () => {
    const origin = new URL('http://localhost:5174/')
    let proc
    before(async () => {
      proc = await launchDemoDevServer('tests/fixtures/hooks', { port: 5174 })
    })
    after(() => {
      proc?.kill()
    })

    await it('injects CSS from afterPageRender into SSR HTML', async () => {
      await assertHookedPage(origin)
    })

    await it('runs beforeAPICall on API routes', async () => {
      await assertHookedApi(origin)
    })

    await it('injects CSS on HTML 404 pages', async () => {
      await assertHookedNotFound(origin)
    })
  })

  describe('built', async () => {
    const origin = new URL('http://localhost:4174/')
    let proc
    before(async () => {
      await buildFixture('tests/fixtures/hooks')
      proc = await launchProdServer('tests/fixtures/hooks', { port: 4174 })
    })
    after(() => {
      proc?.kill()
    })

    await it('injects CSS from afterPageRender into SSR HTML', async () => {
      await assertHookedPage(origin)
    })

    await it('runs beforeAPICall on API routes', async () => {
      await assertHookedApi(origin)
    })

    await it('injects CSS on HTML 404 pages', async () => {
      await assertHookedNotFound(origin)
    })
  })
})
