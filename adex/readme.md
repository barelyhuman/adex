# adex

> An easier way to build apps with [Vite](http://vitejs.dev) and
> [Preact](http://preactjs.com)

- [adex](#adex)
  - [About](#about)
    - [Highlights](#highlights)
  - [Usage](#usage)
  - [Docs](#docs)
  - [License](#license)

## About

`adex` is just a vite plugin that adds in the required functionality to be able
to build server rendered preact apps.

### Highlights

- Unified routing for both backend and frontend
- Tiny and Simple
- Builds on existing tooling instead of adding yet another way to do things

## Usage

As there are a few steps needed to get it running, it's not recommended to do
this manually, instead use the
[existing template to get started](https://github.com/barelyhuman/adex-default-template)

If you still wish to set it up manually.

**Create a preact based vite app**

```sh
npm create vite@latest -- -t preact
```

**Add in the required deps**

```sh
npm add -D adex
```

**Modify config to use adex**

```diff
// vite.config.js
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
+ import { adex } from 'adex'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
+    adex(),
    preact()],
})
```

**Remove the default preact files and add in basic structure for adex**

```sh
rm -rf ./src/* index.html
mkdir -p src/pages src/api
touch src/global.css
```

And you are done.

## Docs

TBD

> [!NOTE]
>
> Refer to the `playground` in the source repo or the default template to
> understand how to write apps with adex

## License

[MIT](/LICENSE)
