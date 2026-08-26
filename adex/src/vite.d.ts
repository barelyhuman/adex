import { UserConfig, Plugin } from 'vite'
import type { Options as FontOptions } from './fonts.js'

export type Adapters = 'node'

export interface AdexKernelOptions {
  /**
   * Production static serving.
   * - omitted: default `createStaticMiddlewares` (sirv + `/assets`/`/islands` URL rewrites)
   * - `false`: no static middlewares
   * - string: module id whose default export is `({ paths }) => middleware | middleware[]`
   *
   * Custom modules own path mounting entirely and do not inherit sirv URL rewriting.
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
