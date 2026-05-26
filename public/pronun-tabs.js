// Inject pronun-page CSS once (the home.html shell host does not load /styles.css)
(function injectCss() {
  if (document.getElementById("ln-pronun-css")) return;
  const s = document.createElement("style");
  s.id = "ln-pronun-css";
  s.textContent = `
    #pronunRoot { font-family: Lexend, sans-serif; max-width: 1100px; margin: 0 auto; padding: 0 .2rem; }
    .pronun-header { display:flex; justify-content:space-between; align-items:flex-end; gap:1rem; margin-bottom:1rem; flex-wrap:wrap; }
    .pronun-header h1 { font-size:1.45rem; font-weight:700; color:#171717; margin:0 0 .35rem; }
    .pronun-header p { font-size:.85rem; color:#6b7280; margin:0; max-width:640px; line-height:1.55; }

    .pronun-tabs { display:flex; gap:.4rem; flex-wrap:wrap; margin-bottom:1.2rem; border-bottom:2px solid #e5e7eb; padding-bottom:0; }
    .pronun-tabs button { padding:.55rem 1.1rem; background:transparent; border:none; border-bottom:2px solid transparent; margin-bottom:-2px; font-size:.92rem; font-weight:600; color:#6b7280; cursor:pointer; font-family:inherit; transition:color .15s, border-color .15s; }
    .pronun-tabs button:hover { color:#d9381e; }
    .pronun-tabs button.active { color:#d9381e; border-bottom-color:#d9381e; }

    .pronun-panel { padding:.6rem 0 2rem; }

    .lesson-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:.7rem; }
    .lesson-card { display:flex; flex-direction:column; padding:.9rem 1rem; background:white; border:1px solid #e5e7eb; border-radius:.6rem; text-decoration:none; color:inherit; transition:border-color .15s, box-shadow .15s, transform .12s; gap:.25rem; }
    .lesson-card:hover { border-color:var(--ink); box-shadow:0 4px 14px rgba(217,56,30,.16); transform:translateY(-1px); }
    .lesson-card span { font-size:.7rem; color:#9ca3af; font-weight:700; letter-spacing:.05em; text-transform:uppercase; }
    .lesson-card strong { font-size:.95rem; color:#171717; font-weight:700; line-height:1.4; }
    .lesson-card small { font-size:.72rem; color:#6b7280; line-height:1.4; }
    .lesson-card p { font-size:.78rem; color:#4b5563; margin:.1rem 0; line-height:1.45; }
    .lesson-card button { align-self:flex-start; background:white; border:1.5px solid #171717; color:#171717; border-radius:50%; width:1.9rem; height:1.9rem; cursor:pointer; font-size:.72rem; margin-top:.3rem; padding:0; }
    .lesson-card button:hover { background:#fff7c2; }

    .phonics-group { margin-bottom:1.8rem; }
    .phonics-group h2 { font-size:1rem; font-weight:700; color:#d9381e; margin:.2rem 0 .8rem; padding-left:.5rem; border-left:3px solid #d9381e; }

    /* LIST view */
    .g-list-header { background:linear-gradient(135deg,#ffffff,#ffffff); border:1px solid var(--ink); border-radius:.7rem; padding:.9rem 1.1rem; margin-bottom:1.2rem; }
    .g-list-header strong { display:block; font-size:1.05rem; font-weight:700; color:#171717; }
    .g-list-header small { display:block; font-size:.82rem; color:#6b7280; margin-top:.2rem; }
    .g-list { display:flex; flex-direction:column; gap:.35rem; }
    .g-list-item { display:flex; align-items:center; gap:.7rem; padding:.7rem 1rem; background:white; border:1px solid #e5e7eb; border-radius:.55rem; text-decoration:none; color:inherit; transition:border-color .15s, transform .12s; }
    .g-list-item:hover { border-color:#d9381e; transform:translateX(2px); background:#ffffff; }
    .g-list-num { color:#9ca3af; font-weight:700; min-width:1.7rem; font-size:.85rem; }
    .g-list-sound { flex:1; font-size:1.05rem; font-weight:700; color:#171717; font-family:'Segoe UI Symbol','Lexend',sans-serif; }
    .g-list-meta { display:flex; gap:.35rem; flex-wrap:wrap; }
    .g-list-tag { background:#f3f4f6; color:#4b5563; font-size:.72rem; padding:.15rem .55rem; border-radius:9999px; font-weight:500; }
    .g-list-arrow { color:var(--ink); font-weight:700; transition:color .15s; }
    .g-list-item:hover .g-list-arrow { color:#d9381e; }

    /* DETAIL view */
    .g-detail-head { margin-bottom:1.2rem; padding-bottom:.9rem; border-bottom:1px solid #e5e7eb; }
    .g-back { color:#d9381e; font-size:.82rem; font-weight:600; text-decoration:none; }
    .g-back:hover { text-decoration:underline; }
    .g-detail-head h2 { font-size:1.4rem; font-weight:800; color:#171717; margin:.5rem 0 .25rem; }
    .g-detail-sound { font-family:'Segoe UI Symbol','Lexend',sans-serif; }
    .g-detail-group { font-size:.85rem; color:#9ca3af; font-weight:600; margin-left:.6rem; }
    .g-detail-stats { font-size:.82rem; color:#6b7280; margin:0; }
    .g-toc { background:#f9fafb; border:1px solid #e5e7eb; border-radius:.6rem; padding:.7rem .9rem; margin-bottom:1.2rem; display:flex; flex-wrap:wrap; gap:.35rem; align-items:center; }
    .g-toc strong { font-size:.75rem; color:#9ca3af; font-weight:700; margin-right:.5rem; letter-spacing:.05em; }
    .g-toc a { display:inline-flex; align-items:center; gap:.3rem; background:white; border:1px solid #e5e7eb; padding:.25rem .55rem; border-radius:.4rem; text-decoration:none; color:#171717; font-family:'Courier New',monospace; font-weight:700; }
    .g-toc a:hover { border-color:#d9381e; background:#ffffff; }
    .g-toc a b { color:#d9381e; }
    .g-toc a small { color:#9ca3af; font-size:.7rem; font-weight:400; font-family:'Segoe UI Symbol','Segoe UI',sans-serif; }
    .g-body { display:flex; flex-direction:column; gap:.8rem; }
    .g-section { background:white; border:1px solid #e5e7eb; border-radius:.7rem; padding:0; scroll-margin-top:1rem; }
    .g-section > summary { cursor:pointer; padding:.85rem 1.1rem; list-style:none; }
    .g-section > summary::-webkit-details-marker { display:none; }
    .g-section-head { display:flex; justify-content:space-between; align-items:center; gap:.6rem; }
    .g-section-badge { display:inline-flex; align-items:baseline; gap:.4rem; background:#ffffff; padding:.35rem .8rem; border-radius:.45rem; }
    .g-section-badge b { font-size:1.1rem; color:#d9381e; font-weight:800; font-family:'Courier New',monospace; }
    .g-section-badge small { font-size:.78rem; color:#d9381e; font-family:'Segoe UI Symbol','Segoe UI',sans-serif; }
    .g-section-meta { font-size:.72rem; color:#9ca3af; font-weight:600; margin-left:auto; }
    .g-caret { display:inline-block; color:#9ca3af; transition:transform .15s; font-size:.8rem; }
    .g-section[open] > summary .g-caret,
    .g-subsec[open] > summary .g-caret { transform:rotate(90deg); color:#d9381e; }
    .g-section-content { padding:0 1.1rem 1rem; }
    .g-subsec { margin-top:.4rem; border-top:1px dashed #f3f4f6; padding-top:.5rem; }
    .g-subsec:first-child { border-top:none; padding-top:0; margin-top:0; }
    .g-subsec > summary { cursor:pointer; list-style:none; padding:.3rem 0; }
    .g-subsec > summary::-webkit-details-marker { display:none; }
    .g-subsec-head { display:flex; align-items:center; gap:.4rem; }
    .g-section-sub { font-size:.7rem; color:#6b7280; font-weight:700; letter-spacing:.08em; }
    .g-words-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:.5rem; }
    .g-word-card { display:flex; justify-content:space-between; align-items:center; gap:.4rem; padding:.5rem .6rem; background:white; border:1px solid #e5e7eb; border-radius:.5rem; transition:border-color .15s, box-shadow .15s, transform .12s; cursor:pointer; }
    .g-word-card:hover { border-color:#d9381e; box-shadow:0 2px 8px rgba(217, 56, 30,.1); transform:translateY(-1px); }
    .g-word-card:active { transform:translateY(0); }
    .g-word-text { font-size:1rem; font-weight:600; color:#171717; flex:1; min-width:0; line-height:2.4; word-spacing:.05em; }
    /* TARGET grapheme — teal (highlighted) */
    .g-word-text ruby.hit { color:#0d9488; }
    .g-word-text ruby.hit rt { color:#0d9488; font-size:.55em; font-weight:700; font-family:'Segoe UI Symbol','Segoe UI',sans-serif; letter-spacing:.02em; }
    /* Context grapheme — muted purple (smaller, less prominent) */
    .g-word-text ruby.ctx { color:#171717; }
    .g-word-text ruby.ctx rt { color:#d9381e; font-size:.5em; font-weight:600; font-family:'Segoe UI Symbol','Segoe UI',sans-serif; opacity:.85; letter-spacing:.02em; }
    /* Silent grapheme — show dot */
    .g-word-text ruby.silent { color:#171717; }
    .g-word-text ruby.silent rt { color:#9ca3af; font-size:.55em; }
    .g-word-actions { display:flex; gap:.25rem; flex-shrink:0; }
    .g-word-btn { background:white; border:1px solid #e5e7eb; padding:0; width:1.55rem; height:1.55rem; border-radius:50%; cursor:pointer; font-size:.65rem; display:inline-flex; align-items:center; justify-content:center; }
    .g-word-tts:hover { border-color:#171717; color:#171717; background:#fff7c2; }
    .g-word-practice:hover { border-color:#d9381e; color:#d9381e; background:#ffffff; }

    .reverse-mount { padding:2rem 0; }
    .reverse-start { max-width:520px; margin:2rem auto 0; text-align:center; padding:2rem 1.6rem; }
    .reverse-icon { font-size:3rem; margin-bottom:.5rem; }
    .reverse-start h2 { font-size:1.3rem; font-weight:800; color:#171717; margin:.4rem 0 .7rem; }
    .reverse-start p { font-size:.9rem; color:#6b7280; line-height:1.6; margin-bottom:1.4rem; }
    .primary-pill { background:#d9381e; color:white; border:none; padding:.7rem 1.6rem; border-radius:9999px; font-weight:700; cursor:pointer; font-family:inherit; font-size:.95rem; }
    .primary-pill:hover { background:#4a0cd4; }

    .reverse-progress-bar { max-width:520px; margin:0 auto .35rem; height:.4rem; background:#e5e7eb; border-radius:9999px; overflow:hidden; }
    .reverse-progress-bar > span { display:block; height:100%; background:#d9381e; transition:width .3s; }
    .reverse-progress-label { text-align:center; font-size:.78rem; color:#6b7280; margin-bottom:.7rem; }

    .reverse-card { max-width:520px; margin:.5rem auto 0; background:white; border:1px solid #e5e7eb; border-radius:.9rem; padding:1.6rem 1.8rem; box-shadow:0 4px 18px rgba(0,0,0,.05); text-align:center; }
    .reverse-card .reverse-prompt { font-size:.85rem; color:#6b7280; margin-bottom:.7rem; }
    .reverse-card h2 { font-size:2.4rem; font-weight:800; color:#171717; margin:.4rem 0 1.4rem; letter-spacing:.02em; display:inline-flex; align-items:center; gap:.6rem; }
    .reverse-card h2 mark { background:#fde68a; color:#92400e; padding:.05em .25em; border-radius:.3rem; }
    .reverse-tts { background:white; border:2px solid #171717; color:#171717; border-radius:50%; width:2.2rem; height:2.2rem; cursor:pointer; font-size:.8rem; }
    .reverse-tts:hover { background:#fff7c2; }
    .choice-row { display:grid; grid-template-columns:repeat(2,1fr); gap:.55rem; margin:1rem 0; }
    .choice-row button { padding:.8rem .9rem; background:white; border:1.5px solid #e5e7eb; border-radius:.55rem; font-size:1rem; font-weight:600; color:#171717; cursor:pointer; font-family:'Segoe UI Symbol','Lexend',sans-serif; transition:border-color .15s, background .15s; }
    .choice-row button:hover:not(:disabled) { border-color:#d9381e; background:#ffffff; color:#d9381e; }
    .choice-row button:disabled { cursor:default; }
    .choice-row button.correct { border-color:var(--ink); background:#fffbe6; color:var(--ink); }
    .choice-row button.wrong { border-color:var(--red); background:#ffffff; color:var(--red); }
    .choice-row button.dim { opacity:.4; }
    .reverse-feedback { font-size:.88rem; padding:.7rem .9rem; border-radius:.5rem; margin:.6rem 0 0; }
    .reverse-feedback.ok { background:#fffbe6; color:var(--ink); }
    .reverse-feedback.no { background:#ffffff; color:var(--red); }

    .reverse-results .reverse-score { font-size:3.5rem; font-weight:900; line-height:1; margin:.3rem 0 .2rem; }
    .reverse-results .reverse-score-pct { font-size:.95rem; font-weight:700; margin-bottom:1rem; }
    .reverse-review { text-align:left; margin-top:1rem; }
    .reverse-review summary { cursor:pointer; color:#d9381e; font-weight:600; padding:.4rem 0; font-size:.88rem; }
    .reverse-review-row { display:flex; align-items:center; gap:.5rem; padding:.4rem .6rem; border-radius:.4rem; margin:.2rem 0; font-size:.85rem; }
    .reverse-review-row.ok { background:#ffffff; }
    .reverse-review-row.no { background:#fef2f2; }
    .rev-num { color:#9ca3af; font-weight:600; min-width:1.5rem; }
    .rev-word { font-weight:700; color:#171717; }
    .rev-word mark { background:#fde68a; color:#92400e; padding:0 .15em; border-radius:.2rem; }
    .rev-arrow { color:#9ca3af; }
    .rev-ipa { color:#0d9488; font-family:'Segoe UI Symbol','Segoe UI',sans-serif; font-weight:600; }
    .rev-bad { color:var(--red); font-size:.78rem; font-style:italic; margin-left:.4rem; }
    .rev-say { margin-left:auto; background:white; border:1.5px solid #171717; color:#171717; border-radius:50%; width:1.6rem; height:1.6rem; cursor:pointer; font-size:.65rem; }
    .rev-say:hover { background:#fff7c2; }
  `;
  document.head.appendChild(s);
})();

const root = document.querySelector("#pronunRoot");
// Phonics group definitions. Each lesson is [phonemeId, soundLabel, "grapheme1, grapheme2,..."]
// phonemeId is URL-safe slug. soundLabel may contain multiple IPA values.
const groups = [
  ["Part 1 \u2014 Long Vowels", [
    ["long-e",  "/i\u02D0/",                   "e, ee, y, ea, ie, ei, ey"],
    ["long-a",  "/e\u026A/",                   "a, ai, ay, eigh, ea"],
    ["long-i",  "/a\u026A/",                   "i, y, igh, ie"],
    ["long-o",  "/o\u028A/",                   "o, oa, ow, oe"],
    ["long-u",  "/u\u02D0/ /ju\u02D0/",        "u, oo, ew, ue"],
  ]],
  ["Part 2 \u2014 Short Vowels", [
    ["short-i", "/\u026A/",                    "i, y"],
    ["short-e", "/\u025B/",                    "e, ea"],
    ["short-a", "/\u00E6/",                    "a"],
    ["short-u", "/\u028C/",                    "u, o, ou"],
    ["short-oo","/\u028A/",                    "oo, u"],
    ["short-o", "/\u0252/",                    "o, a"],
  ]],
  ["Part 3 \u2014 Diphthongs, R-controlled, Traps & Schwa", [
    ["diph-ow", "/a\u028A/",                              "ow, ou"],
    ["diph-oi", "/\u0254\u026A/",                         "oi, oy"],
    ["broad-aw","/\u0254\u02D0/",                         "aw, au, or"],
    ["r-er",    "/\u025C\u02D0r/",                        "er, ir, ur"],
    ["r-or",    "/\u0254\u02D0r/",                        "or, ore"],
    ["r-care",  "/e\u0259r/",                             "air, are"],
    ["r-here",  "/\u026A\u0259r/",                        "ear, eer"],
    ["r-ar",    "/\u0251\u02D0r/",                        "ar, ear"],
    ["r-fire",  "/a\u026A\u0259r/ /j\u028A\u0259r/",      "ire, ure"],
    ["schwa",   "/\u0259/",                               "a, e, o"],
    ["k-trap",  "/k/",                                    "c, k, ck, ch"],
    ["sh-zh",   "/\u0283/ /\u0292/",                      "sh, s, ti, si"],
    ["ch-j",    "/t\u0283/ /d\u0292/",                    "ch, tch, j, ge"],
    ["f-s",     "/f/ /s/",                                "f, ph, s, c"],
  ]],
];
// Ambiguous graphemes — letters that map to MULTIPLE IPA values.
// Used to generate the reverse drill: given a word + highlighted grapheme,
// the learner picks the correct sound. The 4 candidate sounds are drawn from
// all possible IPAs of that grapheme across the dictionary.
const AMBIGUOUS_GRAPHEMES = [
  "a","e","i","o","u","y",          // single vowels (very ambiguous)
  "ea","ee","ie","ei","ey","ou","ow","oo","ai","ay","ie","ue","ew",
  "c","g","s","ch","th","gh","ph","sh"
];
let active = "grapheme";              // default tab is now Grapheme (Dan tab removed)
let phonemeSelected = null;
// Reverse test session state
const REVERSE_TEST_LEN = 10;
let reverseTest = null;               // { questions: [...], idx, correct, finished }

function render() {
  const sub = {
    grapheme: "Nguyên âm tiếng Anh có nhiều cách viết khác nhau cho cùng 1 âm. 26 bài chia 3 nhóm.",
    reverse: "Cùng 1 cách viết (vd 'ea') có thể đọc nhiều âm tuỳ ngữ cảnh. Làm mini test 10 câu — từ và grapheme chọn ngẫu nhiên từ thư viện.",
  };
  root.innerHTML = `
    <div class="pronun-header">
      <div>
        <h1>Khoá phát âm</h1>
        <p>${sub[active] || sub.grapheme}</p>
      </div>
    </div>
    <div class="pronun-tabs">
      <button class="${active === "grapheme" ? "active" : ""}" data-tab="grapheme">Theo Grapheme</button>
      <button class="${active === "reverse" ? "active" : ""}" data-tab="reverse">🔄 Luyện ngược (Mini test)</button>
    </div>
    <section class="pronun-panel">${active === "grapheme" ? graphemeTab() : reverseTab()}</section>`;
  root.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { active = b.dataset.tab; render(); }));
  root.querySelectorAll("[data-say]").forEach((b) => b.addEventListener("click", () => speak(b.dataset.say)));
}


// Pre-compute phoneme→grapheme→words map from LuyenDoc 20K dict.
// Cached so we only walk the dictionary once.
let PHONEME_INDEX = null;
async function buildPhonemeIndex() {
  if (PHONEME_INDEX) return PHONEME_INDEX;
  if (typeof window.lnDictReady !== "function") { PHONEME_INDEX = {}; return PHONEME_INDEX; }
  const dict = await window.lnDictReady();
  const idx = {}; // { "iː": { "ea": ["sea","beach",...], "ee": [...] }, ... }
  if (!dict || typeof dict.forEach !== "function") { PHONEME_INDEX = idx; return idx; }
  dict.forEach((entry, word) => {
    if (!Array.isArray(entry.graph2I)) return;
    for (const g of entry.graph2I) {
      const rawIpa = g.ipa || "";
      const grapheme = (g.grapheme || "").toLowerCase();
      if (!rawIpa || !grapheme) continue;
      // Normalize: store under both original IPA and colon-normalized variant
      // (dict mixes ASCII ":" and Unicode "\u02D0" for the length mark)
      const variants = new Set([rawIpa, rawIpa.replace(/:/g, "\u02D0"), rawIpa.replace(/\u02D0/g, ":")]);
      for (const ipa of variants) {
        if (!idx[ipa]) idx[ipa] = {};
        if (!idx[ipa][grapheme]) idx[ipa][grapheme] = [];
        idx[ipa][grapheme].push(word);
      }
    }
  });
  PHONEME_INDEX = idx;
  return idx;
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Smart-IPA render for a word inside the phonics card.
// Shows IPA above EVERY grapheme. The TARGET grapheme is rendered in teal
// (highlight), others in muted purple — so user sees full phonetic breakdown
// but the focus grapheme still stands out.
function renderSmartWord(word, targetGrapheme, targetIpa) {
  const entry = typeof window.lnLookupDict === "function" ? window.lnLookupDict(word) : null;
  if (!entry?.graph2I) return escapeHtml(word);
  let pos = 0;
  const out = [];
  for (const g of entry.graph2I) {
    const gLen = (g.grapheme || "").length;
    if (gLen === 0) continue;
    const slice = word.slice(pos, pos + gLen);
    const isTarget = (g.grapheme || "").toLowerCase() === targetGrapheme && g.ipa === targetIpa;
    const ipa = g.ipa || "";
    if (ipa) {
      out.push(`<ruby class="${isTarget ? "hit" : "ctx"}">${escapeHtml(slice)}<rt>${escapeHtml(ipa)}</rt></ruby>`);
    } else {
      // Silent grapheme — mark with a small dot above
      out.push(`<ruby class="silent">${escapeHtml(slice)}<rt>·</rt></ruby>`);
    }
    pos += gLen;
  }
  if (pos < word.length) out.push(escapeHtml(word.slice(pos)));
  return out.join("");
}

// Render Theo Grapheme tab — either summary LIST (default) or DETAIL view of one phoneme.
function graphemeTab() {
  if (phonemeSelected) {
    return graphemeDetailView(phonemeSelected);
  }
  return graphemeListView();
}

// LIST view: 26 lessons grouped by Part, just summary stats — no words.
function graphemeListView() {
  setTimeout(async () => {
    const idx = await buildPhonemeIndex();
    const host = root.querySelector(".phonics-host");
    if (!host) return;
    host.innerHTML = groups.map(([groupName, lessons]) => {
      const items = lessons.map(([phonemeId, sound, graphemes], i) => {
        const ipaList = sound.replace(/\//g, "").trim().split(/\s+/);
        const graphemeList = graphemes.split(/,\s*/).map((g) => g.trim()).filter(Boolean);
        const totalWords = ipaList.reduce((sum, ip) =>
          sum + Object.values(idx[ip] || {}).reduce((s2, ws) => s2 + ws.length, 0), 0);
        const num = i + 1;
        return `
          <a class="g-list-item" href="#" data-phoneme="${phonemeId}">
            <span class="g-list-num">${num}.</span>
            <span class="g-list-sound">${escapeHtml(sound)}</span>
            <span class="g-list-meta">
              <span class="g-list-tag">1 sound</span>
              <span class="g-list-tag">${graphemeList.length} graphemes</span>
              <span class="g-list-tag">${totalWords} từ</span>
            </span>
            <span class="g-list-arrow">→</span>
          </a>`;
      }).join("");
      return `<section class="phonics-group"><h2>${escapeHtml(groupName)}</h2><div class="g-list">${items}</div></section>`;
    }).join("");
    host.querySelectorAll("[data-phoneme]").forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault();
      phonemeSelected = a.dataset.phoneme;
      window.scrollTo({ top: 0, behavior: "smooth" });
      render();
    }));
  }, 0);
  return `
    <div class="g-list-header">
      <strong>Sound → Phonogram</strong>
      <small>26 bài học · click vào âm để xem chi tiết các cách viết và luyện phát âm từng từ.</small>
    </div>
    <div class="phonics-host"><div style="text-align:center;color:#9ca3af;padding:2rem;">⏳ Đang tải từ điển 20K từ…</div></div>`;
}

// DETAIL view: full grapheme breakdown for one phoneme, with click-to-practice words.
function graphemeDetailView(phonemeId) {
  setTimeout(async () => {
    const idx = await buildPhonemeIndex();
    const host = root.querySelector(".phonics-host");
    if (!host) return;
    // Find phoneme spec
    let spec = null, groupLabel = "";
    for (const [g, lessons] of groups) {
      const found = lessons.find(([id]) => id === phonemeId);
      if (found) { spec = found; groupLabel = g; break; }
    }
    if (!spec) { host.innerHTML = "<p>Không tìm thấy bài học.</p>"; return; }
    const [pid, sound, graphemesStr] = spec;
    const ipaList = sound.replace(/\//g, "").trim().split(/\s+/);
    const graphemeList = graphemesStr.split(/,\s*/).map((g) => g.trim()).filter(Boolean);
    let totalAll = 0;
    const graphemeBlocks = graphemeList.map((g) => {
      let words = [];
      for (const ip of ipaList) words = words.concat(idx[ip]?.[g] || []);
      words = [...new Set(words)];
      totalAll += words.length;
      // Split into common (top 15) + intermediate (next 30)
      return { grapheme: g, ipa: ipaList[0], common: words.slice(0, 15), intermediate: words.slice(15, 45) };
    });
    host.innerHTML = `
      <div class="g-detail-head">
        <a class="g-back" href="#" id="gBack">← Tất cả bài</a>
        <h2><span class="g-detail-sound">${escapeHtml(sound)}</span> <span class="g-detail-group">${escapeHtml(groupLabel)}</span></h2>
        <p class="g-detail-stats"><b>1 sound</b> với <b>${graphemeList.length} cách viết</b> và <b>${totalAll} từ ví dụ</b>. Click 🎤 ở từ bất kỳ để ghi âm + chấm điểm.</p>
      </div>
      <aside class="g-toc">
        <strong>Trong trang này</strong>
        ${graphemeBlocks.map((b, i) => `<a href="#g-section-${i}" data-toc="${i}"><b>${escapeHtml(b.grapheme)}</b><small>${escapeHtml(b.ipa || "")}</small></a>`).join("")}
      </aside>
      <div class="g-body">
        ${graphemeBlocks.map((b, i) => `
          <details class="g-section" id="g-section-${i}" ${i === 0 ? "open" : ""}>
            <summary class="g-section-head">
              <span class="g-caret">▸</span>
              <span class="g-section-badge"><b>${escapeHtml(b.grapheme)}</b><small>${escapeHtml(b.ipa || "")}</small></span>
              <span class="g-section-meta">${b.common.length + b.intermediate.length} từ</span>
            </summary>
            <div class="g-section-content">
              <details class="g-subsec" open>
                <summary class="g-subsec-head"><span class="g-caret">▸</span><span class="g-section-sub">COMMON WORDS · ${b.common.length}</span></summary>
                <div class="g-words-grid">
                  ${b.common.length === 0 ? `<i style="color:#9ca3af;">— chưa có từ —</i>` :
                    b.common.map((w) => wordCard(w, b.grapheme, b.ipa)).join("")}
                </div>
              </details>
              ${b.intermediate.length ? `
                <details class="g-subsec">
                  <summary class="g-subsec-head"><span class="g-caret">▸</span><span class="g-section-sub">INTERMEDIATE · ${b.intermediate.length}</span></summary>
                  <div class="g-words-grid">
                    ${b.intermediate.map((w) => wordCard(w, b.grapheme, b.ipa)).join("")}
                  </div>
                </details>` : ""}
            </div>
          </details>`).join("")}
      </div>`;
    // Back button
    host.querySelector("#gBack").addEventListener("click", (e) => { e.preventDefault(); phonemeSelected = null; render(); });
    // Word card clicks → TTS or practice
    host.querySelectorAll("[data-say]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); speak(b.dataset.say); }));
    host.querySelectorAll("[data-practice]").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      const word = b.dataset.practice;
      if (typeof window.openWordPracticeModal === "function") window.openWordPracticeModal(word, "");
      else alert("Word practice popup chưa load.");
    }));
  }, 0);
  return `<div class="phonics-host"><div style="text-align:center;color:#9ca3af;padding:2rem;">⏳ Đang chuẩn bị…</div></div>`;
}

function wordCard(word, grapheme, ipa) {
  return `
    <div class="g-word-card" data-practice="${escapeHtml(word)}" title="Click để luyện phát âm + chấm điểm">
      <div class="g-word-text">${renderSmartWord(word, grapheme, ipa)}</div>
      <button class="g-word-btn g-word-tts" data-say="${escapeHtml(word)}" title="Nghe TTS">▶</button>
    </div>`;
}

// Build a mini test: pick N random words containing ambiguous graphemes.
// Each question = { word, grapheme, correctIpa, choices[] }
async function generateReverseTest() {
  const idx = await buildPhonemeIndex();
  if (!idx || Object.keys(idx).length === 0) return null;
  // For each ambiguous grapheme, gather the list of (ipa, words[]) it can be.
  const graphemeToIpas = {};
  for (const ipa of Object.keys(idx)) {
    for (const g of Object.keys(idx[ipa])) {
      if (!AMBIGUOUS_GRAPHEMES.includes(g)) continue;
      if (!graphemeToIpas[g]) graphemeToIpas[g] = {};
      graphemeToIpas[g][ipa] = idx[ipa][g];
    }
  }
  // Keep only graphemes with ≥ 2 different IPAs (otherwise no ambiguity)
  const candidates = Object.entries(graphemeToIpas).filter(([, ipas]) => Object.keys(ipas).length >= 2);
  if (candidates.length === 0) return null;
  const questions = [];
  const used = new Set();
  let attempts = 0;
  while (questions.length < REVERSE_TEST_LEN && attempts < 200) {
    attempts++;
    const [grapheme, ipas] = candidates[Math.floor(Math.random() * candidates.length)];
    const ipaList = Object.keys(ipas);
    const correctIpa = ipaList[Math.floor(Math.random() * ipaList.length)];
    const wordPool = ipas[correctIpa];
    if (!wordPool || wordPool.length === 0) continue;
    // Prefer reasonably common-length words (3-9 letters)
    const goodPool = wordPool.filter((w) => w.length >= 3 && w.length <= 10);
    const word = (goodPool.length ? goodPool : wordPool)[Math.floor(Math.random() * (goodPool.length || wordPool.length))];
    if (used.has(word)) continue;
    used.add(word);
    // Build distractor IPAs from other possible sounds of this grapheme + a couple of common vowel sounds
    const others = ipaList.filter((x) => x !== correctIpa);
    let distractors = [...others];
    // Top up with generic vowel/consonant sounds if too few
    const filler = ["iː", "ɪ", "ɛ", "æ", "ʌ", "ə", "eɪ", "aɪ", "k", "s"];
    for (const f of filler) {
      if (distractors.length >= 3) break;
      if (f !== correctIpa && !distractors.includes(f)) distractors.push(f);
    }
    distractors = distractors.slice(0, 3);
    const choices = [...distractors, correctIpa].sort(() => Math.random() - 0.5);
    questions.push({ word, grapheme, correctIpa, choices });
  }
  return { questions, idx: 0, correct: 0, finished: false, answered: [] };
}

function reverseTab() {
  if (!reverseTest) {
    // Show start screen
    setTimeout(async () => {
      // Auto-start if dict ready; otherwise wait for click
      const host = root.querySelector(".reverse-mount");
      if (!host) return;
      host.innerHTML = `
        <div class="reverse-start">
          <div class="reverse-icon">🔄</div>
          <h2>Mini test: Đoán âm theo cách viết</h2>
          <p>10 câu trắc nghiệm. Mỗi câu một từ ngẫu nhiên với 1 grapheme được highlight. Bạn chọn xem nó đọc thành âm nào.</p>
          <button id="reverseStart" class="primary-pill">Bắt đầu mini test (10 câu)</button>
        </div>`;
      host.querySelector("#reverseStart").addEventListener("click", async () => {
        host.innerHTML = `<div style="text-align:center;color:#9ca3af;padding:2rem;">⏳ Đang chuẩn bị câu hỏi…</div>`;
        reverseTest = await generateReverseTest();
        if (!reverseTest) { host.innerHTML = `<div style="text-align:center;color:var(--red);padding:2rem;">Không tạo được test. Reload thử lại.</div>`; return; }
        render();
      });
    }, 0);
    return `<div class="reverse-mount"></div>`;
  }

  if (reverseTest.finished) {
    return reverseResults();
  }

  const q = reverseTest.questions[reverseTest.idx];
  const total = reverseTest.questions.length;
  const progressPct = ((reverseTest.idx + 1) / total) * 100;
  const last = reverseTest.answered[reverseTest.idx];

  setTimeout(() => {
    root.querySelectorAll("[data-rchoice]").forEach((b) => b.addEventListener("click", () => answerReverse(b.dataset.rchoice)));
    root.querySelector("#reverseNext")?.addEventListener("click", () => {
      reverseTest.idx++;
      if (reverseTest.idx >= reverseTest.questions.length) reverseTest.finished = true;
      render();
    });
    root.querySelector("#reverseExit")?.addEventListener("click", () => {
      if (confirm("Thoát test? Tiến trình sẽ mất.")) { reverseTest = null; render(); }
    });
    root.querySelector("#reverseTtsBig")?.addEventListener("click", () => speak(q.word));
  }, 0);

  const wordHtml = renderWordHighlight(q.word, q.grapheme);

  return `
    <div class="reverse-progress-bar"><span style="width:${progressPct}%"></span></div>
    <div class="reverse-progress-label">Câu ${reverseTest.idx + 1}/${total} · Điểm tạm: ${reverseTest.correct}/${reverseTest.idx + (last ? 1 : 0)}</div>
    <article class="reverse-card">
      <div class="reverse-prompt">Trong từ này, <b>${escapeHtml(q.grapheme)}</b> đọc thành âm gì?</div>
      <h2>
        ${wordHtml}
        <button id="reverseTtsBig" class="reverse-tts" title="Nghe">▶</button>
      </h2>
      <div class="choice-row">
        ${q.choices.map((c) => {
          let cls = "";
          if (last) {
            if (c === q.correctIpa) cls = "correct";
            else if (c === last.choice) cls = "wrong";
            else cls = "dim";
          }
          return `<button class="${cls}" data-rchoice="${escapeHtml(c)}" ${last ? "disabled" : ""}>/${escapeHtml(c)}/</button>`;
        }).join("")}
      </div>
      ${last ? `
        <div class="reverse-feedback ${last.correct ? "ok" : "no"}">
          ${last.correct ? "✓ Đúng!" : "✗ Sai."} Đáp án: <b>/${escapeHtml(q.correctIpa)}/</b>.
        </div>
        <div style="text-align:center;margin-top:.8rem;">
          <button id="reverseNext" class="primary-pill">${reverseTest.idx + 1 >= total ? "Xem kết quả →" : "Câu tiếp →"}</button>
        </div>` : ""}
      <div style="text-align:center;margin-top:.6rem;">
        <button id="reverseExit" style="background:none;border:none;color:#9ca3af;font-size:.78rem;cursor:pointer;text-decoration:underline;">Thoát test</button>
      </div>
    </article>`;
}

function renderWordHighlight(word, grapheme) {
  // Find FIRST occurrence of grapheme in word (case-insensitive), wrap in <mark>
  const lower = word.toLowerCase();
  const idx = lower.indexOf(grapheme.toLowerCase());
  if (idx < 0) return escapeHtml(word);
  return `${escapeHtml(word.slice(0, idx))}<mark>${escapeHtml(word.slice(idx, idx + grapheme.length))}</mark>${escapeHtml(word.slice(idx + grapheme.length))}`;
}

function answerReverse(choice) {
  const q = reverseTest.questions[reverseTest.idx];
  const correct = choice === q.correctIpa;
  if (correct) reverseTest.correct++;
  reverseTest.answered[reverseTest.idx] = { choice, correct };
  render();
}

function reverseResults() {
  const total = reverseTest.questions.length;
  const pct = Math.round((reverseTest.correct / total) * 100);
  const color = pct >= 80 ? "var(--ink)" : pct >= 60 ? "#d9381e" : pct >= 40 ? "var(--ink)" : "var(--red)";
  const label = pct >= 80 ? "Xuất sắc!" : pct >= 60 ? "Khá tốt." : pct >= 40 ? "Cần luyện thêm." : "Hãy ôn lại quy tắc grapheme.";
  setTimeout(() => {
    root.querySelector("#reverseRetry")?.addEventListener("click", async () => {
      reverseTest = null;
      render();
    });
    root.querySelectorAll("[data-say]").forEach((b) => b.addEventListener("click", () => speak(b.dataset.say)));
  }, 0);
  return `
    <article class="reverse-card reverse-results">
      <span>KẾT QUẢ MINI TEST</span>
      <div class="reverse-score" style="color:${color};">${reverseTest.correct}/${total}</div>
      <div class="reverse-score-pct" style="color:${color};">${pct}% · ${label}</div>
      <details class="reverse-review">
        <summary>Xem chi tiết ${total} câu</summary>
        ${reverseTest.questions.map((q, i) => {
          const a = reverseTest.answered[i];
          return `
            <div class="reverse-review-row ${a?.correct ? "ok" : "no"}">
              <span class="rev-num">${i + 1}.</span>
              <span class="rev-word">${renderWordHighlight(q.word, q.grapheme)}</span>
              <span class="rev-arrow">→</span>
              <span class="rev-ipa">/${escapeHtml(q.correctIpa)}/</span>
              ${a && !a.correct ? `<span class="rev-bad">bạn chọn /${escapeHtml(a.choice)}/</span>` : ""}
              <button class="rev-say" data-say="${escapeHtml(q.word)}" title="Nghe">▶</button>
            </div>`;
        }).join("")}
      </details>
      <div style="display:flex;gap:.5rem;justify-content:center;margin-top:1.2rem;">
        <button id="reverseRetry" class="primary-pill">Làm test khác</button>
      </div>
    </article>`;
}

function speak(text) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  speechSynthesis.speak(u);
}

render();


