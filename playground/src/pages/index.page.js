import { reactive } from 'adex/reactive'
import { html } from 'adex/html'

export const loader = async () => {
  return {
    count: 10,
  }
}

export default function (loaderData) {
  const state = reactive({
    count: loaderData.count,
  })

  return html`
    <button @click="${() => (state.count += 1)}">${() => state.count}</button>
    <pre>
      ${JSON.stringify(loaderData.cwd)}
</pre>
  `
}