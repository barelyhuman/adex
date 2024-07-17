export default (req, res) => {
  return res.text(`Hello from ${req.params.id}`)
}
