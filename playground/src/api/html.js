export default req => {
  return new Response(`<h1>Html Response</h1>`, {
    headers: {
      'content-type': 'text/html',
    },
  })
}
