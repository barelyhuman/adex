import type { Plugin } from 'vite'

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

export interface NodeAdapterOptions {
  port?: number | string
  host?: string
}

export interface AdapterConfig {
  /** npm package name — added to ssr.noExternal so it bundles into the server output */
  name: string
  /** the import specifier used in the generated virtual:adex:server entry */
  module: string
  /**
   * Returns a Vite plugin that handles dev-mode request serving.
   * Called by the core adex() plugin with the same islands flag.
   */
  devServerPlugin: (options: { islands: boolean }) => Plugin
}

/**
 * Adapter factory — pass to adex({ adapter: node() }) in vite.config.js
 */
export declare function node(options?: NodeAdapterOptions): AdapterConfig

/**
 * Runtime server factory — called by the generated virtual:adex:server entry
 */
export declare const createServer: (options?: {
  port?: number | string
  host?: string
  adex?: AdexRuntimeConfig
}) => { run: () => void; fetch: undefined }
