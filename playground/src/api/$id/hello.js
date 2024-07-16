export default (req, res) => {
  return res.end(`Hello from ${req.params.id}`)
}
