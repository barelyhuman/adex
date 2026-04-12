import { UserConfig, Plugin } from 'vite'
import type { Options as FontOptions } from './fonts.js'
import type { RollupOptions } from 'rollup'

export interface AdapterClientInfo {
  bundle: boolean
  islands: boolean
  manifestPath: string
  outDir: string
}

export interface AdapterConfig {
  /** npm package name — added to ssr.noExternal so it bundles into the server output */
  name: string
  /**
   * Returns a Vite plugin that handles dev-mode request serving for this adapter.
   * Called by the core adex() plugin with the same islands flag.
   */
  devServerPlugin: (options: { islands: boolean }) => Plugin
  /**
   * Returns the source code string for the virtual:adex:server entry point.
   * Core injects this verbatim — all runtime bootstrap logic lives here.
   */
  serverEntry: (options: { islands: boolean }) => string
  /**
   * Optional hook to extend or override the Rollup options used in the SSR
   * server build. The base options are passed in; return the final options.
   * Use this to add extra `external` patterns (e.g. /^https?:\/\//) or set
   * `output.preserveModules: true` for runtimes like Deno.
   */
  rollupOptions?: (base: RollupOptions) => RollupOptions
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
