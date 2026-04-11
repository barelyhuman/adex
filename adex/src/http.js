/**
 * @param {import("./http.js").IncomingMessage} req
 */
export function prepareRequest(req) {
  req.parseBodyJSON = async function () {
    return new Promise((resolve, reject) => {
      let jsonChunk = ''
      req.on('data', chunk => {
        jsonChunk += chunk
      })
      req.on('error', err => {
        const oldStack = err.stack
        const newError = new Error(
          `failed to parse json body with error: ${err.message}`
        )
        newError.stack = oldStack + newError.stack
        reject(newError)
      })
      req.on('end', () => {
        try {
          const parsedJSON = JSON.parse(Buffer.from(jsonChunk).toString('utf8'))
          resolve(parsedJSON)
        } catch (err) {
          reject(err)
        }
      })
    })
  }
}

/**
 * Convert a Node.js IncomingMessage to a Fetch API Request.
 * Reconstructs the full URL from req.url + Host header.
 * Reads and buffers the body stream.
 * @param {import("./http.js").IncomingMessage} req
 * @returns {Promise<Request>}
 */
export async function nodeRequestToFetch(req) {
  const protocol = req.socket?.encrypted ? 'https' : 'http'
  const host = req.headers['host'] ?? 'localhost'
  const url = new URL(req.url, `${protocol}://${host}`)

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v)
    } else if (value != null) {
      headers.set(key, value)
    }
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  let body = undefined
  if (hasBody) {
    body = await new Promise((resolve, reject) => {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => resolve(Buffer.concat(chunks)))
      req.on('error', reject)
    })
  }

  return new Request(url.href, {
    method: req.method,
    headers,
    body: body ?? null,
  })
}

/**
 * Write a Fetch API Response to a Node.js ServerResponse.
 * Copies status, headers (skipping x-adex-* internal headers), and streams body.
 * @param {Response} response
 * @param {import("./http.js").ServerResponse} res
 * @returns {Promise<void>}
 */
export async function fetchResponseToNode(response, res) {
  res.statusCode = response.status
  for (const [key, value] of response.headers.entries()) {
    if (key.startsWith('x-adex-')) continue
    res.setHeader(key, value)
  }
  if (response.body) {
    const buf = Buffer.from(await response.arrayBuffer())
    res.write(buf)
  }
  res.end()
}

/**
 * @param {import("./http.js").ServerResponse} res
 */
export function prepareResponse(res) {
  res.html = data => {
    if (typeof data !== 'string') {
      throw new Error('[res.html] only accepts html string')
    }
    res.setHeader('content-type', 'text/html')
    res.write(data)
    res.end()
  }
  res.text = data => {
    let _data = data
    if (typeof data !== 'string') {
      _data = JSON.stringify(data)
    }
    res.setHeader('content-type', 'text/plain')
    res.write(_data)
    res.end()
  }
  res.json = data => {
    const str = JSON.stringify(data)
    res.setHeader('content-type', 'application/json')
    res.write(str)
    res.end()
  }
  res.redirect = (url, statusCode = 302) => {
    res.statusCode = statusCode
    res.setHeader('Location', url)
  }

  // HTTP Status helpers
  res.badRequest = message => {
    res.statusCode = 400
    if (message) {
      res.setHeader('content-type', 'application/json')
      res.write(JSON.stringify({ error: message }))
    }
    res.end()
  }

  res.unauthorized = message => {
    res.statusCode = 401
    if (message) {
      res.setHeader('content-type', 'application/json')
      res.write(JSON.stringify({ error: message }))
    }
    res.end()
  }

  res.forbidden = message => {
    res.statusCode = 403
    if (message) {
      res.setHeader('content-type', 'application/json')
      res.write(JSON.stringify({ error: message }))
    }
    res.end()
  }

  res.notFound = message => {
    res.statusCode = 404
    if (message) {
      res.setHeader('content-type', 'application/json')
      res.write(JSON.stringify({ error: message }))
    }
    res.end()
  }

  res.internalServerError = message => {
    res.statusCode = 500
    if (message) {
      res.setHeader('content-type', 'application/json')
      res.write(JSON.stringify({ error: message }))
    }
    res.end()
  }
}
