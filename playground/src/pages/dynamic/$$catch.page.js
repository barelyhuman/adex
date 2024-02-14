import { html } from '@arrow-js/core'
export const loader = ({ req }) => {
  return {
    catch: req.params.catch
  }
}

export default function Page (loaderData) {
  return html`
    From Catch
    <pre>
    ${JSON.stringify(loaderData, null, 2)}
  </pre
    >
  `
}
