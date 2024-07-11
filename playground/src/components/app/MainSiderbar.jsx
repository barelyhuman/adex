import { Sidebar } from '../Sidebar'
import { marked } from 'marked'
import { signal } from '@preact/signals'
import { Content } from '../Content'

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

export const ContentSplit = () => {
  return (
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
          __html: sidebarItems.find(x => x.key === activeSidebar.value).content,
        }}
      />
    </main>
  )
}
