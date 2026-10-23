import { handleEnrich } from "./enrich";
import { handleSession } from "./session";
import { handleYoutube } from "./youtube";

const port = Number(process.env.PORT ?? 8787);

const server = Bun.serve({
  hostname: "127.0.0.1",
  port,
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        xai: Boolean(process.env.XAI_API_KEY),
        youtube: Boolean(process.env.YOUTUBE_API_KEY),
      });
    }
    if (request.method === "POST" && url.pathname === "/api/session") return handleSession();
    if (request.method === "POST" && url.pathname === "/api/youtube") return handleYoutube(request);
    if (request.method === "POST" && url.pathname === "/api/enrich") return handleEnrich(request);
    return new Response("Not found", { status: 404 });
  },
});

console.log(
  `[talk-to-the-feed] api on http://127.0.0.1:${server.port} xai=${Boolean(process.env.XAI_API_KEY)} youtube=${Boolean(process.env.YOUTUBE_API_KEY)}`,
);
