import { UserConfig, Plugin } from 'vite'
import type { Options as FontOptions } from './fonts.js'

export interface AdapterClientInfo {
  bundle: boolean
  islands: boolean
  manifestPath: string
  outDir: string
}

export interface AdapterConfig {
  /** npm package name — added to ssr.noExternal so it bundles into the server output */
  name: string
  /** the import specifier used in the generated virtual:adex:server entry */
  module: string
  /**
   * Returns a Vite plugin that handles dev-mode request serving for this adapter.
   * Called by the core adex() plugin with the same islands flag.
   */
  devServerPlugin: (options: { islands: boolean }) => Plugin
}

export interface AdexOptions {
  fonts?: FontOptions
  islands?: boolean
  adapter?: AdapterConfig
  ssr?: boolean
  __clientConfig?: UserConfig
}

export function adex(options?: AdexOptions): Plugin[]

declare module 'vite' {
  interface Plugin {
    adexServer?: boolean
  }
}
