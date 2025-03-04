import { snapshot } from '@barelyhuman/node-snapshot'
import { after, before, describe, it } from 'node:test'

import { devServerURL, launchDemoDevServer } from './utils.js'

describe('devMode ssr minimal', async () => {
  let devServerProc
  before(async () => {
    devServerProc = await launchDemoDevServer('tests/fixtures/minimal-no-ssr')
  })
  after(async () => {
    devServerProc.kill()
  })

  await it('gives a static response', async ctx => {
    const response2 = await fetch(new URL('/', devServerURL)).then(d =>
      d.text()
    )
    snapshot(ctx, response2)
  })

  await it('gives a static response', async ctx => {
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
})
