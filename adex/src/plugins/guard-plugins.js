import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const cwd = process.cwd()

/**
 * Create guard plugins to prevent misuse of environment variables
 *
 * @returns {import("vite").Plugin[]}
 */
export function createGuardPlugins() {
  return [
    {
      name: 'adex-guard-env',
      enforce: 'pre',
      async transform(code, id) {
        // ignore usage of `process.env` in node_modules
        // Still risky but hard to do anything about
        const nodeMods = resolve(cwd, 'node_modules')
        if (id.startsWith(nodeMods)) return

        // ignore usage of `process.env` in `adex/env`
        const envLoadId = await this.resolve('adex/env')
        if (id === envLoadId?.id) return

        if (code.includes('process.env')) {
          this.error(
            'Avoid using `process.env` to access environment variables and secrets. Use `adex/env` instead'
          )
        }
      },
      writeBundle() {
        const pagesPath = resolve(cwd, 'src/pages')
        const info = this.getModuleInfo('adex/env')
        const viteRef = this

        /**
         * Check the import tree to ensure env is not used on client-side
         * @param {string} importPath - Path of the module to check
         * @param {string[]} importStack - Stack of imports leading to this module
         */
        function checkTree(importPath, importStack = []) {
          if (importPath.startsWith(pagesPath)) {
            throw new Error(
              `Cannot use/import \`adex/env\` on the client side, importerStack: ${importStack.join(' -> ')}`
            )
          }

          // Get all importers of this module and check recursively
          const moduleInfo = viteRef.getModuleInfo(importPath)
          if (moduleInfo && moduleInfo.importers) {
            moduleInfo.importers.forEach(d =>
              checkTree(d, [...importStack, importPath, d])
            )
          }
        }

        if (info) {
          info.importers.forEach(i => checkTree(i))
        }
      },
    },
  ]
}
