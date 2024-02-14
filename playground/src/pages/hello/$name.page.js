import { html, reactive } from '@arrow-js/core'

export const loader = ({ req }) => {
  console.log({
    q: req.query
  })
  return {
    greeting: req.params.name
  }
}

export default function Page (loaderData) {
  const state = reactive({
    color: false
  })

  return html`
    <h1 class="${() => (state.active ? 'active' : '')}">
      Hello ${loaderData.greeting}
    </h1>
    <button
      @click="${() => {
        state.active = !state.active
      }}"
    >
      Toggle Color
    </button>
  `
}
