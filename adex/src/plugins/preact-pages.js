import { join } from 'path'
import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Create a Vite plugin for Preact pages routing
 *
 * @param {object} options - Configuration options
 * @param {string} [options.root='/src/pages'] - The root directory for pages
 * @param {string} [options.id='~routes'] - The virtual module ID
 * @param {string[]} [options.extensions=['js', 'ts', 'tsx', 'jsx']] - File extensions to include
 * @param {string} [options.replacer=''] - String to replace in route paths
 * @returns {import("vite").Plugin}
 */
export function preactPages({
  root = '/src/pages',
  id: virtualId = '~routes',
  extensions = ['js', 'ts', 'tsx', 'jsx'],
  replacer = '',
} = {}) {
  return {
    name: 'adex-routes',
    enforce: 'pre',
    resolveId(id) {
      if (id !== virtualId) {
        return
      }
      return `/0${virtualId}`
    },
    async load(id) {
      if (id !== `/0${virtualId}`) {
        return
      }

      const extsString = extensions.join(',')
      const code = (
        await readFile(join(__dirname, '../../runtime/pages.js'), 'utf8')
      )
        .replaceAll('#{__PLUGIN_PAGES_ROOT}', root + `/**/*.{${extsString}}`)
        .replaceAll('#{__PLUGIN_PAGES_ROOT_REGEX}', `^${root}`)
        .replaceAll('#{__PLUGIN_PAGES_ROOT_REGEX_REPLACER}', replacer)

      return {
        code,
      }
    },
  }
}
