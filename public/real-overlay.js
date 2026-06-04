// Local overlay — intercept luyennoi backend calls, route to local Gemini.
(function () {
  if (window.__lnOverlay) return;
  window.__lnOverlay = true;

  // ---- Auth bypass (local clone, no real login) ----
  // Stamp a fake user into localStorage so SvelteKit / app code that reads it
  // skips the login flow and treats us as authenticated.
  try {
    const fakeUser = {
      id: "local-user",
      email: "local@clone.dev",
      name: "Local User",
      sub: "local-user",
      isPaid: true,
      tier: "premium",
      band: 6.0,
      authenticated: true
    };
    const stamp = (k, v) => { try { if (!localStorage.getItem(k)) localStorage.setItem(k, v); } catch {} };
    stamp("ln.user", JSON.stringify(fakeUser));
    stamp("ln.authenticated", "1");
    stamp("user", JSON.stringify(fakeUser));
    stamp("auth.idToken", "local.bypass.token");
    stamp("auth.accessToken", "local.bypass.token");
    stamp("CognitoIdentityServiceProvider.local.LastAuthUser", "local-user");
  } catch {}

  // Hard-block any navigation to login pages — replace with "/"
  try {
    const blockLogin = (url) => /\/(login|signin|sign-in|auth|cognito|oauth)(\/|$|\?)/i.test(String(url || ""));
    const origAssign = window.location.assign?.bind(window.location);
    const origReplace = window.location.replace?.bind(window.location);
    if (origAssign) window.location.assign = (u) => blockLogin(u) ? origAssign(location.origin + "/") : origAssign(u);
    if (origReplace) window.location.replace = (u) => blockLogin(u) ? origReplace(location.origin + "/") : origReplace(u);
  } catch {}

  const US_KEY = "ln.userState";
  function getUS() { try { return JSON.parse(localStorage.getItem(US_KEY)) || {}; } catch { return {}; } }
  const SCORE_HISTORY_PREFIX = "ln.scoreHistory:";
  const SCORE_HISTORY_INDEX_KEY = "ln.scoreHistoryIndex";
  const MAX_LOCAL_SCORE_QUESTIONS = 30;
  const MAX_LOCAL_SCORE_ATTEMPTS_PER_Q = 3;
  function isStorageQuotaError(e) { return e?.name === "QuotaExceededError" || e?.code === 22 || /quota/i.test(String(e?.message || "")); }
  function getLocalScoreIndex() {
    try {
      const idx = JSON.parse(localStorage.getItem(SCORE_HISTORY_INDEX_KEY) || "{}");
      return idx && typeof idx === "object" && !Array.isArray(idx) ? idx : {};
    } catch { return {}; }
  }
  function saveLocalScoreIndex(idx) {
    try { localStorage.setItem(SCORE_HISTORY_INDEX_KEY, JSON.stringify(idx || {})); } catch {}
  }
  function readLocalScoreTs(key, idx = getLocalScoreIndex()) {
    const fromIndex = Number(idx[key]);
    if (Number.isFinite(fromIndex) && fromIndex > 0) return fromIndex;
    try {
      const arr = JSON.parse(localStorage.getItem(key) || "[]");
      const first = Array.isArray(arr) ? arr[0] : null;
      return Number(first?.ts || first?.created_at || 0) || 0;
    } catch { return 0; }
  }
  function trimLocalScoreEntry(item = {}) {
    const {
      audioDataUrl, audioUrl, raw,
      pronunciationIssues, grammarIssues, vocabularyIssues, spellingIssues, fluencyPauses,
      ...rest
    } = item || {};
    return {
      ...rest,
      transcript: String(rest.transcript || "").slice(0, 700),
      rewrittenAnswer: String(rest.rewrittenAnswer || "").slice(0, 900),
      feedback: String(rest.feedback || "").slice(0, 900),
      suggestions: Array.isArray(rest.suggestions) ? rest.suggestions.slice(0, 4) : rest.suggestions,
      pronunciationIssues: Array.isArray(pronunciationIssues) ? pronunciationIssues.slice(0, 5) : [],
      grammarIssues: Array.isArray(grammarIssues) ? grammarIssues.slice(0, 5) : [],
      vocabularyIssues: Array.isArray(vocabularyIssues) ? vocabularyIssues.slice(0, 5) : [],
      spellingIssues: Array.isArray(spellingIssues) ? spellingIssues.slice(0, 4) : [],
      fluencyPauses: Array.isArray(fluencyPauses) ? fluencyPauses.slice(0, 4) : [],
    };
  }
  function enforceLocalScoreLimit(keepKey = "") {
    try {
      const idx = getLocalScoreIndex();
      const entries = [];
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(SCORE_HISTORY_PREFIX)) continue;
        const ts = k === keepKey ? Date.now() : readLocalScoreTs(k, idx);
        entries.push([k, ts]);
        idx[k] = ts;
      }
      entries.sort((a, b) => b[1] - a[1]);
      const keep = new Set(entries.slice(0, MAX_LOCAL_SCORE_QUESTIONS).map(([k]) => k));
      if (keepKey) keep.add(keepKey);
      for (const [k] of entries) {
        if (keep.has(k)) continue;
        try { localStorage.removeItem(k); } catch {}
        delete idx[k];
      }
      Object.keys(idx).forEach((k) => { if (!k.startsWith(SCORE_HISTORY_PREFIX) || !localStorage.getItem(k)) delete idx[k]; });
      saveLocalScoreIndex(idx);
    } catch {}
  }
  function freeLocalScoreStorage(keepKey = "") {
    try {
      enforceLocalScoreLimit(keepKey);
      const idx = getLocalScoreIndex();
      const keys = [];
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(SCORE_HISTORY_PREFIX) && k !== keepKey) keys.push([k, readLocalScoreTs(k, idx)]);
      }
      keys.sort((a, b) => a[1] - b[1]).slice(0, Math.max(1, Math.ceil(keys.length / 3))).forEach(([k]) => { try { localStorage.removeItem(k); } catch {} });
      if (keepKey && keepKey.startsWith(SCORE_HISTORY_PREFIX)) {
        try {
          const arr = JSON.parse(localStorage.getItem(keepKey) || "[]");
          const slim = (Array.isArray(arr) ? arr : []).slice(0, MAX_LOCAL_SCORE_ATTEMPTS_PER_Q).map(trimLocalScoreEntry);
          localStorage.setItem(keepKey, JSON.stringify(slim));
        } catch {}
      }
      try {
        const ft = JSON.parse(localStorage.getItem("ln.fullTestHistory") || "[]");
        if (Array.isArray(ft) && ft.length > 8) {
          localStorage.setItem("ln.fullTestHistory", JSON.stringify(ft.slice(0, 8).map((x) => ({ ...x, answers: [] }))));
        }
      } catch {}
    } catch {}
  }
  function safeLocalSet(key, value) {
    try { localStorage.setItem(key, value); if (key.startsWith(SCORE_HISTORY_PREFIX)) enforceLocalScoreLimit(key); return true; }
    catch (e) {
      if (!isStorageQuotaError(e)) return false;
      freeLocalScoreStorage(key);
      try { localStorage.setItem(key, value); if (key.startsWith(SCORE_HISTORY_PREFIX)) enforceLocalScoreLimit(key); return true; } catch {}
      return false;
    }
  }
  function saveBoundedScoreHistory(key, entries) {
    const slim = (Array.isArray(entries) ? entries : []).slice(0, MAX_LOCAL_SCORE_ATTEMPTS_PER_Q).map(trimLocalScoreEntry);
    return safeLocalSet(key, JSON.stringify(slim));
  }
  function saveUS(s) { safeLocalSet(US_KEY, JSON.stringify(s)); }
  function getKey() {
    try {
      const keys = JSON.parse(localStorage.getItem("luyennoi.geminiKeys") || "[]");
      if (Array.isArray(keys) && keys[0]) return keys[0];
    } catch {}
    return localStorage.getItem("luyennoi.geminiKey") || "";
  }
  function getModel() { return localStorage.getItem("luyennoi.geminiModel") || ""; }

  const realFetch = window.fetch.bind(window);
  window.fetch = async function (input, init = {}) {
    const url = typeof input === "string" ? input : input.url;
    const method = (init.method || (input.method) || "GET").toUpperCase();

    // /api/be/databases  → return minimal envelope so hydration doesn't crash
    if (/\/api\/be\/databases$/.test(url)) {
      let body = {};
      try { body = JSON.parse(init.body || "{}"); } catch {}
      const us = getUS();
      // generic mock — return empty list / user data
      const payload = {
        ok: true,
      user: { name: "Bạn", answered: us.answered || 0, dayStreak: us.dayStreak || 0, band: us.band || 5.0 },
        items: [],
        data: [],
        history: us.history || [],
        leaderboard: [],
      };
      return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // /api/oai/chat → bridge to /api/gemini/assist (SSE-flavoured)
    if (/\/api\/oai\/chat$/.test(url)) {
      try {
        const r = await realFetch("/api/gemini/assist", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: getKey(), model: getModel(), kind: "sample", topic: location.pathname.split("~")[1] || "" })
        });
        const data = await r.json();
        const stream = `data: ${JSON.stringify({ choices: [{ delta: { content: (data.html || "").replace(/<[^>]+>/g, "") } }] })}\n\ndata: [DONE]\n\n`;
        return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
      } catch {
        return new Response("data: [DONE]\n\n", { status: 200, headers: { "Content-Type": "text/event-stream" } });
      }
    }

    // /api/be/storage → mock presigned URL pointing to local
    if (/\/api\/be\/storage$/.test(url)) {
      return new Response(JSON.stringify({ url: "/real/img/placeholder-audio", uploadUrl: "/api/local-upload" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // /api/be/ecsKokoro → silent wav
    if (/\/api\/be\/ecsKokoro$/.test(url)) {
      // Use Web Speech API instead — return tiny silent wav
      try {
        let body = {};
        try { body = JSON.parse(init.body || "{}"); } catch {}
        const text = body.text || body.input || "";
        if (text && window.speechSynthesis) speakText(text);
      } catch {}
      // 44 bytes silent WAV
      const silent = new Uint8Array([82,73,70,70,36,0,0,0,87,65,86,69,102,109,116,32,16,0,0,0,1,0,1,0,68,172,0,0,136,88,1,0,2,0,16,0,100,97,116,97,0,0,0,0]);
      return new Response(silent, { status: 200, headers: { "Content-Type": "audio/wav" } });
    }

    // /api/be/textToPhoneme → naive phoneme
    if (/\/api\/be\/textToPhoneme$/.test(url)) {
      let body = {}; try { body = JSON.parse(init.body || "{}"); } catch {}
      const text = body.text || body.input || "practice";
      const phon = text.toLowerCase().replace(/ph/g, "f").replace(/[^a-z\s]/g, "");
      return new Response(JSON.stringify({ phoneme: "/" + phon + "/", text }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    return realFetch(input, init);
  };

  // Block AWS Cognito / external auth chatter
  const origXHR = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function (m, u, ...rest) {
    if (typeof u === "string" && /cognito|amazonaws/.test(u)) { this.__blocked = true; }
    return origXHR.call(this, m, u, ...rest);
  };
  const origSend = window.XMLHttpRequest.prototype.send;
  window.XMLHttpRequest.prototype.send = function (data) {
    if (this.__blocked) { setTimeout(() => { try { this.readyState = 4; this.status = 200; this.responseText = "{}"; this.onreadystatechange?.(); this.onload?.(); } catch {} }, 0); return; }
    return origSend.call(this, data);
  };

  // ---- Recording flow (MediaRecorder → Gemini score) ----
  const REC_STATE = { recorder: null, chunks: [], stream: null, recording: false, mimeType: "" };

  // Placeholder — actual implementation set further down with full UI overlay
  let startRecording = async (btn) => { console.warn("startRecording placeholder"); };

  function blobToBase64(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }

  function pickRecordingMimeType() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return "";
    return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"].find((type) => MediaRecorder.isTypeSupported(type)) || "";
  }

  // Floor IELTS band to integer for individual criteria (1-9 whole bands)
  function floorBand(n) { const v = Number(n); return Number.isFinite(v) ? Math.floor(v) : "?"; }
  // Overall band uses 0.5 step rounded DOWN per IELTS spec.
  // Example: avg 7.5 → 7.5, avg 7.4 → 7.0, avg 7.9 → 7.5
  function computeOverallFloor(c) {
    const vals = ["fluency","vocabulary","grammar","pronunciation"].map(k => Number(c?.[k]?.score)).filter(Number.isFinite);
    if (!vals.length) return "?";
    const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
    return Math.floor(avg * 2) / 2;
  }
  function normScoreText(v) { return String(v || "").trim().toLowerCase().replace(/\s+/g, " "); }
  function scoreResultFingerprint(d) {
    const transcript = normScoreText(d?.transcript);
    if (!transcript) return "";
    const question = normScoreText(d?.question || getQuestionFromPage());
    const overall = d?.overall ?? computeOverallFloor(d?.criteria || {});
    return [question.slice(0, 220), transcript.slice(0, 420), overall].join("||");
  }

  function renderScoreResult(d) {
    const c = d.criteria || {};
    const attemptKey = d.__attemptKey || "";
    const scoreFingerprint = scoreResultFingerprint(d);
    if ((attemptKey || scoreFingerprint) && Array.from(document.querySelectorAll(".ln-score-panel, #ln-score-panel")).some(p =>
      (attemptKey && p.dataset.lnAttemptKey === attemptKey) ||
      (scoreFingerprint && p.dataset.lnScoreFingerprint === scoreFingerprint)
    )) return;
    // Individual criteria use integer floor (whole IELTS bands).
    const flu = floorBand(c.fluency?.score);
    const voc = floorBand(c.vocabulary?.score);
    const gra = floorBand(c.grammar?.score);
    const pro = floorBand(c.pronunciation?.score);
    // Overall uses 0.5 step. Prefer the backend-computed value when present.
    const overallRaw = (typeof d.overall === "number") ? d.overall : computeOverallFloor(c);
    const overall = (typeof overallRaw === "number") ? Math.floor(overallRaw * 2) / 2 : overallRaw;

    // Persist into history ARRAY (stack) per question
    try {
      const q = (d.question || getQuestionFromPage()).trim();
      const key = "ln.scoreHistory:" + encodeURIComponent(q);
      // Don't double-save when restoring from cache
      if (!d.__fromCache && d.__realAttempt) {
        const { audioUrl, audioDataUrl, ...persistable } = d;
        let arr = [];
        try { arr = JSON.parse(localStorage.getItem(key) || "[]"); } catch {}
        const localAttempt = trimLocalScoreEntry({
          ts: Date.now(),
          question: q,
          __realAttempt: true,
          part: d.part || "",
          ...persistable,
          overall: d.overall ?? overall,
          transcript: d.transcript || "",
          criteria: d.criteria || {},
          model: d.model || d.provider || "",
        });
        saveBoundedScoreHistory(key, [localAttempt, ...(Array.isArray(arr) ? arr : [])]);
        try {
          const crit = d.criteria || {};
          // Gửi kèm audio bản ghi để server upload lên Supabase Storage,
          // nhờ đó mở lại bài cũ nghe được giọng thật (không rơi về TTS).
          const _adu = audioDataUrl || "";
          const _amime = (_adu.match(/^data:([^;]+);/) || [])[1] || (d.mimeType || "audio/webm");
          const _ab64 = _adu.includes(",") ? _adu.split(",")[1] : "";
          const _attemptId = (self.crypto?.randomUUID?.() || (Date.now() + "-" + Math.random().toString(16).slice(2)));
          realFetch("/api/practice-attempts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attempts: [{
              client_attempt_id: _attemptId,
              prompt_text: q,
              part: d.part || "",
              transcript: d.transcript || "",
              score_overall: d.overall ?? computeOverallFloor(crit),
              score_fluency: crit.fluency?.score ?? null,
              score_vocab: crit.vocabulary?.score ?? null,
              score_grammar: crit.grammar?.score ?? null,
              score_pronunciation: crit.pronunciation?.score ?? null,
              raw_score_json: persistable,
              gemini_model: persistable.model || "",
              mode: "practice",
              audio_b64: _ab64,
              audio_mime: _amime,
              audio_duration_ms: d.durationMs || null,
              created_at: new Date().toISOString()
            }]})
          }).catch(function(){});
        } catch(pushErr){}
      }
    } catch {}

    // Find the left panel scrollable content area to inject inside it
    const leftContent = (function() {
      for (const el of document.querySelectorAll("*")) {
        const cls = Array.from(el.classList);
        if (cls.includes("md:w-3/5") || cls.includes("w-3/5")) {
          return el.querySelector(".overflow-y-auto, .flex-1.overflow-y-auto") || el.querySelector(".flex-1");
        }
      }
      return null;
    })();

    const transcriptHtml = d.transcript
      ? `<div style="display:flex;align-items:flex-start;gap:.5rem;background:#ffffff;border:1.5px solid #171717;border-radius:.15rem;padding:.6rem .8rem;margin-bottom:.6rem;">
          <button class="ln-tts-btn" data-text="${(d.transcript||"").replace(/"/g,"&quot;")}" style="background:#d9381e;color:#fff;border:1.5px solid #171717;border-radius:.15rem;width:1.6rem;height:1.6rem;cursor:pointer;font-size:.7rem;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;box-shadow:2px 2px 0 #171717;">▶</button>
          <div style="font-size:.82rem;line-height:1.6;">${d.transcript}</div>
        </div>` : "";

    const rewrittenHtml = d.rewrittenAnswer
      ? `<div style="margin-bottom:.6rem;">
          <div style="font-size:.72rem;font-weight:800;color:#d9381e;margin-bottom:.3rem;">✅ Cải thiện câu</div>
          <div style="display:flex;align-items:flex-start;gap:.5rem;background:#ffffff;border:1.5px solid #171717;border-radius:.15rem;padding:.6rem .8rem;">
            <button class="ln-tts-btn" data-text="${(d.rewrittenAnswer||"").replace(/"/g,"&quot;")}" style="background:#FFD700;color:#171717;border:1.5px solid #171717;border-radius:.15rem;width:1.6rem;height:1.6rem;cursor:pointer;font-size:.7rem;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;box-shadow:2px 2px 0 #171717;">▶</button>
            <div style="font-size:.82rem;line-height:1.6;">${d.rewrittenAnswer}</div>
          </div>
        </div>` : "";

    // Build 4 criterion pills, each with "chi tiết" button
    const pill = (label, kind, score) => `
      <div style="background:#fff7cc;border:1.5px solid #FFD700;border-radius:9999px;padding:.3rem .8rem;display:inline-flex;align-items:center;gap:.5rem;font-size:.78rem;font-weight:800;color:#d9381e;cursor:default;">
        <span>${label}: ${score}</span>
        <button class="ln-crit-btn" data-crit="${kind}" style="display:inline-flex;align-items:center;justify-content:center;background:#d9381e!important;color:#fff!important;border:1.5px solid #171717;border-radius:.15rem;box-shadow:2px 2px 0 #171717;font-size:.68rem;line-height:1;padding:.18rem .55rem;min-width:3.2rem;min-height:1.25rem;cursor:pointer;font-family:inherit;font-weight:800;text-indent:0;opacity:1;visibility:visible;text-transform:none;letter-spacing:0;">Chi tiết</button>
      </div>`;

    const html = `
      <div id="ln-score-panel" style="background:#ffffff;border-radius:.8rem;padding:1rem;margin-bottom:.8rem;font-family:Lexend,sans-serif;position:relative;">
        <div style="position:absolute;top:.7rem;right:.7rem;display:flex;gap:.3rem;align-items:center;">
          <button class="ln-score-toggle" title="Thu nhỏ / mở rộng" style="background:none;border:none;cursor:pointer;font-size:.85rem;color:#6b7280;padding:0;line-height:1;">▼</button>
          <button class="ln-score-close" style="background:none;border:none;cursor:pointer;font-size:1rem;color:#9ca3af;">×</button>
        </div>
        <div class="ln-score-header" style="display:flex;align-items:flex-start;gap:.7rem;margin-bottom:.4rem;cursor:pointer;padding-right:3rem;">
          <button class="ln-user-audio-btn" style="background:transparent;border:1.5px solid #171717;color:#171717;border-radius:50%;width:1.8rem;height:1.8rem;cursor:pointer;font-size:.7rem;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;margin-top:.2rem;" title="Nghe lại bản ghi của bạn">▶</button>
          <div style="flex:1;font-size:.88rem;line-height:1.85;color:#171717;" class="ln-user-transcript">${buildAnnotatedTranscript(d)}</div>
          <div class="ln-overall-score" aria-label="Điểm overall" style="background:#d9381e!important;color:#fff!important;font-size:1.05rem!important;font-weight:900!important;min-width:2.6rem!important;width:2.6rem!important;height:2.6rem!important;border-radius:50%!important;display:flex!important;align-items:center!important;justify-content:center!important;flex-shrink:0!important;line-height:1!important;text-indent:0!important;opacity:1!important;visibility:visible!important;">
            <span style="display:block!important;color:#fff!important;font:900 1.05rem/1 Inter,Arial,sans-serif!important;text-indent:0!important;opacity:1!important;visibility:visible!important;">${overall}</span>
          </div>
        </div>
        <div class="ln-score-body">
        ${d.audioDataUrl || d.audioUrl ? `
          <div style="margin:.2rem 0 .5rem 2.3rem;">
            <button class="ln-word-sync-btn" style="background:#d9381e;color:#fff;border:1.5px solid #171717;border-radius:.15rem;padding:.28rem .7rem;font-size:.72rem;font-weight:800;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:.35rem;box-shadow:2px 2px 0 #171717;text-indent:0;opacity:1;visibility:visible;">
              <span>🎯</span><span>Nghe theo từ</span>
            </button>
            <span style="font-size:.65rem;color:#9ca3af;margin-left:.4rem;">Highlight từng từ khi phát</span>
          </div>` : ""}
        ${(d.grammarIssues?.length || d.vocabularyIssues?.length || d.spellingIssues?.length) ? `
          <div style="display:flex;gap:.7rem;flex-wrap:wrap;font-size:.68rem;color:#6b7280;margin:0 0 .6rem 2.3rem;">
            ${d.grammarIssues?.length ? `<span><span style="background:#ffffff;color:var(--red);text-decoration:line-through;padding:0 .2rem;border-radius:.2rem;">abc</span> Ngữ pháp (${d.grammarIssues.length})</span>` : ""}
            ${d.vocabularyIssues?.length ? `<span><span style="background:#fef3c7;color:#92400e;text-decoration:line-through;padding:0 .2rem;border-radius:.2rem;">abc</span> Từ vựng (${d.vocabularyIssues.length})</span>` : ""}
            ${d.spellingIssues?.length ? `<span><span style="background:#fecdd3;color:#9f1239;text-decoration:line-through;padding:0 .2rem;border-radius:.2rem;">abc</span> Chính tả (${d.spellingIssues.length})</span>` : ""}
            <span><span style="background:#fffbe6;color:#171717;padding:0 .2rem;border-radius:.2rem;font-weight:600;">abc</span> Sửa</span>
          </div>` : ""}
        ${d.environmentWarning || /noisy|noise|ồn|môi trường/i.test(d.feedback||"") ? `<div style="color:var(--red);font-size:.78rem;margin-bottom:.5rem;">⚠ Môi trường ồn nên điểm phát âm chưa được chấm. Thử lại ở nơi yên tĩnh nhé.</div>` : ""}
        <div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.7rem;">
          ${pill("Trôi chảy", "fluency", flu)}
          ${pill("Từ vựng", "vocabulary", voc)}
          ${pill("Ngữ pháp", "grammar", gra)}
          ${pill("Phát âm", "pronunciation", pro)}
        </div>
        ${d.rewrittenAnswer ? `
          <div style="border-top:1px dashed #FFD700;padding-top:.6rem;margin-top:.4rem;">
            <div style="font-size:.72rem;font-weight:800;color:#d9381e;margin-bottom:.3rem;">✅ Cải thiện câu</div>
            <div style="display:flex;align-items:flex-start;gap:.5rem;background:#ffffff;border:1.5px solid #171717;border-radius:.15rem;padding:.5rem .7rem;">
              <button class="ln-tts-btn" data-text="${(d.rewrittenAnswer||"").replace(/"/g,"&quot;")}" style="background:#FFD700;color:#171717;border:1.5px solid #171717;border-radius:.15rem;width:1.5rem;height:1.5rem;cursor:pointer;font-size:.65rem;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;box-shadow:2px 2px 0 #171717;">▶</button>
              <div style="font-size:.82rem;line-height:1.6;">${d.rewrittenAnswer}</div>
            </div>
          </div>` : ""}
        ${d.warning?`<div style="color:var(--red);font-size:.72rem;margin-top:.4rem;">⚠ ${d.warning}</div>`:""}
        </div>
      </div>`;

    let host;
    if (leftContent) {
      // STACK: do not remove existing panels — give each a unique class instead of shared id
      const div = document.createElement("div");
      div.innerHTML = html;
      host = div.firstElementChild;
      host.removeAttribute("id");
      host.classList.add("ln-score-panel");
      if (attemptKey) host.dataset.lnAttemptKey = attemptKey;
      if (scoreFingerprint) host.dataset.lnScoreFingerprint = scoreFingerprint;
      leftContent.prepend(host);
      wireInlineTts(leftContent);
    } else {
      let panel = document.getElementById("ln-score-panel");
      if (!panel) { panel = document.createElement("div"); document.body.appendChild(panel); }
      panel.style.cssText = "position:fixed;right:1rem;top:5rem;width:380px;background:white;border:1.5px solid #e5e7eb;border-radius:1rem;box-shadow:0 8px 32px rgba(0,0,0,.15);z-index:9999;max-height:80vh;overflow-y:auto;font-family:Lexend,sans-serif;";
      panel.innerHTML = html;
      host = panel;
      if (attemptKey) host.dataset.lnAttemptKey = attemptKey;
      if (scoreFingerprint) host.dataset.lnScoreFingerprint = scoreFingerprint;
      wireInlineTts(panel);
    }
    if (!d.__fromCache) setTimeout(() => { try { host.scrollIntoView({ block: "start", behavior: "smooth" }); } catch {} }, 50);

    // Per-panel close
    host.querySelector(".ln-score-close")?.addEventListener("click", () => host.remove());

    // Per-panel collapse toggle (chevron + header click)
    (() => {
      const toggleBtn = host.querySelector(".ln-score-toggle");
      const header = host.querySelector(".ln-score-header");
      const body = host.querySelector(".ln-score-body");
      if (!toggleBtn || !body) return;
      const storeKey = "ln.scoreCollapsed:" + encodeURIComponent(getQuestionFromPage());
      const startCollapsed = (() => { try { return localStorage.getItem(storeKey) === "1"; } catch { return false; } })();
      const apply = (collapsed) => {
        body.style.display = collapsed ? "none" : "";
        toggleBtn.textContent = collapsed ? "▶" : "▼";
        try { localStorage.setItem(storeKey, collapsed ? "1" : "0"); } catch {}
      };
      apply(startCollapsed);
      const toggle = (ev) => {
        if (ev.target.closest(".ln-user-audio-btn") || ev.target.closest(".ln-tw") || ev.target.closest(".ln-fix")) return;
        ev.stopPropagation();
        apply(body.style.display !== "none");
      };
      toggleBtn.addEventListener("click", toggle);
      header?.addEventListener("click", toggle);
    })();

    // Wire "chi tiết" buttons — each opens a stacked detail block in the RIGHT AI panel
    host.querySelectorAll(".ln-crit-btn").forEach(b => {
      b.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        showCriteriaDetail(b.dataset.crit, d);
      });
    });

    // Wire ▶ "play user recording" button on the transcript row
    const playUserBtn = host.querySelector(".ln-user-audio-btn");
    if (playUserBtn) {
      playUserBtn.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        playUserAudio(d, host, playUserBtn);
      });
      if (!d.audioUrl && !d.audioDataUrl) {
        // No recording available — fall back to TTS of the transcript
        playUserBtn.title = "Bản ghi gốc không có, dùng giọng TTS";
        playUserBtn.dataset.fallbackTts = "1";
      }
    }

    // Wire "Nghe theo từ" — fetches word-level timestamps then plays with highlighting
    const wordSyncBtn = host.querySelector(".ln-word-sync-btn");
    if (wordSyncBtn) {
      wordSyncBtn.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        playWordSync(d, host, wordSyncBtn);
      });
    }
  }

  // ──────────────── Audio playback helpers ────────────────
  // Holds a single active audio element + the button driving it.
  const LN_AUDIO = { el: null, btn: null };

  function playUserAudio(d, host, btn) {
    // Toggle: clicking the SAME button while ANY playback (audio OR TTS) is active → stop.
    if (btn && (LN_AUDIO.btn === btn || LN_TTS.btn === btn)) {
      stopAllAudio();
      return;
    }
    // Different button (or first play) → stop whatever is currently playing, then start ours
    stopAllAudio();
    const src = d.audioUrl || d.audioDataUrl;
    if (!src) {
      // No recording in memory (cached restore) — fall back to TTS, same button receives the pulse
      speakText(d.transcript || d.rewrittenAnswer || "", btn);
      return;
    }
    const a = new Audio(src);
    LN_AUDIO.el = a;
    LN_AUDIO.btn = btn || null;
    if (btn) setBtnPlaying(btn, true);
    const reset = () => {
      if (LN_AUDIO.btn === btn) { setBtnPlaying(btn, false); LN_AUDIO.btn = null; LN_AUDIO.el = null; }
    };
    a.onended = reset;
    a.onpause = reset;
    a.play().catch(err => { if (btn) setBtnPlaying(btn, false); console.warn("[LN-Audio] play failed", err); });
  }

  async function playWordSync(d, host, btn) {
    const transcriptEl = host.querySelector(".ln-user-transcript");
    if (!transcriptEl) return;

    // Toggle: clicking the SAME button while any playback is active → stop
    if (LN_AUDIO.btn === btn || LN_TTS.btn === btn) {
      stopAllAudio();
      return;
    }
    const src = d.audioUrl || d.audioDataUrl;
    if (!src) { alert("Bản ghi của bạn không còn trong bộ nhớ, hãy ghi lại để dùng tính năng này."); return; }

    // Different button (or first time) → stop whatever else is playing first
    stopAllAudio();

    btn.disabled = true;
    const originalLabel = btn.innerHTML;
    btn.innerHTML = "<span>⏳</span><span>Đang tạo timestamp...</span>";

    // 1) Get word timings — check in-memory cache, then localStorage (3-day TTL), then API
    const WS_TTL = 3 * 24 * 60 * 60 * 1000; // 3 days
    const wsQuestion = (typeof getQuestionFromPage === "function" ? getQuestionFromPage() : "") || "";
    const wsTranscript = (d.transcript || "").trim();
    const wsCacheKey = "ln.wordSync:" + encodeURIComponent(wsQuestion) + ":" + encodeURIComponent(wsTranscript.slice(0, 120));

    let timings = d.wordTimings;
    // Try localStorage if not in memory
    if (!Array.isArray(timings) || !timings.length) {
      try {
        const cached = JSON.parse(localStorage.getItem(wsCacheKey));
        if (cached && Array.isArray(cached.t) && cached.t.length && (Date.now() - cached.ts < WS_TTL)) {
          timings = cached.t;
          d.wordTimings = timings;
        }
      } catch {}
    }
    // Call API if still no timings. KHÔNG chặn lâu: nếu Gemini chậm/timeout/rỗng
    // (hay gặp với audio Part 2 dài) thì bỏ qua và sẽ TỰ SINH mốc bên dưới để
    // highlight vẫn chạy — không alert rồi thoát như trước (gây "bấm mà không thấy gì").
    if (!Array.isArray(timings) || !timings.length) {
      const b64 = (d.audioDataUrl || "").split(",")[1] || "";
      if (b64) {
        const wtMime = (d.audioDataUrl?.match(/^data:([^;]+);/) || [])[1] || d.mimeType || "audio/webm";
        const ctrl = new AbortController();
        const wtTimer = setTimeout(() => ctrl.abort(), 12000);
        try {
          const r = await realFetch("/api/gemini/word-timings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: ctrl.signal,
            body: JSON.stringify({ apiKey: getKey(), audioBase64: b64, mimeType: wtMime, transcript: d.transcript || "" })
          });
          const j = await r.json();
          timings = Array.isArray(j.wordTimings) ? j.wordTimings : [];
          d.wordTimings = timings;
          if (timings.length) {
            try { localStorage.setItem(wsCacheKey, JSON.stringify({ t: timings, ts: Date.now() })); } catch {}
          }
        } catch (e) {
          console.warn("[word-sync] timings fetch failed, dùng mốc tự sinh:", e?.message || e);
          timings = [];
        } finally {
          clearTimeout(wtTimer);
        }
      }
    }

    // 2) Collect the position-tagged word spans (built by buildAnnotatedTranscript).
    //    Each <span.ln-tw[data-word-idx]> is exactly ONE original spoken word.
    const wordSpans = [...transcriptEl.querySelectorAll("span.ln-tw[data-word-idx]")];
    if (!wordSpans.length) {
      btn.innerHTML = originalLabel; btn.disabled = false;
      alert("Không tìm thấy các từ để highlight.");
      return;
    }

    // 3) Align timings → wordSpans by WORD TEXT (not just index) for robustness.
    //    Gemini may skip filler words or merge punctuation; align by walking both lists
    //    and matching normalized text. Spans without a matching timing stay un-highlighted.
    const norm = s => String(s || "").toLowerCase().replace(/[^a-z']/gi, "");
    const spanInfo = wordSpans.map(sp => ({ el: sp, word: sp.dataset.wordText || norm(sp.textContent) }));
    const alignedTimings = new Array(wordSpans.length).fill(null);
    let ti = 0;
    for (let si = 0; si < spanInfo.length && ti < timings.length; si++) {
      const want = spanInfo[si].word;
      if (!want) continue;
      // Search up to 3 ahead in timings for a matching word
      let found = -1;
      for (let k = 0; k < 3 && ti + k < timings.length; k++) {
        if (norm(timings[ti + k].word) === want) { found = ti + k; break; }
      }
      if (found >= 0) {
        // Clone để rescale không làm hỏng object trong cache/localStorage (chung tham chiếu).
        alignedTimings[si] = { ...timings[found] };
        ti = found + 1;
      } else {
        // No match within window — assign next available timing
        alignedTimings[si] = { ...timings[ti] };
        ti++;
      }
    }

    btn.innerHTML = "<span>⏸️</span><span>Đang phát...</span>";
    btn.classList.add("ln-playing");

    // 4) Use rAF loop driven by audio.currentTime — more accurate than setTimeout
    const a = new Audio(src);
    LN_AUDIO.el = a;
    LN_AUDIO.btn = btn;
    let rafId = null;
    const HIGHLIGHT_BG = "#fffbe6";
    const HIGHLIGHT_OUT = "2px solid #d9381e";
    let currentIdx = -1;

    // Số mốc thật (non-null) từ Gemini. Part 2 audio dài hay khiến API word-timings
    // (sync, cap 26s) timeout -> mảng rỗng -> không highlight gì. Khi thiếu mốc, ta
    // TỰ SINH mốc đều theo độ dài từng từ trải trên độ dài audio thật để karaoke vẫn chạy.
    const realTimingCount = alignedTimings.filter(Boolean).length;
    const needSynthetic = realTimingCount < Math.max(2, Math.floor(wordSpans.length * 0.5));

    const resolveRealMs = () => {
      let realMs = Number(d.durationMs || d.audio_duration_ms || 0);
      if (!(realMs > 0) && isFinite(a.duration) && a.duration > 0) realMs = a.duration * 1000;
      if (!(realMs > 0)) realMs = wordSpans.length * 380; // ước lượng cuối: ~0.38s/từ
      return realMs;
    };

    let prepared = false;
    const prepareTimings = () => {
      if (prepared) return;
      const realMs = resolveRealMs();
      if (needSynthetic) {
        // Sinh mốc tỉ lệ theo độ dài ký tự từng từ, trải đều trên [0, realMs].
        const lens = wordSpans.map(sp => Math.max(1, (sp.textContent || "").trim().length));
        const total = lens.reduce((a, b) => a + b, 0) || 1;
        let acc = 0;
        for (let i = 0; i < wordSpans.length; i++) {
          const start = (acc / total) * realMs;
          acc += lens[i];
          alignedTimings[i] = { startMs: start, endMs: (acc / total) * realMs };
        }
      } else {
        // Ép startMs không giảm (tránh nhảy lùi) rồi rescale tuyến tính về độ dài thật.
        let prev = -Infinity;
        for (const t of alignedTimings) {
          if (!t) continue;
          let s = Number(t.startMs ?? t.start ?? 0);
          if (!(s >= prev)) s = prev;
          if (t.startMs != null) t.startMs = s; else t.start = s;
          prev = s;
        }
        let lastEnd = 0;
        for (const t of alignedTimings) {
          if (!t) continue;
          const e = Number(t.endMs ?? t.end ?? t.startMs ?? t.start ?? 0);
          if (e > lastEnd) lastEnd = e;
        }
        if (lastEnd > 0) {
          const scale = realMs / lastEnd;
          if (scale > 0.4 && scale < 2.5 && Math.abs(scale - 1) > 0.04) {
            for (const t of alignedTimings) {
              if (!t) continue;
              if (t.startMs != null) t.startMs = Number(t.startMs) * scale;
              if (t.endMs != null) t.endMs = Number(t.endMs) * scale;
              if (t.start != null) t.start = Number(t.start) * scale;
              if (t.end != null) t.end = Number(t.end) * scale;
            }
          }
        }
      }
      prepared = true;
    };
    if (a.readyState >= 1) prepareTimings();
    else a.addEventListener("loadedmetadata", prepareTimings, { once: true });

    const clearAll = () => {
      wordSpans.forEach(s => { s.style.outline = ""; s.style.backgroundColor = ""; s.style.borderRadius = ""; });
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      currentIdx = -1;
    };

    const tick = () => {
      if (!prepared) prepareTimings();
      const tMs = a.currentTime * 1000;
      // Karaoke LIÊN TỤC: luôn sáng TỪ vừa bắt đầu gần nhất (start <= thời điểm hiện
      // tại). Chỉ phụ thuộc startMs (endMs của Gemini rất nhiễu) -> ít lệch hơn, và
      // KHÔNG còn khoảng "tắt highlight" giữa các từ khiến cảm giác giật/sai nhịp.
      // Cho phép sáng sớm 80ms để bù độ trễ render + lệch nhỏ của Gemini.
      const LEAD_MS = 80;
      let activeIdx = -1;
      for (let i = 0; i < alignedTimings.length; i++) {
        const t = alignedTimings[i];
        if (!t) continue;
        const start = Number(t.startMs ?? t.start ?? 0);
        if (start - LEAD_MS <= tMs) activeIdx = i; // lấy index lớn nhất đã bắt đầu
      }
      if (activeIdx !== currentIdx) {
        if (currentIdx >= 0) {
          wordSpans[currentIdx].style.outline = "";
          wordSpans[currentIdx].style.backgroundColor = "";
        }
        if (activeIdx >= 0) {
          const sp = wordSpans[activeIdx];
          sp.style.outline = HIGHLIGHT_OUT;
          sp.style.backgroundColor = HIGHLIGHT_BG;
          sp.style.borderRadius = ".2rem";
          sp.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
        }
        currentIdx = activeIdx;
      }
      if (!a.paused && !a.ended) rafId = requestAnimationFrame(tick);
    };

    const resetBtn = () => {
      btn.innerHTML = originalLabel;
      btn.disabled = false;
      btn.classList.remove("ln-playing");
      if (LN_AUDIO.btn === btn) { LN_AUDIO.btn = null; LN_AUDIO.el = null; }
    };
    a.onplay = () => { rafId = requestAnimationFrame(tick); };
    a.onended = () => { clearAll(); resetBtn(); };
    a.onpause = () => { clearAll(); resetBtn(); };
    a.play().catch(err => {
      clearAll();
      resetBtn();
      alert("Không phát được audio: " + err.message);
    });
  }

  // ──────────────── Criterion detail panel (right side) ────────────────
  const CRIT_META = {
    fluency:      { vi: "Trôi chảy",  en: "fluency",      color: "#d9381e", badgeBg: "#d9381e" },
    vocabulary:   { vi: "Từ vựng",    en: "vocabulary",   color: "#d9381e", badgeBg: "#d9381e" },
    grammar:      { vi: "Ngữ pháp",   en: "grammar",      color: "#d9381e", badgeBg: "#d9381e" },
    pronunciation:{ vi: "Phát âm",    en: "pronunciation",color: "#d9381e", badgeBg: "#d9381e" },
  };

  // Color a transcript word by severity (heavy=red, light=yellow)
  function escHtml(s) { return String(s||"").replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

  // Render transcript with inline error highlights — strikethrough on wrong tokens,
  // green replacement chips next to them. Colors: grammar=red, vocab=yellow, spelling=red.
  // EVERY original spoken word gets wrapped in <span class="ln-tw" data-word-idx="N">
  // so the "Nghe theo từ" feature can highlight by index without confusion from fix-spans.
  function buildAnnotatedTranscript(d) {
    const text = d.transcript || d.rewrittenAnswer || "";
    if (!text) return escHtml(text);
    const tokens = text.split(/(\s+)/); // keep whitespace tokens

    const norm = w => String(w || "").toLowerCase().replace(/[^a-zàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ']/gi, "");

    const idx2issues = new Map();
    const wordQueues = new Map();

    const palettes = {
      grammar:    { bg:"#ffffff", color:"var(--red)", fixBg:"#fffbe6", fixColor:"#171717" },
      vocabulary: { bg:"#fef3c7", color:"#92400e", fixBg:"#fffbe6", fixColor:"#171717" },
      spelling:   { bg:"#fecdd3", color:"#9f1239", fixBg:"#fffbe6", fixColor:"#171717" },
    };

    const wordTokens = tokens.filter(t => !/^\s+$/.test(t));
    const addIssues = (arr, kindKey) => {
      (Array.isArray(arr) ? arr : []).forEach(it => {
        const palette = palettes[kindKey];
        const idx = (typeof it?.wordIndex === "number" && it.wordIndex >= 0) ? it.wordIndex : -1;
        const wantNorm = norm(it.original);
        const okAtIdx = idx >= 0 && idx < wordTokens.length && (!wantNorm || norm(wordTokens[idx]) === wantNorm);
        if (okAtIdx) {
          if (!idx2issues.has(idx)) idx2issues.set(idx, []);
          idx2issues.get(idx).push({ ...it, palette });
        } else if (wantNorm) {
          if (!wordQueues.has(wantNorm)) wordQueues.set(wantNorm, []);
          wordQueues.get(wantNorm).push({ ...it, palette });
        }
      });
    };
    addIssues(d.grammarIssues, "grammar");
    addIssues(d.vocabularyIssues, "vocabulary");
    addIssues(d.spellingIssues, "spelling");

    const renderIssueInner = (tokRaw, it) => {
      const orig = escHtml(it.original || tokRaw);
      const suggestion = (it.suggestion || "").trim();
      const tip = escHtml(it.explanation || it.kind || "");
      const wrong = `<span title="${tip}" style="background:${it.palette.bg};color:${it.palette.color};text-decoration:line-through;padding:0 .15rem;border-radius:.2rem;">${orig}</span>`;
      if (!suggestion) return wrong;
      const fix = `<span title="${tip}" style="background:${it.palette.fixBg};color:${it.palette.fixColor};padding:0 .25rem;border-radius:.2rem;margin-left:.15rem;font-weight:600;">${escHtml(suggestion)}</span>`;
      return wrong + fix;
    };

    let wordIdx = -1;
    return tokens.map(tok => {
      if (/^\s+$/.test(tok)) return tok;
      wordIdx++;
      // Direct-index match
      let inner;
      const issues = idx2issues.get(wordIdx);
      if (issues?.length) {
        inner = renderIssueInner(tok, issues[0]);
      } else {
        // Fallback: queue by normalized word
        const key = norm(tok);
        const q = wordQueues.get(key);
        inner = (q?.length) ? renderIssueInner(tok, q.shift()) : escHtml(tok);
      }
      // ALWAYS wrap with a position-tagged span so word-sync can target it.
      // The wrapper is transparent until the word-sync feature highlights it.
      return `<span class="ln-tw" data-word-idx="${wordIdx}" data-word-text="${escHtml(norm(tok))}">${inner}</span>`;
    }).join("");
  }

  function buildPronunciationTranscript(d) {
    const transcript = d.transcript || d.rewrittenAnswer || "";
    if (!transcript) return "<i>Chưa có transcript.</i>";
    const issues = Array.isArray(d.pronunciationIssues) ? d.pronunciationIssues : [];
    const issueMap = new Map();
    issues.forEach(it => { if (it.word) issueMap.set(String(it.word).toLowerCase().replace(/[^a-zàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ']/gi,""), it); });
    const tokens = transcript.split(/(\s+)/);
    return tokens.map(tok => {
      if (/^\s+$/.test(tok)) return tok;
      const key = tok.toLowerCase().replace(/[^a-z']/g, "");
      const hit = issueMap.get(key);
      if (!hit) return escHtml(tok);
      const isHeavy = (hit.severity || "").toLowerCase() === "heavy";
      const color = isHeavy ? "var(--red)" : "var(--ink)";
      const phon = hit.targetSound ? ` <span class="ln-phon" data-word="${escHtml(tok)}" data-phon="${escHtml(hit.targetSound)}" style="color:${color};font-style:italic;font-size:.85em;background:#fef3c7;padding:0 .25rem;border-radius:.25rem;cursor:pointer;">/${escHtml(hit.targetSound)}/</span>` : "";
      return `<span class="ln-pron-word" data-word="${escHtml(tok)}" data-phon="${escHtml(hit.targetSound||"")}" data-severity="${isHeavy?"heavy":"light"}" style="text-decoration:underline wavy ${color};text-underline-offset:3px;cursor:pointer;color:${color};font-weight:500;">${escHtml(tok)}</span>${phon}`;
    }).join("");
  }

  // Build fluency transcript with pause-length indicators between words.
  // Uses d.fluencyPauses [{wordIndex, durationMs, label}] to size each gap.
  // label: short ≈ tiny gray dot · | medium ≈ amber dot ● | long ≈ red triple dot ●●●
  function buildFluencyTranscript(d) {
    const t = d.transcript || d.rewrittenAnswer || "";
    if (!t) return "<i>Chưa có transcript.</i>";
    const words = t.trim().split(/\s+/);
    const pauses = Array.isArray(d.fluencyPauses) ? d.fluencyPauses : [];
    const pauseAt = new Map();
    pauses.forEach(p => { if (typeof p.wordIndex === "number") pauseAt.set(p.wordIndex, p); });

    function gapHtml(p) {
      // Short pause (default between words) — small but clearly visible
      if (!p) return ' <span style="color:#6b7280;font-weight:700;font-size:.9em;">•</span> ';
      const lbl = (p.label || "").toLowerCase();
      const ms = p.durationMs || 0;
      if (lbl === "long" || ms >= 1000) {
        return ` <span title="Nghỉ dài ${ms}ms" style="color:var(--red);font-weight:900;letter-spacing:.15em;font-size:1.05em;">●●●</span> `;
      }
      if (lbl === "medium" || ms >= 400) {
        return ` <span title="Nghỉ vừa ${ms}ms" style="color:#ea580c;font-weight:900;letter-spacing:.1em;font-size:1em;">●●</span> `;
      }
      return ` <span title="Nghỉ ngắn ${ms}ms" style="color:#6b7280;font-weight:700;font-size:.9em;">•</span> `;
    }

    return words.map((w, i) => {
      const wordSpan = `<span style="display:inline-block;">${escHtml(w)}</span>`;
      if (i === words.length - 1) return wordSpan;
      return wordSpan + gapHtml(pauseAt.get(i));
    }).join("");
  }

  function showCriteriaDetail(critKind, d) {
    const meta = CRIT_META[critKind]; if (!meta) return;
    const c = (d.criteria || {})[critKind] || {};
    const score = floorBand(c.score);
    const feedback = c.feedback || "";
    const isPron = critKind === "pronunciation";

    let bodyHtml;
    if (isPron) {
      bodyHtml = `
        <div style="font-size:.82rem;line-height:1.9;background:#fffbeb;border:1px solid #fde68a;border-radius:.5rem;padding:.6rem .8rem;">
          ${buildPronunciationTranscript(d)}
        </div>
        <div style="display:flex;justify-content:flex-end;gap:.8rem;font-size:.7rem;color:#6b7280;margin-top:.4rem;">
          <span><span style="display:inline-block;width:.6rem;height:.6rem;background:var(--ink);border-radius:50%;margin-right:.2rem;"></span>Lỗi nhẹ</span>
          <span><span style="display:inline-block;width:.6rem;height:.6rem;background:var(--red);border-radius:50%;margin-right:.2rem;"></span>Lỗi nặng</span>
        </div>`;
    } else if (critKind === "fluency") {
      const pauses = Array.isArray(d.fluencyPauses) ? d.fluencyPauses : [];
      const nLong = pauses.filter(p => (p.label||"").toLowerCase() === "long" || (p.durationMs||0) >= 1000).length;
      const nMed  = pauses.filter(p => (p.label||"").toLowerCase() === "medium" || ((p.durationMs||0) >= 400 && (p.durationMs||0) < 1000)).length;
      bodyHtml = `
        ${feedback ? `<div style="font-size:.78rem;color:#6b7280;margin-bottom:.5rem;line-height:1.55;">${escHtml(feedback)}</div>` : ""}
        <div style="font-size:.85rem;line-height:2.1;background:#fafafa;border:1px solid #e5e7eb;border-radius:.5rem;padding:.7rem .9rem;">${buildFluencyTranscript(d)}</div>
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:.5rem;font-size:.7rem;color:#6b7280;margin-top:.5rem;">
          <div style="display:flex;gap:1rem;flex-wrap:wrap;">
            <span><span style="color:#6b7280;font-weight:700;">•</span> Nghỉ ngắn</span>
            <span><span style="color:#ea580c;font-weight:900;">●●</span> Nghỉ vừa${nMed?` (${nMed})`:""}</span>
            <span><span style="color:var(--red);font-weight:900;">●●●</span> Nghỉ dài${nLong?` (${nLong})`:""}</span>
          </div>
        </div>`;
    } else {
      bodyHtml = `<div style="font-size:.82rem;line-height:1.6;color:#374151;">${escHtml(feedback || "Chưa có nhận xét chi tiết.")}</div>`;
    }

    const block = document.createElement("div");
    block.dataset.lnKind = "criteria-" + critKind;
    block.style.cssText = "border:1px solid #e5e7eb;border-radius:.6rem;padding:.7rem .8rem;margin-bottom:.6rem;background:white;";
    block.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem;gap:.5rem;">
        <div style="font-weight:700;font-size:.92rem;color:#171717;">${meta.vi} <span style="font-weight:400;color:#9ca3af;font-size:.78rem;">(${meta.en})</span></div>
        <div style="display:flex;align-items:center;gap:.4rem;">
          <span style="background:${meta.badgeBg};color:white;font-size:.7rem;font-weight:600;padding:.2rem .6rem;border-radius:9999px;">Band ${score}</span>
          <button class="ln-crit-close" style="background:none;border:none;cursor:pointer;color:#9ca3af;font-size:1rem;line-height:1;">×</button>
        </div>
      </div>
      ${bodyHtml}`;

    const right = getRightPanelContent();
    if (right) {
      // Remove duplicate of same criterion if exists, then prepend new
      right.querySelector(`[data-ln-kind="criteria-${critKind}"]`)?.remove();
      right.prepend(block);
    } else {
      document.body.appendChild(block);
      block.style.cssText += "position:fixed;right:1rem;top:5rem;width:380px;background:white;box-shadow:0 8px 32px rgba(0,0,0,.15);z-index:9999;";
    }

    block.querySelector(".ln-crit-close").addEventListener("click", () => block.remove());

    // Wire word-click → practice popup (pronunciation panel only)
    if (isPron) {
      block.querySelectorAll(".ln-pron-word, .ln-phon").forEach(w => {
        w.addEventListener("click", (e) => {
          e.preventDefault(); e.stopPropagation();
          openWordPracticeModal(w.dataset.word, w.dataset.phon);
        });
      });
    }
  }

  // Pop-up: click a flagged word → practice + score THIS single word.
  // Has its OWN recorder + scoring. Result lives only inside the modal — never saved to localStorage,
  // never affects the main scoring history.
  // Expose globally so other modules (pronun-tabs.js, reading.js) can open it.
  window.openWordPracticeModal = function (word, phon) { return openWordPracticeModal(word, phon); };
  function openWordPracticeModal(word, phon) {
    document.getElementById("ln-word-modal")?.remove();
    // Look up the word in LuyenDoc 20K dict to get target IPA + grapheme breakdown
    let dictEntry = null;
    try { dictEntry = (typeof window.lnLookupDict === "function") ? window.lnLookupDict(word) : null; } catch {}
    const targetIpa = dictEntry?.ipa ? "/" + dictEntry.ipa + "/" : (phon ? "/" + phon + "/" : "");
    // Build full grapheme IPA breakdown for the word (Smart IPA style)
    let graphemeBreakdown = "";
    if (dictEntry?.graph2I?.length) {
      let pos = 0;
      const parts = [];
      for (const g of dictEntry.graph2I) {
        const len = (g.grapheme || "").length;
        if (len === 0) continue;
        const slice = word.slice(pos, pos + len);
        if (g.ipa) {
          parts.push(`<ruby style="color:#d9381e;">${escHtml(slice)}<rt style="color:#d9381e;font-size:.55em;font-weight:700;font-family:'Segoe UI Symbol','Segoe UI',sans-serif;">${escHtml(g.ipa)}</rt></ruby>`);
        } else {
          parts.push(escHtml(slice));
        }
        pos += len;
      }
      graphemeBreakdown = `<div style="font-size:1.5rem;font-weight:700;color:#171717;line-height:2.5;">${parts.join("")}</div>`;
    }
    const ov = document.createElement("div");
    ov.id = "ln-word-modal";
    ov.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:99998;display:flex;align-items:center;justify-content:center;font-family:Lexend,sans-serif;";
    ov.innerHTML = `
      <div style="background:white;border-radius:1rem;box-shadow:0 20px 60px rgba(0,0,0,.3);width:100%;max-width:460px;padding:1.4rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem;">
          <div style="font-size:.85rem;color:#6b7280;">🎤 Luyện phát âm <span style="color:#9ca3af;font-size:.7rem;">(không lưu)</span></div>
          <button id="ln-word-x" style="background:none;border:none;font-size:1.3rem;cursor:pointer;color:#9ca3af;">×</button>
        </div>
        <div style="text-align:center;padding:.6rem 0 .8rem;">
          <button class="ln-tts-btn" data-text="${escHtml(word)}" style="background:transparent;border:2px solid #171717;color:#171717;border-radius:50%;width:2.2rem;height:2.2rem;cursor:pointer;font-size:.9rem;display:inline-flex;align-items:center;justify-content:center;margin-bottom:.4rem;">▶</button>
          ${graphemeBreakdown || `<div style="font-size:1.5rem;font-weight:700;color:#171717;">${escHtml(word)}</div>`}
          ${targetIpa ? `<div style="font-family:'Segoe UI Symbol','Segoe UI',sans-serif;color:#d9381e;font-size:1.05rem;font-weight:600;margin-top:.3rem;letter-spacing:.02em;">${escHtml(targetIpa)}</div>` : ""}
        </div>
        <div id="ln-word-status" style="text-align:center;color:#6b7280;font-size:.85rem;padding:.6rem .5rem;">
          Nhấn nút <b style="color:#d9381e;">Ghi âm</b> rồi đọc đúng 1 lần từ/cụm này.
        </div>
        <div id="ln-word-result" style="display:none;background:#ffffff;border-radius:.6rem;padding:.7rem .8rem;margin-bottom:.6rem;"></div>
        <div style="display:flex;justify-content:center;gap:.5rem;">
          <button id="ln-word-rec" class="ln-word-action" style="background:#d9381e;color:#fff !important;border:none;border-radius:9999px;padding:.6rem 1.4rem;font-weight:600;font-family:inherit;cursor:pointer;">● Ghi âm</button>
          <button id="ln-word-stop" class="ln-word-action" style="background:var(--red);color:#fff !important;border:none;border-radius:9999px;padding:.6rem 1.4rem;font-weight:600;font-family:inherit;cursor:pointer;display:none;">■ Dừng & chấm</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => { if (e.target === ov) ov.remove(); });
    ov.querySelector("#ln-word-x").addEventListener("click", () => ov.remove());
    wireInlineTts(ov);
    speakText(word, ov.querySelector(".ln-tts-btn"));

    let mediaRec = null, chunks = [], stream = null;
    const status = ov.querySelector("#ln-word-status");
    const result = ov.querySelector("#ln-word-result");
    const recBtn = ov.querySelector("#ln-word-rec");
    const stopBtn = ov.querySelector("#ln-word-stop");

    recBtn.addEventListener("click", async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = [];
        mediaRec = new MediaRecorder(stream);
        mediaRec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
        mediaRec.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(chunks, { type: chunks[0]?.type || "audio/webm" });
          const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(",")[1]); fr.readAsDataURL(blob); });
          status.innerHTML = '<span style="display:inline-block;width:.8rem;height:.8rem;border:2px solid #d9381e;border-top-color:transparent;border-radius:50%;animation:ln-spin 1s linear infinite;margin-right:.3rem;"></span> Đang chấm điểm...';
          try {
            const r = await realFetch("/api/gemini/score-word", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ apiKey: getKey(), model: getModel(), word, targetPhonetic: phon, audioBase64: b64, mimeType: blob.type })
            });
            const d = await r.json();
            const sc = (typeof d.score === "number") ? d.score : "?";
            const color = sc === "?" ? "#6b7280" : sc >= 75 ? "var(--yellow)" : sc >= 60 ? "var(--ink)" : "var(--red)";
            status.innerHTML = "";
            result.style.display = "block";
            result.innerHTML = `
              <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.4rem;">
                <div style="background:${color};color:white;font-weight:700;font-size:1.1rem;width:2.6rem;height:2.6rem;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${sc}</div>
                <div style="flex:1;">
                  <div style="font-weight:600;color:#171717;font-size:.88rem;">${escHtml(d.verdict || "")}</div>
                  ${d.phoneticHeard ? `<div style="font-size:.78rem;color:#6b7280;">Bạn đọc: <span style="color:${color};font-style:italic;">/${escHtml(d.phoneticHeard)}/</span></div>` : ""}
                </div>
              </div>
              ${d.tips ? `<div style="font-size:.78rem;color:#374151;background:white;border-radius:.4rem;padding:.4rem .6rem;">💡 ${escHtml(d.tips)}</div>` : ""}
            `;
          } catch (err) {
            status.textContent = "❌ Lỗi: " + err.message;
          }
        };
        mediaRec.start();
        status.textContent = "🔴 Đang ghi âm... đọc từ rồi bấm Dừng & chấm.";
        recBtn.style.display = "none";
        stopBtn.style.display = "inline-flex";
      } catch (err) {
        status.textContent = "❌ Không truy cập được mic: " + err.message;
      }
    });

    stopBtn.addEventListener("click", () => {
      if (mediaRec && mediaRec.state !== "inactive") mediaRec.stop();
      stopBtn.style.display = "none";
      recBtn.style.display = "inline-flex";
      recBtn.textContent = "● Ghi lại";
    });
  }

  // ── Double-click guard helpers (used by every async button action) ──
  function lnLoadingLabel(kind) {
    if (kind === "vocab")  return "Đang lấy từ vựng…";
    if (kind === "sample") return "Đang viết câu mẫu…";
    if (kind === "note")   return "Đang viết từ ghi chú…";
    if (kind === "pronun") return "Đang chuẩn bị phát âm…";
    return "Đang xử lý…";
  }
  function markBusy(btn, kind) {
    if (!btn) return null;
    if (btn.__lnBusy) return false; // already running — caller must bail
    btn.__lnBusy = true;
    btn.__lnOrigInner = btn.innerHTML;
    btn.__lnOrigPointer = btn.style.pointerEvents;
    btn.setAttribute("aria-busy", "true");
    btn.setAttribute("disabled", "1");
    btn.style.pointerEvents = "none";
    btn.style.opacity = ".7";
    btn.style.cursor = "wait";
    btn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:.35rem;justify-content:center;"><span style="display:inline-block;width:.85rem;height:.85rem;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:ln-spin .9s linear infinite;flex-shrink:0;"></span><span>${lnLoadingLabel(kind)}</span></span>`;
    return true;
  }
  function unmarkBusy(btn) {
    if (!btn) return;
    btn.__lnBusy = false;
    btn.removeAttribute("aria-busy");
    btn.removeAttribute("disabled");
    btn.style.pointerEvents = btn.__lnOrigPointer || "";
    btn.style.opacity = "";
    btn.style.cursor = "";
    if (btn.__lnOrigInner != null) btn.innerHTML = btn.__lnOrigInner;
  }

  async function assistGemini(kind, btn) {
    // API key check
    const key = getKey();
    if (!key) {
      let keys = [];
      try { const stored = localStorage.getItem("luyennoi.geminiKeys"); keys = stored ? JSON.parse(stored) : []; } catch {}
      if (!keys.length) {
        location.href = `/settings?next=${encodeURIComponent(location.pathname + location.search)}`;
        return;
      }
    }
    if (btn && markBusy(btn, kind) === false) return; // guard: already running
    try {
      const question = getQuestionFromPage();
      const note = getNoteFromPage();

      const r = await realFetch("/api/gemini/assist", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ apiKey: key, model: getModel(), kind, topic: question, note, part: (location.pathname.match(/PART%20(\d)|PART\s*(\d)/i)||[])[1] || (location.pathname.match(/PART%20(\d)|PART\s*(\d)/i)||[])[2] || "" })
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const data = await r.json();
      showAssistResult(data, kind);
    } catch (e) {
      alert("Lỗi Gemini: " + e.message);
    } finally {
      unmarkBusy(btn);
    }
  }

  function getQuestionFromPage() {
    // Detail pages must use the route question as the stable cache key.
    // Breadcrumbs can contain extra controls such as "Phiên âm", which breaks score restore.
    const detail = parseDetailRoute?.();
    if (detail?.question) return detail.question.trim();

    // Try breadcrumb last item, then h1/h2, then URL
    const bc = document.querySelector(".breadcrumbs li:last-child, [class*=breadcrumb] li:last-child");
    if (bc?.innerText?.trim()) return bc.innerText.trim();
    const h = document.querySelector("h1,h2,[class*=question-title]");
    if (h?.innerText?.trim()) return h.innerText.trim();
    const p = decodeURIComponent(location.pathname.split("~")[1] || "");
    return p || "this topic";
  }

  function getScoreHistoryCandidates(question) {
    const exactKey = "ln.scoreHistory:" + encodeURIComponent(question);
    const out = [exactKey];
    try {
      const q = String(question || "").trim().toLowerCase();
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith("ln.scoreHistory:") || key === exactKey) continue;
        const decoded = decodeURIComponent(key.slice("ln.scoreHistory:".length)).trim().toLowerCase();
        if (decoded && q && (decoded.includes(q) || q.includes(decoded))) out.push(key);
      }
    } catch {}
    return out;
  }

  function cleanupFakeScoreHistory() {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith("ln.scoreHistory:")) continue;
        let arr = [];
        try { arr = JSON.parse(localStorage.getItem(key) || "[]"); } catch { arr = []; }
        const real = arr.filter(item => {
          const modelName = String(item?.model || item?.provider || "");
          return item?.__realAttempt && item?.transcript && item?.criteria && !/local-fallback|mock/i.test(modelName);
        });
        if (real.length) saveBoundedScoreHistory(key, real);
        else localStorage.removeItem(key);
      }
    } catch {}
    try {
      const s = LN.state;
      const hist = Array.isArray(s.history) ? s.history : [];
      s.history = hist.filter(item => {
        const modelName = String(item?.model || item?.provider || "");
        return item?.__realAttempt && item?.transcript && item?.criteria && !/local-fallback|mock/i.test(modelName);
      });
      s.answered = s.history.length;
      s.todayAnswered = Math.min(s.todayAnswered || 0, s.history.length);
      LN.state = s;
    } catch {}
  }

  function getNoteFromPage() {
    const ta = document.getElementById("ln-note-input");
    if (ta) return ta.value.trim();
    return localStorage.getItem("ln.userNote") || "";
  }

  // Find the scrollable content area in the right panel (detail page)
  function getRightPanelContent() {
    // Walk all elements to find the one with w-2/5 class
    for (const el of document.querySelectorAll("*")) {
      if (Array.from(el.classList).includes("w-2/5")) {
        return el.querySelector(".flex-1.overflow-y-auto, .overflow-y-auto.flex-1, .flex-1") || el;
      }
    }
    return null;
  }

  function ttsBtn(text) {
    return `<button class="ln-tts-btn" data-text="${text.replace(/"/g,'&quot;')}" style="background:#d9381e;color:white;border:none;border-radius:50%;width:1.6rem;height:1.6rem;cursor:pointer;font-size:.7rem;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;" title="Nghe">▶</button>`;
  }

  // Inject playing-state CSS once
  (function injectPlayCss() {
    if (document.getElementById("ln-play-css")) return;
    const s = document.createElement("style");
    s.id = "ln-play-css";
    s.textContent = `
      @keyframes ln-pulse { 0%,100% { box-shadow:0 0 0 0 rgba(217,56,30,.55) } 50% { box-shadow:0 0 0 8px rgba(217,56,30,0) } }
      .ln-playing { animation: ln-pulse 1.1s ease-out infinite; position: relative; }
      .ln-playing::after { content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none; }
      /* Hide the "Bảng vàng" tab in the right panel — not used in our local clone */
      button[role="tab"]:has(> p) { /* defensive */ }

      /* Fix the squeezed "Lịch sử luyện tập" heading on /question-answer */
      h3.text-xl.font-semibold { white-space: nowrap; }
      /* Soften history entry cards */
      .group.relative.my-2.flex.min-h-\\[8rem\\] { border-color: #e5e7eb !important; transition: border-color .15s, box-shadow .15s; }
      .group.relative.my-2.flex.min-h-\\[8rem\\]:hover { border-color: #FFD700 !important; box-shadow: 0 2px 8px rgba(217,56,30,.07) !important; }
      /* Clamp long transcripts inside history entries so cards stay compact */
      .group.relative.my-2.flex.min-h-\\[8rem\\] p:not(:first-child) {
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
        font-style: normal !important;
      }
      /* The "Luyện lại câu này" link → make it actually look clickable */
      button.link-info.link, a.link-info.link {
        cursor: pointer;
        color: #d9381e !important;
        font-weight: 600;
      }
      button.link-info.link:hover, a.link-info.link:hover { text-decoration: underline; }
      .ln-score-panel,
      #ln-score-panel {
        max-width: 100% !important;
        overflow-wrap: anywhere !important;
      }
      .ln-score-panel .ln-score-header,
      #ln-score-panel .ln-score-header {
        min-width: 0 !important;
      }
      .ln-score-panel .ln-user-transcript,
      #ln-score-panel .ln-user-transcript {
        min-width: 0 !important;
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
      }
      .ln-score-panel .ln-score-toggle,
      .ln-score-panel .ln-score-close,
      #ln-score-panel .ln-score-toggle,
      #ln-score-panel .ln-score-close {
        min-width: 36px !important;
        min-height: 36px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      .ln-score-panel .ln-user-audio-btn,
      .ln-score-panel .ln-tts-btn,
      #ln-score-panel .ln-user-audio-btn,
      #ln-score-panel .ln-tts-btn {
        width: 40px !important;
        height: 40px !important;
        min-width: 40px !important;
        min-height: 40px !important;
      }
      .ln-score-panel .ln-word-sync-btn,
      #ln-score-panel .ln-word-sync-btn {
        min-height: 40px !important;
      }
      .ln-score-panel .ln-crit-btn,
      #ln-score-panel .ln-crit-btn {
        min-width: 72px !important;
        min-height: 38px !important;
        padding: .4rem .7rem !important;
      }
      #ln-rec-bar {
        flex-wrap: wrap !important;
        gap: .75rem !important;
        padding: .75rem .9rem calc(.75rem + env(safe-area-inset-bottom)) !important;
      }
      #ln-rec-submit,
      #ln-rec-cancel {
        min-height: 44px !important;
      }
      @media (max-width: 640px) {
        #ln-score-panel {
          left: 12px !important;
          right: 12px !important;
          top: calc(12px + env(safe-area-inset-top)) !important;
          width: auto !important;
          max-height: calc(100svh - 24px - env(safe-area-inset-top)) !important;
        }
        .ln-score-panel .ln-score-header,
        #ln-score-panel .ln-score-header {
          gap: .5rem !important;
          padding-right: 0 !important;
        }
        .ln-score-panel .ln-overall-score,
        #ln-score-panel .ln-overall-score {
          min-width: 2.35rem !important;
          width: 2.35rem !important;
          height: 2.35rem !important;
        }
        #ln-rec-bar {
          align-items: stretch !important;
        }
        #ln-rec-bar > * {
          min-width: 0 !important;
        }
        #ln-rec-submit,
        #ln-rec-cancel {
          flex: 1 1 140px !important;
        }
      }
    `;
    document.head.appendChild(s);
  })();

  // Remove the "Bảng vàng" tab button on every page (right-panel tab next to "AI hỗ trợ")
  function hideBangVangTab() {
    document.querySelectorAll('button[role="tab"]').forEach(btn => {
      const txt = (btn.textContent || "").trim();
      if (/^Bảng vàng/i.test(txt) && !btn.__lnBvHidden) {
        btn.__lnBvHidden = true;
        btn.style.display = "none";
      }
    });
  }

  // Track the single currently-playing TTS button so we can toggle it
  const LN_TTS = { btn: null, utterance: null };

  function setBtnPlaying(btn, playing, pauseGlyph = "⏸") {
    if (!btn) return;
    if (playing) {
      btn.classList.add("ln-playing");
      if (btn.dataset.lnOrigHtml == null) btn.dataset.lnOrigHtml = btn.innerHTML;
      btn.innerHTML = pauseGlyph;
    } else {
      btn.classList.remove("ln-playing");
      if (btn.dataset.lnOrigHtml != null) {
        btn.innerHTML = btn.dataset.lnOrigHtml;
        delete btn.dataset.lnOrigHtml;
      }
    }
  }

  // Stop EVERY kind of audio (TTS + recorded playback) and clear button states.
  function stopAllAudio() {
    try { window.speechSynthesis?.cancel(); } catch {}
    if (LN_TTS.btn) { setBtnPlaying(LN_TTS.btn, false); LN_TTS.btn = null; }
    LN_TTS.utterance = null;
    if (LN_AUDIO.el) {
      try { LN_AUDIO.el.pause(); LN_AUDIO.el.currentTime = 0; } catch {}
      LN_AUDIO.el = null;
    }
    if (LN_AUDIO.btn) { setBtnPlaying(LN_AUDIO.btn, false); LN_AUDIO.btn = null; }
  }

  function cleanTtsText(text) {
    const div = document.createElement("div");
    div.innerHTML = String(text || "");
    return (div.textContent || div.innerText || String(text || ""))
      .replace(/\s+/g, " ")
      .trim();
  }

  function waitForVoices() {
    const synth = window.speechSynthesis;
    if (!synth) return Promise.resolve([]);
    const voices = synth.getVoices();
    if (voices.length) return Promise.resolve(voices);
    return new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        synth.removeEventListener?.("voiceschanged", finish);
        resolve(synth.getVoices());
      };
      synth.addEventListener?.("voiceschanged", finish, { once: true });
      setTimeout(finish, 700);
    });
  }

  function pickTtsVoice(voices) {
    const saved = localStorage.getItem("ln.ttsVoice");
    if (saved) {
      const voice = voices.find(v => v.name === saved);
      if (voice) return voice;
    }
    return voices.find(v => /en-GB|en-US/i.test(v.lang) && v.localService)
      || voices.find(v => /en-GB|en-US/i.test(v.lang) && /natural|online|aria|jenny|samantha|google|microsoft/i.test(v.name || ""))
      || voices.find(v => /en-GB|en-US/i.test(v.lang))
      || null;
  }

  async function speakText(text, btnEl, retryWithoutVoice = false) {
    const cleanText = cleanTtsText(text);
    if (!cleanText || !window.speechSynthesis) { console.warn("[LN-TTS] no text or no speechSynthesis"); return; }
    // Toggle: same button clicked again while ANY playback is active → stop.
    if (btnEl && (LN_TTS.btn === btnEl || LN_AUDIO.btn === btnEl)) { stopAllAudio(); return; }
    // Otherwise stop whatever is playing on a different button, then start fresh
    stopAllAudio();
    try { window.speechSynthesis.resume(); } catch {}
    try {
      const voices = await waitForVoices();
      const voice = retryWithoutVoice ? null : pickTtsVoice(voices);
      setTimeout(() => {
        const u = new SpeechSynthesisUtterance(cleanText);
        u.lang = "en-GB"; u.rate = 0.92; u.pitch = 1; u.volume = 1;
        if (voice) u.voice = voice;
        else if (voices.length === 0) console.warn("[LN-TTS] no voices loaded yet — TTS may not play");
        if (btnEl) {
          LN_TTS.btn = btnEl;
          LN_TTS.utterance = u;
          setBtnPlaying(btnEl, true);
        }
        u.onend = () => {
          if (LN_TTS.btn === btnEl) { setBtnPlaying(btnEl, false); LN_TTS.btn = null; LN_TTS.utterance = null; }
        };
        u.onerror = (ev) => {
          if (LN_TTS.btn === btnEl) { setBtnPlaying(btnEl, false); LN_TTS.btn = null; LN_TTS.utterance = null; }
          // Ignore "interrupted" — that's just user clicking another play button
          if (ev?.error && ev.error !== "interrupted" && ev.error !== "canceled") {
            console.warn("[LN-TTS] error", ev);
            if (!retryWithoutVoice && ev.error === "synthesis-failed") {
              setTimeout(() => speakText(cleanText, btnEl, true), 120);
            }
          }
        };
        window.speechSynthesis.speak(u);
      }, 50);
    } catch (e) {
      if (btnEl) setBtnPlaying(btnEl, false);
      console.warn("[LN-TTS] exception", e);
    }
  }
  // Pre-load voices on first user gesture (some browsers need this)
  document.addEventListener("click", function preloadVoices() {
    try { window.speechSynthesis?.getVoices(); } catch {}
    document.removeEventListener("click", preloadVoices);
  }, { once: true, capture: true });

  function wireInlineTts(container) {
    if (!container) return;
    container.querySelectorAll(".ln-tts-btn").forEach(btn => {
      if (btn.__lnTtsWired) return;
      btn.__lnTtsWired = true;
      btn.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        const text = btn.dataset.text || btn.getAttribute("data-text") || btn.closest("[data-text]")?.getAttribute("data-text") || "";
        speakText(text, btn);
      }, true);
    });
  }

  function renderSampleHtml(d) {
    const title = d.__title || (d.sections || d.intro ? "Câu mẫu Part 2 (~2 phút)" : "Câu mẫu");

    // ── Part 2 NEW format: {sections: [{label, text}, ...]} ──────────────────
    if (Array.isArray(d.sections) && d.sections.length) {
      const full = d.sections.map(s => s.text).join(" ");
      const wordCount = full.split(/\s+/).length;
      return `
        <div style="padding:.8rem .4rem;font-family:Lexend,sans-serif;">
          <div style="margin-bottom:.6rem;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:700;font-size:.88rem;color:#171717;">${title}</span>
            <span style="font-size:.68rem;color:#9ca3af;">~${wordCount} từ · ${d.model||d.provider||""}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:.6rem;margin-bottom:.6rem;">
            ${d.sections.map(sec => `
              <div style="background:white;border:1px solid #e5e7eb;border-radius:.6rem;padding:.6rem .8rem;">
                <div style="display:flex;align-items:flex-start;gap:.5rem;">
                  ${ttsBtn(sec.text)}
                  <div style="flex:1;font-size:.85rem;line-height:1.65;">
                    <div style="font-size:.75rem;font-weight:700;color:#d9381e;margin-bottom:.25rem;">${escHtml(sec.label)}</div>
                    <div style="color:#171717;">${escHtml(sec.text)}</div>
                  </div>
                </div>
              </div>`).join("")}
          </div>
          <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem;">
            <button class="ln-tts-btn" data-text="${full.replace(/"/g,'&quot;')}" style="background:#d9381e;color:white;border:none;border-radius:9999px;padding:.35rem .9rem;cursor:pointer;font-size:.78rem;font-weight:600;">▶ Nghe toàn bộ</button>
            <button class="ln-expand-btn" style="background:#fffbe6;color:#d9381e;border:none;border-radius:9999px;padding:.35rem .9rem;cursor:pointer;font-size:.78rem;font-weight:600;">🎚️ Điều chỉnh câu</button>
            <button class="ln-extract-btn" data-source="${full.replace(/"/g,'&quot;')}" style="background:#fff;color:#d9381e;border:1.5px solid #d9381e;border-radius:9999px;padding:.3rem .85rem;cursor:pointer;font-size:.78rem;font-weight:600;">🔍 Tách cụm từ</button>
          </div>
          <div style="font-size:.72rem;color:#9ca3af;">💡 Bôi đen bất kỳ cụm từ để dịch hoặc lưu</div>
          ${d.warning?`<div style="color:var(--red);font-size:.75rem;margin-top:.4rem;">⚠ ${d.warning}</div>`:""}
        </div>`;
    }

    // ── Part 2 LEGACY format: {intro, what, where_when, why, feeling} ────────
    if (d.intro || d.what || d.where_when || d.feeling) {
      const sections = [
        ["Introduction", d.intro],
        ["What it is", d.what],
        ["When/Where", d.where_when],
        ["Why I chose this", d.why],
        ["How I feel", d.feeling]
      ].filter(([_,v])=>v);
      const full = sections.map(s=>s[1]).join(" ");
      return `
        <div style="padding:.8rem .4rem;font-family:Lexend,sans-serif;">
          <div style="font-size:.78rem;color:#171717;margin-bottom:.6rem;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:700;">${title}</span><span style="font-size:.7rem;color:#9ca3af;">${d.model||d.provider||""}</span>
          </div>
          <div style="background:white;border:1px solid #e5e7eb;border-radius:.6rem;padding:.7rem .8rem;margin-bottom:.6rem;">
            ${sections.map(([label, text]) => `
              <div style="display:flex;align-items:flex-start;gap:.5rem;margin-bottom:.7rem;">
                ${ttsBtn(text)}
                <div style="font-size:.82rem;line-height:1.65;">
                  <span style="font-size:.72rem;font-weight:800;color:#d9381e;display:block;margin-bottom:.15rem;">${label}</span><span style="font-weight:500;">${text}</span>
                </div>
              </div>`).join("")}
          </div>
          <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem;">
            <button class="ln-tts-btn" data-text="${full.replace(/"/g,'&quot;')}" style="background:#d9381e;color:white;border:none;border-radius:9999px;padding:.35rem .9rem;cursor:pointer;font-size:.78rem;font-weight:600;">▶ Nghe toàn bộ</button>
            <button class="ln-expand-btn" style="background:#fffbe6;color:#d9381e;border:none;border-radius:9999px;padding:.35rem .9rem;cursor:pointer;font-size:.78rem;font-weight:600;">🎚️ Điều chỉnh câu</button>
            <button class="ln-extract-btn" data-source="${full.replace(/"/g,'&quot;')}" style="background:#fff;color:#d9381e;border:1.5px solid #d9381e;border-radius:9999px;padding:.3rem .85rem;cursor:pointer;font-size:.78rem;font-weight:600;">🔍 Tách cụm từ</button>
          </div>
          <div style="font-size:.72rem;color:#9ca3af;">💡 Bôi đen bất kỳ cụm từ để dịch hoặc lưu</div>
          ${d.warning?`<div style="color:var(--red);font-size:.75rem;margin-top:.4rem;">⚠ ${d.warning}</div>`:""}
        </div>`;
    }
    const da = d.directAnswer || "";
    const ex = d.explanation || "";
    const eg = d.example || "";
    const full = [da, ex, eg].filter(Boolean).join(" ");
    const row = (label, text) => `
      <div style="display:flex;align-items:flex-start;gap:.5rem;margin-bottom:.55rem;">
        ${ttsBtn(text)}
        <div style="font-size:.85rem;line-height:1.55;">
          <span style="font-size:.72rem;font-weight:800;color:#d9381e;display:block;margin-bottom:.15rem;text-transform:uppercase;letter-spacing:.02em;">${label}</span>
          <span style="font-weight:500;color:#171717;">${text}</span>
        </div>
      </div>`;
    return `
      <div style="padding:.8rem .4rem;font-family:Lexend,sans-serif;">
        <div style="font-size:.78rem;color:#171717;margin-bottom:.6rem;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:700;">${title}</span><span style="font-size:.7rem;color:#9ca3af;">${d.model||d.provider||""}</span>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:.6rem;padding:.7rem .8rem;margin-bottom:.6rem;">
          ${row("Trả lời trực tiếp", da)}
          ${row("Giải thích", ex)}
          ${row("Ví dụ", eg)}
        </div>
        <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem;">
          <button class="ln-tts-btn" data-text="${full.replace(/"/g,'&quot;')}" style="background:#d9381e;color:white;border:none;border-radius:9999px;padding:.35rem .9rem;cursor:pointer;font-size:.78rem;font-weight:600;display:inline-flex;align-items:center;gap:.3rem;">▶ Nghe toàn bộ</button>
          <button class="ln-expand-btn" style="background:#fffbe6;color:#d9381e;border:none;border-radius:9999px;padding:.35rem .9rem;cursor:pointer;font-size:.78rem;font-weight:600;">🎚️ Điều chỉnh câu</button>
          <button class="ln-extract-btn" data-source="${full.replace(/"/g,'&quot;')}" style="background:#fff;color:#d9381e;border:1.5px solid #d9381e;border-radius:9999px;padding:.3rem .85rem;cursor:pointer;font-size:.78rem;font-weight:600;">🔍 Tách cụm từ</button>
        </div>
        <div style="font-size:.72rem;color:#9ca3af;">💡 Bôi đen bất kỳ cụm từ để dịch hoặc lưu</div>
        ${d.warning ? `<div style="color:var(--red);font-size:.75rem;margin-top:.4rem;">⚠ ${d.warning}</div>` : ""}
      </div>`;
  }

  function renderVocabHtml(d) {
    const words = d.words || [];
    const cards = words.map(w => `
      <div class="ln-vocab-card" data-practice-phrase="${(w.phrase||"").replace(/"/g,'&quot;')}" style="display:flex;align-items:center;justify-content:space-between;background:white;border:1px solid #e5e7eb;border-radius:.5rem;padding:.5rem .6rem;gap:.4rem;cursor:pointer;transition:box-shadow .15s;" onmouseenter="this.style.boxShadow='0 2px 8px rgba(217,56,30,.15)'" onmouseleave="this.style.boxShadow=''">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:.82rem;color:#171717;display:flex;align-items:center;gap:.3rem;flex-wrap:wrap;">
            <span>${w.phrase}</span>
            ${w.pos ? `<span style="font-size:.62rem;font-weight:500;color:#d9381e;background:#fffbe6;padding:.05rem .35rem;border-radius:.25rem;font-style:italic;">${w.pos}</span>` : ""}
          </div>
          <div style="font-size:.72rem;color:#6b7280;margin-top:.1rem;">${w.vi||""}</div>
        </div>
        ${ttsBtn(w.phrase + ". " + (w.example||""))}
      </div>`).join("");
    return `
      <div style="padding:.8rem .4rem;font-family:Lexend,sans-serif;">
        <div style="font-size:.78rem;color:#171717;margin-bottom:.6rem;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:700;">${d.__title || "Từ vựng chủ đề"}</span><span style="font-size:.7rem;color:#9ca3af;">${d.model||d.provider||""}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;margin-bottom:.6rem;">${cards}</div>
        ${d.warning ? `<div style="color:var(--red);font-size:.75rem;">⚠ ${d.warning}</div>` : ""}
      </div>`;
  }

  // Cache key: per-question per-kind. Survives reload.
  function cacheKey(kind) { return "ln.assist:" + encodeURIComponent(getQuestionFromPage()) + ":" + kind; }
  function cacheSet(kind, data) { try { localStorage.setItem(cacheKey(kind), JSON.stringify(data)); } catch {} }
  function cacheGet(kind) { try { return JSON.parse(localStorage.getItem(cacheKey(kind)) || "null"); } catch { return null; } }

  // Auto-speak full text using Web Speech API
  function autoSpeak(d) {
    const text = [d.directAnswer, d.explanation, d.example, d.intro, d.what, d.where_when, d.why, d.feeling]
      .filter(Boolean).join(" ");
    speakText(text);
  }

  function showAssistResult(d, kind, opts = {}) {
    const contentArea = getRightPanelContent();
    const isDetail = !!parseDetailRoute();

    // Cache it (unless skipCache, for restore)
    if (!opts.skipCache) cacheSet(kind, d);

    let html;
    if (kind === "vocab" || d.words) {
      html = renderVocabHtml(d);
    } else if (d.sections || d.directAnswer || d.intro || kind === "sample" || kind === "note") {
      html = renderSampleHtml(d);
    } else {
      html = `<div style="padding:.8rem .4rem;font-family:Lexend,sans-serif;font-size:.85rem;line-height:1.7;">${d.html || ""}<div style="font-size:.7rem;color:#888;margin-top:.4rem;">${d.model||d.provider||""}</div></div>`;
    }

    // STACK results: every call appends a NEW block (never replaces) so user keeps history.
    // Exception: when restoring from cache (opts.skipCache=true), reuse same-kind block.
    if (isDetail && contentArea) {
      let block;
      if (opts.skipCache) {
        block = contentArea.querySelector(`[data-ln-kind="${kind}"]`);
      }
      if (!block) {
        block = document.createElement("div");
        block.dataset.lnKind = kind;
        block.style.cssText = "border-bottom:1px solid #e5e7eb;margin-bottom:.6rem;padding-bottom:.4rem;";
        // Insert after cue-cards if present, else at top
        const cue = contentArea.querySelector("#ln-cuecards");
        if (cue) cue.after(block); else contentArea.prepend(block);
      }
      block.innerHTML = html;
      wireInlineTts(contentArea);
      wireExpandBtn(block, d);
      wireExtractBtn(block);
      wireVocabPractice(block);
      makeCollapsible(block, kind);
      return;
    }

    // Fallback floating panel (non-detail pages)
    let p = document.getElementById("ln-assist-panel");
    if (!p) {
      p = document.createElement("div");
      p.id = "ln-assist-panel";
      p.style.cssText = "position:fixed;right:1rem;top:5rem;width:360px;background:white;border:1.5px solid #e5e7eb;border-radius:1rem;box-shadow:0 8px 32px rgba(0,0,0,.15);z-index:9998;max-height:80vh;overflow-y:auto;font-family:Lexend,sans-serif;";
      document.body.appendChild(p);
    }
    p.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;padding:.8rem 1rem .4rem;border-bottom:1px solid #e5e7eb;">
      <span style="font-weight:700;color:#d9381e;">${d.title || kind}</span>
      <button onclick="document.getElementById('ln-assist-panel').remove()" style="background:none;border:none;cursor:pointer;font-size:1.2rem;color:#6b7280;">×</button>
    </div>` + html;
    wireInlineTts(p);
    wireExpandBtn(p, d);
    wireExtractBtn(p);
    wireVocabPractice(p);
  }

  // ── Tách cụm từ: extract phrases FROM the sample answer ────────────
  function wireExtractBtn(container) {
    container.querySelectorAll(".ln-extract-btn").forEach(btn => {
      if (btn.__wired) return;
      btn.__wired = true;
      btn.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        const source = btn.getAttribute("data-source") || "";
        if (!source.trim()) return;
        const orig = btn.innerHTML;
        btn.innerHTML = "⏳ Đang tách...";
        btn.disabled = true;
        try {
          const r = await realFetch("/api/gemini/assist", {
            method: "POST", headers: {"Content-Type":"application/json"},
            body: JSON.stringify({ apiKey: getKey(), model: getModel(), kind: "extract", topic: source })
          });
          const data = await r.json();
          // Render as a stacked vocab-like block, unique per source-hash so users can drill multiple câu mẫu
          const hash = source.length + "_" + (source.charCodeAt(0)||0) + (source.charCodeAt(source.length-1)||0);
          showAssistResult(data, "extract-" + hash, { skipAutoSpeak: true });
        } catch (e) {
          alert("Không tách được cụm từ: " + (e?.message || e));
        } finally {
          btn.innerHTML = orig;
          btn.disabled = false;
        }
      });
    });
  }

  function wireVocabPractice(container) {
    container.querySelectorAll(".ln-vocab-card[data-practice-phrase]").forEach(card => {
      if (card.__vocabWired) return;
      card.__vocabWired = true;
      card.addEventListener("click", (e) => {
        if (e.target.closest(".ln-tts-btn")) return;
        const phrase = card.dataset.practicePhrase;
        if (phrase) openWordPracticeModal(phrase, "");
      });
    });
  }

  // ── Collapse / expand toggle on each result block ──────────────────
  function makeCollapsible(block, kind) {
    const inner = block.firstElementChild; // the padding wrapper from each renderXxxHtml
    if (!inner || !inner.firstElementChild) return;
    const header = inner.firstElementChild; // title row
    if (!header || header.querySelector(".ln-collapse-chev")) return;

    const chev = document.createElement("button");
    chev.type = "button";
    chev.className = "ln-collapse-chev";
    chev.title = "Thu nhỏ / mở rộng";
    chev.style.cssText = "background:none;border:none;cursor:pointer;font-size:.85rem;color:#6b7280;padding:0 .35rem 0 0;line-height:1;";
    chev.textContent = "▼";
    header.insertBefore(chev, header.firstChild);
    header.style.cursor = "pointer";
    header.style.userSelect = "none";

    // Wrap all siblings of header into a collapsible body
    const bodyEls = [];
    let n = header.nextElementSibling;
    while (n) { bodyEls.push(n); n = n.nextElementSibling; }
    const body = document.createElement("div");
    body.className = "ln-card-body";
    bodyEls.forEach(el => body.appendChild(el));
    inner.appendChild(body);

    const storeKey = "ln.collapsed:" + encodeURIComponent(getQuestionFromPage()) + ":" + kind;
    const startCollapsed = (() => { try { return localStorage.getItem(storeKey) === "1"; } catch { return false; } })();
    const apply = (collapsed) => {
      body.style.display = collapsed ? "none" : "";
      chev.textContent = collapsed ? "▶" : "▼";
      try { localStorage.setItem(storeKey, collapsed ? "1" : "0"); } catch {}
    };
    apply(startCollapsed);
    const toggle = (ev) => {
      // ignore clicks on inner buttons (TTS in header etc.)
      if (ev.target.closest("button") && ev.target !== chev) return;
      apply(body.style.display !== "none");
    };
    header.addEventListener("click", toggle);
  }

  function wireExpandBtn(container, d) {
    container.querySelectorAll(".ln-expand-btn").forEach(expBtn => {
      if (expBtn.__wired) return;
      expBtn.__wired = true;
      expBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        // Remove any existing popup
        document.querySelectorAll(".ln-band-popup").forEach(p => p.remove());
        const popup = document.createElement("div");
        popup.className = "ln-band-popup";
        popup.style.cssText = "position:fixed;background:white;border:1px solid #d1d5db;border-radius:.5rem;padding:.4rem;box-shadow:0 6px 20px rgba(0,0,0,.18);z-index:99999;font-family:Lexend,sans-serif;display:flex;flex-direction:column;gap:.15rem;min-width:160px;";
        const rect = expBtn.getBoundingClientRect();
        popup.style.left = rect.left + "px";
        popup.style.top = (rect.bottom + 4) + "px";
        // Câu mẫu mặc định ≈ Band 5. Dropdown chỉ hiển thị các bản nâng cấp.
        const levels = [
          { key: "band6", label: "Band 6 (vừa)",  instr: "Upgrade to a Band 6 answer: use natural everyday collocations, a few varied connectives (however, also, plus), and one or two slightly less common words. Keep sentences mostly clear with light variety. Avoid idioms." },
          { key: "band7", label: "Band 7 (khá)",  instr: "Upgrade to a Band 7 answer: use topic-specific lexis, less common collocations, smooth and varied connectives, and a couple of complex sentences. Demonstrate flexibility without sounding forced. Sparingly include one natural idiomatic phrase if it fits." },
          { key: "band8", label: "Band 8 (giỏi)", instr: "Upgrade to a Band 8 answer: use sophisticated, precise lexis, natural idiomatic phrasing, varied complex structures with full flexibility, and nuanced word choice. Sound fluent and effortless without over-formality." }
        ];
        levels.forEach(level => {
          const opt = document.createElement("button");
          opt.textContent = level.label;
          opt.style.cssText = "border:none;background:transparent;text-align:left;padding:.4rem .7rem;cursor:pointer;font-size:.82rem;border-radius:.3rem;font-family:Lexend,sans-serif;";
          opt.onmouseenter = () => opt.style.background = "#fffbe6";
          opt.onmouseleave = () => opt.style.background = "transparent";
          opt.onclick = () => { popup.remove(); doAdjust(level); };
          popup.appendChild(opt);
        });
        document.body.appendChild(popup);
        setTimeout(() => {
          document.addEventListener("click", function h(e){ if(!popup.contains(e.target)){ popup.remove(); document.removeEventListener("click",h);} });
        }, 0);

        async function doAdjust(level) {
          expBtn.textContent = "⏳ Đang tạo...";
          // Send full original answer as JSON-like string, ask Gemini to keep same shape
          const origJson = JSON.stringify({
            directAnswer: d.directAnswer, explanation: d.explanation, example: d.example,
            sections: d.sections,
            intro: d.intro, what: d.what, where_when: d.where_when, why: d.why, feeling: d.feeling
          });
          const isPart2 = !!(d.sections || d.intro);
          const r = await realFetch("/api/gemini/assist", {
            method: "POST", headers: {"Content-Type":"application/json"},
            body: JSON.stringify({ apiKey: getKey(), model: getModel(), kind: "expand", topic: (isPart2?"PART 2 ":"") + origJson, note: level.instr })
          });
          const data = await r.json();
          // Gemini returns same shape (directAnswer/etc OR intro/etc)
          const newD = {
            ...data,
            __title: "Câu mẫu (" + level.label + ")",
            model: data.model || data.provider
          };
          // Use a separate kind so the adjusted version STACKS rather than replacing the original
          showAssistResult(newD, "adjust-" + level.key, { skipAutoSpeak: true });
          expBtn.textContent = "🎚️ Điều chỉnh câu";
        }
      });
    });
  }

  // Restore cached results when entering a detail page
  function restoreCachedAssist() {
    const detail = parseDetailRoute();
    if (!detail) return;
    setTimeout(() => {
      ["vocab","sample","note","pronun"].forEach(kind => {
        const cached = cacheGet(kind);
        if (cached) showAssistResult(cached, kind, { skipCache: true, skipAutoSpeak: true });
      });
      // Restore ALL stacked score results for this question
      try {
        const q = detail.question;
        const key = getScoreHistoryCandidates(q).find((candidate) => localStorage.getItem(candidate));
        const raw = key ? localStorage.getItem(key) : "";
        if (raw) {
          const arr = JSON.parse(raw).filter(item => {
            const modelName = String(item?.model || item?.provider || "");
            return item?.__realAttempt && item?.transcript && item?.criteria && !/local-fallback|mock/i.test(modelName);
          });
          if (!arr.length) return;
          // Render oldest first so unshift order matches (newest stays on top)
          for (let i = arr.length - 1; i >= 0; i--) {
            renderScoreResult({ ...arr[i], __fromCache: true });
          }
        }
      } catch {}
    }, 1200);
  }

  function clearDetailOnlyPanels() {
    if (parseDetailRoute()) return;
    document.querySelectorAll("#ln-assist-panel, #ln-score-panel, .ln-score-panel").forEach(el => el.remove());
  }

  // ---- Button rehydration ----
  // SvelteKit bootstrap is missing from scraped HTML, so we wire buttons manually
  // by matching their visible text. Runs after DOM ready and on mutations.
  const BUTTON_MAP = [
    { match: /thi thử ngay/i,           href: "/api/login" },
    { match: /bắt đầu miễn phí ngay/i,   href: "/api/login" },
    { match: /đăng nhập với google/i,    href: "/api/login" },
    { match: /^câu hỏi$|part\s*1/i,      href: "/question-answer/part1" },
    { match: /part\s*2/i,                 href: "/question-answer/part2" },
    { match: /part\s*3/i,                 href: "/question-answer/part3" },
    { match: /câu hỏi của bạn|user.question/i, href: "/question-answer/user-question" },
    { match: /làm bài|thi thử|full.?test/i, href: "/take-test/home" },
    { match: /nâng cấp|upgrade|premium/i, href: "/alphafeature/payment" },
    { match: /cài đặt|settings/i,        href: "/settings" },
    // Recording & AI buttons (handled by custom fn instead of href)
    { match: /^ghi âm( ngay)?$|ghi âm lại/i, action: (btn) => startRecording(btn) },
    { match: /câu mẫu|sample/i,           action: (btn) => assistGemini("sample", btn) },
    { match: /từ vựng|vocab/i,            action: (btn) => assistGemini("vocab", btn) },
    { match: /phát âm|pronun/i,           action: (btn) => assistGemini("pronun", btn) },
    { match: /gợi ý theo ghi chú|theo ghi chú/i, action: (btn) => assistGemini("note", btn) },
  ];

  function wireButtons() {
    const nodes = document.querySelectorAll("button, [role=button], div.cursor-pointer, [class*='cursor-pointer']");
    nodes.forEach((el) => {
      if (el.__lnWired) return;
      const text = (el.innerText || el.textContent || "").trim();
      if (!text) return;
      // Skip the "Ghi chú - tạo câu mẫu" button — injectNoteInput handles it (opens modal)
      if (/ghi chú.*tạo câu|tạo câu.*ghi chú/i.test(text) && text.length < 80) return;
      // Skip the pronunciation input button — wirePronounInputBox opens the word/phrase practice popup.
      if (/luyện phát âm|luyen phat am/i.test(text) && findPronunInputForButton(el)) return;
      for (const rule of BUTTON_MAP) {
        if (rule.match.test(text)) {
          el.__lnWired = true;
          el.style.cursor = "pointer";
          el.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (rule.toast) console.log("[LN]", rule.toast);
            if (rule.action) { rule.action(el); return; }
            if (rule.href && rule.href !== "#") location.href = rule.href;
          }, true);
          break;
        }
      }
    });

    // Also wire <a> tags pointing to luyennoi.com routes — they should already
    // work, but if any are missing href, try to wire by text too.
    document.querySelectorAll("a[href]").forEach((a) => {
      if (a.__lnWired) return;
      const href = a.getAttribute("href") || "";
      // Rewrite absolute luyennoi.com links to local
      if (/^https?:\/\/(www\.)?luyennoi\.com\//.test(href)) {
        a.setAttribute("href", href.replace(/^https?:\/\/(www\.)?luyennoi\.com/, ""));
      }
      a.__lnWired = true;
    });

    // Cards in "Luyện với bộ đề MỚI NHẤT" / forecast section — clickable cards
    document.querySelectorAll("[class*=card], .cursor-pointer").forEach((c) => {
      if (c.__lnWired) return;
      const text = (c.innerText || "").toLowerCase();
      if (text.includes("forecast") || text.includes("bộ đề")) {
        c.__lnWired = true;
        c.style.cursor = "pointer";
        c.addEventListener("click", () => { location.href = "/question-answer/part1"; });
      }
    });
  }

  // ──────────────── Mock data + state ────────────────
  const LN = {
    get state() {
      try { return JSON.parse(localStorage.getItem("ln.userState") || "{}"); }
      catch { return {}; }
    },
    set state(v) {
      const json = JSON.stringify(v);
      if (!safeLocalSet("ln.userState", json)) {
        try {
          const slim = { ...v, history: (v.history || []).slice(0, 20).map((h) => {
            const { audioDataUrl, audioUrl, raw, pronunciationIssues, grammarIssues, vocabularyIssues, spellingIssues, fluencyPauses, ...rest } = h || {};
            return { ...rest, transcript: String(rest.transcript || "").slice(0, 500) };
          }) };
          safeLocalSet("ln.userState", JSON.stringify(slim));
        } catch {}
      }
    },
    get history() { return this.state.history || []; },
    addAnswer(rec) {
      const s = this.state;
      s.history = (s.history || []);
      const { audioDataUrl, audioUrl, raw, pronunciationIssues, grammarIssues, vocabularyIssues, spellingIssues, fluencyPauses, ...slimRec } = rec || {};
      if (slimRec.transcript) slimRec.transcript = String(slimRec.transcript).slice(0, 500);
      s.history.unshift(slimRec);
      s.history = s.history.slice(0, 20);
      s.answered = (s.answered || 0) + 1;
      s.todayAnswered = (s.todayAnswered || 0) + 1;
      s.band = computePredictedBand();
      s.bandBreakdown = lastBandBreakdown;
      s.lastUpdated = Date.now();
      this.state = s;
      patchDashboard();
    }
  };

  // ──────────────── Predicted band (weighted) ────────────────
  //  Formula:
  //    50% Full Test overall (most recent — closest to real exam)
  //    30% Recent 20 practice attempts (time-decayed)
  //    20% Hard-parts (Part 2/3) avg from practice + full tests
  //  Each component independent — missing components are skipped and weights renormalised.
  let lastBandBreakdown = null;
  function computePredictedBand() {
    const components = [];

    // 1) Full Test overall
    try {
      const fullTests = JSON.parse(localStorage.getItem("ln.fullTestHistory") || "[]");
      if (fullTests.length) {
        const latest = fullTests[0];
        if (typeof latest.overall === "number") {
          components.push({ key: "fullTest", weight: 0.5, value: latest.overall, label: "Full Test gần nhất" });
        }
      }
    } catch {}

    // Collect all per-question score history (saved by detail-page scoring + full tests)
    const allAttempts = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("ln.scoreHistory:")) continue;
      let arr = [];
      try { arr = JSON.parse(localStorage.getItem(k) || "[]"); } catch {}
      arr.forEach(a => {
        const modelName = String(a?.model || a?.provider || "");
        if (a?.__realAttempt && a.transcript && typeof a.overall === "number" && !/local-fallback|mock/i.test(modelName)) allAttempts.push(a);
      });
    }
    allAttempts.sort((a, b) => (b.ts || 0) - (a.ts || 0));

    // 2) Recent 20 attempts — exponential decay (newer counts more)
    if (allAttempts.length) {
      const recent = allAttempts.slice(0, 20);
      let totalW = 0, sum = 0;
      recent.forEach((a, i) => {
        const w = Math.pow(0.92, i); // 1, 0.92, 0.84, ...
        totalW += w; sum += a.overall * w;
      });
      const recentAvg = sum / totalW;
      components.push({ key: "recent", weight: 0.3, value: +recentAvg.toFixed(2), label: `Trung bình ${recent.length} câu gần nhất (decay)` });
    }

    // 3) Hard parts (Part 2 + Part 3) average
    const hardAttempts = allAttempts.filter(a => a.section === "part2" || a.section === "part3");
    if (hardAttempts.length) {
      const avg = hardAttempts.reduce((s, a) => s + a.overall, 0) / hardAttempts.length;
      components.push({ key: "hardParts", weight: 0.2, value: +avg.toFixed(2), label: `Trung bình ${hardAttempts.length} câu Part 2/3` });
    }

    // Compute weighted band; renormalise if some components missing
    if (!components.length) {
      lastBandBreakdown = { components: [], final: 5.0, fallback: true };
      return 5.0;
    }
    const totalWeight = components.reduce((s, c) => s + c.weight, 0);
    const final = components.reduce((s, c) => s + c.value * c.weight, 0) / totalWeight;
    const rounded = Math.round(final * 2) / 2; // nearest 0.5
    lastBandBreakdown = { components, final: +final.toFixed(2), rounded, totalWeight };
    return rounded;
  }
  // Recompute on init so existing data shows the new formula immediately
  try {
    const s = LN.state;
    s.band = computePredictedBand();
    s.bandBreakdown = lastBandBreakdown;
    LN.state = s;
  } catch {}

  function collectAllAttempts() {
    const attempts = [];
    try {
      (LN.history || []).forEach((a) => {
        const modelName = String(a?.model || a?.provider || "");
        if (!a?.__realAttempt || !a.transcript || /local-fallback|mock/i.test(modelName)) return;
        attempts.push({
          ts: a.ts || a.createdAt || Date.now(),
          question: a.question || "Cau luyen tap",
          section: a.part || a.section || "practice",
          overall: typeof a.overall === "number" ? a.overall : (typeof a.band === "number" ? a.band : null),
          transcript: a.transcript || a.answer || "",
          source: "ln.userState"
        });
      });
    } catch {}
    try {
      const fullTests = JSON.parse(localStorage.getItem("ln.fullTestHistory") || "[]");
      fullTests.forEach((t) => attempts.push({
        ts: t.ts || Date.now(),
        question: "Full test",
        section: "FULL TEST",
        overall: typeof t.overall === "number" ? t.overall : null,
        transcript: `${t.questionCount || 0} cau`,
        source: "ln.fullTestHistory"
      }));
    } catch {}
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("ln.scoreHistory:")) continue;
      let question = "Cau luyen tap";
      try { question = decodeURIComponent(k.slice("ln.scoreHistory:".length)); } catch {}
      try {
        const arr = JSON.parse(localStorage.getItem(k) || "[]");
        arr.forEach((a) => {
          const modelName = String(a?.model || a?.provider || "");
          if (!a?.__realAttempt || !a.transcript || /local-fallback|mock/i.test(modelName)) return;
          attempts.push({
            ...a,
            ts: a.ts || Date.now(),
            question,
            section: a.section || (/^describe/i.test(question) ? "PART 2" : "PART 1"),
            source: k
          });
        });
      } catch {}
    }
    attempts.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return attempts;
  }

  function getCurrentUserLabel() {
    try {
      const u = JSON.parse(localStorage.getItem("ln.user") || localStorage.getItem("user") || "{}");
      return u.display_name || u.name || u.email || "Hai Nguyen Van";
    } catch {
      return "Hai Nguyen Van";
    }
  }

  function escapeDash(s) {
    return String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  function fmtDay(ts) {
    try { return new Date(ts || Date.now()).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }); }
    catch { return "--"; }
  }

  function buildHomeStats() {
    const attempts = collectAllAttempts();
    const scored = attempts.filter(a => typeof a.overall === "number");
    const s = LN.state || {};
    const band = computePredictedBand();
    const avg = scored.length ? scored.reduce((n, a) => n + a.overall, 0) / scored.length : band;
    const criteria = ["fluency", "vocabulary", "grammar", "pronunciation"];
    const criteriaAvg = {};
    criteria.forEach((k) => {
      const vals = scored.map(a => Number(a.criteria?.[k]?.score)).filter(Number.isFinite);
      criteriaAvg[k] = vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 0;
    });
    const byPart = {};
    attempts.forEach((a) => {
      const p = String(a.section || "OTHER").toUpperCase().replace("PART", "PART ");
      byPart[p] = (byPart[p] || 0) + 1;
    });
    const byDay = {};
    attempts.forEach((a) => { const d = fmtDay(a.ts); byDay[d] = (byDay[d] || 0) + 1; });
    return { attempts, scored, state: s, band, avg, criteriaAvg, byPart, byDay, breakdown: lastBandBreakdown };
  }

  function chartBars(map) {
    const entries = Object.entries(map || {}).slice(-10);
    const max = Math.max(1, ...entries.map(([, v]) => v));
    if (!entries.length) return `<div class="ln-empty-cell">Chưa có dữ liệu</div>`;
    return `<div class="ln-bars">${entries.map(([k, v]) => `
      <div class="ln-bar-item"><i style="height:${Math.max(10, (v / max) * 96)}px"></i><span>${escapeDash(k)}</span><b>${v}</b></div>
    `).join("")}</div>`;
  }

  function chartLine(attempts) {
    const data = attempts.filter(a => typeof a.overall === "number").slice(0, 14).reverse();
    if (!data.length) return `<div class="ln-empty-cell">Chưa có điểm để vẽ đường tiến bộ</div>`;
    const pts = data.map((a, i) => {
      const x = data.length === 1 ? 50 : 6 + i * (88 / (data.length - 1));
      const y = 90 - Math.max(0, Math.min(9, a.overall)) * 8.5;
      return `${x},${y}`;
    }).join(" ");
    return `<svg class="ln-line-chart" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline points="${pts}" fill="none" stroke="var(--red)" stroke-width="3" vector-effect="non-scaling-stroke"></polyline>
      ${data.map((a, i) => {
        const x = data.length === 1 ? 50 : 6 + i * (88 / (data.length - 1));
        const y = 90 - Math.max(0, Math.min(9, a.overall)) * 8.5;
        return `<circle cx="${x}" cy="${y}" r="2.4" fill="var(--yellow)" stroke="var(--ink)" stroke-width="1.2" vector-effect="non-scaling-stroke"></circle>`;
      }).join("")}
    </svg>`;
  }

  function chartDonut(stats) {
    const vals = Object.values(stats.byPart || {});
    const total = vals.reduce((a, b) => a + b, 0);
    const p1 = total ? ((stats.byPart["PART  1"] || stats.byPart["PART 1"] || 0) / total) * 100 : 34;
    const p2 = total ? ((stats.byPart["PART  2"] || stats.byPart["PART 2"] || 0) / total) * 100 : 33;
    const p3 = Math.max(0, 100 - p1 - p2);
    return `<div class="ln-donut" style="background:conic-gradient(var(--red) 0 ${p1}%, var(--yellow) ${p1}% ${p1 + p2}%, #111 ${p1 + p2}% 100%);"><span>${total}</span></div>
      <div class="ln-legend"><b><i class="r"></i>Part 1</b><b><i class="y"></i>Part 2</b><b><i class="b"></i>Part 3/Test</b></div>`;
  }

  function renderUserDetailsModal() {
    document.getElementById("lnUserDataModal")?.remove();
    const stats = buildHomeStats();
    const recent = stats.attempts.slice(0, 20);
    const partRows = Object.entries(stats.byPart || {}).sort((a, b) => b[1] - a[1]);
    // Đồng bộ key với settings.html bản gốc: luyennoi.geminiModel
    const currentModel = localStorage.getItem("luyennoi.geminiModel") || localStorage.getItem("ln.preferredModel") || "";
    const savedKeys = (() => {
      try { return JSON.parse(localStorage.getItem("luyennoi.geminiKeys") || "[]"); } catch { return []; }
    })();
    const primaryKey = localStorage.getItem("luyennoi.geminiKey") || "";
    const allKeys = savedKeys.length ? savedKeys : (primaryKey ? [primaryKey] : [""]);
    let localUser = null;
    try {
      const raw = localStorage.getItem("ln.user");
      localUser = raw ? JSON.parse(raw) : null;
    } catch {}
    const userName = getCurrentUserLabel();
    const userEmail = localUser?.email || localUser?.user_metadata?.email || localUser?.profile?.email || "Chưa đồng bộ";
    const userId = localUser?.id || localUser?.user_id || localStorage.getItem("ln.clientUserId") || "local-" + userName.toLowerCase().replace(/\s+/g, "-");
    const criteriaRows = [
      ["Trôi chảy", stats.criteriaAvg?.fluency || 0],
      ["Từ vựng", stats.criteriaAvg?.vocabulary || 0],
      ["Ngữ pháp", stats.criteriaAvg?.grammar || 0],
      ["Phát âm", stats.criteriaAvg?.pronunciation || 0],
    ];
    const modal = document.createElement("div");
    modal.id = "lnUserDataModal";
    modal.className = "ln-user-modal";
    modal.innerHTML = `
      <div class="ln-user-modal-card ln-modal-compact">
        <header>
          <div class="ln-modal-header-left">
            <div class="ln-account-avatar">${escapeDash(userName.slice(0, 1).toUpperCase())}</div>
            <div><b>${escapeDash(userName)}</b><span>${escapeDash(userEmail)}</span></div>
          </div>
          <div class="ln-modal-header-right">
            <button type="button" id="lnLogoutBtn" class="ln-btn-logout">Đăng xuất</button>
            <button type="button" aria-label="Đóng" class="ln-btn-close">×</button>
          </div>
        </header>

        <section class="ln-modal-grid">
          <article><b>Tổng luyện</b><strong>${stats.attempts.length}</strong></article>
          <article><b>Band</b><strong>${Number(stats.band || 0).toFixed(1)}</strong></article>
          <article><b>Điểm TB</b><strong>${Number(stats.avg || 0).toFixed(1)}</strong></article>
          <article><b>Hôm nay</b><strong>${stats.state.todayAnswered || 0}/25</strong></article>
        </section>

        <details class="ln-accordion" open>
          <summary>👤 Thông tin cá nhân</summary>
          <div class="ln-accordion-body">
            <label>User ID</label>
            <div class="ln-copy-row"><code id="lnUserIdText">${escapeDash(userId)}</code><button type="button" id="lnCopyUserId">Sao chép</button></div>
            <label>Email</label>
            <div class="ln-info-value">${escapeDash(userEmail)}</div>
            <label>Tên hiển thị</label>
            <div class="ln-info-value">${escapeDash(userName)}</div>
          </div>
        </details>

        <details class="ln-accordion" open>
          <summary>🔑 Gemini API Keys</summary>
          <div class="ln-accordion-body">
            <div class="ln-key-guide">
              <b>Hướng dẫn nhanh:</b> Truy cập <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a> → Create API Key → dán vào đây.
            </div>
            <div id="lnKeyList"></div>
            <button type="button" id="lnAddKey" class="ln-add-key">+ Thêm API key</button>
            <div class="ln-keys-actions">
              <button type="button" id="lnSaveKeys" class="ln-btn-primary">💾 Lưu keys</button>
              <button type="button" id="lnTestKey" class="ln-btn-ghost">🧪 Test key</button>
            </div>
            <div id="lnKeyToast" class="ln-toast"></div>
            <div id="lnKeyTestResult" class="ln-key-result"></div>
          </div>
        </details>

        <details class="ln-accordion">
          <summary>🤖 Mô hình AI</summary>
          <div class="ln-accordion-body">
            <small><b>Cơ chế:</b> Fallback 2 vòng — tự chuyển model/key khi lỗi. "Smart routing" = tự chọn model phù hợp theo tác vụ.</small>
            <label>Model đang dùng</label>
            <strong id="lnCurrentModel">${escapeDash(currentModel || "🎯 Smart routing (Tự động)")}</strong>
            <div class="ln-model-row">
              <select id="lnModelSelect"><option value="">Đang tải model...</option></select>
              <input id="lnCustomModel" placeholder="Model tuỳ chỉnh..." value="${escapeDash(currentModel)}">
              <button type="button" id="lnSaveModel">💾 Lưu</button>
            </div>
            <div id="lnModelToast" class="ln-toast"></div>
            <div id="lnTaskMap" class="ln-task-map">Đang tải...</div>
          </div>
        </details>

        <details class="ln-accordion">
          <summary>📊 Thống kê học tập</summary>
          <div class="ln-accordion-body">
            <b>Điểm theo tiêu chí</b>
            <div class="ln-criteria-mini">${criteriaRows.map(([label, value]) => `<div><span>${label}</span><i><em style="width:${Math.min(100, Math.max(4, (value || 0) / 9 * 100))}%"></em></i><b>${value ? Number(value).toFixed(1) : "-"}</b></div>`).join("")}</div>
            <b>Theo phần</b>
            <div class="ln-raw-table"><table><thead><tr><th>Phần</th><th>Số lần</th></tr></thead><tbody>${partRows.map(([part, count]) => `<tr><td>${escapeDash(part)}</td><td>${count}</td></tr>`).join("") || `<tr><td colspan="2">Chưa có</td></tr>`}</tbody></table></div>
            <b>Lịch sử gần nhất</b>
            <div class="ln-raw-table"><table><thead><tr><th>Ngày</th><th>Phần</th><th>Câu hỏi</th><th>Điểm</th></tr></thead><tbody>${recent.slice(0, 10).map(a => `<tr><td>${fmtDay(a.ts)}</td><td>${escapeDash(a.section)}</td><td>${escapeDash(a.question)}</td><td>${typeof a.overall === "number" ? a.overall.toFixed(1) : "-"}</td></tr>`).join("") || `<tr><td colspan="4">Chưa có</td></tr>`}</tbody></table></div>
          </div>
        </details>
      </div>`;
    modal.querySelector(".ln-btn-close")?.addEventListener("click", () => modal.remove());
    modal.querySelector("#lnLogoutBtn")?.addEventListener("click", () => {
      if (typeof window.logout === "function") { window.logout(); }
      else { window.location.href = "/logout"; }
    });
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);

    // Copy User ID
    modal.querySelector("#lnCopyUserId")?.addEventListener("click", async () => {
      const text = modal.querySelector("#lnUserIdText")?.textContent || "";
      try { await navigator.clipboard.writeText(text); } catch {}
      const btn = modal.querySelector("#lnCopyUserId");
      if (btn) { btn.textContent = "✓ Đã sao chép"; setTimeout(() => { btn.textContent = "Sao chép"; }, 1500); }
    });

    // ── API Keys management ──
    const keyList = modal.querySelector("#lnKeyList");
    function addKeyRow(value = "") {
      const row = document.createElement("div");
      row.className = "ln-key-row";
      row.innerHTML = `<input type="password" placeholder="AIza..." value="${escapeDash(value)}" autocomplete="off"><button type="button" class="ln-key-remove" aria-label="Xoá">×</button>`;
      row.querySelector(".ln-key-remove").addEventListener("click", () => row.remove());
      keyList.appendChild(row);
    }
    allKeys.forEach(k => addKeyRow(k));
    modal.querySelector("#lnAddKey").addEventListener("click", () => addKeyRow(""));
    function showKeyToast(msg, type) {
      const t = modal.querySelector("#lnKeyToast");
      if (!t) return;
      t.textContent = msg;
      t.className = "ln-toast " + (type || "");
      setTimeout(() => { t.className = "ln-toast"; }, 3000);
    }
    modal.querySelector("#lnSaveKeys").addEventListener("click", async () => {
      const inputs = [...keyList.querySelectorAll("input")];
      const keys = inputs.map(i => i.value.trim()).filter(Boolean);
      if (!keys.length) { showKeyToast("Chưa nhập key nào!", "error"); return; }
      try {
        localStorage.setItem("luyennoi.geminiKeys", JSON.stringify(keys));
        localStorage.setItem("luyennoi.geminiKey", keys[0]); // primary key for overlay
        if (window.LNAuth?.saveProfileSettings) {
          await window.LNAuth.saveProfileSettings({ geminiKeys: keys });
          showKeyToast("✓ Đã lưu " + keys.length + " key vào profile", "success");
        } else {
          showKeyToast("✓ Đã lưu " + keys.length + " key trên trình duyệt", "success");
        }
      } catch (e) { showKeyToast("✗ Lỗi lưu: " + e.message, "error"); }
    });
    modal.querySelector("#lnTestKey").addEventListener("click", async () => {
      const input = keyList.querySelector("input");
      const key = input?.value.trim();
      const out = modal.querySelector("#lnKeyTestResult");
      if (!key) { showKeyToast("Nhập key trước!", "error"); return; }
      if (out) out.textContent = "⏳ Đang test...";
      try {
        const r = await realFetch("/api/gemini/assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: key, kind: "sample", topic: "watches" })
        });
        const d = await r.json();
        if (d.warning) throw new Error(d.warning);
        if (out) out.innerHTML = `✓ Key hoạt động! Model: <b>${escapeDash(d.model || "ok")}</b>`;
      } catch (e) {
        if (out) out.innerHTML = `✗ Lỗi: ${escapeDash(e.message)}`;
      }
    });

    // ── Model picker + task map ──
    function showModelToast(msg, type) {
      const t = modal.querySelector("#lnModelToast");
      if (!t) return;
      t.textContent = msg;
      t.className = "ln-toast " + (type || "");
      setTimeout(() => { t.className = "ln-toast"; }, 2500);
    }
    modal.querySelector("#lnSaveModel").addEventListener("click", async () => {
      const custom = modal.querySelector("#lnCustomModel")?.value?.trim();
      const selected = modal.querySelector("#lnModelSelect")?.value?.trim();
      const value = custom || selected || "";
      // Lưu vào CẢ 2 key để tương thích cả overlay mới & code gốc
      try { localStorage.setItem("luyennoi.geminiModel", value); } catch {}
      try { localStorage.setItem("ln.preferredModel", value); } catch {}
      try { if (window.LNAuth?.saveProfileSettings) await window.LNAuth.saveProfileSettings({ geminiModel: value }); } catch {}
      const cur = modal.querySelector("#lnCurrentModel");
      if (cur) cur.textContent = value || "🎯 Smart routing (Tự động theo tác vụ)";
      showModelToast(value ? ("✓ Đã chọn model: " + value) : "✓ Đã bật chế độ tự động luân phiên", "success");
    });

    realFetch("/api/models", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        const models = Array.isArray(d?.models) ? d.models : [];
        const tasks = Array.isArray(d?.taskMap) ? d.taskMap : [];
        const select = modal.querySelector("#lnModelSelect");
        if (select) {
          select.innerHTML = `<option value="">🎯 Smart routing (Tự động theo tác vụ — khuyên dùng)</option>` +
            models.map(m => {
              const id = typeof m === "string" ? m : m.id;
              const label = typeof m === "string" ? m : (m.label || m.id);
              const usage = typeof m === "string" ? "" : (m.usage || "");
              return `<option value="${escapeDash(id)}">${escapeDash(label)}${usage ? " — " + escapeDash(usage) : ""}</option>`;
            }).join("");
          // Khôi phục lựa chọn cũ
          const exists = models.some(m => (typeof m === "string" ? m : m.id) === currentModel);
          select.value = exists ? currentModel : "";
        }
        // Render task map table
        const mapHost = modal.querySelector("#lnTaskMap");
        if (mapHost) {
          // Group by group
          const groups = {};
          tasks.forEach(t => {
            const g = t.group || "Khác";
            (groups[g] = groups[g] || []).push(t);
          });
          mapHost.innerHTML = `<b>📌 Phân nhóm model theo tác vụ:</b>` + Object.entries(groups).map(([g, items]) => `
            <div class="ln-task-group">
              <div class="ln-task-group-title">${escapeDash(g)}</div>
              <ul>${items.map(t => `
                <li>
                  <span class="ln-task-name">${escapeDash(t.task)}</span>
                  <code>${escapeDash(t.model)}</code>
                  ${(t.fallback || []).length ? `<small>fallback: ${t.fallback.map(f => `<code>${escapeDash(f)}</code>`).join(", ")}</small>` : ""}
                </li>`).join("")}</ul>
            </div>`).join("");
        }
      })
      .catch(() => {
        const select = modal.querySelector("#lnModelSelect");
        if (select) select.innerHTML = `<option value="">⚠ Không tải được /api/models</option>`;
        const mapHost = modal.querySelector("#lnTaskMap");
        if (mapHost) mapHost.textContent = "⚠ Không tải được bảng phân nhóm.";
      });
  }
  function renderHomeDashboard() {
    const stats = buildHomeStats();
    const c = stats.criteriaAvg;
    const explain = stats.breakdown?.components?.length
      ? stats.breakdown.components.map(x => `<li><b>${escapeDash(x.label)}</b><span>${Math.round(x.weight * 100)}%</span><strong>${Number(x.value).toFixed(1)}</strong></li>`).join("")
      : `<li><b>Chưa đủ dữ liệu, tạm lấy mốc khởi đầu</b><span>100%</span><strong>5.0</strong></li>`;
    return `
      <section class="ln-home-analytics" id="lnHomeAnalytics">
        <header class="ln-dash-head">
          <div><span>Learning Analytics</span><h1>Bảng tiến bộ của ${escapeDash(getCurrentUserLabel())}</h1><p>Dữ liệu lấy trực tiếp từ localStorage: lịch sử câu đã làm, điểm từng tiêu chí, full test và streak.</p></div>
          <button type="button" id="lnDashUserBtn">${escapeDash(getCurrentUserLabel())}</button>
        </header>
        <div class="ln-kpi-grid">
          <article><span>Band dự đoán</span><strong>${Number(stats.band || 0).toFixed(1)}</strong><p>Làm tròn 0.5 theo full test và các câu gần nhất.</p></article>
          <article><span>Tổng câu đã luyện</span><strong>${stats.attempts.length}</strong><p>${stats.scored.length} câu có điểm chi tiết.</p></article>
          <article><span>Hôm nay</span><strong>${stats.state.todayAnswered || 0}/25</strong><p>Mục tiêu ngày được tính bằng số lần ghi âm.</p></article>
          <article><span>Điểm trung bình</span><strong>${Number(stats.avg || 0).toFixed(1)}</strong><p>Trung bình tất cả bài có điểm.</p></article>
        </div>
        <div class="ln-chart-grid">
          <article class="ln-panel wide"><header><h2>Đường tiến bộ gần đây</h2><span>IELTS band</span></header>${chartLine(stats.attempts)}</article>
          <article class="ln-panel"><header><h2>Tỷ lệ dạng bài</h2><span>Part mix</span></header>${chartDonut(stats)}</article>
          <article class="ln-panel"><header><h2>Số câu theo ngày</h2><span>frequency</span></header>${chartBars(stats.byDay)}</article>
          <article class="ln-panel"><header><h2>4 tiêu chí</h2><span>score</span></header>
            <div class="ln-criteria">
              ${[
                ["Trôi chảy", c.fluency],
                ["Từ vựng", c.vocabulary],
                ["Ngữ pháp", c.grammar],
                ["Phát âm", c.pronunciation],
              ].map(([label, value]) => `<div><span>${label}</span><i><em style="width:${Math.min(100, Math.max(4, (value || 0) / 9 * 100))}%"></em></i><b>${value ? value.toFixed(1) : "-"}</b></div>`).join("")}
            </div>
          </article>
        </div>
        <div class="ln-table-grid">
          <article class="ln-panel"><header><h2>Công thức dự đoán band</h2><span>weight</span></header><ul class="ln-breakdown">${explain}</ul></article>
          <article class="ln-panel wide"><header><h2>Lịch sử luyện tập mới nhất</h2><span>${stats.attempts.length} records</span></header>
            <div class="ln-history-table"><table><thead><tr><th>Ngày</th><th>Phần</th><th>Câu hỏi</th><th>Điểm</th></tr></thead><tbody>${stats.attempts.slice(0, 12).map(a => `<tr><td>${fmtDay(a.ts)}</td><td>${escapeDash(a.section)}</td><td>${escapeDash(a.question)}</td><td>${typeof a.overall === "number" ? a.overall.toFixed(1) : "-"}</td></tr>`).join("") || `<tr><td colspan="4">Chưa có dữ liệu. Hãy vào Luyện theo câu để ghi âm câu đầu tiên.</td></tr>`}</tbody></table></div>
          </article>
        </div>
      </section>`;
  }
  function findMainScrollContainer() {
    return document.querySelector(".flex-1.overflow-y-auto.overflow-x-hidden")
      || document.querySelector("main")
      || document.querySelector("[role='main']");
  }

  function patchHomeAnalytics() {
    if (location.pathname !== "/" && location.pathname !== "/home" && location.pathname !== "/home/") return;
    if (document.getElementById("lnHomeAnalytics")) return;
    const host = findMainScrollContainer();
    if (!host) return;
    host.innerHTML = renderHomeDashboard();
    host.querySelector("#lnDashUserBtn")?.addEventListener("click", renderUserDetailsModal);
  }

  // Sidebar rendering is now handled by the external sidebar.js module (LNSidebar).
  // This function delegates to it, passing the user-modal callback.
  function patchSidebarNav() {
    if (window.LNSidebar) {
      window.LNSidebar.render({ onUserClick: renderUserDetailsModal });
    }
  }

  function ensureFixedUserBadge() {
    document.getElementById("lnFixedUserBadge")?.remove();
    document.querySelectorAll(".ln-fixed-user-badge").forEach(el => el.remove());
    return;
    const name = getCurrentUserLabel();
    let badge = document.getElementById("lnFixedUserBadge");
    if (!badge) {
      badge = document.createElement("button");
      badge.id = "lnFixedUserBadge";
      badge.className = "ln-fixed-user-badge";
      badge.type = "button";
      badge.setAttribute("data-ln-name", "");
      badge.addEventListener("click", renderUserDetailsModal);
      badge.innerHTML = `<span>${escapeDash(name.slice(0, 1).toUpperCase())}</span><b>${escapeDash(name)}</b>`;
      document.body.appendChild(badge);
    } else if (badge.getAttribute("data-ln-name") !== name) {
      // Chỉ update khi tên thay đổi — tránh trigger MutationObserver liên tục
      badge.setAttribute("data-ln-name", name);
      badge.innerHTML = `<span>${escapeDash(name.slice(0, 1).toUpperCase())}</span><b>${escapeDash(name)}</b>`;
    }
  }
  // ──────────────── Dashboard mock data ────────────────
  function patchDashboard() {
    const s = LN.state;
    const todayLeft = Math.max(0, 25 - (s.todayAnswered || 0));
    const band = s.band || 5.0;
    const streak = s.dayStreak || 0;

    // Day streak
    document.querySelectorAll("*").forEach(el => {
      if (el.children.length > 0) return;
      const t = (el.textContent || "").trim();
      if (/^\d+$/.test(t) && el.parentElement?.textContent?.includes("Day streak") && !el.__lnPatched) {
        el.textContent = streak;
        el.__lnPatched = true;
      }
    });

    // 25-câu counter (find "25 câu" pattern)
    document.querySelectorAll("*").forEach(el => {
      if (el.children.length > 0) return;
      const t = el.textContent || "";
      if (/Ghi âm \d+ câu/.test(t) && !el.__lnPatched) {
        el.textContent = t.replace(/Ghi âm \d+ câu/, "Ghi âm " + todayLeft + " câu");
        el.__lnPatched = true;
      }
    });

    // Estimated band
    document.querySelectorAll(".badge, [class*=badge]").forEach(el => {
      const t = (el.textContent || "").trim();
      if (/^\d\.\d$/.test(t) && !el.__lnPatched) {
        el.textContent = band.toFixed(1);
        el.__lnPatched = true;
      }
    });

    // Sidebar counter "0/25"
    const sb = document.querySelectorAll("[class*=stat], [class*=progress]");
    sb.forEach(el => {
      const t = el.textContent || "";
      if (/\/25/.test(t) && !el.__lnPatched) {
        el.textContent = t.replace(/\d+\/25/, (s.todayAnswered || 0) + "/25");
        el.__lnPatched = true;
      }
    });
  }

  // ──────────────── Better recording overlay (matches real UI) ────────────────
  function showRecordingUI() {
    if (document.getElementById("ln-rec-bar")) return;
    const bar = document.createElement("div");
    bar.id = "ln-rec-bar";
    bar.style.cssText = "position:fixed;bottom:0;left:0;right:0;background:white;border-top:2px solid #d9381e;padding:1rem 1.5rem;display:flex;align-items:center;gap:1.5rem;z-index:9999;box-shadow:0 -4px 16px rgba(0,0,0,.08);font-family:Lexend,sans-serif;";
    bar.innerHTML = `
      <div style="display:flex;align-items:center;gap:.5rem;color:#d9381e;font-weight:600;">
        <span style="width:.6rem;height:.6rem;background:#d9381e;border-radius:50%;animation:pulse 1s infinite;"></span>
        Đang ghi âm...
      </div>
      <div style="flex:1;display:flex;align-items:center;gap:1rem;justify-content:center;">
        <div style="display:flex;gap:.2rem;align-items:flex-end;">
          ${[8,12,16,12,8,14,10].map(h=>`<div style="width:.3rem;height:${h*0.15}rem;background:#d9381e;border-radius:.1rem;animation:bar 1s ${Math.random()}s infinite;"></div>`).join("")}
        </div>
        <span id="ln-rec-timer" style="font-weight:700;font-size:1.1rem;color:#171717;">0:00</span>
      </div>
      <button id="ln-rec-cancel" style="padding:.5rem 1.2rem;border:1.5px solid var(--red);color:var(--red);background:white;border-radius:9999px;font-weight:600;cursor:pointer;">✕ Huỷ</button>
      <button id="ln-rec-submit" class="ln-rec-submit-action" style="padding:.5rem 1.5rem;background:#d9381e;color:white;border:none;border-radius:9999px;font-weight:600;cursor:pointer;">Dừng và gửi</button>
      <style>
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.3} }
        @keyframes bar { 0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.6)} }
      </style>
    `;
    document.body.appendChild(bar);
    const submitBtn = bar.querySelector("#ln-rec-submit");
    if (submitBtn) {
      submitBtn.textContent = "Dừng và gửi";
      submitBtn.setAttribute("aria-label", "Dừng và gửi");
      submitBtn.style.setProperty("display", "inline-flex", "important");
      submitBtn.style.setProperty("align-items", "center", "important");
      submitBtn.style.setProperty("justify-content", "center", "important");
      submitBtn.style.setProperty("min-width", "132px", "important");
      submitBtn.style.setProperty("min-height", "42px", "important");
      submitBtn.style.setProperty("color", "#ffffff", "important");
      submitBtn.style.setProperty("font-size", "14px", "important");
      submitBtn.style.setProperty("line-height", "1.2", "important");
      submitBtn.style.setProperty("text-indent", "0", "important");
      submitBtn.style.setProperty("opacity", "1", "important");
      submitBtn.style.setProperty("visibility", "visible", "important");
    }

    // Timer
    const start = Date.now();
    REC_STATE.timer = setInterval(() => {
      const sec = Math.floor((Date.now() - start) / 1000);
      const m = Math.floor(sec / 60), s = sec % 60;
      const el = document.getElementById("ln-rec-timer");
      if (el) el.textContent = `${m}:${String(s).padStart(2,"0")}`;
    }, 500);

    bar.querySelector("#ln-rec-cancel").onclick = () => {
      clearInterval(REC_STATE.timer);
      REC_STATE.cancelled = true;
      REC_STATE.recorder?.stop();
      bar.remove();
    };
    submitBtn.onclick = () => {
      clearInterval(REC_STATE.timer);
      REC_STATE.recorder?.stop();
      bar.remove();
    };
  }

  // Override startRecording placeholder with full UI implementation
  startRecording = async function (btn) {
    if (REC_STATE.recording || REC_STATE.starting) return;
    REC_STATE.starting = true;
    // Guard the trigger button from double-click during getUserMedia → MediaRecorder.start
    if (btn) markBusy(btn, "record");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      REC_STATE.stream = stream;
      REC_STATE.chunks = [];
      REC_STATE.cancelled = false;
      let pickedMimeType = localStorage.getItem("ln.audioCfg") || pickRecordingMimeType();
      if (pickedMimeType) localStorage.setItem("ln.audioCfg", pickedMimeType);
      // Phase 3: 32 kbps Opus mono — payload cực nhỏ (~75% nhỏ hơn mặc định), cực nhanh, vẫn cực chuẩn cho AI
      const recOpts = pickedMimeType
        ? { mimeType: pickedMimeType, audioBitsPerSecond: 32000 }
        : { audioBitsPerSecond: 32000 };
      let rec;
      try { rec = new MediaRecorder(stream, recOpts); }
      catch { rec = pickedMimeType ? new MediaRecorder(stream, { mimeType: pickedMimeType }) : new MediaRecorder(stream); }
      REC_STATE.mimeType = rec.mimeType || pickedMimeType || "audio/webm";
      REC_STATE.startTime = Date.now();
      REC_STATE.durationMs = 0;
      rec.ondataavailable = (e) => { if (e.data?.size) REC_STATE.chunks.push(e.data); };
      rec.onstop = async () => {
        REC_STATE.durationMs = Date.now() - REC_STATE.startTime;
        REC_STATE.stream?.getTracks().forEach(t => t.stop());
        REC_STATE.recording = false;
        if (REC_STATE.cancelled) return;
        const blob = new Blob(REC_STATE.chunks, { type: REC_STATE.mimeType || REC_STATE.chunks[0]?.type || "audio/webm" });
        // Gửi mọi bản ghi (ngắn hay dài) đi chấm + lưu Supabase.
        // Chỉ bỏ qua khi không thu được byte nào (mic không cấp dữ liệu) để
        // tránh gọi API chắc chắn lỗi — còn lại đều gửi.
        if (!blob.size) {
          alert("Không thu được âm thanh nào (microphone không cấp dữ liệu). Hãy kiểm tra quyền mic rồi thử lại.");
          return;
        }
        await scoreAndSave(blob, REC_STATE.durationMs);
      };
      rec.start();
      REC_STATE.recorder = rec;
      REC_STATE.recording = true;
      showRecordingUI();
    } catch (e) {
      alert("Không truy cập được microphone: " + e.message);
    } finally {
      REC_STATE.starting = false;
      if (btn) unmarkBusy(btn);
    }
  };

  // Render a sticky retry banner so the user can re-score the SAME blob without re-recording.
  function showScoreRetry(audioUrl, audioDataUrl, mimeType, question, partLabel, message, durationMs) {
    document.getElementById("ln-score-retry")?.remove();
    const banner = document.createElement("div");
    banner.id = "ln-score-retry";
    banner.style.cssText = "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#fff;border:2px solid #d9381e;color:#171717;padding:.7rem .9rem;border-radius:.6rem;box-shadow:0 6px 24px rgba(0,0,0,.18);z-index:100000;font-family:Lexend,sans-serif;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;max-width:min(94vw,520px);font-size:.85rem;";
    banner.innerHTML = `
      <span style="flex:1;min-width:200px;">⚠ ${message || "Không chấm được"} — bản thu vẫn còn, bạn có thể thử lại.</span>
      <audio controls preload="metadata" src="${audioUrl}" style="height:30px;flex:0 0 220px;max-width:100%;"></audio>
      <button type="button" data-act="retry" style="background:#d9381e;color:#fff;border:none;border-radius:.35rem;padding:.45rem .9rem;font-weight:700;cursor:pointer;">Thử lại</button>
      <button type="button" data-act="close" style="background:transparent;border:1px solid #d1d5db;border-radius:.35rem;padding:.45rem .7rem;cursor:pointer;color:#6b7280;">Đóng</button>`;
    document.body.appendChild(banner);
    banner.querySelector('[data-act="close"]').onclick = () => {
      try { URL.revokeObjectURL(audioUrl); } catch {}
      banner.remove();
    };
    banner.querySelector('[data-act="retry"]').onclick = async (ev) => {
      const btn = ev.currentTarget;
      if (btn.__lnBusy) return;
      markBusy(btn, "record");
      const ok = await submitScoreRequest({ audioUrl, audioDataUrl, mimeType, question, partLabel, durationMs });
      unmarkBusy(btn);
      if (ok) banner.remove();
    };
  }

  function showScoreDoneToast() {
    const cloudToast = Object.assign(document.createElement("div"), {
      textContent: "☁️ Đã lưu kết quả lên cloud",
      style: "position:fixed;bottom:20px;right:20px;background:#1a7f37;color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;z-index:99999;opacity:0.95;transition:opacity .5s;"
    });
    document.body.appendChild(cloudToast);
    setTimeout(() => { cloudToast.style.opacity = "0"; setTimeout(() => cloudToast.remove(), 600); }, 3000);
  }

  function applyScoreResult(data, audioUrl, audioDataUrl, mimeType, question, partLabel, durationMs) {
    try {
      LN.addAnswer({
        ts: Date.now(),
        __realAttempt: true,
        question,
        part: partLabel,
        section: String(partLabel || "").toLowerCase().replace(/\s+/g, ""),
        url: location.pathname,
        mimeType,
        overall: data.overall,
        transcript: data.transcript,
        rewrittenAnswer: data.rewrittenAnswer,
        criteria: data.criteria,
        feedback: data.feedback,
        suggestions: data.suggestions,
        pronunciationIssues: data.pronunciationIssues,
        grammarIssues: data.grammarIssues,
        vocabularyIssues: data.vocabularyIssues,
        spellingIssues: data.spellingIssues,
        fluencyPauses: data.fluencyPauses,
        environmentWarning: data.environmentWarning,
        warning: data.warning,
        model: data.model || data.provider
      });
    } catch (stateErr) {
      console.warn("[ln-state] skipped local userState save", stateErr?.message || stateErr);
    }

    data.__realAttempt = true;
    data.question = question;
    data.part = partLabel;
    data.audioDataUrl = audioDataUrl;
    data.audioUrl = audioUrl;
    if (durationMs) data.durationMs = durationMs;
    renderScoreResult(data);
    showScoreDoneToast();
  }

  async function startAsyncScoreJob({ apiKey, audioUrl, audioDataUrl, mimeType, question, partLabel, toast, durationMs }) {
    const payload = {
      apiKey,
      question, part: partLabel,
      audioBase64: audioDataUrl.split(",")[1] || audioDataUrl,
      mimeType,
      note: localStorage.getItem("ln.userNote") || "",
      durationMs: durationMs || 0
    };
    // Gửi audio (payload lớn) tới /start (function thường, giới hạn 6MB) để lưu vào
    // score_jobs. KHÔNG gửi audio qua body trigger nền vì Background Functions của
    // Netlify giới hạn payload nhỏ (audio lớn -> HTTP 500).
    const started = await fetch("/api/gemini/score-speaking/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientHasApiKey: !!apiKey, payload })
    });
    if (!started.ok) throw new Error("Không tạo được job chấm điểm (HTTP " + started.status + ")");
    const job = await started.json();
    if (!job?.jobId) throw new Error("Server không trả jobId chấm điểm");
    toast.innerHTML = '<span style="display:inline-block;width:.85rem;height:.85rem;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:ln-spin .9s linear infinite;"></span> Audio dài — đang chấm nền…';
    // Body trigger chỉ còn {jobId} tí xíu -> 202. Nếu vì lý do nào đó server chưa
    // lưu được payload (payloadStored=false) thì gửi kèm payload như fallback.
    const kickBody = job.payloadStored ? { jobId: job.jobId } : { jobId: job.jobId, payload };
    const kicked = await fetch(job.backgroundUrl || "/api/gemini/score-speaking/background", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(kickBody)
    });
    if (!kicked.ok) throw new Error("Không chạy được job nền (HTTP " + kicked.status + ")");

    const startedAt = Date.now();
    let failStreak = 0;
    let pollCount = 0;
    while (Date.now() - startedAt < 660000) {
      // Poll dày lúc đầu (kết quả thường về nhanh sau khi Gemini xong) rồi giãn dần
      // để giảm độ trễ cảm nhận mà không spam server: 1.2s, 1.5s, 1.5s, ... tối đa 2.5s.
      const wait = pollCount === 0 ? 1200 : Math.min(1500 + pollCount * 100, 2500);
      pollCount++;
      await new Promise((resolve) => setTimeout(resolve, wait));
      const r = await fetch("/api/gemini/score-speaking/status/" + encodeURIComponent(job.jobId), { cache: "no-store" });
      if (!r.ok) {
        if (r.status >= 500) {
          failStreak++;
          if (failStreak >= 3) throw new Error("Polling status broken (HTTP " + r.status + ")");
        }
        continue;
      }
      failStreak = 0;
      const status = await r.json();
      if (status.status === "done" && status.result) {
        applyScoreResult(status.result, audioUrl, audioDataUrl, mimeType, question, partLabel, durationMs);
        return true;
      }
      if (status.status === "error") throw new Error(status.error || "Gemini chấm nền thất bại");
    }
    throw new Error("Chấm nền quá lâu — audio vẫn còn, bạn có thể thử lại.");
  }

  // Single source of truth for posting audio → /api/gemini/score-speaking.
  // Returns true on a real result, false otherwise (so the caller can keep the retry banner).
  async function submitScoreRequest({ audioUrl, audioDataUrl, mimeType, question, partLabel, durationMs }) {
    document.getElementById("ln-score-retry")?.remove();
    const apiKey = getKey();
    if (!apiKey) {
      showScoreRetry(audioUrl, audioDataUrl, mimeType, question, partLabel,
        "Chưa cài API key Gemini — vào /settings để thêm key, audio đã được giữ.", durationMs);
      return false;
    }

    // Phase 4: Warn if audio payload size is extremely large (> 4 MB)
    const base64SizeMb = ((audioDataUrl || "").length * 0.75) / (1024 * 1024);
    if (base64SizeMb > 4.0) {
      showToast("Bản ghi âm quá lớn (~" + base64SizeMb.toFixed(1) + "MB). Netlify có thể quá hạn, hãy cân nhắc nói ngắn gọn hơn.");
    }

    const toast = document.createElement("div");
    toast.style.cssText = "position:fixed;top:1rem;right:1rem;background:#d9381e;color:white;padding:.8rem 1.2rem;border-radius:.5rem;z-index:10000;font-family:Lexend,sans-serif;display:inline-flex;align-items:center;gap:.5rem;";
    toast.innerHTML = '<span style="display:inline-block;width:.85rem;height:.85rem;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:ln-spin .9s linear infinite;"></span> Đang chấm điểm…';
    document.body.appendChild(toast);

    // Chọn chế độ chấm theo ĐỘ DÀI thật của audio (không ép theo host nữa):
    //   - Audio NGẮN  -> chấm ĐỒNG BỘ (sync): nhanh, không phải đợi polling nền.
    //     Nếu sync chạm trần 26s của Netlify -> tự fallback sang nền (xử lý bên dưới).
    //   - Audio DÀI / Part 2 / payload lớn -> chấm NỀN (background 900s) ngay từ đầu,
    //     vì sync gần như chắc chắn timeout.
    // "Dài" = Part 2 (độc thoại ~2 phút), hoặc thời lượng > 30s, hoặc base64 > 600k.
    // Manual opt-out: window.LN_ASYNC_SCORE === false.
    const asyncOptOut = typeof window !== "undefined" && window.LN_ASYNC_SCORE === false;
    const isPart2 = /^PART\s*2/i.test(String(partLabel || ""));
    const durationSec = (durationMs || 0) / 1000;
    const isLongAudio = (audioDataUrl || "").length > 600000 || durationSec > 30;
    const allowAsync = !asyncOptOut && (isPart2 || isLongAudio);
    const useAsyncFirst = allowAsync;
    if (useAsyncFirst) {
      try {
        const ok = await startAsyncScoreJob({ apiKey, audioUrl, audioDataUrl, mimeType, question, partLabel, toast, durationMs });
        toast.remove();
        return ok;
      } catch (e) {
        if (/Không tạo được job|Server không trả jobId|Không chạy được job nền|Polling status broken/i.test(String(e?.message || e))) {
          console.warn("[ln-score] async start failed, falling back to sync", e?.message || e);
          toast.innerHTML = '<span style="display:inline-block;width:.85rem;height:.85rem;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:ln-spin .9s linear infinite;"></span> Đang chấm điểm…';
        } else {
          toast.remove();
          showScoreRetry(audioUrl, audioDataUrl, mimeType, question, partLabel, "Lỗi chấm nền: " + (e?.message || e), durationMs);
          return false;
        }
      }
    }

    // Client-side abort just before Netlify's hard ceiling so we surface a useful error.
    const controller = new AbortController();
    const abortMs = 26000;
    const abortTimer = setTimeout(() => controller.abort(new Error("client-timeout")), abortMs);

    // Phase 4: Measuring latency
    console.time("score:sync");
    try {
      const r = await fetch("/api/gemini/score-speaking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-LN-Client-Sync": "1" },
        signal: controller.signal,
        body: JSON.stringify({
          apiKey,
          question, part: partLabel,
          audioBase64: audioDataUrl.split(",")[1] || audioDataUrl,
          mimeType,
          note: localStorage.getItem("ln.userNote") || "",
          durationMs: durationMs || 0
        })
      });
      clearTimeout(abortTimer);
      console.timeEnd("score:sync");
      if (!r.ok) {
        const code = r.status;
        if (code === 504 || code === 408) {
          try {
            const ok = await startAsyncScoreJob({ apiKey, audioUrl, audioDataUrl, mimeType, question, partLabel, toast, durationMs });
            toast.remove();
            return ok;
          } catch (bgErr) {
            console.warn("[ln-score] async fallback after HTTP", code, "failed", bgErr?.message || bgErr);
          }
        }
        const hint = code === 504 || code === 408
          ? "Server quá hạn — thử lại hoặc nói ngắn gọn hơn."
          : "Không gọi được API chấm điểm (HTTP " + code + ").";
        toast.remove();
        showScoreRetry(audioUrl, audioDataUrl, mimeType, question, partLabel, hint, durationMs);
        return false;
      }
      const data = await r.json();
      const modelName = String(data.model || data.provider || "");
      const isFallback = data.provider === "mock" || /local-fallback|mock/i.test(modelName) || !data.transcript || !data.criteria;
      if (isFallback) {
        const warn = String(data?.warning || "").trim();
        let hint = "Gemini chưa trả kết quả thật cho audio này — thử lại nhé.";
        if (/timed?\s*out|timeout|aborted/i.test(warn)) hint = "Gemini quá hạn (audio dài) — thử lại hoặc nói ngắn gọn hơn.";
        else if (/401|invalid|api[_ ]?key|API_KEY/i.test(warn)) hint = "API key Gemini không hợp lệ — kiểm tra lại trong /settings.";
        else if (/429|quota|rate/i.test(warn)) hint = "Gemini đang giới hạn (rate-limit) — đợi ít phút rồi thử lại.";
        else if (/safety|blocked/i.test(warn)) hint = "Audio bị Gemini chặn vì safety — thử nói lại nội dung khác.";
        else if (warn) hint = "Gemini lỗi: " + warn.slice(0, 160);
        if (/timed?\s*out|timeout|aborted/i.test(warn)) {
          try {
            const ok = await startAsyncScoreJob({ apiKey, audioUrl, audioDataUrl, mimeType, question, partLabel, toast, durationMs });
            toast.remove();
            return ok;
          } catch (bgErr) {
            console.warn("[ln-score] async fallback after sync timeout failed", bgErr?.message || bgErr);
          }
        }
        toast.remove();
        showScoreRetry(audioUrl, audioDataUrl, mimeType, question, partLabel, hint, durationMs);
        return false;
      }
      toast.remove();

      applyScoreResult(data, audioUrl, audioDataUrl, mimeType, question, partLabel, durationMs);
      return true;
    } catch (e) {
      clearTimeout(abortTimer);
      console.timeEnd("score:sync");
      toast.remove();
      const isAbort = e?.name === "AbortError" || /timeout/i.test(String(e?.message || ""));
      if (isAbort) {
        const bgToast = document.body.appendChild(Object.assign(document.createElement("div"), {
          style: "position:fixed;top:1rem;right:1rem;background:#d9381e;color:white;padding:.8rem 1.2rem;border-radius:.5rem;z-index:10000;font-family:Lexend,sans-serif;display:inline-flex;align-items:center;gap:.5rem;",
          innerHTML: '<span style="display:inline-block;width:.85rem;height:.85rem;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:ln-spin .9s linear infinite;"></span> Chuyển sang chấm nền…'
        }));
        try {
          const ok = await startAsyncScoreJob({ apiKey, audioUrl, audioDataUrl, mimeType, question, partLabel, toast: bgToast, durationMs });
          bgToast.remove();
          return ok;
        } catch (bgErr) {
          bgToast.remove();
          showScoreRetry(audioUrl, audioDataUrl, mimeType, question, partLabel, "Lỗi chấm nền: " + (bgErr?.message || bgErr), durationMs);
          return false;
        }
      }
      const msg = isAbort
        ? "Mạng/Server quá hạn — hãy thử lại (audio đã giữ)."
        : ("Lỗi chấm điểm: " + (e?.message || e));
      showScoreRetry(audioUrl, audioDataUrl, mimeType, question, partLabel, msg, durationMs);
      return false;
    }
  }

  async function scoreAndSave(blob, durationMs) {
    const audioUrl = URL.createObjectURL(blob);
    const audioDataUrl = await blobToBase64(blob);
    const mimeType = blob.type || REC_STATE.mimeType || "audio/webm";
    const detail = parseDetailRoute?.();
    const question = (detail?.question || getQuestionFromPage()).trim();
    const partLabel = detail?.part || ("PART " + ((location.pathname.match(/PART%20(\d)|PART\s*(\d)|part(\d)/i) || [])[1] || (location.pathname.match(/PART%20(\d)|PART\s*(\d)|part(\d)/i) || [])[2] || (location.pathname.match(/PART%20(\d)|PART\s*(\d)|part(\d)/i) || [])[3] || "1"));
    await submitScoreRequest({ audioUrl, audioDataUrl, mimeType, question, partLabel, durationMs });
  }

  // ──────────────── History playback panel ────────────────
  function patchHistory() {
    // On /question-answer, stripMockHistory handles the full list — skip duplicate rendering here.
    if (/^\/question-answer\/?$/.test(location.pathname)) return;
    // Look for history container — patch with real data
    const histCards = document.querySelectorAll("[class*=history-item], [class*=history-card]");
    if (histCards.length === 0) {
      // Try to find by text
      const hsEls = [...document.querySelectorAll("h2,h3")].filter(e => /lịch sử/i.test(e.textContent || ""));
      if (hsEls.length === 0) return;
      const container = hsEls[0].parentElement;
      if (!container || container.__lnHistPatched) return;
      container.__lnHistPatched = true;
      injectHistory(container);
    }
  }

  function injectHistory(container) {
    const items = LN.history.slice(0, 5);
    if (!items.length) return;
    const wrap = document.createElement("div");
    wrap.id = "ln-history-list";
    wrap.style.cssText = "display:flex;flex-direction:column;gap:.8rem;margin-top:1rem;";
    items.forEach(h => {
      const c = (h.criteria || {});
      const div = document.createElement("div");
      div.style.cssText = "background:#fffbe6;border-radius:.6rem;padding:1rem;font-family:Lexend,sans-serif;";
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;">
          <div style="font-weight:600;font-size:.9rem;color:#171717;">${h.part}: ${h.question || ""}</div>
          <div style="background:#d9381e;color:white;padding:.3rem .6rem;border-radius:9999px;font-weight:700;font-size:.85rem;">${h.overall || "?"}</div>
        </div>
        <div style="display:flex;align-items:center;gap:.6rem;font-size:.85rem;color:#333;">
          <button onclick="this.dataset.url && new Audio(this.dataset.url).play()" data-url="${h.audioDataUrl||''}" style="background:#d9381e;color:white;border:none;border-radius:50%;width:2rem;height:2rem;cursor:pointer;font-size:.9rem;">▶</button>
          <span style="flex:1;font-style:italic;color:#555;">${h.transcript || h.rewrittenAnswer || "Không có transcript"}</span>
        </div>
        ${c.pronunciation ? `
        <div style="display:flex;gap:.4rem;margin-top:.5rem;flex-wrap:wrap;font-size:.75rem;">
          <span style="background:white;padding:.2rem .6rem;border-radius:9999px;">Trôi chảy: ${c.fluency?.score||"?"}</span>
          <span style="background:white;padding:.2rem .6rem;border-radius:9999px;">Từ vựng: ${c.vocabulary?.score||"?"}</span>
          <span style="background:white;padding:.2rem .6rem;border-radius:9999px;">Ngữ pháp: ${c.grammar?.score||"?"}</span>
          <span style="background:white;padding:.2rem .6rem;border-radius:9999px;">Phát âm: ${c.pronunciation?.score||"?"}</span>
        </div>` : ""}
      `;
      wrap.appendChild(div);
    });
    container.appendChild(wrap);
  }

  // ──────────────── Hover Vietnamese tooltip on question cards ────────────────
  // Use a tiny EN→VI dictionary for common patterns; fall back to "Click ▶ để nghe"
  function attachTtsTooltips() {
    document.querySelectorAll("[class*=question], [class*=card]").forEach(el => {
      if (el.__lnTipWired) return;
      const text = (el.innerText || "").trim();
      // Heuristic: contains question mark and English-looking
      if (!/\?$/.test(text) || !/[A-Za-z]/.test(text) || text.length > 200) return;
      el.__lnTipWired = true;
      el.style.position = "relative";

      el.addEventListener("mouseenter", () => {
        if (el.querySelector(".ln-tip")) return;
        const tip = document.createElement("div");
        tip.className = "ln-tip";
        tip.style.cssText = "position:absolute;top:.5rem;right:.5rem;display:flex;gap:.3rem;align-items:center;z-index:50;";
        tip.innerHTML = `<button style="background:#d9381e;color:white;border:none;border-radius:50%;width:1.8rem;height:1.8rem;cursor:pointer;font-size:.8rem;" title="Nghe câu hỏi">▶</button>`;
        tip.querySelector("button").onclick = (ev) => {
          ev.stopPropagation();
          ev.preventDefault();
          speakText(text, tip.querySelector("button"));
        };
        el.appendChild(tip);
      });
      el.addEventListener("mouseleave", () => {
        el.querySelector(".ln-tip")?.remove();
      });
    });
  }

  // ──────────────── Topic tab filtering (Part 1/2/3 pages) ────────────────
  function wireTopicTabs() {
    // Map data-topic value → section ID (strip spaces, keep other chars)
    function topicToId(t) {
      return t.replace(/\s/g, "") + "Section";
    }

    const items = document.querySelectorAll(".topic-item[data-topic]");
    if (!items.length) return;

    // Collect all section IDs from current page
    const allSectionIds = [...document.querySelectorAll("[id$='Section']")].map(el => el.id);

    items.forEach(item => {
      if (item.__lnTabWired) return;
      item.__lnTabWired = true;

      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const topic = item.dataset.topic;
        const targetId = topicToId(topic);

        // Make sure every section is visible (in case any was hidden earlier)
        allSectionIds.forEach(id => {
          const sec = document.getElementById(id);
          if (sec) sec.style.display = "";
        });

        // Just scroll to the target section — keep all other sections visible
        const target = document.getElementById(targetId);
        if (target) {
          const main = document.querySelector("main");
          if (main) main.scrollTo({ top: target.offsetTop - 16, behavior: "smooth" });
          else target.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        // Highlight active topic item
        document.querySelectorAll(".topic-item[data-topic]").forEach(el => {
          el.classList.remove("bg-primary-content", "border-primary");
          el.style.background = "";
          el.style.borderColor = "";
        });
        item.classList.add("bg-primary-content");
        item.style.background = "var(--pc, #fffbe6)";
        item.style.borderColor = "var(--p, #d9381e)";

        // Close mobile drawer
        const drawer = document.getElementById("my-drawer");
        if (drawer) drawer.checked = false;
      });
    });

    // Part 2 / Part 3 use <div role="tab"> with text Person/Object/Activity/Place
    // (no data-topic). Wire them to scroll to the matching section in the left panel.
    document.querySelectorAll("[role='tab']").forEach(tab => {
      if (tab.__lnPart2TabWired) return;
      const text = (tab.textContent || "").trim();
      if (!/^(Person|Object|Activity|Place)$/i.test(text)) return;
      tab.__lnPart2TabWired = true;
      tab.style.cursor = "pointer";
      tab.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        const sec = document.getElementById(text + "Section");
        // Always show every section in Part 2 (it's a flat list), then scroll
        allSectionIds.forEach(id => {
          const s = document.getElementById(id);
          if (s) s.style.display = "";
        });
        if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
        // Visual highlight on the active tab
        document.querySelectorAll("[role='tab']").forEach(t => t.classList.remove("tab-active"));
        tab.classList.add("tab-active");
      });
    });

    // Wire "show all" — click on already-active or if there's an "All" button
    document.querySelectorAll("[data-topic='all'], .btn-all-topics").forEach(btn => {
      if (btn.__lnTabWired) return;
      btn.__lnTabWired = true;
      btn.addEventListener("click", () => {
        allSectionIds.forEach(id => {
          const sec = document.getElementById(id);
          if (sec) sec.style.display = "";
        });
      });
    });
  }

  // ──────────────── Detail page full-screen layout ────────────────
  function fixDetailLayout() {
    // Set --vh variable for mobile viewport
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty("--vh", vh + "px");
    window.addEventListener("resize", () => {
      document.documentElement.style.setProperty("--vh", (window.innerHeight * 0.01) + "px");
    });
    // Do NOT manipulate hidden classes — that breaks layout on mobile
  }

  // ──────────────── Highlight → Dịch / Lưu action buttons ────────────────
  (function initSelectionActions() {
    document.querySelectorAll("#ln-sel-pop").forEach(el => el.remove());
    let pop = null;

    function showSelectionPopup(clientX, clientY) {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      // Remove any existing popup
      if (pop) { pop.remove(); pop = null; }
      if (!text || text.length < 2 || text.length > 120) return;

      // On question detail pages, allow everywhere; on others, only in AI panels
      const isDetailPage = /\/question-answer\/PART/i.test(location.pathname);
      if (!isDetailPage) return;

      console.log("[sel-pop] showing for:", text.slice(0, 30));
      pop = document.createElement("div");
      pop.id = "ln-sel-pop";
      pop.style.cssText = "position:fixed;background:white;border:1.5px solid #d1d5db;border-radius:.5rem;box-shadow:0 4px 16px rgba(0,0,0,.22);padding:.3rem;z-index:2147483646;display:flex;gap:.3rem;font-family:Lexend,sans-serif;";
      // Position near mouse, but keep on screen
      const left = Math.min(clientX + 4, window.innerWidth - 180);
      const top = Math.max(clientY - 42, 8);
      pop.style.left = left + "px";
      pop.style.top = top + "px";
      pop.innerHTML = `
        <button class="ln-sel-dich-btn" style="background:#fffbe6;color:#d9381e;border:1px solid #d9381e;padding:.35rem .7rem;border-radius:.35rem;font-size:.8rem;cursor:pointer;font-weight:700;white-space:nowrap;">🌐 Dịch</button>
        <button class="ln-sel-luu-btn" style="background:#fef3c7;color:#92400e;border:1px solid #b45309;padding:.35rem .7rem;border-radius:.35rem;font-size:.8rem;cursor:pointer;font-weight:700;white-space:nowrap;">📌 Lưu</button>`;
      document.body.appendChild(pop);

      pop.querySelector(".ln-sel-dich-btn").addEventListener("click", async (ev) => {
        ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
        const btn = ev.currentTarget;
        btn.textContent = "⏳ Đang dịch...";
        try {
          const r = await realFetch("/api/gemini/assist", {
            method: "POST", headers: {"Content-Type":"application/json"},
            body: JSON.stringify({ apiKey: getKey(), model: getModel(), kind: "translate", topic: text })
          });
          const data = await r.json();
          // Close popup
          if (pop) { pop.remove(); pop = null; }
          // Render as vocab card in right panel (like Từ vựng chủ đề)
          const w = {
            phrase: data.phrase || text,
            pos: data.pos || "",
            vi: data.vi || data.translation || "",
            example: data.example || ""
          };
          const cardData = { words: [w], model: data.model || data.provider || "", __title: "Tra từ" };
          showAssistResult(cardData, "translate-" + text.length + "_" + (text.charCodeAt(0)||0), { skipAutoSpeak: true });
          // Also auto-save to phrases
          try {
            const arr = JSON.parse(localStorage.getItem("ln.savedPhrases") || "[]");
            if (!arr.some(p => p.text === text)) {
              arr.unshift({ text, vi: w.vi, ts: Date.now(), q: getQuestionFromPage() });
              localStorage.setItem("ln.savedPhrases", JSON.stringify(arr.slice(0,200)));
            }
          } catch {}
        } catch (err) { if (pop) { pop.remove(); pop = null; } alert("Dịch lỗi: " + (err?.message||err)); }
      });
      pop.querySelector(".ln-sel-luu-btn").addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
        try {
          const arr = JSON.parse(localStorage.getItem("ln.savedPhrases") || "[]");
          arr.unshift({ text, ts: Date.now(), q: getQuestionFromPage() });
          localStorage.setItem("ln.savedPhrases", JSON.stringify(arr.slice(0,200)));
          ev.currentTarget.textContent = "✅ Đã lưu";
        } catch { ev.currentTarget.textContent = "⚠ Lỗi lưu"; }
        setTimeout(() => { if (pop) { pop.remove(); pop = null; } }, 1500);
      });
    }

    // Use multiple strategies to catch selection end
    function onPointerOrMouseUp(e) {
      // Ignore clicks on popup buttons
      if (pop && pop.contains(e.target)) return;
      // Ignore buttons/inputs
      if (e.target.closest && e.target.closest("button, input, textarea, select, .ln-sel-dich-btn, .ln-sel-luu-btn")) {
        // But still clear popup if clicking a non-popup button
        if (pop && !pop.contains(e.target)) { pop.remove(); pop = null; }
        return;
      }
      // Delay slightly so browser finalizes the selection
      const cx = e.clientX, cy = e.clientY;
      setTimeout(() => showSelectionPopup(cx, cy), 10);
    }

    // Register on document — bubble phase only to avoid double-fire
    document.addEventListener("mouseup", onPointerOrMouseUp, false);
    // Also dismiss popup on any click outside it
    document.addEventListener("mousedown", (e) => {
      if (pop && !pop.contains(e.target)) { pop.remove(); pop = null; }
    }, true);
    console.log("[sel-pop] handler registered");
  })();

  // ──────────────── Auto cue-cards for Part 2 detail pages ────────────────
  async function autoLoadCueCards() {
    if (document.getElementById("ln-cuecards")) return;
    if (!/\/question-answer\/PART%202~/i.test(location.pathname)) return;
    const contentArea = getRightPanelContent();
    if (!contentArea) return;
    if (contentArea.querySelector("#ln-assist-panel, #ln-cuecards")) return;

    const question = getQuestionFromPage();
    if (!question) return;

    function renderCues(cues) {
      const ph = document.createElement("div");
      ph.id = "ln-cuecards";
      ph.style.cssText = "padding:.8rem;font-family:Lexend,sans-serif;";
      ph.innerHTML = `
        <div style="font-size:.9rem;color:#171717;font-weight:600;margin-bottom:.6rem;">You should say:</div>
        ${cues.map(c => `<div style="display:flex;align-items:flex-start;gap:.4rem;font-size:.82rem;color:#374151;line-height:1.6;margin-bottom:.35rem;"><span style="color:#d9381e;">↳</span><span>${c}</span></div>`).join("")}
        <div style="border-bottom:1px solid #e5e7eb;margin:.8rem 0 .4rem;"></div>`;
      contentArea.prepend(ph);
    }

    // 1) Try static cuecards.json (pre-scraped, 88 sets)
    try {
      if (!window.__lnCueCardsData) {
        const r = await realFetch("/data/cuecards.json");
        if (r.ok) window.__lnCueCardsData = await r.json();
      }
      if (window.__lnCueCardsData) {
        // Find by exact title match or partial match
        const qLower = question.toLowerCase().trim();
        let cues = null;
        for (const [title, cards] of Object.entries(window.__lnCueCardsData)) {
          if (title.toLowerCase().trim() === qLower || qLower.includes(title.toLowerCase().trim()) || title.toLowerCase().trim().includes(qLower)) {
            cues = cards; break;
          }
        }
        if (cues && cues.length) { renderCues(cues); return; }
      }
    } catch {}

    // 2) Try localStorage cache
    const cacheK = "ln.cuecards:" + encodeURIComponent(question);
    try {
      const cached = JSON.parse(localStorage.getItem(cacheK) || "null");
      if (cached && cached.length) { renderCues(cached); return; }
    } catch {}

    // 3) Last resort — call AI and cache result
    const ph = document.createElement("div");
    ph.id = "ln-cuecards";
    ph.style.cssText = "padding:.8rem;font-family:Lexend,sans-serif;";
    ph.innerHTML = `<div style="font-size:.85rem;color:#d9381e;font-weight:600;margin-bottom:.5rem;">You should say:</div><div style="color:#9ca3af;font-size:.8rem;">⏳ Đang tải gợi ý...</div>`;
    contentArea.prepend(ph);
    try {
      const r = await realFetch("/api/gemini/assist", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ apiKey: getKey(), model: getModel(), kind: "cuecards", topic: question })
      });
      const data = await r.json();
      const cues = data.cues || [];
      if (!cues.length) { ph.remove(); return; }
      try { localStorage.setItem(cacheK, JSON.stringify(cues)); } catch {}
      ph.innerHTML = `
        <div style="font-size:.9rem;color:#171717;font-weight:600;margin-bottom:.6rem;">You should say:</div>
        ${cues.map(c => `<div style="display:flex;align-items:flex-start;gap:.4rem;font-size:.82rem;color:#374151;line-height:1.6;margin-bottom:.35rem;"><span style="color:#d9381e;">↳</span><span>${c}</span></div>`).join("")}
        <div style="border-bottom:1px solid #e5e7eb;margin:.8rem 0 .4rem;"></div>`;
    } catch {
      ph.remove();
    }
  }

  // ──────────────── Note modal popup ────────────────
  function openNoteModal() {
    if (document.getElementById("ln-note-modal")) {
      document.getElementById("ln-note-input")?.focus();
      return;
    }
    const overlay = document.createElement("div");
    overlay.id = "ln-note-modal";
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:99998;display:flex;align-items:center;justify-content:center;font-family:Lexend,sans-serif;padding:1rem;";
    overlay.innerHTML = `
      <div style="background:white;border-radius:1rem;box-shadow:0 20px 60px rgba(0,0,0,.3);width:100%;max-width:480px;padding:1.4rem 1.4rem 1.2rem;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.8rem;">
          <div>
            <h3 style="margin:0;font-size:1.05rem;color:#171717;font-weight:700;">✏️ Ghi chú ý tưởng</h3>
            <p style="margin:.2rem 0 0;font-size:.78rem;color:#6b7280;">Viết ý tưởng bằng <b>tiếng Việt hoặc tiếng Anh</b>. AI sẽ dựa vào đó để tạo câu mẫu.</p>
          </div>
          <button id="ln-note-x" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:#9ca3af;line-height:1;">×</button>
        </div>
        <textarea id="ln-note-input" placeholder="Ví dụ: Hồi nhỏ tôi không gọn gàng lắm, hay bày đồ chơi khắp phòng, mẹ luôn nhắc nhở..." rows="5"
          style="width:100%;border:1.5px solid #d1d5db;border-radius:.5rem;padding:.7rem .8rem;font-size:.88rem;font-family:Lexend,sans-serif;resize:vertical;outline:none;box-sizing:border-box;line-height:1.5;"></textarea>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:.8rem;">
          <span style="font-size:.7rem;color:#9ca3af;">💡 Đã lưu tự động</span>
          <div style="display:flex;gap:.4rem;">
            <button id="ln-note-cancel" style="background:transparent;border:1.5px solid #d1d5db;color:#374151;border-radius:.4rem;padding:.45rem 1rem;font-size:.85rem;cursor:pointer;font-family:Lexend,sans-serif;">Huỷ</button>
            <button id="ln-note-gen" class="ln-note-gen-action" style="background:#d9381e;color:white;border:none;border-radius:.4rem;padding:.45rem 1.1rem;font-size:.85rem;cursor:pointer;font-weight:600;font-family:Lexend,sans-serif;">Tạo câu mẫu</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const ta = overlay.querySelector("#ln-note-input");
    const genBtn = overlay.querySelector("#ln-note-gen");
    if (genBtn) {
      genBtn.textContent = "Tạo câu mẫu";
      genBtn.setAttribute("aria-label", "Tạo câu mẫu");
      genBtn.style.setProperty("display", "inline-flex", "important");
      genBtn.style.setProperty("align-items", "center", "important");
      genBtn.style.setProperty("justify-content", "center", "important");
      genBtn.style.setProperty("min-width", "142px", "important");
      genBtn.style.setProperty("min-height", "38px", "important");
      genBtn.style.setProperty("color", "#ffffff", "important");
      genBtn.style.setProperty("font-size", "14px", "important");
      genBtn.style.setProperty("line-height", "1.2", "important");
      genBtn.style.setProperty("text-indent", "0", "important");
      genBtn.style.setProperty("opacity", "1", "important");
      genBtn.style.setProperty("visibility", "visible", "important");
    }
    const saved = localStorage.getItem("ln.userNote");
    if (saved) ta.value = saved;
    ta.focus();
    ta.addEventListener("input", () => { try { localStorage.setItem("ln.userNote", ta.value); } catch {} });
    overlay.querySelector("#ln-note-x").onclick = () => overlay.remove();
    overlay.querySelector("#ln-note-cancel").onclick = () => overlay.remove();
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector("#ln-note-gen").onclick = async (ev) => {
      const btn = ev.currentTarget;
      if (btn.__lnBusy) return;
      try {
        await assistGemini("note", btn);
      } finally {
        // Modal closes after assist completes (success or failure); guard cleanup is handled by assistGemini's finally block.
        overlay.remove();
      }
    };
  }

  // ──────────────── Wire Ghi chú button to open modal ────────────────
  function injectNoteInput() {
    const isDetail = /\/question-answer\/PART/i.test(location.pathname);
    if (!isDetail) return;

    // Find .group.cursor-pointer whose text includes "Ghi chú" and "tạo câu"
    // The font-medium div has an SVG child so we can't rely on leaf-only check
    let noteBtn = null;
    for (const el of document.querySelectorAll(".group.cursor-pointer, .group[class*='cursor-pointer']")) {
      if (el.__lnNoteWired) continue;
      const t = (el.textContent || "").trim();
      if (/ghi chú.*tạo câu|tạo câu.*ghi chú/i.test(t)) { noteBtn = el; break; }
    }
    // Fallback: search any element with matching text
    if (!noteBtn) {
      for (const el of document.querySelectorAll("[class*='cursor-pointer']")) {
        if (el.__lnNoteWired) continue;
        if (el === document.body || el === document.documentElement) continue;
        const t = (el.textContent || "").trim();
        if (/ghi chú.*tạo câu|tạo câu.*ghi chú/i.test(t) && t.length < 80) { noteBtn = el; break; }
      }
    }
    if (!noteBtn) return;
    noteBtn.__lnNoteWired = true;

    // Click → open centered modal popup
    noteBtn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      openNoteModal();
    });
  }

  // ──────────────── Wire the header play button on detail pages ────────────────
  function wireHeaderPlayButton() {
    // The breadcrumb on detail pages has a <button> with the play-triangle SVG
    // (the original SvelteKit handler doesn't fire on the static snapshot).
    document.querySelectorAll(".breadcrumbs button").forEach(btn => {
      if (btn.__lnPlayWired) return;
      const svg = btn.querySelector("svg");
      if (!svg) return;
      // Detect play-triangle path data
      const hasPlay = !!btn.querySelector('path[d^="M240 128"], path[d*="M88.32 229.65"]');
      if (!hasPlay) return;
      btn.__lnPlayWired = true;
      btn.style.cursor = "pointer";
      btn.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        // Find the question text — the sibling <p> in the same <li>
        const li = btn.closest("li") || btn.parentElement;
        const pEl = li?.querySelector("p");
        const text = (pEl?.textContent || getQuestionFromPage() || "").trim();
        if (!text) return;
        speakText(text, btn);
      });
    });
  }

  // ──────────────── Inline IPA transcription via LuyenDoc dict (the ONE engine) ────────────────
  // Loads LuyenDoc's 20,043-word IPA dictionary (chunk BhbigMMl.js) ONCE, on first
  // call. After that, lookup is sync + instant. No API call, no Gemini quota burn.
  // Exposed as window.lnTranscribe(text) → Promise<{ipa, perWord}>.
  let LD_DICT = null;        // Map<string, {ipa, graph2I, stress}>
  let LD_DICT_LOAD = null;   // Promise while loading
  async function loadLuyenDocDict() {
    if (LD_DICT) return LD_DICT;
    if (LD_DICT_LOAD) return LD_DICT_LOAD;
    LD_DICT_LOAD = (async () => {
      try {
        // The chunk path may change if LuyenDoc rebuilds — we keep it explicit here.
        const mod = await import("/luyendoc/_app/immutable/chunks/BhbigMMl.js");
        // Find the exported array of entries (each {txt, sylls, graph2I, stress})
        let arr = null;
        for (const k of Object.keys(mod)) {
          const v = mod[k];
          if (Array.isArray(v) && v.length > 100 && v[0]?.txt && v[0]?.graph2I) { arr = v; break; }
        }
        if (!arr) { console.warn("[LN-IPA] dict shape mismatch", Object.keys(mod)); LD_DICT = new Map(); return LD_DICT; }
        const dict = new Map();
        for (const entry of arr) {
          if (!entry?.txt || !Array.isArray(entry.graph2I)) continue;
          // Concatenate the per-grapheme IPA into one full word IPA, with stress marker prepended.
          const ipa = entry.graph2I.map(g => g.ipa || "").join("");
          dict.set(entry.txt.toLowerCase(), { ipa, graph2I: entry.graph2I, stress: entry.stress, sylls: entry.sylls });
        }
        console.log("[LN-IPA] LuyenDoc dictionary loaded:", dict.size, "words");
        LD_DICT = dict;
        return dict;
      } catch (e) {
        console.warn("[LN-IPA] failed to load LuyenDoc dict, will fall back to Gemini", e);
        LD_DICT = new Map();
        return LD_DICT;
      }
    })();
    return LD_DICT_LOAD;
  }
  // Kick off dictionary load right away (background)
  loadLuyenDocDict();

  // Synchronous lookup once dict is loaded. Returns {ipa, graph2I, stress, sylls} or null.
  window.lnLookupDict = function (word) {
    if (!LD_DICT) return null;
    const key = String(word || "").toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, "");
    return LD_DICT.get(key) || null;
  };
  window.lnDictReady = () => loadLuyenDocDict();

  const LN_IPA_CACHE_KEY = "ln.ipaCache";
  function loadIpaCache() { try { return JSON.parse(localStorage.getItem(LN_IPA_CACHE_KEY) || "{}"); } catch { return {}; } }
  function saveIpaCache(cache) {
    try {
      const entries = Object.entries(cache);
      if (entries.length > 500) {
        const trimmed = Object.fromEntries(entries.slice(-500));
        localStorage.setItem(LN_IPA_CACHE_KEY, JSON.stringify(trimmed));
      } else {
        localStorage.setItem(LN_IPA_CACHE_KEY, JSON.stringify(cache));
      }
    } catch {}
  }

  // Strip word to its lookup key
  const normWord = w => String(w || "").toLowerCase().replace(/[^a-z']/g, "");

  // Wrap raw IPA from dict into "/.../" with stress mark if available
  function formatIpa(entry) {
    if (!entry) return "";
    let ipa = entry.ipa || "";
    if (!ipa) return "";
    // Prepend primary stress mark "Ëˆ" — LuyenDoc dict stores stress as a syllable index but we
    // already have it inside graph2I per-syllable. We keep raw concat for simplicity.
    return "/" + ipa + "/";
  }

  window.lnTranscribe = async function (text, opts = {}) {
    const cleaned = String(text || "").trim();
    if (!cleaned) return { ipa: "", perWord: [] };

    // Long-text localStorage cache (for full sentences/phrases the dict has built up)
    const cache = loadIpaCache();
    const cacheKey = cleaned.toLowerCase();
    if (cache[cacheKey]) return cache[cacheKey];

    // 1) Try LuyenDoc dictionary
    const dict = await loadLuyenDocDict();
    const words = cleaned.split(/\s+/);
    const perWord = [];
    let missing = 0;
    for (const w of words) {
      const k = normWord(w);
      if (!k) continue;
      const entry = dict.get(k);
      if (entry) {
        perWord.push({ word: w, ipa: formatIpa(entry) });
      } else {
        perWord.push({ word: w, ipa: "/" + k + "/" }); // placeholder if not in dict
        missing++;
      }
    }
    const allFound = missing === 0;
    if (allFound && perWord.length) {
      const out = { ipa: perWord.map(x => x.ipa).join(" "), perWord, source: "luyendoc" };
      cache[cacheKey] = out;
      saveIpaCache(cache);
      return out;
    }

    // 2) If any words missing, optionally fall back to Gemini (still 1 API call max)
    const key = (typeof getKey === "function") ? getKey() : "";
    if (!key) {
      // No key — return what dict gave us with the placeholders
      const out = { ipa: perWord.map(x => x.ipa).join(" "), perWord, source: "luyendoc-partial", warning: `${missing} từ chưa có trong dict` };
      return out;
    }
    try {
      const r = await realFetch("/api/gemini/ipa", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key, model: (typeof getModel === "function" ? getModel() : ""), text: cleaned, style: opts.style || "british" })
      });
      const data = await r.json();
      const out = { ipa: data.ipa || "", perWord: data.perWord || perWord, source: "gemini", warning: data.warning };
      if (out.ipa) { cache[cacheKey] = out; saveIpaCache(cache); }
      return out;
    } catch (e) {
      return { ipa: perWord.map(x => x.ipa).join(" "), perWord, source: "luyendoc-partial", warning: e.message };
    }
  };

  // ──────────────── "Phiên âm cả câu" button on detail pages — INLINE ────────────────
  function injectTranscribeButton() {
    if (!/^\/question-answer\/PART/i.test(location.pathname)) return;
    if (document.__lnTranscribeBtn) return;
    const li = [...document.querySelectorAll(".breadcrumbs li")].find(l => l.querySelector("p"));
    if (!li) return;
    document.__lnTranscribeBtn = true;
    const p = li.querySelector("p");
    const q = (p?.textContent || "").trim();
    if (!q) return;
    // Wrap to allow positioning IPA result inline
    const wrap = document.createElement("span");
    wrap.style.cssText = "display:inline-flex;align-items:center;gap:.4rem;margin-left:.5rem;flex-wrap:wrap;";
    const btn = document.createElement("button");
    btn.style.cssText = "background:#fffbe6;color:#d9381e;border:none;border-radius:9999px;padding:.25rem .7rem;font-size:.72rem;font-weight:600;cursor:pointer;font-family:Lexend,sans-serif;display:inline-flex;align-items:center;gap:.3rem;";
    btn.innerHTML = "🔤 Phiên âm";
    btn.title = "Hiện IPA của câu này";
    const ipaSpan = document.createElement("span");
    ipaSpan.style.cssText = "font-family:'Segoe UI',sans-serif;color:#d9381e;font-size:.85rem;font-weight:500;";
    wrap.appendChild(btn);
    wrap.appendChild(ipaSpan);
    li.appendChild(wrap);

    btn.addEventListener("click", async (e) => {
      e.preventDefault(); e.stopPropagation();
      if (ipaSpan.textContent) {
        // Toggle: clear if already shown
        ipaSpan.textContent = "";
        btn.innerHTML = "🔤 Phiên âm";
        return;
      }
      btn.innerHTML = "⏳ Đang phiên âm…";
      btn.disabled = true;
      const res = await window.lnTranscribe(q);
      btn.disabled = false;
      btn.innerHTML = "🔤 Ẩn";
      if (res.warning) {
        ipaSpan.textContent = "⚠ " + res.warning;
        ipaSpan.style.color = "var(--red)";
      } else {
        ipaSpan.textContent = res.ipa || "(không có kết quả)";
        ipaSpan.style.color = "#d9381e";
      }
    });
  }

  // (Removed) "LuyenDoc · IPA" sidebar nav. Transcriber is now an inline utility
  // (`window.lnTranscribe`), not a separate destination. The LuyenDoc static site
  // still serves under /luyendoc/* for the sound-to-phonogram "Học sâu" links
  // inside the pronun course — those are intentional cross-references only.
  function injectLuyenDocNav() {
    // Find the "Thi thử" link in the SIDEBAR <aside> — its <li> is our insertion anchor
    const aside = document.querySelector("aside, .menu");
    const thiThu = (aside || document).querySelector('a[href="/take-test/home"], a[href="/take-test/"], a[href="/take-test"]');
    if (!thiThu) return;
    const sourceLi = thiThu.closest("li");
    if (!sourceLi) return;
    // Idempotency: per-item check is done in the loop below (scoped to the nav menu, not the whole page)
    const navMenu = thiThu.closest("ul") || aside;
    const path = location.pathname;

    // SVG icon paths (Phosphor-ish, 256x256 viewBox to match other icons)
    const ICONS = {
      reading: "M48 56a16 16 0 0 1 16-16h32a32 32 0 0 1 32 32v144a8 8 0 0 1-13.66 5.66A20 20 0 0 0 100 216H56a8 8 0 0 1-8-8Zm96 16a32 32 0 0 1 32-32h32a16 16 0 0 1 16 16v152a8 8 0 0 1-8 8h-44a20 20 0 0 0-14.34 5.66A8 8 0 0 1 144 216Z",
      pronun:  "M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24m0 192a88 88 0 1 1 88-88a88.1 88.1 0 0 1-88 88m8-136h-32a8 8 0 0 0-8 8v80a8 8 0 0 0 16 0v-16h24a36 36 0 0 0 0-72m0 56h-24V96h24a20 20 0 0 1 0 40",
      vocab:   "M208 24H72A32 32 0 0 0 40 56v144a32 32 0 0 0 32 32h136a8 8 0 0 0 0-16h-8v-16h8a8 8 0 0 0 8-8V32a8 8 0 0 0-8-8m-24 168H72a16 16 0 0 1-16-16a16 16 0 0 1 16-16h112Zm0-48H72a32 32 0 0 0-16 4.29V56a16 16 0 0 1 16-16h112Z",
      boxing:  "M20 128a76.08 76.08 0 0 1 76-76h99l-3.52-3.51a12 12 0 1 1 17-17l24 24a12 12 0 0 1 0 17l-24 24a12 12 0 0 1-17-17L195 76H96a52.06 52.06 0 0 0-52 52a12 12 0 0 1-24 0m204-12a12 12 0 0 0-12 12a52.06 52.06 0 0 1-52 52H61l3.52-3.51a12 12 0 1 0-17-17l-24 24a12 12 0 0 0 0 17l24 24a12 12 0 1 0 17-17L61 204h99a76.08 76.08 0 0 0 76-76a12 12 0 0 0-12-12",
      pastTense: "M128 24a104 104 0 1 0 104 104A104.12 104.12 0 0 0 128 24m0 192a88 88 0 1 1 88-88a88.1 88.1 0 0 1-88 88m54.34-114.34a8 8 0 0 1 0 11.32l-48 48a8 8 0 0 1-11.32 0l-24-24a8 8 0 0 1 11.32-11.32L128 144.69l42.34-42.35a8 8 0 0 1 12 0M76 80a8 8 0 0 1-8 8H44a8 8 0 0 1 0-16h24a8 8 0 0 1 8 8",
      intonation: "M32 200a8 8 0 0 0 8-8c0-43.36 27.42-80 60-80s60 36.64 60 80a8 8 0 0 0 16 0c0-43.36 27.42-80 60-80a8 8 0 0 0 0-16c-32.36 0-60.74 18.18-76 47.16C144.74 114.18 116.36 96 84 96a8 8 0 0 0 0 16c32.58 0 60 36.64 60 80a8 8 0 0 0 16 0",
      rhythm: "M40 56v144a16 16 0 0 0 16 16h144a16 16 0 0 0 16-16V56a16 16 0 0 0-16-16H56a16 16 0 0 0-16 16m24 8h16v128H64Zm40 16h16v112h-16Zm40 24h16v88h-16Zm40-24h16v112h-16Z"
    };

    const ITEMS = [
      { href: "/reading",                  label: "Luyện đọc",         iconKey: "reading" },
      { href: "/alphafeature/pronun",      label: "Khoá phát âm",      iconKey: "pronun"  },
      { href: "/alphafeature/vocab",       label: "Sổ từ vựng",        iconKey: "vocab"   },
      { href: "/alphafeature/boxing",      label: "Luyện S/es",        iconKey: "boxing"  },
      { href: "/alphafeature/past-tense",  label: "Luyện thì quá khứ", iconKey: "pastTense" },
      { href: "/alphafeature/intonation",  label: "Luyện intonation",  iconKey: "intonation" },
      { href: "/alphafeature/rhythm",      label: "Luyện rhythm",      iconKey: "rhythm" },
    ];
    // Insert in order: Thi thử → Luyện đọc → Phát âm → Vocab → S/es
    let anchor = sourceLi;
    ITEMS.forEach((it) => {
      // Duplicate check scoped to the sidebar nav only (NOT the whole page —
      // home.html's main content also has links to these features as buttons)
      if (navMenu?.querySelector(`a[href="${it.href}"]`)) {
        // Already exists in sidebar — move anchor to it so we keep order
        const existing = navMenu.querySelector(`a[href="${it.href}"]`).closest("li");
        if (existing) anchor = existing;
        return;
      }
      const active = path === it.href || path.startsWith(it.href + "/");
      const li = document.createElement("li");
      li.innerHTML = `
        <a href="${it.href}" rel="noopener noreferrer" class="${active ? "bg-base-300" : ""}">
          <svg viewBox="0 0 256 256" width="1.2em" height="1.2em" class="h-6 w-6">
            <path fill="currentColor" d="${ICONS[it.iconKey]}"/>
          </svg>
          <span class="font-medium">${it.label}</span>
        </a>`;
      anchor.insertAdjacentElement("afterend", li);
      anchor = li;
    });

    // ─── Add sub-items under "Luyện theo câu" and "Thi thử" ───
    addSubItems(navMenu, '/question-answer', [
      { href: "/question-answer/part1", label: "PART 1" },
      { href: "/question-answer/part2", label: "PART 2" },
      { href: "/question-answer/part3", label: "PART 3" },
      { href: "/question-answer/user-question", label: "Tự thêm câu" },
    ], path);
    addSubItems(navMenu, '/take-test/home', [
      { href: "/take-test/part1", label: "PART 1" },
      { href: "/take-test/part2", label: "PART 2" },
      { href: "/take-test/part3", label: "PART 3" },
      { href: "/take-test/full-test", label: "FULL TEST" },
      { href: "/take-test/custom-strict", label: "Tùy chọn đề" },
    ], path);
  }

  // Append sub-item links under a parent nav <li>. Sub-items appear as a small
  // indented list right below the parent, visible all the time (no expand toggle).
  function addSubItems(navMenu, parentHref, subs, path) {
    if (!navMenu) return;
    const parentLink = navMenu.querySelector(`a[href="${parentHref}"], a[href="${parentHref}/"]`);
    const parentLi = parentLink?.closest("li");
    if (!parentLi || parentLi.__lnSubsDone) return;
    parentLi.__lnSubsDone = true;
    const sub = document.createElement("ul");
    sub.style.cssText = "list-style:none;padding:0 0 .3rem 1.7rem;margin:0;display:flex;flex-direction:column;gap:.1rem;";
    subs.forEach((s) => {
      const active = path === s.href || path.startsWith(s.href + "/");
      const li = document.createElement("li");
      li.innerHTML = `
        <a href="${s.href}" rel="noopener noreferrer"
           style="display:flex;align-items:center;padding:.3rem .7rem;border-radius:.4rem;font-size:.78rem;color:${active ? "#d9381e" : "#6b7280"};text-decoration:none;font-weight:${active ? "600" : "500"};background:${active ? "#fffbe6" : "transparent"};"
           onmouseover="this.style.background='#fffbe6';this.style.color='#d9381e';"
           onmouseout="this.style.background='${active ? "#fffbe6" : "transparent"}';this.style.color='${active ? "#d9381e" : "#6b7280"}';">
          <span style="display:inline-block;width:1rem;color:#FFD700;">›</span>
          <span>${s.label}</span>
        </a>`;
      sub.appendChild(li);
    });
    parentLi.appendChild(sub);
  }

  // ──────────────── Band breakdown tooltip on home page ────────────────
  function wireBandTooltip() {
    if (document.__lnBandWired) return;
    // Only run on home page where "Ước lượng Band:" lives
    if (!/^\/?$|^\/(home)?\/?$/.test(location.pathname)) return;
    const labels = [...document.querySelectorAll("span, div, p")].filter(el =>
      el.children.length === 0 && /^\s*Ước lượng Band:?\s*$/i.test((el.textContent || "").trim())
    );
    if (!labels.length) return;
    document.__lnBandWired = true;
    const host = labels[0];
    // Stay within the IMMEDIATE row that contains the label — do NOT walk up to a big wrapper.
    const row = host.parentElement;
    if (!row) return;
    let infoBtn = row.querySelector(".ln-band-info");
    if (!infoBtn) {
      infoBtn = document.createElement("button");
      infoBtn.className = "ln-band-info";
      infoBtn.style.cssText = "background:none;border:none;color:#d9381e;cursor:pointer;padding:0;margin-left:.3rem;font-size:1rem;display:inline-flex;align-items:center;";
      infoBtn.innerHTML = "ⓘ";
      infoBtn.title = "Cơ chế tính band — click để xem chi tiết";
      row.appendChild(infoBtn);
    }
    infoBtn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); showBandModal(); });
  }

  function showBandModal() {
    document.getElementById("ln-band-modal")?.remove();
    const s = LN.state;
    const br = s.bandBreakdown || lastBandBreakdown || { components: [], final: s.band || 5.0, fallback: true };
    const compRows = (br.components || []).map(c => `
      <div style="display:flex;justify-content:space-between;gap:.7rem;padding:.55rem .7rem;border-bottom:1px solid #f3f4f6;">
        <div style="flex:1;">
          <div style="font-weight:600;color:#171717;font-size:.9rem;">${escHtml(c.label)}</div>
          <div style="font-size:.72rem;color:#9ca3af;">Trọng số ${Math.round(c.weight*100)}%</div>
        </div>
        <div style="font-weight:800;color:#d9381e;font-size:1rem;align-self:center;">${(+c.value).toFixed(1)}</div>
      </div>
    `).join("");
    const ov = document.createElement("div");
    ov.id = "ln-band-modal";
    ov.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:Lexend,sans-serif;padding:1rem;";
    ov.innerHTML = `
      <div style="background:white;border-radius:1rem;max-width:480px;width:100%;box-shadow:0 12px 48px rgba(0,0,0,.25);overflow:hidden;">
        <div style="padding:1.1rem 1.3rem .7rem;display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;">
          <div>
            <div style="font-size:.74rem;color:#9ca3af;font-weight:700;">CƠ CHẾ ƯỚC LƯỢNG BAND</div>
            <div style="font-size:1.05rem;font-weight:700;color:#171717;margin-top:.15rem;">Chi tiết tính band hiện tại</div>
          </div>
          <button class="ln-band-modal-close" style="background:none;border:none;font-size:1.3rem;color:#9ca3af;cursor:pointer;line-height:1;">×</button>
        </div>
        <div style="background:linear-gradient(135deg,#d9381e,#d9381e);color:white;padding:.9rem 1.3rem;display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-size:.72rem;opacity:.85;">BAND TỔNG HỢP</div>
            <div style="font-size:2.2rem;font-weight:800;line-height:1;">${(s.band || 5.0).toFixed(1)}</div>
          </div>
          ${br.fallback ? `<div style="font-size:.72rem;opacity:.85;max-width:50%;">Chưa có dữ liệu — đang dùng band mặc định 5.0. Luyện 1-2 câu để có ước lượng chính xác.</div>` : `<div style="font-size:.72rem;opacity:.85;">Chính xác (raw): <b>${(br.final || 0).toFixed(2)}</b><br>Làm tròn 0.5 band</div>`}
        </div>
        <div style="padding:.5rem 1.3rem 1.1rem;">
          <div style="font-size:.78rem;color:#6b7280;margin:.4rem 0 .3rem;font-weight:600;">Các thành phần đóng góp:</div>
          ${compRows || `<div style="color:#9ca3af;font-size:.85rem;text-align:center;padding:1rem;">Chưa có dữ liệu luyện tập.</div>`}
          <div style="background:#fffbe6;border-radius:.5rem;padding:.7rem .85rem;margin-top:.9rem;font-size:.78rem;color:#171717;line-height:1.6;">
            <b>Công thức:</b><br>
            • 50% — Full Test gần nhất (sát thi thật)<br>
            • 30% — TB 20 câu luyện gần nhất (decay 0.92ⁿ)<br>
            • 20% — TB câu Part 2 & Part 3 (khó hơn nên đáng giá hơn)<br>
            <span style="color:#6b7280;">Thành phần nào thiếu → trọng số chia lại tự động.</span>
          </div>
          <button class="ln-band-modal-close" style="display:block;width:100%;margin-top:.9rem;background:#d9381e;color:white;border:none;padding:.7rem;border-radius:.5rem;font-weight:600;cursor:pointer;font-family:inherit;">Đã hiểu</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => { if (e.target === ov) ov.remove(); });
    ov.querySelectorAll(".ln-band-modal-close").forEach(b => b.addEventListener("click", () => ov.remove()));
  }

  // ──────────────── Replace placeholder history with rich cards on /question-answer ─────
  // Scrape DOM keeps only minimalist "❓ PART X: ..." rows. We collect every scored
  // attempt from localStorage (ln.scoreHistory:*) and render a real card list that
  // matches the live luyennoi.com look.
  function stripMockHistory() {
    if (!/^\/question-answer\/?$/.test(location.pathname)) return;
    if (document.__lnHistRendered) return;

    // 1) Find the placeholder anchor — the bottom main column area that contains all
    //    the simple "❓ PART X: ..." rows + the "Xem Thêm" button.
    const xemThemBtn = [...document.querySelectorAll("button, a")].find(b => /^\s*Xem Thêm\s*$/i.test(b.textContent || ""));
    let container = xemThemBtn?.parentElement;
    if (!container) {
      // Fallback — locate by row pattern
      const sampleRow = [...document.querySelectorAll("p")].find(p => /^PART\s*\d\s*:/.test((p.textContent || "").trim()));
      container = sampleRow?.closest("div.w-full, main, section") || sampleRow?.parentElement?.parentElement;
    }
    if (!container) return;
    document.__lnHistRendered = true;

    // 2) Collect every scored attempt across all questions
    const attempts = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("ln.scoreHistory:")) continue;
      let q;
      try { q = decodeURIComponent(k.slice("ln.scoreHistory:".length)); } catch { continue; }
      let arr = [];
      try { arr = JSON.parse(localStorage.getItem(k) || "[]"); } catch {}
      arr.forEach(a => {
        const modelName = String(a?.model || a?.provider || "");
        if (!a || !a.__realAttempt || !a.transcript || /local-fallback|mock/i.test(modelName)) return;
        attempts.push({ ...a, question: q });
      });
    }
    attempts.sort((a, b) => (b.ts || 0) - (a.ts || 0));

    // 3) NUKE every scraped history entry wrapper. The scraped HTML has user data
    //    baked in from the original luyennoi.com so we can't trust audio src to filter.
    //    Every `div.mb-6.pr-1` is an entry wrapper. We render fresh from localStorage instead.
    document.querySelectorAll("div.mb-6.pr-1, div.mb-6.pr-1.md\\:mb-8").forEach(row => row.remove());
    // Also strip standalone Svelte-rendered cards that aren't wrapped (rare)
    document.querySelectorAll("div.group.relative.my-2.flex.min-h-\\[8rem\\]").forEach(card => {
      // Already deleted via wrapper? Then ignore. Otherwise nuke.
      if (card.isConnected) card.remove();
    });
    // Also strip time dividers
    [...document.querySelectorAll("span")].forEach(s => {
      if (/^\s*\d+\s+(tháng|năm|tuần|ngày|phút|giờ)\s+trước\s*$/i.test((s.textContent || "").trim())) {
        const wrap = s.closest("div.relative");
        (wrap || s).remove();
      }
    });
    // Hide the "Xem Thêm" button (we render all)
    if (xemThemBtn) xemThemBtn.style.display = "none";

    // 4) If no attempts, show empty state
    if (!attempts.length) {
      const empty = document.createElement("div");
      empty.style.cssText = "text-align:center;color:#9ca3af;padding:3rem 1rem;font-family:Lexend,sans-serif;font-size:.9rem;";
      empty.innerHTML = `📝 Chưa có câu nào được luyện. Vào <a href="/question-answer/part1" style="color:#d9381e;font-weight:600;">Luyện Part 1</a> hoặc <a href="/take-test/full-test" style="color:#d9381e;font-weight:600;">Thi thử</a> để bắt đầu.`;
      container.appendChild(empty);
      return;
    }

    // 5) Render rich card list
    const fmtTime = (ts) => {
      const diff = Date.now() - ts;
      const min = Math.floor(diff / 60000);
      if (min < 1) return "Vừa xong";
      if (min < 60) return `${min} phút trước`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `${hr} giờ trước`;
      const day = Math.floor(hr / 24);
      if (day < 30) return `${day} ngày trước`;
      const mo = Math.floor(day / 30);
      return `${mo} tháng trước`;
    };
    const escapeAttr = (s) => String(s || "").replace(/"/g, "&quot;");
    const colorByPart = (p) => p === "PART 1" ? "#d9381e" : p === "PART 2" ? "#d9381e" : "#d9381e";

    const wrap = document.createElement("div");
    wrap.id = "ln-rich-history";
    wrap.style.cssText = "display:flex;flex-direction:column;gap:.7rem;font-family:Lexend,sans-serif;max-width:760px;margin:0 auto;padding:0 1rem;";

    // Group by recency buckets
    let currentBucket = null;
    attempts.slice(0, 50).forEach(a => {
      // Detect the part by looking for PART X prefix in stored section, or guess from question
      const part = a.section ? a.section.toUpperCase().replace("PART", "PART ") :
                   (/^(describe|talk about)/i.test(a.question) ? "PART 2" : "PART 1");
      const partColor = colorByPart(part);
      const bucket = fmtTime(a.ts || 0);
      if (bucket !== currentBucket) {
        currentBucket = bucket;
        const div = document.createElement("div");
        div.style.cssText = "color:#9ca3af;font-size:.78rem;font-weight:600;margin:.8rem 0 .2rem;text-align:center;position:relative;";
        div.innerHTML = `<span style="background:white;padding:0 .8rem;position:relative;z-index:2;">${bucket}</span><div style="position:absolute;top:50%;left:0;right:0;height:1px;background:#e5e7eb;z-index:1;"></div>`;
        wrap.appendChild(div);
      }
      const c = a.criteria || {};
      const overall = a.overall != null ? a.overall : "?";
      const overallColor = typeof a.overall === "number" && a.overall >= 7 ? "#FFD700" : (typeof a.overall === "number" && a.overall >= 6 ? "#d9381e" : (typeof a.overall === "number" && a.overall >= 5 ? "var(--ink)" : "#9ca3af"));
      const url = `/question-answer/${encodeURIComponent(part)}~${encodeURIComponent(a.question)}`;
      const transcript = (a.transcript || a.rewrittenAnswer || "").slice(0, 240);
      const card = document.createElement("div");
      card.style.cssText = "background:white;border:1px solid #e5e7eb;border-radius:.7rem;padding:.9rem 1.1rem;transition:border-color .15s,box-shadow .15s;";
      card.onmouseover = () => { card.style.borderColor = "#FFD700"; card.style.boxShadow = "0 2px 8px rgba(217,56,30,.06)"; };
      card.onmouseout = () => { card.style.borderColor = "#e5e7eb"; card.style.boxShadow = ""; };
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.7rem;margin-bottom:.5rem;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:.7rem;font-weight:700;color:${partColor};letter-spacing:.02em;">${part}${a.fromFullTest ? " · TEST" : ""}</div>
            <div style="font-weight:600;font-size:.9rem;color:#171717;margin-top:.15rem;line-height:1.4;">${escHtml(a.question)}</div>
          </div>
          <a href="${url}" style="font-size:.78rem;color:${partColor};font-weight:600;text-decoration:none;flex-shrink:0;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">Luyện lại câu này →</a>
        </div>
        <div style="display:flex;gap:.6rem;align-items:flex-start;">
          <div style="font-size:.82rem;color:#4b5563;line-height:1.55;flex:1;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${escHtml(transcript)}${transcript.length === 240 ? "…" : ""}</div>
          <div style="background:${overallColor};color:white;font-weight:800;border-radius:9999px;min-width:2.5rem;height:2.5rem;display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0;">${overall}</div>
        </div>
        ${c.fluency ? `
        <div style="display:flex;gap:.35rem;margin-top:.55rem;flex-wrap:wrap;font-size:.7rem;">
          <span style="background:#fffbe6;color:#d9381e;padding:.15rem .55rem;border-radius:9999px;">Trôi chảy: <b>${c.fluency?.score ?? "?"}</b></span>
          <span style="background:#fffbe6;color:#d9381e;padding:.15rem .55rem;border-radius:9999px;">Từ vựng: <b>${c.vocabulary?.score ?? "?"}</b></span>
          <span style="background:#fffbe6;color:#d9381e;padding:.15rem .55rem;border-radius:9999px;">Ngữ pháp: <b>${c.grammar?.score ?? "?"}</b></span>
          <span style="background:#fffbe6;color:#d9381e;padding:.15rem .55rem;border-radius:9999px;">Phát âm: <b>${c.pronunciation?.score ?? "?"}</b></span>
        </div>` : ""}
      `;
      wrap.appendChild(card);
    });
    container.appendChild(wrap);
  }

  // ──────────────── Full Test history list on /take-test/home ────────────────
  function patchStrictTestEntry() {
    if (!/^\/take-test(\/(home)?)?\/?$/.test(location.pathname)) return;
    if (document.querySelector('a[href="/take-test/custom-strict"]')) return;
    const full = [...document.querySelectorAll("a, button")].find(el => /FULL\s*TEST/i.test((el.textContent || "").trim()));
    if (!full) return;
    const a = document.createElement("a");
    a.href = "/take-test/custom-strict";
    a.textContent = "Tùy chọn đề";
    a.style.cssText = "display:inline-flex;align-items:center;justify-content:center;border-radius:999px;background:#111827;color:#fff;font-weight:800;padding:.78rem 1.35rem;text-decoration:none;margin-left:.55rem;box-shadow:0 10px 24px rgba(17,24,39,.12);";
    a.title = "Siêu chống gian lận - chống đọc";
    full.insertAdjacentElement("afterend", a);
  }

  function patchFullTestHistory() {
    if (!/^\/take-test(\/(home)?)?\/?$/.test(location.pathname)) return;
    // Find the placeholder "Chưa có bài thi nào." — replace whole div content
    const placeholders = [...document.querySelectorAll("div")].filter(d => /^Chưa có bài thi nào\.?$/.test((d.textContent || "").trim()) && !d.__lnHistPatched);
    if (!placeholders.length) return;
    let list = [];
    try { list = JSON.parse(localStorage.getItem("ln.fullTestHistory") || "[]"); } catch {}

    placeholders.forEach(host => {
      host.__lnHistPatched = true;
      if (!list.length) return; // keep "Chưa có bài thi nào."
      host.classList.remove("text-gray-500");
      host.style.alignItems = "stretch";
      const fmt = ts => {
        const d = new Date(ts);
        return d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
      };
      host.innerHTML = `
        <div style="width:100%;max-width:42rem;font-family:Lexend,sans-serif;">
          <h3 style="font-size:1.05rem;font-weight:700;color:#171717;margin-bottom:.7rem;">📚 Lịch sử bài thi (${list.length})</h3>
          ${list.map(t => {
            const p1 = t.sections?.part1?.band?.toFixed(1) || "—";
            const p2 = t.sections?.part2?.band?.toFixed(1) || "—";
            const p3 = t.sections?.part3?.band?.toFixed(1) || "—";
            const link = `/take-test/full-test?result=${t.ts}`;
            return `
              <a href="${link}" style="display:block;text-decoration:none;color:inherit;background:white;border:1.5px solid #e5e7eb;border-radius:.6rem;padding:.8rem 1rem;margin-bottom:.6rem;transition:border-color .15s;" onmouseover="this.style.borderColor='#d9381e'" onmouseout="this.style.borderColor='#e5e7eb'">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:.7rem;">
                  <div style="flex:1;min-width:0;">
                    <div style="font-size:.7rem;color:#9ca3af;font-weight:700;">FULL TEST · ${fmt(t.ts)}</div>
                    <div style="display:flex;gap:.5rem;margin-top:.4rem;flex-wrap:wrap;font-size:.72rem;">
                      <span style="background:#fffbe6;color:#d9381e;padding:.15rem .6rem;border-radius:9999px;">P1: <b>${p1}</b></span>
                      <span style="background:#fffbe6;color:#d9381e;padding:.15rem .6rem;border-radius:9999px;">P2: <b>${p2}</b></span>
                      <span style="background:#fffbe6;color:#d9381e;padding:.15rem .6rem;border-radius:9999px;">P3: <b>${p3}</b></span>
                      <span style="color:#6b7280;align-self:center;">${t.questionCount || 0} câu</span>
                    </div>
                  </div>
                  <div style="background:linear-gradient(135deg,#d9381e,#d9381e);color:white;font-size:1.2rem;font-weight:800;border-radius:50%;width:3rem;height:3rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${(t.overall || 0).toFixed(1)}</div>
                </div>
              </a>
            `;
          }).join("")}
          <div style="text-align:right;margin-top:.4rem;">
            <button id="ln-clear-ft-hist" style="background:none;border:none;color:#9ca3af;font-size:.72rem;cursor:pointer;text-decoration:underline;">Xoá toàn bộ lịch sử</button>
          </div>
        </div>
      `;
      host.querySelector("#ln-clear-ft-hist")?.addEventListener("click", (e) => {
        e.preventDefault();
        if (confirm("Xoá toàn bộ lịch sử bài thi?")) {
          localStorage.removeItem("ln.fullTestHistory");
          location.reload();
        }
      });
    });
  }

  // ──────────────── Append lesson 40-46 cards on pronun lesson pages ────────────────
  // The static SvelteKit pronun.html (served on /alphafeature/pronun/lessonN/sectionM)
  // ships a sidebar of lesson1-39 cards, but lessons_data now has 46 entries.
  // Inject the missing 7 cards after lesson 39 so users can navigate to them.
  function patchPronunIndexLessons() {
    if (!/^\/alphafeature\/pronun(\/lesson\d+\/section\d+)?\/?$/i.test(location.pathname)) return;
    if (document.__lnPronunCardsAppended) return;
    const last = [...document.querySelectorAll(".collapse-title")].find((el) => /Bài\s*39\s*:/i.test(el.textContent || ""));
    let lastCard = last?.closest(".collapse");
    if (!lastCard) return; // index DOM hasn't hydrated yet
    document.__lnPronunCardsAppended = true;
    const NEW_LESSONS = [
      { n: 40, phoneme: "ɔɪ", note: "Diphthong 'oy' (boy, toy)" },
      { n: 41, phoneme: "ɑː", note: "Long 'ah' (father, calm)" },
      { n: 42, phoneme: "ɪə", note: "Centring 'ear' (near, here)" },
      { n: 43, phoneme: "eə", note: "Centring 'air' (where, hair)" },
      { n: 44, phoneme: "ʊə", note: "Centring 'oor' (tour, sure)" },
      { n: 45, phoneme: "aɪə", note: "Triphthong (fire, tired)" },
      { n: 46, phoneme: "aʊə", note: "Triphthong (hour, power)" },
    ];
    for (const L of NEW_LESSONS) {
      const card = document.createElement("div");
      card.className = "collapse-arrow collapse mb-3 rounded-lg border border-base-300";
      card.innerHTML = `
        <input type="checkbox" id="lesson-${L.n - 1}">
        <div class="collapse-title text-lg font-medium">Bài ${L.n}: Luyện âm /${L.phoneme}/ <span style="font-size:.7rem;color:#9ca3af;font-weight:400;margin-left:.5rem;">${L.note}</span></div>
        <div class="collapse-content space-y-2">
          <a href="/alphafeature/pronun/lesson${L.n}/section1" class="link-secondary block underline hover:text-primary">${L.n}.1 Hướng dẫn luyện âm /${L.phoneme}/</a>
          <a href="/alphafeature/pronun/lesson${L.n}/section2" class="link-secondary block underline hover:text-primary">${L.n}.2 Luyện phát âm từ</a>
          <a href="/alphafeature/pronun/lesson${L.n}/section3" class="link-secondary block underline hover:text-primary">${L.n}.3 Luyện phát âm câu</a>
        </div>`;
      lastCard.parentNode.insertBefore(card, lastCard.nextSibling);
      lastCard = card; // chain — next iteration appends after this one
    }
  }

  // ──────────────── Test summary card on /take-test/home (mini dashboard) ────────────────
  function patchTakeTestSummary() {
    if (!/^\/take-test(\/(home)?)?\/?$/.test(location.pathname)) return;
    if (document.getElementById("ln-test-summary")) return;
    let list = [];
    try { list = JSON.parse(localStorage.getItem("ln.fullTestHistory") || "[]"); } catch {}
    // Aggregate per-question attempts too (for users who only practiced individual questions).
    let perQAttempts = 0, perQOverallSum = 0, perQCountWithBand = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith("ln.scoreHistory:")) continue;
        let arr = [];
        try { arr = JSON.parse(localStorage.getItem(k) || "[]"); } catch {}
        for (const a of arr) {
          if (a?.__realAttempt && typeof a.overall === "number") {
            perQAttempts++;
            perQOverallSum += a.overall;
            perQCountWithBand++;
          }
        }
      }
    } catch {}
    const ftCount = list.length;
    const ftAvg = ftCount ? (list.reduce((s, t) => s + (t.overall || 0), 0) / ftCount) : 0;
    const ftBest = ftCount ? Math.max(...list.map(t => t.overall || 0)) : 0;
    const perQAvg = perQCountWithBand ? (perQOverallSum / perQCountWithBand) : 0;
    if (!ftCount && !perQAttempts) return; // nothing to summarise — keep "Chưa có bài thi nào"
    const target = [...document.querySelectorAll("h1,h2,h3")].find(h => /thi thử/i.test(h.textContent || ""));
    if (!target) return;
    const card = document.createElement("div");
    card.id = "ln-test-summary";
    card.style.cssText = "max-width:42rem;margin:1rem 0 1.4rem;padding:1rem 1.1rem;background:linear-gradient(135deg,#fff8e1,#ffffff);border:2px solid #171717;border-radius:.7rem;box-shadow:4px 4px 0 #171717;font-family:Lexend,sans-serif;";
    const block = (label, value, subtitle) => `
      <div style="text-align:center;flex:1;min-width:90px;">
        <div style="font:900 1.6rem/1 Inter,sans-serif;color:#d9381e;">${value}</div>
        <div style="font-size:.7rem;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-top:.15rem;">${label}</div>
        ${subtitle ? `<div style="font-size:.65rem;color:#9ca3af;margin-top:.1rem;">${subtitle}</div>` : ""}
      </div>`;
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem;flex-wrap:wrap;gap:.5rem;">
        <div>
          <div style="font:900 .85rem/1 'JetBrains Mono',monospace;color:#171717;text-transform:uppercase;letter-spacing:.08em;">📊 Mini dashboard thi thử</div>
          <div style="font-size:.78rem;color:#6b7280;margin-top:.15rem;">Tổng kết các lần luyện và thi gần đây.</div>
        </div>
        <a href="/question-answer" style="font-size:.78rem;color:#d9381e;font-weight:700;text-decoration:none;">Lịch sử chi tiết →</a>
      </div>
      <div style="display:flex;gap:.6rem;flex-wrap:wrap;background:#fff;border:1.5px solid #e5e7eb;border-radius:.5rem;padding:.7rem .5rem;">
        ${block("Full Test", ftCount || "—", ftCount ? "Đã làm" : "Chưa thi")}
        ${block("Band TB", ftCount ? ftAvg.toFixed(1) : "—", ftCount ? "Full Test" : "")}
        ${block("Band cao nhất", ftCount ? ftBest.toFixed(1) : "—", ftCount ? "Full Test" : "")}
        ${block("Câu đã chấm", perQAttempts || "—", perQAttempts ? `TB ${perQAvg.toFixed(1)}` : "")}
      </div>
    `;
    target.closest("div, section")?.insertBefore(card, target.nextSibling);
  }

  // ──────────────── Custom selection modal for Thi PART X ────────────────
  let __lnQuestionsCache = null;
  async function loadQuestionsJsonOnce() {
    if (__lnQuestionsCache) return __lnQuestionsCache;
    try {
      const r = await fetch("/data/questions.json");
      __lnQuestionsCache = await r.json();
    } catch { __lnQuestionsCache = { part1: { topics: [] }, part2: { topics: [] }, part3: { topics: [] } }; }
    return __lnQuestionsCache;
  }

  function openTestPartChooser(part /* 1 | 2 | 3 */) {
    document.getElementById("ln-test-chooser")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "ln-test-chooser";
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(15,15,15,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem;";
    const partUrl = `/take-test/part${part}`;
    overlay.innerHTML = `
      <div style="background:#fff;border:2px solid #171717;border-radius:.7rem;box-shadow:6px 6px 0 #171717;max-width:540px;width:100%;max-height:90vh;overflow:auto;padding:1.1rem;font-family:Lexend,sans-serif;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.8rem;">
          <div>
            <h3 style="margin:0;font:900 1.1rem/1.2 Fraunces,serif;color:#171717;">Thi PART ${part}</h3>
            <p style="margin:.25rem 0 0;font-size:.78rem;color:#6b7280;">Chọn chế độ thi cho phần này.</p>
          </div>
          <button data-act="close" style="background:none;border:none;font-size:1.4rem;line-height:1;color:#9ca3af;cursor:pointer;">×</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-bottom:.6rem;">
          <button data-act="standard" style="background:#fffbe6;border:2px solid #171717;border-radius:.45rem;padding:.85rem .7rem;text-align:left;cursor:pointer;">
            <div style="font-weight:800;font-size:.92rem;color:#171717;">🎯 Thi thông thường</div>
            <div style="font-size:.72rem;color:#6b7280;margin-top:.2rem;">Đề tự chọn ngẫu nhiên (3 topic × 3 câu).</div>
          </button>
          <button data-act="custom" style="background:#ffffff;border:2px solid #d9381e;border-radius:.45rem;padding:.85rem .7rem;text-align:left;cursor:pointer;">
            <div style="font-weight:800;font-size:.92rem;color:#d9381e;">📋 Chọn đề & số câu</div>
            <div style="font-size:.72rem;color:#6b7280;margin-top:.2rem;">Chọn topic + đặt số câu (vd 1 P1, 2 P2).</div>
          </button>
        </div>
        <div id="ln-test-chooser-body" style="display:none;border-top:1.5px dashed #e5e7eb;padding-top:.7rem;"></div>
        <div id="ln-test-chooser-foot" style="display:none;justify-content:flex-end;gap:.5rem;margin-top:.7rem;">
          <button data-act="close" style="background:transparent;border:1.5px solid #d1d5db;border-radius:.4rem;padding:.45rem 1rem;cursor:pointer;color:#374151;">Huỷ</button>
          <button data-act="start" style="background:#d9381e;color:#fff;border:none;border-radius:.4rem;padding:.45rem 1.1rem;font-weight:700;cursor:pointer;">Bắt đầu thi →</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelectorAll('[data-act="close"]').forEach((b) => b.addEventListener("click", () => overlay.remove()));
    overlay.querySelector('[data-act="standard"]').addEventListener("click", () => {
      overlay.remove();
      location.href = partUrl;
    });
    overlay.querySelector('[data-act="custom"]').addEventListener("click", async () => {
      const body = overlay.querySelector("#ln-test-chooser-body");
      const foot = overlay.querySelector("#ln-test-chooser-foot");
      body.innerHTML = `<div style="text-align:center;color:#9ca3af;font-size:.85rem;padding:1rem;">⏳ Đang tải danh sách đề…</div>`;
      body.style.display = "block";
      foot.style.display = "flex";
      const data = await loadQuestionsJsonOnce();
      renderCustomSelection(body, foot, overlay, partUrl, part, data);
    });
  }

  function renderCustomSelection(body, foot, overlay, partUrl, part, data) {
    const sel = { picked: new Set(), perTopic: 1, cardKey: "" };
    if (part === 1) {
      const topics = (data.part1?.topics || []);
      body.innerHTML = `
        <div style="font-size:.85rem;font-weight:700;margin-bottom:.4rem;color:#171717;">Chọn topic Part 1 (đa lựa chọn):</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.35rem;max-height:240px;overflow:auto;padding:.4rem;border:1.5px solid #e5e7eb;border-radius:.4rem;background:#f9fafb;margin-bottom:.6rem;">
          ${topics.map(t => `
            <label style="display:flex;align-items:center;gap:.35rem;font-size:.78rem;padding:.25rem .35rem;background:#fff;border-radius:.3rem;cursor:pointer;">
              <input type="checkbox" value="${escapeAttr(t.title)}" style="accent-color:#d9381e;">
              <span style="flex:1;">${escapeHtml(t.title)} <small style="color:#9ca3af;">${(t.questions||[]).length}</small></span>
            </label>`).join("")}
        </div>
        <div style="font-size:.85rem;font-weight:700;margin-bottom:.3rem;color:#171717;">Số câu mỗi topic:</div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.5rem;">
          ${[1,2,3,4].map(n => `<button data-perq="${n}" style="background:${n===1?'#d9381e':'#fff'};color:${n===1?'#fff':'#171717'};border:1.5px solid #171717;border-radius:.35rem;padding:.3rem .8rem;font-weight:700;cursor:pointer;">${n} câu</button>`).join("")}
        </div>
        <div id="ln-pick-sum" style="font-size:.78rem;color:#6b7280;">Đã chọn 0 topic × 1 câu = 0 câu.</div>`;
      body.querySelectorAll("input[type=checkbox]").forEach((c) => c.addEventListener("change", () => {
        if (c.checked) sel.picked.add(c.value);
        else sel.picked.delete(c.value);
        body.querySelector("#ln-pick-sum").textContent = `Đã chọn ${sel.picked.size} topic × ${sel.perTopic} câu = ${sel.picked.size * sel.perTopic} câu.`;
      }));
      body.querySelectorAll("[data-perq]").forEach((b) => b.addEventListener("click", () => {
        sel.perTopic = Number(b.dataset.perq) || 1;
        body.querySelectorAll("[data-perq]").forEach((x) => {
          const on = Number(x.dataset.perq) === sel.perTopic;
          x.style.background = on ? "#d9381e" : "#fff";
          x.style.color = on ? "#fff" : "#171717";
        });
        body.querySelector("#ln-pick-sum").textContent = `Đã chọn ${sel.picked.size} topic × ${sel.perTopic} câu = ${sel.picked.size * sel.perTopic} câu.`;
      }));
    } else {
      // PART 2 / PART 3 — flat list of cue cards from questions.json (and forecast-map enriches at runtime).
      const cards = (data.part2?.topics || []).flatMap(g => (g.questions || []).map(title => ({ group: g.title, title })));
      body.innerHTML = `
        <div style="font-size:.85rem;font-weight:700;margin-bottom:.4rem;color:#171717;">Chọn cue card${part === 3 ? " (P3 sẽ chạy 3 câu theo cue card này)" : ""}:</div>
        <div style="max-height:280px;overflow:auto;padding:.3rem;border:1.5px solid #e5e7eb;border-radius:.4rem;background:#f9fafb;margin-bottom:.6rem;">
          ${cards.map((c) => `
            <label style="display:flex;align-items:center;gap:.4rem;font-size:.78rem;padding:.3rem .4rem;background:#fff;border-radius:.3rem;margin-bottom:.2rem;cursor:pointer;">
              <input type="radio" name="ln-cue" value="${escapeAttr(c.group + '::' + c.title)}" style="accent-color:#d9381e;">
              <span style="flex:1;"><b style="color:#d9381e;">${escapeHtml(c.group)}</b> · ${escapeHtml(c.title)}</span>
            </label>`).join("")}
        </div>
        <div style="font-size:.78rem;color:#6b7280;">Chế độ chọn đề chỉ chạy đúng 1 cue card bạn đã chọn.</div>`;
      body.querySelectorAll("input[name='ln-cue']").forEach((r) => r.addEventListener("change", () => { if (r.checked) sel.cardKey = r.value; }));
    }
    foot.querySelector('[data-act="start"]').addEventListener("click", () => {
      if (part === 1) {
        if (!sel.picked.size) { alert("Chọn ít nhất 1 topic."); return; }
        const params = new URLSearchParams({
          mode: "custom",
          picked: [...sel.picked].join("|"),
          perTopic: String(sel.perTopic)
        });
        location.href = `${partUrl}?${params.toString()}`;
      } else {
        if (!sel.cardKey) { alert("Chọn 1 cue card."); return; }
        const params = new URLSearchParams({ mode: "custom", card: sel.cardKey });
        location.href = `${partUrl}?${params.toString()}`;
      }
    });
  }

  function wireTakeTestPartLinks() {
    if (!/^\/take-test(\/(home)?)?\/?$/.test(location.pathname)) return;
    document.querySelectorAll('a[href^="/take-test/part"]').forEach((a) => {
      if (a.__lnPartChooser) return;
      a.__lnPartChooser = true;
      a.addEventListener("click", (e) => {
        const m = (a.getAttribute("href") || "").match(/\/take-test\/part(\d)/);
        if (!m) return;
        e.preventDefault();
        e.stopPropagation();
        openTestPartChooser(Number(m[1]));
      }, true);
    });
  }

  function escapeAttr(s) { return String(s || "").replace(/"/g, "&quot;").replace(/&/g, "&amp;"); }
  function escapeHtml(s) { return String(s || "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

  function patchPracticeChrome() {
    if (!/^\/question-answer(\/|$)/.test(location.pathname)) return;
    document.body.classList.add("ln-practice-page");
    [...document.querySelectorAll("button, a")].forEach((el) => {
      const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (/^Luyện topic này$/i.test(txt)) {
        el.remove();
      }
    });
    wireAnsweredQuestionToggle();
    document.querySelectorAll('input[placeholder*="Tìm câu" i], input[placeholder*="Tim cau" i]').forEach((input) => {
      input.classList.add("ln-search-input");
      input.closest("div")?.classList.add("ln-search-box");
    });
  }

  // ──────────────── "Luyện phát âm" input box ────────────────
  // The detail page has: <input placeholder="Nhập từ/cụm từ để luyện phát âm"> + <button>Luyện phát âm</button>
  // Wire so typing a word/phrase + clicking opens the same practice modal we use for flagged words.
  function normText(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase();
  }

  function isPronunPracticeInput(input) {
    const ph = normText(input.getAttribute("placeholder") || "");
    return ph.includes("luyen phat am") || (ph.includes("nhap tu") && ph.includes("phat am"));
  }

  function findPronunInputForButton(btn) {
    const scopes = [btn.closest("form, .flex, .join, div"), btn.parentElement, btn.parentElement?.parentElement].filter(Boolean);
    for (const scope of scopes) {
      const input = [...(scope.querySelectorAll?.("input") || [])].find(isPronunPracticeInput);
      if (input) return input;
    }
    return null;
  }

  function wirePronounInputBox() {
    const inputs = [...document.querySelectorAll("input")].filter(isPronunPracticeInput);
    inputs.forEach(input => {
      // The matching control may be a button or a link, depending on the scraped DOM.
      const scope = input.closest("form, .flex, .join, div") || input.parentElement || document;
      const candidates = [
        ...(scope.querySelectorAll ? scope.querySelectorAll("button,a,[role='button']") : []),
        ...(scope.parentElement?.querySelectorAll ? scope.parentElement.querySelectorAll("button,a,[role='button']") : [])
      ];
      const btn = candidates.find((el) => normText(el.textContent).includes("luyen phat am")) || input.nextElementSibling;

      // Reflect "has text" → button enabled / disabled
      const sync = () => {
        const hasText = (input.value || "").trim().length > 0;
        if (btn) {
          if ("disabled" in btn) btn.disabled = !hasText;
          btn.__lnPronunInputButton = true;
          btn.classList.add("ln-pronun-input-button");
          btn.style.opacity = hasText ? "1" : ".42";
          btn.style.cursor = hasText ? "pointer" : "not-allowed";
          btn.style.setProperty("background", hasText ? "#ffd400" : "#ffffff", "important");
          btn.style.setProperty("border-color", hasText ? "#171717" : "#d1d5db", "important");
          btn.style.setProperty("color", "#171717", "important");
          btn.style.boxShadow = hasText ? "3px 3px 0 #171717" : "none";
          btn.querySelectorAll("*").forEach(child => child.style.setProperty("color", "#171717", "important"));
          btn.setAttribute("aria-disabled", String(!hasText));
          btn.title = hasText ? "Mở popup luyện phát âm" : "Nhập từ hoặc cụm từ trước";
        }
      };
      sync();
      if (!input.__lnPronounInputWired) {
        input.__lnPronounInputWired = true;
        input.addEventListener("input", sync);
      }

      const open = () => {
        const text = (input.value || "").trim();
        if (!text) {
          // Defensive — should never reach here when button is properly disabled
          input.focus();
          return;
        }
        (window.openWordPracticeModal || openWordPracticeModal)(text, "");
      };
      if (!input.__lnPronounEnterWired) {
        input.__lnPronounEnterWired = true;
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if ((input.value || "").trim()) open();
          }
        });
      }
      if (btn && !btn.__lnPronounClickWired) {
        btn.__lnPronounClickWired = true;
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          if (btn.disabled || btn.getAttribute("aria-disabled") === "true") {
            input.focus();
            return;
          }
          open();
        }, true);
      }
    });
  }

  function wireQuestionSearchFilter() {
    if (!/^\/question-answer(\/|$)/.test(location.pathname)) return;
    const inputs = [...document.querySelectorAll('input')].filter(input => /tim cau|tìm câu|cau hoi|câu hỏi/i.test(input.placeholder || ""));
    inputs.forEach(input => {
      if (input.__lnSearchWired) return;
      input.__lnSearchWired = true;
      input.addEventListener("input", applyQuestionLibraryFilters);
      applyQuestionLibraryFilters();
    });
  }

  function questionLibraryCards() {
    return [...document.querySelectorAll('a[href*="/question-answer/PART"], a[href*="/question-answer/part"], .question-card, .qa-question-card, [class*="QuestionCard"], [data-question]')]
      .filter(el => {
        const href = el.getAttribute("href") || "";
        return (el.textContent || "").trim().length > 8 && !el.closest(".ln-side-nav, .qa-top-tabs") && !/^\/question-answer\/part[123]\/?$/i.test(href);
      });
  }

  function questionKeyText(text) {
    return normScoreText(text).replace(/^part\s*\d+\s*[:~-]?\s*/i, "").replace(/[?!.\s]+$/g, "").trim();
  }

  function questionTextFromCard(card) {
    const href = card.getAttribute("href") || card.querySelector?.('a[href*="/question-answer/"]')?.getAttribute("href") || "";
    try {
      const raw = decodeURIComponent(href.split("/question-answer/")[1] || "");
      const tilde = raw.indexOf("~");
      if (tilde > -1) return raw.slice(tilde + 1).replace(/#.*$/, "").trim();
    } catch {}
    const clone = card.cloneNode(true);
    clone.querySelectorAll?.(".ln-score-badge").forEach(el => el.remove());
    return (clone.textContent || "").trim();
  }

  function answeredQuestionKeys() {
    const keys = new Set();
    const add = (q) => { const key = questionKeyText(q); if (key) keys.add(key); };
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith("ln.scoreHistory:")) continue;
        let arr = [];
        try { arr = JSON.parse(localStorage.getItem(k) || "[]"); } catch { arr = []; }
        if (!arr.length) continue;
        add(decodeURIComponent(k.slice("ln.scoreHistory:".length)));
      }
    } catch {}
    try { (LN.state.history || []).forEach(item => add(item?.question)); } catch {}
    return keys;
  }

  function markAnsweredQuestionCards() {
    const answered = answeredQuestionKeys();
    let count = 0;
    questionLibraryCards().forEach(card => {
      const done = answered.has(questionKeyText(questionTextFromCard(card)));
      card.classList.toggle("ln-answered-question", done);
      if (done) count++;
    });
    return count;
  }

  function findAnsweredToggleElement() {
    const candidates = [];
    document.querySelectorAll('[data-action="toggle-answered"], label, button, span, div').forEach(el => {
      const txt = (el.textContent || "").trim();
      if (!/^Ẩn câu đã (trả lời|làm rồi)/i.test(txt) && !/^Hiện câu đã (trả lời|làm rồi)/i.test(txt)) return;
      const hasNested = [...el.children].some(c => /Ẩn câu đã (trả lời|làm rồi)|Hiện câu đã (trả lời|làm rồi)/i.test((c.textContent || "")));
      if (hasNested) return;
      candidates.push(el);
    });
    return candidates.find(el => el.querySelector?.('input[type="checkbox"], .switch, [class*="switch"]')) || candidates[0] || null;
  }

  function syncAnsweredToggleLabel(doneCount) {
    const toggle = findAnsweredToggleElement();
    if (!toggle) return;
    document.querySelectorAll(".ln-answer-toggle").forEach(el => { if (el !== toggle) el.classList.remove("ln-answer-toggle"); });
    toggle.classList.add("ln-answer-toggle");
    const hiding = document.body.classList.contains("hide-answered");
    toggle.setAttribute("role", "button");
    toggle.setAttribute("title", hiding ? "Bấm để hiện lại các câu đã làm" : "Bấm để ẩn các câu đã làm rồi");
    const input = toggle.querySelector('input[type="checkbox"]');
    if (input) input.checked = hiding;
    toggle.querySelectorAll(".switch, [class*='switch']").forEach(sw => sw.classList.toggle("ln-switch-on", hiding));
    let badge = toggle.querySelector(".ln-answered-count");
    if (doneCount > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "ln-answered-count";
        badge.style.cssText = "margin:0 6px;font-size:12px;color:#d9381e;font-weight:700;";
        const sw = toggle.querySelector('.switch, [class*="switch"], input[type="checkbox"]');
        if (sw && sw.parentElement) sw.parentElement.insertBefore(badge, sw);
        else toggle.appendChild(badge);
      }
      badge.textContent = `(${doneCount})`;
    } else if (badge) {
      badge.remove();
    }
  }

  function applyQuestionLibraryFilters() {
    if (!/^\/question-answer\/(part1|part2|part3)/i.test(location.pathname)) return;
    const doneCount = markAnsweredQuestionCards();
    const input = [...document.querySelectorAll('input')].find(el => /tim cau|tìm câu|cau hoi|câu hỏi/i.test(el.placeholder || ""));
    const q = (input?.value || "").trim().toLowerCase();
    const hiding = document.body.classList.contains("hide-answered");
    questionLibraryCards().forEach(card => {
      const text = questionTextFromCard(card).toLowerCase();
      const hit = !q || text.includes(q);
      const hiddenDone = hiding && card.classList.contains("ln-answered-question");
      card.style.display = hit && !hiddenDone ? "" : "none";
    });
    document.querySelectorAll('[id$="Section"], section').forEach(section => {
      if (!section.querySelector('.question-card, .qa-question-card, [class*="QuestionCard"], a[href*="/question-answer/"]')) return;
      const visible = [...section.querySelectorAll('.question-card, .qa-question-card, [class*="QuestionCard"], a[href*="/question-answer/"]')]
        .some(child => getComputedStyle(child).display !== "none");
      section.style.display = visible || (!q && !hiding) ? "" : "none";
    });
    syncAnsweredToggleLabel(doneCount);
  }

  function wireAnsweredQuestionToggle() {
    if (!/^\/question-answer\/(part1|part2|part3)/i.test(location.pathname)) return;
    try {
      if (localStorage.getItem("ln.hideAnsweredQuestions") === "1") document.body.classList.add("hide-answered");
    } catch {}
    const toggle = findAnsweredToggleElement();
    if (toggle && !toggle.__lnAnsweredToggleWired) {
      toggle.__lnAnsweredToggleWired = true;
      toggle.style.cursor = "pointer";
      toggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        const hiding = !document.body.classList.contains("hide-answered");
        document.body.classList.toggle("hide-answered", hiding);
        try { localStorage.setItem("ln.hideAnsweredQuestions", hiding ? "1" : "0"); } catch {}
        applyQuestionLibraryFilters();
      }, true);
    }
    applyQuestionLibraryFilters();
  }

  // ── Show practice score badges on question cards in list page ──
  function patchQuestionScoreBadges() {
    if (!/^\/question-answer\/(part1|part2|part3)/i.test(location.pathname)) return;
    // Find all question card links
    const cards = document.querySelectorAll('a[href*="/question-answer/PART"]');
    cards.forEach(card => {
      if (card.__lnBadged) return;
      card.__lnBadged = true;
      // Extract question text from the card
      const qText = (card.textContent || "").trim();
      if (!qText || qText.length < 5) return;
      // Look up score history in localStorage
      const key = "ln.scoreHistory:" + encodeURIComponent(qText);
      let history;
      try { history = JSON.parse(localStorage.getItem(key) || "[]"); } catch { return; }
      if (!history.length) return;
      // Get the latest score
      const latest = history[0];
      const overall = latest.overall ?? computeOverallFloor(latest.criteria);
      if (overall === "?" || overall === undefined || overall === null) return;
      const score = Math.floor(Number(overall));
      if (!Number.isFinite(score)) return;
      // Color based on score
      const color = score >= 7 ? "#16a34a" : score >= 5 ? "#d9381e" : "#9ca3af";
      // Add badge
      card.style.position = "relative";
      const badge = document.createElement("div");
      badge.className = "ln-score-badge";
      badge.style.cssText = `position:absolute;top:8px;right:8px;width:32px;height:32px;border-radius:50%;background:${color};color:#fff;font-size:.78rem;font-weight:800;display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.18);z-index:10;`;
      badge.textContent = score;
      badge.title = `Điểm gần nhất: ${overall} (${new Date(latest.ts).toLocaleDateString("vi")})`;
      card.appendChild(badge);
    });
  }

  function patchTopicSyncLabels() {
    if (!/^\/question-answer\/(part1|part2|part3)/.test(location.pathname)) return;
    const setTopic = (topic) => {
      if (!topic) return;
      [...document.querySelectorAll("h1,h2,h3,h4,b,strong,span,div,p")].forEach(el => {
        if (el.children.length) return;
        const txt = (el.textContent || "").trim();
        if (/^Topic\s*:/i.test(txt)) {
          el.textContent = `Topic: ${topic}`;
          el.classList.add("ln-topic-col-label");
        }
      });
      [...document.querySelectorAll("button,a,[role='tab']")].forEach(el => {
        const txt = (el.textContent || "").trim();
        if (txt === topic) el.classList.add("ln-topic-active");
        else if (/^(Person|Object|Activity|Place|Forecast|Forecast cũ)$/i.test(txt)) el.classList.remove("ln-topic-active");
      });
    };
    [...document.querySelectorAll("button,a,[role='tab'],[data-topic]")].forEach(el => {
      if (el.__lnTopicSync) return;
      const txt = (el.getAttribute("data-topic") || el.textContent || "").trim();
      if (!/^(Person|Object|Activity|Place|Forecast|Forecast cũ)$/i.test(txt)) return;
      el.__lnTopicSync = true;
      el.addEventListener("click", () => setTimeout(() => setTopic(txt), 40));
    });
    const active = [...document.querySelectorAll(".active,.tab-active,.ln-topic-active")].find(el => /^(Person|Object|Activity|Place|Forecast|Forecast cũ)$/i.test((el.textContent || "").trim()));
    if (active) setTopic((active.textContent || "").trim());
  }

  function parseDetailRoute() {
    if (!/^\/question-answer\/part\s*\d?~/i.test(decodeURIComponent(location.pathname))) return null;
    const raw = decodeURIComponent(location.pathname.split("/question-answer/")[1] || "");
    const parts = raw.split("~");
    const part = (parts.shift() || "PART 1").replace(/%20/g, " ").trim();
    const question = parts.join("~").replace(/#.*$/, "").trim();
    if (!question) return null;
    return { part, question };
  }

  let detailQuestionCache = null;
  async function getDetailQuestionList(part) {
    if (!detailQuestionCache) {
      try {
        const r = await realFetch("/data/questions.json", { cache: "no-store" });
        detailQuestionCache = await r.json();
      } catch {
        detailQuestionCache = {};
      }
    }
    const key = /2/.test(part) ? "part2" : /3/.test(part) ? "part3" : "part1";
    return (detailQuestionCache[key]?.topics || []).flatMap((topic) => topic.questions || []);
  }

  function detailQuestionHref(part, question) {
    return `/question-answer/${encodeURIComponent(`${part}~${question}`)}`;
  }

  // Find the native Topic footer line (the small "Topic <question>" line at bottom-right of the page)
  function findNativeTopicEl() {
    const candidates = [...document.querySelectorAll("p,span,div,small")].filter(el => {
      const txt = (el.textContent || "").trim();
      if (!/^Topic\b/i.test(txt)) return false;
      if (txt.length < 15 || txt.length > 300) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 100 || r.height < 10) return false;
      if (el.children.length > 5) return false;
      return true;
    });
    if (!candidates.length) return null;
    candidates.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
    return candidates[0];
  }

  // For pages missing the native Topic line, inject one at the bottom of the right column
  // (just after the "Luyện phát âm" input row). Mimics the native Topic structure: [badge] question
  function ensureTopicFooter(detail) {
    const native = findNativeTopicEl();
    if (native) return native;
    const existing = document.getElementById("lnInjectedTopicFooter");
    if (existing) return existing;
    const pronInput = document.querySelector('input[placeholder*="luyện phát âm" i], input[placeholder*="phát âm" i]');
    if (!pronInput) return null;
    // Walk up to find the row container holding input + button
    let row = pronInput;
    for (let i = 0; i < 6 && row.parentElement; i++) {
      const r = row.getBoundingClientRect();
      if (r.width > 280 && row.parentElement.children.length >= 1) {
        row = row.parentElement;
        const r2 = row.getBoundingClientRect();
        if (r2.width > 340) break;
      } else {
        row = row.parentElement;
      }
    }
    const topicEl = document.createElement("div");
    topicEl.id = "lnInjectedTopicFooter";
    topicEl.className = "ln-injected-topic-footer";
    topicEl.innerHTML = `<span class="ln-injected-topic-tag">Topic</span><span class="ln-injected-topic-text"></span>`;
    topicEl.querySelector(".ln-injected-topic-text").textContent = detail.question || "";
    row.parentElement.insertBefore(topicEl, row.nextSibling);
    return topicEl;
  }

  // Move the (existing) prev/next buttons to flank the Topic line — without deleting anything else
  function relocateNavToTopic(fixedNav, topicEl) {
    if (!topicEl || topicEl.closest(".ln-topic-nav-row")) return false;
    const prevBtn = fixedNav.querySelector("[data-ln-detail-dir='-1']");
    const nextBtn = fixedNav.querySelector("[data-ln-detail-dir='1']");
    if (!prevBtn || !nextBtn) return false;
    const wrapper = document.createElement("div");
    wrapper.className = "ln-topic-nav-row";
    topicEl.parentNode.insertBefore(wrapper, topicEl);
    wrapper.appendChild(prevBtn);
    wrapper.appendChild(topicEl);
    wrapper.appendChild(nextBtn);
    // Hide the now-empty floating container (don't delete — preserve structure)
    fixedNav.style.display = "none";
    fixedNav.setAttribute("aria-hidden", "true");
    return true;
  }

  function wireDetailQuestionNav(detail) {
    // Remove any old injected nav
    document.getElementById("lnDetailFixedNav")?.remove();
    document.getElementById("lnDetailFooterNav")?.remove();

    // Hide native Svelte nav buttons (they lack correct click handlers)
    const navButtons = [...document.querySelectorAll("button")].filter((btn) => {
      if (btn.dataset.lnDetailDir) return false;
      if (!btn.querySelector("svg")) return false;
      const box = btn.getBoundingClientRect();
      return box.width >= 20 && box.height >= 20 && box.top > window.innerHeight * 0.4;
    });
    navButtons.forEach((btn) => {
      btn.classList.add("ln-old-detail-nav");
      btn.setAttribute("aria-hidden", "true");
      btn.tabIndex = -1;
    });

    // Build inline footer: ← Câu trước | Topic question | Câu tiếp →
    const footer = document.createElement("div");
    footer.id = "lnDetailFooterNav";
    footer.className = "ln-topic-nav-row";
    footer.style.cssText = "margin-top:.6rem;padding:.4rem .6rem;";
    footer.innerHTML = `
      <button type="button" data-ln-detail-dir="-1" aria-label="Câu trước">← Câu trước</button>
      <span style="flex:1;text-align:center;font-size:13px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        <span style="display:inline-block;border:1px solid #d1d5db;border-radius:9999px;padding:1px 8px;font-size:11px;margin-right:4px;">Topic</span>
        ${(detail.question || "").replace(/</g,"&lt;")}
      </span>
      <button type="button" data-ln-detail-dir="1" aria-label="Câu tiếp">Câu tiếp →</button>`;

    // Find the left column to append footer
    const leftCol = document.querySelector(".md\\:w-3\\/5") || document.querySelector('[class*="w-3/5"]');
    if (leftCol) {
      leftCol.appendChild(footer);
    } else {
      // Fallback: insert before the right panel or at end of main content
      const rightPanel = document.querySelector(".md\\:w-2\\/5") || document.querySelector('[class*="w-2/5"]');
      if (rightPanel) rightPanel.parentElement.insertBefore(footer, rightPanel);
      else document.body.appendChild(footer);
    }

    // Wire click handlers
    footer.querySelectorAll("button[data-ln-detail-dir]").forEach((btn) => {
      btn.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const direction = Number(btn.getAttribute("data-ln-detail-dir") || "1");
        const questions = await getDetailQuestionList(detail.part);
        if (!questions.length) return;
        const current = questions.findIndex((q) => q.trim().toLowerCase() === detail.question.trim().toLowerCase());
        const base = current >= 0 ? current : 0;
        const next = (base + direction + questions.length) % questions.length;
        location.href = detailQuestionHref(detail.part, questions[next]);
      };
    });
  }

  function syncDetailPartBadge(detail) {
    const partNum = (() => {
      const m = String(detail?.part || "").match(/(\d)/);
      if (m) return m[1];
      const m2 = decodeURIComponent(location.pathname).match(/PART\s*(\d)/i) || decodeURIComponent(location.pathname).match(/part(\d)/i);
      return m2 ? m2[1] : "1";
    })();
    const targetHref = "/question-answer/part" + partNum;
    const targetText = "PART " + partNum;
    document.querySelectorAll('.breadcrumbs a[href*="/question-answer/part"]').forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (!/\/question-answer\/part\d/i.test(href)) return;
      a.setAttribute("href", targetHref);
      // Replace just the trailing text node so the leading <svg> badge icon survives.
      let replaced = false;
      a.childNodes.forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE && /PART\s*\d/i.test(n.textContent || "")) {
          n.textContent = n.textContent.replace(/PART\s*\d/i, targetText);
          replaced = true;
        }
      });
      if (!replaced) {
        // Fallback: append a fresh label if no part text node exists yet.
        a.appendChild(document.createTextNode(" " + targetText));
      }
    });
  }

  function patchQuestionDetailChrome() {
    const detail = parseDetailRoute();
    if (!detail) return;
    document.body.classList.add("ln-question-detail-page");

    // Ẩn breadcrumb cũ (idempotent — classList.add ko trigger nếu đã có)
    document.getElementById("lnDetailHead")?.remove();
    document.getElementById("lnDetailFooterNav")?.remove();
    document.querySelectorAll(".ln-hide-breadcrumb").forEach(el => el.classList.remove("ln-hide-breadcrumb"));
    document.getElementById("lnInlineQuestion")?.remove();

    // The scraped HTML hard-codes "PART 1" in the breadcrumb badge regardless of
    // which Part is actually open. Realign it with the current route so users
    // on Part 2 / 3 don't see a misleading "PART 1" link.
    syncDetailPartBadge(detail);

    // Phương án 1: dùng header/footer gốc của Svelte, không inject thêm header/footer clone.
    wireDetailQuestionNav(detail);

    // Title cleanup (idempotent — chỉ chạy với element có title chưa xóa)
    document.querySelectorAll(".navbar").forEach((nav) => {
      const hasOldBrand = nav.querySelector('img[src*="logo.webp"], img[alt*="Luy"]') || /Luyen\s*Noi|Luy.n\s*N.i/i.test(nav.textContent || "");
      if (!hasOldBrand) return;
      (nav.closest(".hidden") || nav).remove();
    });

    document.querySelectorAll("button[title], a[title], [data-tip]").forEach((el) => {
      const label = `${el.getAttribute("title") || ""} ${el.getAttribute("data-tip") || ""}`.trim();
      if (!label || /câu tiếp|danh sách|dịch|lưu|topic|nghe câu hỏi/i.test(label)) {
        el.removeAttribute("title");
        el.removeAttribute("data-tip");
      }
    });

    // Modal cleanup (có guard chống chạy lại)
    document.querySelectorAll("dialog.modal, .modal, .modal-backdrop").forEach((el) => {
      if (el.__lnModalChecked) return;
      el.__lnModalChecked = true;
      const txt = (el.textContent || "").trim();
      if (!/The context:|Words to be translated|Output required/i.test(txt) && txt.toLowerCase() !== "close") return;
      if (typeof el.close === "function") {
        try { el.close(); } catch (_) {}
      }
      el.removeAttribute("open");
      el.style.display = "none";
      el.setAttribute("aria-hidden", "true");
    });
  }

  // ── Restore previous recording attempts from backend ──
  async function restorePreviousAttempts() {
    const detail = parseDetailRoute();
    if (!detail) return;
    const question = getQuestionFromPage();
    if (!question) return;
    // Guard: only run once per page
    if (document.body.dataset.lnAttemptsLoaded === question) return;
    document.body.dataset.lnAttemptsLoaded = question;

    try {
      const r = await realFetch(`/api/practice-attempts?question=${encodeURIComponent(question)}&limit=5`);
      const j = await r.json();
      if (!j.ok || !Array.isArray(j.attempts) || !j.attempts.length) return;

      // Check which attempts are already displayed (from current session localStorage)
      const existingPanels = document.querySelectorAll(".ln-score-panel, #ln-score-panel");
      const existingTranscripts = new Set();
      const seenKeys = new Set();
      existingPanels.forEach(p => {
        if (p.dataset.lnAttemptKey) seenKeys.add(p.dataset.lnAttemptKey);
        const t = p.querySelector(".ln-user-transcript");
        if (t) existingTranscripts.add(t.textContent.trim().slice(0, 80));
      });

      for (const attempt of j.attempts) {
        // Skip if already rendered
        const shortTranscript = (attempt.transcript || "").trim().slice(0, 80);
        const attemptKey = String(attempt.id || `${attempt.created_at || ""}:${shortTranscript}`);
        if (attemptKey && seenKeys.has(attemptKey)) continue;
        if (shortTranscript && existingTranscripts.has(shortTranscript)) continue;
        if (attemptKey) seenKeys.add(attemptKey);
        if (shortTranscript) existingTranscripts.add(shortTranscript);

        // Reconstruct the data shape that renderScoreResult expects
        const raw = attempt.raw || {};
        const d = {
          ...raw,
          transcript: attempt.transcript || raw.transcript || "",
          audioUrl: attempt.audioUrl || null,
          audioDataUrl: null,
          overall: attempt.overall ?? raw.overall,
          criteria: raw.criteria || {
            fluency: { score: attempt.fluency },
            vocabulary: { score: attempt.vocabulary },
            grammar: { score: attempt.grammar },
            pronunciation: { score: attempt.pronunciation }
          },
          question,
          __attemptKey: attemptKey,
          __fromCache: true,
          __restoredFromCloud: true
        };
        renderScoreResult(d);
      }
    } catch (e) {
      console.warn("[restore-attempts]", e.message);
    }
  }

  function patchTakeTestPalette() {
    if (!/^\/take-test(\/|$)/.test(location.pathname)) return;
    document.body.classList.add("ln-test-page");
    document.querySelectorAll('input[type="checkbox"]').forEach(el => el.classList.add("ln-red-checkbox"));
    [...document.querySelectorAll("button,a")].forEach(el => {
      const txt = (el.textContent || "").trim();
      if (/nghe|bắt đầu|bat dau|hủy|huy|thoát|thoat|ghi nhận|ghi nhan/i.test(txt)) el.classList.add("ln-test-button");
    });
  }
  async function syncAuthUserUi() {
    if (document.getElementById("lnSideUser") || document.querySelector(".ln-side-user")) return;
    if (document.getElementById("lnAuthUserPill")) return;
    let user = null;
    try {
      const r = await realFetch("/api/auth/user", { cache: "no-store" });
      const d = await r.json();
      user = d?.user || null;
    } catch {}
    if (!user) {
      try {
        const raw = localStorage.getItem("ln.user");
        user = raw ? JSON.parse(raw) : null;
      } catch {}
    }
    if (!user) return;
    const label = user.display_name || user.name || user.email || "Học viên";
    const avatar = user.avatar_url || "";
    const pill = document.createElement("div");
    pill.id = "lnAuthUserPill";
    pill.className = "ln-auth-user";
    pill.innerHTML = `${avatar ? `<img src="${avatar.replace(/"/g, "&quot;")}" alt="">` : `<span style="width:24px;height:24px;border:1.5px solid var(--ink);border-radius:50%;display:grid;place-items:center;background:white;">${label.slice(0,1).toUpperCase()}</span>`}<span>${label.replace(/[<>&"]/g, "")}</span><button type="button" style="border:0;background:transparent;font-weight:900;cursor:pointer;" title="Đăng xuất">×</button>`;
    pill.querySelector("button")?.addEventListener("click", (e) => {
      e.preventDefault();
      if (window.LNAuth?.logout) window.LNAuth.logout();
      else location.href = "/logout";
    });
    const summary = [...document.querySelectorAll("summary, a, button")].find(el => /Tài khoản|Tai khoan/i.test(el.textContent || ""));
    if (summary) summary.appendChild(pill);
    else document.body.appendChild(Object.assign(pill, { style: "position:fixed;right:16px;top:16px;z-index:9999;" }));
  }

  const MOJIBAKE_RE = /[\u00c3\u00c2\u00c4\u00c6\u00c5\u00cb\u00ce\u00c9\u00e1\u00ba\u00bb\u00e2\u20ac\u00f0\u0178]/;

  function decodeCp1252Mojibake(text) {
    if (!text || !MOJIBAKE_RE.test(text)) return text;
    const cp1252 = {
      0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
      0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
      0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
      0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
      0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
      0x017E: 0x9E, 0x0178: 0x9F
    };
    const bytes = [];
    for (const ch of text) {
      const code = ch.codePointAt(0);
      if (code <= 0xff) bytes.push(code);
      else if (cp1252[code] !== undefined) bytes.push(cp1252[code]);
      else return text;
    }
    try {
      const fixed = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
      return /�/.test(fixed) ? text : fixed;
    } catch {
      return text;
    }
  }

  function fixMojibakeText(root = document.body) {
    document.title = decodeCp1252Mojibake(document.title || "");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/i.test(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return MOJIBAKE_RE.test(node.nodeValue || "") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const fixed = decodeCp1252Mojibake(node.nodeValue || "");
      if (fixed !== node.nodeValue) node.nodeValue = fixed;
    });
    root.querySelectorAll?.("input[placeholder], textarea[placeholder], button[title], a[title], [aria-label]").forEach((el) => {
      ["placeholder", "title", "aria-label"].forEach((attr) => {
        const value = el.getAttribute(attr);
        if (!value) return;
        const fixed = decodeCp1252Mojibake(value);
        if (fixed !== value) el.setAttribute(attr, fixed);
      });
    });
  }

  // ──────────────── Init ────────────────
  // Add spin animation CSS once
  (function() {
    const s = document.createElement("style");
    s.textContent = "@keyframes ln-spin{to{transform:rotate(360deg)}} #ln-word-modal .ln-word-action{color:#fff!important;} #ln-word-modal .ln-word-action *{color:#fff!important;} .ln-pronun-input-button,.ln-pronun-input-button *{color:#171717!important;}";
    document.head.appendChild(s);
  })();

  // ── Logo → landing page ──
  function patchLogoLinks() {
    document.querySelectorAll('a[href="/"]').forEach(a => {
      // Only patch logo links (ones containing the logo image or brand text "Luyện Nói")
      if (a.querySelector('img[alt*="Logo"]') || (a.textContent.trim().replace(/\s+/g,' ').startsWith('Luyện Nói') && a.classList.contains('font-semibold'))) {
        a.href = '/login';
      }
    });
  }

  function startRehydration() {
    // Evict expired word-sync caches (>3 days)
    try {
      const WS_PREFIX = "ln.wordSync:";
      const WS_MAX_AGE = 3 * 24 * 60 * 60 * 1000;
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(WS_PREFIX)) continue;
        try {
          const v = JSON.parse(localStorage.getItem(k));
          if (!v || !v.ts || (Date.now() - v.ts > WS_MAX_AGE)) localStorage.removeItem(k);
        } catch { localStorage.removeItem(k); }
      }
    } catch {}
    cleanupFakeScoreHistory();
    fixMojibakeText();
    patchLogoLinks();
    wirePronounInputBox();
    wireButtons();
    wireTopicTabs();
    clearDetailOnlyPanels();
    fixDetailLayout();
    patchDashboard();
    patchHistory();
    attachTtsTooltips();
    wireHeaderPlayButton();
    patchSidebarNav();
    ensureFixedUserBadge();
    patchHomeAnalytics();
    patchPracticeChrome();
    wireQuestionSearchFilter();
    patchQuestionScoreBadges();
    patchTopicSyncLabels();
    patchQuestionDetailChrome();
    patchTakeTestPalette();
    hideBangVangTab();
    patchStrictTestEntry();
    patchFullTestHistory();
    patchTakeTestSummary();
    wireTakeTestPartLinks();
    stripMockHistory();
    wireBandTooltip();
    injectLuyenDocNav();
    injectTranscribeButton();
    injectNoteInput();
    syncAuthUserUi();
    // Auto cue-cards on Part 2 detail (delayed to let layout settle)
    setTimeout(autoLoadCueCards, 800);
    // Restore cached AI assist results for this question
    restoreCachedAssist();
    // Restore previous recording attempts from backend (delayed to let page settle)
    setTimeout(restorePreviousAttempts, 1500);
    // ── MutationObserver: rAF micro-batch + disconnect guard ──
    // Dùng rAF (~16ms) thay vì setTimeout 250ms để event handler không bị mất quá lâu
    let __lnObsScheduled = false;
    const mo = new MutationObserver(() => {
      if (__lnObsScheduled) return;
      __lnObsScheduled = true;
      requestAnimationFrame(() => {
        mo.disconnect(); // tạm dừng observer trong khi patch DOM
        try {
          fixMojibakeText();
          wirePronounInputBox();
          wireButtons();
          wireTopicTabs();
          clearDetailOnlyPanels();
          patchDashboard();
          attachTtsTooltips();
          wireHeaderPlayButton();
          patchSidebarNav();
          ensureFixedUserBadge();
          patchHomeAnalytics();
          patchPracticeChrome();
          wireQuestionSearchFilter();
          patchQuestionScoreBadges();
          patchTopicSyncLabels();
          patchQuestionDetailChrome();
          patchTakeTestPalette();
          hideBangVangTab();
          patchStrictTestEntry();
          patchFullTestHistory();
          patchTakeTestSummary();
          wireTakeTestPartLinks();
          patchPronunIndexLessons();
          stripMockHistory();
          wireBandTooltip();
          injectLuyenDocNav();
          injectTranscribeButton();
          injectNoteInput();
          syncAuthUserUi();
        } finally {
          __lnObsScheduled = false;
          mo.observe(document.body, { childList: true, subtree: true });
        }
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // Drop the FOUC curtain after layout settles (two rAFs ensure paint completed)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try { window.__lnReveal && window.__lnReveal(); } catch {}
    }));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startRehydration);
  } else {
    startRehydration();
  }

  // When Supabase data sync finishes, re-render home analytics + question score badges
  window.addEventListener("ln-data-synced", () => {
    try {
      // Force re-render of home analytics by removing the existing section first
      const existing = document.getElementById("lnHomeAnalytics");
      if (existing) existing.remove();
      patchHomeAnalytics();
      patchQuestionScoreBadges();
    } catch (e) { console.warn("[re-render]", e); }
  });

  // Auto-mở modal user khi redirect từ /settings (?openUserModal=1)
  try {
    if (new URLSearchParams(location.search).get("openUserModal") === "1") {
      setTimeout(() => {
        try { renderUserDetailsModal(); } catch {}
        // Clean URL để không mở lại khi reload
        const u = new URL(location.href); u.searchParams.delete("openUserModal");
        history.replaceState(null, "", u.pathname + u.search + u.hash);
      }, 400);
    }
  } catch {}

  // Expose for landing page profile button
  window.renderUserDetailsModal = renderUserDetailsModal;

  console.log("[LN-Overlay] active — bridge + rehydration + mock state + recording UI");
})();
