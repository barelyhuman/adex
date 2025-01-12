import { Plugin } from 'vite'
import type { Options as FontOptions } from './fonts'

export type Adapters = 'node'

export interface AdexOptions {
  fonts?: FontOptions
  islands?: boolean
  adapter?: Adapters
}

export function adex(options: AdexOptions): Plugin[]
