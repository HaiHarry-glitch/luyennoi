// =====================================================================
//  Luyện thì quá khứ — /alphafeature/past-tense
//  Sentences show the verb in parentheses (uninflected). Student must
//  conjugate to the correct past tense form and say the full sentence.
//  AI (Gemini) scores correctness + flags wrong tense.
// =====================================================================
(function () {
  const mount = document.getElementById("pastTenseRoot");
  if (!mount) return;

  // ── Static sentence library — verbs in parens, student picks past form ──
  // Each: { template (with "(verb)"), correct (with conjugated verb), tense, note }
  const SENTENCES = [
    { template: "Yesterday I (go) to the cinema with my friends.",       correct: "went",        tense: "simple past",     note: "go → went (irregular)" },
    { template: "She (eat) breakfast at 7 a.m. this morning.",            correct: "ate",         tense: "simple past",     note: "eat → ate (irregular)" },
    { template: "When I arrived, they (already / leave).",                correct: "had already left", tense: "past perfect", note: "Quá khứ hoàn thành: had + V3 cho hành động trước hành động khác trong quá khứ" },
    { template: "He (study) for three hours when his mom came home.",     correct: "had been studying", tense: "past perfect continuous", note: "had been + V-ing — diễn tả hành động kéo dài đến 1 mốc thời gian quá khứ" },
    { template: "I (watch) TV when the phone (ring).",                    correct: "was watching ... rang", tense: "past continuous + simple past", note: "was/were V-ing cho hành động đang xảy ra, simple past cho hành động chen vào" },
    { template: "They (play) football yesterday afternoon.",              correct: "played",      tense: "simple past",     note: "Regular verb: play → played" },
    { template: "My family (visit) Hanoi last summer.",                   correct: "visited",     tense: "simple past",     note: "Regular verb: visit → visited" },
    { template: "While we (walk) home, it (start) to rain.",              correct: "were walking ... started", tense: "past continuous + simple past", note: "Cấu trúc song hành: while + V-ing, simple past" },
    { template: "She (not finish) her homework when the bell rang.",      correct: "had not finished (hadn't finished)", tense: "past perfect", note: "Phủ định quá khứ hoàn thành: had not + V3" },
    { template: "Last night I (read) a book before I (go) to bed.",       correct: "read ... went", tense: "simple past", note: "read giữ nguyên cách viết nhưng phát âm /red/" },
    { template: "Tom (buy) a new car last week.",                          correct: "bought",      tense: "simple past",     note: "buy → bought (irregular)" },
    { template: "We (have) dinner when the lights (go) out.",             correct: "were having ... went", tense: "past continuous + simple past", note: "have meal dùng was/were having" },
    { template: "She (sing) beautifully at the concert yesterday.",        correct: "sang",        tense: "simple past",     note: "sing → sang (irregular)" },
    { template: "By the time we arrived, the movie (start).",              correct: "had started", tense: "past perfect",    note: "By the time + simple past, mệnh đề chính dùng past perfect" },
    { template: "I (live) in Saigon for 5 years before I moved here.",     correct: "had lived (had been living)", tense: "past perfect / past perfect continuous", note: "for + thời gian → past perfect hoặc past perfect continuous đều OK" },
    { template: "He (write) three letters yesterday.",                     correct: "wrote",       tense: "simple past",     note: "write → wrote (irregular)" },
    { template: "She (teach) English at our school last year.",            correct: "taught",      tense: "simple past",     note: "teach → taught (irregular)" },
    { template: "While he (drive) home, he (see) an accident.",            correct: "was driving ... saw", tense: "past continuous + simple past", note: "drive → was driving, see → saw" },
    { template: "They (build) the bridge in 1995.",                        correct: "built",       tense: "simple past",     note: "build → built (irregular)" },
    { template: "When I called you, what (you / do)?",                      correct: "were you doing", tense: "past continuous (question)", note: "Câu hỏi quá khứ tiếp diễn: were + S + V-ing" },
    { template: "I (take) lots of photos during our trip last summer.",   correct: "took",        tense: "simple past",     note: "take → took (irregular)" },
    { template: "She (cook) dinner for two hours when I got home.",       correct: "had been cooking", tense: "past perfect continuous", note: "Nhấn mạnh khoảng thời gian kéo dài đến mốc quá khứ" },
    { template: "We (not see) each other since 2019.",                     correct: "hadn't seen / hadn't been seeing", tense: "past perfect", note: "since + năm dùng perfect — ở văn cảnh quá khứ thì là past perfect" },
    { template: "The children (sleep) when I checked on them.",            correct: "were sleeping", tense: "past continuous", note: "Hành động đang xảy ra tại 1 thời điểm quá khứ" },
    { template: "I (lose) my keys yesterday and (find) them this morning.", correct: "lost ... found", tense: "simple past", note: "lose → lost, find → found" },
  ];

  const STATE = {
    idx: 0,
    history: loadHistory(),
    recorder: null, stream: null, chunks: [], recording: false,
  };

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem("ln.pastTenseHistory") || "[]"); } catch { return []; }
  }
  function saveAttempt(rec) {
    try {
      const arr = loadHistory();
      arr.unshift({ ts: Date.now(), ...rec });
      localStorage.setItem("ln.pastTenseHistory", JSON.stringify(arr.slice(0, 200)));
      STATE.history = arr;
    } catch {}
  }

  const getKey = () => {
    try { return (JSON.parse(localStorage.getItem("luyennoi.geminiKeys") || "[]")[0]) || localStorage.getItem("luyennoi.geminiKey") || ""; }
    catch { return localStorage.getItem("luyennoi.geminiKey") || ""; }
  };
  const getModel = () => localStorage.getItem("luyennoi.geminiModel") || "";
  const escHtml = s => String(s||"").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function speak(text) {
    if (!text) return;
    try { speechSynthesis.cancel(); } catch {}
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB"; u.rate = 0.9;
    const vn = localStorage.getItem("ln.ttsVoice");
    if (vn) { const v = speechSynthesis.getVoices().find(x => x.name === vn); if (v) u.voice = v; }
    setTimeout(() => speechSynthesis.speak(u), 30);
  }
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  // ──────────── Inject CSS once ────────────
  (function css() {
    if (document.getElementById("ln-pt-css")) return;
    const s = document.createElement("style");
    s.id = "ln-pt-css";
    s.textContent = `
      #pastTenseRoot { font-family:Lexend,sans-serif; padding:1.2rem 1.4rem; max-width:1100px; margin:0 auto; }
      .pt-wrap { display:grid; grid-template-columns:minmax(0,1.6fr) minmax(0,1fr); gap:1rem; }
      @media (max-width:880px) { .pt-wrap { grid-template-columns:1fr; } }
      .pt-card { background:white; border-radius:.9rem; border:1px solid #e5e7eb; padding:1.3rem 1.5rem; }
      .pt-bc { font-size:.78rem; color:#6b7280; margin-bottom:.7rem; }
      .pt-bc a { color:#d9381e; text-decoration:none; }
      .pt-nav { display:flex; justify-content:space-between; align-items:center; gap:.5rem; margin-bottom:1rem; }
      .pt-nav-btn { padding:.4rem 1rem; border:1.5px solid #e5e7eb; background:white; border-radius:9999px; cursor:pointer; font-size:.82rem; color:#4b5563; font-family:inherit; }
      .pt-nav-btn:hover:not(:disabled) { border-color:#d9381e; color:#d9381e; }
      .pt-nav-btn:disabled { opacity:.35; cursor:not-allowed; }
      .pt-counter { font-weight:600; color:#171717; }
      .pt-counter small { color:#9ca3af; font-weight:500; margin-left:.3rem; }
      .pt-sentence { background:white; border:2.5px solid #171717; border-radius:9999px; padding:.7rem 1.5rem .7rem .6rem; display:inline-flex; align-items:center; gap:.7rem; font-size:1.15rem; color:#171717; margin:1rem 0; }
      .pt-sentence-row { text-align:center; }
      .pt-play { background:white; border:2.5px solid #171717; color:#171717; border-radius:50%; width:2.3rem; height:2.3rem; cursor:pointer; font-size:.85rem; flex-shrink:0; }
      .pt-play:hover { background:#ffffff; }
      .pt-verb-blank { background:#fff7ed; color:#c2410c; padding:.1rem .55rem; border-radius:.35rem; font-weight:700; font-family:'Courier New',monospace; border:1.5px dashed #fdba74; }
      .pt-hint { text-align:center; color:#9ca3af; font-size:.82rem; margin:.4rem 0 1.2rem; }
      .pt-actions { text-align:center; }
      .pt-rec-btn { padding:.85rem 2rem; border:none; border-radius:9999px; font-weight:700; cursor:pointer; font-family:inherit; font-size:1rem; background:#d9381e; color:white; box-shadow:0 4px 16px rgba(217,56,30,.28); }
      .pt-rec-btn:hover { background:#171717; }
      .pt-rec-btn.recording { background:#ef4444; animation:pt-pulse 1.2s infinite; }
      @keyframes pt-pulse { 0%,100% { box-shadow:0 0 0 0 rgba(239,68,68,.5) } 50% { box-shadow:0 0 0 12px rgba(239,68,68,0) } }
      .pt-feedback { background:#ffffff; border-radius:.7rem; padding:1rem 1.2rem; margin-top:1rem; }
      .pt-fb-head { display:flex; align-items:center; gap:.7rem; margin-bottom:.5rem; }
      .pt-fb-badge { width:2.4rem; height:2.4rem; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:1.1rem; flex-shrink:0; }
      .pt-fb-ok { background:#FFD700; }
      .pt-fb-no { background:#d9381e; }
      .pt-fb-title { font-weight:700; color:#171717; font-size:.95rem; }
      .pt-fb-tense { font-size:.74rem; color:#d9381e; font-weight:600; margin-top:.1rem; }
      .pt-fb-answer { background:white; padding:.55rem .85rem; border-radius:.5rem; margin:.4rem 0; font-size:.92rem; color:#171717; border-left:4px solid #FFD700; }
      .pt-fb-heard { font-size:.82rem; color:#4b5563; padding:.3rem .6rem; }
      .pt-fb-note { background:#fef3c7; border-left:4px solid #f59e0b; padding:.5rem .8rem; margin-top:.4rem; font-size:.82rem; color:#92400e; border-radius:.3rem; }

      .pt-rules h3 { font-size:1rem; font-weight:700; color:#171717; margin:0 0 .7rem; }
      .pt-rule-item { background:#ffffff; border-radius:.5rem; padding:.6rem .85rem; margin-bottom:.45rem; font-size:.85rem; line-height:1.55; }
      .pt-rule-item b { color:#d9381e; }
      .pt-hist { margin-top:1rem; max-height:340px; overflow-y:auto; display:flex; flex-direction:column; gap:.35rem; }
      .pt-hist-row { background:#f9fafb; border-radius:.45rem; padding:.5rem .75rem; font-size:.78rem; border-left:3px solid #d1d5db; }
      .pt-hist-row.ok { border-left-color:#FFD700; }
      .pt-hist-row.no { border-left-color:#d9381e; }
      .pt-hist-row b { color:#171717; }
    `;
    document.head.appendChild(s);
  })();

  function renderVerbBlanks(template) {
    // Replace "(verb)" with <span class="pt-verb-blank">verb</span>
    return escHtml(template).replace(/\(([^)]+)\)/g, (_, inner) => `<span class="pt-verb-blank">${inner}</span>`);
  }

  function render() {
    const s = SENTENCES[STATE.idx];
    const total = SENTENCES.length;
    mount.innerHTML = `
      <div class="pt-wrap">
        <div class="pt-card">
          <div class="pt-bc"><a href="/">Trang chủ</a> · <a href="/question-answer">Luyện theo câu</a> · Luyện thì quá khứ</div>
          <div class="pt-nav">
            <button class="pt-nav-btn" id="ptPrev" ${STATE.idx === 0 ? "disabled" : ""}>← câu trước</button>
            <div class="pt-counter" id="ptCounter">Câu ${STATE.idx + 1} <small>/ ${total}</small></div>
            <button class="pt-nav-btn" id="ptNext" ${STATE.idx >= total - 1 ? "disabled" : ""}>câu tiếp →</button>
          </div>
          <div class="pt-sentence-row">
            <div class="pt-sentence">
              <button class="pt-play" id="ptTts" title="Nghe câu mẫu (đã chia)">▶</button>
              <span>${renderVerbBlanks(s.template)}</span>
            </div>
          </div>
          <div class="pt-hint">Tự chia động từ trong ngoặc về thì quá khứ phù hợp, rồi đọc cả câu.</div>
          <div id="ptFeedbackHost"></div>
          <div class="pt-actions">
            <button class="pt-rec-btn" id="ptRec">🎤 Ghi âm ngay</button>
          </div>
        </div>
        <div class="pt-card pt-rules">
          <h3>Tóm tắt các thì quá khứ</h3>
          <div class="pt-rule-item"><b>Simple past</b> → V2 (động từ chia quá khứ). VD: <i>I went, she ate, they played</i></div>
          <div class="pt-rule-item"><b>Past continuous</b> → was/were + V-ing. Hành động đang xảy ra tại 1 thời điểm quá khứ.</div>
          <div class="pt-rule-item"><b>Past perfect</b> → had + V3. Hành động xảy ra trước 1 hành động khác trong quá khứ.</div>
          <div class="pt-rule-item"><b>Past perfect continuous</b> → had been + V-ing. Hành động kéo dài đến 1 mốc quá khứ.</div>
          <div style="font-size:.78rem;color:#6b7280;margin-top:.7rem;">Lịch sử gần đây:</div>
          <div class="pt-hist" id="ptHist"></div>
        </div>
      </div>
    `;
    // TTS reads the correct/conjugated version
    mount.querySelector("#ptTts").addEventListener("click", () => speak(s.template.replace(/\(([^)]+)\)/g, (_, w) => extractFirstFormFromCorrect(s.correct, w))));
    mount.querySelector("#ptPrev").addEventListener("click", () => { if (STATE.idx > 0) { STATE.idx--; render(); } });
    mount.querySelector("#ptNext").addEventListener("click", () => { if (STATE.idx < total - 1) { STATE.idx++; render(); } });
    mount.querySelector("#ptRec").addEventListener("click", toggleRecord);
    renderHistory();
  }

  // Best-effort: extract the conjugated form from the "correct" answer string
  function extractFirstFormFromCorrect(correct, fallback) {
    // For TTS, just use the correct answer as-is — it's already conjugated
    return correct.split(/\s+\.\.\.\s+/)[0]?.split(/\(/)[0]?.trim() || fallback;
  }

  function renderHistory() {
    const host = mount.querySelector("#ptHist");
    if (!host) return;
    const list = STATE.history.slice(0, 12);
    if (!list.length) { host.innerHTML = `<div style="color:#9ca3af;text-align:center;padding:.5rem;font-size:.78rem;">Chưa luyện câu nào.</div>`; return; }
    host.innerHTML = list.map(h => `
      <div class="pt-hist-row ${h.correct ? "ok" : "no"}">
        <b>${escHtml((h.template||"").slice(0,60))}${(h.template||"").length>60?"…":""}</b><br>
        ${h.correct ? "✓ Đúng" : "✗ Sai"} — đáp án: <b>${escHtml(h.correctAnswer || "")}</b>
      </div>`).join("");
  }

  async function toggleRecord() {
    const btn = mount.querySelector("#ptRec");
    if (STATE.recording) { try { STATE.recorder?.stop(); } catch {} return; }
    if (!getKey()) { location.href = `/settings?next=${encodeURIComponent(location.pathname + location.search)}`; return; }
    try {
      STATE.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      STATE.chunks = [];
      const mimeOpts = typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported("audio/webm") ? { mimeType: "audio/webm" } : {};
      STATE.recorder = new MediaRecorder(STATE.stream, mimeOpts);
      STATE.recorder.ondataavailable = e => STATE.chunks.push(e.data);
      STATE.recorder.onstop = onStop;
      STATE.recorder.start();
      STATE.recording = true;
      btn.classList.add("recording");
      btn.textContent = "🛑 Dừng & chấm";
    } catch (e) { alert("Không truy cập mic: " + e.message); }
  }

  async function onStop() {
    STATE.stream?.getTracks().forEach(t => t.stop());
    STATE.recording = false;
    const btn = mount.querySelector("#ptRec");
    if (btn) { btn.classList.remove("recording"); btn.textContent = "⏳ Đang chấm…"; btn.disabled = true; }
    const blob = new Blob(STATE.chunks, { type: "audio/webm" });
    const b64 = await blobToBase64(blob);
    const s = SENTENCES[STATE.idx];
    const targetSentence = s.template.replace(/\(([^)]+)\)/g, s.correct.split(/\s+\.\.\.\s+/)[0] || s.correct);
    try {
      const r = await fetch("/api/gemini/score-sentence", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: getKey(), model: getModel(),
          sentence: targetSentence,
          audioBase64: b64.split(",")[1] || b64,
          mimeType: "audio/webm",
          context: `PAST TENSE DRILL — The sentence has "(verb)" placeholders. The student must conjugate to ${s.tense}. Correct answer: "${s.correct}". Listen carefully and identify whether they used the right past form. If wrong, identify what tense they used instead.`
        })
      });
      const d = await r.json();
      const heardLower = (d.phoneticHeard || d.verdict || "").toLowerCase();
      const correctLower = s.correct.toLowerCase();
      // Heuristic: did they use the correct form?
      const correctTokens = correctLower.split(/[\s.\/]+/).filter(t => t.length > 2);
      const matchCount = correctTokens.filter(t => heardLower.includes(t)).length;
      const isCorrect = matchCount >= Math.ceil(correctTokens.length * 0.6);
      showFeedback({ isCorrect, s, raw: d });
      saveAttempt({ template: s.template, correct: isCorrect, correctAnswer: s.correct, tense: s.tense, heard: d.phoneticHeard });
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = "🎤 Ghi âm lại"; }
      alert("Lỗi chấm: " + e.message);
    }
  }

  function showFeedback({ isCorrect, s, raw }) {
    const host = mount.querySelector("#ptFeedbackHost");
    const btn = mount.querySelector("#ptRec");
    if (btn) { btn.disabled = false; btn.textContent = "🎤 Ghi âm lại"; }
    host.innerHTML = `
      <div class="pt-feedback">
        <div class="pt-fb-head">
          <div class="pt-fb-badge ${isCorrect ? "pt-fb-ok" : "pt-fb-no"}">${isCorrect ? "✓" : "✗"}</div>
          <div>
            <div class="pt-fb-title">${isCorrect ? "Tuyệt vời!" : "Sửa lỗi nhé!"}</div>
            <div class="pt-fb-tense">Thì: ${escHtml(s.tense)}</div>
          </div>
        </div>
        <div class="pt-fb-answer">Đáp án: <b>${escHtml(s.template.replace(/\(([^)]+)\)/g, () => s.correct.split(/\s+\.\.\.\s+/)[0]))}</b></div>
        ${raw?.phoneticHeard ? `<div class="pt-fb-heard">Bạn đọc: <i style="color:#d9381e;">${escHtml(raw.phoneticHeard)}</i></div>` : ""}
        <div class="pt-fb-note">📌 ${escHtml(s.note)}</div>
      </div>
    `;
  }

  render();
})();

