export default (req, res) => {
  return res.json({
    message: `Hello in ${req.params.id}`,
  })
}
