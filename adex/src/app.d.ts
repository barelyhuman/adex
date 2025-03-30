export declare const App: ({ url }: { url?: string | undefined }) => any
export declare const prerender: ({ url }: { url: any }) => Promise<{
  html: any
  links: Set<string | undefined>
}>
