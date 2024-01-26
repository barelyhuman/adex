import { reactive } from '@arrow-js/core'
import { html } from '@arrow-js/core'
import { onMount } from 'adex/hooks'

export const loader = async () => {
  return {
    count: 10,
  }
}

onMount(() => {
  console.log('mounted')
})

export default function (loaderData) {
  const state = reactive({
    count: loaderData.count,
  })

  onMount(() => {
    console.log('local mount call')
    state.count += 10
  })

  return html`
    <button @click="${() => (state.count += 1)}">${() => state.count}</button>
    <pre>
      ${JSON.stringify(loaderData.cwd)}
</pre>
  `
}
