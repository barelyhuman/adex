import { defineConfig } from "vite";
import { vavite } from "vavite";

export default defineConfig({
  appType: "custom",
  buildSteps: [
    {
      name: "client",
      config: {
        build: {
          outDir: "dist/client",
          manifest: true,
          rollupOptions: { input: "./src/client-entry.tsx" },
        },
      },
    },
    {
      name: "server",
      config: {
        build: {
          target: "node18",
          ssr: true,
          outDir: "dist/server",
        },
      },
    },
  ],

  plugins: [
    vavite({
      clientAssetsDir: "./dist/client",
      handlerEntry: "./src/handler.tsx",
      reloadOn: "static-deps-change",
      serveClientAssetsInDev: true,
    }),
  ],
});
