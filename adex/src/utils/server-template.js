/**
 * Returns the standard server module template for adex
 *
 * @param {string} adapter - The adapter to use for the server
 * @returns {string} - The server template code
 */
export function getServerTemplate(adapter) {
  return `import { createServer } from '${adapter}'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { env } from 'adex/env'

import 'virtual:adex:font.css'
import 'virtual:adex:global.css'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PORT = parseInt(env.get('PORT', '3000'), 10)
const HOST = env.get('HOST', 'localhost')

const paths = {
  assets: join(__dirname, './assets'),
  islands: join(__dirname, './islands'),
  client: join(__dirname, '../client'),
}

function getServerManifest() {
  const manifestPath = join(__dirname, 'manifest.json')
  if (existsSync(manifestPath)) {
    const manifestFile = readFileSync(manifestPath, 'utf8')
    return parseManifest(manifestFile)
  }
  return {}
}

function getClientManifest() {
  const manifestPath = join(__dirname, '../client/manifest.json')
  if (existsSync(manifestPath)) {
    const manifestFile = readFileSync(manifestPath, 'utf8')
    return parseManifest(manifestFile)
  }
  return {}
}

function parseManifest(manifestString) {
  try {
    const manifestJSON = JSON.parse(manifestString)
    return manifestJSON
  } catch (err) {
    return {}
  }
}

const server = createServer({
  port: PORT,
  host: HOST,
  adex:{
    manifests:{server:getServerManifest(),client:getClientManifest()},
    paths,
  }
})

if ('run' in server) {
  server.run()
}

export default server.fetch
`
}
