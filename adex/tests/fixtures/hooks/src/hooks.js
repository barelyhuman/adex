import { afterPageRender, beforeAPICall } from 'adex/hooks'

afterPageRender(ctx => {
  ctx.html = ctx.html.replace(
    '</head>',
    '<style id="adex-hooks-test">.hooked{color:red}</style></head>'
  )
})

beforeAPICall(({ res }) => {
  res.setHeader('x-adex-hook', 'before-api')
})
