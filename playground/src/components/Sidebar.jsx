export const Sidebar = ({ activeSidebar, setSidebar, sidebarItems }) => {
  return (
    <aside class="sticky flex-2 top-[50px]">
      {sidebarItems.map(x => (
        <div
          key={x.key}
          class={`relative group space-y-2 text-zinc-400 hover:text-zinc-800 ${
            activeSidebar.value === x.key ? 'text-black font-semibold' : ''
          }`}
        >
          <a
            href={`#${x.key}`}
            onClick={() => {
              setSidebar(x.key)
            }}
          >
            {x.label}
          </a>
          <span class="block max-w-0 group-hover:max-w-full  transition-all h-0.5 duration-200 bottom-[-4px] bg-black" />
        </div>
      ))}
    </aside>
  )
}
