export default req => {
  return new Response(
    {
      pong: true,
    },
    {
      headers: {
        'content-type': 'application/json',
      },
    }
  )
}
