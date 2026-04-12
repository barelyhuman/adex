import { useEffect, useState } from 'preact/hooks'

export function ListIsland() {
  const [data, setData] = useState([])

  useEffect(() => {
    setData([1, 2, 3])
  }, [])

  return (
    <div>
      <ul>
        {data.map(d => (
          <li>{d}</li>
        ))}
      </ul>
    </div>
  )
}
