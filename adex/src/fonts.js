import { createUnifont } from 'unifont'
export { providers } from 'unifont'

/**
 * @returns {import("vite").Plugin}
 */
export function fonts({ providers = [], families = [] } = {}) {
  let globalCSSDetails
  return {
    name: 'adex-fonts',
    enforce: 'pre',

    async transform(code, id) {
      if (!globalCSSDetails) {
        globalCSSDetails = await this.resolve('virtual:adex:global.css')
      }

      if (globalCSSDetails.id !== id) {
        return
      }
      const unifont = await createUnifont([...providers])
      const fontsToResolve = families.map(userFamily => {
        return unifont
          .resolveFontFace(userFamily.name, {
            weights: userFamily.weights,
            styles: userFamily.styles,
            subsets: [],
          })
          .then(resolvedFont => {
            const toUse = resolvedFont.fonts.filter(
              d =>
                []
                  .concat(d.weight)
                  .map(String)
                  .find(d => userFamily.weights.includes(d)) ?? false
            )

            return { fonts: toUse, name: userFamily.name }
          })
      })

      const fontImports = []
      for await (let resolvedFont of fontsToResolve) {
        const fontFace = fontsToFontFace(resolvedFont)
        fontImports.push(fontFace.join('\n'))
      }

      const lines = code.split('\n')
      let finalCodeLines = []
      if (code.startsWith('@import')) {
        const lastImportAt = lines.findIndex(
          lines => !lines.startsWith('@import')
        )
        finalCodeLines = insertAt(lines, lastImportAt, fontImports)
      } else {
        finalCodeLines = [].concat(fontImports).concat(lines)
      }
      return {
        code: finalCodeLines.join('\n'),
      }
    },
  }
}

function insertAt(array, index, data) {
  return array.slice(0, index).concat(data).concat(array.slice(index))
}

function fontsToFontFace(resolvedFont) {
  return resolvedFont.fonts.map(fontDetails => {
    return fontDetails.src
      .map(x => {
        return `@font-face {
    font-family: '${resolvedFont.name}';
    font-weight: ${[].concat(fontDetails.weight).join(',')};
    font-style: ${[].concat(fontDetails.style).join(',')};
    src: url(${x.url}) format('woff2');
          }`
      })
      .join('\n')
  })
}
