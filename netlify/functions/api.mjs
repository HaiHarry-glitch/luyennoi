import { randomUUID } from "node:crypto";
import { buildScorePrompt, applyOverallFloor, parseGeminiJson } from "./_lib/score.mjs";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://gxjgkwebrxzcawqkxmbt.supabase.co").replace(/\/+$/, "");
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_ktG6l3TaDDppl9n6flBuZg_3THO38Dp";
const GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-3.1-pro-preview",
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
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  const cookie = event.headers.cookie || event.headers.Cookie || "";
  const cookieToken = cookie.match(/(?:^|;\s*)ln_sb_access=([^;]+)/)?.[1];
  return bearer || (cookieToken ? decodeURIComponent(cookieToken) : "");
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

export async function callGemini({ apiKey, model, prompt, responseJson = false, audioBase64 = "", mimeType = "audio/webm", fallbackModels, perCallTimeoutMs, totalBudgetMs }) {
  const keyPool = [...new Set([apiKey, ...(process.env.GEMINI_API_KEYS || "").split(",")].map((k) => k.trim()).filter(Boolean))];
  if (!keyPool.length) throw new Error("Missing Gemini API key");
  const base = fallbackModels || GEMINI_MODELS;
  let modelList = model ? [model, ...base.filter((m) => m !== model)] : base;
  // Audio scoring is the slow path. Caller can pass `totalBudgetMs` to extend
  // the time window — Background Functions on Netlify can run up to 15 min,
  // so the Background Function path passes a much larger budget. The default
  // 25 s budget keeps the synchronous /api/gemini/score-speaking endpoint
  // under Netlify's 26 s function ceiling.
  const audioTotalBudgetMs = Number(totalBudgetMs) || 25000;
  const audioStart = Date.now();
  if (audioBase64) modelList = modelList.slice(0, 3);
  // Per-call timeout scales with the total budget so a Background Function
  // with a 10 min budget can wait far longer for any single Gemini call.
  const defaultCallMs = audioBase64
    ? Math.min(audioTotalBudgetMs - 1000, 180000) // never wait longer than 3 min on a single call
    : 15000;
  let lastError = "";
  for (let mi = 0; mi < modelList.length; mi++) {
    const m = modelList[mi];
    for (const key of keyPool) {
      let callTimeoutMs = Number(perCallTimeoutMs) || defaultCallMs;
      if (audioBase64) {
        const remaining = audioTotalBudgetMs - (Date.now() - audioStart);
        if (remaining <= 3000) { lastError = lastError || "Audio time budget exhausted"; break; }
        // Only cap the per-call timeout when remaining time is tight.
        // Otherwise keep the full 22 s window the primary attempt used to have.
        callTimeoutMs = Math.min(callTimeoutMs, remaining - 500);
      }
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), callTimeoutMs);
      const callStart = Date.now();
      let response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
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
      } catch (err) {
        clearTimeout(timer);
        const isAbort = err?.name === "AbortError";
        lastError = isAbort ? `Gemini timed out after ${callTimeoutMs}ms (model ${m})` : (err?.message || "Gemini network error");
        // For audio, a timeout means we've burnt the budget — bail out.
        // A non-timeout network error happened fast, so try the next model.
        if (audioBase64 && isAbort) throw new Error(lastError);
        continue;
      }
      clearTimeout(timer);
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        return {
          model: m,
          text: (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("\n").replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim()
        };
      }
      lastError = data?.error?.message || `Gemini HTTP ${response.status} (model ${m})`;
      // For audio: if the call returned a real HTTP error fast (no timeout),
      // try the next model — that's exactly when the primary model is
      // unavailable / 404 / 401 / rate-limited. We bail out only when the
      // call itself ate more than half the total budget.
      if (audioBase64) {
        const spent = Date.now() - callStart;
        if (spent > audioTotalBudgetMs / 2) throw new Error(lastError);
        continue;
      }
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

function buildAssistPrompt(kind, topic, note, part) {
  const isPart2 = /^PART\s*2/i.test(topic) || /^2$/.test(String(part).trim()) || /part.?2/i.test(part) || /^\s*describe\b/i.test(topic);
  const isPart3 = !isPart2 && (/^PART\s*3/i.test(topic) || /^3$/.test(String(part).trim()) || /part.?3/i.test(part));
  if (kind === "vocab") {
    return `You are an IELTS Speaking vocabulary coach.
Question/topic: ${topic}

Provide exactly 6 high-value topic words/phrases for IELTS Speaking band 6.5+.
Each item must be directly usable to answer this specific question.
Return ONLY JSON:
{"title": string, "words": [{"phrase": string, "pos": string, "vi": string, "example": string}]}
- phrase: English phrase/collocation (2-5 words)
- pos: word type — one of "n.", "v.", "adj.", "adv.", "phrase", "idiom", "collocation"
- vi: Vietnamese translation (short, 2-5 words)
- example: one short English sentence using the phrase`;
  }
  if (kind === "extract") {
    const srcWordCount = (topic || "").split(/\s+/).length;
    const phraseRange = srcWordCount > 80 ? "8–14" : "4–8";
    return `You are an IELTS Speaking coach. From the English text below, extract the ${phraseRange} MOST USEFUL phrases that an intermediate learner should drill — focus on:
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
- example: ONE short natural English sentence reusing the phrase in a different context`;
  }
  if (kind === "translate") {
    return `You are an English-Vietnamese dictionary for IELTS learners.
For the given English phrase/word, provide:
- phrase: the original phrase (cleaned up if needed)
- pos: part of speech — one of "n.", "v.", "adj.", "adv.", "collocation", "phrase", "idiom"
- vi: short Vietnamese translation (2-6 words)
- example: ONE short natural English sentence using this phrase in context (8-15 words)

Phrase: ${topic}
Return ONLY JSON: {"phrase": string, "pos": string, "vi": string, "example": string, "translation": string}
The "translation" field should equal the "vi" field.`;
  }
  if (kind === "note") {
    return `You are an IELTS Speaking coach. The learner wrote a personal note about what they want to improve or remember.
Topic/question: ${topic}
Learner's note: ${note || "No note provided"}

Based on the learner's note, write a short, personalised IELTS Speaking answer template (35-55 words) that directly addresses their focus area. Include their specific concern naturally.
Reply in Vietnamese labels. Return ONLY JSON:
{"title": string, "html": string}
html may use <p>, <ul>, <li>, <b> only. Vietnamese labels, English answer.`;
  }
  if (kind === "pronun") {
    return `You are an IELTS Speaking pronunciation coach.
Topic/question: ${topic}
Learner note: ${note || "General pronunciation help"}

Provide targeted phoneme/pronunciation guidance for key words in this topic.
Return ONLY JSON: {"title": string, "html": string}
html: use <p>, <ul>, <li>, <b>. Vietnamese labels, English phonemes.`;
  }
  if (kind === "expand") {
    const isP2 = /PART\s*2/i.test(topic) || /"sections"/.test(topic);
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
    return `You are an IELTS Speaking coach. Adjust this answer to a specific target band level.
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
  }
  if (kind === "intonation") {
    return `You are an English pronunciation and prosody expert helping Vietnamese learners.
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
  }
  if (kind === "chunking") {
    return `You are an English reading fluency coach for Vietnamese learners.
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
  }
  if (kind === "cuecards") {
    return `Generate the standard 4 IELTS Speaking Part 2 cue card prompts for this question.
Question: ${topic}
Each prompt should start with "What", "When", "Where", "Why", "How", or "And explain" — short bullet form.
Return ONLY JSON: {"cues": [string, string, string, string]}`;
  }
  // Default: sample answer
  if (isPart2) {
    const q2 = topic.replace(/^PART\s*2[~\s]*/i,"");
    return `You are an IELTS Speaking Part 2 coach for Vietnamese learners at band 5-6.
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
  }
  if (isPart3) {
    return `You are an IELTS Speaking Part 3 coach for Vietnamese learners at band 5-6.
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
  }
  return `Create a SHORT IELTS Speaking Part 1 model answer. CRITICAL: This must be spoken in 15-20 seconds — total ~30-45 words across all 3 parts. Do NOT exceed.
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

// Purpose-based model routing — assigns first-try model by task type.
// callGemini still falls back to the full GEMINI_MODELS list on errors.
export const MODELS_BY_PURPOSE = {
  // 🎤 Chấm phát âm (audio scoring) — Part 1/2/3 + Full Test
  pronunciation: ["gemini-3.5-flash", "gemini-3-flash-preview", "gemini-3.1-pro-preview"],
  // 💡 Sinh ý / câu mẫu (sample, note, expand, cuecards)
  ideas:         ["gemini-3.1-flash-lite-preview", "gemini-3-flash-preview", "gemini-2.5-pro"],
  // 📖 Tra từ điển (vocab, translate, pronun explanation, score-word)
  dictionary:    ["gemini-2.5-flash-lite", "gemini-2.5-flash"],
};
function purposeForKind(kind) {
  if (kind === "score" || kind === "pronunciation") return "pronunciation";
  if (kind === "score-word" || kind === "word") return "dictionary";
  if (kind === "vocab" || kind === "extract" || kind === "translate" || kind === "pronun") return "dictionary";
  return "ideas"; // sample, note, expand, cuecards, ...
}
export function pickModelForKind(kind) {
  const group = MODELS_BY_PURPOSE[purposeForKind(kind)] || GEMINI_MODELS;
  return group[0];
}

async function handleAssist(event) {
  const body = parseBody(event);
  const kind = body.kind || "sample";
  const topic = body.topic || body.question || "";
  const note = body.note || "";
  const part = body.part || "";
  const purpose = purposeForKind(kind);
  const modelToUse = pickModelForKind(kind);
  const fallbackModels = MODELS_BY_PURPOSE[purpose] || GEMINI_MODELS;
  try {
    const prompt = buildAssistPrompt(kind, topic, note, part);
    const { text, model } = await callGemini({ apiKey: body.apiKey, model: modelToUse, prompt, responseJson: true, fallbackModels });
    const answer = JSON.parse(text);
    if (Array.isArray(answer)) {
      return json(200, { provider: "gemini", model, kind, data: answer });
    }
    return json(200, { provider: "gemini", model, kind, ...answer });
  } catch (error) {
    return json(200, { ...fallbackAssist(kind, topic), warning: error.message });
  }
}

async function handleScore(event) {
  const body = parseBody(event);
  const question = body.question || "";
  const part = body.part || "";
  const transcript = body.transcript || "";
  const note = body.note || "";
  const audioBase64 = body.audioBase64 || "";
  const mimeType = body.mimeType || "audio/webm";
  try {
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
- vocabularyIssues SPECIFICALLY: flag wrong word choice, awkward phrasing, wrong collocation, register mismatch, overused basic words that should be upgraded, missing the natural idiomatic word. If the candidate's vocabulary score is < 7, you MUST flag at least 3 vocab issues.
  • wordIndex = the 0-based index of the wrong word when the transcript is split on whitespace.
  • original = the EXACT wrong token as it appears in the transcript (case + punctuation preserved).
  • suggestion = the corrected single token (or empty string if the word should simply be deleted).
  • kind: for grammar use "tense"|"agreement"|"article"|"preposition"|"plural"|"word-form"|"pronoun"|"missing"; for vocabulary use "wrong-word"|"collocation"|"register"|"awkward"; for spelling use "spelling".
  • explanation = one short Vietnamese sentence.
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
    const { text, model } = await callGemini({
      apiKey: body.apiKey,
      model: pickModelForKind("score"),
      prompt,
      responseJson: true,
      audioBase64,
      mimeType,
      fallbackModels: MODELS_BY_PURPOSE.pronunciation
    });
    const scored = parseGeminiJson(text);
    // Safety net: enforce overall = floor(avg-of-4-criteria * 2) / 2
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
    return json(200, { provider: "gemini", model, ...applyOverallFloor(scored) });
  } catch (error) {
    return json(200, { ...fallbackScore(body.question || "", body.transcript || ""), warning: error.message });
  }
}

async function handleScoreStart(event) {
  const body = parseBody(event);
  if (!body.clientHasApiKey && !(process.env.GEMINI_API_KEYS || "").trim()) {
    return json(400, { ok: false, error: "Missing Gemini API key" });
  }
  const jobId = randomUUID();
  return json(202, {
    ok: true,
    jobId,
    status: "queued",
    backgroundUrl: "/api/gemini/score-speaking/background"
  });
}

async function handleScoreStatus(event, jobId) {
  const { readScoreJobStatus } = await import("./_lib/score-jobs.mjs");
  const status = await readScoreJobStatus(jobId);
  if (!status) return json(404, { ok: false, error: "Score job not found" });
  return json(200, { ok: true, ...status });
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
    return json(200, { ok: true, attempts: dedupeAttempts(attempts, limit) });
  } catch (e) {
    return json(200, { ok: true, attempts: [], warning: e.message });
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

// ── Missing Gemini endpoints (pronunciation features) ──

async function handleScoreWord(event) {
  const body = parseBody(event);
  const { apiKey, word = "", targetPhonetic = "", targetPhoneme = "", focusOnly = false, audioBase64 = "", mimeType = "audio/webm" } = body;
  if (!audioBase64) return json(200, { score: "?", verdict: "Chưa có audio.", phoneticHeard: "", tips: "" });
  // When the caller is a pronun-course lesson, focus the grader on ONE target
  // phoneme (e.g. /p/) so other accent issues don't drown out the signal.
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
  try {
    const { text, model } = await callGemini({ apiKey, model: pickModelForKind("score-word"), prompt, responseJson: true, audioBase64, mimeType, fallbackModels: MODELS_BY_PURPOSE.dictionary });
    return json(200, { provider: "gemini", model, ...JSON.parse(text) });
  } catch (error) {
    return json(200, { score: "?", verdict: "Lỗi: " + error.message, phoneticHeard: "", tips: "" });
  }
}

async function handleWordTimings(event) {
  const body = parseBody(event);
  const { apiKey, audioBase64 = "", mimeType = "audio/webm", transcript = "" } = body;
  if (!audioBase64) return json(200, { wordTimings: [], warning: "Chưa có audio." });
  const prompt = `You are a forced-alignment tool. Listen to the attached audio and produce TIGHT word-level timestamps.

Reference transcript (use this exact tokenization in order — split on whitespace):
"""${transcript}"""

CRITICAL RULES:
- Output ONE entry per word in the transcript, IN ORDER.
- startMs = the EXACT millisecond when the speaker BEGINS pronouncing that word.
- endMs = the EXACT millisecond when the speaker FINISHES that word.
- RESPECT SILENCE — DO NOT compress, do not force words to start at 0ms.
- Timestamps must be monotonically non-decreasing.
- Skip filler words ("uh", "um") NOT in the transcript.

Return ONLY this JSON:
{ "wordTimings": [{"word": string, "startMs": number, "endMs": number}] }`;
  try {
    const { text, model } = await callGemini({ apiKey, model: pickModelForKind("score"), prompt, responseJson: true, audioBase64, mimeType, fallbackModels: MODELS_BY_PURPOSE.pronunciation });
    const out = JSON.parse(text);
    return json(200, { provider: "gemini", model, wordTimings: Array.isArray(out.wordTimings) ? out.wordTimings : [] });
  } catch (error) {
    return json(200, { wordTimings: [], warning: error.message });
  }
}

async function handlePronunContent(event) {
  const body = parseBody(event);
  const { apiKey, sound = "" } = body;
  if (!sound) return json(200, { sound, words: [], phrases: [], warning: "Thiếu sound." });
  const prompt = `You are an IELTS pronunciation coach building practice content for the English sound ${sound} (IPA notation).
Generate exactly:
- 8 common, useful English words that contain the sound ${sound}. Mix word positions (start/middle/end). Mix difficulty (basic + intermediate).
- 5 short example phrases (3-6 words each) that each contain MULTIPLE instances of ${sound}.

For every word AND every phrase, include the FULL IPA transcription with stress marks.

Return ONLY this JSON, no markdown:
{
  "words": [{"word": "pet", "ipa": "/pɛt/"}, ...8 items],
  "phrases": [{"phrase": "Please pick up the pen.", "ipa": "/pliːz/ /pɪk/ /ʌp/ /ðə/ /pɛn/"}, ...5 items]
}`;
  try {
    const { text, model } = await callGemini({ apiKey, model: pickModelForKind("ideas"), prompt, responseJson: true, fallbackModels: MODELS_BY_PURPOSE.ideas });
    const out = JSON.parse(text);
    return json(200, { provider: "gemini", model, sound, words: out.words || [], phrases: out.phrases || [] });
  } catch (error) {
    return json(200, { sound: "", words: [], phrases: [], warning: error.message });
  }
}

async function handleScoreSentence(event) {
  const body = parseBody(event);
  const { apiKey, sentence = "", audioBase64 = "", mimeType = "audio/webm", context = "", targetPhoneme = "", focusOnly = false } = body;
  if (!audioBase64) return json(200, { score: "?", verdict: "Chưa có audio.", phoneticHeard: "", tips: "" });
  const focusBlock = focusOnly && targetPhoneme
    ? `\n\nFOCUS-ONLY MODE — IMPORTANT:\n- The learner is drilling the SINGLE sound /${targetPhoneme}/ in this lesson.\n- Score how accurately they produced /${targetPhoneme}/ in EVERY word that contains it. Ignore other accent issues unless they break meaning.\n- 'worstWords' must be the words where /${targetPhoneme}/ was off the most.\n- 'tips' must address /${targetPhoneme}/ articulation (mouth/tongue, voicing, Vietnamese L1 substitution).`
    : "";
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
  try {
    const { text, model } = await callGemini({ apiKey, model: pickModelForKind("score-word"), prompt, responseJson: true, audioBase64, mimeType, fallbackModels: MODELS_BY_PURPOSE.dictionary });
    return json(200, { provider: "gemini", model, ...JSON.parse(text) });
  } catch (error) {
    return json(200, { score: "?", verdict: "Lỗi: " + error.message, phoneticHeard: "", tips: "", worstWords: [] });
  }
}

async function handleIpa(event) {
  const body = parseBody(event);
  const { apiKey, text = "", style = "british" } = body;
  if (!text) return json(200, { ipa: "", warning: "Thiếu text" });
  const prompt = `Convert this English text to IPA phonetic transcription (${style === "american" ? "American English" : "Received Pronunciation / British English"}).
Text: """${text}"""

Rules:
- Use standard IPA with stress marks (ˈ primary, ˌ secondary).
- Wrap each WORD in /…/. Join multi-word phrases with single spaces.
- Do NOT add explanation, just the IPA.

Return ONLY this JSON: {"ipa": "<full IPA string>", "perWord": [{"word": "word1", "ipa": "/wɜːd/"}, ...]}`;
  try {
    const { text: out, model } = await callGemini({ apiKey, model: pickModelForKind("score-word"), prompt, responseJson: true, fallbackModels: MODELS_BY_PURPOSE.dictionary });
    const data = JSON.parse(out);
    return json(200, { provider: "gemini", model, ipa: data.ipa || "", perWord: data.perWord || [] });
  } catch (error) {
    return json(200, { ipa: "", perWord: [], warning: error.message });
  }
}

async function handleAuthUser(event) {
  const token = getToken(event);
  if (token) {
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { "apikey": SUPABASE_PUBLISHABLE_KEY, "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const user = await response.json();
        if (user && user.id) return json(200, { ok: true, user: { id: user.id, email: user.email || "", display_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || "", avatar_url: user.user_metadata?.avatar_url || "" } });
      }
    } catch {}
  }
  // Fallback: decode JWT locally
  const info = getAuthInfo(event);
  if (info.isAuthenticated) {
    return json(200, { ok: true, user: { id: info.userId, email: info.email, display_name: info.displayName, avatar_url: "" } });
  }
  return json(200, { ok: true, user: null });
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
    if (method === "GET" && path === "/auth/user") return handleAuthUser(event);
    if (method === "POST" && path === "/gemini/assist") return handleAssist(event);
    if (method === "POST" && path === "/gemini/score-speaking/start") return handleScoreStart(event);
    const scoreStatus = path.match(/^\/gemini\/score-speaking\/status\/([^/]+)$/);
    if (method === "GET" && scoreStatus) return handleScoreStatus(event, scoreStatus[1]);
    if (method === "POST" && path === "/gemini/score-speaking") return handleScore(event);
    if (method === "POST" && path === "/gemini/score-word") return handleScoreWord(event);
    if (method === "POST" && path === "/gemini/word-timings") return handleWordTimings(event);
    if (method === "POST" && path === "/gemini/pronun-content") return handlePronunContent(event);
    if (method === "POST" && path === "/gemini/score-sentence") return handleScoreSentence(event);
    if (method === "POST" && path === "/gemini/ipa") return handleIpa(event);
    if (method === "POST" && path === "/test-sessions/start") return handleSession(event, "start");
    const sessionAction = path.match(/^\/test-sessions\/([^/]+)\/(cancel|complete|invalidate)$/);
    if (method === "POST" && sessionAction) return handleSession(event, sessionAction[2], sessionAction[1]);
    if (method === "POST" && (path === "/events" || path === "/events/batch")) return handleEvents(event);
    if (method === "GET" && path === "/practice-attempts") return handleGetAttempts(event);
    if (method === "POST" && path === "/practice-attempts") return handleSyncAttempts(event);
    if (method === "GET" && path === "/models") {
      const GEMINI_MODELS = [
        "gemini-3.5-flash",
        "gemini-3-flash-preview",
        "gemini-3.1-flash-lite-preview",
        "gemini-3.1-pro-preview",
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
      ];
      const MODEL_LABELS = {
        "gemini-3.5-flash":              { label: "Gemini 3.5 Flash",                 usage: "🎤 Chấm phát âm (CHÍNH)" },
        "gemini-3-flash-preview":        { label: "Gemini 3 Flash (Preview)",         usage: "🎤 Chấm phát âm (dự phòng)" },
        "gemini-3.1-flash-lite-preview": { label: "Gemini 3.1 Flash Lite (Preview)",  usage: "💡 Sinh ý / câu mẫu / cue cards (CHÍNH)" },
        "gemini-3.1-pro-preview":        { label: "Gemini 3.1 Pro (Preview)",         usage: "🎤 Chấm phát âm (dự phòng cao cấp)" },
        "gemini-2.5-pro":                { label: "Gemini 2.5 Pro",                   usage: "💡 Sinh ý chất lượng cao (dự phòng)" },
        "gemini-2.5-flash":              { label: "Gemini 2.5 Flash",                 usage: "📖 Tra từ điển (dự phòng) / đa dụng" },
        "gemini-2.5-flash-lite":         { label: "Gemini 2.5 Flash Lite",            usage: "📖 Từ vựng / dịch / chấm từng từ (CHÍNH)" },
      };
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
      const models = GEMINI_MODELS.map(id => ({ id, label: MODEL_LABELS[id]?.label || id, usage: MODEL_LABELS[id]?.usage || "" }));
      return json(200, { ok: true, models, taskMap: TASK_MAP });
    }
    return json(404, { ok: false, error: `Unknown API path: ${path}` });
  } catch (error) {
    return json(500, { ok: false, error: error.message });
  }
}
