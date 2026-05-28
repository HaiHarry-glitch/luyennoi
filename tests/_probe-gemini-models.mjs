// Probe each model in the system against the real Gemini REST API.
// Reports: alive (HTTP 200), dead (404 / 403 / 400 "not found"), or other error.
const API_KEY = process.env.GEMINI_KEY || process.argv[2] || "";
if (!API_KEY) {
  console.error("Usage: node tests/_probe-gemini-models.mjs <API_KEY>");
  process.exit(2);
}

const MODELS = [
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-3.1-pro-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

// Also probe a few candidate replacements that are likely to be alive in 2026.
const CANDIDATES = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash-exp",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
  "gemini-2.5-flash-preview-05-20",
  "gemini-2.5-pro-preview-05-06",
];

async function probe(model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${API_KEY}`;
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "ping" }] }],
        generationConfig: { maxOutputTokens: 8 },
      }),
    });
    const ms = Date.now() - t0;
    if (r.ok) {
      const data = await r.json().catch(() => ({}));
      const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "(empty)";
      return { model, status: "ALIVE", http: r.status, ms, reply: String(txt).slice(0, 40) };
    }
    const errBody = await r.text().catch(() => "");
    let msg = "";
    try { msg = JSON.parse(errBody).error?.message || errBody; } catch { msg = errBody; }
    return { model, status: "DEAD", http: r.status, ms, error: msg.slice(0, 160) };
  } catch (e) {
    return { model, status: "ERR", error: String(e.message || e).slice(0, 160) };
  }
}

// Also list models available to this key.
async function listModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}&pageSize=200`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json();
    return (data.models || []).map((m) => (m.name || "").replace(/^models\//, "")).filter(Boolean);
  } catch { return null; }
}

(async () => {
  console.log("===== System models (used in api.mjs) =====");
  const sysResults = [];
  for (const m of MODELS) {
    const r = await probe(m);
    sysResults.push(r);
    const flag = r.status === "ALIVE" ? "✅" : "❌";
    console.log(`${flag} ${m.padEnd(35)} ${r.status} (HTTP ${r.http ?? "-"}) ${r.error ? "→ " + r.error : (r.reply ? "→ " + r.reply : "")}`);
  }

  console.log("\n===== Candidate replacements =====");
  const candResults = [];
  for (const m of CANDIDATES) {
    const r = await probe(m);
    candResults.push(r);
    const flag = r.status === "ALIVE" ? "✅" : "❌";
    console.log(`${flag} ${m.padEnd(35)} ${r.status} (HTTP ${r.http ?? "-"}) ${r.error ? "→ " + r.error : (r.reply ? "→ " + r.reply : "")}`);
  }

  console.log("\n===== All models available to this API key =====");
  const all = await listModels();
  if (!all) { console.log("(listModels failed — key may not have ListModels permission)"); }
  else {
    const gen = all.filter((n) => /^gemini-/i.test(n) && !/embedding|aqa/i.test(n));
    gen.sort();
    console.log(gen.join("\n"));
    console.log(`\nTotal generative gemini-* models: ${gen.length}`);
  }

  const dead = sysResults.filter((r) => r.status !== "ALIVE").map((r) => r.model);
  const alive = sysResults.filter((r) => r.status === "ALIVE").map((r) => r.model);
  console.log("\n===== SUMMARY =====");
  console.log("Alive in system:", alive.length ? alive.join(", ") : "(NONE)");
  console.log("Dead in system :", dead.length ? dead.join(", ") : "(none)");
})();
