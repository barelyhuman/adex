/**
 * @param {Request} request
 */
export default function (request) {
  return Response.json(
    Array.from({ length: 3 })
      .fill(0)
      .map((d, i) => (i + 1) * Math.random())
  )
}
