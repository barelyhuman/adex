export function defineHandlers(handlers) {
  return req => {
    const method = req.method?.toLowerCase() ?? 'all'

    if (!(method in handlers)) {
      return new Response(null, {
        status: 404,
      })
    }
    const response = handlers[method]?.(req)
    if (response instanceof Promise) {
      return new Promise((resolve, reject) =>
        response.then(resolve).catch(reject)
      )
    }
    return response
  }
}

export function json(data, status = 200, additional = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      ...(additional?.headers ?? {}),
    },
    ...additional,
  })
}

export async function readJsonBody(
  req,
  transformer = data => JSON.parse(Buffer.from(data || '').toString())
) {
  if (req.bodyUsed) {
    throw new Error('[readBody] Body already used')
  }
  const data = await req.body?.getReader().read()
  return transformer(data?.value)
}
