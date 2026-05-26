// =====================================================================
//  Luyện rhythm — /alphafeature/rhythm
//  Sentences have STRESSED syllables marked in CAPS (content words).
//  Function words (articles, prepositions, auxiliaries) are reduced/weak.
//  Student records and Gemini scores rhythm / stress accuracy.
// =====================================================================
(function () {
  const mount = document.getElementById("rhythmRoot");
  if (!mount) return;

  // ── Library: stressed syllables in CAPS, weak syllables lowercase ──
  // plain: clean text for TTS; marked: display version with CAPS stress
  // focus: the main rhythm concept being drilled
  const SENTENCES = [
    {
      plain:  "I want to go to the store.",
      marked: "i WANT to GO to the STORE.",
      focus:  "Giảm âm: 'to', 'the' đọc yếu/nhanh, WANT GO STORE nhấn mạnh",
      rule:   "content-words",
      note:   "Danh từ, động từ chính, tính từ, trạng từ → nhấn mạnh. Giới từ, mạo từ → yếu & nhanh."
    },
    {
      plain:  "She's been working really hard.",
      marked: "she's been WORK-ing REAL-ly HARD.",
      focus:  "WORK-ing, REAL-ly, HARD nhấn mạnh — 'she's been' lướt nhanh",
      rule:   "content-words",
      note:   "Auxiliary 'been' yếu, pronoun 'she's' yếu — động từ chính & trạng từ mạnh."
    },
    {
      plain:  "Can you give me a hand?",
      marked: "can you GIVE me a HAND?",
      focus:  "'can', 'you', 'me', 'a' đọc yếu — GIVE HAND là từ mang nghĩa",
      rule:   "reduced-function",
      note:   "Trong câu hỏi yêu cầu: modal 'can' và đại từ thường bị giảm âm, động từ + danh từ chính nhấn."
    },
    {
      plain:  "I'd like a cup of coffee, please.",
      marked: "i'd like a CUP of COF-fee, PLEASE.",
      focus:  "CUP, COF-fee, PLEASE là các beat chính — 'a', 'of' lướt qua",
      rule:   "content-words",
      note:   "'a cup of' = 3 âm tiết nhưng chỉ CUP mang nhịp. 'of' giảm thành /əv/ hoặc /ə/."
    },
    {
      plain:  "The book is on the table.",
      marked: "the BOOK is on the TA-ble.",
      focus:  "BOOK và TA-ble là content words — 'the', 'is', 'on' giảm",
      rule:   "content-words",
      note:   "'The' đọc /ðə/ (yếu) trước phụ âm. 'is' giảm thành /ɪz/ hoặc /z/."
    },
    {
      plain:  "I've already told you three times.",
      marked: "i've al-REA-dy TOLD you THREE TIMES.",
      focus:  "al-REA-dy có trọng âm thứ 2, TOLD THREE TIMES là beat chính",
      rule:   "sentence-stress",
      note:   "Trạng từ 'already' có trọng âm nội tại ở âm tiết 2. 'told', 'three', 'times' là content words."
    },
    {
      plain:  "What are you going to do about it?",
      marked: "what are you GOing to DO a-BOUT it?",
      focus:  "GO-ing, DO, a-BOUT nhấn — 'what are you', 'to', 'it' yếu",
      rule:   "reduced-function",
      note:   "'going to' thường giảm thành 'gonna' /ɡənə/ trong khẩu ngữ — nhịp rơi vào GO và DO."
    },
    {
      plain:  "It's not as difficult as you think.",
      marked: "it's NOT as DIF-fi-cult as you THINK.",
      focus:  "NOT, DIF (âm tiết 1 của difficult), THINK là nhịp chính",
      rule:   "sentence-stress",
      note:   "'difficult' = DIF-fi-cult, trọng âm âm tiết đầu. 'as' giảm thành /əz/."
    },
    {
      plain:  "I haven't seen him for a long time.",
      marked: "i HAV-en't SEEN him for a LONG TIME.",
      focus:  "SEEN, LONG, TIME nhấn — 'haven't' nhấn ở HAV, 'him for a' giảm",
      rule:   "content-words",
      note:   "Phủ định 'haven't' mang trọng âm ở HAV. Đại từ 'him' yếu trong câu."
    },
    {
      plain:  "She works at a hospital in the city.",
      marked: "she WORKS at a HOS-pi-tal in the CI-ty.",
      focus:  "WORKS, HOS (hospital), CI (city) — 'at a', 'in the' lướt",
      rule:   "content-words",
      note:   "'hospital' = HOS-pi-tal (trọng âm đầu). 'city' = CI-ty. Giới từ + mạo từ yếu."
    },
    {
      plain:  "He told me he was going to call.",
      marked: "he TOLD me he was GOing to CALL.",
      focus:  "TOLD, GO-ing, CALL là nhịp — 'me', 'he was', 'to' yếu",
      rule:   "content-words",
      note:   "Trong câu gián tiếp: động từ tường thuật 'told' và nội dung chính 'going to call' mang nhịp."
    },
    {
      plain:  "We need to leave by seven o'clock.",
      marked: "we NEED to LEAVE by SEV-en o'CLOCK.",
      focus:  "NEED, LEAVE, SEV-en, o'CLOCK — 'to', 'by' yếu",
      rule:   "content-words",
      note:   "'seven o'clock' có 2 beat: SEV-en và CLOCK. 'by' = giới từ → yếu."
    },
    {
      plain:  "I'm not sure if that's a good idea.",
      marked: "i'm not SURE if that's a GOOD i-DEA.",
      focus:  "SURE, GOOD, i-DEA là beat — 'not' mang nhấn phủ định, 'if that's a' yếu",
      rule:   "sentence-stress",
      note:   "'idea' = i-DEA-: trọng âm âm tiết 2. 'not' mang trọng âm khi phủ định."
    },
    {
      plain:  "The more you practice, the better you get.",
      marked: "the MORE you PRAC-tice, the BET-ter you GET.",
      focus:  "MORE, PRAC, BET, GET là 4 nhịp chính — 'the', 'you' yếu",
      rule:   "rhythm-pattern",
      note:   "Cấu trúc 'the more… the better' có nhịp đều đặn 2-beat mỗi vế."
    },
    {
      plain:  "Do you want to grab something to eat?",
      marked: "do you WANT to GRAB some-thing to EAT?",
      focus:  "WANT, GRAB, EAT là nhịp — 'do you', 'to', 'something to' yếu",
      rule:   "reduced-function",
      note:   "'something' = SOME-thing nhưng trong câu thường yếu đi thành /ˈsʌmθɪŋ/ → /sʌmθɪŋ/."
    },
    {
      plain:  "It was one of the best days of my life.",
      marked: "it was ONE of the BEST DAYS of my LIFE.",
      focus:  "ONE, BEST, DAYS, LIFE là 4 beat — 'of the', 'of my' yếu",
      rule:   "content-words",
      note:   "'one of the' = 3 âm tiết nhưng chỉ ONE mang nhịp. Tính từ 'best' và danh từ 'days', 'life' đều mạnh."
    },
    {
      plain:  "Could you speak a little more slowly?",
      marked: "could you SPEAK a LIT-tle more SLOW-ly?",
      focus:  "SPEAK, LIT-tle, SLOW-ly — 'could you', 'a', 'more' yếu",
      rule:   "polite-request",
      note:   "Yêu cầu lịch sự 'could you' thường giảm thành /kədjə/. Động từ chính và trạng từ nhấn."
    },
    {
      plain:  "I've been thinking about it all day.",
      marked: "i've been THINK-ing a-BOUT it all DAY.",
      focus:  "THINK-ing, a-BOUT, DAY là nhịp — 'i've been', 'it all' yếu",
      rule:   "content-words",
      note:   "Present perfect continuous: 'thinking' nhấn âm tiết 1. 'about' = a-BOUT, nhấn âm tiết 2."
    },
    {
      plain:  "You should have told me sooner.",
      marked: "you SHOULD have TOLD me SOON-er.",
      focus:  "SHOULD, TOLD, SOON-er — 'you', 'have', 'me' yếu",
      rule:   "sentence-stress",
      note:   "Modal 'should' nhấn khi chứa criticism/advice. 'have' trong modal perfect giảm → /həv/ hay /əv/."
    },
    {
      plain:  "By the time you read this, I'll be gone.",
      marked: "by the TIME you READ this, i'll be GONE.",
      focus:  "TIME, READ, GONE là 3 nhịp chính — 'by the', 'you', 'this i'll be' yếu",
      rule:   "rhythm-pattern",
      note:   "Mệnh đề thời gian 'by the time': TIME nhấn. 'I'll be' giảm thành /aɪlbɪ/."
    },
  ];

  const STATE = {
    idx: 0,
    history: loadHistory(),
    recorder: null, stream: null, chunks: [], recording: false,
  };

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem("ln.rhythmHistory") || "[]"); } catch { return []; }
  }
  function saveAttempt(rec) {
    try {
      const arr = loadHistory();
      arr.unshift({ ts: Date.now(), ...rec });
      localStorage.setItem("ln.rhythmHistory", JSON.stringify(arr.slice(0, 200)));
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
    u.lang = "en-GB"; u.rate = 0.82;
    const vn = localStorage.getItem("ln.ttsVoice");
    if (vn) { const v = speechSynthesis.getVoices().find(x => x.name === vn); if (v) u.voice = v; }
    setTimeout(() => speechSynthesis.speak(u), 30);
  }
  function blobToBase64(blob) {
    return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
  }

  (function css() {
    if (document.getElementById("ln-rhy-css")) return;
    const s = document.createElement("style");
    s.id = "ln-rhy-css";
    s.textContent = `
      #rhythmRoot { font-family:Lexend,sans-serif; padding:1.2rem 1.4rem; max-width:1100px; margin:0 auto; }
      .rhy-wrap { display:grid; grid-template-columns:minmax(0,1.6fr) minmax(0,1fr); gap:1rem; }
      @media (max-width:880px) { .rhy-wrap { grid-template-columns:1fr; } }
      .rhy-card { background:white; border-radius:.9rem; border:1px solid #e5e7eb; padding:1.3rem 1.5rem; }
      .rhy-bc { font-size:.78rem; color:#6b7280; margin-bottom:.7rem; }
      .rhy-bc a { color:#d9381e; text-decoration:none; }
      .rhy-nav { display:flex; justify-content:space-between; align-items:center; gap:.5rem; margin-bottom:1rem; }
      .rhy-nav-btn { padding:.4rem 1rem; border:1.5px solid #e5e7eb; background:white; border-radius:9999px; cursor:pointer; font-size:.82rem; color:#4b5563; font-family:inherit; }
      .rhy-nav-btn:hover:not(:disabled) { border-color:#d9381e; color:#d9381e; }
      .rhy-nav-btn:disabled { opacity:.35; cursor:not-allowed; }
      .rhy-counter { font-weight:600; color:#171717; }
      .rhy-counter small { color:#9ca3af; font-weight:500; margin-left:.3rem; }
      .rhy-rule-pill { display:inline-block; background:#fef3c7; color:#92400e; padding:.18rem .7rem; border-radius:9999px; font-size:.72rem; font-weight:600; margin-bottom:.7rem; }
      .rhy-sentence-block { background:#fafaf8; border:2.5px solid #f59e0b; border-radius:1rem; padding:1.1rem 1.4rem; margin:.5rem 0 1rem; text-align:left; }
      .rhy-sentence-row { position:relative; }
      .rhy-play-row { display:flex; align-items:flex-start; gap:.75rem; }
      .rhy-play { background:white; border:2.5px solid #f59e0b; color:#f59e0b; border-radius:50%; width:2.4rem; height:2.4rem; cursor:pointer; font-size:.9rem; flex-shrink:0; margin-top:.1rem; }
      .rhy-play:hover { background:#fffbeb; }
      .rhy-marked-text { font-size:1.18rem; line-height:1.85; color:#171717; letter-spacing:.01em; }
      .rhy-stress { font-weight:800; color:#d97706; font-size:1.22rem; letter-spacing:.03em; }
      .rhy-focus { background:#fff7ed; border-left:3px solid #f59e0b; padding:.45rem .8rem; border-radius:.4rem; font-size:.82rem; color:#78350f; margin-top:.6rem; }
      .rhy-hint { text-align:center; color:#9ca3af; font-size:.82rem; margin:.4rem 0 1.2rem; }
      .rhy-actions { text-align:center; }
      .rhy-rec-btn { padding:.85rem 2rem; border:none; border-radius:9999px; font-weight:700; cursor:pointer; font-family:inherit; font-size:1rem; background:#d9381e; color:white; box-shadow:0 4px 16px rgba(217,56,30,.28); }
      .rhy-rec-btn:hover { background:#171717; }
      .rhy-rec-btn.recording { background:#ef4444; animation:rhy-pulse 1.2s infinite; }
      @keyframes rhy-pulse { 0%,100% { box-shadow:0 0 0 0 rgba(239,68,68,.5) } 50% { box-shadow:0 0 0 12px rgba(239,68,68,0) } }
      .rhy-feedback { background:#fffbeb; border-radius:.7rem; padding:1rem 1.2rem; margin-top:1rem; border:1px solid #fde68a; }
      .rhy-fb-head { display:flex; align-items:center; gap:.7rem; margin-bottom:.5rem; }
      .rhy-fb-badge { width:2.4rem; height:2.4rem; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:1.1rem; flex-shrink:0; }
      .rhy-fb-ok { background:#FFD700; }
      .rhy-fb-no { background:#d9381e; }
      .rhy-fb-mid { background:#f59e0b; }
      .rhy-fb-title { font-weight:700; color:#171717; font-size:.95rem; }
      .rhy-fb-sub { font-size:.78rem; color:#6b7280; margin-top:.1rem; }
      .rhy-fb-score { background:white; padding:.55rem .85rem; border-radius:.5rem; margin:.4rem 0; font-size:.92rem; color:#171717; border-left:4px solid #f59e0b; }
      .rhy-fb-detail { font-size:.85rem; color:#374151; padding:.4rem .6rem; line-height:1.55; }
      .rhy-fb-note { background:#ffffff; border-left:4px solid #FFD700; padding:.5rem .8rem; margin-top:.4rem; font-size:.82rem; color:#171717; border-radius:.3rem; }

      .rhy-rules h3 { font-size:1rem; font-weight:700; color:#171717; margin:0 0 .7rem; }
      .rhy-rule-item { background:#fffbeb; border-radius:.5rem; padding:.6rem .85rem; margin-bottom:.45rem; font-size:.85rem; line-height:1.55; }
      .rhy-rule-item b { color:#d97706; }
      .rhy-legend { display:flex; gap:1rem; flex-wrap:wrap; font-size:.78rem; margin-bottom:.8rem; }
      .rhy-legend-s { font-weight:800; color:#d97706; }
      .rhy-legend-w { color:#9ca3af; }
      .rhy-hist { margin-top:1rem; max-height:340px; overflow-y:auto; display:flex; flex-direction:column; gap:.35rem; }
      .rhy-hist-row { background:#f9fafb; border-radius:.45rem; padding:.5rem .75rem; font-size:.78rem; border-left:3px solid #d1d5db; }
      .rhy-hist-row.ok { border-left-color:#FFD700; }
      .rhy-hist-row.mid { border-left-color:#f59e0b; }
      .rhy-hist-row.no { border-left-color:#d9381e; }
      .rhy-hist-row b { color:#171717; }
    `;
    document.head.appendChild(s);
  })();

  // Convert CAPS words/syllables → <span class="rhy-stress">word</span>
  function renderStress(marked) {
    // Tokenise preserving spaces and punctuation
    return marked.replace(/([A-Z][A-Z\-']*)/g, (m) => `<span class="rhy-stress">${m}</span>`);
  }

  function render() {
    const s = SENTENCES[STATE.idx];
    const total = SENTENCES.length;
    mount.innerHTML = `
      <div class="rhy-wrap">
        <div class="rhy-card">
          <div class="rhy-bc"><a href="/">Trang chủ</a> · <a href="/question-answer">Luyện theo câu</a> · Luyện rhythm</div>
          <div class="rhy-nav">
            <button class="rhy-nav-btn" id="rhyPrev" ${STATE.idx === 0 ? "disabled" : ""}>← câu trước</button>
            <div class="rhy-counter">Câu ${STATE.idx + 1} <small>/ ${total}</small></div>
            <button class="rhy-nav-btn" id="rhyNext" ${STATE.idx >= total - 1 ? "disabled" : ""}>câu tiếp →</button>
          </div>
          <span class="rhy-rule-pill">${escHtml(s.rule)}</span>
          <div class="rhy-sentence-block">
            <div class="rhy-play-row">
              <button class="rhy-play" id="rhyTts" title="Nghe mẫu">▶</button>
              <div class="rhy-marked-text">${renderStress(s.marked)}</div>
            </div>
            <div class="rhy-focus">🎯 ${escHtml(s.focus)}</div>
          </div>
          <div class="rhy-hint"><span style="font-weight:700;color:#d97706;">CHỮ HOA</span> = nhấn mạnh (beat) · chữ thường = yếu/nhanh — Nghe mẫu, sau đó ghi âm bắt chước nhịp.</div>
          <div id="rhyFeedbackHost"></div>
          <div class="rhy-actions">
            <button class="rhy-rec-btn" id="rhyRec">🎤 Ghi âm ngay</button>
          </div>
        </div>
        <div class="rhy-card rhy-rules">
          <h3>Quy tắc nhịp tiếng Anh</h3>
          <div class="rhy-legend">
            <span><span class="rhy-legend-s">CHỮ HOA</span> = beat mạnh</span>
            <span><span class="rhy-legend-w">chữ thường</span> = yếu</span>
          </div>
          <div class="rhy-rule-item"><b>Content words</b> (nhấn): danh từ, động từ chính, tính từ, trạng từ, từ phủ định → đọc to, rõ, dài hơn.</div>
          <div class="rhy-rule-item"><b>Function words</b> (yếu): mạo từ (a/the), giới từ (to/of/in), đại từ (I/you/he), trợ động từ (am/is/was/have) → đọc nhẹ, nhanh, thường giảm âm.</div>
          <div class="rhy-rule-item"><b>Vowel reduction</b>: Nguyên âm trong âm tiết yếu thường → /ə/ (schwa). VD: "to" → /tə/, "of" → /əv/, "and" → /ən/.</div>
          <div class="rhy-rule-item"><b>Nhịp điệu đều</b>: Tiếng Anh là ngôn ngữ stress-timed — khoảng cách giữa các beat mạnh gần bằng nhau, bất kể số âm tiết giữa chúng.</div>
          <div class="rhy-rule-item"><b>Liên âm & lướt</b>: "want to" → "wanna", "going to" → "gonna", "have to" → "hafta" trong khẩu ngữ.</div>
          <div style="font-size:.78rem;color:#6b7280;margin-top:.7rem;">Lịch sử gần đây:</div>
          <div class="rhy-hist" id="rhyHist"></div>
        </div>
      </div>
    `;
    mount.querySelector("#rhyTts").addEventListener("click", () => speak(s.plain));
    mount.querySelector("#rhyPrev").addEventListener("click", () => { if (STATE.idx > 0) { STATE.idx--; render(); } });
    mount.querySelector("#rhyNext").addEventListener("click", () => { if (STATE.idx < total - 1) { STATE.idx++; render(); } });
    mount.querySelector("#rhyRec").addEventListener("click", toggleRecord);
    renderHistory();
  }

  function renderHistory() {
    const host = mount.querySelector("#rhyHist");
    if (!host) return;
    const list = STATE.history.slice(0, 12);
    if (!list.length) { host.innerHTML = `<div style="color:#9ca3af;text-align:center;padding:.5rem;font-size:.78rem;">Chưa luyện câu nào.</div>`; return; }
    host.innerHTML = list.map(h => {
      const cls = h.score >= 7 ? "ok" : h.score >= 4 ? "mid" : "no";
      return `<div class="rhy-hist-row ${cls}">
        <b>${escHtml((h.plain||"").slice(0,55))}${(h.plain||"").length>55?"…":""}</b><br>
        Điểm rhythm: <b>${h.score}/10</b>
      </div>`;
    }).join("");
  }

  async function toggleRecord() {
    const btn = mount.querySelector("#rhyRec");
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
    const btn = mount.querySelector("#rhyRec");
    if (btn) { btn.classList.remove("recording"); btn.textContent = "⏳ Đang chấm…"; btn.disabled = true; }
    const blob = new Blob(STATE.chunks, { type: "audio/webm" });
    const b64 = await blobToBase64(blob);
    const s = SENTENCES[STATE.idx];
    try {
      const r = await fetch("/api/gemini/score-sentence", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: getKey(), model: getModel(),
          sentence: s.plain,
          audioBase64: b64.split(",")[1] || b64,
          mimeType: "audio/webm",
          context: `RHYTHM & STRESS DRILL — Focus: ${s.rule}. The target sentence has the following stress pattern (CAPS = stressed beat, lowercase = weak/reduced): "${s.marked}". Key point: ${s.focus}. Judge ONLY rhythm and word stress — NOT individual sound pronunciation. Score 0-10 based on: (1) correct content words are louder/longer, (2) function words are reduced/fast, (3) overall isochronous beat pattern feels natural. Respond with JSON: { score: 0-10, feedback: "brief English feedback on what they did well or wrong with stress/rhythm", stressAccuracy: "good/partial/poor" }.`
        })
      });
      const d = await r.json();
      const score = extractScore(d);
      const feedbackText = d.feedback || d.advice || d.notes || d.verdict || "";
      showFeedback({ score, s, feedbackText, raw: d });
      saveAttempt({ plain: s.plain, score, rule: s.rule, feedback: feedbackText });
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = "🎤 Ghi âm lại"; }
      alert("Lỗi chấm: " + e.message);
    }
  }

  function extractScore(d) {
    if (typeof d?.score === "number") return Math.max(0, Math.min(10, Math.round(d.score)));
    if (typeof d?.overall === "number") return Math.max(0, Math.min(10, Math.round(d.overall)));
    if (typeof d?.rhythmScore === "number") return Math.max(0, Math.min(10, Math.round(d.rhythmScore)));
    const blob = JSON.stringify(d || {});
    const m = blob.match(/(\d+(?:\.\d+)?)\s*\/\s*10/);
    if (m) return Math.round(parseFloat(m[1]));
    const txt = blob.toLowerCase();
    if (/(excellent|perfect|great|natural)/.test(txt)) return 9;
    if (/(good|nice|well)/.test(txt)) return 7;
    if (/(okay|partial|some)/.test(txt)) return 5;
    if (/(flat|equal|monoton|no stress|unstress)/.test(txt)) return 3;
    return 6;
  }

  function showFeedback({ score, s, feedbackText, raw }) {
    const host = mount.querySelector("#rhyFeedbackHost");
    const btn = mount.querySelector("#rhyRec");
    if (btn) { btn.disabled = false; btn.textContent = "🎤 Ghi âm lại"; }
    const cls = score >= 7 ? "rhy-fb-ok" : score >= 4 ? "rhy-fb-mid" : "rhy-fb-no";
    const icon = score >= 7 ? "✓" : score >= 4 ? "~" : "✗";
    const title = score >= 7 ? "Nhịp rất tự nhiên!" : score >= 4 ? "Gần đúng nhịp rồi!" : "Cần luyện nhịp thêm";
    const stressAcc = raw?.stressAccuracy || "";
    host.innerHTML = `
      <div class="rhy-feedback">
        <div class="rhy-fb-head">
          <div class="rhy-fb-badge ${cls}">${icon}</div>
          <div>
            <div class="rhy-fb-title">${title}</div>
            <div class="rhy-fb-sub">Pattern: <b>${escHtml(s.rule)}</b>${stressAcc ? ` · Stress accuracy: ${escHtml(stressAcc)}` : ""}</div>
          </div>
        </div>
        <div class="rhy-fb-score">Điểm rhythm: <b>${score}/10</b></div>
        ${feedbackText ? `<div class="rhy-fb-detail">${escHtml(feedbackText)}</div>` : ""}
        ${raw?.phoneticHeard ? `<div class="rhy-fb-detail">Bạn đọc: <i style="color:#d9381e;">${escHtml(raw.phoneticHeard)}</i></div>` : ""}
        <div class="rhy-fb-note">📌 ${escHtml(s.note)}</div>
      </div>
    `;
  }

  render();
})();

