import { createServer } from "node:http";
import { createApp } from "./app.ts";
import { listGeminiModels } from "./ai/geminiProvider.ts";
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
    void checkGeminiModel();
  } else {
    console.warn(
      `[server] Life Planning AI is NOT configured: ${setup.reason} Requests will return "ai_not_configured".`,
    );
  }
});

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Warn at startup (instead of on the first chat) when AI_MODEL is not one the
// key can use. Never blocks startup; a failed check is only logged.
async function checkGeminiModel() {
  const { apiKey, baseUrl } = config.ai.gemini;
  if (config.ai.provider !== "gemini" || !apiKey || !config.ai.model) return;
  try {
    const models = await listGeminiModels({ apiKey, ...(baseUrl ? { baseUrl } : {}) });
    const wanted = config.ai.model.replace(/^models\//, "");
    if (!models.some((model) => model.id === wanted)) {
      console.warn(
        `[server] AI_MODEL "${wanted}" is not available to this key. Run "npm run models" and pick one of the listed IDs.`,
      );
    } else {
      console.info(`[server] Verified "${wanted}" is available to this key.`);
    }
  } catch (error) {
    console.warn(`[server] Could not verify AI_MODEL: ${(error as Error).message}`);
  }
}
