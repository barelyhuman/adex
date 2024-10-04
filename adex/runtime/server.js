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
  const templateWithRootAssets = attachRootAssets(template, pageRoute)
  const templateWithDeps = addDependencyAssets(
    templateWithRootAssets,
    pageRoute
  )

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
    links = (graph.css || []).map(
      d =>
        `<link rel="stylesheet" href="/${d.replace(/^(\/?assets\/?)/, 'client/assets/')}" >`
    )
    scripts = (graph.imports || [])
      .filter(d => d !== 'virtual:adex:client')
      .map(d => {
        const modulePath = manifest[d]
        return `<script type="module" src="/${modulePath.file.replace(/^(\/?assets\/?)/, 'client/assets/')}" ></script>`
      })
  }
  return template.replace(
    '</head>',
    links.join('\n') + scripts.join('\n') + '</head>'
  )
}

function attachRootAssets(template) {
  const serverManifest = getServerManifest()
  const clientManifest = getClientManifest()
  let _newTemplate = template
  if (Object.keys(serverManifest).length) {
    const graph = serverManifest['virtual:adex:server']
    if (graph) {
      const links = (graph.css || []).map(
        d =>
          `<link rel="stylesheet" href="/${d.replace(/^(\/?assets\/?)/, '')}">`
      )
      _newTemplate = _newTemplate.replace(
        '</head>',
        links.join('\n') + '</head>'
      )
    }
  }
  if (Object.keys(clientManifest).length) {
    const graph = clientManifest['virtual:adex:client']
    if (graph) {
      const links = (graph.css || []).map(
        d =>
          `<link rel="stylesheet" href="/${d.replace(/^(\/?assets\/?)/, 'client/assets/')}">`
      )
      _newTemplate = _newTemplate
        .replace('</head>', links.join('\n') + '</head>')
        .replace(
          '</body>',
          `
        <script type="module" src="/${graph.file}"></script>
        </body>
        `
        )
    }
  }

  return _newTemplate
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
