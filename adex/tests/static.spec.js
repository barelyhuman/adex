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
  it('defaults to sirv', () => {
    assert.strictEqual(
      resolveStaticServerModuleSource(),
      `export { default } from 'sirv'\n`
    )
    assert.strictEqual(
      resolveStaticServerModuleSource(undefined),
      `export { default } from 'sirv'\n`
    )
  })

  it('disables with a no-op factory when false', () => {
    const source = resolveStaticServerModuleSource(false)
    assert.match(source, /export default function serve/)
    assert.match(source, /next\(\)/)
    assert.doesNotMatch(source, /sirv/)
  })

  it('re-exports a custom module id', () => {
    assert.strictEqual(
      resolveStaticServerModuleSource('./src/my-serve.js'),
      `export { default } from "./src/my-serve.js"\n`
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
})
