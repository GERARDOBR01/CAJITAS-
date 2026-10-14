import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import handler from "./server/handler.js";

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  const base = mode === "pages" ? "/CAJITAS-/" : "/";
  return {
    base,
    plugins: [
      react(),
      {
        name: "cajitas-local-api",
        configureServer(server) {
          server.middlewares.use("/api", (req, res) => {
            req.url = "/api" + req.url;
            handler(req, res);
          });
        },
      },
      VitePWA({
        disable: mode === "native",
        registerType: "prompt",
        includeAssets: ["mascot.svg", "icon-192.png", "icon-512.png"],
        manifest: {
          name: "Cajitas · Poquito a poquito",
          short_name: "Cajitas",
          lang: "es-MX",
          description: "Tu ahorro, un sueño a la vez.",
          theme_color: "#f8f6f1",
          background_color: "#f8f6f1",
          display: "standalone",
          start_url: base,
          scope: base,
          icons: [
            { src: `${base}icon-192.png`, sizes: "192x192", type: "image/png" },
            {
              src: `${base}icon-512.png`,
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
          ],
        },
        workbox: {
          navigateFallbackDenylist: [/^\/api\//],
          globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        },
      }),
    ],
    test: { include: ["tests/**/*.test.js"] },
  };
});
