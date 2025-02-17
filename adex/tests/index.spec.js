import { beforeAll, describe, expect, it } from 'vitest'

import { devServerURL, launchDemoDevServer } from './utils.js'

describe('ssr minimal', () => {
  beforeAll(async () => {
    await launchDemoDevServer('tests/fixtures/minimal')
  })

  it('basic response', async () => {
    const response = await fetch(devServerURL).then(d => d.text())
    expect(response).toMatchSnapshot()

    const response2 = await fetch(new URL('/about', devServerURL)).then(d =>
      d.text()
    )
    expect(response2).toMatchSnapshot()
  })
})
