import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const useHttps = process.env.VITE_DEV_HTTPS === "1";

export default defineConfig({
  plugins: [
    react(),
    ...(useHttps ? [basicSsl()] : []),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["brand/enrutas-logo.png"],
      manifest: {
        name: "EnRutas",
        short_name: "EnRutas",
        description: "Visitas, ventas y evidencia GPS en campo",
        theme_color: "#18312f",
        background_color: "#f7f3ed",
        display: "standalone",
        lang: "es-VE",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "brand/enrutas-logo.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "brand/enrutas-logo.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,webp}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    // Con HTTPS, abre https://localhost:5173 o https://TU-IP:5173 en el celular (misma Wi‑Fi).
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8090",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8090",
        changeOrigin: true,
      },
    },
  },
});
