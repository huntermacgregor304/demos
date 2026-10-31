import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

function vaultApi(): Plugin {
  const vaultDir = () => process.env.BOT_BRAIN_VAULT || path.join(appRoot, "vault");
  return {
    name: "bot-brain-vault",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url !== "/api/graph") {
          next();
          return;
        }
        const file = path.join(vaultDir(), "graph.json");
        if (!existsSync(file)) {
          res.statusCode = 404;
          res.end("vault graph not found");
          return;
        }
        res.setHeader("content-type", "application/json");
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), vaultApi()],
  resolve: {
    alias: {
      "@": path.resolve(appRoot, "src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
  },
});
