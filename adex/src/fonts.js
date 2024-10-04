import { createUnifont } from 'unifont'
import { beforePageRender } from 'adex/hook'
export { providers } from 'unifont'

export function fonts({ providers = [], families = [] } = {}) {
  beforePageRender(async function (page) {
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

    page.html = page.html.replace(
      '</head>',
      `
      <style type="text/css">
          ${fontImports.join('\n')}
      </style>
      </head>
    `
    )
  })
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
