import { Content } from '../components/Content.jsx'
import { BaseLayout } from '../components/layout/base.jsx'
import { marked } from 'marked'
import { signal } from '@preact/signals'
import { Sidebar } from '../components/Sidebar.jsx'

const md = String.raw

const sidebarItems = [
  {
    key: 'introduction',
    label: 'Introduction',
    content: await marked.parse(md`
### Introduction</h3>

**_Adex_** is a vite plugin to simplify server rendered apps your development
with preact.
    `),
  },
  {
    key: 'getting-started',
    label: 'Getting Started',
    content: await marked.parse(md`
### Getting Started
    `),
  },
]

const activeSidebar = signal(sidebarItems[0].key)

export default function () {
  return (
    <BaseLayout>
      <header class="h-[300px] flex flex-col justify-center">
        <h1 class="text-xl font-semibold tracking-wide text-zinc-800">Adex</h1>
        <small>Vite + Preact for minimalists</small>
      </header>
      <main class="flex gap-10">
        <Sidebar
          activeSidebar={activeSidebar}
          setSidebar={key => {
            activeSidebar.value = key
          }}
          sidebarItems={sidebarItems}
        />
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
