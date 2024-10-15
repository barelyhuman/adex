import { Plugin } from 'vite'
import type { Options as FontOptions } from './fonts.js'

export interface AdexOptions {
  fonts?: FontOptions
}

interface Request {
  params: Record<string, any>
}

export function adex(options: AdexOptions): Plugin[]
