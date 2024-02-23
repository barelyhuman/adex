import { useState } from 'preact/hooks'

export const CounterIsland = ({ count: propCount }) => {
  const [count, setCount] = useState(propCount)
  return (
    <>
      <button onClick={() => setCount(count + 1)}>
        {count}
      </button>
    </>
  )
}
