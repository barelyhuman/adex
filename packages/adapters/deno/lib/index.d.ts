import type { Plugin } from 'vite'
import type { RollupOptions } from 'rollup'

export interface AdapterClientInfo {
  /** true when a full client bundle was emitted to dist/client/ */
  bundle: boolean
  /** true when islands were built to dist/server/islands/ */
  islands: boolean
}

export interface AdexRuntimeConfig {
  manifests: { server: object; client: object }
  paths: { assets: string; islands: string; client: string }
  client: AdapterClientInfo
}

export interface DenoAdapterOptions {
  port?: number | string
  hostname?: string
}

export interface DenoServerOptions {
  port?: number | string
  hostname?: string
  adex?: AdexRuntimeConfig
}

export interface AdapterConfig {
  /** npm package name — added to ssr.noExternal so it bundles into the server output */
  name: string
  /**
   * Returns a Vite plugin that handles dev-mode request serving.
   * Called by the core adex() plugin with the same islands flag.
   */
  devServerPlugin: (options: { islands: boolean }) => Plugin
  /**
   * Returns the source code string for the virtual:adex:server entry point.
   * Core injects this verbatim — all runtime bootstrap logic lives here.
   */
  serverEntry: (options: { islands: boolean }) => string
  /**
   * Optional hook to extend/override the Rollup options for the SSR server
   * build. The Deno adapter uses this to enable preserveModules and add
   * https:// / node: specifiers to external.
   */
  rollupOptions?: (base: RollupOptions) => RollupOptions
}

/**
 * Adapter factory — pass to adex({ adapter: deno() }) in vite.config.js
 */
export declare function deno(options?: DenoAdapterOptions): AdapterConfig

/**
 * Runtime server factory — called by the generated virtual:adex:server entry.
 * Uses Deno.serve() for the production HTTP server.
 */
export declare const createServer: (options?: DenoServerOptions) => {
  run(): void
  fetch: (req: Request) => Promise<Response>
}
