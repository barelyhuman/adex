import { useState } from 'preact/hooks'
import './local-index.css'
import { Counter } from '../components/counter.tsx'

export default function Page() {
  const [count, setCount] = useState(0)

  return (
    <div class="bg-red-400">
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={'/vite.svg'} class="logo" alt="Vite logo" />
        </a>
        <a href="https://preactjs.com" target="_blank">
          <img src={'/vite.svg'} class="logo preact" alt="Preact logo" />
        </a>
      </div>
      <h1>Vite + Preact</h1>
      <div class="card">
        <button
          classs="bg-black text-white"
          onClick={() => setCount(count => count + 1)}
        >
          count is {count} (only works when `islands` is set to `false`)
        </button>
        <p>
          Edit <code>src/app.jsx</code> and save to test HMR
        </p>
      </div>
      <p class="read-the-docs">
        Click on the Vite and Preact logos to learn more
      </p>
      <p>
        Here's an island{' '}
        <span>
          <Counter />
        </span>
      </p>
    </div>
  )
}
