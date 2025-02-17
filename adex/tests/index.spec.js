import { snapshot } from '@barelyhuman/node-snapshot'
import { after, before, describe, it } from 'node:test'

import { devServerURL, launchDemoDevServer } from './utils.js'

describe('ssr minimal', async () => {
  let devServerProc
  before(async () => {
    devServerProc = await launchDemoDevServer('tests/fixtures/minimal')
  })
  after(async () => {
    devServerProc.kill()
  })

  await it('basic response', async ctx => {
    const response = await fetch(devServerURL).then(d => d.text())
    snapshot(ctx, response)

    const response2 = await fetch(new URL('/about', devServerURL)).then(d =>
      d.text()
    )
    snapshot(ctx, response2)
  })
})
