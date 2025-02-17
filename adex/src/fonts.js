import { createUnifont } from 'unifont'
export { providers } from 'unifont'

const fontVirtualId = 'virtual:adex:font.css'

/**
 * @returns  {import("vite").Plugin}
 */
export function fonts({ providers = [], families = [] } = {}) {
  return {
    name: 'adex-fonts',
    enforce: 'pre',
    resolveId(requestId) {
      if (requestId === fontVirtualId || requestId === '/' + fontVirtualId) {
        return `\0${fontVirtualId}`
      }
    },
    async load(id) {
      if (id === `\0${fontVirtualId}`) {
        const unifont = await createUnifont([...providers])
        const fontsToResolve = families.map(userFamily => {
          return unifont
            .resolveFontFace(userFamily.name, {
              weights: userFamily.weights ?? ['600'],
              styles: userFamily.styles ?? ['normal'],
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
        return {
          code: fontImports.join('\n'),
        }
      }
    },
    async transform(code, id) {
      const resolvedData = await this.resolve('virtual:adex:client')
      if (resolvedData?.id == id) {
        return {
          code: `import "${fontVirtualId}";\n` + code,
        }
      }
    },
  }
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
