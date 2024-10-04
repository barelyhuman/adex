import { existsSync, readFileSync } from 'node:fs'
import http from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

//@ts-expect-error internal requires
import { sirv, mri } from 'adex/ssr'

//@ts-expect-error vite virtual import
import { handler } from 'virtual:adex:handler'

const flags = mri(process.argv.slice(2))

const PORT = flags.port || process.env.PORT || 3000
const HOST = flags.host || process.env.HOST || 'localhost'

const __dirname = dirname(fileURLToPath(import.meta.url))

const clientAssets = sirv(join(__dirname, '../client'), {
  maxAge: 31536000,
  immutable: true,
  onNoMatch: defaultHandler,
})

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

// function getServerManifest() {
//   const manifestPath = join(__dirname, 'manifest.json')
//   if (existsSync(manifestPath)) {
//     const manifestFile = readFileSync(manifestPath, 'utf8')
//     return parseManifest(manifestFile)
//   }
//   return {}
// }

function getClientManifest() {
  const manifestPath = join(__dirname, '../client/manifest.json')
  if (existsSync(manifestPath)) {
    const manifestFile = readFileSync(manifestPath, 'utf8')
    return parseManifest(manifestFile)
  }
  return {}
}

function addDependencyAssets(template, pageRoute) {
  if (!pageRoute) {
    return template
  }
  const manifest = getClientManifest()
  let links = []
  let scripts = []
  const filePath = pageRoute.startsWith('/') ? pageRoute.slice(1) : pageRoute
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

    const depsHasCSS = manifest[filePath].imports
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
  return template.replace(
    '</head>',
    links.join('\n') + scripts.join('\n') + '</head>'
  )
}

http
  .createServer((req, res) => {
    const originalUrl = req.url
    req.url = req.url.replace(/(\/?client\/?)/, '/')
    return clientAssets(req, res, () => {
      req.url = originalUrl
      defaultHandler(req, res)
    })
  })
  .listen(PORT, HOST, () => {
    console.log(`Listening on ${HOST}:${PORT}`)
  })
