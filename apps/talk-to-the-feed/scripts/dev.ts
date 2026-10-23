export {};

const bun = process.execPath;
const apiPort = process.env.PORT ?? "8787";

const api = Bun.spawn([bun, "run", "--hot", "server/index.ts"], {
  stdout: "inherit",
  stderr: "inherit",
  stdin: "inherit",
  env: { ...process.env, PORT: apiPort },
});

const web = Bun.spawn([bun, "run", "dev:web"], {
  stdout: "inherit",
  stderr: "inherit",
  stdin: "inherit",
  env: { ...process.env, API_PORT: apiPort },
});

console.log("[talk-to-the-feed] open http://localhost:3000");
console.log("[talk-to-the-feed] mock session http://localhost:3000/?mock=1");

const shutdown = () => {
  api.kill();
  web.kill();
};

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

const code = await Promise.race([api.exited, web.exited]);
shutdown();
process.exit(code);
