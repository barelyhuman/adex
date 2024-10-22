import { Plugin } from 'vite'
import type { Options as FontOptions } from './fonts'

export interface AdexOptions {
  fonts?: FontOptions
  islands?: boolean
}

export function adex(options: AdexOptions): Plugin[]
