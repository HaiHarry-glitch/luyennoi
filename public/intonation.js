// =====================================================================
//  Luyen intonation â€” /alphafeature/intonation
//  Students practise English pitch movement: rising, falling, list,
//  choice, and fall-rise patterns. Gemini scores recorded attempts.
// =====================================================================
(function () {
  const mount = document.getElementById("intonationRoot");
  if (!mount) return;

  const SENTENCES = [
    { plain: "Where do you live?", marked: "Where do you LIVE? â†˜", pattern: "â†˜ falling", focus: "WH-question: giá»ng xuá»‘ng cuá»‘i cÃ¢u", note: "CÃ¢u há»i WH thÆ°á»ng xuá»‘ng giá»ng á»Ÿ cuá»‘i vÃ¬ ngÆ°á»i há»i cáº§n thÃ´ng tin cá»¥ thá»ƒ." },
    { plain: "I really enjoyed the movie.", marked: "I really enjoyed the MOVIE. â†˜", pattern: "â†˜ falling", focus: "Statement: kháº³ng Ä‘á»‹nh cháº¯c cháº¯n", note: "CÃ¢u tráº§n thuáº­t tá»± nhiÃªn thÆ°á»ng xuá»‘ng á»Ÿ tá»« cuá»‘i mang nghÄ©a chÃ­nh." },
    { plain: "Close the door, please.", marked: "Close the DOOR, please. â†˜", pattern: "â†˜ falling", focus: "Command/request: xuá»‘ng rÃµ cuá»‘i cÃ¢u", note: "Má»‡nh lá»‡nh hoáº·c yÃªu cáº§u trá»±c tiáº¿p cáº§n káº¿t thÃºc gá»n, cháº¯c." },
    { plain: "What time does the train leave?", marked: "What TIME does the train LEAVE? â†˜", pattern: "â†˜ falling", focus: "WH-question: xuá»‘ng á»Ÿ cÃ¢u há»i thÃ´ng tin", note: "Äá»«ng kÃ©o lÃªn nhÆ° yes/no question; hÃ£y háº¡ pitch á»Ÿ cuá»‘i." },
    { plain: "That was absolutely fantastic.", marked: "That was absolutely fanTAS-tic. â†˜", pattern: "â†˜ falling", focus: "Emphasis statement: nháº¥n rá»“i xuá»‘ng", note: "Tá»« cáº£m xÃºc váº«n xuá»‘ng cuá»‘i náº¿u lÃ  nháº­n xÃ©t hoÃ n chá»‰nh." },
    { plain: "Are you coming to the party?", marked: "Are you coming to the PAR-ty? â†—", pattern: "â†— rising", focus: "Yes/No question: giá»ng lÃªn cuá»‘i cÃ¢u", note: "CÃ¢u há»i cÃ³/khÃ´ng thÆ°á»ng lÃªn giá»ng Ä‘á»ƒ má»Ÿ lá»±a chá»n tráº£ lá»i." },
    { plain: "You finished already?", marked: "You finished al-REA-dy? â†—", pattern: "â†— rising", focus: "Surprise/checking: lÃªn cuá»‘i", note: "Khi kiá»ƒm tra hoáº·c hÆ¡i ngáº¡c nhiÃªn, pitch tÄƒng nháº¹ á»Ÿ cuá»‘i." },
    { plain: "Is this your first time here?", marked: "Is this your FIRST time HERE? â†—", pattern: "â†— rising", focus: "Yes/No question: lÃªn á»Ÿ tá»« cuá»‘i", note: "Giá»¯ pháº§n Ä‘áº§u tá»± nhiÃªn, chá»‰ nÃ¢ng rÃµ á»Ÿ cuá»‘i cÃ¢u." },
    { plain: "Really?", marked: "REAL-ly? â†—", pattern: "â†— rising", focus: "Reaction question: lÃªn nhanh", note: "Má»™t tá»« cÅ©ng cÃ³ contour; há»i láº¡i hoáº·c ngáº¡c nhiÃªn thÃ¬ lÃªn." },
    { plain: "Do you have any questions?", marked: "Do you have any QUES-tions? â†—", pattern: "â†— rising", focus: "Invitation/checking: lÃªn lá»‹ch sá»±", note: "LÃªn nháº¹ khiáº¿n cÃ¢u há»i má»Ÿ vÃ  thÃ¢n thiá»‡n hÆ¡n." },
    { plain: "I bought apples, oranges, and bananas.", marked: "AP-ples â†—, OR-an-ges â†—, ba-NA-nas â†˜.", pattern: "â†—â†˜ list", focus: "List: item giá»¯a lÃªn, item cuá»‘i xuá»‘ng", note: "Danh sÃ¡ch chÆ°a káº¿t thÃºc thÃ¬ lÃªn; item cuá»‘i xuá»‘ng Ä‘á»ƒ bÃ¡o háº¿t Ã½." },
    { plain: "I like coffee, but she prefers tea.", marked: "COF-fee â†—, TEA â†˜.", pattern: "â†—â†˜ contrast", focus: "Contrast: váº¿ Ä‘áº§u má»Ÿ, váº¿ cuá»‘i Ä‘Ã³ng", note: "Váº¿ Ä‘áº§u lÃªn nháº¹ Ä‘á»ƒ giá»¯ cÃ¢u, váº¿ cuá»‘i xuá»‘ng Ä‘á»ƒ hoÃ n táº¥t." },
    { plain: "On Monday, Tuesday, and Wednesday, I have class.", marked: "MON-day â†—, TUES-day â†—, WEDNES-day â†—, CLASS â†˜.", pattern: "â†—â†˜ list", focus: "Long list: cÃ¡c item lÃªn, thÃ´ng tin chÃ­nh xuá»‘ng", note: "Náº¿u sau danh sÃ¡ch cÃ²n má»‡nh Ä‘á» chÃ­nh, má»‡nh Ä‘á» chÃ­nh thÆ°á»ng káº¿t báº±ng falling." },
    { plain: "She speaks English, French, and Spanish.", marked: "ENG-lish â†—, FRENCH â†—, SPAN-ish â†˜.", pattern: "â†—â†˜ list", focus: "Three-item list: lÃªn, lÃªn, xuá»‘ng", note: "Äá»«ng xuá»‘ng quÃ¡ sá»›m á»Ÿ item 1 hoáº·c 2, vÃ¬ ngÆ°á»i nghe sáº½ tÆ°á»Ÿng cÃ¢u Ä‘Ã£ háº¿t." },
    { plain: "You can have the red one or the blue one.", marked: "RED one â†— or BLUE one â†˜.", pattern: "â†—â†˜ choice", focus: "Choice with or: lá»±a chá»n Ä‘áº§u lÃªn, lá»±a chá»n cuá»‘i xuá»‘ng", note: "CÃ¢u lá»±a chá»n dÃ¹ng 'or' thÆ°á»ng cÃ³ rise-fall giá»¯a hai lá»±a chá»n." },
    { plain: "I suppose so.", marked: "I sup-POSE so. â†˜â†—", pattern: "â†˜â†— fall-rise", focus: "Uncertain: xuá»‘ng rá»“i nháº¥c nháº¹", note: "Fall-rise táº¡o cáº£m giÃ¡c chÆ°a cháº¯c cháº¯n hoáº·c cÃ²n dÃ¨ dáº·t." },
    { plain: "It's nice, but...", marked: "It's NICE â†˜â†—, but...", pattern: "â†˜â†— fall-rise", focus: "Incomplete idea: chÆ°a nÃ³i háº¿t", note: "Xuá»‘ng rá»“i lÃªn Ä‘á»ƒ bÃ¡o cÃ²n Ã½ phÃ­a sau." },
    { plain: "Thank you.", marked: "THANK you. â†˜â†—", pattern: "â†˜â†— fall-rise", focus: "Polite thanks: má»m hÆ¡n falling máº¡nh", note: "Fall-rise lÃ m lá»i cáº£m Æ¡n nháº¹ vÃ  lá»‹ch sá»± hÆ¡n trong há»™i thoáº¡i." },
    { plain: "I think we should wait.", marked: "I THINK we should WAIT. â†˜â†—", pattern: "â†˜â†— fall-rise", focus: "Suggestion: khÃ´ng quÃ¡ Ã¡p Ä‘áº·t", note: "Khi Ä‘Æ°a Ã½ kiáº¿n dÃ¨ dáº·t, fall-rise giÃºp cÃ¢u bá»›t cá»©ng." },
    { plain: "Well, it depends.", marked: "WELL â†—, it de-PENDS. â†˜â†—", pattern: "â†˜â†— fall-rise", focus: "Hedging: má»Ÿ Ã½ rá»“i káº¿t thÃºc chÆ°a tuyá»‡t Ä‘á»‘i", note: "DÃ¹ng khi cÃ¢u tráº£ lá»i cÃ³ Ä‘iá»u kiá»‡n hoáº·c chÆ°a cháº¯c cháº¯n." },
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
      .replaceAll("â†˜â†—", '<span class="int-arrow-mix">â†˜â†—</span>')
      .replaceAll("â†—â†˜", '<span class="int-arrow-mix">â†—â†˜</span>')
      .replaceAll("â†—", '<span class="int-arrow-up">â†—</span>')
      .replaceAll("â†˜", '<span class="int-arrow-down">â†˜</span>');
  }

  function render() {
    const s = SENTENCES[STATE.idx];
    const total = SENTENCES.length;
    mount.innerHTML = `
      <div class="int-wrap">
        <div class="int-card">
          <div class="int-bc"><a href="/">Trang chá»§</a> Â· <a href="/question-answer">Luyá»‡n theo cÃ¢u</a> Â· Luyá»‡n intonation</div>
          <div class="int-nav">
            <button class="int-nav-btn" id="intPrev" ${STATE.idx === 0 ? "disabled" : ""}>â† cÃ¢u trÆ°á»›c</button>
            <div class="int-counter">CÃ¢u ${STATE.idx + 1} <small>/ ${total}</small></div>
            <button class="int-nav-btn" id="intNext" ${STATE.idx >= total - 1 ? "disabled" : ""}>cÃ¢u tiáº¿p â†’</button>
          </div>
          <span class="int-pattern ${patternClass(s.pattern)}">${escHtml(s.pattern)}</span>
          <div class="int-sentence">
            <div class="int-play-row">
              <button class="int-play" id="intTts" title="Nghe máº«u">â–¶</button>
              <div class="int-marked">${renderArrows(s.marked)}</div>
            </div>
            <div class="int-focus">ðŸŽ¯ ${escHtml(s.focus)}</div>
          </div>
          <div class="int-note">${escHtml(s.note)} Nghe máº«u, báº¯t chÆ°á»›c hÆ°á»›ng mÅ©i tÃªn, rá»“i ghi Ã¢m Ä‘á»ƒ cháº¥m.</div>
          <div id="intFeedbackHost">${STATE.feedback ? feedbackHtml(STATE.feedback) : ""}</div>
          <div class="int-actions">
            <button class="int-soft-btn" id="intRandom">Äá»•i cÃ¢u ngáº«u nhiÃªn</button>
            <button class="int-rec-btn" id="intRec">ðŸŽ¤ Ghi Ã¢m ngay</button>
          </div>
        </div>
        <div class="int-card int-rules">
          <h3>Quy táº¯c intonation</h3>
          ${ruleHtml(s.pattern)}
          <div class="int-hist-title">Lá»‹ch sá»­ gáº§n Ä‘Ã¢y:</div>
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
      <div class="int-rule ${is("falling") ? "active" : ""}"><b><span class="down">â†˜</span> Falling:</b> CÃ¢u tráº§n thuáº­t, WH-question, má»‡nh lá»‡nh â†’ xuá»‘ng cuá»‘i.</div>
      <div class="int-rule ${is("rising") ? "active" : ""}"><b><span class="up">â†—</span> Rising:</b> Yes/No question, ngáº¡c nhiÃªn, kiá»ƒm tra â†’ lÃªn cuá»‘i.</div>
      <div class="int-rule ${is("list") || is("choice") || is("contrast") ? "active" : ""}"><b><span class="mix">â†—â†˜</span> List/Choice:</b> Má»—i item lÃªn, item cuá»‘i xuá»‘ng. CÃ¢u lá»±a chá»n "or" cÅ©ng váº­y.</div>
      <div class="int-rule ${is("fall-rise") ? "active" : ""}"><b><span class="mix">â†˜â†—</span> Fall-rise:</b> KhÃ´ng cháº¯c, lá»‹ch sá»±, chÆ°a nÃ³i háº¿t â†’ xuá»‘ng rá»“i lÃªn nháº¹.</div>
    `;
  }

  function feedbackHtml(fb) {
    const cls = fb.score >= 7 ? "int-ok" : fb.score >= 4 ? "int-mid" : "int-no";
    const title = fb.score >= 7 ? "Intonation khÃ¡ tá»± nhiÃªn!" : fb.score >= 4 ? "ÄÃºng má»™t pháº§n rá»“i" : "Cáº§n rÃµ hÆ°á»›ng giá»ng hÆ¡n";
    return `
      <div class="int-feedback">
        <div class="int-fb-head">
          <div class="int-score ${cls}">${escHtml(fb.score)}/10</div>
          <div>
            <div class="int-fb-title">${title}</div>
            <div class="int-fb-sub">Pattern match: <b>${escHtml(fb.patternMatch || "partial")}</b> Â· ${escHtml(fb.pattern)}</div>
          </div>
        </div>
        <div class="int-fb-text">${escHtml(fb.feedback || "HÃ£y nghe máº«u vÃ  thá»­ kiá»ƒm soÃ¡t hÆ°á»›ng pitch rÃµ hÆ¡n á»Ÿ cuá»‘i cÃ¢u.")}</div>
      </div>
    `;
  }

  function renderHistory() {
    const host = mount.querySelector("#intHist");
    if (!host) return;
    const list = STATE.history.slice(0, 12);
    if (!list.length) {
      host.innerHTML = `<div style="color:#9ca3af;text-align:center;padding:.55rem;font-size:.78rem;">ChÆ°a luyá»‡n cÃ¢u nÃ o.</div>`;
      return;
    }
    host.innerHTML = list.map(h => {
      const cls = h.score >= 7 ? "ok" : h.score >= 4 ? "mid" : "no";
      const plain = h.plain || "";
      return `<div class="int-hist-row ${cls}">
        <b>${escHtml(plain.slice(0, 58))}${plain.length > 58 ? "â€¦" : ""}</b><br>
        ${escHtml(h.pattern || "")} Â· <b>${escHtml(h.score)}/10</b>
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
      btn.textContent = "ðŸ›‘ Dá»«ng & cháº¥m";
    } catch (e) {
      alert("KhÃ´ng truy cáº­p mic: " + e.message);
    }
  }

  async function onStop() {
    STATE.stream?.getTracks().forEach(t => t.stop());
    STATE.recording = false;
    const btn = mount.querySelector("#intRec");
    if (btn) {
      btn.classList.remove("recording");
      btn.textContent = "â³ Äang cháº¥mâ€¦";
      btn.disabled = true;
    }
    const blob = new Blob(STATE.chunks, { type: "audio/webm" });
    const b64 = await blobToBase64(blob);
    const s = SENTENCES[STATE.idx];
    const context = `INTONATION DRILL â€” Pattern: "${s.pattern}". Target: "${s.marked}".
Judge ONLY intonation pattern â€” NOT individual sound pronunciation or rhythm.
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
        btn.textContent = "ðŸŽ¤ Ghi Ã¢m láº¡i";
      }
      alert("Lá»—i cháº¥m: " + e.message);
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
      btn.textContent = "ðŸŽ¤ Ghi Ã¢m láº¡i";
    }
    if (host && STATE.feedback) host.innerHTML = feedbackHtml(STATE.feedback);
    renderHistory();
  }

  render();
})();

