import { Sidebar } from '../Sidebar'
import { marked } from 'marked'
import { signal } from '@preact/signals'

const md = String.raw

export const sidebarItems = [
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

export const activeSidebar = signal(sidebarItems[0].key)

export const MainSidebar = () => {
  return (
    <Sidebar
      activeSidebar={activeSidebar}
      setSidebar={key => {
        activeSidebar.value = key
      }}
      sidebarItems={sidebarItems}
    />
  )
}
