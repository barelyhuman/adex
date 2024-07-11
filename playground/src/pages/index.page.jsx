import { Content } from '../components/Content.jsx'
import { BaseLayout } from '../components/layout/base.jsx'

import { ContentSplit } from '../components/app/MainSiderbar.jsx'

export default function () {
  return (
    <BaseLayout>
      <header class="h-[300px] flex flex-col justify-center">
        <h1 class="text-xl font-semibold tracking-wide text-zinc-800">Adex</h1>
        <small>Vite + Preact for minimalists</small>
      </header>
      <ContentSplit />
    </BaseLayout>
  )
}
