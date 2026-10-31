import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import { LLM_SYSTEM, llmEndpoint, llmKey } from "./src/server/llm";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > 100_000) {
        reject(new Error("body too large"));
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function parseLines(content: string): { agent: string; text: string }[] | null {
  const start = content.indexOf("[");
  const end = content.lastIndexOf("]");
  if (start < 0 || end < start) return null;
  const parsed = JSON.parse(content.slice(start, end + 1)) as unknown;
  if (!Array.isArray(parsed)) return null;
  const lines: { agent: string; text: string }[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") return null;
    const agent = (item as { agent?: unknown }).agent;
    const text = (item as { text?: unknown }).text;
    if (typeof agent !== "string" || typeof text !== "string") return null;
    lines.push({ agent, text });
  }
  return lines;
}

function debateApi(): Plugin {
  return {
    name: "night-desk-debate",
    configureServer(server) {
      server.middlewares.use("/api/debate", (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }
        void (async () => {
          const key = llmKey(process.env);
          if (!key) {
            send(res, 200, { mode: "rules", available: false });
            return;
          }
          const endpoint = llmEndpoint(process.env);
          const facts = await readBody(req);
          const response = await fetch(endpoint.url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
              model: endpoint.model,
              temperature: 0.3,
              messages: [
                { role: "system", content: LLM_SYSTEM },
                { role: "user", content: facts },
              ],
            }),
            signal: AbortSignal.timeout(20000),
          });
          if (!response.ok) {
            send(res, 200, { mode: "rules", available: true, error: "llm failed" });
            return;
          }
          const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
          const content = payload.choices?.[0]?.message?.content ?? "";
          const lines = parseLines(content);
          if (!lines) {
            send(res, 200, { mode: "rules", available: true, error: "unreadable model reply" });
            return;
          }
          send(res, 200, { mode: "llm", available: true, lines });
        })().catch(() => {
          if (!res.writableEnded) send(res, 200, { mode: "rules", available: true, error: "llm failed" });
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), debateApi()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
