import {
  providers,
  //  ResolveFontFacesOptions
} from 'unifont'
import { Plugin } from 'vite'
export { providers } from 'unifont'

type FontFamilies = {
  name: string
  weights: string[]
  styles: Array<'normal' | 'italic' | 'oblique'> // ResolveFontFacesOptions['styles']
}

type Options = {
  providers: (typeof providers)[]
  families: FontFamilies[]
}

export function fonts(options: Options): Plugin
