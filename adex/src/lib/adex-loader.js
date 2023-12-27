import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import { parse } from '@babel/parser'
import { transformWithEsbuild } from 'vite'

const modDefault = mod => ('default' in mod ? mod.default : mod)
const traverse = modDefault(_traverse)
const generate = modDefault(_generate)

/**
 * @returns {import("vite").Plugin}
 */
export function adexLoader() {
  return {
    name: 'adex-loader-plugin',
    async transform(source, id, options) {
      if (options?.ssr) return
      if (!/[.](page)[.]((js|ts)x?)$/.test(id)) return

      const transformResult = await transformWithEsbuild(source, id, {
        platform: 'browser',
        treeShaking: true,
      })

      const ast = parse(transformResult.code, {
        sourceType: 'module',
      })

      traverse(ast, {
        Identifier(path) {
          if (path.node.name !== 'loader') return

          if (path.parent) {
            if (path.parent.type === 'ExportSpecifier') {
              path.parentPath.remove()
            }

            if (path.parentPath.parentPath) {
              if (
                path.parentPath.parentPath.node.type === 'VariableDeclaration'
              ) {
                path.parentPath.parentPath.remove()
              }
            }
          }
        },
      })

      return generate(ast)
    },
  }
}
