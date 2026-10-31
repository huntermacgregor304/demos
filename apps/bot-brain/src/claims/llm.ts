import type { Claim } from "@/types";

export async function llmAdvice(claims: Claim[]): Promise<string> {
  const key = process.env.BOT_BRAIN_LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) {
    return "LLM mode was requested, but no BOT_BRAIN_LLM_API_KEY or OPENAI_API_KEY is set. Local verdicts were kept.";
  }
  const base = (process.env.BOT_BRAIN_LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.BOT_BRAIN_LLM_MODEL || "gpt-4o-mini";
  const payload = claims.slice(0, 40).map((claim) => ({
    id: claim.id,
    text: claim.text,
    local: claim.status,
    source: claim.sourceLabel,
  }));
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: "user",
            content:
              "You are a local second-brain checker. For each claim, reply with one line: id | sourced or unverified | short reason. Do not invent sources. Claims:\n" +
              JSON.stringify(payload),
          },
        ],
      }),
    });
    if (!response.ok) {
      return `LLM request failed (${response.status}). Local verdicts were kept.`;
    }
    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || "LLM returned an empty note. Local verdicts were kept.";
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed";
    return `LLM request failed (${message}). Local verdicts were kept.`;
  }
}
