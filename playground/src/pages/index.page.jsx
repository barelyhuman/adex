import { onMount } from 'adex/hooks'
import { signal } from '@preact/signals'

export const loader = async () => {
  return {
    count: 10
  }
}

const count = signal(0)

onMount(() => {
  console.log('mounted')
})

export default function ({ serverProps }) {
  return (
    <>
      <button onClick={() => (count.value += 1)}>
        {count}
      </button>
    </>
  )
}
