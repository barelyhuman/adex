exports["devMode ssr minimal > gives a non-static ssr response 1"] = `"
    <!doctype html>
    <html lang="">
      <head>
        <script type="module" src="/@vite/client"></script>

        <meta charset="UTF-8" />
        
    <title></title>

    
    
  
      </head>
      <body>
        <div id="app"><h1>Hello World</h1></div>
      <script type='module' src="/virtual:adex:client"></script></body>
    </html>
  "`

exports["devMode ssr minimal > blank styles 1"] = `"import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/@id/__x00__virtual:adex:global.css");import { updateStyle as __vite__updateStyle, removeStyle as __vite__removeStyle } from "/@vite/client"
const __vite__id = "virtual:adex:global.css"
const __vite__css = ""
__vite__updateStyle(__vite__id, __vite__css)
import.meta.hot.accept()
import.meta.hot.prune(() => __vite__removeStyle(__vite__id))"`

exports["devMode ssr minimal > gives a static SSR response 1"] = `"
    <!doctype html>
    <html lang="">
      <head>
        <script type="module" src="/@vite/client"></script>

        <meta charset="UTF-8" />
        
    <title></title>

    
    
  
      </head>
      <body>
        <div id="app"><h2>About</h2></div>
      <script type='module' src="/virtual:adex:client"></script></body>
    </html>
  "`

