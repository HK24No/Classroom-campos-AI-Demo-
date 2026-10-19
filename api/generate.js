// api/generate.js
// Vercel serverless function — keeps the Anthropic API key on the server,
// never exposed to the browser.
//
// Env vars (Vercel → Project → Settings → Environment Variables):
//   ANTHROPIC_API_KEY  (required)
//   ANTHROPIC_MODEL    (optional, defaults to claude-sonnet-4-6)

const MAX_TOKENS_CAP = 4096;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set on the server" });
  }

  const { system, messages, max_tokens } = req.body || {};

  if (!system || !Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: "Missing 'system' or 'messages' in request body" });
  }
  // Only plain user/assistant text turns are accepted (recap, lesson, and after-class follow-up).
  const clean = messages
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-6)
    .map(m => ({ role: m.role, content: m.content.slice(0, 40000) }));
  if (!clean.length || clean[clean.length - 1].role !== "user") {
    return res.status(400).json({ error: "The last message must be from the user" });
  }
  const maxTokens = Math.min(Math.max(parseInt(max_tokens, 10) || 1400, 400), MAX_TOKENS_CAP);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
        max_tokens: maxTokens,
        system: String(system).slice(0, 60000),
        messages: clean,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
