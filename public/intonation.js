// =====================================================================
//  Luyen intonation — /alphafeature/intonation
//  Students practise English pitch movement: rising, falling, list,
//  choice, and fall-rise patterns. Gemini scores recorded attempts.
// =====================================================================
(function () {
  const mount = document.getElementById("intonationRoot");
  if (!mount) return;

  const SENTENCES = [
    { plain: "Where do you live?", marked: "Where do you LIVE? ↘", pattern: "↘ falling", focus: "WH-question: giọng xuống cuối câu", note: "Câu hỏi WH thường xuống giọng ở cuối vì người hỏi cần thông tin cụ thể." },
    { plain: "I really enjoyed the movie.", marked: "I really enjoyed the MOVIE. ↘", pattern: "↘ falling", focus: "Statement: khẳng định chắc chắn", note: "Câu trần thuật tự nhiên thường xuống ở từ cuối mang nghĩa chính." },
    { plain: "Close the door, please.", marked: "Close the DOOR, please. ↘", pattern: "↘ falling", focus: "Command/request: xuống rõ cuối câu", note: "Mệnh lệnh hoặc yêu cầu trực tiếp cần kết thúc gọn, chắc." },
    { plain: "What time does the train leave?", marked: "What TIME does the train LEAVE? ↘", pattern: "↘ falling", focus: "WH-question: xuống ở câu hỏi thông tin", note: "Đừng kéo lên như yes/no question; hãy hạ pitch ở cuối." },
    { plain: "That was absolutely fantastic.", marked: "That was absolutely fanTAS-tic. ↘", pattern: "↘ falling", focus: "Emphasis statement: nhấn rồi xuống", note: "Từ cảm xúc vẫn xuống cuối nếu là nhận xét hoàn chỉnh." },
    { plain: "Are you coming to the party?", marked: "Are you coming to the PAR-ty? ↗", pattern: "↗ rising", focus: "Yes/No question: giọng lên cuối câu", note: "Câu hỏi có/không thường lên giọng để mở lựa chọn trả lời." },
    { plain: "You finished already?", marked: "You finished al-REA-dy? ↗", pattern: "↗ rising", focus: "Surprise/checking: lên cuối", note: "Khi kiểm tra hoặc hơi ngạc nhiên, pitch tăng nhẹ ở cuối." },
    { plain: "Is this your first time here?", marked: "Is this your FIRST time HERE? ↗", pattern: "↗ rising", focus: "Yes/No question: lên ở từ cuối", note: "Giữ phần đầu tự nhiên, chỉ nâng rõ ở cuối câu." },
    { plain: "Really?", marked: "REAL-ly? ↗", pattern: "↗ rising", focus: "Reaction question: lên nhanh", note: "Một từ cũng có contour; hỏi lại hoặc ngạc nhiên thì lên." },
    { plain: "Do you have any questions?", marked: "Do you have any QUES-tions? ↗", pattern: "↗ rising", focus: "Invitation/checking: lên lịch sự", note: "Lên nhẹ khiến câu hỏi mở và thân thiện hơn." },
    { plain: "I bought apples, oranges, and bananas.", marked: "AP-ples ↗, OR-an-ges ↗, ba-NA-nas ↘.", pattern: "↗↘ list", focus: "List: item giữa lên, item cuối xuống", note: "Danh sách chưa kết thúc thì lên; item cuối xuống để báo hết ý." },
    { plain: "I like coffee, but she prefers tea.", marked: "COF-fee ↗, TEA ↘.", pattern: "↗↘ contrast", focus: "Contrast: vế đầu mở, vế cuối đóng", note: "Vế đầu lên nhẹ để giữ câu, vế cuối xuống để hoàn tất." },
    { plain: "On Monday, Tuesday, and Wednesday, I have class.", marked: "MON-day ↗, TUES-day ↗, WEDNES-day ↗, CLASS ↘.", pattern: "↗↘ list", focus: "Long list: các item lên, thông tin chính xuống", note: "Nếu sau danh sách còn mệnh đề chính, mệnh đề chính thường kết bằng falling." },
    { plain: "She speaks English, French, and Spanish.", marked: "ENG-lish ↗, FRENCH ↗, SPAN-ish ↘.", pattern: "↗↘ list", focus: "Three-item list: lên, lên, xuống", note: "Đừng xuống quá sớm ở item 1 hoặc 2, vì người nghe sẽ tưởng câu đã hết." },
    { plain: "You can have the red one or the blue one.", marked: "RED one ↗ or BLUE one ↘.", pattern: "↗↘ choice", focus: "Choice with or: lựa chọn đầu lên, lựa chọn cuối xuống", note: "Câu lựa chọn dùng 'or' thường có rise-fall giữa hai lựa chọn." },
    { plain: "I suppose so.", marked: "I sup-POSE so. ↘↗", pattern: "↘↗ fall-rise", focus: "Uncertain: xuống rồi nhấc nhẹ", note: "Fall-rise tạo cảm giác chưa chắc chắn hoặc còn dè dặt." },
    { plain: "It's nice, but...", marked: "It's NICE ↘↗, but...", pattern: "↘↗ fall-rise", focus: "Incomplete idea: chưa nói hết", note: "Xuống rồi lên để báo còn ý phía sau." },
    { plain: "Thank you.", marked: "THANK you. ↘↗", pattern: "↘↗ fall-rise", focus: "Polite thanks: mềm hơn falling mạnh", note: "Fall-rise làm lời cảm ơn nhẹ và lịch sự hơn trong hội thoại." },
    { plain: "I think we should wait.", marked: "I THINK we should WAIT. ↘↗", pattern: "↘↗ fall-rise", focus: "Suggestion: không quá áp đặt", note: "Khi đưa ý kiến dè dặt, fall-rise giúp câu bớt cứng." },
    { plain: "Well, it depends.", marked: "WELL ↗, it de-PENDS. ↘↗", pattern: "↘↗ fall-rise", focus: "Hedging: mở ý rồi kết thúc chưa tuyệt đối", note: "Dùng khi câu trả lời có điều kiện hoặc chưa chắc chắn." },
  ];

  const STATE = {
    idx: 0,
    history: loadHistory(),
    recorder: null,
    stream: null,
    chunks: [],
    recording: false,
    feedback: null,
  };

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem("ln.intonationHistory") || "[]"); } catch { return []; }
  }

  function saveAttempt(rec) {
    try {
      const arr = loadHistory();
      arr.unshift({ ts: Date.now(), ...rec });
      const next = arr.slice(0, 200);
      localStorage.setItem("ln.intonationHistory", JSON.stringify(next));
      STATE.history = next;
    } catch {}
  }

  const getKey = () => {
    try {
      return (JSON.parse(localStorage.getItem("luyennoi.geminiKeys") || "[]")[0])
        || localStorage.getItem("luyennoi.geminiKey")
        || localStorage.getItem("geminiApiKey")
        || "";
    } catch {
      return localStorage.getItem("luyennoi.geminiKey") || localStorage.getItem("geminiApiKey") || "";
    }
  };
  const getModel = () => localStorage.getItem("luyennoi.geminiModel") || "gemini-3-flash-preview";
  const escHtml = (s) => String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function speak(text) {
    if (!text) return;
    try { speechSynthesis.cancel(); } catch {}
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    u.rate = 0.82;
    u.pitch = 1;
    const vn = localStorage.getItem("ln.ttsVoice");
    if (vn) {
      const v = speechSynthesis.getVoices().find(x => x.name === vn);
      if (v) u.voice = v;
    }
    setTimeout(() => speechSynthesis.speak(u), 30);
  }

  function blobToBase64(blob) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  }

  (function css() {
    if (document.getElementById("ln-int-css")) return;
    const s = document.createElement("style");
    s.id = "ln-int-css";
    s.textContent = `
      #intonationRoot { font-family:Lexend,sans-serif; padding:1.2rem 1.4rem; max-width:1100px; margin:0 auto; }
      .int-wrap { display:grid; grid-template-columns:minmax(0,1.55fr) minmax(300px,.95fr); gap:1rem; }
      @media (max-width:900px) { .int-wrap { grid-template-columns:1fr; } }
      .int-card { background:white; border:1px solid #e5e7eb; border-radius:.9rem; padding:1.25rem 1.45rem; }
      .int-bc { font-size:.78rem; color:#6b7280; margin-bottom:.75rem; }
      .int-bc a { color:#d9381e; text-decoration:none; }
      .int-nav { display:flex; justify-content:space-between; align-items:center; gap:.5rem; margin-bottom:1rem; }
      .int-nav-btn { padding:.42rem 1rem; border:1.5px solid #e5e7eb; background:white; border-radius:9999px; cursor:pointer; font-size:.82rem; color:#4b5563; font-family:inherit; }
      .int-nav-btn:hover:not(:disabled) { border-color:#d9381e; color:#d9381e; }
      .int-nav-btn:disabled { opacity:.35; cursor:not-allowed; }
      .int-counter { font-weight:700; color:#171717; }
      .int-counter small { color:#9ca3af; font-weight:500; margin-left:.25rem; }
      .int-pattern { display:inline-flex; align-items:center; gap:.35rem; padding:.2rem .75rem; border-radius:9999px; font-size:.75rem; font-weight:700; margin-bottom:.75rem; }
      .int-falling { background:#ffffff; color:var(--red); }
      .int-rising { background:#fffbe6; color:#171717; }
      .int-mixed { background:#fef3c7; color:#92400e; }
      .int-fallrise { background:#fffbe6; color:#d9381e; }
      .int-sentence { background:#fafaf8; border:2.5px solid #d9381e; border-radius:1rem; padding:1.15rem 1.35rem; margin:.4rem 0 1rem; }
      .int-play-row { display:flex; align-items:flex-start; gap:.75rem; }
      .int-play { background:white; border:2.5px solid #171717; color:#171717; border-radius:50%; width:2.35rem; height:2.35rem; cursor:pointer; font-size:.9rem; flex-shrink:0; margin-top:.08rem; }
      .int-play:hover { background:#ecfeff; }
      .int-marked { font-size:1.22rem; line-height:1.85; color:#171717; font-weight:650; }
      .int-arrow-up { color:#FFD700; font-weight:900; }
      .int-arrow-down { color:#ef4444; font-weight:900; }
      .int-arrow-mix { color:#f59e0b; font-weight:900; }
      .int-focus { background:#ffffff; border-left:3px solid #d9381e; padding:.5rem .82rem; border-radius:.42rem; font-size:.84rem; color:#171717; margin-top:.7rem; }
      .int-note { color:#6b7280; font-size:.82rem; line-height:1.55; margin:.55rem 0 1rem; }
      .int-actions { display:flex; justify-content:center; gap:.6rem; flex-wrap:wrap; }
      .int-rec-btn, .int-soft-btn { padding:.82rem 1.75rem; border-radius:9999px; font-family:inherit; font-weight:800; cursor:pointer; }
      .int-rec-btn { border:none; background:#d9381e; color:white; box-shadow:0 4px 16px rgba(217,56,30,.25); }
      .int-rec-btn.recording { background:#ef4444; animation:int-pulse 1.2s infinite; }
      .int-soft-btn { border:1.5px solid #d1d5db; background:white; color:#374151; }
      @keyframes int-pulse { 0%,100% { box-shadow:0 0 0 0 rgba(239,68,68,.5) } 50% { box-shadow:0 0 0 12px rgba(239,68,68,0) } }
      .int-feedback { background:#ffffff; border:1px solid #171717; border-radius:.75rem; padding:1rem 1.15rem; margin:1rem 0; }
      .int-fb-head { display:flex; align-items:center; gap:.7rem; margin-bottom:.55rem; }
      .int-score { width:2.65rem; height:2.65rem; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-weight:900; font-size:1rem; flex-shrink:0; }
      .int-ok { background:#FFD700; }
      .int-mid { background:#f59e0b; }
      .int-no { background:#ef4444; }
      .int-fb-title { font-weight:800; color:#171717; }
      .int-fb-sub { font-size:.78rem; color:#6b7280; margin-top:.12rem; }
      .int-fb-text { background:white; border-left:4px solid #d9381e; border-radius:.45rem; padding:.65rem .8rem; font-size:.86rem; line-height:1.55; color:#374151; }
      .int-rules h3 { font-size:1rem; margin:0 0 .75rem; color:#171717; }
      .int-rule { border-radius:.55rem; padding:.68rem .85rem; margin-bottom:.5rem; font-size:.85rem; line-height:1.55; border:1px solid #e5e7eb; background:#fafafa; }
      .int-rule.active { border-color:#d9381e; background:#ffffff; }
      .int-rule b { color:#171717; }
      .int-rule .up { color:#FFD700; font-weight:900; }
      .int-rule .down { color:#ef4444; font-weight:900; }
      .int-rule .mix { color:#f59e0b; font-weight:900; }
      .int-hist-title { font-size:.78rem; color:#6b7280; margin:1rem 0 .45rem; }
      .int-hist { max-height:320px; overflow-y:auto; display:flex; flex-direction:column; gap:.35rem; }
      .int-hist-row { background:#f9fafb; border-left:3px solid #d1d5db; border-radius:.45rem; padding:.52rem .72rem; font-size:.78rem; }
      .int-hist-row.ok { border-left-color:#FFD700; }
      .int-hist-row.mid { border-left-color:#f59e0b; }
      .int-hist-row.no { border-left-color:#ef4444; }
      .int-hist-row b { color:#171717; }
    `;
    document.head.appendChild(s);
  })();

  function patternClass(pattern) {
    if (pattern.includes("fall-rise")) return "int-fallrise";
    if (pattern.includes("rising")) return "int-rising";
    if (pattern.includes("falling")) return "int-falling";
    return "int-mixed";
  }

  function renderArrows(marked) {
    return escHtml(marked)
      .replaceAll("↘↗", '<span class="int-arrow-mix">↘↗</span>')
      .replaceAll("↗↘", '<span class="int-arrow-mix">↗↘</span>')
      .replaceAll("↗", '<span class="int-arrow-up">↗</span>')
      .replaceAll("↘", '<span class="int-arrow-down">↘</span>');
  }

  function render() {
    const s = SENTENCES[STATE.idx];
    const total = SENTENCES.length;
    mount.innerHTML = `
      <div class="int-wrap">
        <div class="int-card">
          <div class="int-bc"><a href="/">Trang chủ</a> · <a href="/question-answer">Luyện theo câu</a> · Luyện intonation</div>
          <div class="int-nav">
            <button class="int-nav-btn" id="intPrev" ${STATE.idx === 0 ? "disabled" : ""}>← câu trước</button>
            <div class="int-counter">Câu ${STATE.idx + 1} <small>/ ${total}</small></div>
            <button class="int-nav-btn" id="intNext" ${STATE.idx >= total - 1 ? "disabled" : ""}>câu tiếp →</button>
          </div>
          <span class="int-pattern ${patternClass(s.pattern)}">${escHtml(s.pattern)}</span>
          <div class="int-sentence">
            <div class="int-play-row">
              <button class="int-play" id="intTts" title="Nghe mẫu">▶</button>
              <div class="int-marked">${renderArrows(s.marked)}</div>
            </div>
            <div class="int-focus">🎯 ${escHtml(s.focus)}</div>
          </div>
          <div class="int-note">${escHtml(s.note)} Nghe mẫu, bắt chước hướng mũi tên, rồi ghi âm để chấm.</div>
          <div id="intFeedbackHost">${STATE.feedback ? feedbackHtml(STATE.feedback) : ""}</div>
          <div class="int-actions">
            <button class="int-soft-btn" id="intRandom">Đổi câu ngẫu nhiên</button>
            <button class="int-rec-btn" id="intRec">🎤 Ghi âm ngay</button>
          </div>
        </div>
        <div class="int-card int-rules">
          <h3>Quy tắc intonation</h3>
          ${ruleHtml(s.pattern)}
          <div class="int-hist-title">Lịch sử gần đây:</div>
          <div class="int-hist" id="intHist"></div>
        </div>
      </div>
    `;
    mount.querySelector("#intTts").addEventListener("click", () => speak(s.plain));
    mount.querySelector("#intPrev").addEventListener("click", () => { if (STATE.idx > 0) { STATE.idx--; STATE.feedback = null; render(); } });
    mount.querySelector("#intNext").addEventListener("click", () => { if (STATE.idx < total - 1) { STATE.idx++; STATE.feedback = null; render(); } });
    mount.querySelector("#intRandom").addEventListener("click", () => {
      let next = Math.floor(Math.random() * total);
      if (next === STATE.idx) next = (next + 1) % total;
      STATE.idx = next;
      STATE.feedback = null;
      render();
    });
    mount.querySelector("#intRec").addEventListener("click", toggleRecord);
    renderHistory();
  }

  function ruleHtml(activePattern) {
    const is = (key) => activePattern.toLowerCase().includes(key);
    return `
      <div class="int-rule ${is("falling") ? "active" : ""}"><b><span class="down">↘</span> Falling:</b> Câu trần thuật, WH-question, mệnh lệnh → xuống cuối.</div>
      <div class="int-rule ${is("rising") ? "active" : ""}"><b><span class="up">↗</span> Rising:</b> Yes/No question, ngạc nhiên, kiểm tra → lên cuối.</div>
      <div class="int-rule ${is("list") || is("choice") || is("contrast") ? "active" : ""}"><b><span class="mix">↗↘</span> List/Choice:</b> Mỗi item lên, item cuối xuống. Câu lựa chọn "or" cũng vậy.</div>
      <div class="int-rule ${is("fall-rise") ? "active" : ""}"><b><span class="mix">↘↗</span> Fall-rise:</b> Không chắc, lịch sự, chưa nói hết → xuống rồi lên nhẹ.</div>
    `;
  }

  function feedbackHtml(fb) {
    const cls = fb.score >= 7 ? "int-ok" : fb.score >= 4 ? "int-mid" : "int-no";
    const title = fb.score >= 7 ? "Intonation khá tự nhiên!" : fb.score >= 4 ? "Đúng một phần rồi" : "Cần rõ hướng giọng hơn";
    return `
      <div class="int-feedback">
        <div class="int-fb-head">
          <div class="int-score ${cls}">${escHtml(fb.score)}/10</div>
          <div>
            <div class="int-fb-title">${title}</div>
            <div class="int-fb-sub">Pattern match: <b>${escHtml(fb.patternMatch || "partial")}</b> · ${escHtml(fb.pattern)}</div>
          </div>
        </div>
        <div class="int-fb-text">${escHtml(fb.feedback || "Hãy nghe mẫu và thử kiểm soát hướng pitch rõ hơn ở cuối câu.")}</div>
      </div>
    `;
  }

  function renderHistory() {
    const host = mount.querySelector("#intHist");
    if (!host) return;
    const list = STATE.history.slice(0, 12);
    if (!list.length) {
      host.innerHTML = `<div style="color:#9ca3af;text-align:center;padding:.55rem;font-size:.78rem;">Chưa luyện câu nào.</div>`;
      return;
    }
    host.innerHTML = list.map(h => {
      const cls = h.score >= 7 ? "ok" : h.score >= 4 ? "mid" : "no";
      const plain = h.plain || "";
      return `<div class="int-hist-row ${cls}">
        <b>${escHtml(plain.slice(0, 58))}${plain.length > 58 ? "…" : ""}</b><br>
        ${escHtml(h.pattern || "")} · <b>${escHtml(h.score)}/10</b>
      </div>`;
    }).join("");
  }

  async function toggleRecord() {
    const btn = mount.querySelector("#intRec");
    if (STATE.recording) {
      try { STATE.recorder?.stop(); } catch {}
      return;
    }
    if (!getKey()) {
      location.href = `/settings?next=${encodeURIComponent(location.pathname + location.search)}`;
      return;
    }
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
    } catch (e) {
      alert("Không truy cập mic: " + e.message);
    }
  }

  async function onStop() {
    STATE.stream?.getTracks().forEach(t => t.stop());
    STATE.recording = false;
    const btn = mount.querySelector("#intRec");
    if (btn) {
      btn.classList.remove("recording");
      btn.textContent = "⏳ Đang chấm…";
      btn.disabled = true;
    }
    const blob = new Blob(STATE.chunks, { type: "audio/webm" });
    const b64 = await blobToBase64(blob);
    const s = SENTENCES[STATE.idx];
    const context = `INTONATION DRILL — Pattern: "${s.pattern}". Target: "${s.marked}".
Judge ONLY intonation pattern — NOT individual sound pronunciation or rhythm.
Score 0-10: (1) correct rising/falling at sentence end, (2) correct list intonation if applicable, (3) natural pitch movement.
Respond with JSON: { score: 0-10, feedback: "brief feedback on intonation pattern", patternMatch: "good/partial/poor" }`;
    try {
      const r = await fetch("/api/gemini/score-sentence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: getKey(),
          model: getModel(),
          sentence: s.plain,
          audioBase64: b64.split(",")[1] || b64,
          mimeType: "audio/webm",
          context,
        }),
      });
      const d = await r.json();
      const score = extractScore(d);
      const feedback = d.feedback || d.verdict || d.tips || d.advice || "";
      const patternMatch = d.patternMatch || inferPatternMatch(score);
      STATE.feedback = { score, feedback, patternMatch, pattern: s.pattern };
      showFeedback();
      saveAttempt({ plain: s.plain, score, pattern: s.pattern, feedback, patternMatch });
    } catch (e) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "🎤 Ghi âm lại";
      }
      alert("Lỗi chấm: " + e.message);
    }
  }

  function extractScore(d) {
    const val = Number(d?.score ?? d?.overall ?? d?.intonationScore);
    if (Number.isFinite(val)) {
      const normalized = val > 10 ? val / 10 : val;
      return Math.max(0, Math.min(10, Math.round(normalized)));
    }
    const blob = JSON.stringify(d || {});
    const m = blob.match(/(\d+(?:\.\d+)?)\s*\/\s*10/);
    if (m) return Math.max(0, Math.min(10, Math.round(parseFloat(m[1]))));
    const txt = blob.toLowerCase();
    if (/(excellent|perfect|great|natural|good)/.test(txt)) return 8;
    if (/(partial|okay|some|minor)/.test(txt)) return 5;
    if (/(flat|wrong|poor|monoton|unclear)/.test(txt)) return 3;
    return 6;
  }

  function inferPatternMatch(score) {
    if (score >= 8) return "good";
    if (score >= 5) return "partial";
    return "poor";
  }

  function showFeedback() {
    const host = mount.querySelector("#intFeedbackHost");
    const btn = mount.querySelector("#intRec");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "🎤 Ghi âm lại";
    }
    if (host && STATE.feedback) host.innerHTML = feedbackHtml(STATE.feedback);
    renderHistory();
  }

  render();
})();

