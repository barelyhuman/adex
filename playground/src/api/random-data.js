export default function (req, res) {
  return res.json(
    Array.from({ length: 3 })
      .fill(0)
      .map((d, i) => (i + 1) * Math.random())
  )
}
