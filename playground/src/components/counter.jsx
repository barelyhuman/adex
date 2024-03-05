import { useState } from 'preact/hooks'

export const CounterIsland = ({ count: propCount }) => {
  const [count, setCount] = useState(propCount)
  return (
    <>
      <button
        class='bg-red-400'
        onClik={() => {
          setCount(count + 1)
        }}
      >
        {count}
      </button>
    </>
  )
}
