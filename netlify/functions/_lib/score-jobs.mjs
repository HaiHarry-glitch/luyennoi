import { getStore } from "@netlify/blobs";

const STORE_NAME = "ln-score-speaking-jobs";

function store() {
  return getStore(STORE_NAME);
}

function statusKey(jobId) {
  return `status:${jobId}`;
}

export async function writeScoreJobStatus(jobId, status) {
  const value = { ...status, jobId, updatedAt: new Date().toISOString() };
  await store().setJSON(statusKey(jobId), value);
  return value;
}

export async function readScoreJobStatus(jobId) {
  return await store().get(statusKey(jobId), { type: "json" });
}
