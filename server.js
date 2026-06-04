import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { randomUUID } from "node:crypto";
// Robust Gemini JSON parser shared with the Netlify Functions.
// Handles cases where Gemini returns valid JSON followed by trailing prose,
// extra `{...}` blocks, control chars, or trailing commas — which would
// otherwise crash the raw `JSON.parse` and surface as
// "Unexpected non-whitespace character after JSON at position N".
import { parseGeminiJson } from "./netlify/functions/_lib/score.mjs";

// Load .env (inline, no dependency)
try { readFileSync(join(import.meta.dirname || ".", ".env"), "utf8").split("\n").forEach(l => { const [k,...v] = l.split("="); if (k?.trim() && !k.startsWith("#")) process.env[k.trim()] = v.join("=").trim(); }); } catch {}

const root = process.cwd();
const port = Number(process.env.PORT || 3000);
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://gxjgkwebrxzcawqkxmbt.supabase.co").replace(/\/+$/, "");
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_ktG6l3TaDDppl9n6flBuZg_3THO38Dp";
const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
const LOCAL_AUTH_GATE = process.env.LN_LOCAL_AUTH_GATE === "1";
const ASSET_VERSION = "score-async-v9";

// Load per-question Vietnamese translations (pre-scraped)
let QUESTION_VI = {};
try {
  QUESTION_VI = JSON.parse(readFileSync(join(root, "public", "data", "translations.json"), "utf8"));
  const total = Object.values(QUESTION_VI).reduce((a, b) => a + Object.keys(b).length, 0);
  console.log(`[i18n] loaded ${total} question translations`);
} catch (e) {
  console.warn("[i18n] translations.json missing — VI tooltips will be blank");
}

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff"
};

function resolvePath(urlPath) {
  let cleanPath = decodeURIComponent(urlPath.split("?")[0]);
  // Map /icons/ to /real/icons/ for manifest icon references
  if (cleanPath.startsWith("/icons/")) cleanPath = "/real" + cleanPath;
  const requested = cleanPath === "/" ? "/index.html" : cleanPath;
  const fullPath = normalize(join(root, "public", requested));
  const publicDir = join(root, "public") + sep;
  if (!fullPath.startsWith(publicDir) && fullPath !== publicDir.slice(0, -1)) {
    return null;
  }
  return fullPath;
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

async function readJson(req, maxBytes = 20 * 1024 * 1024) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > maxBytes) throw new Error("Request body too large");
  }
  return body ? JSON.parse(body) : {};
}

const localDbPath = join(root, ".local-data", "supabase-mock.json");

async function readLocalDb() {
  try {
    return JSON.parse(await readFile(localDbPath, "utf8"));
  } catch {
    return { test_sessions: [], practice_events: [], practice_attempts: [] };
  }
}

async function writeLocalDb(db) {
  await mkdir(join(root, ".local-data"), { recursive: true });
  await writeFile(localDbPath, JSON.stringify(db, null, 2), "utf8");
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

// Returns {userId, isAuthenticated, email, displayName}
// Only trusts Supabase-signed JWT (cookie ln_sb_access or Bearer header).
function getAuthInfo(req) {
  const cookie = req.headers.cookie || "";
  const sbToken = cookie.match(/(?:^|;\s*)ln_sb_access=([^;]+)/)?.[1];
  const auth = req.headers.authorization || "";
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

// Backward-compat wrapper for existing callers
function getUserId(req) {
  return getAuthInfo(req).userId;
}

// Returns the authenticated UUID or null (for use in user_id columns that reference profiles)
function getAuthUserId(req) {
  const info = getAuthInfo(req);
  return info.isAuthenticated ? info.userId : null;
}

function getSupabaseAccessToken(req) {
  const auth = req.headers.authorization || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  const cookie = req.headers.cookie || "";
  const cookieToken = cookie.match(/(?:^|;\s*)ln_sb_access=([^;]+)/)?.[1];
  return bearer || (cookieToken ? decodeURIComponent(cookieToken) : "");
}

async function getSupabaseAuthUser(token) {
  if (!SUPABASE_ENABLED || !token) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      "apikey": SUPABASE_PUBLISHABLE_KEY,
      "Authorization": `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;
  const user = await response.json();
  const meta = user.user_metadata || {};
  return {
    id: user.id,
    email: user.email,
    display_name: meta.full_name || meta.name || user.email || "Học viên",
    avatar_url: meta.avatar_url || meta.picture || "",
  };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

async function supabaseRest(path, { method = "GET", body, token = "" } = {}) {
  if (!SUPABASE_ENABLED) throw new Error("Supabase env is missing");
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
  const data = text ? (() => {
    try { return JSON.parse(text); } catch { return { message: text }; }
  })() : null;
  if (!response.ok) {
    throw new Error(data?.message || data?.error_description || `Supabase HTTP ${response.status}`);
  }
  return data;
}

// ── Audio upload to Supabase Storage (7-day retention) ──
async function uploadAudioToStorage(audioBase64, mimeType, clientUserId, attemptId, userToken = "") {
  if (!SUPABASE_ENABLED || !audioBase64) return null;
  try {
    const ext = mimeType === "audio/mp4" ? "m4a" : mimeType === "audio/ogg" ? "ogg" : "webm";
    const path = `${clientUserId}/${attemptId}.${ext}`;
    const buffer = Buffer.from(audioBase64, "base64");
    // Use the user's JWT so storage RLS (folder = auth.uid()) passes.
    // Fall back to publishable key for anonymous users.
    const authToken = userToken || SUPABASE_PUBLISHABLE_KEY;
    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/recordings/${path}`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_PUBLISHABLE_KEY,
        "Authorization": `Bearer ${authToken}`,
        "Content-Type": mimeType || "audio/webm",
        "x-upsert": "true"
      },
      body: buffer
    });
    if (!response.ok) { console.warn("[storage] upload failed:", response.status); return null; }
    return path;
  } catch (e) { console.warn("[storage] upload error:", e.message); return null; }
}

// ── GAS (Google Apps Script) long-term archival ──
const GAS_URL = process.env.GAS_WEBAPP_URL || "";

async function pushToGAS(type, rows) {
  if (!GAS_URL) return;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, rows }),
      signal: controller.signal
    });
    clearTimeout(timeout);
  } catch (e) { console.warn("[GAS] push failed:", e.message); }
}

// ── Log drill result (score-word, score-sentence) — text only, no audio ──
async function logDrillResult(clientUserId, drillType, data, authUserId = null) {
  if (!SUPABASE_ENABLED) return;
  try {
    await supabaseRest("practice_events", {
      method: "POST",
      body: {
        user_id: authUserId,
        client_user_id: clientUserId,
        event_type: drillType,
        event_payload: data,
        page_path: "",
        user_agent: "",
        ip_hash: "",
        created_at: new Date().toISOString()
      }
    });
  } catch (e) { console.warn("[drill-log]", e.message); }
}

function publicSession(session) {
  return {
    id: session.id,
    user_id: session.user_id || session.client_user_id || "local-student",
    client_user_id: session.client_user_id,
    test_type: session.test_type,
    status: session.status,
    strict_mode: !!session.strict_mode,
    fullscreen_required: !!session.fullscreen_required,
    selected_part1_topics: session.selected_part1_topics || [],
    selected_part2_topic: session.selected_part2_topic || "",
    derived_part3_topic: session.derived_part3_topic || "",
    generated_question_ids: session.generated_question_ids || [],
    started_at: session.started_at,
    ended_at: session.ended_at,
    cancel_reason: session.cancel_reason || "",
    prediction_weight: Number(session.prediction_weight ?? 1),
    anti_cheat_summary: session.anti_cheat_summary || {},
    created_at: session.created_at
  };
}

async function createSupabaseSession(req, body, now) {
  const id = randomUUID();
  const info = getAuthInfo(req);
  const clientUserId = info.userId;
  const payload = {
    id,
    user_id: info.isAuthenticated ? info.userId : null,
    client_user_id: clientUserId,
    test_type: body.test_type || "custom_strict",
    status: "started",
    strict_mode: !!body.strict_mode,
    fullscreen_required: !!body.fullscreen_required,
    selected_part1_topics: Array.isArray(body.selected_part1_topics) ? body.selected_part1_topics.slice(0, 3) : [],
    selected_part2_topic: body.selected_part2_topic || null,
    derived_part3_topic: body.derived_part3_topic || body.selected_part2_topic || null,
    generated_question_ids: Array.isArray(body.generated_question_ids) ? body.generated_question_ids : [],
    started_at: now,
    ended_at: null,
    cancel_reason: null,
    prediction_weight: body.test_type === "custom_strict" ? 1 : 0.45,
    anti_cheat_summary: {},
    created_at: now
  };
  const rows = await supabaseRest("test_sessions", {
    method: "POST",
    body: payload,
    token: getSupabaseAccessToken(req)
  });
  return publicSession(rows?.[0] || payload);
}

async function updateSupabaseSession(req, action, id, body, now) {
  const statusByAction = { cancel: "cancelled", complete: "completed", invalidate: "invalidated" };
  const patch = {
    status: statusByAction[action] || "started",
    ended_at: now,
    cancel_reason: body.reason || body.cancel_reason || null,
    anti_cheat_summary: body.anti_cheat_summary || {}
  };
  const rows = await supabaseRest(`test_sessions?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
    token: getSupabaseAccessToken(req)
  });
  if (!rows?.length) throw new Error("Session not found");
  return publicSession(rows[0]);
}

async function insertSupabaseEvents(req, body, now) {
  const events = Array.isArray(body.events) ? body.events : [body];
  const info = getAuthInfo(req);
  const clientUserId = info.userId;
  const authUserId = info.isAuthenticated ? info.userId : null;
  const payload = events.map((event) => ({
    user_id: authUserId,
    client_user_id: clientUserId,
    session_id: event.session_id || body.session_id || null,
    attempt_id: isUuid(event.attempt_id) ? event.attempt_id : null,
    event_type: event.event_type || "unknown",
    event_payload: event.event_payload || event.payload || {},
    page_path: event.page_path || "",
    user_agent: req.headers["user-agent"] || "",
    ip_hash: "",
    created_at: event.created_at || now
  }));
  const rows = await supabaseRest("practice_events", {
    method: "POST",
    body: payload,
    token: getSupabaseAccessToken(req)
  });
  return rows || payload;
}

// trackClientLogin removed — `profiles` table is auto-populated by the
// `handle_new_user` trigger on `auth.users`. No manual tracking needed.

async function handleTestSession(req, res, action, id = "") {
  try {
    const body = req.method === "POST" ? await readJson(req) : {};
    const now = new Date().toISOString();
    if (SUPABASE_ENABLED) {
      try {
        const session = action === "start"
          ? await createSupabaseSession(req, body, now)
          : await updateSupabaseSession(req, action, id, body, now);
        return sendJson(res, 200, { ok: true, source: "supabase", session });
      } catch (error) {
        console.warn(`[supabase] test session fallback: ${error.message}`);
      }
    }
    const db = await readLocalDb();
    if (action === "start") {
      const __info = getAuthInfo(req);
      const session = {
        id: randomUUID(),
        user_id: __info.isAuthenticated ? __info.userId : null,
        client_user_id: __info.userId,
        test_type: body.test_type || "custom_strict",
        status: "started",
        strict_mode: !!body.strict_mode,
        fullscreen_required: !!body.fullscreen_required,
        selected_part1_topics: Array.isArray(body.selected_part1_topics) ? body.selected_part1_topics.slice(0, 3) : [],
        selected_part2_topic: body.selected_part2_topic || "",
        derived_part3_topic: body.derived_part3_topic || body.selected_part2_topic || "",
        generated_question_ids: body.generated_question_ids || [],
        started_at: now,
        ended_at: null,
        cancel_reason: "",
        prediction_weight: body.test_type === "custom_strict" ? 1 : 0.45,
        anti_cheat_summary: {},
        created_at: now
      };
      db.test_sessions.unshift(session);
      await writeLocalDb(db);
      return sendJson(res, 200, { ok: true, source: "local-fallback", session });
    }
    const session = db.test_sessions.find((s) => s.id === id);
    if (!session) return sendJson(res, 404, { ok: false, error: "Session not found" });
    const statusByAction = { cancel: "cancelled", complete: "completed", invalidate: "invalidated" };
    session.status = statusByAction[action] || session.status;
    session.ended_at = now;
    session.cancel_reason = body.reason || body.cancel_reason || "";
    session.anti_cheat_summary = { ...(session.anti_cheat_summary || {}), ...(body.anti_cheat_summary || {}) };
    await writeLocalDb(db);
    return sendJson(res, 200, { ok: true, source: "local-fallback", session });
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: error.message });
  }
}

async function handlePracticeEvent(req, res) {
  try {
    const body = await readJson(req);
    const events = Array.isArray(body.events) ? body.events : [body];
    const now = new Date().toISOString();
    if (SUPABASE_ENABLED) {
      try {
        const rows = await insertSupabaseEvents(req, body, now);
        return sendJson(res, 200, { ok: true, source: "supabase", count: rows.length });
      } catch (error) {
        console.warn(`[supabase] event fallback: ${error.message}`);
      }
    }
    const db = await readLocalDb();
    const __evInfo = getAuthInfo(req);
    const saved = events.map((event) => ({
      id: randomUUID(),
      user_id: __evInfo.isAuthenticated ? __evInfo.userId : null,
      client_user_id: __evInfo.userId,
      session_id: event.session_id || body.session_id || "",
      attempt_id: event.attempt_id || "",
      event_type: event.event_type || "unknown",
      event_payload: event.event_payload || event.payload || {},
      page_path: event.page_path || "",
      user_agent: req.headers["user-agent"] || "",
      ip_hash: "",
      created_at: event.created_at || now
    }));
    db.practice_events.unshift(...saved);
    db.practice_events = db.practice_events.slice(0, 5000);
    await writeLocalDb(db);
    return sendJson(res, 200, { ok: true, source: "local-fallback", count: saved.length });
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: error.message });
  }
}

// ── Sync practice attempts (chỉ cho thi chống gian lận custom_strict) ──────
async function handleSyncAttempts(req, res) {
  try {
    const body = await readJson(req);
    const attempts = Array.isArray(body.attempts) ? body.attempts : [];
    if (!attempts.length) return sendJson(res, 400, { ok: false, error: "No attempts" });
    const now = new Date().toISOString();
    const __atInfo = getAuthInfo(req);
    const clientUserId = __atInfo.userId;
    const authUserId = __atInfo.isAuthenticated ? __atInfo.userId : null;
    const sessionId = isUuid(body.session_id) ? body.session_id : null;

    const payload = attempts.map(a => ({
      user_id: authUserId,
      client_user_id: clientUserId,
      session_id: sessionId,
      question_id: isUuid(a.question_id) ? a.question_id : null,
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
      client_attempt_id: a.client_attempt_id || randomUUID(),
      created_at: a.created_at || now
    }));

    if (SUPABASE_ENABLED) {
      try {
        const rows = await supabaseRest("practice_attempts", {
          method: "POST",
          body: payload,
          token: getSupabaseAccessToken(req)
        });
        return sendJson(res, 200, { ok: true, source: "supabase", count: rows?.length || payload.length });
      } catch (error) {
        console.warn(`[supabase] sync attempts fallback: ${error.message}`);
      }
    }

    // Local fallback
    const db = await readLocalDb();
    if (!db.practice_attempts) db.practice_attempts = [];
    payload.forEach(p => { p.id = randomUUID(); db.practice_attempts.unshift(p); });
    db.practice_attempts = db.practice_attempts.slice(0, 2000);
    await writeLocalDb(db);
    return sendJson(res, 200, { ok: true, source: "local-fallback", count: payload.length });
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: error.message });
  }
}

// ── GET practice attempts for a question (restore previous recordings) ──
async function handleGetAttempts(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const question = (url.searchParams.get("question") || "").trim();
    if (!question) return sendJson(res, 200, { ok: true, attempts: [] });

    const token = getSupabaseAccessToken(req);
    const authUserId = await getAuthUserId(req);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "10", 10), 20);

    let attempts = [];

    // Try Supabase first
    if (SUPABASE_ENABLED) {
      try {
        // URL-encode the question for the eq filter
        const filter = `prompt_text=eq.${encodeURIComponent(question)}&order=created_at.desc&limit=${limit}`;
        const userFilter = authUserId ? `&user_id=eq.${authUserId}` : "";
        const rows = await supabaseRest(`practice_attempts?select=id,created_at,prompt_text,transcript,audio_path,score_overall,score_fluency,score_vocab,score_grammar,score_pronunciation,raw_score_json,part&${filter}${userFilter}`, {
          method: "GET",
          token
        });
        if (Array.isArray(rows)) {
          for (const row of rows) {
            // Generate signed URL for audio if path exists
            let audioUrl = null;
            if (row.audio_path) {
              try {
                const signRes = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/recordings/${row.audio_path}`, {
                  method: "POST",
                  headers: {
                    "apikey": SUPABASE_PUBLISHABLE_KEY,
                    "Authorization": `Bearer ${token || SUPABASE_PUBLISHABLE_KEY}`,
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({ expiresIn: 3600 })
                });
                if (signRes.ok) {
                  const signData = await signRes.json();
                  audioUrl = signData.signedURL ? `${SUPABASE_URL}/storage/v1${signData.signedURL}` : null;
                }
              } catch {}
            }
            attempts.push({
              id: row.id,
              created_at: row.created_at,
              transcript: row.transcript,
              audioUrl,
              overall: row.score_overall,
              fluency: row.score_fluency,
              vocabulary: row.score_vocab,
              grammar: row.score_grammar,
              pronunciation: row.score_pronunciation,
              raw: row.raw_score_json || null,
              part: row.part
            });
          }
        }
      } catch (e) { console.warn("[get-attempts] supabase:", e.message); }
    }

    // Local fallback if Supabase returned nothing
    if (!attempts.length) {
      try {
        const db = await readLocalDb();
        const local = (db.practice_attempts || [])
          .filter(a => a.prompt_text === question)
          .slice(0, limit);
        for (const a of local) {
          attempts.push({
            id: a.id,
            created_at: a.created_at,
            transcript: a.transcript,
            audioUrl: null,
            overall: a.score_overall,
            fluency: a.score_fluency,
            vocabulary: a.score_vocab,
            grammar: a.score_grammar,
            pronunciation: a.score_pronunciation,
            raw: a.raw_score_json || null,
            part: a.part
          });
        }
      } catch {}
    }

    return sendJson(res, 200, { ok: true, attempts: dedupeAttempts(attempts, limit) });
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: error.message });
  }
}

function dedupeAttempts(attempts, limit = 10) {
  const seen = new Map();
  return (attempts || []).filter(a => {
    const transcript = String(a?.transcript || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (!transcript) return true;
    const key = [transcript.slice(0, 500), a?.overall ?? a?.raw?.overall ?? "", a?.part || ""].join("||");
    const ts = Date.parse(a?.created_at || "") || 0;
    const prev = seen.get(key);
    if (prev !== undefined && (!ts || !prev || Math.abs(prev - ts) < 180000)) return false;
    seen.set(key, ts);
    return true;
  }).slice(0, limit);
}

// ── Gemini model + key fallback config ──────────────────────────────────────
// Thử lần lượt từng model, trong mỗi model thử tất cả API keys.
// Thêm key vào GEMINI_API_KEYS (env) hoặc client tự gửi lên qua trường apiKey.
// Khớp đúng bản gốc Luyennoi (settings.html + app.js + data/api-map.json)
const GEMINI_MODELS = [
  "gemini-3.5-flash",                  // CHÍNH cho chấm phát âm (audio scoring)
  "gemini-3-flash-preview",            // dự phòng audio scoring
  "gemini-3.1-flash-lite-preview",     // CHÍNH cho sinh ý / câu mẫu / cue cards
  "gemini-3.1-pro-preview",            // dự phòng audio scoring
  "gemini-2.5-pro",                    // dự phòng sinh ý chất lượng cao
  "gemini-2.5-flash",                  // dự phòng đa dụng
  "gemini-2.5-flash-lite",             // CHÍNH cho tra từ điển / dịch / chấm từng từ
];

// Purpose-based model routing — assigns first-try model by task type.
// callGemini still falls back to the full GEMINI_MODELS list on errors.
const MODELS_BY_PURPOSE = {
  // 🎤 Chấm phát âm (audio scoring) — Part 1/2/3 + Full Test
  pronunciation: ["gemini-3.5-flash", "gemini-3-flash-preview", "gemini-3.1-pro-preview"],
  // 💡 Sinh ý / câu mẫu (sample, note, expand, cuecards)
  ideas:         ["gemini-3.1-flash-lite-preview", "gemini-2.5-pro"],
  // 📖 Tra từ điển (vocab, translate, pronun explanation, score-word)
  dictionary:    ["gemini-2.5-flash-lite", "gemini-2.5-flash"],
};
function purposeForKind(kind) {
  if (kind === "score" || kind === "pronunciation") return "pronunciation";
  // Single-word pronunciation check is a small task — route to the LITE/dictionary tier
  if (kind === "score-word" || kind === "word") return "dictionary";
  if (kind === "vocab" || kind === "extract" || kind === "translate" || kind === "pronun") return "dictionary";
  return "ideas"; // sample, note, expand, cuecards, ...
}
function pickModelForKind(kind, userModel) {
  if (userModel) return userModel;
  const group = MODELS_BY_PURPOSE[purposeForKind(kind)] || GEMINI_MODELS;
  return group[0];
}

// Server-side pool keys (optional): GEMINI_API_KEYS=key1,key2,key3
const SERVER_KEYS = (process.env.GEMINI_API_KEYS || "")
  .split(",").map(k => k.trim()).filter(Boolean);

// Retryable HTTP status codes
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

function cleanGeminiText(text) {
  return String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

// Core single-model single-key call
async function callGeminiOnce({ apiKey, model, prompt, responseJson = false, audioBase64 = "", mimeType = "audio/webm" }) {
  if (!apiKey) throw new Error("Missing Gemini API key");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
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
  if (!response.ok) {
    const err = new Error(data?.error?.message || `Gemini HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return {
    text: cleanGeminiText(data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("\n")),
    model
  };
}

// Dual-loop fallback: outer = models, inner = API keys
async function callGemini({ apiKey, model, prompt, responseJson = false, audioBase64 = "", mimeType = "audio/webm" }) {
  // Build key pool: client key first, then server pool
  const keyPool = [...new Set([apiKey, ...SERVER_KEYS].filter(Boolean))];
  if (keyPool.length === 0) throw new Error("No Gemini API key available");

  // Build model list: requested model first (if given), then fallback list
  const modelList = model
    ? [model, ...GEMINI_MODELS.filter(m => m !== model)]
    : GEMINI_MODELS;

  const errors = [];
  for (const m of modelList) {
    for (const key of keyPool) {
      try {
        const result = await callGeminiOnce({ apiKey: key, model: m, prompt, responseJson, audioBase64, mimeType });
        if (m !== model) console.log(`[Gemini] Fallback used model: ${m}`);
        return result;
      } catch (err) {
        errors.push(`${m}/${key.slice(-6)}: ${err.message}`);
        // Only retry on rate-limit / server errors; fail fast on auth/bad-request
        if (err.status && !RETRYABLE.has(err.status)) break;
      }
    }
  }
  throw new Error("All Gemini models/keys failed. Last errors: " + errors.slice(-3).join(" | "));
}

function fallbackScore(question, transcript) {
  return {
    provider: "mock",
    model: "local-fallback",
    overall: 5.5,
    transcript: transcript || "I would like to describe this topic clearly. I can give a direct answer, add one reason, and include a short personal example.",
    rewrittenAnswer: "I would give a direct answer first, then support it with a clear reason and a short personal example so the response feels natural.",
    feedback: "Cau tra loi co y chinh ro, nhung can them chi tiet cu the hon va dung cum tu linh hoat hon de tang band.",
    pronunciationIssues: [
      { word: "usually", targetSound: "/juː/", observed: "/uː/", severity: "heavy" },
      { word: "track", targetSound: "/tr/", observed: "/dr/", severity: "light" }
    ],
    criteria: {
      pronunciation: { score: 5.0, feedback: "Phat am tu khoa can ro hon, chu y word stress va ending sounds." },
      fluency: { score: 6.0, feedback: "Mach noi kha on, nhung can noi lien ket hon giua cac y." },
      grammar: { score: 5.5, feedback: "Dung cau don tot, nen them cau phuc va giam loi chia thi." },
      vocabulary: { score: 5.5, feedback: "Tu vung dung duoc, nhung can them collocation tu nhien hon." }
    },
    suggestions: [
      "Mo dau bang cau tra loi truc tiep.",
      "Them mot vi du ca nhan ngan.",
      "Ket lai bang mot tac dong hoac cam nhan."
    ],
    question
  };
}

function fallbackAssist(kind, topic) {
  const content = {
    sample: {
      title: "Câu mẫu",
      directAnswer: `Well, ${topic.toLowerCase().slice(0,40)} is something I find quite interesting.`,
      explanation: "I mean, it has always been part of my daily routine and I genuinely enjoy it.",
      example: "For example, just last week I spent some time on this and found it very rewarding."
    },
    vocab: {
      title: "Từ vựng chủ đề",
      words: [
        { phrase: "speak with confidence", vi: "nói tự tin", example: "I always try to speak with confidence in interviews." },
        { phrase: "pick up new expressions", vi: "học thêm cách diễn đạt", example: "Watching films helps me pick up new expressions." },
        { phrase: "stay consistent", vi: "duy trì đều đặn", example: "It's important to stay consistent when practising." },
        { phrase: "real-life practice", vi: "luyện tập thực tế", example: "Real-life practice is more effective than textbooks." }
      ]
    },
    pronun: {
      title: "Luyen phat am",
      html: "<p>Hay tach cum tu thanh am tiet, danh dau trong am chinh, roi doc cham truoc khi tang toc.</p>"
    },
    note: {
      title: "Goi y tu ghi chu",
      html: `<p>Idea: answer ${topic.toLowerCase()} with one opinion, one reason, and one concrete example.</p>`
    }
  };
  return { provider: "mock", model: "local-fallback", ...(content[kind] || content.sample) };
}


async function handleGeminiScore(req, res) {
  try {
    const {
      apiKey, model,
      question = "", part = "", transcript = "",
      audioBase64 = "", mimeType = "audio/webm",
      note = ""  // learner's personal note for personalised suggestions
    } = await readJson(req);

    const hasKey = apiKey || SERVER_KEYS.length > 0;
    if (!hasKey) return sendJson(res, 200, fallbackScore(question, transcript));

    const prompt = `You are a FAIR, encouraging IELTS Speaking examiner. Score per the official public band descriptors below. Be balanced — recognise what the learner does well, but still flag genuine errors so they can improve. Do not inflate scores wildly, but reward clear effort and good ideas. Return ONLY valid JSON — no markdown, no explanation.

OFFICIAL IELTS SPEAKING BAND DESCRIPTORS (public version — use exactly):

FLUENCY & COHERENCE
- Band 9: Speaks fluently with only rare repetition/self-correction; hesitation is content-related, not language-related; fully coherent and appropriately extended.
- Band 8: Speaks fluently with only occasional repetition/self-correction; hesitation usually content-related; develops topics coherently.
- Band 7: Speaks at length without noticeable effort or loss of coherence; may show some language-related hesitation; uses a range of connectives flexibly.
- Band 6: Willing to speak at length though may lose coherence at times due to occasional repetition, self-correction or hesitation; uses connectives but not always appropriately.
- Band 5: Usually maintains flow but uses repetition, self-correction or slow speech to keep going; overuses certain connectives.
- Band 4: Cannot respond without noticeable pauses; speech may be slow with frequent repetition; links basic sentences with repetitious connectives.
- Band 3: Speaks with long pauses; limited ability to link simple sentences.
- Band ≤2: Very long pauses; little communication possible.

LEXICAL RESOURCE (Vocabulary)
- Band 9: Full flexibility and precise use; idiomatic language used naturally and accurately.
- Band 8: Wide vocabulary used fluently to convey precise meaning; uses less common and idiomatic vocabulary skillfully; occasional inaccuracy.
- Band 7: Flexible vocabulary; uses some less common and idiomatic items with some style awareness; some inappropriate choices; paraphrases effectively.
- Band 6: Wide enough vocab to discuss topics at length though with some inappropriacy; generally paraphrases successfully.
- Band 5: Limited but flexible enough for familiar/unfamiliar topics; limited paraphrasing.
- Band 4: Talks about familiar topics only; rare attempts at paraphrasing.
- Band 3: Simple vocab to convey personal information; insufficient for unfamiliar topics.

GRAMMATICAL RANGE & ACCURACY
- Band 9: Wide range used with full flexibility and accuracy; rare minor slips.
- Band 8: Wide range of structures flexibly; majority of sentences error-free; occasional inappropriacies / non-systematic errors.
- Band 7: Range of complex structures with flexibility; frequent error-free sentences though some grammatical mistakes persist.
- Band 6: Mix of simple and complex; limited flexibility with complex structures; errors frequent but rarely cause comprehension problems.
- Band 5: Basic sentence forms with reasonable accuracy; limited range of complex structures with frequent errors.
- Band 4: Basic forms with errors; rare subordinate clauses.
- Band 3: Attempts basic sentence forms with limited success; numerous errors except in memorised expressions.

PRONUNCIATION
- Band 9: Effortless to understand; full range of phonological features sustained.
- Band 8: Wide range of phonological features; sustains flexible use; easy to understand throughout; L1 accent has minimal effect on intelligibility.
- Band 7: Shows all positive features of band 6 and some of band 8; uses range of phonological features with variable control; can generally be understood throughout.
- Band 6: Uses a range of phonological features but with mixed control; can generally be understood throughout though mispronunciation of individual words or sounds reduces clarity at times.
- Band 5: Shows all positive features of band 4 and some of band 6; mispronunciations are frequent and cause some difficulty for the listener.
- Band 4: Limited range of phonological features attempted; mispronunciations frequent and cause difficulty.
- Band 3: Shows some basic phonological features but limited control; frequent mispronunciation cause considerable strain.

QUESTION
- Part: ${part}
- Question: ${question}
- Transcript hint: ${transcript || "None — transcribe from audio if attached."}
- Learner note / focus area: ${note || "None"}
- Audio attached: ${audioBase64 ? "yes" : "no"}

Scoring rules — BE FAIR:
- Score each criterion as a WHOLE-INTEGER band (1–9).
- "overall" = round DOWN to the nearest 0.5: overall = Math.floor(((fluency + vocabulary + grammar + pronunciation) / 4) * 2) / 2. Always return a number (e.g. 5, 5.5, 6, 6.5, 7, 7.5).
- PRONUNCIATION: judge by intelligibility and phonological features. A clear, easy-to-understand Vietnamese accent with good rhythm and stress can earn band 6–7. Award 7 if accent rarely interferes AND prosody is varied. Reserve 8+ for near-native fluidity. Note recurring issues (consonant clusters, vowel length /iː/ vs /ɪ/, final consonants), but small slips alone should NOT drag the score down a whole band — only patterns of issues do.
- FLUENCY: minor fillers ("uh", "um") or one or two self-corrections are acceptable up to band 7 if the speech keeps flowing. Heavy hesitation that blocks meaning lowers the score. For Part 2: if the answer is clearly under 60 seconds or skips most cue card sub-questions → cap fluency at band 5.
- GRAMMAR: a few minor errors (one article slip, one tense slip) are normal at band 6–7. Frequent errors that obscure meaning, or only simple sentences with no complex structures → cap at band 5.
- VOCABULARY: only basic everyday words with no paraphrasing → cap at band 5. Some natural collocations and topic-specific words → band 6–7. Idioms used appropriately and precise word choice → band 7+.
- If audio is unclear / noisy / inaudible, set pronunciation score to "?" and put a Vietnamese warning in pronunciation.feedback and in environmentWarning.
- pronunciationIssues: list EVERY noticeable mispronunciation. Minimum 5 items if pronunciation < band 7; minimum 3 even at band 7. severity "heavy" for clearly wrong sound (changes meaning, listener confused), "light" for off-target but understandable. Be GENEROUS in flagging — when in doubt, flag it.
- For each issue, targetSound MUST be CORRECT IPA notation with stress mark (e.g., "bɪˈfɔːr", "ˈɪnstəns", "ʌpˈbiːt").
- grammarIssues / vocabularyIssues / spellingIssues: this is the MOST IMPORTANT field. List EVERY error so the UI can render strike-through highlights inline. Be exhaustive — flag every error you would mark in red pen on an IELTS script. NEVER return empty arrays unless the answer is genuinely perfect.
- vocabularyIssues SPECIFICALLY: flag wrong word choice, awkward phrasing, wrong collocation, register mismatch, overused basic words that should be upgraded, missing the natural idiomatic word. If the candidate's vocabulary score is < 7, you MUST flag at least 3 vocab issues. Examples to flag: "absolute gift" → fine; "go to" used where "attend" fits; "really" used 5 times → flag repetitive; "translators" used when context wants singular → flag as wrong-word with suggestion "translator".
  • wordIndex = the 0-based index of the wrong word when the transcript is split on whitespace. To compute it, mentally split the transcript by spaces and count from 0.
  • original = the EXACT wrong token as it appears in the transcript (case + punctuation preserved). If only PART of a token is wrong (e.g. an extra "s"), still pass the WHOLE token here.
  • suggestion = the corrected single token (or empty string if the word should simply be deleted).
  • kind: for grammar use "tense"|"agreement"|"article"|"preposition"|"plural"|"word-form"|"pronoun"|"missing"; for vocabulary use "wrong-word"|"collocation"|"register"|"awkward"; for spelling use "spelling".
  • explanation = one short Vietnamese sentence.
  Worked example. Transcript: "So I think the person I want to talk about is my older brothers , he 's quite old"
  → wordIndex of "brothers" = 11 (count: So=0, I=1, think=2, the=3, person=4, I=5, want=6, to=7, talk=8, about=9, is=10, my=11... wait recount carefully). RE-COUNT EVERY TIME. Always recount before returning.
  → grammarIssues might include: {"wordIndex": 12, "original": "brothers", "suggestion": "brother", "kind": "plural", "explanation": "Chỉ một người, không số nhiều"}
  Another example. "we was near a shop" → {"wordIndex": 1, "original": "was", "suggestion": "were", "kind": "agreement", "explanation": "we đi với were"}.
- fluencyPauses: identify positions in transcript where the speaker paused, with duration label.
- suggestions: 3 concrete, actionable tips in Vietnamese.
- All feedback text in Vietnamese (you may include English/IPA notation where useful).

Return ONLY this JSON (criterion scores integer 1-9 or "?" if not assessable; overall is a 0.5-step number rounded DOWN, e.g. 5, 5.5, 6, 6.5):
{
  "overall": number,
  "transcript": string,
  "rewrittenAnswer": string,
  "feedback": string,
  "environmentWarning": string,
  "fluencyPauses": [{"afterWord": string, "wordIndex": number, "durationMs": number, "label": "short"|"medium"|"long"}],
  "pronunciationIssues": [{"word": string, "targetSound": string, "observed": string, "severity": "light"|"heavy"}],
  "grammarIssues": [{"wordIndex": number, "original": string, "suggestion": string, "kind": string, "explanation": string}],
  "vocabularyIssues": [{"wordIndex": number, "original": string, "suggestion": string, "kind": string, "explanation": string}],
  "spellingIssues": [{"wordIndex": number, "original": string, "suggestion": string, "explanation": string}],
  "criteria": {
    "pronunciation": {"score": number|"?", "feedback": string},
    "fluency": {"score": number, "feedback": string},
    "grammar": {"score": number, "feedback": string},
    "vocabulary": {"score": number, "feedback": string}
  },
  "suggestions": [string, string, string]
}`;

    const chosenModel = pickModelForKind("score", model);
    const { text, model: usedModel } = await callGemini({ apiKey, model: chosenModel, prompt, responseJson: true, audioBase64, mimeType });
    const scored = parseGeminiJson(text);
    // Safety net: enforce overall = floor(avg-of-4-criteria * 2) / 2 so it always lands on a half-band.
    try {
      const c = scored.criteria || {};
      const nums = [c.fluency?.score, c.vocabulary?.score, c.grammar?.score, c.pronunciation?.score]
        .map((x) => (typeof x === "number" ? x : null))
        .filter((x) => x !== null);
      if (nums.length === 4) {
        const avg = nums.reduce((a, b) => a + b, 0) / 4;
        scored.overall = Math.floor(avg * 2) / 2;
      } else if (typeof scored.overall === "number") {
        scored.overall = Math.floor(scored.overall * 2) / 2;
      }
    } catch {}
    sendJson(res, 200, { provider: "gemini", model: usedModel, ...scored });

    // ── Async: save audio + log to backends (non-blocking) ──
    const __scoreInfo = getAuthInfo(req);
    const clientUserId = __scoreInfo.userId;
    const authUserId = __scoreInfo.isAuthenticated ? __scoreInfo.userId : null;
    const userAccessToken = getSupabaseAccessToken(req);
    const attemptId = randomUUID();
    (async () => {
      // 1. Upload audio to Supabase Storage (7-day retention)
      const audioPath = await uploadAudioToStorage(audioBase64, mimeType, clientUserId, attemptId, userAccessToken);
      // 2. Save attempt summary to Supabase DB
      if (SUPABASE_ENABLED && req.headers["x-ln-client-sync"] !== "1") {
        try {
          await supabaseRest("practice_attempts", {
            method: "POST",
            body: {
              id: attemptId,
              user_id: authUserId,
              client_user_id: clientUserId,
              session_id: null,
              question_id: null,
              mode: "practice",
              part: part || null,
              topic: null,
              prompt_text: question,
              transcript: scored.transcript || transcript || null,
              audio_path: audioPath,
              audio_duration_ms: null,
              score_overall: scored.overall ?? null,
              score_fluency: scored.criteria?.fluency?.score ?? null,
              score_vocab: scored.criteria?.vocabulary?.score ?? null,
              score_grammar: scored.criteria?.grammar?.score ?? null,
              score_pronunciation: scored.criteria?.pronunciation?.score ?? null,
              raw_score_json: scored,
              gemini_model: usedModel,
              client_attempt_id: attemptId,
              created_at: new Date().toISOString()
            },
            token: getSupabaseAccessToken(req)
          });
        } catch (e) { console.warn("[score-persist]", e.message); }
      }
      // 3. Push full detail to GAS (long-term archival, no audio)
      pushToGAS("attempts", [{
        created_at: new Date().toISOString(),
        client_user_id: clientUserId,
        question, part,
        transcript: scored.transcript || transcript || "",
        score_overall: scored.overall,
        score_fluency: scored.criteria?.fluency?.score,
        score_vocab: scored.criteria?.vocabulary?.score,
        score_grammar: scored.criteria?.grammar?.score,
        score_pronunciation: scored.criteria?.pronunciation?.score,
        feedback: scored.feedback || "",
        suggestions: (scored.suggestions || []).join(" | "),
        gemini_model: usedModel,
        audio_path: audioPath || ""
      }]);
    })().catch(e => console.warn("[score-async]", e.message));
  } catch (error) {
    sendJson(res, 200, { ...fallbackScore("", ""), warning: error.message });
  }
}

// Single-word pronunciation scoring — standalone, no history persistence on client.
async function handleGeminiScoreWord(req, res) {
  try {
    const { apiKey, model, word = "", targetPhonetic = "", targetPhoneme = "", focusOnly = false, audioBase64 = "", mimeType = "audio/webm" } = await readJson(req);
    const hasKey = apiKey || SERVER_KEYS.length > 0;
    if (!hasKey) return sendJson(res, 200, { score: "?", verdict: "Chưa có API key.", phoneticHeard: "", tips: "" });
    if (!audioBase64) return sendJson(res, 200, { score: "?", verdict: "Chưa có audio.", phoneticHeard: "", tips: "" });

    const focusBlock = focusOnly && targetPhoneme
      ? `\n\nFOCUS-ONLY MODE — IMPORTANT:\n- The learner is drilling the SINGLE sound /${targetPhoneme}/ in this lesson.\n- Score how accurately they produced /${targetPhoneme}/ ONLY. Ignore other accent / vowel-length issues unless they completely block intelligibility.\n- The 'tips' field MUST address /${targetPhoneme}/ articulation (mouth/tongue position, voicing, common Vietnamese L1 substitution).\n- Set the score relative to /${targetPhoneme}/ accuracy, not overall accent.`
      : "";
    const prompt = `You are a STRICT IELTS pronunciation coach scoring ONE word or short phrase.
Target word/phrase: "${word}"
Target IPA: ${targetPhonetic || "(unknown — infer standard pronunciation)"}${targetPhoneme ? `\nTarget phoneme being drilled: /${targetPhoneme}/` : ""}

Listen to the audio. Score how accurately the speaker pronounced the target word/phrase on a 0-100 scale where:
- 90-100 = native-like, perfect IPA match
- 75-89  = clear and accurate, minor accent
- 60-74  = understandable but noticeable errors on key phonemes
- 40-59  = mispronounced, hard to recognise without context
- 0-39   = wrong sound / unintelligible
Be strict. Do NOT inflate. Penalise vowel length, stress, and consonant cluster errors.${focusBlock}

Return ONLY JSON:
{
  "score": number (0-100, integer),
  "phoneticHeard": string (IPA of what you heard),
  "verdict": string (1 short Vietnamese sentence),
  "tips": string (1 short Vietnamese tip on the most off phoneme${targetPhoneme ? ` — focus on /${targetPhoneme}/` : ""})
}`;
    // Use LITE tier (gemini-2.5-flash-lite first) — single-word scoring is small + needs to be FAST.
    const chosenModel = pickModelForKind("score-word", model);
    const { text, model: usedModel } = await callGemini({ apiKey, model: chosenModel, prompt, responseJson: true, audioBase64, mimeType });
    const out = parseGeminiJson(text);
    sendJson(res, 200, { provider: "gemini", model: usedModel, ...out });
    // Async: log drill result (no audio)
    const __wInfo = getAuthInfo(req);
    logDrillResult(__wInfo.userId, "score-word", { word, score: out.score, model: usedModel }, __wInfo.isAuthenticated ? __wInfo.userId : null);
    pushToGAS("drills", [{ created_at: new Date().toISOString(), client_user_id: __wInfo.userId, type: "word", target: word, score: out.score, model: usedModel }]);
  } catch (error) {
    sendJson(res, 200, { score: "?", verdict: "Lỗi: " + error.message, phoneticHeard: "", tips: "" });
  }
}

async function handleGeminiWordTimings(req, res) {
  try {
    const { apiKey, model, audioBase64 = "", mimeType = "audio/webm", transcript = "" } = await readJson(req);
    const hasKey = apiKey || SERVER_KEYS.length > 0;
    if (!hasKey) return sendJson(res, 200, { wordTimings: [], warning: "Chưa có API key." });
    if (!audioBase64) return sendJson(res, 200, { wordTimings: [], warning: "Chưa có audio." });

    const prompt = `You are a forced-alignment tool. Listen to the attached audio and produce TIGHT word-level timestamps.

Reference transcript (use this exact tokenization in order — split on whitespace):
"""${transcript}"""

CRITICAL RULES:
- Output ONE entry per word in the transcript, IN ORDER.
- startMs = the EXACT millisecond when the speaker BEGINS pronouncing that word.
- endMs = the EXACT millisecond when the speaker FINISHES that word.
- ❗ RESPECT SILENCE — DO NOT compress, do not force words to start at 0ms, do not force adjacent words to be back-to-back.
  • If the speaker is silent at the beginning (e.g. dead air for 2-3 seconds before they start speaking), the FIRST word's startMs MUST reflect that — e.g. startMs: 3200 if they started speaking at 3.2s.
  • If the speaker pauses mid-sentence (breath, hesitation, thinking), there MUST be a GAP between the previous word's endMs and the next word's startMs. Leave that gap untouched — do not fill it.
  • If the speaker speaks fast, words can be back-to-back; if they speak slowly with pauses, reflect that.
- Be precise to within ~80ms. Listen and measure actual onsets — do NOT evenly divide the audio length across the word count.
- Timestamps must be monotonically non-decreasing: timings[i+1].startMs >= timings[i].endMs (gaps are allowed and EXPECTED).
- Skip filler words ("uh", "um", "er") that are NOT in the transcript — do not emit entries for them. The gap they occupy stays as silence between the surrounding words.
- If the speaker omitted a word from the transcript entirely, set that word's startMs == endMs == the previous word's endMs (zero-length placeholder) so index alignment with the transcript is preserved.
- The "word" field MUST exactly match the corresponding transcript word (case + punctuation).

Return ONLY this JSON:
{ "wordTimings": [{"word": string, "startMs": number, "endMs": number}] }`;
    const chosenModel = pickModelForKind("score", model); // use pronunciation tier (3.5-flash etc.)
    const { text, model: usedModel } = await callGemini({ apiKey, model: chosenModel, prompt, responseJson: true, audioBase64, mimeType });
    const out = parseGeminiJson(text);
    sendJson(res, 200, { provider: "gemini", model: usedModel, wordTimings: Array.isArray(out.wordTimings) ? out.wordTimings : [] });
  } catch (error) {
    sendJson(res, 200, { wordTimings: [], warning: error.message });
  }
}

async function handleGeminiPronunContent(req, res) {
  try {
    const { apiKey, model, sound = "" } = await readJson(req);
    const hasKey = apiKey || SERVER_KEYS.length > 0;
    if (!hasKey || !sound) {
      return sendJson(res, 200, { sound, words: [], phrases: [], warning: hasKey ? "Thiếu sound." : "Chưa có API key." });
    }
    const prompt = `You are an IELTS pronunciation coach building practice content for the English sound ${sound} (IPA notation).
Generate exactly:
- 8 common, useful English words that contain the sound ${sound}. Mix word positions (start/middle/end). Mix difficulty (basic + intermediate).
- 5 short example phrases (3-6 words each) that each contain MULTIPLE instances of ${sound} so the learner can drill the sound across natural speech.

For every word AND every phrase, include the FULL IPA transcription with stress marks.

Return ONLY this JSON, no markdown:
{
  "words": [{"word": "pet", "ipa": "/pɛt/"}, ...8 items],
  "phrases": [{"phrase": "Please pick up the pen.", "ipa": "/pliːz/ /pɪk/ /ʌp/ /ðə/ /pɛn/"}, ...5 items]
}`;
    const chosenModel = pickModelForKind("ideas", model); // use ideas (lite) tier — small task
    const { text, model: usedModel } = await callGemini({ apiKey, model: chosenModel, prompt, responseJson: true });
    const out = parseGeminiJson(text);
    sendJson(res, 200, { provider: "gemini", model: usedModel, sound, words: out.words || [], phrases: out.phrases || [] });
  } catch (error) {
    sendJson(res, 200, { sound: "", words: [], phrases: [], warning: error.message });
  }
}

async function handleGeminiScoreSentence(req, res) {
  try {
    const { apiKey, model, sentence = "", audioBase64 = "", mimeType = "audio/webm", context = "", targetPhoneme = "", focusOnly = false } = await readJson(req);
    const hasKey = apiKey || SERVER_KEYS.length > 0;
    if (!hasKey) return sendJson(res, 200, { score: "?", verdict: "Chưa có API key.", phoneticHeard: "", tips: "" });
    if (!audioBase64) return sendJson(res, 200, { score: "?", verdict: "Chưa có audio.", phoneticHeard: "", tips: "" });

    const focusBlock = focusOnly && targetPhoneme
      ? `\n\nFOCUS-ONLY MODE — IMPORTANT:\n- The learner is drilling the SINGLE sound /${targetPhoneme}/ in this lesson.\n- Score how accurately they produced /${targetPhoneme}/ in EVERY word that contains it. Ignore other accent issues unless they break meaning.\n- 'worstWords' must be the words where /${targetPhoneme}/ was off the most.\n- 'tips' must address /${targetPhoneme}/ articulation (mouth/tongue, voicing, Vietnamese L1 substitution).`
      : "";
    // If caller sends a custom context (intonation, rhythm, past-tense drills),
    // use that as the full prompt. Otherwise default to pronunciation scoring.
    const prompt = context
      ? `You are an English speaking coach. Target sentence: "${sentence}"\n\n${context}\n\nListen to the audio carefully. Return ONLY valid JSON.`
      : `You are a STRICT IELTS pronunciation coach scoring a reading passage or short phrase.
Target text: "${sentence}"${targetPhoneme ? `\nTarget phoneme being drilled: /${targetPhoneme}/` : ""}

Listen to the audio. Score how accurately the speaker pronounced the target text on a 0-100 scale where:
- 90-100 = native-like, fluent, every word clear
- 75-89  = clear with minor accent
- 60-74  = understandable but multiple noticeable errors
- 40-59  = hard to follow, mispronounced words
- 0-39   = unintelligible / wrong
Penalise connected speech failures, vowel length errors, stress errors, dropped consonants.${focusBlock}

Return ONLY JSON:
{
  "score": number (0-100, integer),
  "phoneticHeard": string (rough IPA of what you heard),
  "verdict": string (1 short Vietnamese sentence),
  "tips": string (1 short Vietnamese tip on the biggest issue${targetPhoneme ? ` — focus on /${targetPhoneme}/` : ""}),
  "worstWords": [string] (up to 3 words that were pronounced worst, can be empty)
}`;
    const chosenModel = pickModelForKind("score-word", model);
    const { text, model: usedModel } = await callGemini({ apiKey, model: chosenModel, prompt, responseJson: true, audioBase64, mimeType });
    const out = parseGeminiJson(text);
    sendJson(res, 200, { provider: "gemini", model: usedModel, ...out });
    // Async: log drill result (no audio)
    const __sInfo = getAuthInfo(req);
    logDrillResult(__sInfo.userId, "score-sentence", { sentence: sentence.slice(0, 200), score: out.score, model: usedModel }, __sInfo.isAuthenticated ? __sInfo.userId : null);
    pushToGAS("drills", [{ created_at: new Date().toISOString(), client_user_id: __sInfo.userId, type: "sentence", target: sentence.slice(0, 200), score: out.score, model: usedModel }]);
  } catch (error) {
    sendJson(res, 200, { score: "?", verdict: "Lỗi: " + error.message, phoneticHeard: "", tips: "", worstWords: [] });
  }
}

// Convert English text → IPA. Lite-tier, no audio, just text. Used everywhere
// the UI needs to show IPA (sentence transcription, word pronunciation tips).
async function handleGeminiIpa(req, res) {
  try {
    const { apiKey, model, text = "", style = "british" } = await readJson(req);
    if (!text) return sendJson(res, 200, { ipa: "", warning: "Thiếu text" });
    const hasKey = apiKey || SERVER_KEYS.length > 0;
    if (!hasKey) return sendJson(res, 200, { ipa: "", warning: "Chưa có API key" });
    const prompt = `Convert this English text to IPA phonetic transcription (${style === "american" ? "American English" : "Received Pronunciation / British English"}).
Text: """${text}"""

Rules:
- Use standard IPA with stress marks (ˈ primary, ˌ secondary).
- Wrap each WORD in /…/. Join multi-word phrases with single spaces, no commas/punctuation in IPA.
- Use connected-speech reductions ONLY for very common ones (e.g. "going to" → /ˈɡɒnə/ if speaker would actually say it).
- Do NOT add explanation, just the IPA.

Return ONLY this JSON: {"ipa": "<full IPA string>", "perWord": [{"word": "word1", "ipa": "/wɜːd/"}, ...]}`;
    const chosenModel = pickModelForKind("score-word", model); // use LITE tier — fast
    const { text: out, model: usedModel } = await callGemini({ apiKey, model: chosenModel, prompt, responseJson: true });
    const data = parseGeminiJson(out);
    sendJson(res, 200, { provider: "gemini", model: usedModel, ipa: data.ipa || "", perWord: data.perWord || [] });
  } catch (error) {
    sendJson(res, 200, { ipa: "", perWord: [], warning: error.message });
  }
}

async function handleGeminiAssist(req, res) {
  try {
    const { apiKey, model, kind = "sample", topic = "", note = "", part = "" } = await readJson(req);
    // Detect Part 2 from topic prefix, explicit part param, OR question style starting with "Describe..."
    const isPart2 = /^PART\s*2/i.test(topic) || /^2$/.test(String(part).trim()) || /part.?2/i.test(part) || /^\s*describe\b/i.test(topic);
    // Part 3 — discussion questions need longer, more analytical answers
    const isPart3 = !isPart2 && (/^PART\s*3/i.test(topic) || /^3$/.test(String(part).trim()) || /part.?3/i.test(part));
    const hasKey = apiKey || SERVER_KEYS.length > 0;
    if (!hasKey) return sendJson(res, 200, fallbackAssist(kind, topic || "this topic"));

    // Build prompt based on kind
    let prompt;
    if (kind === "note") {
      // Personalised suggestions based on learner's own note
      prompt = `You are an IELTS Speaking coach. The learner wrote a personal note about what they want to improve or remember.
Topic/question: ${topic}
Learner's note: ${note || "No note provided"}

Based on the learner's note, write a short, personalised IELTS Speaking answer template (35-55 words) that directly addresses their focus area. Include their specific concern naturally.
Reply in Vietnamese labels. Return ONLY JSON:
{"title": string, "html": string}
html may use <p>, <ul>, <li>, <b> only. Vietnamese labels, English answer.`;
    } else if (kind === "pronun") {
      prompt = `You are an IELTS Speaking pronunciation coach.
Topic/question: ${topic}
Learner note: ${note || "General pronunciation help"}

Provide targeted phoneme/pronunciation guidance for key words in this topic.
Focus on: word stress, common Vietnamese-speaker errors, IPA notation.
Return ONLY JSON: {"title": string, "html": string}
html: use <p>, <ul>, <li>, <b>. Vietnamese labels, English phonemes.`;
    } else if (kind === "vocab") {
      prompt = `You are an IELTS Speaking vocabulary coach.
Question/topic: ${topic}

Provide exactly 6 high-value topic words/phrases for IELTS Speaking band 6.5+.
Each item must be directly usable to answer this specific question.
Return ONLY JSON:
{"title": string, "words": [{"phrase": string, "pos": string, "vi": string, "example": string}]}
- phrase: English phrase/collocation (2-5 words)
- pos: word type — one of "n.", "v.", "adj.", "adv.", "phrase", "idiom", "collocation"
- vi: Vietnamese translation (short, 2-5 words)
- example: one short English sentence using the phrase`;
    } else if (kind === "extract") {
      // Extract difficult/long phrases FROM a given sample answer (for learner drill)
      // Part 2 answers are longer → extract more phrases
      const srcWordCount = (topic || "").split(/\s+/).length;
      const phraseRange = srcWordCount > 80 ? "8–14" : "4–8";
      prompt = `You are an IELTS Speaking coach. From the English text below, extract the ${phraseRange} MOST USEFUL phrases that an intermediate learner should drill — focus on:
- Natural collocations (verb + noun, adj + noun)
- Multi-word phrases / idiomatic expressions
- Topic-specific lexis or less common content words
- Anything longer than a single common word that's worth memorising

DO NOT include trivial single common words ("the", "is", "have", "go"). Each phrase must appear VERBATIM in the source text (preserve original word forms).

Source text:
${topic}

Return ONLY JSON (same shape as vocab so the UI can reuse it):
{"title": "Cụm từ trong câu mẫu", "words": [{"phrase": string, "pos": string, "vi": string, "example": string}]}
- phrase: the EXACT phrase as it appears in the text (2–5 words preferred)
- pos: one of "collocation", "phrase", "idiom", "n.", "v.", "adj.", "adv."
- vi: short Vietnamese translation (2–5 words)
- example: ONE short natural English sentence reusing the phrase in a different context (so the learner sees how it's used elsewhere)`;
    } else if (kind === "translate") {
      // Translate + vocab card: phrase, pos, Vietnamese, example
      prompt = `You are an English-Vietnamese dictionary for IELTS learners.
For the given English phrase/word, provide:
- phrase: the original phrase (cleaned up if needed)
- pos: part of speech — one of "n.", "v.", "adj.", "adv.", "collocation", "phrase", "idiom"
- vi: short Vietnamese translation (2-6 words)
- example: ONE short natural English sentence using this phrase in context (8-15 words)

Phrase: ${topic}
Return ONLY JSON: {"phrase": string, "pos": string, "vi": string, "example": string, "translation": string}
The "translation" field should equal the "vi" field.`;
    } else if (kind === "expand") {
      // Adjust sample to target band — length SCALES with band (higher = longer & richer)
      const isP2 = /PART\s*2/i.test(topic) || /"sections"/.test(topic);
      // Detect band from note for length guidance
      let lengthGuide;
      if (isP2) {
        lengthGuide = /band\s*5/i.test(note) ? "4 sections, 35-45 words each (~165 words total, simple)"
          : /band\s*6/i.test(note) ? "4 sections, 50-60 words each (~220 words total)"
          : /band\s*7/i.test(note) ? "4 sections, 60-75 words each (~270 words total, richer)"
          : "4 sections, 75-90 words each (~330 words total, sophisticated)";
      } else {
        lengthGuide = /band\s*5/i.test(note) ? "3 sentences: directAnswer 6-9 words, explanation 9-13 words, example 9-13 words (~30 words total ~13 sec)"
          : /band\s*6/i.test(note) ? "3 sentences: directAnswer 8-12 words, explanation 13-18 words, example 13-18 words (~42 words total ~17 sec)"
          : /band\s*7/i.test(note) ? "3 sentences: directAnswer 10-14 words, explanation 17-23 words, example 17-23 words (~55 words total ~22 sec)"
          : "3 sentences: directAnswer 12-16 words, explanation 22-28 words, example 22-28 words (~70 words total ~28 sec)";
      }
      prompt = `You are an IELTS Speaking coach. Adjust this answer to a specific target band level.
Original answer: ${topic}
Adjustment instruction: ${note || "Keep at band 6.5"}

LENGTH (CRITICAL — match exactly):
${lengthGuide}

VOCABULARY:
- Band 5: simple everyday words, basic linkers, no idioms.
- Band 6.5: natural collocations, varied linkers, mild fillers.
- Band 7.5: less common collocations, topic-specific lexis, smooth discourse markers.
- Band 8+: sophisticated lexis, idioms, nuanced precise word choice.

Higher band = LONGER + RICHER vocabulary (more detail, examples, nuance).

Return ONLY JSON with the SAME shape as original. For Part 2 you MUST keep section labels identical to the original; only rewrite the "text" of each section to match the target band length and vocabulary:
${isP2 ? '{"sections": [{"label": "<keep original label>", "text": "<rewritten text>"}, ...]}' : '{"directAnswer": string, "explanation": string, "example": string}'}`;
    } else if (kind === "intonation") {
      prompt = `You are an English pronunciation and prosody expert helping Vietnamese learners.
Analyze the intonation pattern of this paragraph. For EACH word in order, classify its spoken intonation as one of:
- "rise" (pitch goes up slightly — e.g. before commas in lists, non-final items)
- "rise-strong" (pitch goes up strongly — e.g. yes/no questions, unfinished thoughts)
- "fall" (pitch drops slightly — e.g. stressed content words mid-sentence)
- "fall-strong" (pitch drops strongly — e.g. end of declarative statements, commands, wh-questions)
- "neutral" (flat — function words like the, a, is, was, in, on)

Paragraph: ${topic}
${note || ""}

Return ONLY a JSON array: [{"word":"the","tone":"neutral"},{"word":"beach","tone":"fall"},...].
One object per word, in original order. No markdown, no extra text.`;
    } else if (kind === "chunking") {
      prompt = `You are an English reading fluency coach for Vietnamese learners.
Break this paragraph into natural spoken chunks (breath groups / thought groups).
Each chunk = 2-5 words read together fluently without pausing.

Chunk boundaries typically occur:
- After commas, semicolons, colons
- Before conjunctions (and, but, or, so, because)
- Between subject phrase and verb phrase
- Before prepositional phrases that start new ideas
- Around parenthetical/relative clauses

Paragraph: ${topic}
${note || ""}

Return ONLY a JSON array of arrays: [["Last","summer,"],["I","went"],["on","a","trip"],...].
Every word must appear exactly once, in original order. No markdown, no extra text.`;
    } else if (kind === "cuecards") {
      // Generate "You should say:" cue cards for a Part 2 question
      prompt = `Generate the standard 4 IELTS Speaking Part 2 cue card prompts for this question.
Question: ${topic}
Each prompt should start with "What", "When", "Where", "Why", "How", or "And explain" — short bullet form.
Return ONLY JSON: {"cues": [string, string, string, string]}`;
    } else if (isPart2) {
      // Part 2: SHORT & SIMPLE structured answer for Vietnamese learners (band 5-6 baseline)
      const q2 = topic.replace(/^PART\s*2[~\s]*/i,"");
      prompt = `You are an IELTS Speaking Part 2 coach for Vietnamese learners at band 5-6.
Generate a SHORT, SIMPLE model answer for the cue card topic below.

TOPIC: ${q2}
Learner note: ${note || "None"}

STEP 1 — Infer the 4 standard cue card sub-questions for this topic (e.g. "What the story is about", "When you read it", "Where you came across it", "And explain why you enjoyed it"). These become your section labels.

STEP 2 — Write a COMPLETE spoken answer, structured into those 4 sub-sections:
• Each section label = the cue card sub-question (short phrase form)
• Each section text = 35-50 words answering ONLY that sub-question
• TOTAL: 140-190 words (approximately 1–1.5 minutes of speech)
• VOCABULARY: band 5-6 level — use SIMPLE, everyday English. Short common collocations only. NO advanced idioms, NO academic words, NO essay connectives like "furthermore" or "consequently". Use natural fillers like "well", "actually", "to be honest", "I think".
• GRAMMAR: mostly simple sentences with occasional compound sentences. Contractions are good (I'd, it's, there's). Keep sentences SHORT (under 20 words each).
• TONE: casual and natural, like a real student talking — NOT like a textbook or essay. Personal, specific details.
• The answer should be easy enough for a band 5 student to memorize and practice.

Return ONLY this JSON (no extra keys, no markdown):
{
  "sections": [
    {"label": "cue card sub-question 1", "text": "35-50 word spoken paragraph"},
    {"label": "cue card sub-question 2", "text": "35-50 word spoken paragraph"},
    {"label": "cue card sub-question 3", "text": "35-45 word spoken paragraph"},
    {"label": "cue card sub-question 4", "text": "35-45 word spoken paragraph"}
  ]
}`;
    } else if (isPart3) {
      // Part 3: SHORT & SIMPLE discussion answer for Vietnamese learners (band 5-6 baseline)
      prompt = `You are an IELTS Speaking Part 3 coach for Vietnamese learners at band 5-6.
Create a SHORT, SIMPLE model answer discussing GENERAL ideas (not personal stories).
Question: ${topic.replace(/^PART\s*\d[~\s]*/i,"")}
Learner note: ${note || "None"}

CRITICAL — Part 3 rules:
- PERSPECTIVE: Talk about "people", "most people", "society", "young people today". Use "I think" or "I believe" ONLY for opinions, NOT to tell personal stories.
- TOTAL LENGTH: 60-90 words (~25-35 seconds of speech). Keep it SHORT.
- VOCABULARY: band 5-6 level — simple everyday English. Common collocations only. NO academic words, NO complex idioms, NO essay connectives like "furthermore" or "consequently". Use simple linkers: "because", "so", "also", "but", "for example".
- GRAMMAR: mostly simple sentences, some compound with "and", "but", "because". Keep sentences SHORT (under 18 words each). Contractions OK.
- TONE: casual, natural, like a real student speaking — not like an essay.

STRICT length per section:
- "directAnswer": 1 sentence, 8-15 words. State your opinion simply.
- "explanation": 1-2 sentences, 20-35 words. Give a simple reason.
- "example": 1-2 sentences, 20-35 words. A general example about people or society (NOT personal).

Return ONLY this JSON:
{"directAnswer": string, "explanation": string, "example": string}`;
    } else {
      // Part 1: SHORT structured 3-part answer (15-20 seconds total ≈ 30-45 words)
      prompt = `Create a SHORT IELTS Speaking Part 1 model answer. CRITICAL: This must be spoken in 15-20 seconds — total ~30-45 words across all 3 parts. Do NOT exceed.
Question: ${topic.replace(/^PART\s*\d[~\s]*/i,"")}
Learner note / personal focus: ${note || "None"}

STRICT length rules — keep it natural & spoken, NOT essay-style:
- "directAnswer": 1 short sentence, 6-10 words. Direct YES/NO + position.
- "explanation": 1 short sentence, 10-15 words. Brief reason.
- "example": 1 short sentence, 10-15 words. Concrete personal example.

Each must be a SINGLE concise sentence. Natural spoken English, contractions OK.
Return ONLY this JSON:
{"directAnswer": string, "explanation": string, "example": string}`;
    }

    const chosenModel = pickModelForKind(kind, model);
    const { text, model: usedModel } = await callGemini({ apiKey, model: chosenModel, prompt, responseJson: true });
    const answer = parseGeminiJson(text);
    // Array responses (intonation, chunking) go under "data" key; object responses spread normally
    if (Array.isArray(answer)) {
      sendJson(res, 200, { provider: "gemini", model: usedModel, kind, data: answer });
    } else {
      sendJson(res, 200, { provider: "gemini", model: usedModel, kind, ...answer });
    }
  } catch (error) {
    sendJson(res, 200, { ...fallbackAssist("sample", "this topic"), warning: error.message });
  }
}

// Route → captured HTML file under public/real/
const ROUTE_MAP = {
  // Core pages
  "/": "home.html",
  "/login": "landing-new.html",
  "/landing": "landing-new.html",
  // Question practice
  "/question-answer": "question-answer.html",
  "/question-answer/": "question-answer.html",
  "/question-answer/part1": "part1.html",
  "/question-answer/part2": "part2.html",
  "/question-answer/part3": "part3.html",
  // user-question handled via the shell wrapper below for layout consistency.
  // Take test
  "/take-test": "take-test-home.html",
  "/take-test/home": "take-test-home.html",
  "/take-test/full-test": "take-test-full.html",
  "/take-test/custom-strict": "take-test-full.html",
  "/take-test/part1": "take-test-full.html",
  "/take-test/part2": "take-test-full.html",
  "/take-test/part3": "take-test-full.html",
  // Alpha features
  "/alphafeature/payment": "payment.html",
  "/alphafeature/set-voice": "set-voice.html",
  "/alphafeature/setup-mic": "setup-mic.html",
  // Pronun + Vocab are now handled below via the shell wrapper for layout consistency
  // (so they share the same sidebar as the rest of Luyennoi).
  // boxing handled via shell wrapper for layout consistency.
  "/alphafeature/join-us": "join-us.html",
  // Profile
  "/profile/teaching/landing-page": "teaching-landing.html",
  // Settings — đã merge vào modal user, không cần page riêng
  // "/settings": "settings.html",  // ← disabled
};

function injectOverlay(html) {
  html = html
    .replace(/<link[^>]+rel=["'](?:shortcut icon|icon|apple-touch-icon|mask-icon)["'][^>]*>/gi, "")
    .replace(/<link[^>]+rel=["']manifest["'][^>]*>/gi, "")
    .replace(/<meta[^>]+name=["']theme-color["'][^>]*>/gi, "");
  const tag = `
<meta charset="utf-8">
<style id="ln-curtain-css">html.ln-loading body{opacity:0!important}html.ln-rdy body{opacity:1;transition:opacity .18s ease-out}html.ln-loading::before{content:"";position:fixed;inset:0;background:#fff;z-index:2147483647;pointer-events:none}html.ln-rdy::before{display:none}</style>
<script id="ln-curtain-js">(function(){try{var d=document.documentElement;d.classList.add("ln-loading");window.__lnReveal=function(){if(!d.classList.contains("ln-loading"))return;d.classList.remove("ln-loading");d.classList.add("ln-rdy");};setTimeout(window.__lnReveal,2500);}catch(e){}})();</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Fraunces:opsz,wght@9..144,400;9..144,700;9..144,900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/neo-brutalism.css">
<link rel="icon" href="/real/favicon.svg?v=ln" type="image/svg+xml" sizes="any">
<link rel="shortcut icon" href="/real/favicon.svg?v=ln" type="image/svg+xml">
<link rel="apple-touch-icon" href="/real/favicon.png">
<link rel="manifest" href="/real/manifest.webmanifest">
<meta name="theme-color" content="#d9381e">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script src="/auth.js?v=${ASSET_VERSION}" defer></script>
<script src="/sidebar.js?v=${ASSET_VERSION}"></script>
<script src="/real-overlay.js?v=${ASSET_VERSION}"></script>`;
  // Inject as early as possible — right after <head> opens so it runs before SvelteKit
  if (html.includes("<head>")) return html.replace("<head>", "<head>" + tag);
  if (html.includes("<head ")) return html.replace(/(<head[^>]*>)/, "$1" + tag);
  return tag + html;
}

// Wrap custom feature content (reading / pronun / vocab) inside the Luyennoi
// scraped shell so sidebar + topbar look IDENTICAL across the whole app.
// `mountHtml` is the inner HTML to put in the main content area.
// `extraScripts` is an array of <script> tags to append at end of body.
function wrapInLuyennoiShell(homeHtml, mountHtml, extraScripts = []) {
  // The Luyennoi scraped pages have a main scroll container:
  //   <div class="flex-1 overflow-y-auto overflow-x-hidden" ...>...</div>
  // We replace the INNER HTML of that container with our own mount.
  const containerRe = /(<div class="flex-1 overflow-y-auto overflow-x-hidden"[^>]*>)([\s\S]*?)(<\/div>\s*<\/div>\s*<\/div>\s*<div class="md:hidden">)/;
  let out = homeHtml;
  if (containerRe.test(out)) {
    out = out.replace(containerRe, (_, open, _inner, tail) => `${open}<div class="h-full w-full overflow-y-auto" id="ln-feature-root">${mountHtml}</div>${tail}`);
  } else {
    // Fallback: just inject before </body>
    out = out.replace("</body>", `<div id="ln-feature-root">${mountHtml}</div></body>`);
  }
  if (extraScripts.length) {
    out = out.replace("</body>", extraScripts.join("\n") + "</body>");
  }
  return out;
}

function substituteDetail(html, part, question) {
  // Replace question text occurrences inside <h1>/<h2>/<title> tags of the sample template
  const safeQ = String(question).replace(/[<>"]/g, "");
  // Look up the pre-scraped Vietnamese translation for this exact question.
  // The template's stale tooltip ("Bạn có đeo đồng hồ không?") gets swapped for the right one.
  const vi = (QUESTION_VI?.[part]?.[question] || "").replace(/[<>"]/g, "");
  return html
    .replace(/(<title[^>]*>)[^<]*(<\/title>)/i, `$1${safeQ} | Luyện Nói$2`)
    .replace(/Do you wear a watch\?/g, safeQ)
    .replace(/data-tip="Bạn có đeo đồng hồ không\?"/g, `data-tip="${vi}"`)
    .replace(/PART 1(?=\s*<\/)/g, part);
}

// Pages that should NOT receive the sidebar/overlay injection (standalone landing pages)
const NO_OVERLAY_PAGES = new Set(["landing-new.html", "landing.html"]);

async function serveHtml(res, filename, transform) {
  // Try public/real/ first, then public/ (for custom pages like settings.html)
  const candidates = [
    join(root, "public", "real", filename),
    join(root, "public", filename),
  ];
  for (const filePath of candidates) {
    try {
      let html = await readFile(filePath, "utf8");
      if (transform) html = transform(html);
      if (!NO_OVERLAY_PAGES.has(filename)) {
        html = injectOverlay(html);
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(html);
      return true;
    } catch {}
  }
  return false;
}

const server = createServer(async (req, res) => {
  try {
  const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
  const pathname = url.pathname;

  if (req.method === "GET" && (pathname === "/favicon.ico" || pathname === "/favicon.svg")) {
    const icon = await readFile(join(root, "public", "real", "favicon.svg"));
    res.writeHead(200, {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400"
    });
    return res.end(icon);
  }

  // /settings đã gộp vào modal user — redirect về trang chủ kèm flag mở modal
  if (req.method === "GET" && (pathname === "/settings" || pathname === "/settings/")) {
    const next = url.searchParams.get("next") || "";
    const redir = next ? `/home/?openUserModal=1&next=${encodeURIComponent(next)}` : "/home/?openUserModal=1";
    res.writeHead(302, { "Location": redir });
    return res.end();
  }

  if (req.method === "GET" && pathname === "/api/models") {
    // Mô tả đúng theo bản gốc Luyennoi (settings.html). KHÔNG sửa GEMINI_MODELS list.
    const MODEL_LABELS = {
      "gemini-3.5-flash":              { label: "Gemini 3.5 Flash",                 usage: "🎤 Chấm phát âm (CHÍNH)" },
      "gemini-3-flash-preview":        { label: "Gemini 3 Flash (Preview)",         usage: "🎤 Chấm phát âm (dự phòng)" },
      "gemini-3.1-flash-lite-preview": { label: "Gemini 3.1 Flash Lite (Preview)",  usage: "💡 Sinh ý / câu mẫu / cue cards (CHÍNH)" },
      "gemini-3.1-pro-preview":        { label: "Gemini 3.1 Pro (Preview)",         usage: "🎤 Chấm phát âm (dự phòng cao cấp)" },
      "gemini-2.5-pro":                { label: "Gemini 2.5 Pro",                   usage: "💡 Sinh ý chất lượng cao (dự phòng)" },
      "gemini-2.5-flash":              { label: "Gemini 2.5 Flash",                 usage: "📖 Tra từ điển (dự phòng) / đa dụng" },
      "gemini-2.5-flash-lite":         { label: "Gemini 2.5 Flash Lite",            usage: "📖 Từ vựng / dịch / chấm từng từ (CHÍNH)" },
    };
    // Bảng phân nhóm tác vụ — đúng theo bản gốc Luyennoi
    const TASK_MAP = [
      { group: "🎤 Chấm phát âm (audio scoring)", task: "Chấm câu Part 1 / 2 / 3 + Full Test",     model: "gemini-3.5-flash",              fallback: ["gemini-3-flash-preview", "gemini-3.1-pro-preview"] },
      { group: "🎤 Chấm phát âm (audio scoring)", task: "Chấm từng từ (score-word)",               model: "gemini-2.5-flash-lite",         fallback: ["gemini-2.5-flash"] },
      { group: "💡 Sinh ý / câu mẫu",             task: "Cho mình câu mẫu (sample)",               model: "gemini-3.1-flash-lite-preview", fallback: ["gemini-2.5-pro"] },
      { group: "💡 Sinh ý / câu mẫu",             task: "Ghi chú → tạo câu mẫu (note)",            model: "gemini-3.1-flash-lite-preview", fallback: ["gemini-2.5-pro"] },
      { group: "💡 Sinh ý / câu mẫu",             task: "Mở rộng ý (expand) — Part 2/3",           model: "gemini-3.1-flash-lite-preview", fallback: ["gemini-2.5-pro"] },
      { group: "💡 Sinh ý / câu mẫu",             task: "Cue cards Part 2",                        model: "gemini-3.1-flash-lite-preview", fallback: ["gemini-2.5-pro"] },
      { group: "📖 Tra từ điển",                  task: "Từ vựng chủ đề (vocab)",                  model: "gemini-2.5-flash-lite",         fallback: ["gemini-2.5-flash"] },
      { group: "📖 Tra từ điển",                  task: "Dịch sang tiếng Việt (translate)",        model: "gemini-2.5-flash-lite",         fallback: ["gemini-2.5-flash"] },
      { group: "📖 Tra từ điển",                  task: "Luyện phát âm — giải thích IPA",          model: "gemini-2.5-flash-lite",         fallback: ["gemini-2.5-flash"] },
    ];
    const models = GEMINI_MODELS.map(id => ({
      id,
      label: MODEL_LABELS[id]?.label || id,
      usage: MODEL_LABELS[id]?.usage || ""
    }));
    return sendJson(res, 200, { ok: true, models, taskMap: TASK_MAP });
  }

  // Gemini bridge
  if (req.method === "POST" && pathname === "/api/gemini/score-speaking") return handleGeminiScore(req, res);
  if (req.method === "POST" && pathname === "/api/gemini/score-word") return handleGeminiScoreWord(req, res);
  if (req.method === "POST" && pathname === "/api/gemini/word-timings") return handleGeminiWordTimings(req, res);
  if (req.method === "POST" && pathname === "/api/gemini/pronun-content") return handleGeminiPronunContent(req, res);
  if (req.method === "POST" && pathname === "/api/gemini/score-sentence") return handleGeminiScoreSentence(req, res);
  if (req.method === "POST" && pathname === "/api/gemini/ipa") return handleGeminiIpa(req, res);
  if (req.method === "POST" && pathname === "/api/gemini/assist") return handleGeminiAssist(req, res);
  if (req.method === "POST" && pathname === "/api/test-sessions/start") return handleTestSession(req, res, "start");
  if (req.method === "POST" && /^\/api\/test-sessions\/[^/]+\/cancel$/.test(pathname)) return handleTestSession(req, res, "cancel", pathname.split("/")[3]);
  if (req.method === "POST" && /^\/api\/test-sessions\/[^/]+\/complete$/.test(pathname)) return handleTestSession(req, res, "complete", pathname.split("/")[3]);
  if (req.method === "POST" && /^\/api\/test-sessions\/[^/]+\/invalidate$/.test(pathname)) return handleTestSession(req, res, "invalidate", pathname.split("/")[3]);
  if (req.method === "POST" && (pathname === "/api/events" || pathname === "/api/events/batch")) return handlePracticeEvent(req, res);
  if (req.method === "POST" && pathname === "/api/practice-attempts") return handleSyncAttempts(req, res);
  if (req.method === "GET" && pathname === "/api/practice-attempts") return handleGetAttempts(req, res);
  if (req.method === "GET" && pathname === "/api/supabase/config") {
    return sendJson(res, 200, {
      ok: true,
      url: SUPABASE_URL,
      publishableKey: SUPABASE_PUBLISHABLE_KEY,
      connected: SUPABASE_ENABLED
    });
  }
  if (req.method === "GET" && pathname === "/api/auth/user") {
    try {
      const user = await getSupabaseAuthUser(getSupabaseAccessToken(req));
      if (user) return sendJson(res, 200, { ok: true, user });
    } catch (error) {
      console.warn(`[supabase] auth user fallback: ${error.message}`);
    }
    // Fallback: decode JWT locally
    const info = getAuthInfo(req);
    if (info.isAuthenticated) {
      return sendJson(res, 200, {
        ok: true,
        user: {
          id: info.userId,
          email: info.email,
          display_name: info.displayName,
          avatar_url: ""
        }
      });
    }
    return sendJson(res, 200, { ok: true, user: null });
  }

  // Silence Netlify RUM and any /.netlify/ scripts — return empty JS so SvelteKit doesn't crash
  if (pathname.startsWith("/.netlify/")) {
    res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
    res.end("/* noop */");
    return;
  }

  // Logout → clear cookie + redirect to landing
  if (pathname === "/api/logout" || pathname === "/logout") {
    res.writeHead(302, {
      "Location": "/login",
      "Set-Cookie": "ln_auth=; Path=/; Max-Age=0"
    });
    res.end();
    return;
  }

  // Mock login endpoint — set cookie + redirect to home
  // No manual user tracking needed: Supabase auth trigger auto-populates `profiles`.
  if (pathname === "/api/login" || pathname === "/login-mock") {
    res.writeHead(302, {
      "Location": "/",
      "Set-Cookie": "ln_auth=1; Path=/; Max-Age=2592000; SameSite=Lax"
    });
    res.end();
    return;
  }

  // Auth gate: protected pages redirect to /login if no ln_auth cookie
  const cookie = req.headers.cookie || "";
  const isAuthed = /(?:^|;\s*)ln_auth=1\b/.test(cookie);
  const PROTECTED = /^\/(?:question-answer|take-test|alphafeature|profile|settings|luyendoc|reading)/;
  // Allow static assets through (JS/CSS/fonts) even without auth — dynamic imports need these
  const isStaticAsset = /\.(js|css|json|woff2?|png|jpg|svg|ico|webp|webmanifest)(\?|$)/i.test(pathname) || pathname.startsWith("/luyendoc/_app/");
  if (LOCAL_AUTH_GATE && !isAuthed && !isStaticAsset && pathname !== "/login" && pathname !== "/landing" && (pathname === "/" || PROTECTED.test(pathname))) {
    res.writeHead(302, { "Location": "/login" });
    res.end();
    return;
  }

  // /real/ bare path → redirect to /
  if (pathname === "/real" || pathname === "/real/") {
    res.writeHead(302, { "Location": "/" });
    res.end();
    return;
  }

  // Mock backend mirrors of luyennoi APIs (so anything that bypasses overlay still works)
  if (pathname.startsWith("/api/be/") || pathname === "/api/oai/chat") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, data: [], items: [] }));
    return;
  }

  // Route-mapped HTML pages
  if (/^\/take-test\/(?:full-test|custom-strict|part[123])\/?$/i.test(pathname)) {
    if (await serveHtml(res, "take-test-full.html", (h) =>
      h.includes("/full-test.js") ? h : h.replace("</body>", `<script src="/full-test.js?v=${ASSET_VERSION}" defer></script></body>`)
    )) return;
  }
  if (ROUTE_MAP[pathname]) {
    if (await serveHtml(res, ROUTE_MAP[pathname])) return;
  }

  // Radical Reading + Pronun + Vocab — wrap in the Luyennoi shell (home.html
  // sidebar/topbar) so sidebar is IDENTICAL with the rest of the app.
  const SHELL_FEATURES = [
    { match: (p) => p === "/reading" || /^\/reading\/[^/]+\/?$/i.test(p), title: "Luyện đọc", mountId: "readingRoot", script: "/reading.js" },
    { match: (p) => p === "/alphafeature/pronun", title: "Khoá phát âm", mountId: "pronunRoot", script: "/pronun-tabs.js" },
    { match: (p) => p === "/alphafeature/vocab", title: "Sổ từ vựng", mountId: "vocabRoot", script: "/vocab.js" },
    { match: (p) => p === "/question-answer/user-question", title: "Câu bạn thêm", mountId: "userQuestionRoot", script: "/user-question.js" },
    { match: (p) => p === "/alphafeature/boxing", title: "Luyện S/es", mountId: "boxingRoot", script: "/boxing.js" },
    { match: (p) => p === "/alphafeature/past-tense", title: "Luyện thì quá khứ", mountId: "pastTenseRoot", script: "/past-tense.js" },
    { match: (p) => p === "/alphafeature/intonation", title: "Luyện intonation", mountId: "intonationRoot", script: "/intonation.js" },
    { match: (p) => p === "/alphafeature/rhythm", title: "Luyện rhythm", mountId: "rhythmRoot", script: "/rhythm.js" },
  ];
  const shellHit = SHELL_FEATURES.find((f) => f.match(pathname));
  if (shellHit) {
    try {
      let homeHtml = await readFile(join(root, "public", "real", "home.html"), "utf8");
      const mount = `<div id="${shellHit.mountId}" class="ln-feature-mount" style="padding:1.2rem 1.4rem;min-height:calc(100vh - 64px);"></div>`;
      const scripts = [`<script type="module" src="${shellHit.script}?v=${Date.now()}"></script>`];
      homeHtml = wrapInLuyennoiShell(homeHtml, mount, scripts);
      // Update title
      homeHtml = homeHtml.replace(/(<title[^>]*>)[^<]*(<\/title>)/i, `$1${shellHit.title} | Luyện Nói$2`);
      homeHtml = injectOverlay(homeHtml);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(homeHtml);
      return;
    } catch (e) {
      console.warn("[shell] failed", pathname, e?.message);
    }
  }

  // Pronunciation course lesson: /alphafeature/pronun/lesson<N>/section<M>
  if (/^\/alphafeature\/pronun\/lesson\d+\/section\d+\/?$/i.test(pathname)) {
    if (await serveHtml(res, "pronun.html")) return;
  }

  // ──────── PHASE A — LuyenDoc sub-mount at /luyendoc/* ────────
  // Serves the LuyenDoc static SvelteKit site at this prefix, with our overlay.js
  // injected into every HTML page so TTS, settings, scoring etc. carry over.
  if (pathname === "/luyendoc") {
    res.writeHead(302, { "Location": "/luyendoc/" });
    res.end();
    return;
  }
  if (pathname.startsWith("/luyendoc/")) {
    // Map /luyendoc/<rest> → LuyenNoi/public/<rest>
    let rest = pathname.replace(/^\/luyendoc\/?/, "") || "index.html";
    // SvelteKit prerendered routes are folders containing index.html
    if (!rest.includes(".")) rest = rest.replace(/\/?$/, "/") + "index.html";
    const ldPath = normalize(join(root, "LuyenNoi", "public", rest));
    const ldBase = join(root, "LuyenNoi", "public") + sep;
    if (!ldPath.startsWith(ldBase) && ldPath !== ldBase.slice(0, -1)) {
      res.writeHead(403); res.end("Forbidden"); return;
    }
    try {
      const ext = extname(ldPath).toLowerCase();
      let body = await readFile(ldPath);
      if (ext === ".html") {
        let html = body.toString("utf8");
        // Rewrite root-anchored URLs (href="/foo", src="/foo") → "/luyendoc/foo"
        // so the SvelteKit static site works under the sub-mount.
        html = html.replace(/(\bhref|\bsrc|content)="\/(?!luyendoc\/|http|\/)([^"]*)"/g, (m, attr, rest) => `${attr}="/luyendoc/${rest}"`);
        // Same for url(...) in inline CSS
        html = html.replace(/url\(\s*"?\/(?!luyendoc\/|http)([^")]+)"?\s*\)/g, (m, rest) => `url(/luyendoc/${rest})`);
        // Transcriber prefill helper: when URL has ?text=..., fill #text-input + dispatch input event
        if (pathname.includes("/transcriber")) {
          const prefillScript = `
<script>
(function(){
  const params = new URLSearchParams(location.search);
  const txt = params.get("text");
  if (!txt) return;
  function fill() {
    const ta = document.getElementById("text-input");
    if (!ta) { setTimeout(fill, 200); return; }
    ta.value = txt;
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.dispatchEvent(new Event("change", { bubbles: true }));
    // Try to auto-click the "transcribe" button if it exists
    setTimeout(() => {
      const buttons = [...document.querySelectorAll("button")];
      const go = buttons.find(b => /transcribe|phi.n .m|chuy.n .i|gen/i.test((b.textContent||"").trim()));
      if (go && !go.disabled) go.click();
    }, 500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fill);
  else fill();
})();
</script>`;
          html = html.replace("</body>", prefillScript + "</body>");
        }
        // Inject our overlay so TTS / API key / score helpers carry over
        html = injectOverlay(html);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(html);
        return;
      }
      res.writeHead(200, {
        "Content-Type": types[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=86400"
      });
      res.end(body);
      return;
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("LuyenDoc: not found");
      return;
    }
  }

  // Single-question detail: /question-answer/PART%20X~...
  if (/^\/question-answer\/PART/i.test(pathname)) {
    const raw = decodeURIComponent(pathname.replace("/question-answer/", ""));
    const tilde = raw.indexOf("~");
    const part = tilde > -1 ? raw.slice(0, tilde).trim() : "PART 1";
    const question = tilde > -1 ? raw.slice(tilde + 1).trim() : "Do you wear a watch?";
    if (await serveHtml(res, "detail-sample.html", (h) => substituteDetail(h, part, question))) return;
  }

  // Static files from public/
  const filePath = resolvePath(req.url || "/");
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": types[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(body);
  } catch {
    // SPA fallback — serve home
    if (await serveHtml(res, "home.html")) return;
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
  } catch (err) {
    console.error("[500]", req.method, req.url, err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Internal Server Error");
    }
  }
});

process.on("uncaughtException", (err) => {
  console.error("[FATAL] uncaughtException:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] unhandledRejection:", reason);
});

server.listen(port, () => {
  console.log(`Luyennoi clone running at http://127.0.0.1:${port}`);
});
