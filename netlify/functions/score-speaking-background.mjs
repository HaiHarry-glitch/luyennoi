import { buildScorePrompt, applyOverallFloor, parseGeminiJson } from "./_lib/score.mjs";
import { writeScoreJobStatus, readScoreJobPayload } from "./_lib/score-jobs.mjs";
import { callGemini, MODELS_BY_PURPOSE, pickModelForKind } from "./api.mjs";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  return JSON.parse(raw || "{}");
}

export async function handler(event) {
  const body = parseBody(event);
  const jobId = body.jobId || event.queryStringParameters?.jobId || "";
  if (!jobId) return json(400, { ok: false, error: "Missing jobId" });
  // Ưu tiên payload trong body (tương thích cũ); nếu trống thì đọc từ score_jobs
  // theo jobId — đây là đường chính giờ vì audio không còn gửi qua body trigger.
  let payload = body.payload || (body.audioBase64 ? body : null);
  if (!payload || !payload.audioBase64) {
    try { payload = await readScoreJobPayload(jobId); } catch (e) {
      console.warn("[score-bg] readScoreJobPayload failed", e?.message || e);
    }
  }
  if (!payload || !payload.audioBase64) {
    await writeScoreJobStatus(jobId, { status: "error", error: "Missing audio payload for job", clearPayload: true });
    return json(400, { ok: false, error: "Missing audioBase64" });
  }

  await writeScoreJobStatus(jobId, {
    status: "running",
    userId: payload.userId || "local-student",
    progress: "scoring"
  });

  try {
    const prompt = buildScorePrompt({
      part: payload.part || "",
      question: payload.question || "",
      transcript: payload.transcript || "",
      note: payload.note || "",
      audioBase64: payload.audioBase64 || ""
    });
    const { text, model } = await callGemini({
      apiKey: payload.apiKey || "",
      model: pickModelForKind("score"),
      prompt,
      responseJson: true,
      audioBase64: payload.audioBase64 || "",
      mimeType: payload.mimeType || "audio/webm",
      fallbackModels: MODELS_BY_PURPOSE.pronunciation,
      totalBudgetMs: 600000
    });
    const scored = applyOverallFloor(parseGeminiJson(text));
    const result = { provider: "gemini", model, ...scored };
    await writeScoreJobStatus(jobId, {
      status: "done",
      userId: payload.userId || "local-student",
      result,
      clearPayload: true
    });
    return json(200, { ok: true, jobId, status: "done" });
  } catch (error) {
    await writeScoreJobStatus(jobId, {
      status: "error",
      userId: payload.userId || "local-student",
      error: error?.message || String(error || "Scoring failed"),
      clearPayload: true
    });
    return json(200, { ok: true, jobId, status: "error" });
  }
}
