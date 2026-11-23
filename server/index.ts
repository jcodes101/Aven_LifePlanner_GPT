import { createServer } from "node:http";
import { createApp } from "./app.ts";
import { createProvider } from "./ai/providerFactory.ts";
import { loadConfig } from "./config.ts";

const config = loadConfig();
const setup = createProvider(config.ai);

const server = createServer(
  createApp({
    config,
    provider: setup.configured ? setup.provider : null,
  }),
);

server.listen(config.port, () => {
  console.info(`[server] Aven API listening on http://localhost:${config.port}`);
  console.info(`[server] Allowed origins: ${config.allowedOrigins.join(", ")}`);
  if (setup.configured) {
    console.info(
      `[server] Life Planning AI ready (provider: ${setup.provider.name}, model: ${config.ai.model}).`,
    );
  } else {
    console.warn(
      `[server] Life Planning AI is NOT configured: ${setup.reason} Requests will return "ai_not_configured".`,
    );
  }
});

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
