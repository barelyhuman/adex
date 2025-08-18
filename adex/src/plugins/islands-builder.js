import {
  DEFAULT_TRANSPILED_IDENTIFIERS,
  IMPORT_PATH_PLACEHOLDER,
  findIslands,
  generateClientTemplate,
  getIslandName,
  getServerTemplatePlaceholder,
  injectIslandAST,
  isFunctionIsland,
  readSourceFile,
} from '@dumbjs/preland'
import { addImportToAST, codeFromAST } from '@dumbjs/preland/ast'
import preact from '@preact/preset-vite'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { build, mergeConfig } from 'vite'

const cwd = process.cwd()
const islandsDir = join(cwd, '.islands')
let runningIslandBuild = false

/**
 * Create plugins for islands architecture
 *
 * @returns {import("vite").Plugin[]}
 */
export function createIslandsBuilder() {
  const clientVirtuals = {}
  let isBuild = false
  let outDir

  return [
    {
      name: 'adex-islands',
      enforce: 'pre',
      config(d, e) {
        outDir = d.build?.outDir ?? 'dist'
        isBuild = e.command === 'build'
      },
      transform(code, id, viteEnv) {
        if (!/\.(js|ts)x$/.test(id)) return

        // if being imported by the client, don't send
        // back the transformed server code, send the
        // original component
        if (!viteEnv?.ssr) return

        const islands = findIslands(readSourceFile(id), {
          isFunctionIsland: node =>
            isFunctionIsland(node, {
              transpiledIdentifiers:
                DEFAULT_TRANSPILED_IDENTIFIERS.concat('_jsxDEV'),
            }),
        })
        if (!islands.length) return

        islands.forEach(node => {
          //@ts-expect-error FIX: in preland
          injectIslandAST(node.ast, node)
          const clientCode = generateClientTemplate(node.id).replace(
            IMPORT_PATH_PLACEHOLDER,
            id
          )

          mkdirSync(islandsDir, { recursive: true })
          writeFileSync(
            join(islandsDir, getIslandName(node.id) + '.js'),
            clientCode,
            'utf8'
          )

          clientVirtuals[node.id] = clientCode
        })

        const addImport = addImportToAST(islands[0].ast)
        addImport('h', 'preact', { named: true })
        addImport('Fragment', 'preact', { named: true })

        let serverTemplateCode = codeFromAST(islands[0].ast)
        islands.forEach(island => {
          serverTemplateCode = serverTemplateCode.replace(
            getServerTemplatePlaceholder(island.id),
            !isBuild
              ? `/virtual:adex:island-${island.id}`
              : `/islands/${getIslandName(island.id) + '.js'}`
          )
        })

        return {
          code: serverTemplateCode,
        }
      },
    },
    {
      name: 'adex-island-builds',
      enforce: 'post',
      writeBundle: {
        sequential: true,
        async handler() {
          if (Object.keys(clientVirtuals).length === 0) return
          if (runningIslandBuild) return

          runningIslandBuild = true
          try {
            await build(
              mergeConfig(
                {},
                {
                  configFile: false,
                  plugins: [preact()],
                  build: {
                    ssr: false,
                    outDir: join(outDir, 'islands'),
                    emptyOutDir: true,
                    rollupOptions: {
                      output: {
                        format: 'esm',
                        entryFileNames: '[name].js',
                      },
                      input: Object.fromEntries(
                        Object.entries(clientVirtuals).map(([k, v]) => {
                          const key = getIslandName(k)
                          return [key, join(islandsDir, key + '.js')]
                        })
                      ),
                    },
                  },
                }
              )
            )
          } finally {
            runningIslandBuild = false
          }
        },
      },
    },
    {
      name: 'adex-island-virtuals',
      resolveId(id) {
        if (
          id.startsWith('virtual:adex:island') ||
          id.startsWith('/virtual:adex:island')
        ) {
          return `\0${id}`
        }
      },
      load(id) {
        if (
          (id.startsWith('\0') && id.startsWith('\0virtual:adex:island')) ||
          id.startsWith('\0/virtual:adex:island')
        ) {
          const compName = id
            .replace('\0', '')
            .replace(/\/?(virtual\:adex\:island\-)/, '')

          if (clientVirtuals[compName]) {
            return {
              code: clientVirtuals[compName],
            }
          }
        }
      },
    },
  ]
}
