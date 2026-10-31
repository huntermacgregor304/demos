export const LLM_SYSTEM = [
  "You are rewriting a paper-trading desk debate for a demo.",
  "Speakers, in order: NOVA analyst, NYX analyst, ORION bull, VELA bear, KADE risk, ZARA risk.",
  "Return a JSON array only. Each item is {\"agent\":\"NOVA\",\"text\":\"...\"}.",
  "Use only numbers that appear in the user facts.",
  "PAPER ONLY. No orders, no brokers, no forecasts, no claims that a rule makes money.",
].join(" ");

/** Server-side only. The browser bundle must not import this with a real env. */
export function llmKey(env: Record<string, string | undefined>): string | null {
  const key = env.NIGHT_DESK_LLM_API_KEY?.trim();
  return key ? key : null;
}

export function llmEndpoint(env: Record<string, string | undefined>): { url: string; model: string } {
  const base = (env.NIGHT_DESK_LLM_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = env.NIGHT_DESK_LLM_MODEL?.trim() || "gpt-4o-mini";
  return { url: `${base}/chat/completions`, model };
}
