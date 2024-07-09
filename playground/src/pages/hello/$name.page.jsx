import { signal } from '@preact/signals'

export const loader = ({ req }) => {
  return {
    greeting: req.params.name,
  }
}

const color = signal(false)

export default function Page({ serverProps }) {
  return (
    <>
      <h1 class={color.value ? 'active' : ''}>Hello {serverProps.greeting}</h1>
      <button
        onClick={() => {
          color.value = !color.value
        }}
      >
        Toggle Color
      </button>
    </>
  )
}
