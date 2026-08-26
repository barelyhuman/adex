import { describe, it } from 'node:test'
import assert from 'node:assert'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { use as useMiddleware } from '@barelyhuman/tiny-use'
import {
  createStaticMiddlewares,
  resolveStaticServerModuleSource,
} from '../src/static.js'

describe('resolveStaticServerModuleSource', () => {
  it('defaults to the adex/static plugin', () => {
    assert.strictEqual(
      resolveStaticServerModuleSource(),
      `export { default } from 'adex/static'\n`
    )
    assert.strictEqual(
      resolveStaticServerModuleSource(undefined),
      `export { default } from 'adex/static'\n`
    )
  })

  it('disables with an empty middleware list when false', () => {
    const source = resolveStaticServerModuleSource(false)
    assert.match(source, /export default function staticServer/)
    assert.match(source, /return \[\]/)
    assert.doesNotMatch(source, /sirv/)
    assert.doesNotMatch(source, /adex\/static/)
  })

  it('re-exports a custom module id', () => {
    assert.strictEqual(
      resolveStaticServerModuleSource('./src/my-static.js'),
      `export { default } from "./src/my-static.js"\n`
    )
  })
})

describe('createStaticMiddlewares', () => {
  it('invokes a custom serve factory for existing paths', () => {
    const root = mkdtempSync(join(tmpdir(), 'adex-static-'))
    const assets = join(root, 'assets')
    const client = join(root, 'client')
    mkdirSync(assets)
    mkdirSync(client)
    writeFileSync(join(assets, 'a.txt'), 'a')
    writeFileSync(join(client, 'c.txt'), 'c')

    /** @type {string[]} */
    const servedDirs = []
    const serve = (dir, _opts) => {
      servedDirs.push(dir)
      return (_req, _res, next) => next()
    }

    createStaticMiddlewares({
      paths: { assets, client, islands: join(root, 'missing-islands') },
      serve,
    })

    assert.deepStrictEqual(servedDirs, [assets, client])
  })

  it('falls through when serve always calls next', async () => {
    const root = mkdtempSync(join(tmpdir(), 'adex-static-'))
    const assets = join(root, 'assets')
    mkdirSync(assets)
    writeFileSync(join(assets, 'a.txt'), 'a')

    const serve = () => (_req, _res, next) => next()
    let hitApp = false

    const handler = useMiddleware(
      ...createStaticMiddlewares({ paths: { assets }, serve }),
      async (_req, _res) => {
        hitApp = true
      }
    )

    await handler({ url: '/assets/a.txt' }, {})
    assert.strictEqual(hitApp, true)
  })

  it('rewrites asset URLs only inside the default stack', async () => {
    /** @type {string[]} */
    const seenUrls = []
    const serve = () => (req, _res, next) => {
      seenUrls.push(req.url)
      next()
    }

    const handler = useMiddleware(
      ...createStaticMiddlewares({
        paths: { assets: '/tmp/assets-does-not-need-to-exist-for-serve-mock' },
        serve,
      }),
      async () => {}
    )

    // paths.assets is truthy so serve() is used even if dir missing on disk
    await handler({ url: '/assets/app.js' }, {})
    assert.deepStrictEqual(seenUrls, ['/app.js'])
  })
})

describe('custom kernel.staticServer contract', () => {
  it('receives original URLs with no adex rewrite when replacing the factory', async () => {
    /** @type {string[]} */
    const seenUrls = []

    const staticServer = ({ paths }) => {
      assert.ok(paths)
      return (req, _res, next) => {
        seenUrls.push(req.url)
        next()
      }
    }

    const middlewares = staticServer({ paths: { assets: '/x' } })
    const list = Array.isArray(middlewares) ? middlewares : [middlewares]

    const handler = useMiddleware(...list, async () => {})

    await handler({ url: '/assets/app.js' }, {})
    assert.deepStrictEqual(seenUrls, ['/assets/app.js'])
  })
})
