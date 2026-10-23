import { readClientSecret } from "../src/lib/session-config";

const CLIENT_SECRETS_URL = "https://api.x.ai/v1/realtime/client_secrets";

export async function mintClientSecret(apiKey: string, fetchImpl: typeof fetch = fetch) {
  const response = await fetchImpl(CLIENT_SECRETS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expires_after: { seconds: 300 } }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      body && typeof body === "object" && "error" in body ? JSON.stringify((body as { error: unknown }).error) : response.statusText;
    throw new Error(`client_secrets failed (${response.status}): ${detail}`);
  }
  const secret = readClientSecret(body);
  if (!secret) throw new Error("client_secrets response did not include a token.");
  return secret;
}

export async function handleSession(fetchImpl: typeof fetch = fetch): Promise<Response> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "XAI_API_KEY is not set on the server. Add it to .env, or open ?mock=1 to play the scripted session." },
      { status: 503 },
    );
  }
  try {
    const secret = await mintClientSecret(apiKey, fetchImpl);
    return Response.json({ value: secret.value, expires_at: secret.expiresAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not mint a client token.";
    return Response.json({ error: message }, { status: 502 });
  }
}
