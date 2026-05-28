// Async speaking score job storage backed by Supabase (Phase 2).
// Replaces the @netlify/blobs implementation that hit MissingBlobsEnvironmentError
// in production. Uses the service-role key on the server side so the Netlify
// background function can update jobs without a user JWT.

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://gxjgkwebrxzcawqkxmbt.supabase.co").replace(/\/+$/, "");
const SERVICE_ROLE = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

function ensureConfig() {
  if (!SUPABASE_URL) throw new Error("Score jobs storage: SUPABASE_URL missing");
  if (!SERVICE_ROLE) throw new Error("Score jobs storage: SUPABASE_SERVICE_ROLE_KEY missing");
}

async function rest(path, { method = "GET", body, prefer = "return=representation" } = {}) {
  ensureConfig();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: prefer
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.message || `Supabase score_jobs HTTP ${response.status}`);
  }
  return data;
}

function normaliseRow(row) {
  if (!row) return null;
  return {
    jobId: row.id,
    status: row.status,
    progress: row.progress || null,
    result: row.result || null,
    error: row.error || null,
    userId: row.client_user_id || "local-student",
    authUserId: row.user_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function writeScoreJobStatus(jobId, status) {
  const now = new Date().toISOString();
  const payload = {
    id: jobId,
    status: status.status || "queued",
    progress: status.progress ?? null,
    result: status.result ?? null,
    error: status.error ?? null,
    client_user_id: status.userId || status.clientUserId || "local-student",
    user_id: status.authUserId || null,
    updated_at: now
  };
  const rows = await rest("score_jobs?on_conflict=id", {
    method: "POST",
    body: payload,
    prefer: "return=representation,resolution=merge-duplicates"
  });
  return normaliseRow(Array.isArray(rows) ? rows[0] : rows) || { jobId, ...status };
}

export async function readScoreJobStatus(jobId) {
  const rows = await rest(`score_jobs?id=eq.${encodeURIComponent(jobId)}&limit=1`);
  return normaliseRow(Array.isArray(rows) ? rows[0] : null);
}

export function isScoreJobsConfigured() {
  return Boolean(SUPABASE_URL && SERVICE_ROLE);
}
