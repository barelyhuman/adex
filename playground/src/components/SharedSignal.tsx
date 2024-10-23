import { signal } from '@preact/signals'
import { useEffect } from 'preact/hooks'

const data$ = signal([])

async function fetchData() {
  const data = await fetch('/api/random-data').then(d => d.json())
  data$.value = data
}

export function Triggerer() {
  useEffect(() => {
    fetchData()
  }, [])
  return (
    <div class="p-10 border border-red-400 border-dashed">
      <h2>Triggerer Island</h2>
      <button class="px-4 py-2 text-white bg-black rounded-md" onClick={fetchData}>Fetch Again</button>
    </div>
  )
}

export function Renderer() {
  return (
    <div class="p-10 border border-blue-400 border-dashed">
      <h2>Renderer Island</h2>
      <ul>
        {data$.value.map(d => (
          <li>{d}</li>
        ))}
      </ul>
    </div>
  )
}
