declare module 'http' {
  interface IncomingMessage {
    parseBodyJSON: <T, K extends keyof T>() => Promise<Record<K, T[K]>>
  }

  interface ServerResponse {
    html: (data: string) => void
    json: (data: any) => void
    text: (data: string) => void
  }
}
