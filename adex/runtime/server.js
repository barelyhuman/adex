import { existsSync, link, readFileSync } from 'node:fs'
import http from 'node:http'
import { env } from 'adex/env'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

//@ts-expect-error internal requires
import { sirv, mri } from 'adex/ssr'

//@ts-expect-error vite virtual import
import { handler } from 'virtual:adex:handler'

import 'virtual:adex:global.css'

const flags = mri(process.argv.slice(2))

const PORT = flags.port || parseInt(env.get('PORT', '3000'), 10)
const HOST = flags.host || env.get('HOST', 'localhost')

const __dirname = dirname(fileURLToPath(import.meta.url))

const serverAssets = sirv(join(__dirname, './assets'), {
  maxAge: 31536000,
  immutable: true,
  onNoMatch: defaultHandler,
})

let islandsWereGenerated = existsSync(join(__dirname, './islands'))

let islandAssets = (req, res, next) => {
  next()
}

if (islandsWereGenerated) {
  islandAssets = sirv(join(__dirname, './islands'), {
    maxAge: 31536000,
    immutable: true,
    onNoMatch: defaultHandler,
  })
}

let clientWasGenerated = existsSync(join(__dirname, '../client'))

let clientAssets = (req, res, next) => {
  next()
}

if (clientWasGenerated) {
  clientAssets = sirv(join(__dirname, '../client'), {
    maxAge: 31536000,
    immutable: true,
    onNoMatch: defaultHandler,
  })
}

async function defaultHandler(req, res) {
  const { html: template, pageRoute, serverHandler } = await handler(req, res)
  if (serverHandler) {
    return serverHandler(req, res)
  }

  const templateWithDeps = addDependencyAssets(template, pageRoute)

  const finalHTML = templateWithDeps
  res.setHeader('content-type', 'text/html')
  res.write(finalHTML)
  res.end()
}

function parseManifest(manifestString) {
  try {
    const manifestJSON = JSON.parse(manifestString)
    return manifestJSON
  } catch (err) {
    return {}
  }
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

function manifestToHTML(manifest, filePath) {
  let links = []
  let scripts = []

  // TODO: move it up the chain
  const rootServerFile = 'virtual:adex:server'
  // if root manifest, also add it's css imports in
  if (manifest[rootServerFile]) {
    const graph = manifest[rootServerFile]
    links = links.concat(
      (graph.css || []).map(
        d =>
          `<link
            rel="stylesheet"
            href="/${d}"
          />`
      )
    )
  }

  if (manifest[filePath]) {
    const graph = manifest[filePath]
    links = links.concat(
      (graph.css || []).map(
        d =>
          `<link
            rel="stylesheet"
            href="/${d}"
          />`
      )
    )
    const depsHasCSS = (manifest[filePath].imports || [])
      .map(d => manifest[d])
      .filter(d => d.css?.length)

    if (depsHasCSS.length) {
      links = links.concat(
        depsHasCSS.map(d =>
          d.css
            .map(
              p =>
                `<link
          rel="stylesheet"
          href="/${p}"
        />`
            )
            .join('\n')
        )
      )
    }

    scripts = scripts.concat(
      `<script src="${manifest[filePath].file}" type="module"></script>`
    )
  }
  return {
    scripts,
    links,
  }
}

function addDependencyAssets(template, pageRoute) {
  if (!pageRoute) {
    return template
  }
  const serverManifest = getServerManifest()
  const manifest = getClientManifest()
  const filePath = pageRoute.startsWith('/') ? pageRoute.slice(1) : pageRoute

  const { links: serverLinks, scripts: serverScripts } = manifestToHTML(
    serverManifest,
    filePath
  )
  const { links: clientLinks, scripts: clientScripts } = manifestToHTML(
    manifest,
    filePath
  )

  const links = [...serverLinks, ...clientLinks]
  const scripts = [...serverScripts, ...clientScripts]

  return template.replace(
    '</head>',
    links.join('\n') + scripts.join('\n') + '</head>'
  )
}

http
  .createServer((req, res) => {
    const originalUrl = req.url
    req.url = originalUrl.replace(/(\/?assets\/?)/, '/')
    serverAssets(req, res, () => {
      req.url = originalUrl.replace(/(\/?islands\/?)/, '/')
      return islandAssets(req, res, () => {
        req.url = originalUrl.replace(/(\/?client\/?)/, '/')
        return clientAssets(req, res, () => {
          req.url = originalUrl
          defaultHandler(req, res)
        })
      })
    })
  })
  .listen(PORT, HOST, () => {
    console.log(`Listening on ${HOST}:${PORT}`)
  })
