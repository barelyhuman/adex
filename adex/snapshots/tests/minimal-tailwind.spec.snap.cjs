exports["devMode ssr minimal with styles > gives a non-static ssr response 1"] = `"
    <!doctype html>
    <html lang="">
      <head>
        <script type="module" src="/@vite/client"></script>

        <meta charset="UTF-8" />
        
    <title></title>

    
    
  
      
              <link rel="preload" href="/virtual:adex:global.css" as="style" onload="this.rel='stylesheet'" />
              
              </head>
      <body>
        <div id="app"><h1 class="text-red-500">Hello World</h1></div>
      <script type='module' src="/virtual:adex:client"></script></body>
    </html>
  "`

exports["devMode ssr minimal with styles > gives a static SSR response 1"] = `"
    <!doctype html>
    <html lang="">
      <head>
        <script type="module" src="/@vite/client"></script>

        <meta charset="UTF-8" />
        
    <title></title>

    
    
  
      
              <link rel="preload" href="/virtual:adex:global.css" as="style" onload="this.rel='stylesheet'" />
              
              </head>
      <body>
        <div id="app"><h2>About</h2></div>
      <script type='module' src="/virtual:adex:client"></script></body>
    </html>
  "`

