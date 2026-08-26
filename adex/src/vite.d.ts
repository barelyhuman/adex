import { UserConfig, Plugin } from 'vite'
import type { Options as FontOptions } from './fonts.js'

export type Adapters = 'node'

export interface AdexKernelOptions {
  /**
   * Production static file server.
   * - omitted: `sirv`
   * - `false`: no-op (requests fall through to SSR/API)
   * - string: module id whose default export is sirv-compatible `(dir, opts) => middleware`
   */
  staticServer?: false | string
}

export interface AdexOptions {
  fonts?: FontOptions
  islands?: boolean
  adapter?: Adapters
  ssr?: boolean
  kernel?: AdexKernelOptions
  __clientConfig?: UserConfig
}

export function adex(options: AdexOptions): Plugin[]

declare module 'vite' {
  interface Plugin {
    adexServer?: boolean
  }
}
