/**
 * Simple test API route for the minimal fixture.
 * Used by integration tests to verify Fetch-based API handler behavior.
 * @param {Request} request
 * @returns {Response}
 */
export default function handler(request) {
  return Response.json({ ok: true, method: request.method })
}
