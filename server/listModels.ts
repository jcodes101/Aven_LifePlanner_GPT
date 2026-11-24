import { listGeminiModels } from "./ai/geminiProvider.ts";
import { loadConfig } from "./config.ts";

// `npm run models`: prints the Gemini models your GEMINI_API_KEY can use for
// chat, so AI_MODEL can be set to one that actually exists for your account.
const config = loadConfig();
const apiKey = config.ai.gemini.apiKey;

if (!apiKey) {
  console.error("GEMINI_API_KEY is not set. Add it to .env first (see .env.example).");
  process.exit(1);
}

try {
  const models = await listGeminiModels({
    apiKey,
    ...(config.ai.gemini.baseUrl ? { baseUrl: config.ai.gemini.baseUrl } : {}),
  });
  console.info(`Models available to this key for text chat (${models.length}):\n`);
  for (const model of models) {
    const marker = model.id === config.ai.model ? "  <- current AI_MODEL" : "";
    console.info(`  ${model.id.padEnd(42)} ${model.displayName}${marker}`);
  }
  if (config.ai.model && !models.some((model) => model.id === config.ai.model)) {
    console.warn(`\nAI_MODEL "${config.ai.model}" is not in this list. Pick one above.`);
  }
  console.info(
    "\nFree-tier eligibility and limits: https://aistudio.google.com/docs/pricing and https://aistudio.google.com/rate-limit",
  );
} catch (error) {
  console.error(`Could not list models: ${(error as Error).message}`);
  process.exit(1);
}
