import { UserConfig, Plugin } from 'vite'
import type { Options as FontOptions } from './fonts.js'

export type Adapters = 'node'

export interface AdexOptions {
  fonts?: FontOptions
  islands?: boolean
  adapter?: Adapters
  ssr?: boolean
  __clientConfig?: UserConfig
}

export function adex(options: AdexOptions): Plugin[]
