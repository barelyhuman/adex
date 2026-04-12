import { Renderer, Triggerer } from '../components/SharedSignal.js'

export default function SharedSignal() {
  return (
    <div class="flex flex-col gap-2 p-10">
      <Triggerer />
      <Renderer />
    </div>
  )
}
