import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const proxyTarget = process.env.VITE_PROXY_BACKEND_URL || "http://localhost:9000";

const proxyConfig = {
  target: proxyTarget,
  changeOrigin: true,
  configure: (proxy: any) => {
    proxy.on("error", (_err: any, _req: any, res: any) => {
      if (res && !res.headersSent && typeof res.writeHead === "function") {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            message: "Medusa backend is booting up on port 9000...",
            status: 503,
          })
        );
      }
    });
  },
};

const proxyRoutes = {
  "/admin": proxyConfig,
  "/auth": proxyConfig,
  "/store": proxyConfig,
  "/static": proxyConfig,
  "/health": proxyConfig,
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 7001,
    proxy: proxyRoutes,
  },
  preview: {
    host: true,
    port: 7001,
    proxy: proxyRoutes,
  },
});
