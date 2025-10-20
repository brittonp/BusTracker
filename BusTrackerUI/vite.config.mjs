// vite.config.mjs
import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

export default defineConfig(({ command }) => {
  const isDev = command === "serve";

  // These two lines make __dirname available in an ES module (.mjs)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  return {
    define: {
      apiBase: JSON.stringify(
        isDev ? "" : "https://agreeable-tree-0e83e4c03.3.azurestaticapps.net"
      ),
      isDev: JSON.stringify(isDev),
    },
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
  };
});
