import { onMount } from 'adex/hooks'
import { CounterIsland } from '../components/counter.jsx'

export const loader = async () => {
  return {
    count: 10
  }
}

onMount(() => {
  console.log('mounted')
})

export default function ({ serverProps }) {
  return (
    <CounterIsland />
  )
}
