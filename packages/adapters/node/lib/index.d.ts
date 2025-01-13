type ServerOut = {
  run: () => any
  fetch: undefined
}

export const createServer: ({ port: number, host: string }) => ServerOut
