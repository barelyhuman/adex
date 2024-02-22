import { signal } from '@preact/signals'

const count = signal(0)

export const CounterIsland = () => {
  return (
    <>
      <button onClick={() => (count.value += 1)}>
        {count}
      </button>
    </>
  )
}
