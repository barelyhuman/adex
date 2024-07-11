import { Content } from '../components/Content.jsx'
import { BaseLayout } from '../components/layout/base.jsx'

import {
  activeSidebar,
  MainSidebar,
  sidebarItems,
} from '../components/app/MainSiderbar.jsx'

export default function () {
  return (
    <BaseLayout>
      <header class="h-[300px] flex flex-col justify-center">
        <h1 class="text-xl font-semibold tracking-wide text-zinc-800">Adex</h1>
        <small>Vite + Preact for minimalists</small>
      </header>
      <main class="flex gap-10">
        <MainSidebar />
        <Content
          id="introduction"
          class="flex-3"
          dangerouslySetInnerHTML={{
            __html: sidebarItems.find(x => x.key === activeSidebar.value)
              .content,
          }}
        />
      </main>
    </BaseLayout>
  )
}
