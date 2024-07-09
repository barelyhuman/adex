import { useState } from 'preact/hooks'

export const CounterIsland = () => {
  const [count, setCount] = useState(0)
  return (
    <div class='flex gap-2 items-center'>
      <button
        class='px-4 py-2 rounded-sm bg-zinc-800 text-zinc-50'
        onClick={() => {
          setCount(count + 1)
        }}
      >
        -
      </button>
      <p>{count}</p>
      <button
        class='px-4 py-2 rounded-sm bg-zinc-800 text-zinc-50'
        onClick={() => {
          setCount(count + 1)
        }}
      >
        +
      </button>
    </div>
  )
}
