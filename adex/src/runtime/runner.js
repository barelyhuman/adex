import handler from 'virtual:adex:server-entry'
import http from 'node:http'
import { sirv } from 'adex/node-static'

// Init `sirv` handler
// eslint-disable-next-line no-undef
const assets = sirv(__ADEX_CLIENT_BUILD_OUTPUT_DIR, {
  maxAge: 24 * 60 * 60 * 1000, // 1d
  immutable: true,
  setHeaders (res, pathname, stats) {
    if (pathname.endsWith('.jsx')) {
      res.setHeader('Content-Type', 'text/javascript')
    }
  }
})

const server = http.createServer((req, res) => {
  assets(req, res, () => {
    handler(req, res, () => {
      if (!res.writableEnded) {
        res.statusCode = 404
        res.end()
      }
    })
  })
})

server.on('error', err => {
  console.error(err)
  throw err
})

const port = process.env.PORT || 3000

server.listen(port, (...args) => {
  const host = process.env.HOST || 'http://localhost'
  console.log(`Listening on ${host}:${port}`)
})
