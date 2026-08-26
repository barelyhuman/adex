import { existsSync } from 'node:fs'
import http from 'node:http'

import { useMiddleware } from 'adex/ssr'
import { createStaticMiddlewares } from 'adex/static'

import { handler } from 'virtual:adex:handler'

let islandMode = false

function createHandler({
  manifests,
  paths,
  staticServer = createStaticMiddlewares,
}) {
  islandMode = Boolean(paths.islands && existsSync(paths.islands))

  async function defaultHandler(req, res) {
    const { html: template, pageRoute, serverHandler } = await handler(req, res)
    if (serverHandler) {
      return serverHandler(req, res)
    }

    const templateWithDeps = addDependencyAssets(
      template,
      pageRoute,
      manifests.server,
      manifests.client
    )

    const finalHTML = templateWithDeps
    res.setHeader('content-type', 'text/html')
    res.write(finalHTML)
    res.end()
  }

  const staticMiddlewares = staticServer({ paths })
  const list = Array.isArray(staticMiddlewares)
    ? staticMiddlewares
    : [staticMiddlewares]

  return useMiddleware(...list, defaultHandler)
}

// function parseManifest(manifestString) {
//   try {
//     const manifestJSON = JSON.parse(manifestString)
//     return manifestJSON
//   } catch (err) {
//     return {}
//   }
// }

// function getServerManifest() {
//   const manifestPath = join(__dirname, 'manifest.json')
//   if (existsSync(manifestPath)) {
//     const manifestFile = readFileSync(manifestPath, 'utf8')
//     return parseManifest(manifestFile)
//   }
//   return {}
// }

// function getClientManifest() {
//   const manifestPath = join(__dirname, '../client/manifest.json')
//   if (existsSync(manifestPath)) {
//     const manifestFile = readFileSync(manifestPath, 'utf8')
//     return parseManifest(manifestFile)
//   }
//   return {}
// }

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

  // TODO: move it up the chain
  const rootClientFile = 'virtual:adex:client'
  // if root manifest, also add it's css imports in
  if (!islandMode && manifest[rootClientFile]) {
    const graph = manifest[rootClientFile]
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

function addDependencyAssets(
  template,
  pageRoute,
  serverManifest,
  clientManifest
) {
  if (!pageRoute) {
    return template
  }

  const filePath = pageRoute.startsWith('/') ? pageRoute.slice(1) : pageRoute

  const { links: serverLinks } = manifestToHTML(serverManifest, filePath)

  const { links: clientLinks, scripts: clientScripts } = manifestToHTML(
    clientManifest,
    filePath
  )

  const links = [...serverLinks, ...clientLinks]
  const scripts = [...clientScripts]

  return template.replace(
    '</head>',
    links.join('\n') + scripts.join('\n') + '</head>'
  )
}

export const createServer = ({
  port = '3000',
  host = '127.0.0.1',
  adex = {
    manifests: {
      server: {},
      client: {},
    },
    paths: {},
  },
} = {}) => {
  const handler = createHandler(adex)
  const server = http.createServer(handler)

  return {
    run() {
      return server.listen(port, host, () => {
        console.log(`Listening on ${host}:${port}`)
      })
    },
    fetch: undefined,
  }
}
