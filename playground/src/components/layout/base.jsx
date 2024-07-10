import '../../main.css'

export function BaseLayout({ children }) {
  return <div class="p-2 mx-auto w-full max-w-4xl min-h-screen">{children}</div>
}
