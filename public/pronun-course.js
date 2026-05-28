// =====================================================================
//  Pronunciation course — /alphafeature/pronun/lesson<N>/section<M>
//  Section 1: embedded YouTube video (Dan Hauer 42 ngày phát âm)
//  Section 2: 8 FIXED example words → click to practice + score
//  Section 3: 5 FIXED example phrases → record + score per phrase
//  Static lesson data loaded from /real/_app/immutable/chunks/lessons_data-*.js
//  No Gemini generation for content — everything pre-baked.
// =====================================================================
(function () {
  const lessonMatch = location.pathname.match(/^\/alphafeature\/pronun\/lesson(\d+)\/section(\d+)\/?$/i);
  const onIndex     = /^\/alphafeature\/pronun\/?$/.test(location.pathname);
  if (!lessonMatch && !onIndex) return;

  const getKey = () => {
    try { return (JSON.parse(localStorage.getItem("luyennoi.geminiKeys") || "[]")[0]) || localStorage.getItem("luyennoi.geminiKey") || ""; }
    catch { return localStorage.getItem("luyennoi.geminiKey") || ""; }
  };
  const getModel = () => localStorage.getItem("luyennoi.geminiModel") || "";
  const escHtml  = s => String(s||"").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function ytEmbedFromUrl(url) {
    if (!url) return null;
    const idM = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_\-]+)/);
    if (!idM) return null;
    const list = url.match(/[?&]list=([A-Za-z0-9_\-]+)/);
    return `https://www.youtube.com/embed/${idM[1]}${list ? "?list=" + list[1] : ""}`;
  }

  async function loadLessons() {
    try {
      const mod = await import("/real/_app/immutable/chunks/lessons_data-2e8caf03.js");
      for (const k of Object.keys(mod)) {
        const v = mod[k];
        if (Array.isArray(v) && v[0]?.lessonId && v[0]?.wordExamples) return v;
      }
    } catch (e) { console.warn("[pronun] failed to load lessons_data chunk", e); }
    return null;
  }

  function speak(text) {
    if (!text) return;
    try { speechSynthesis.cancel(); } catch {}
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = "en-GB"; u.rate = 0.92;
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

  function saveHistory(entry) {
    try {
      const list = JSON.parse(localStorage.getItem("ln.pronunHistory") || "[]");
      list.unshift({ ts: Date.now(), ...entry });
      localStorage.setItem("ln.pronunHistory", JSON.stringify(list.slice(0, 200)));
    } catch {}
  }

  // ──────────────── INDEX PAGE — keep scraped list, wire history tab ────────────────
  function wireHistoryTab() {
    const histBtn = [...document.querySelectorAll("button[role=tab]")].find(b => /lịch sử/i.test(b.textContent || ""));
    const lessonBtn = [...document.querySelectorAll("button[role=tab]")].find(b => /bài học/i.test(b.textContent || ""));
    if (!histBtn || histBtn.__lnWired) return;
    histBtn.__lnWired = true;
    const lessonsContainer = lessonBtn?.parentElement?.parentElement;
    histBtn.style.cursor = "pointer";
    histBtn.addEventListener("click", () => {
      histBtn.classList.add("tab-active");
      lessonBtn?.classList.remove("tab-active");
      renderHistory();
    });
    lessonBtn?.addEventListener("click", () => {
      lessonBtn.classList.add("tab-active");
      histBtn.classList.remove("tab-active");
      const existing = document.getElementById("ln-pronun-history");
      if (existing) existing.remove();
      // Re-show lesson collapses
      lessonsContainer?.querySelectorAll(".collapse").forEach(c => c.style.display = "");
    });

    function renderHistory() {
      lessonsContainer?.querySelectorAll(".collapse").forEach(c => c.style.display = "none");
      document.getElementById("ln-pronun-history")?.remove();
      const list = (function(){ try { return JSON.parse(localStorage.getItem("ln.pronunHistory") || "[]"); } catch { return []; } })();
      const wrap = document.createElement("div");
      wrap.id = "ln-pronun-history";
      wrap.style.cssText = "font-family:Lexend,sans-serif;padding:1rem 0;";
      if (!list.length) {
        wrap.innerHTML = `<div style="text-align:center;color:#9ca3af;padding:3rem 1rem;font-size:.9rem;">📝 Chưa có lịch sử luyện phát âm. Vào bài học, bấm "🎤 Luyện" để bắt đầu.</div>`;
      } else {
        const fmtTime = ts => new Date(ts).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
        wrap.innerHTML = list.slice(0, 60).map(h => {
          const sc = typeof h.score === "number" ? h.score : "?";
          const color = typeof h.score === "number" ? (h.score >= 75 ? "var(--ink)" : h.score >= 60 ? "#d9381e" : h.score >= 40 ? "var(--ink)" : "var(--red)") : "#9ca3af";
          const target = h.kind === "phrase" ? h.sentence : h.word;
          return `
            <div style="border:1px solid #e5e7eb;border-radius:.55rem;padding:.6rem .9rem;margin-bottom:.45rem;display:flex;gap:.7rem;align-items:center;">
              <div style="background:${color};color:white;font-weight:800;border-radius:9999px;min-width:2.4rem;height:2.4rem;display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0;">${sc}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:.7rem;color:#9ca3af;font-weight:700;">${(h.kind || "word").toUpperCase()} · /${h.phoneme || "?"}/ · ${fmtTime(h.ts)}</div>
                <div style="font-weight:600;color:#171717;margin-top:.1rem;">${escHtml(target || "")}</div>
                ${h.phoneticHeard ? `<div style="font-size:.78rem;color:#d9381e;">Nghe được: ${escHtml(h.phoneticHeard)}</div>` : ""}
                ${h.verdict ? `<div style="font-size:.78rem;color:#4b5563;">${escHtml(h.verdict)}</div>` : ""}
              </div>
              <button data-text="${escHtml(target || "")}" style="background:transparent;border:1.5px solid #171717;color:#171717;border-radius:50%;width:2rem;height:2rem;cursor:pointer;flex-shrink:0;">▶</button>
            </div>`;
        }).join("");
      }
      lessonsContainer?.appendChild(wrap);
      wrap.querySelectorAll("button[data-text]").forEach(b => b.addEventListener("click", () => speak(b.dataset.text)));
    }
  }

  if (onIndex) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wireHistoryTab);
    else wireHistoryTab();
    return;
  }

  // ──────────────── LESSON SECTION PAGE ────────────────
  const lessonNum  = +lessonMatch[1];
  const sectionNum = +lessonMatch[2];

  function mountRoot() {
    const style = document.createElement("style");
    style.textContent = `
      body > *:not(#pc-root):not(script) { display: none !important; }
      #pc-root { font-family: Lexend, sans-serif; min-height: 100vh; background: #ffffff; padding: 2rem 1rem; }
      .pc-card { background: white; border: 1px solid #e5e7eb; border-radius: 1rem; padding: 2rem 1.8rem; max-width: 760px; margin: 0 auto; }
      .pc-bc { font-size: .82rem; color: #6b7280; margin-bottom: .8rem; }
      .pc-bc a { color: #d9381e; text-decoration: none; }
      .pc-bc a:hover { text-decoration: underline; }
      .pc-h1 { font-size: 1.4rem; font-weight: 700; color: #171717; margin: 0 0 .3rem; text-align: center; }
      .pc-h1-left { text-align: left; }
      .pc-hint { font-size: .8rem; color: #6b7280; margin-bottom: 1rem; text-align: center; }

      /* Progress bar at top */
      .pc-progress-wrap { margin: 1rem auto 0; max-width: 360px; }
      .pc-progress-bar { background: #e5e7eb; height: .5rem; border-radius: 9999px; overflow: hidden; }
      .pc-progress-bar > div { background: #d9381e; height: 100%; transition: width .3s; }
      .pc-progress-label { text-align: center; font-size: .82rem; color: #6b7280; margin-top: .4rem; }

      /* Top Back/Next pills */
      .pc-topnav { display: flex; justify-content: space-between; margin: .8rem 0 1.2rem; }
      .pc-pill { background: white; border: 1.5px solid #e5e7eb; color: #4b5563; padding: .35rem 1rem; border-radius: 9999px; font-size: .82rem; cursor: pointer; font-family: inherit; font-weight: 500; }
      .pc-pill:hover { border-color: #d9381e; color: #d9381e; }
      .pc-pill:disabled { opacity: .35; cursor: not-allowed; }
      .pc-pill-purple { color: #d9381e; border-color: #d9381e; }

      /* Word/phrase center hero */
      .pc-hero { display: flex; align-items: center; justify-content: center; gap: .9rem; padding: 1.5rem 0 .5rem; flex-wrap: wrap; }
      .pc-hero-text { font-size: 1.6rem; font-weight: 700; color: #171717; }
      .pc-hero-text.phrase { font-size: 1.35rem; }
      .pc-ipa-center { text-align: center; color: #6b7280; font-size: 1rem; letter-spacing: .03em; margin-bottom: 1rem; }
      .pc-divider { border-top: 1px solid #e5e7eb; margin: 1rem 0; }
      .pc-prompt { text-align: center; color: #6b7280; font-size: .92rem; padding: 1.2rem 0; }
      .pc-prompt b { color: #d9381e; font-weight: 700; }

      /* Big play (teal circle) */
      .pc-play { background: white; border: 2.5px solid #171717; color: #171717; border-radius: 50%; width: 2.4rem; height: 2.4rem; cursor: pointer; font-size: .9rem; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .pc-play:hover { background: #fff7c2; }

      /* Big record button bottom-right */
      .pc-actions { display: flex; justify-content: flex-end; padding-top: 1rem; gap: .5rem; }
      .pc-rec { padding: .85rem 2.4rem; border: none; border-radius: 9999px; background: #d9381e; color: white; font-weight: 700; font-size: .98rem; cursor: pointer; font-family: inherit; box-shadow: 0 4px 16px rgba(217, 56, 30,.3); }
      .pc-rec:hover { background: #4a0cd4; }
      .pc-rec.recording { background: #ef4444; animation: pc-pulse 1.2s infinite; }
      @keyframes pc-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,.5) } 50% { box-shadow: 0 0 0 12px rgba(239,68,68,0) } }
      .pc-rec:disabled { background: var(--ink); cursor: not-allowed; box-shadow: none; }

      /* Bottom prev/next lesson pills (oval purple) */
      .pc-lessonnav { display: flex; justify-content: space-between; gap: .8rem; margin-top: 2.5rem; }
      .pc-lessonnav .pc-pill { padding: .55rem 1.4rem; font-size: .88rem; }

      /* Result block */
      .pc-result { background: #ffffff; border-radius: .7rem; padding: 1rem 1.2rem; margin-top: 1rem; }
      .pc-result-score { font-size: 2rem; font-weight: 800; color: #d9381e; line-height: 1; }
      .pc-result-meta { font-size: .85rem; color: #4b5563; margin-top: .3rem; line-height: 1.5; }
      .pc-result-tip { background: #fef3c7; border-left: 4px solid #f59e0b; padding: .5rem .8rem; margin-top: .55rem; font-size: .82rem; color: #92400e; }

      .pc-btn { padding: .55rem 1.1rem; border: none; border-radius: 9999px; font-weight: 600; cursor: pointer; font-family: inherit; font-size: .88rem; }
      .pc-btn-primary { background: #d9381e; color: white; }
      .pc-btn-primary:hover { background: #4a0cd4; }
      .pc-btn-ghost { background: transparent; color: #d9381e; border: 1.5px solid #d9381e; }
      .pc-btn-ghost:hover { background: #ffffff; }
    `;
    document.head.appendChild(style);
    const root = document.createElement("div");
    root.id = "pc-root";
    document.body.appendChild(root);
    return root;
  }

  // ──────────────── State for one-at-a-time drills ────────────────
  const PC = { itemIdx: 0, recorder: null, stream: null, chunks: [], recording: false, lastResult: null };

  function blobToBase64Async(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  // ──────────────── LuyenDoc grapheme map (phoneme → graphemes + LuyenDoc lesson ID) ────────────────
  // Mapped from the 28 sound-to-phonogram lessons. Each entry: phoneme IPA → { graphemes[], ldId, name }
  // (ldId is the LuyenDoc lesson ID for /luyendoc/sound-to-phonograpm/<id>/learn link.)
  const LD_GRAPHEME_MAP = {
    "iː":  { ldId: 1,  name: "Long E /iː/",      graphemes: ["e","ee","y","ea","ie","ei","i","ey"] },
    "eɪ":  { ldId: 2,  name: "Long A /eɪ/",      graphemes: ["a_e","a","ai","ay","ea","ey","ei","eigh"] },
    "aɪ":  { ldId: 4,  name: "Long I /aɪ/",      graphemes: ["i_e","i","y","igh","ie","eigh","ui","uy"] },
    "oʊ":  { ldId: 5,  name: "Long O /oʊ/",      graphemes: ["o","o_e","oa","ow","oe","ough"] },
    "uː":  { ldId: 8,  name: "Long OO /uː/",     graphemes: ["oo","u_e","u","ew","ue","ou","ui","o"] },
    "juː": { ldId: 8,  name: "Long U /juː/",     graphemes: ["u_e","u","ew","ue","ui"] },
    "ɪ":   { ldId: 11, name: "Short I /ɪ/",      graphemes: ["i","y","ui"] },
    "ɛ":   { ldId: 12, name: "Short E /ɛ/",      graphemes: ["e","ea"] },
    "e":   { ldId: 12, name: "Short E /e/",      graphemes: ["e","ea"] },
    "æ":   { ldId: 14, name: "Short A /æ/",      graphemes: ["a"] },
    "ʌ":   { ldId: 16, name: "Short U /ʌ/",      graphemes: ["u","o","ou"] },
    "ʊ":   { ldId: 17, name: "Short OO /ʊ/",    graphemes: ["oo","u","oul"] },
    "ɒ":   { ldId: 21, name: "Short O /ɒ/",      graphemes: ["o","a"] },
    "ɔː":  { ldId: 41, name: "Broad AW /ɔː/",    graphemes: ["aw","au","augh","ough"] },
    "ɑːr": { ldId: 42, name: "R-AR /ɑːr/",       graphemes: ["ar"] },
    "ɑː":  { ldId: 42, name: "AR /ɑː/",          graphemes: ["ar"] },
    "aʊ":  { ldId: 22, name: "Diphthong OW /aʊ/", graphemes: ["ou","ow"] },
    "ɔɪ":  { ldId: 43, name: "Diphthong OI /ɔɪ/", graphemes: ["oi","oy"] },
    "ɜːr": { ldId: 24, name: "Stressed R /ɜːr/", graphemes: ["er","ir","ur","or","ear"] },
    "ɜː":  { ldId: 24, name: "Schwa-R /ɜː/",     graphemes: ["er","ir","ur","or","ear"] },
    "ɔːr": { ldId: 25, name: "R-Controlled /ɔːr/", graphemes: ["or","ore","oar","our"] },
    "ɛər": { ldId: 28, name: "R-Care /ɛər/",     graphemes: ["air","are","ear","ere","eir"] },
    "ɪər": { ldId: 44, name: "R-Here /ɪər/",     graphemes: ["ear","eer","ere","ier"] },
    "aɪər":{ ldId: 45, name: "R-Fire /aɪər/",    graphemes: ["ire","ier","oir"] },
    "jʊər":{ ldId: 46, name: "R-Pure /jʊər/",   graphemes: ["ure","ewer"] },
    "ə":   { ldId: 30, name: "Schwa /ə/",        graphemes: ["a","e","i","o","u"] },
    "k":   { ldId: 33, name: "/k/ Trap",         graphemes: ["c","k","ck","ch","que"] },
    "ʃ":   { ldId: 34, name: "Palatal /ʃ/",      graphemes: ["sh","ti","ci","si","ch","s"] },
    "ʒ":   { ldId: 34, name: "Palatal /ʒ/",      graphemes: ["s","ge"] },
    "tʃ":  { ldId: 36, name: "Affricate /tʃ/",   graphemes: ["ch","tch","t"] },
    "dʒ":  { ldId: 36, name: "Affricate /dʒ/",   graphemes: ["j","g","dge"] },
    "f":   { ldId: 37, name: "/f/ Illusion",     graphemes: ["f","ff","ph","gh"] },
    "s":   { ldId: 37, name: "/s/ Illusion",     graphemes: ["s","ss","c","sc"] },
  };

  // ── Section 1 — YouTube embed + Graphemes table ──
  function renderSection1(root, lesson) {
    const embed = ytEmbedFromUrl(lesson.videoUrl);
    const ldEntry = LD_GRAPHEME_MAP[lesson.phoneme];
    const graphemesPanel = ldEntry ? `
      <div style="margin-top:1.4rem;background:#ffffff;border-radius:.7rem;padding:1rem 1.2rem;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.7rem;margin-bottom:.6rem;">
          <div>
            <div style="font-size:.72rem;color:#9ca3af;font-weight:700;letter-spacing:.05em;">CÁCH VIẾT ÂM NÀY (GRAPHEMES)</div>
            <div style="font-weight:700;color:#171717;font-size:1.05rem;margin-top:.15rem;">${escHtml(ldEntry.name)}</div>
            <div style="font-size:.78rem;color:#6b7280;margin-top:.2rem;">Âm này có <b>${ldEntry.graphemes.length}</b> cách viết khác nhau trong tiếng Anh:</div>
          </div>
          <a href="/luyendoc/sound-to-phonograpm/${ldEntry.ldId}/learn/" target="_blank"
             style="background:#d9381e;color:white;padding:.4rem .8rem;border-radius:9999px;font-size:.74rem;font-weight:600;text-decoration:none;white-space:nowrap;">
            📚 Học sâu (LuyenDoc) →
          </a>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:.4rem;">
          ${ldEntry.graphemes.map(g => `
            <span style="background:white;border:1.5px solid var(--ink);padding:.35rem .75rem;border-radius:.45rem;font-family:'Courier New',monospace;font-weight:700;color:#d9381e;font-size:.95rem;">
              ${escHtml(g === "a_e" ? "a_e (silent e)" : g === "i_e" ? "i_e" : g === "o_e" ? "o_e" : g === "u_e" ? "u_e" : g)}
            </span>
          `).join("")}
        </div>
        <div style="margin-top:.6rem;font-size:.74rem;color:#6b7280;">
          💡 Click "Học sâu" để xem ví dụ + bài tập cho từng cách viết tại LuyenDoc.
        </div>
      </div>
    ` : "";

    root.innerHTML = `
      <div class="pc-card">
        <div class="pc-bc"><a href="/alphafeature/pronun">← Khoá học phát âm</a> · Bài ${lessonNum}</div>
        <h1 class="pc-h1">Hướng dẫn luyện âm: /${escHtml(lesson.phoneme)}/</h1>
        <p class="pc-hint">Video hướng dẫn của thầy Dan Hauer — phát âm chuẩn IPA + cách đặt môi lưỡi.</p>
        ${embed ? `
          <div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:.7rem;background:black;">
            <iframe src="${embed}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
          </div>` : `<div style="background:#ffffff;color:var(--red);padding:1rem;border-radius:.5rem;">⚠ Bài này chưa có video. Link gốc: <a href="${escHtml(lesson.videoUrl || "")}" target="_blank" style="color:#d9381e;">${escHtml(lesson.videoUrl || "")}</a></div>`}
        ${graphemesPanel}
        <div class="pc-nav">
          ${lessonNum > 1 ? `<a class="pc-btn pc-btn-ghost" href="/alphafeature/pronun/lesson${lessonNum - 1}/section1">← Bài trước</a>` : "<span></span>"}
          <a class="pc-btn pc-btn-primary" href="/alphafeature/pronun/lesson${lessonNum}/section2">Bài học tiếp →</a>
        </div>
      </div>
    `;
  }

  // Get IPA for a word/phrase. Uses the overlay's window.lnTranscribe util (cached).
  // Returns the IPA string or "" while loading. Caller should call again after await.
  const PC_IPA_CACHE = new Map(); // in-memory mirror of localStorage cache for sync access
  async function getIpa(text) {
    if (!text) return "";
    if (PC_IPA_CACHE.has(text)) return PC_IPA_CACHE.get(text);
    if (typeof window.lnTranscribe !== "function") return ""; // overlay not loaded yet
    const res = await window.lnTranscribe(text);
    const ipa = res?.ipa || "";
    if (ipa) PC_IPA_CACHE.set(text, ipa);
    return ipa;
  }
  // Synchronous best-guess fallback ONLY for first render — gets replaced once IPA loads.
  function fauxIpa(word) {
    return "/" + word.toLowerCase().split("").join(" ") + "/";
  }

  // ── Section 2 — Word practice (ONE word at a time, matches reference UI) ──
  function renderSection2(root, lesson) {
    const words = lesson.wordExamples || [];
    if (!words.length) {
      root.innerHTML = `<div class="pc-card"><h1 class="pc-h1">Bài này chưa có dữ liệu từ</h1></div>`;
      return;
    }
    if (PC.itemIdx < 0) PC.itemIdx = 0;
    if (PC.itemIdx >= words.length) PC.itemIdx = words.length - 1;

    const renderOne = () => {
      const w = words[PC.itemIdx];
      const total = words.length;
      const progressPct = ((PC.itemIdx + 1) / total) * 100;
      root.innerHTML = `
        <div class="pc-card">
          <div class="pc-bc"><a href="/alphafeature/pronun">← Khoá học phát âm</a> · Bài ${lessonNum} · Luyện phát âm từ</div>
          <h1 class="pc-h1">Luyện phát âm từ</h1>
          <div class="pc-progress-wrap">
            <div class="pc-progress-bar"><div style="width:${progressPct}%;"></div></div>
            <div class="pc-progress-label">Từ ${PC.itemIdx + 1}/${total}</div>
          </div>
          <div class="pc-topnav">
            <button class="pc-pill pc-pill-purple" id="pc-back" ${PC.itemIdx === 0 ? "disabled" : ""}>← Back</button>
            <button class="pc-pill pc-pill-purple" id="pc-next" ${PC.itemIdx === total - 1 ? "disabled" : ""}>Next →</button>
          </div>
          <div class="pc-hero">
            <button class="pc-play" id="pc-tts" title="Nghe TTS">▶</button>
            <span class="pc-hero-text">${escHtml(w)}</span>
            <span class="pc-ipa-center" id="pc-ipa-now" style="margin-bottom:0;">${escHtml(fauxIpa(w))}</span>
          </div>
          <div class="pc-divider"></div>
          <div class="pc-prompt" id="pc-prompt">Nhấn nút <b>Ghi âm ngay</b> ở dưới để luyện phát âm</div>
          <div id="pc-result-host"></div>
          <div class="pc-actions">
            <button class="pc-rec" id="pc-rec">Ghi âm ngay</button>
          </div>
          <div class="pc-lessonnav">
            <button class="pc-pill pc-pill-purple" onclick="location.href='/alphafeature/pronun/lesson${lessonNum}/section1'">← Bài học trước</button>
            <button class="pc-pill pc-pill-purple" onclick="location.href='/alphafeature/pronun/lesson${lessonNum}/section3'">Bài học tiếp →</button>
          </div>
        </div>
      `;
      root.querySelector("#pc-tts").addEventListener("click", () => speak(w));
      root.querySelector("#pc-back").addEventListener("click", () => { if (PC.itemIdx > 0) { PC.itemIdx--; renderOne(); } });
      root.querySelector("#pc-next").addEventListener("click", () => { if (PC.itemIdx < total - 1) { PC.itemIdx++; renderOne(); } });
      root.querySelector("#pc-rec").addEventListener("click", () => toggleRecordWord(w, lesson.phoneme));
      // Async: fetch real IPA + replace the placeholder
      getIpa(w).then(ipa => {
        const el = root.querySelector("#pc-ipa-now");
        if (el && ipa) el.textContent = ipa;
      });
    };
    PC.itemIdx = 0; // start from first when entering the section
    renderOne();
  }

  async function toggleRecordWord(word, phoneme) {
    const btn = root.querySelector("#pc-rec");
    if (PC.recording) { try { PC.recorder?.stop(); } catch {} return; }
    if (!getKey()) { location.href = `/settings?next=${encodeURIComponent(location.pathname + location.search)}`; return; }
    try {
      PC.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      PC.chunks = [];
      const pcMimeOpts = typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported("audio/webm") ? { mimeType: "audio/webm" } : {};
      PC.recorder = new MediaRecorder(PC.stream, pcMimeOpts);
      PC.recorder.ondataavailable = e => PC.chunks.push(e.data);
      PC.recorder.onstop = () => onStopWord(word, phoneme);
      PC.recorder.start();
      PC.recording = true;
      btn.classList.add("recording");
      btn.textContent = "🛑 Dừng & chấm";
    } catch (e) { alert("Không truy cập được mic: " + e.message); }
  }

  async function onStopWord(word, phoneme) {
    PC.stream?.getTracks().forEach(t => t.stop());
    PC.recording = false;
    const btn = root.querySelector("#pc-rec");
    if (btn) { btn.classList.remove("recording"); btn.textContent = "⏳ Đang chấm…"; btn.disabled = true; }
    const blob = new Blob(PC.chunks, { type: "audio/webm" });
    const b64 = await blobToBase64Async(blob);
    try {
      const r = await fetch("/api/gemini/score-word", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: getKey(), model: getModel(),
          word,
          targetPhoneme: phoneme || "",
          focusOnly: !!phoneme,
          audioBase64: b64.split(",")[1] || b64,
          mimeType: "audio/webm"
        })
      });
      const d = await r.json();
      const sc = typeof d.score === "number" ? d.score : "?";
      saveHistory({ kind: "word", phoneme, word, score: sc, phoneticHeard: d.phoneticHeard, verdict: d.verdict, tips: d.tips });
      renderResultBlock({ score: sc, raw: d });
    } catch (e) {
      renderResultBlock({ score: "?", raw: { verdict: "Lỗi: " + e.message } });
    }
  }

  function renderResultBlock({ score, raw }) {
    const btn = root.querySelector("#pc-rec");
    if (btn) { btn.disabled = false; btn.textContent = "Ghi âm lại"; }
    const host = root.querySelector("#pc-result-host");
    if (!host) return;
    const color = typeof score === "number" ? (score >= 75 ? "var(--ink)" : score >= 60 ? "#d9381e" : score >= 40 ? "var(--ink)" : "var(--red)") : "#9ca3af";
    host.innerHTML = `
      <div class="pc-result">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.8rem;">
          <div style="flex:1;">
            <div style="font-size:.72rem;color:#9ca3af;font-weight:700;">ĐIỂM PHÁT ÂM</div>
            <div class="pc-result-score" style="color:${color};">${score}/100</div>
            ${raw?.phoneticHeard ? `<div class="pc-result-meta">Nghe được: <b style="color:#d9381e;">${escHtml(raw.phoneticHeard)}</b></div>` : ""}
            ${raw?.verdict ? `<div class="pc-result-meta">${escHtml(raw.verdict)}</div>` : ""}
          </div>
        </div>
        ${raw?.tips ? `<div class="pc-result-tip">💡 ${escHtml(raw.tips)}</div>` : ""}
      </div>
    `;
  }

  // ── Section 3 — Phrase practice (ONE phrase at a time) ──
  function renderSection3(root, lesson) {
    const phrases = lesson.sentenceExamples || [];
    if (!phrases.length) {
      root.innerHTML = `<div class="pc-card"><h1 class="pc-h1">Bài này chưa có dữ liệu câu</h1></div>`;
      return;
    }

    const renderOne = () => {
      const p = phrases[PC.itemIdx];
      const total = phrases.length;
      const progressPct = ((PC.itemIdx + 1) / total) * 100;
      // First render: faux IPA. Will be replaced with real IPA after async fetch.
      const fauxWords = p.replace(/[.,!?]/g, "").split(/\s+/).map(w => fauxIpa(w)).join(" ");
      const wordsIpa = fauxWords;
      root.innerHTML = `
        <div class="pc-card">
          <div class="pc-bc"><a href="/alphafeature/pronun">← Khoá học phát âm</a> · Bài ${lessonNum} · Luyện phát âm cụm từ</div>
          <h1 class="pc-h1">Luyện phát âm cụm từ:</h1>
          <div class="pc-progress-wrap">
            <div class="pc-progress-bar"><div style="width:${progressPct}%;"></div></div>
            <div class="pc-progress-label">Cụm từ ${PC.itemIdx + 1}/${total}</div>
          </div>
          <div class="pc-topnav">
            <button class="pc-pill pc-pill-purple" id="pc-back" ${PC.itemIdx === 0 ? "disabled" : ""}>← Back</button>
            <button class="pc-pill pc-pill-purple" id="pc-next" ${PC.itemIdx === total - 1 ? "disabled" : ""}>Next →</button>
          </div>
          <div class="pc-hero">
            <button class="pc-play" id="pc-tts" title="Nghe TTS">▶</button>
            <span class="pc-hero-text phrase">${escHtml(p)}</span>
          </div>
          <div class="pc-ipa-center" id="pc-ipa-now">${escHtml(wordsIpa)}</div>
          <div class="pc-divider"></div>
          <div class="pc-prompt">Nhấn nút <b>Ghi âm ngay</b> ở dưới để luyện phát âm</div>
          <div id="pc-result-host"></div>
          <div class="pc-actions">
            <button class="pc-rec" id="pc-rec">Ghi âm ngay</button>
          </div>
          <div class="pc-lessonnav">
            <button class="pc-pill pc-pill-purple" onclick="location.href='/alphafeature/pronun/lesson${lessonNum}/section2'">← Bài học trước</button>
            <button class="pc-pill pc-pill-purple" onclick="location.href='/alphafeature/pronun/lesson${lessonNum + 1}/section1'">Bài học tiếp →</button>
          </div>
        </div>
      `;
      root.querySelector("#pc-tts").addEventListener("click", () => speak(p));
      root.querySelector("#pc-back").addEventListener("click", () => { if (PC.itemIdx > 0) { PC.itemIdx--; renderOne(); } });
      root.querySelector("#pc-next").addEventListener("click", () => { if (PC.itemIdx < total - 1) { PC.itemIdx++; renderOne(); } });
      root.querySelector("#pc-rec").addEventListener("click", () => toggleRecordPhrase(p, lesson.phoneme));
      // Async: fetch real IPA per word + replace placeholder
      (async () => {
        const res = (typeof window.lnTranscribe === "function") ? await window.lnTranscribe(p) : null;
        const el = root.querySelector("#pc-ipa-now");
        if (!el) return;
        if (res?.perWord && res.perWord.length) {
          el.textContent = res.perWord.map(x => x.ipa).join(" ");
        } else if (res?.ipa) {
          el.textContent = res.ipa;
        }
      })();
    };
    PC.itemIdx = 0;
    renderOne();
  }

  async function toggleRecordPhrase(sentence, phoneme) {
    const btn = root.querySelector("#pc-rec");
    if (PC.recording) { try { PC.recorder?.stop(); } catch {} return; }
    if (!getKey()) { location.href = `/settings?next=${encodeURIComponent(location.pathname + location.search)}`; return; }
    try {
      PC.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      PC.chunks = [];
      const pcMimeOpts2 = typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported("audio/webm") ? { mimeType: "audio/webm" } : {};
      PC.recorder = new MediaRecorder(PC.stream, pcMimeOpts2);
      PC.recorder.ondataavailable = e => PC.chunks.push(e.data);
      PC.recorder.onstop = () => onStopPhrase(sentence, phoneme);
      PC.recorder.start();
      PC.recording = true;
      btn.classList.add("recording");
      btn.textContent = "🛑 Dừng & chấm";
    } catch (e) { alert("Không truy cập được mic: " + e.message); }
  }

  async function onStopPhrase(sentence, phoneme) {
    PC.stream?.getTracks().forEach(t => t.stop());
    PC.recording = false;
    const btn = root.querySelector("#pc-rec");
    if (btn) { btn.classList.remove("recording"); btn.textContent = "⏳ Đang chấm…"; btn.disabled = true; }
    const blob = new Blob(PC.chunks, { type: "audio/webm" });
    const b64 = await blobToBase64Async(blob);
    try {
      const r = await fetch("/api/gemini/score-sentence", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: getKey(), model: getModel(),
          sentence,
          targetPhoneme: phoneme || "",
          focusOnly: !!phoneme,
          audioBase64: b64.split(",")[1] || b64,
          mimeType: "audio/webm"
        })
      });
      const d = await r.json();
      const sc = typeof d.score === "number" ? d.score : "?";
      saveHistory({ kind: "phrase", phoneme, sentence, score: sc, phoneticHeard: d.phoneticHeard, verdict: d.verdict, tips: d.tips, worstWords: d.worstWords });
      renderResultBlock({ score: sc, raw: d });
    } catch (e) {
      renderResultBlock({ score: "?", raw: { verdict: "Lỗi: " + e.message } });
    }
  }

  // ──────────────── Boot ────────────────
  (async function boot() {
    const root = mountRoot();
    root.innerHTML = `<div class="pc-card" style="text-align:center;color:#9ca3af;">⏳ Đang tải dữ liệu bài học…</div>`;
    const lessons = await loadLessons();
    const lesson = lessons?.[lessonNum - 1];
    if (!lesson) {
      root.innerHTML = `<div class="pc-card"><h1 class="pc-h1">Không tìm thấy bài ${lessonNum}</h1><a class="pc-btn pc-btn-primary" href="/alphafeature/pronun">← Về khoá học</a></div>`;
      return;
    }
    if (sectionNum === 1) renderSection1(root, lesson);
    else if (sectionNum === 2) renderSection2(root, lesson);
    else if (sectionNum === 3) renderSection3(root, lesson);
    else root.innerHTML = `<div class="pc-card"><h1 class="pc-h1">Section ${sectionNum} không tồn tại</h1><a class="pc-btn pc-btn-primary" href="/alphafeature/pronun/lesson${lessonNum}/section1">Về section 1</a></div>`;
  })();
})();


