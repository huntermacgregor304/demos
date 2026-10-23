# Talk to the Feed

A browser demo of [Grok Voice 3.0](https://docs.x.ai/developers/models/grok-voice-3.0) (`grok-voice-latest`). Hold a button, ask what people are saying about a topic, and Grok answers out loud while the posts and comments it cites land on screen.

## Setup

```bash
cd apps/talk-to-the-feed
cp .env.example .env
```

Put these in `.env`. Both stay on the server.

- `XAI_API_KEY` — mints a short-lived realtime client token. The browser never sees this key.
- `YOUTUBE_API_KEY` — YouTube Data API v3, used for `search.list` and `commentThreads.list`.

```bash
bun install
bun run dev
```

Open http://localhost:3000. The page is served by Vite. A Bun process on port 8787 handles `/api` and is proxied, so you only open port 3000.

Mock mode does not need keys:

http://localhost:3000/?mock=1

Press **Play sample question**. The Orbit Sneakers story is fictional and labeled as mock data.

## How it works

1. `POST /api/session` calls `POST https://api.x.ai/v1/realtime/client_secrets` with `expires_after.seconds` of 300 and returns `{ value, expires_at }`.
2. The browser opens `wss://api.x.ai/v1/realtime?model=grok-voice-3.0` with the subprotocol `xai-client-secret.<token>`.
3. `session.update` sets the voice (`eve`, `ara`, or `rex`), manual turn taking (`turn_detection.type: null`), PCM16 at 24 kHz, and the tools that match the toggles.
4. Hold the button (or Space) to stream mic audio as `input_audio_buffer.append`. Release sends `input_audio_buffer.commit` and `response.create`.
5. Enabled sources:
   - **X** — server-side `x_search`.
   - **Facebook** — server-side `web_search` with `allowed_domains: ["facebook.com"]`.
   - **YouTube** — client function `search_youtube_comments`. The server searches 3 recent videos (`search.list`, `order=date`) and pulls 5 comments each (`commentThreads.list`, `order=relevance`). Results are cached in memory for 15 minutes per normalized query. A search is 100 quota units plus 1 unit per comment thread.
6. Grok calls `render_story` with the headline, summary, mood splits, questions, and card refs (url, YouTube `comment_id`, spoken cue, and why-tag). The screen does not use post text from that payload.
7. X and Facebook cards are filled by `POST /api/enrich` (X oEmbed, Open Graph for everything else). YouTube cards are filled from the comment payload the server already fetched. If a preview cannot be loaded, the card keeps the link and does not invent the body.
8. While Grok speaks, `zxcite1` … `zxcite8` in the audio transcript reveal the matching card. Those tokens are listed in `session.replace` so the docs’ pronunciation map can drop them from the audio while leaving them in the transcript. The visible transcript strips them. A cue match after the headline and summary, or an inline citation url, is the fallback.

The debug switch (off by default, or `?debug=1`) logs each realtime event type to the browser console. Audio deltas are redacted so the base64 does not flood the log.

## Facebook

Facebook has no public post-search API. The Facebook toggle only searches the public web via `web_search`, limited to `facebook.com`. Private profiles, groups, and anything the search index cannot see will not appear. Cards say so when a preview cannot be fetched.

## Tests

```bash
bun test
```

Fixtures live in `src/fixtures/` and follow the documented YouTube Data API, X oEmbed, Open Graph, and realtime event shapes. They cover event reduction, citation-to-card mapping, `render_story` parsing, and YouTube parsing.

## Assumptions to verify with a real key

These follow the docs as of the implementation and are called out because this repo was built without `XAI_API_KEY` or `YOUTUBE_API_KEY`.

- Browser auth is the `xai-client-secret.` WebSocket subprotocol, and the token is a legal subprotocol value.
- `session.update` accepts nested `reasoning.effort: "none"` (chosen for snappier speech; the API default is `high`), `turn_detection: { type: null }`, `audio.input.transcription.model: "grok-transcribe"`, and `replace` for the `zxciteN` tokens.
- Assistant audio arrives as base64 PCM16 on `response.output_audio.delta` (also handled: `response.audio.delta`). Mic audio is sent on `input_audio_buffer.append` as `{ audio }`.
- Custom tools arrive as `response.function_call_arguments.done` with `name`, `call_id`, and `arguments`. Results go back as `conversation.item.create` / `function_call_output`, then one `response.create`.
- The realtime socket does not document a per-word citation event. `render_story` plus transcript markers are the sync path. `response.citations` is treated as the corpus list from the text API (not auto-shown). `annotations` / inline urls are treated as live cites.
- X post text comes from `https://publish.twitter.com/oembed`. Facebook text comes from Open Graph. Either can fail or omit a thumbnail; the card then shows the link only.
- YouTube `order=date` is the “recent” half of “relevant recent.” Comment ranking is `order=relevance`.

## Out of scope

No accounts, phone calls, saved history, reply drafting, cross-source ranking, or suggested replies.
