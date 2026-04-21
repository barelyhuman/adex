/**
 * Adex Vite Plugin
 * ----------------
 * This is the main export for the Adex framework, providing a set of Vite plugins
 * for building applications with Preact, SSR, and islands architecture.
 *
 * The plugin system is organized into modular components:
 * - Routing plugins: Handle page and API routes
 * - Virtual module plugins: Provide runtime components and templates
 * - Build plugins: Configure the build process for client and server
 * - Conditional plugins: Enable features like islands architecture and SSR
 *
 * @module adex/vite
 */

import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'

// Import plugin factories
import { preactPages } from './plugins/preact-pages.js'
import {
  createClientBuilder,
  createBuildPrep,
} from './plugins/client-builder.js'
import { createDevServer } from './plugins/dev-server.js'
import { createServerBuilder } from './plugins/server-builder.js'
import { createIslandsBuilder } from './plugins/islands-builder.js'
import {
  createVirtualModule,
  createUserDefaultVirtualModule,
} from './utils/virtual-modules.js'
import { getServerTemplate } from './utils/server-template.js'
import { fonts as createFontsPlugin } from './fonts.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Map of available adapters
const ADAPTER_PACKAGES = {
  node: 'adex-adapter-node',
}

/**
 * Creates a set of Vite plugins for the Adex framework
 *
 * @param {import("./vite.js").AdexOptions} [options]
 * @returns {(import("vite").Plugin)[]}
 */
export function adex({
  fonts,
  islands = false,
  ssr = true,
  adapter = 'node',
} = {}) {
  const adapterPackage = ADAPTER_PACKAGES[adapter]
  if (!adapterPackage) {
    throw new Error(
      `Unknown adapter: ${adapter}. Available adapters: ${Object.keys(ADAPTER_PACKAGES).join(', ')}`
    )
  }

  // Create the core plugins for routing
  const routingPlugins = [
    // Page routes
    preactPages({
      root: '/src/pages',
      id: '~routes',
    }),

    // API routes
    preactPages({
      root: '/src/api',
      id: '~apiRoutes',
      replacer: '/api',
    }),
  ]

  // Create virtual modules for static files and runtime components
  const virtualModulePlugins = [
    createUserDefaultVirtualModule(
      'virtual:adex:global.css',
      '',
      'src/global.css'
    ),
    createUserDefaultVirtualModule(
      'virtual:adex:client',
      readFileSync(join(__dirname, '../runtime/client.js'), 'utf8'),
      '/src/_app'
    ),
    createVirtualModule(
      'adex/app',
      readFileSync(join(__dirname, '../runtime/app.js'), 'utf8')
    ),
    createVirtualModule(
      'virtual:adex:handler',
      readFileSync(join(__dirname, '../runtime/handler.js'), 'utf8')
    ),
    createVirtualModule(
      'virtual:adex:server',
      getServerTemplate(adapterPackage)
    ),
  ]

  // Create build and development plugins
  const buildPlugins = [
    createFontsPlugin(fonts),
    createDevServer({ islands }),
    createBuildPrep({ islands }),
    createClientBuilder({ ssr, islands }),
  ]

  // Create conditional plugins
  const conditionalPlugins = [
    // Islands architecture support
    islands && createIslandsBuilder(),

    // Server-side rendering support
    ssr &&
      createServerBuilder({
        fonts,
        adapter,
        islands,
        islandBuilderFactory: createIslandsBuilder,
        fontsPluginFactory: createFontsPlugin,
      }),
  ]

  // Combine all plugins and filter out nulls
  return [
    ...routingPlugins,
    ...virtualModulePlugins,
    ...buildPlugins,
    ...conditionalPlugins.flat(),
  ].filter(Boolean)
}
