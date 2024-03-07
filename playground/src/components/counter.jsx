import { useState } from 'preact/hooks'

export const CounterIsland = ({ count: propCount }) => {
  const [count, setCount] = useState(propCount)
  return (
    <>
      <button
        class='bg-blue-400'
        onClick={() => {
          setCount(count + 1)
        }}
      >
        {count}
      </button>
    </>
  )
}
