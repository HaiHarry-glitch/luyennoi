const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://gxjgkwebrxzcawqkxmbt.supabase.co").replace(/\/+$/, "");
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_ktG6l3TaDDppl9n6flBuZg_3THO38Dp";
const GEMINI_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite"
];

function json(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    },
    body: JSON.stringify(body)
  };
}

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  return JSON.parse(raw || "{}");
}

function getPath(event) {
  return (event.path || "").replace(/^\/\.netlify\/functions\/api\/?/, "/").replace(/^\/api\/?/, "/");
}

function decodeJwtPayload(jwt) {
  try {
    const parts = String(jwt || "").split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch { return null; }
}

function getAuthInfo(event) {
  const cookie = event.headers.cookie || event.headers.Cookie || "";
  const sbToken = cookie.match(/(?:^|;\s*)ln_sb_access=([^;]+)/)?.[1];
  const auth = event.headers.authorization || event.headers.Authorization || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  const raw = bearer || (sbToken ? decodeURIComponent(sbToken) : "");
  const payload = decodeJwtPayload(raw);
  if (payload && payload.sub) {
    const meta = payload.user_metadata || {};
    return {
      userId: payload.sub,
      isAuthenticated: true,
      email: payload.email || "",
      displayName: meta.full_name || meta.name || payload.email || "",
    };
  }
  return { userId: "local-student", isAuthenticated: false, email: "", displayName: "Local Student" };
}

function getUserId(event) {
  return getAuthInfo(event).userId;
}

function getToken(event) {
  const auth = event.headers.authorization || event.headers.Authorization || "";
  return auth.match(/^Bearer\s+(.+)$/i)?.[1] || "";
}

async function supabaseRest(path, { method = "GET", body, token = "" } = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      "apikey": SUPABASE_PUBLISHABLE_KEY,
      "Authorization": `Bearer ${token || SUPABASE_PUBLISHABLE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || `Supabase HTTP ${response.status}`);
  return data;
}

async function callGemini({ apiKey, model, prompt, responseJson = false, audioBase64 = "", mimeType = "audio/webm" }) {
  const keyPool = [...new Set([apiKey, ...(process.env.GEMINI_API_KEYS || "").split(",")].map((k) => k.trim()).filter(Boolean))];
  if (!keyPool.length) throw new Error("Missing Gemini API key");
  const modelList = model ? [model, ...GEMINI_MODELS.filter((m) => m !== model)] : GEMINI_MODELS;
  let lastError = "";
  for (const m of modelList) {
    for (const key of keyPool) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: prompt },
              ...(audioBase64 ? [{ inline_data: { mime_type: mimeType, data: audioBase64 } }] : [])
            ]
          }],
          generationConfig: responseJson ? { responseMimeType: "application/json" } : {}
        })
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        return {
          model: m,
          text: (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("\n").replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim()
        };
      }
      lastError = data?.error?.message || `Gemini HTTP ${response.status}`;
      if (![429, 500, 502, 503, 504].includes(response.status)) break;
    }
  }
  throw new Error(lastError || "Gemini request failed");
}

function fallbackAssist(kind, topic) {
  if (kind === "vocab") {
    return {
      provider: "mock",
      model: "local-fallback",
      title: "Từ vựng chủ đề",
      words: [
        { phrase: "keep track of time", vi: "theo dõi thời gian", example: "A watch helps me keep track of time." },
        { phrase: "stylish accessory", vi: "phụ kiện thời trang", example: "It can be a stylish accessory." },
        { phrase: "daily routine", vi: "thói quen hằng ngày", example: "It is part of my daily routine." }
      ]
    };
  }
  return {
    provider: "mock",
    model: "local-fallback",
    title: "Câu mẫu",
    directAnswer: `Yes, ${String(topic || "this topic").toLowerCase()} is something I can talk about.`,
    explanation: "It is useful in daily life and easy to connect with personal experience.",
    example: "For example, I can give one short story from school or work."
  };
}

function fallbackScore(question, transcript) {
  return {
    provider: "mock",
    model: "local-fallback",
    overall: 5.5,
    transcript: transcript || "",
    question,
    criteria: {
      pronunciation: { score: 5, feedback: "Cần nghe audio rõ hơn để chấm phát âm chính xác." },
      fluency: { score: 6, feedback: "Mạch nói ổn nhưng cần giảm ngập ngừng." },
      grammar: { score: 5, feedback: "Cần giảm lỗi chia thì và cấu trúc câu." },
      vocabulary: { score: 6, feedback: "Từ vựng đủ dùng nhưng cần thêm collocation." }
    },
    pronunciationIssues: [],
    suggestions: ["Trả lời trực tiếp.", "Thêm một lý do.", "Kết bằng ví dụ ngắn."]
  };
}

async function handleAssist(event) {
  const body = parseBody(event);
  try {
    const prompt = `Return ONLY valid JSON for IELTS Speaking helper.
Kind: ${body.kind || "sample"}
Topic/question: ${body.topic || body.question || ""}
Learner note: ${body.note || ""}
For Part 1 keep total answer 30-45 words. Use directAnswer, explanation, example.`;
    const { text, model } = await callGemini({ apiKey: body.apiKey, model: body.model, prompt, responseJson: true });
    return json(200, { provider: "gemini", model, kind: body.kind || "sample", ...JSON.parse(text) });
  } catch (error) {
    return json(200, { ...fallbackAssist(body.kind || "sample", body.topic || body.question || ""), warning: error.message });
  }
}

async function handleScore(event) {
  const body = parseBody(event);
  try {
    const prompt = `You are a strict IELTS Speaking examiner. Return ONLY JSON with overall, transcript, criteria, pronunciationIssues, suggestions.
Question: ${body.question || ""}
Part: ${body.part || ""}
Transcript hint: ${body.transcript || ""}
Score conservatively.`;
    const { text, model } = await callGemini({
      apiKey: body.apiKey,
      model: body.model || "gemini-3-flash-preview",
      prompt,
      responseJson: true,
      audioBase64: body.audioBase64 || "",
      mimeType: body.mimeType || "audio/webm"
    });
    return json(200, { provider: "gemini", model, ...JSON.parse(text) });
  } catch (error) {
    return json(200, { ...fallbackScore(body.question || "", body.transcript || ""), warning: error.message });
  }
}

async function handleSession(event, action, id = "") {
  const body = parseBody(event);
  const now = new Date().toISOString();
  const token = getToken(event);
  if (action === "start") {
    const __info = getAuthInfo(event);
    const payload = {
      id: crypto.randomUUID(),
      user_id: __info.isAuthenticated ? __info.userId : null,
      client_user_id: __info.userId,
      test_type: body.test_type || "custom_strict",
      status: "started",
      strict_mode: !!body.strict_mode,
      fullscreen_required: !!body.fullscreen_required,
      selected_part1_topics: Array.isArray(body.selected_part1_topics) ? body.selected_part1_topics.slice(0, 3) : [],
      selected_part2_topic: body.selected_part2_topic || null,
      derived_part3_topic: body.derived_part3_topic || body.selected_part2_topic || null,
      generated_question_ids: Array.isArray(body.generated_question_ids) ? body.generated_question_ids : [],
      started_at: now,
      prediction_weight: body.test_type === "custom_strict" ? 1 : 0.45,
      anti_cheat_summary: {},
      created_at: now
    };
    const rows = await supabaseRest("test_sessions", { method: "POST", body: payload, token });
    return json(200, { ok: true, source: "supabase", session: rows?.[0] || payload });
  }
  const patch = {
    status: { cancel: "cancelled", complete: "completed", invalidate: "invalidated" }[action] || "started",
    ended_at: now,
    cancel_reason: body.reason || body.cancel_reason || null,
    anti_cheat_summary: body.anti_cheat_summary || {}
  };
  const rows = await supabaseRest(`test_sessions?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: patch, token });
  return json(200, { ok: true, source: "supabase", session: rows?.[0] });
}

async function handleEvents(event) {
  const body = parseBody(event);
  const events = Array.isArray(body.events) ? body.events : [body];
  const __evInfo = getAuthInfo(event);
  const payload = events.map((item) => ({
    user_id: __evInfo.isAuthenticated ? __evInfo.userId : null,
    client_user_id: __evInfo.userId,
    session_id: item.session_id || body.session_id || null,
    attempt_id: item.attempt_id || null,
    event_type: item.event_type || "unknown",
    event_payload: item.event_payload || item.payload || {},
    page_path: item.page_path || "",
    user_agent: event.headers["user-agent"] || "",
    ip_hash: "",
    created_at: item.created_at || new Date().toISOString()
  }));
  const rows = await supabaseRest("practice_events", { method: "POST", body: payload, token: getToken(event) });
  return json(200, { ok: true, source: "supabase", count: rows?.length || payload.length });
}

async function handleGetAttempts(event) {
  const qs = event.queryStringParameters || {};
  const question = (qs.question || "").trim();
  if (!question) return json(200, { ok: true, attempts: [] });
  const limit = Math.min(parseInt(qs.limit || "10", 10), 20);
  const token = getToken(event);
  const userId = getUserId(event);
  try {
    const filter = `prompt_text=eq.${encodeURIComponent(question)}&order=created_at.desc&limit=${limit}`;
    const userFilter = userId !== "local-student" ? `&user_id=eq.${userId}` : "";
    const rows = await supabaseRest(
      `practice_attempts?select=id,created_at,prompt_text,transcript,audio_path,score_overall,score_fluency,score_vocab,score_grammar,score_pronunciation,raw_score_json,part&${filter}${userFilter}`,
      { method: "GET", token }
    );
    const attempts = (rows || []).map(r => ({
      id: r.id, created_at: r.created_at, transcript: r.transcript, audioUrl: null,
      overall: r.score_overall, fluency: r.score_fluency, vocabulary: r.score_vocab,
      grammar: r.score_grammar, pronunciation: r.score_pronunciation,
      raw: r.raw_score_json || null, part: r.part
    }));
    return json(200, { ok: true, attempts });
  } catch (e) {
    return json(200, { ok: true, attempts: [], warning: e.message });
  }
}

async function handleSyncAttempts(event) {
  const body = parseBody(event);
  const attempts = Array.isArray(body.attempts) ? body.attempts : [];
  if (!attempts.length) return json(400, { ok: false, error: "No attempts" });
  const now = new Date().toISOString();
  const info = getAuthInfo(event);
  const token = getToken(event);
  const sessionId = body.session_id || null;
  const payload = attempts.map(a => ({
    user_id: info.isAuthenticated ? info.userId : null,
    client_user_id: info.userId,
    session_id: sessionId,
    question_id: a.question_id || null,
    mode: a.mode || "custom_strict",
    part: a.part || null,
    topic: a.topic || null,
    prompt_text: a.prompt_text || "",
    transcript: a.transcript || null,
    audio_path: null,
    audio_duration_ms: a.audio_duration_ms || null,
    recording_started_at: a.recording_started_at || null,
    recording_ended_at: a.recording_ended_at || null,
    score_overall: a.score_overall ?? null,
    score_fluency: a.score_fluency ?? null,
    score_vocab: a.score_vocab ?? null,
    score_grammar: a.score_grammar ?? null,
    score_pronunciation: a.score_pronunciation ?? null,
    raw_score_json: a.raw_score_json || {},
    gemini_model: a.gemini_model || null,
    client_attempt_id: a.client_attempt_id || crypto.randomUUID(),
    created_at: a.created_at || now
  }));
  try {
    const rows = await supabaseRest("practice_attempts", { method: "POST", body: payload, token });
    return json(200, { ok: true, source: "supabase", count: rows?.length || payload.length });
  } catch (e) {
    return json(500, { ok: false, error: e.message });
  }
}

// trackLogin removed — profiles is populated by Supabase Auth trigger.

export async function handler(event) {
  const path = getPath(event);
  const method = event.httpMethod || "GET";
  try {
    if (method === "GET" && path === "/supabase/config") {
      return json(200, { ok: true, url: SUPABASE_URL, publishableKey: SUPABASE_PUBLISHABLE_KEY, connected: true });
    }
    if (path === "/login") {
      return { statusCode: 302, headers: { Location: "/", "Set-Cookie": "ln_auth=1; Path=/; Max-Age=2592000; SameSite=Lax" }, body: "" };
    }
    if (path === "/logout") {
      return { statusCode: 302, headers: { Location: "/", "Set-Cookie": "ln_auth=; Path=/; Max-Age=0; SameSite=Lax" }, body: "" };
    }
    if (method === "POST" && path === "/gemini/assist") return handleAssist(event);
    if (method === "POST" && path === "/gemini/score-speaking") return handleScore(event);
    if (method === "POST" && path === "/test-sessions/start") return handleSession(event, "start");
    const sessionAction = path.match(/^\/test-sessions\/([^/]+)\/(cancel|complete|invalidate)$/);
    if (method === "POST" && sessionAction) return handleSession(event, sessionAction[2], sessionAction[1]);
    if (method === "POST" && (path === "/events" || path === "/events/batch")) return handleEvents(event);
    if (method === "GET" && path === "/practice-attempts") return handleGetAttempts(event);
    if (method === "POST" && path === "/practice-attempts") return handleSyncAttempts(event);
    return json(404, { ok: false, error: `Unknown API path: ${path}` });
  } catch (error) {
    return json(500, { ok: false, error: error.message });
  }
}
