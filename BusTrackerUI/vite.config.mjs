// vite.config.mjs
import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ command }) => {
  const isDev = command === "serve";

  // These two lines make __dirname available in an ES module (.mjs)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  return {
    root: ".", // project root
    resolve: {
      alias: {
        // Create an alias for your components folder
        "@components": path.resolve(__dirname, "components"),
      },
    },
    server: isDev
      ? {
          https: false, // run on http in dev for simplicity
          port: 3001,
          // proxy API requests to backend to avoid CORS issues
          proxy: {
            "/api": {
              target: "https://localhost:7203",
              changeOrigin: true,
              secure: false,
              rewrite: (path) => path.replace(/^\/api/, ""),
            },
          },
        }
      : undefined, // skip HTTPS when building for prod (no certs in CI/CD)

    test: {
      environment: "jsdom", // enables DOM APIs for testing
      globals: true, // allows using 'describe', 'it', etc. without importing
      reporters: ["default"],
      coverage: {
        exclude: [
          "vite.config.mjs", // ⬅️ explicitly exclude this
          "tests/", // optionally exclude your tests too
          "node_modules/", // always good to exclude this
        ],
        reporter: ["text", "html"],
      },
    },
    build: {
      minify: "esbuild", // faster default
      // Keep console logs in production
      esbuild: {
        drop: [], // don’t drop console or debugger
      },
    },
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["offline.html", "images/ident.png"],
        devOptions: {
          enabled: true, // ensures PWA plugin works in dev
          type: "module", // optional, can help with modern SW registration
        },
        manifest: {
          name: "UK Bus Tracker",
          short_name: "BusTracker",
          start_url: "/",
          display: "standalone",
          background_color: "#ffffff",
          theme_color: "#0078d4",
          icons: [
            {
              src: "/images/ident.png",
              sizes: "256x256",
              type: "image/png",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        },
      }),
    ],
  };
});
