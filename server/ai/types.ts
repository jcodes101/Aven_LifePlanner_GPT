// Provider-neutral contract for the AI model behind Aven. Adding Claude,
// Gemini, or another vendor means writing one more AIProvider implementation
// and registering it in providerFactory.ts; the HTTP layer never changes.

export type ProviderMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CompletionRequest = {
  messages: ProviderMessage[];
  maxOutputTokens: number;
  signal: AbortSignal;
};

export type CompletionResult = {
  content: string;
  model: string;
  finishReason: string | null;
};

export interface AIProvider {
  readonly name: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

export type AIProviderErrorKind =
  | "auth"
  | "rate_limit"
  | "timeout"
  | "bad_response"
  | "blocked"
  | "unavailable";

export class AIProviderError extends Error {
  readonly kind: AIProviderErrorKind;
  readonly status: number | null;

  constructor(kind: AIProviderErrorKind, message: string, status?: number) {
    super(message);
    this.name = "AIProviderError";
    this.kind = kind;
    this.status = status ?? null;
  }
}
