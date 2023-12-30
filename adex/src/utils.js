export { default as ms } from 'ms'
export { default as Youch } from 'youch'
import { existsSync, readFileSync, statSync } from 'node:fs'

import * as routeManifest from '@barelyhuman/fs-route-manifest'
import { match } from 'path-to-regexp'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const routerUtils = {
  ...routeManifest,
  paramMatcher: match,
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const defaultContent = readFileSync(
  join(__dirname, './runtime/index.html'),
  'utf8'
)

export function getEntryHTML() {
  let htmlContent = defaultContent
  if (!existsSync('src/index.html')) {
    return htmlContent
  }
  try {
    htmlContent = readFileSync('src/index.html',"utf8")
  } catch (err) {
    console.warn(
      `src/index.html could not be read due to the following error:\n`,
      err
    )
  }
  return htmlContent
}
