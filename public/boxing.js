// =====================================================================
//  Luyện S/es — /alphafeature/boxing
//  Student reads a sentence with "(verb1 / verb2)" choice → records →
//  Gemini scores ONLY the s/es correctness (did they say the right form?).
//  Static sentence library — no AI generation, fast & consistent.
// =====================================================================
(function () {
  if (!/^\/alphafeature\/boxing\/?$/.test(location.pathname)) return;

  // ──────────────── Static sentence library ────────────────
  // Each: template with "(form1 / form2)", correct form, reason in Vietnamese.
  // Verbs alternate s/es; nouns alternate singular/plural.
  const SENTENCES = [
    { template: "Cats usually (play / plays) with yarn every day.", correct: "play", reason: "Cats là số nhiều → động từ không thêm s." },
    { template: "My brother (want / wants) to join the team.", correct: "wants", reason: "My brother là số ít (ngôi 3) → động từ thêm s." },
    { template: "She (study / studies) English every evening.", correct: "studies", reason: "She là ngôi 3 số ít → động từ thêm es (study → studies)." },
    { template: "The boys (run / runs) to school in the morning.", correct: "run", reason: "The boys là số nhiều → động từ không thêm s." },
    { template: "He (watch / watches) movies on weekends.", correct: "watches", reason: "He là ngôi 3 số ít → watch + es (vì kết thúc bằng ch)." },
    { template: "My parents (live / lives) in Hanoi.", correct: "live", reason: "My parents là số nhiều → động từ không thêm s." },
    { template: "The dog (bark / barks) at strangers.", correct: "barks", reason: "The dog là số ít → động từ thêm s." },
    { template: "Children often (ask / asks) many questions.", correct: "ask", reason: "Children là số nhiều → động từ không thêm s." },
    { template: "Tom (do / does) his homework after dinner.", correct: "does", reason: "Tom là ngôi 3 số ít → do → does (irregular)." },
    { template: "Many students (have / has) part-time jobs.", correct: "have", reason: "Many students là số nhiều → have (không phải has)." },
    { template: "My sister (go / goes) shopping every weekend.", correct: "goes", reason: "My sister là ngôi 3 số ít → go + es." },
    { template: "These books (belong / belongs) to the library.", correct: "belong", reason: "These books số nhiều → động từ không thêm s." },
    { template: "Linda (try / tries) hard at every exam.", correct: "tries", reason: "Linda số ít → try → tries (y → ies)." },
    { template: "The trains (arrive / arrives) every hour.", correct: "arrive", reason: "The trains số nhiều → không thêm s." },
    { template: "It (rain / rains) a lot in this city.", correct: "rains", reason: "It là ngôi 3 số ít → động từ thêm s." },
    { template: "The teachers (give / gives) us lots of homework.", correct: "give", reason: "The teachers số nhiều → không thêm s." },
    { template: "My friend (love / loves) chocolate ice cream.", correct: "loves", reason: "My friend số ít → động từ thêm s." },
    { template: "The kids (eat / eats) breakfast at seven.", correct: "eat", reason: "The kids số nhiều → không thêm s." },
    { template: "She (fix / fixes) bikes in her free time.", correct: "fixes", reason: "She ngôi 3 số ít → fix + es (vì kết thúc bằng x)." },
    { template: "We (work / works) from nine to five.", correct: "work", reason: "We là số nhiều → động từ không thêm s." },
    { template: "Anna (catch / catches) the bus at eight.", correct: "catches", reason: "Anna số ít → catch + es (vì kết thúc bằng ch)." },
    { template: "Most people (prefer / prefers) tea in the morning.", correct: "prefer", reason: "Most people số nhiều → không thêm s." },
    { template: "The baby (cry / cries) when he is hungry.", correct: "cries", reason: "The baby số ít → cry → cries (y → ies)." },
    { template: "My grandparents (visit / visits) us once a month.", correct: "visit", reason: "My grandparents số nhiều → không thêm s." },
    { template: "John (miss / misses) his hometown a lot.", correct: "misses", reason: "John số ít → miss + es (vì kết thúc bằng ss)." },
  ];

  const STATE = {
    idx: 0,
    sentence: SENTENCES[0],
    history: loadHistory(),
    recorder: null, stream: null, chunks: [], recording: false,
  };

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem("ln.boxingHistory") || "[]"); } catch { return []; }
  }
  function saveAttempt(rec) {
    try {
      const arr = loadHistory();
      arr.unshift({ ts: Date.now(), ...rec });
      localStorage.setItem("ln.boxingHistory", JSON.stringify(arr.slice(0, 200)));
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
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = "en-GB"; u.rate = 0.9;
    const vn = localStorage.getItem("ln.ttsVoice");
    if (vn) { const v = speechSynthesis.getVoices().find(x => x.name === vn); if (v) u.voice = v; }
    setTimeout(() => speechSynthesis.speak(u), 40);
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  // ──────────────── Mount custom UI on top of scraped page ────────────────
  let root = null;
  function mount() {
    const style = document.createElement("style");
    style.textContent = `
      /* Mount inside the Luyennoi shell — keep sidebar visible */
      #bx-root, #boxingRoot { font-family: Lexend, sans-serif; }
      #bx-root { padding: 1.2rem 1.2rem 2rem; }
      .bx-wrap { max-width: 1080px; margin: 0 auto; display: grid; grid-template-columns: minmax(0,1.5fr) minmax(0,1fr); gap: 1rem; }
      @media (max-width:880px) { .bx-wrap { grid-template-columns: 1fr; } }
      .bx-card { background: white; border-radius: 1rem; box-shadow: 0 4px 24px rgba(0,0,0,0.06); padding: 1.4rem 1.6rem; }
      .bx-bc { font-size: .82rem; color: #6b7280; margin-bottom: 1rem; }
      .bx-bc a { color: #d9381e; text-decoration: none; }
      .bx-bc a:hover { text-decoration: underline; }
      .bx-counter { font-size: .72rem; color: #9ca3af; font-weight: 700; }
      .bx-q { background: white; border: 2px solid #171717; border-radius: 9999px; padding: .5rem 1.2rem .5rem .5rem; display: inline-flex; align-items: center; gap: .6rem; font-size: 1.05rem; font-weight: 500; color: #171717; margin: 1rem 0; }
      .bx-play { background: white; border: 2px solid #171717; color: #171717; border-radius: 50%; width: 2.2rem; height: 2.2rem; cursor: pointer; font-size: .85rem; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .bx-play:hover { background: #ffffff; }
      .bx-nav { display: flex; justify-content: space-between; gap: .5rem; }
      .bx-nav-btn { padding: .4rem 1rem; border: 1.5px solid #e5e7eb; background: white; border-radius: 9999px; cursor: pointer; font-size: .82rem; color: #4b5563; font-family: inherit; }
      .bx-nav-btn:hover { border-color: #d9381e; color: #d9381e; }
      .bx-rec-btn { padding: .85rem 2rem; border: none; border-radius: 9999px; font-weight: 700; cursor: pointer; font-family: inherit; font-size: 1rem; background: #d9381e; color: white; box-shadow: 0 4px 16px rgba(217,56,30,.28); }
      .bx-rec-btn:hover { background: #171717; }
      .bx-rec-btn.recording { background: #ef4444; box-shadow: 0 0 0 0 rgba(239,68,68,.5); animation: bx-pulse 1.2s infinite; }
      @keyframes bx-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,.5) } 50% { box-shadow: 0 0 0 12px rgba(239,68,68,0) } }
      .bx-feedback { background: #fffbe6; border-radius: .7rem; padding: 1rem 1.2rem; margin-top: 1rem; position: relative; }
      .bx-feedback .bx-x { position: absolute; top: .8rem; right: .8rem; width: 2.5rem; height: 2.5rem; background: #d9381e; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
      .bx-feedback .bx-check { background: #FFD700; }
      .bx-fb-label { color: #d9381e; font-size: .78rem; font-weight: 600; margin-top: .3rem; }
      .bx-fb-label.ok { color: #FFD700; }
      .bx-reason { background: white; border-left: 4px solid #d9381e; padding: .55rem .85rem; margin-top: .6rem; color: #d9381e; font-weight: 600; font-size: .9rem; }
      .bx-hint { background: #fef3c7; border-left: 4px solid #f59e0b; padding: .5rem .8rem; margin-top: .5rem; font-size: .82rem; color: #92400e; }
      .strike { text-decoration: line-through; background: #ffffff; color: var(--red); padding: 0 .25rem; border-radius: .2rem; }
      .pick { background: #fffbe6; color: #171717; padding: 0 .3rem; border-radius: .2rem; font-weight: 600; }
      .bx-rules h3 { font-size: 1rem; font-weight: 700; color: #171717; margin: 0 0 .8rem; }
      .bx-rule-item { background: #ffffff; border-radius: .55rem; padding: .7rem .9rem; margin-bottom: .55rem; font-size: .9rem; line-height: 1.5; }
      .bx-rule-item b { color: #d9381e; }
      .bx-hist { margin-top: 1rem; max-height: 320px; overflow-y: auto; }
      .bx-hist-row { background: #f9fafb; border-radius: .5rem; padding: .55rem .8rem; margin-bottom: .35rem; font-size: .78rem; }
    `;
    document.head.appendChild(style);
    // Mount inside the shell's #boxingRoot. If shell not present (legacy), fall back to body.
    const shellMount = document.getElementById("boxingRoot");
    if (shellMount) {
      root = document.createElement("div");
      root.id = "bx-root";
      shellMount.appendChild(root);
    } else {
      root = document.createElement("div");
      root.id = "bx-root";
      document.body.appendChild(root);
    }
  }

  function renderSentence() {
    const s = STATE.sentence;
    const choices = s.template.match(/\(([^)]+)\)/);
    const opts = choices ? choices[1].split("/").map(x => x.trim()) : [];
    const total = SENTENCES.length;
    root.innerHTML = `
      <div class="bx-wrap">
        <div class="bx-card">
          <div class="bx-bc"><a href="/">← Trang chủ</a> · <a href="/question-answer">Luyện từng câu</a> · S/es</div>
          <div class="bx-nav" style="margin-bottom:.7rem;">
            <button class="bx-nav-btn" id="bx-prev" ${STATE.idx === 0 ? "disabled style='opacity:.4;cursor:not-allowed;'" : ""}>← câu trước</button>
            <div style="text-align:center;">
              <div style="font-weight:600;color:#171717;">Đọc lại câu phía dưới</div>
              <div class="bx-counter">Câu ${STATE.idx + 1} / ${total}</div>
            </div>
            <button class="bx-nav-btn" id="bx-next" ${STATE.idx >= total - 1 ? "disabled style='opacity:.4;cursor:not-allowed;'" : ""}>câu tiếp →</button>
          </div>
          <div style="text-align:center;">
            <div class="bx-q">
              <button class="bx-play" id="bx-tts" title="Nghe câu mẫu">▶</button>
              <span>${escHtml(s.template)}</span>
            </div>
          </div>
          <div id="bx-feedback-host"></div>
          <div style="text-align:center;margin-top:1.4rem;">
            <button class="bx-rec-btn" id="bx-rec">🎤 Ghi âm ngay</button>
          </div>
        </div>
        <div class="bx-card bx-rules">
          <h3>Khi nào cần thêm -s / -es?</h3>
          <div class="bx-rule-item"><b>ĐỘNG TỪ</b> → nếu chủ ngữ là <b>he / she / it</b><br>Thì phải thêm <b>-s / -es</b></div>
          <div class="bx-rule-item"><b>DANH TỪ</b> → nếu số lượng > 1<br>Thì phải thêm <b>-s / -es</b></div>
          <div style="font-size:.78rem;color:#6b7280;margin-top:.7rem;">Lịch sử luyện gần đây:</div>
          <div class="bx-hist" id="bx-hist"></div>
        </div>
      </div>
    `;
    root.querySelector("#bx-tts").addEventListener("click", () => {
      // Speak with the CORRECT form
      speak(s.template.replace(/\([^)]+\)/, s.correct));
    });
    root.querySelector("#bx-prev").addEventListener("click", () => goTo(STATE.idx - 1));
    root.querySelector("#bx-next").addEventListener("click", () => goTo(STATE.idx + 1));
    root.querySelector("#bx-rec").addEventListener("click", toggleRecord);
    renderHistory();
  }

  function renderHistory() {
    const host = root.querySelector("#bx-hist");
    if (!host) return;
    const list = STATE.history.slice(0, 10);
    if (!list.length) {
      host.innerHTML = `<div style="color:#9ca3af;font-size:.78rem;text-align:center;padding:.5rem;">Chưa có lần luyện nào.</div>`;
      return;
    }
    host.innerHTML = list.map(h => `
      <div class="bx-hist-row" style="border-left:3px solid ${h.correct ? "#FFD700" : "#d9381e"};">
        <div style="font-weight:600;color:#171717;font-size:.82rem;">${escHtml((h.template || "").replace(/\([^)]+\)/, "\x01")).replace("\x01", h.heard ? `<span class="${h.correct?'pick':'strike'}">${escHtml(h.heard)}</span>` : "(?)")}</div>
        <div style="color:${h.correct ? "#FFD700" : "#d9381e"};margin-top:.15rem;">${h.correct ? "✓ Đúng" : "✗ Sai — đúng là " + escHtml(h.correctForm)}</div>
      </div>
    `).join("");
  }

  function goTo(i) {
    if (i < 0 || i >= SENTENCES.length) return;
    STATE.idx = i;
    STATE.sentence = SENTENCES[i];
    renderSentence();
  }

  // ──────────────── Recording ────────────────
  async function toggleRecord() {
    const btn = root.querySelector("#bx-rec");
    if (STATE.recording) {
      try { STATE.recorder?.stop(); } catch {}
      return;
    }
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
    } catch (e) { alert("Không truy cập được mic: " + e.message); }
  }

  async function onStop() {
    STATE.stream?.getTracks().forEach(t => t.stop());
    STATE.recording = false;
    const btn = root.querySelector("#bx-rec");
    if (btn) { btn.classList.remove("recording"); btn.textContent = "⏳ Đang chấm..."; btn.disabled = true; }
    const blob = new Blob(STATE.chunks, { type: "audio/webm" });
    const b64 = await blobToBase64(blob);
    const s = STATE.sentence;
    const targetSentence = s.template.replace(/\([^)]+\)/, s.correct);
    try {
      const r = await fetch("/api/gemini/score-sentence", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: getKey(), model: getModel(),
          sentence: targetSentence,
          audioBase64: b64.split(",")[1] || b64,
          mimeType: "audio/webm",
          context: `S/ES DRILL — The sentence has a (form1 / form2) choice. The student must say the CORRECT form. Listen carefully and identify EXACTLY which word they said in that position. Correct form is "${s.correct}". Other option is one of: ${(s.template.match(/\(([^)]+)\)/)?.[1] || "").split("/").map(x => x.trim()).filter(x => x !== s.correct).join(", ")}.`
        })
      });
      const d = await r.json();
      // Determine if they said the correct form. We look at d.phoneticHeard / d.worstWords / d.transcript if any.
      // The /api/gemini/score-sentence returns: score, phoneticHeard, verdict, tips, worstWords
      // We'll use the worstWords + verdict to detect the s/es error.
      const heardForm = detectForm(d, s);
      const isCorrect = heardForm === s.correct;
      showFeedback({ isCorrect, heard: heardForm, s, raw: d });
      saveAttempt({ template: s.template, correct: isCorrect, heard: heardForm, correctForm: s.correct, score: d.score });
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = "🎤 Ghi âm ngay"; }
      alert("Lỗi chấm: " + e.message);
    }
  }

  // Heuristic to find which form the student said.
  function detectForm(d, s) {
    const opts = (s.template.match(/\(([^)]+)\)/)?.[1] || "").split("/").map(x => x.trim().toLowerCase());
    const verdict = (d.verdict || "").toLowerCase();
    const tips = (d.tips || "").toLowerCase();
    const phon = (d.phoneticHeard || "").toLowerCase();
    const worst = Array.isArray(d.worstWords) ? d.worstWords.map(w => String(w).toLowerCase()) : [];
    // If worstWords or verdict mentions an option that differs from the correct form, that's what they said
    const wrong = opts.find(o => o !== s.correct.toLowerCase());
    if (wrong && (verdict.includes(wrong) || tips.includes(wrong) || worst.includes(wrong) || phon.includes(wrong))) return wrong;
    // If verdict mentions the correct one positively, assume correct
    if (verdict.includes(s.correct.toLowerCase()) || worst.length === 0) return s.correct;
    return wrong || s.correct;
  }

  function showFeedback({ isCorrect, heard, s, raw }) {
    const host = root.querySelector("#bx-feedback-host");
    const btn = root.querySelector("#bx-rec");
    if (btn) { btn.disabled = false; btn.textContent = "🎤 Ghi âm lại"; }
    const rendered = s.template.replace(/\(([^)]+)\)/, () => {
      if (isCorrect) return `<span class="pick">${escHtml(s.correct)}</span>`;
      return `<span class="strike">${escHtml(heard)}</span> <span class="pick">${escHtml(s.correct)}</span>`;
    });
    host.innerHTML = `
      <div class="bx-feedback">
        <div class="bx-x ${isCorrect ? "bx-check" : ""}">${isCorrect ? "✓" : "✗"}</div>
        <div style="font-size:.95rem;color:#171717;line-height:1.7;padding-right:3rem;">${rendered}</div>
        <div class="bx-fb-label ${isCorrect ? "ok" : ""}">${isCorrect ? "Tuyệt vời!" : "Sửa lỗi nhé!"}</div>
        <div class="bx-reason">📌 ${escHtml(s.reason)}</div>
        ${raw?.tips ? `<div class="bx-hint">💡 ${escHtml(raw.tips)}</div>` : ""}
      </div>
    `;
  }

  // ──────────────── Boot ────────────────
  function boot() {
    mount();
    renderSentence();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();


