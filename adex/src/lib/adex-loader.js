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

      const ast = moduleParser(transformResult.code)
      const astWithoutLoader = removeLoaderFromAST(ast)
      const astWithoutImports = removeUnusedImports(astWithoutLoader)
      console.log({
        ast,
        astWithoutLoader,
        astWithoutImports,
      })

      return generate(astWithoutImports)
    },
  }
}

function moduleParser(source) {
  return parse(source, {
    sourceType: 'module',
  })
}

function removeLoaderFromAST(ast) {
  traverse(ast, {
    Identifier(path) {
      if (path.node.name !== 'loader') return

      if (path.parent) {
        if (path.parent.type === 'ExportSpecifier') {
          path.parentPath.remove()
        }

        if (path.parentPath.parentPath) {
          if (path.parentPath.parentPath.node.type === 'VariableDeclaration') {
            path.parentPath.parentPath.remove()
          }
        }
      }
    },
  })
  return moduleParser(generate(ast).code)
}

function removeUnusedImports(ast) {
  const paths = new Map()

  const visitor = {
    ImportSpecifier(path) {
      paths.set(path.node.local.name, path)
    },
    ImportDefaultSpecifier(path) {
      paths.set(path.node.local.name, path)
    },
    Program: {
      exit(path) {
        for (let [key, path] of paths.entries()) {
          const binding = path.scope.bindings[key]
          if (!binding) continue
          if (binding.references !== 0) continue
          if (path.node.type == 'ImportDefaultSpecifier') {
            path.parentPath.remove()
          } else {
            if (path.parent.specifiers.length === 1) {
              path.parentPath.remove()
            } else {
              path.remove()
            }
          }
        }
      },
    },
  }

  traverse(ast, visitor)
  return moduleParser(generate(ast).code)
}
