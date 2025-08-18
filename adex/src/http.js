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
