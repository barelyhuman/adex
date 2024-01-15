import handler from 'virtual:adex:server-entry'
import http from 'node:http'

const server = http.createServer(handler)

server.on('error', err => {
  console.error(err)
  throw err
})

server.listen(3000)
