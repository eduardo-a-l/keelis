export type ProviderChoice = "anthropic" | "gemini";

export interface ProviderEnv {
  KEELIS_PROVIDER?: string;
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
}

export function selectProviderChoice(env: ProviderEnv): ProviderChoice {
  const requested = env.KEELIS_PROVIDER?.toLowerCase();

  if (requested === "gemini") {
    return "gemini";
  }
  if (requested === "anthropic") {
    return "anthropic";
  }
  if (env.GEMINI_API_KEY && !env.ANTHROPIC_API_KEY) {
    return "gemini";
  }
  return "anthropic";
}
