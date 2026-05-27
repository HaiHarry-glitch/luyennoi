// Inject reading-specific CSS once (the page no longer loads /styles.css because
// it's wrapped in the Luyennoi home.html shell).
(function injectReadingCss() {
  if (document.getElementById("ln-reading-css")) return;
  const css = document.createElement("style");
  css.id = "ln-reading-css";
  css.textContent = `
    #readingRoot { font-family: Lexend, sans-serif; max-width: 1080px; margin: 0 auto; }
    .reading-hero { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; margin-bottom:1.4rem; flex-wrap:wrap; }
    .reading-hero h1 { font-size:1.6rem; font-weight:700; color:#171717; margin:0 0 .35rem; }
    .reading-hero p { font-size:.88rem; color:#6b7280; max-width:580px; margin:0; line-height:1.55; }
    .reading-filter { display:flex; gap:.4rem; flex-wrap:wrap; }
    .reading-filter button { background:white; border:1.5px solid #e5e7eb; color:#4b5563; padding:.35rem 1rem; border-radius:9999px; font-size:.82rem; cursor:pointer; font-family:inherit; font-weight:500; min-height:40px; }
    .reading-filter button.active { background:#d9381e; color:white; border-color:#d9381e; }
    .reading-filter button:hover { border-color:#d9381e; color:#d9381e; }
    .reading-filter button.active:hover { color:white; }

    .reading-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:.9rem; }
    .reading-card { display:flex; gap:.8rem; padding:.9rem; background:white; border:1px solid #e5e7eb; border-radius:.8rem; text-decoration:none; color:inherit; transition:border-color .15s, box-shadow .15s; }
    .reading-card:hover { border-color:var(--ink); box-shadow:0 2px 12px rgba(217,56,30,.16); }
    .reading-thumb { width:56px; height:56px; border-radius:.55rem; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-weight:800; font-size:1.6rem; user-select:none; }
    .reading-thumb { background:#171717; color:#FFD700; }
    .reading-thumb.reading-1 { background:#d9381e; color:white; }
    .reading-thumb.reading-2 { background:#FFD700; color:#171717; }
    .reading-thumb.reading-3 { background:#171717; color:#FFD700; }
    .reading-thumb.reading-4 { background:#d9381e; color:#FFD700; }
    .reading-thumb.reading-5 { background:#FFD700; color:#d9381e; }
    .reading-thumb.reading-6 { background:#171717; color:white; }
    .reading-card h2 { font-size:.94rem; font-weight:600; color:#171717; margin:0 0 .25rem; line-height:1.4; }
    .reading-card p { font-size:.75rem; color:#9ca3af; margin:0 0 .35rem; }
    .tag-row { display:flex; gap:.3rem; flex-wrap:wrap; }
    .tag-row span { background:#f3f4f6; color:#4b5563; font-size:.7rem; padding:.1rem .5rem; border-radius:9999px; }
    .reading-card.custom { position:relative; border-color:var(--ink); background:linear-gradient(135deg,#ffffff 0%,#ffffff 100%); }
    .reading-card .del-custom { position:absolute; top:.4rem; right:.4rem; background:transparent; border:none; color:#9ca3af; cursor:pointer; font-size:.85rem; padding:.2rem .4rem; border-radius:.3rem; z-index:2; }
    .reading-card .del-custom:hover { background:#ffffff; color:var(--red); }
    .custom-badge { display:inline-block; background:#ffffff; color:#d9381e; font-size:.6rem; padding:.05rem .35rem; border-radius:9999px; font-weight:600; margin-left:.3rem; vertical-align:middle; }

    /* Detail page */
    .reader-header { margin-bottom:1rem; }
    .back-link { color:#d9381e; font-size:.85rem; text-decoration:none; font-weight:600; min-height:36px; display:inline-flex; align-items:center; }
    .back-link:hover { text-decoration:underline; }
    .reader-header h1 { font-size:1.4rem; font-weight:700; color:#171717; margin:.4rem 0 .25rem; }
    .reader-header > div + p, .reader-header div p { font-size:.78rem; color:#6b7280; margin:0; }
    .reader-actions { display:flex; gap:.5rem; margin-top:.7rem; flex-wrap:wrap; }
    .outline-action { background:white; border:1.5px solid #d9381e; color:#d9381e; padding:.45rem 1rem; border-radius:9999px; font-size:.82rem; font-weight:600; cursor:pointer; font-family:inherit; min-height:42px; }
    .outline-action:hover { background:#ffffff; }
    .primary-pill { background:#d9381e; color:white; border:none; padding:.45rem 1.2rem; border-radius:9999px; font-size:.82rem; font-weight:600; cursor:pointer; font-family:inherit; min-height:42px; }
    .primary-pill:hover { background:#4a0cd4; }
    .reader-progress { background:#e5e7eb; height:.4rem; border-radius:9999px; overflow:hidden; margin:.7rem 0 1.2rem; }
    .reader-progress > span { display:block; height:100%; background:#d9381e; transition:width .3s; }
    .reader-layout { display:grid; grid-template-columns:minmax(0,2fr) minmax(0,1fr); gap:1.2rem; align-items:start; }
    @media (max-width:880px) { .reader-layout { grid-template-columns: 1fr; } }
    .reader-main { display:flex; flex-direction:column; gap:1rem; }
    .reader-paragraph { background:white; border:1px solid #e5e7eb; border-radius:.7rem; padding:.9rem 1rem; }
    .paragraph-toolbar { display:flex; gap:.5rem; margin-bottom:.6rem; }
    .round-play { background:white; border:1.5px solid #171717; color:#171717; border-radius:50%; width:2.5rem; height:2.5rem; cursor:pointer; font-size:.7rem; }
    .round-play:hover { background:#fff7c2; }
    .reader-text { font-size:1.2rem; line-height:1.9; color:#171717; margin:0; word-spacing:.1em; }
    .reader-text.with-ipa { line-height:2.9; }
    .word-token { background:transparent; border:none; padding:0 .15rem; cursor:pointer; font:inherit; color:inherit; display:inline; vertical-align:baseline; }
    .word-token:hover { background:#ffffff; border-radius:.25rem; }
    /* Smart IPA — native <ruby> for clean stacking above letters */
    ruby.g-tricky { color:#0d9488; ruby-align:center; ruby-position:over; }
    ruby.g-tricky rt {
      color:#0d9488; font-size:.55em; font-weight:600; line-height:1.2;
      font-family:'Segoe UI Symbol','Segoe UI',sans-serif;
      letter-spacing:.02em; margin-bottom:.15em;
    }
    /* Intonation overlays */
    .tone-rise { background:rgba(59,130,246,.18); border-radius:.25rem; }
    .tone-fall { background:rgba(220,38,38,.18); border-radius:.25rem; }
    .tone-rise-strong { background:rgba(59,130,246,.35); border-radius:.25rem; }
    .tone-fall-strong { background:rgba(220,38,38,.35); border-radius:.25rem; }
    .intonation-legend { display:flex; gap:1rem; font-size:.75rem; color:#6b7280; align-items:center; margin-top:.3rem; flex-wrap:wrap; }
    .intonation-legend span { display:inline-flex; align-items:center; gap:.3rem; }
    .legend-box { width:14px; height:14px; border-radius:2px; display:inline-block; }

    /* Chunking overlays */
    .chunk-group {
      display:inline;
      border-bottom:3px solid #6366f1;
      padding-bottom:2px;
      background:rgba(99,102,241,.06);
      border-radius:3px 3px 0 0;
    }
    .chunk-group .word-token { padding:0 .1rem; }
    .chunk-gap { display:inline-block; width:.6rem; }
    .chunking-legend { display:flex; gap:1rem; font-size:.75rem; color:#6b7280; align-items:center; margin-top:.3rem; }
    .chunking-legend .legend-chunk { display:inline-block; border-bottom:3px solid #6366f1; padding:0 .4rem .1rem; background:rgba(99,102,241,.06); border-radius:3px 3px 0 0; font-size:.8rem; }

    .score-slot { margin-top:.6rem; }
    .score-slot:not(:empty) { background:#ffffff; padding:.6rem .8rem; border-radius:.5rem; }
    .score-slot strong { font-size:1.4rem; font-weight:800; color:#d9381e; display:block; }
    .score-slot p { font-size:.84rem; color:#171717; margin:.2rem 0; }
    .score-slot small { font-size:.74rem; color:#92400e; background:#fef3c7; padding:.15rem .5rem; border-radius:.3rem; }

    .reader-side { background:white; border:1px solid #e5e7eb; border-radius:.7rem; padding:.9rem; display:flex; flex-direction:column; gap:.7rem; position:sticky; top:1rem; }
    .reading-history strong { font-size:.78rem; color:#6b7280; font-weight:700; letter-spacing:.05em; }
    .reading-history { display:flex; flex-direction:column; gap:.3rem; }
    .reading-history span { background:#f3f4f6; padding:.25rem .6rem; border-radius:.35rem; font-size:.76rem; color:#171717; }

    .word-popup { position:fixed; background:white; border:1px solid #e5e7eb; border-radius:.6rem; box-shadow:0 8px 32px rgba(0,0,0,.18); padding:.7rem .9rem; z-index:9999; min-width:240px; max-width:340px; }
    .word-popup strong { font-size:1.05rem; color:#171717; }
    .word-popup span { color:#d9381e; font-size:.84rem; margin-left:.4rem; }
    .word-popup p { font-size:.84rem; color:#4b5563; margin:.45rem 0; line-height:1.55; }
    .word-popup button { background:#d9381e; color:white; border:none; padding:.4rem .8rem; border-radius:9999px; font-size:.74rem; font-weight:600; cursor:pointer; font-family:inherit; margin-right:.3rem; min-height:38px; }
    .word-popup button:last-child { background:#FFD700; }
    @media (max-width:640px) {
      #readingRoot { max-width:100%; }
      .reader-text { font-size:1.08rem; line-height:2.15; word-spacing:.02em; }
      .word-token { min-width:1.75rem; min-height:2rem; display:inline-flex; align-items:center; justify-content:center; margin:.02rem 0; border-radius:.22rem; }
      .reader-actions, .paragraph-toolbar { gap:.55rem; }
      .reader-actions > *, .paragraph-toolbar > * { flex:1 1 150px; }
      .word-popup { left:12px!important; right:12px!important; max-width:none; width:auto; }
    }
  `;
  document.head.appendChild(css);
})();

const root = document.querySelector("#readingRoot");
const state = {
  stories: [],
  vocab: new Map(),
  ipaOn: false,
  intonationOn: false,
  chunkingOn: false,
  intonationData: {},   // { paragraphIdx: [{word, tone},...] }
  chunkingData: {},     // { paragraphIdx: [[word,...], ...] }
  activeLevel: "all",
  activeTopic: "all",
  visibleCount: 30,
  recorder: null,
  chunks: [],
};

const clean = (value) => String(value || "").trim();
const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const wordKey = (value) => clean(value).toLowerCase().replace(/^[^a-z']+|[^a-z']+$/gi, "");
const getKey = () => localStorage.getItem("luyennoi.geminiKey") || localStorage.getItem("geminiApiKey") || "";
const getModel = () => localStorage.getItem("luyennoi.geminiModel") || "gemini-3-flash-preview";
const historyKey = (slug) => `ln.readingHistory:${slug}`;

function speak(text) {
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.92;
  speechSynthesis.speak(utterance);
}

function savePhrase(entry) {
  try {
    const current = JSON.parse(localStorage.getItem("ln.savedPhrases") || "[]");
    const next = [{ ...entry, savedAt: new Date().toISOString() }, ...current.filter((x) => wordKey(x.term) !== wordKey(entry.term))].slice(0, 300);
    localStorage.setItem("ln.savedPhrases", JSON.stringify(next));
  } catch {}
}

function lookup(word) {
  return state.vocab.get(wordKey(word)) || { word, ipa: "", vi: "" };
}

async function transcribeWord(word) {
  const known = lookup(word);
  if (known.ipa) return known.ipa;
  if (window.lnTranscribe) {
    const res = await window.lnTranscribe(word);
    // window.lnTranscribe returns {ipa, perWord, source} — extract .ipa string
    return (res && typeof res === "object") ? (res.ipa || "") : String(res || "");
  }
  return "";
}

async function blobToBase64(blob) {
  const reader = new FileReader();
  return await new Promise((resolve, reject) => {
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function loadCustomStories() {
  try {
    const data = JSON.parse(localStorage.getItem("ln.customStories") || "[]");
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}
function saveCustomStory(story) {
  const list = loadCustomStories();
  list.unshift(story);
  try {
    localStorage.setItem("ln.customStories", JSON.stringify(list.slice(0, 50)));
  } catch (e) {
    alert("Không lưu được: dung lượng trình duyệt đã đầy. Hãy xóa bớt văn bản cũ.");
  }
}
function deleteCustomStory(slug) {
  const list = loadCustomStories().filter((s) => s.slug !== slug);
  try { localStorage.setItem("ln.customStories", JSON.stringify(list)); } catch {}
}

function topicIcon(story) {
  const topicMap = {
    "Travel and Tourism": "\u2708\uFE0F",
    "Food and Cooking": "\u{1F372}",
    "Technology and Innovation": "\u{1F4BB}",
    "Health and Fitness": "\u{1F3CB}\uFE0F",
    "Environment and Sustainability": "\u{1F33F}",
    "Business and Entrepreneurship": "\u{1F4BC}",
    "Education and Learning": "\u{1F393}",
    "Arts and Culture": "\u{1F3AD}",
    "Sports and Recreation": "\u26BD",
    "Family and Relationships": "\u{1F46A}",
    "Housing and Real Estate": "\u{1F3E0}",
    "Fashion and Style": "\u{1F457}",
    "Science and Discovery": "\u{1F52C}",
    "Politics and Society": "\u{1F3DB}\uFE0F",
    "Entertainment and Media": "\u{1F3AC}",
    "Finance and Economics": "\u{1F4B0}",
    "Transportation and Mobility": "\u{1F697}",
    "History and Heritage": "\u{1F3F0}",
    "Psychology and Mental Health": "\u{1F9E0}",
    "Language and Communication": "\u{1F4AC}",
  };
  return topicMap[story.topic] || "\u{1F4D6}";
}

function renderList() {
  const allStories = [...loadCustomStories(), ...state.stories];
  const levels = ["all", "custom", ...new Set(state.stories.map((s) => s.level))];
  const topics = ["all", ...new Set(state.stories.map((s) => s.topic))];
  let stories;
  if (state.activeLevel === "all") stories = allStories;
  else if (state.activeLevel === "custom") stories = loadCustomStories();
  else stories = state.stories.filter((s) => s.level === state.activeLevel);
  if (state.activeTopic !== "all") stories = stories.filter((s) => s.topic === state.activeTopic);
  const total = stories.length;
  const visible = stories.slice(0, state.visibleCount);
  const hasMore = total > state.visibleCount;
  root.innerHTML = `
    <section class="reading-hero">
      <div>
        <h1>Luyện đọc</h1>
        <p>Luyện ĐỌC TO TIẾNG ANH chuẩn IPA. Phù hợp build foundation phát âm trước khi vào Speaking.</p>
      </div>
      <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">
        <button class="primary-pill" id="addCustomText">➕ Thêm văn bản</button>
        <div class="reading-filter">
          ${levels.map((level) => `<button class="${state.activeLevel === level ? "active" : ""}" data-level="${level}">${level === "all" ? "Tất cả" : level === "custom" ? "Của tôi" : level}</button>`).join("")}
        </div>
      </div>
    </section>
    <div class="reading-filter" style="margin-bottom:.7rem;flex-wrap:wrap;">
      ${topics.map((t) => `<button class="${state.activeTopic === t ? "active" : ""}" data-topic="${esc(t)}">${t === "all" ? "Mọi chủ đề" : esc(t)}</button>`).join("")}
    </div>
    <p style="font-size:.78rem;color:#6b7280;margin-bottom:.5rem;">${total} bài</p>
    <section class="reading-grid">
      ${visible.map((story) => `
        <a class="reading-card${story.custom ? " custom" : ""}" href="/reading/${encodeURIComponent(story.slug)}">
          ${story.custom ? `<button class="del-custom" data-del="${esc(story.slug)}" title="Xoá">✕</button>` : ""}
          <div class="reading-thumb ${esc(story.thumbnail || "reading-1")}">${topicIcon(story)}</div>
          <div>
            <h2>${esc(story.title)}${story.custom ? ' <span class="custom-badge">Của tôi</span>' : ""}</h2>
            <p>${Number(story.wordCount) || 0} từ · ${Number(story.minutes) || 0} phút · ${esc(story.level)}</p>
            <div class="tag-row">${(story.tags || []).map((tag) => `<span>${esc(tag)}</span>`).join("")}</div>
          </div>
        </a>
      `).join("")}
    </section>
    ${hasMore ? `<div style="text-align:center;margin:1rem 0;"><button class="outline-action" id="showMore">Xem thêm (${total - state.visibleCount} bài còn lại)</button></div>` : ""}`;
  root.querySelectorAll("[data-level]").forEach((button) => {
    button.addEventListener("click", () => { state.activeLevel = button.dataset.level; state.visibleCount = 30; renderList(); });
  });
  root.querySelectorAll("[data-topic]").forEach((button) => {
    button.addEventListener("click", () => { state.activeTopic = button.dataset.topic; state.visibleCount = 30; renderList(); });
  });
  root.querySelector("#addCustomText").addEventListener("click", openAddTextModal);
  const showMoreBtn = root.querySelector("#showMore");
  if (showMoreBtn) showMoreBtn.addEventListener("click", () => { state.visibleCount += 30; renderList(); });
  root.querySelectorAll(".del-custom").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      if (confirm("Xoá văn bản này?")) { deleteCustomStory(btn.dataset.del); renderList(); }
    });
  });
}

function openAddTextModal() {
  const existing = document.getElementById("ln-add-text-modal");
  if (existing) existing.remove();
  const ov = document.createElement("div");
  ov.id = "ln-add-text-modal";
  ov.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:Lexend,sans-serif;padding:1rem;";
  ov.innerHTML = `
    <div style="background:white;border-radius:1rem;max-width:640px;width:100%;padding:1.4rem 1.6rem;box-shadow:0 12px 48px rgba(0,0,0,.25);max-height:90vh;overflow-y:auto;">
      <div style="font-size:.72rem;color:#9ca3af;font-weight:700;letter-spacing:.05em;">THÊM VĂN BẢN TỰ TẠO</div>
      <h2 style="font-size:1.2rem;font-weight:700;color:#171717;margin:.2rem 0 .8rem;">Tạo văn bản luyện đọc của riêng bạn</h2>
      <label style="display:block;font-size:.84rem;font-weight:600;color:#374151;margin-bottom:.3rem;">Tiêu đề</label>
      <input id="addTitle" type="text" placeholder="VD: Bài đọc ôn tập tuần này"
        style="width:100%;padding:.55rem .8rem;border:1.5px solid #e5e7eb;border-radius:.5rem;font-size:.92rem;outline:none;box-sizing:border-box;font-family:inherit;margin-bottom:.7rem;" />
      <label style="display:block;font-size:.84rem;font-weight:600;color:#374151;margin-bottom:.3rem;">Văn bản (mỗi đoạn cách nhau bằng dòng trống)</label>
      <textarea id="addContent" rows="10" placeholder="Dán hoặc nhập văn bản tiếng Anh ở đây.&#10;&#10;Mỗi đoạn cách nhau bằng 1 dòng trống."
        style="width:100%;padding:.6rem .8rem;border:1.5px solid #e5e7eb;border-radius:.5rem;font-size:.9rem;outline:none;box-sizing:border-box;font-family:'Lexend',sans-serif;resize:vertical;line-height:1.6;"></textarea>
      <div style="display:flex;gap:.5rem;justify-content:space-between;margin-top:1rem;">
        <button class="outline-action" id="cancelAdd">Huỷ</button>
        <button class="primary-pill" id="saveAdd">Lưu vào thư viện</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const title = ov.querySelector("#addTitle");
  title.focus();
  ov.addEventListener("click", (e) => { if (e.target === ov) ov.remove(); });
  ov.querySelector("#cancelAdd").addEventListener("click", () => ov.remove());
  ov.querySelector("#saveAdd").addEventListener("click", () => {
    const t = (title.value || "").trim();
    const c = (ov.querySelector("#addContent").value || "").trim();
    if (!t || !c) { alert("Cần nhập cả tiêu đề và văn bản."); return; }
    const paragraphs = c.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
    if (!paragraphs.length) { alert("Văn bản trống."); return; }
    const slug = "custom-" + Date.now() + "-" + t.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    const wordCount = paragraphs.join(" ").split(/\s+/).length;
    const minutes = Math.max(1, Math.round(wordCount / 110));
    saveCustomStory({
      id: slug, slug, title: t, topic: "Custom", level: "Custom",
      wordCount, minutes, paragraphs,
      tags: ["my-text"], thumbnail: "reading-" + ((Math.abs(slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % 6) + 1),
      custom: true,
    });
    ov.remove();
    renderList();
  });
}

function history(slug) {
  try {
    const data = JSON.parse(localStorage.getItem(historyKey(slug)) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function renderHistory(story) {
  const items = history(story.slug);
  return `
    <div class="reading-history">
      <strong>Lịch sử paragraph</strong>
      ${items.length ? items.map((x) => `<span>P${Number(x.index) + 1}: ${esc(x.band || x.score || "?")}</span>`).join("") : "<span>Chưa luyện</span>"}
    </div>`;
}

// SMART IPA heuristic — show IPA above grapheme ONLY when it's tricky for
// Vietnamese learners. Skips obvious mappings like "l"→/l/, "m"→/m/...
function isTrickyGrapheme(grapheme, ipa) {
  if (!grapheme) return false;
  const g = grapheme.toLowerCase();
  const i = String(ipa || "");
  // Silent letter — always mark (with cross or strike)
  if (!i.trim()) return true;
  // Multi-letter grapheme (digraph/trigraph) — almost always tricky for VN
  if (g.length >= 2) return true;
  // Vowels — English has many sounds per letter, always tricky
  if (/^[aeiouy]$/i.test(g)) return true;
  // Mismatch consonants (s→z, c→s, g→dʒ, x→ks/z…)
  if (g !== i.toLowerCase() && i.length <= 3) {
    const trickyMaps = { s: ["z"], c: ["s", "k"], g: ["dʒ"], x: ["ks", "gz", "z"], y: ["j", "i", "ɪ", "aɪ"] };
    if (trickyMaps[g]?.includes(i)) return true;
  }
  // VN learners often miss these sounds
  const vnHard = ["ð", "θ", "ʃ", "ʒ", "tʃ", "dʒ", "ŋ", "ʌ", "æ", "ə", "ɜ"];
  if (vnHard.some((t) => i.includes(t))) return true;
  return false;
}

// Render one word with grapheme-level Smart IPA overlay using <ruby><rt>.
// Native ruby annotation is the cleanest way to stack IPA above letters
// without overlapping line content.
function renderWordSmart(originalToken, ipaOn) {
  const m = originalToken.match(/^([^A-Za-z']*)([A-Za-z'-]+)([^A-Za-z']*)$/);
  if (!m) return escapeIpa(originalToken);
  const [, lead, core, tail] = m;
  const entry = typeof window.lnLookupDict === "function" ? window.lnLookupDict(core) : null;
  if (!entry || !Array.isArray(entry.graph2I)) return escapeIpa(originalToken);
  let pos = 0;
  const out = [];
  for (const g of entry.graph2I) {
    const gLen = (g.grapheme || "").length;
    if (gLen === 0) continue;
    const slice = core.slice(pos, pos + gLen);
    const tricky = ipaOn && isTrickyGrapheme(g.grapheme, g.ipa);
    if (tricky && g.ipa) {
      // <ruby> base + <rt> annotation — browser places rt above the base, no overlap
      out.push(`<ruby class="g-tricky">${escapeIpa(slice)}<rt>${escapeIpa(g.ipa)}</rt></ruby>`);
    } else {
      out.push(escapeIpa(slice));
    }
    pos += gLen;
  }
  if (pos < core.length) out.push(escapeIpa(core.slice(pos)));
  return `${escapeIpa(lead)}${out.join("")}${escapeIpa(tail)}`;
}

function escapeIpa(s) {
  return String(s || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
}

function renderParagraph(story, paragraph, index) {
  const tokens = paragraph.split(/(\s+)/);
  const intonation = state.intonationOn ? (state.intonationData[index] || []) : [];
  const chunks = state.chunkingOn ? (state.chunkingData[index] || []) : [];

  // Build a map: wordIndex -> tone class
  const toneMap = {};
  if (intonation.length) {
    intonation.forEach((item, i) => {
      if (item.tone === "rise") toneMap[i] = "tone-rise";
      else if (item.tone === "rise-strong") toneMap[i] = "tone-rise-strong";
      else if (item.tone === "fall") toneMap[i] = "tone-fall";
      else if (item.tone === "fall-strong") toneMap[i] = "tone-fall-strong";
    });
  }

  // Build chunk lookup: wordIndex -> {chunkId, isLast}
  const chunkMap = {};
  if (chunks.length) {
    let wi = 0;
    chunks.forEach((chunk, ci) => {
      chunk.forEach((w, j) => {
        chunkMap[wi] = { chunkId: ci, isLast: j === chunk.length - 1 };
        wi++;
      });
    });
  }

  // Render tokens; if chunking is on, wrap each chunk group in a span
  let wordIdx = 0;
  let rendered = "";
  let inChunkGroup = false;
  let lastChunkId = -1;

  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      // For chunking: skip raw spaces inside a chunk group, add a single space instead
      if (inChunkGroup) rendered += " ";
      else rendered += token;
      continue;
    }
    const bare = wordKey(token);
    if (!bare) { rendered += escapeIpa(token); continue; }
    const wi = wordIdx++;
    const toneCls = toneMap[wi] || "";
    const chunkInfo = chunkMap[wi];

    if (chunks.length && chunkInfo) {
      // Starting a new chunk group?
      if (chunkInfo.chunkId !== lastChunkId) {
        if (inChunkGroup) rendered += `</span><span class="chunk-gap"></span>`;
        rendered += `<span class="chunk-group">`;
        inChunkGroup = true;
        lastChunkId = chunkInfo.chunkId;
      }
      rendered += `<button class="word-token ${toneCls}" data-word="${bare}">${renderWordSmart(token, state.ipaOn)}</button>`;
      if (chunkInfo.isLast) {
        rendered += `</span><span class="chunk-gap"></span>`;
        inChunkGroup = false;
      }
    } else {
      if (inChunkGroup) { rendered += `</span>`; inChunkGroup = false; }
      rendered += `<button class="word-token ${toneCls}" data-word="${bare}">${renderWordSmart(token, state.ipaOn)}</button>`;
    }
  }
  if (inChunkGroup) rendered += `</span>`;

  return `
    <article class="reader-paragraph" data-paragraph="${index}">
      <div class="paragraph-toolbar">
        <button class="round-play" data-speak="${index}" title="Nghe paragraph">\u25B6</button>
        <button class="outline-action" data-record="${index}">Ghi âm đọc paragraph</button>
      </div>
      <p class="reader-text ${state.ipaOn ? "with-ipa" : ""}">
        ${rendered}
      </p>
      <div class="score-slot" data-score="${index}"></div>
    </article>`;
}


async function fetchIntonation(paragraph) {
  const words = paragraph.split(/\s+/).filter(Boolean);
  try {
    const res = await fetch("/api/gemini/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: getKey(),
        model: getModel(),
        kind: "intonation",
        topic: paragraph,
        note: `Analyze the intonation pattern of this English paragraph for a Vietnamese learner.
For EACH word in order, classify its intonation as one of: "rise", "rise-strong", "fall", "fall-strong", "neutral".
Rules:
- Content words at the END of yes/no questions = "rise-strong"
- Words before commas in lists = "rise"
- Last content word in declarative sentences = "fall-strong"
- Stressed content words mid-sentence = "fall"
- Function words (the, a, is, was, in, on, to, etc.) = "neutral"
- Words at clause boundaries before conjunctions = "rise"
Return ONLY a JSON array of objects: [{"word":"...","tone":"..."},...] with exactly ${words.length} items, one per word in order.`
      })
    });
    const data = await res.json();
    // Try to parse the response - it may be in data.html or data itself
    let result = null;
    if (Array.isArray(data)) result = data;
    else if (Array.isArray(data.data)) result = data.data;
    else if (data.html) {
      try { result = JSON.parse(data.html); } catch {}
    }
    if (!result) {
      for (const v of Object.values(data)) {
        if (typeof v === "string" && v.includes("[")) {
          try { result = JSON.parse(v); break; } catch {}
          const m = v.match(/\[\s*\{[\s\S]*\}\s*\]/);
          if (m) { try { result = JSON.parse(m[0]); break; } catch {} }
        }
      }
    }
    if (Array.isArray(result) && result.length > 0) return result;
  } catch (e) { console.warn("fetchIntonation error", e); }
  // Fallback: rule-based heuristic
  return heuristicIntonation(paragraph);
}

function heuristicIntonation(paragraph) {
  const words = paragraph.split(/\s+/).filter(Boolean);
  // Function words: unstressed, no pitch movement
  const func = new Set(["the","a","an","is","am","are","was","were","be","been","being",
    "in","on","at","to","for","of","with","by","from","up","about","into","through",
    "and","but","or","so","yet","nor","if","that","which","who","whom",
    "i","he","she","it","we","they","me","him","her","us","them","my","his","its","our","their",
    "do","does","did","has","have","had","will","would","can","could","shall","should","may","might",
    "this","that","these","those","there","here","just","also","too","not","no"]);
  // Negatives and emphasis words always get stress
  const emphatic = new Set(["not","never","always","very","really","extremely","absolutely","amazing",
    "terrible","wonderful","beautiful","important","interesting","fantastic","incredible","lovely"]);

  const result = [];
  // Split into sentences by end punctuation
  let sStart = 0;
  for (let i = 0; i <= words.length; i++) {
    const atEnd = i === words.length;
    const endsPunct = !atEnd && /[.!?]["'\u201D\u2019)*]*$/.test(words[i]);
    if (!atEnd && !endsPunct) continue;
    const sent = words.slice(sStart, atEnd ? i : i + 1);
    if (!sent.length) { sStart = i + 1; continue; }
    const lastW = sent[sent.length - 1];
    const isQ = /\?/.test(lastW);
    // Find last content word index in this sentence (nuclear stress target)
    let lastContentIdx = -1;
    for (let j = sent.length - 1; j >= 0; j--) {
      const c = sent[j].replace(/[^a-zA-Z']/g, "").toLowerCase();
      if (!func.has(c) && c.length > 0) { lastContentIdx = j; break; }
    }
    // Find second-to-last content word (for contrast/emphasis detection)
    let prevContentIdx = -1;
    for (let j = lastContentIdx - 1; j >= 0; j--) {
      const c = sent[j].replace(/[^a-zA-Z']/g, "").toLowerCase();
      if (!func.has(c) && c.length > 0) { prevContentIdx = j; break; }
    }
    for (let j = 0; j < sent.length; j++) {
      const sw = sent[j];
      const clean = sw.replace(/[^a-zA-Z']/g, "").toLowerCase();
      const isFunc = func.has(clean);
      const beforeComma = /,$/.test(sw);
      const beforeSemicolon = /[;:]$/.test(sw);
      const isEmphatic = emphatic.has(clean);
      // Nuclear stress: last content word
      if (j === lastContentIdx) {
        result.push({ word: sw, tone: isQ ? "rise-strong" : "fall-strong" });
      }
      // Emphatic/negative words always stressed
      else if (isEmphatic) {
        result.push({ word: sw, tone: "fall" });
      }
      // Content word before comma → rise (continuing intonation)
      else if (beforeComma && !isFunc) {
        result.push({ word: sw, tone: "rise" });
      }
      // Before semicolon → fall
      else if (beforeSemicolon && !isFunc) {
        result.push({ word: sw, tone: "fall" });
      }
      // Second-to-last content word often gets mild stress
      else if (j === prevContentIdx && !isFunc) {
        result.push({ word: sw, tone: "fall" });
      }
      // Function words → neutral
      else if (isFunc) {
        result.push({ word: sw, tone: "neutral" });
      }
      // Other content words → neutral (unstressed in this position)
      else {
        result.push({ word: sw, tone: "neutral" });
      }
    }
    sStart = i + 1;
  }
  return result;
}

async function fetchChunking(paragraph) {
  const words = paragraph.split(/\s+/).filter(Boolean);
  try {
    const res = await fetch("/api/gemini/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: getKey(),
        model: getModel(),
        kind: "chunking",
        topic: paragraph,
        note: `Break this English paragraph into natural spoken chunks for a Vietnamese learner practicing reading aloud.
Each chunk is a group of 2-5 words that should be read together in one breath without pausing.
Chunk boundaries typically occur at:
- Before/after conjunctions (and, but, or, so)
- Before prepositions starting a new phrase
- Between subject and verb phrases
- After commas, semicolons
- Between clauses
Return ONLY a JSON array of arrays: [["word1","word2"],["word3","word4","word5"],...].
Every word from the original text must appear exactly once. Preserve original word order.
The paragraph has ${words.length} words total.`
      })
    });
    const data = await res.json();
    let result = null;
    if (Array.isArray(data) && Array.isArray(data[0])) result = data;
    else if (Array.isArray(data.data) && Array.isArray(data.data[0])) result = data.data;
    else if (data.html) {
      try { result = JSON.parse(data.html); } catch {}
    }
    if (!result) {
      for (const v of Object.values(data)) {
        if (typeof v === "string" && v.includes("[[")) {
          try { result = JSON.parse(v); break; } catch {}
          const m = v.match(/\[\s*\[[\s\S]*\]\s*\]/);
          if (m) { try { result = JSON.parse(m[0]); break; } catch {} }
        }
      }
    }
    if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) return result;
  } catch (e) { console.warn("fetchChunking error", e); }
  // Fallback: heuristic chunking
  return heuristicChunking(paragraph);
}

function heuristicChunking(paragraph) {
  const words = paragraph.split(/\s+/).filter(Boolean);
  // Words that START a new breath group (chunk boundary before them)
  const conjBreak = new Set(["and","but","or","so","because","when","while","if","although",
    "however","though","since","unless","until","after","before","yet","nor"]);
  const prepBreak = new Set(["in","on","at","to","for","from","with","by","about","into",
    "through","during","between","among","under","over","near","across","around"]);
  // Words that "glue" to the NEXT word — never end a chunk on these
  const glue = new Set(["the","a","an","my","your","his","her","its","our","their","this",
    "that","these","those","some","any","every","each","no","all","many","few","several",
    // modifiers that need their head noun/adjective
    "very","really","quite","so","too","most","more","less","much","such","rather","pretty"]);
  // Common adjectives — should not be the last word of a forced chunk
  // (they need the next noun to complete the phrase)
  const adjLike = new Set(["small","big","large","old","new","young","good","great","bad",
    "long","short","high","low","first","last","next","best","worst","little","nice",
    "beautiful","amazing","interesting","important","different","other","whole","entire",
    "own","main","major","certain","particular","various","similar","easy","hard","simple"]);
  const chunks = [];
  let cur = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const clean = w.replace(/[^a-zA-Z']/g, "").toLowerCase();
    const prevEndsPunct = i > 0 && /[,;:.!?\u2013\u2014]$/.test(words[i - 1]);

    // 1) Break BEFORE conjunctions (if current chunk is non-trivial)
    if (cur.length >= 2 && conjBreak.has(clean)) {
      chunks.push(cur); cur = [w]; continue;
    }
    // 2) Break BEFORE prepositions starting a new phrase
    if ((cur.length >= 3 || (prevEndsPunct && cur.length >= 1)) && prepBreak.has(clean)) {
      chunks.push(cur); cur = [w]; continue;
    }
    // 3) Break BEFORE relative/wh-clause starters
    if (cur.length >= 2 && /^(which|who|whom|whose|where|that)$/i.test(clean)) {
      chunks.push(cur); cur = [w]; continue;
    }

    // Add word to current chunk
    cur.push(w);

    // 4) Break AFTER sentence-ending punctuation (. ! ?) — always
    if (/[.!?]$/.test(w) && cur.length >= 1) {
      chunks.push(cur); cur = []; continue;
    }
    // 5) Break AFTER comma/semicolon if chunk has 2+ words
    if (/[,;:]$/.test(w) && cur.length >= 2) {
      chunks.push(cur); cur = []; continue;
    }
    // 6) Force break at 4-5 words — but NOT if last word is a glue/adjective word
    if (cur.length >= 4 && !glue.has(clean) && !adjLike.has(clean)) {
      const nextClean = (i + 1 < words.length) ? words[i + 1].replace(/[^a-zA-Z']/g, "").toLowerCase() : "";
      if (!conjBreak.has(nextClean) && !prepBreak.has(nextClean)) {
        chunks.push(cur); cur = [];
      }
    }
    // 7) Hard limit: if chunk >= 6 words, force break regardless
    if (cur.length >= 6) {
      chunks.push(cur); cur = [];
    }
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

function renderDetail(story) {
  const done = new Set(history(story.slug).map((x) => x.index));
  root.innerHTML = `
    <section class="reader-header">
      <a class="back-link" href="/reading">← Luyện đọc</a>
      <div>
        <h1>${esc(story.title)}</h1>
        <p>${esc(story.level)} · ${Number(story.wordCount) || 0} từ · ${Number(story.minutes) || 0} phút · ${esc(story.topic)}</p>
      </div>
      <div class="reader-actions">
        <button class="outline-action" id="speakStory">Nghe cả câu chuyện</button>
        <button class="primary-pill" id="toggleIpa">${state.ipaOn ? "Ẩn IPA" : "Hiện IPA"}</button>
        <button class="${state.intonationOn ? "primary-pill" : "outline-action"}" id="toggleIntonation">${state.intonationOn ? "Ẩn ngữ điệu" : "♪ Ngữ điệu"}</button>
        <button class="${state.chunkingOn ? "primary-pill" : "outline-action"}" id="toggleChunking">${state.chunkingOn ? "Ẩn chunking" : "⛓ Chunking"}</button>
      </div>
      ${state.intonationOn ? `<div class="intonation-legend"><span><span class="legend-box" style="background:rgba(59,130,246,.35)"></span> Đi lên (rise)</span><span><span class="legend-box" style="background:rgba(220,38,38,.35)"></span> Đi xuống (fall)</span></div>` : ""}
      ${state.chunkingOn ? `<div class="chunking-legend"><span class="legend-chunk">cụm từ</span><span>← đọc liền 1 hơi, ngắt ở khoảng trống giữa các cụm</span></div>` : ""}
    </section>
    <div class="reader-progress"><span style="width:${Math.round((done.size / story.paragraphs.length) * 100)}%"></span></div>
    <section class="reader-layout">
      <div class="reader-main">${story.paragraphs.map((p, i) => renderParagraph(story, p, i)).join("")}</div>
      <aside class="reader-side">
        ${renderHistory(story)}
        <button class="primary-pill" id="nextParagraph">Tiếp paragraph</button>
      </aside>
    </section>
    <div id="wordPopup" class="word-popup" hidden></div>`;

  root.querySelector("#speakStory").addEventListener("click", () => speak(story.paragraphs.join(" ")));
  root.querySelector("#toggleIpa").addEventListener("click", () => {
    state.ipaOn = !state.ipaOn;
    renderDetail(story);
    hydrateIpa();
  });
  root.querySelector("#toggleIntonation").addEventListener("click", () => {
    if (state.intonationOn) { state.intonationOn = false; renderDetail(story); return; }
    state.intonationData = {};
    for (let i = 0; i < story.paragraphs.length; i++) {
      state.intonationData[i] = heuristicIntonation(story.paragraphs[i]);
    }
    state.intonationOn = true;
    renderDetail(story);
  });
  root.querySelector("#toggleChunking").addEventListener("click", () => {
    if (state.chunkingOn) { state.chunkingOn = false; renderDetail(story); return; }
    state.chunkingData = {};
    for (let i = 0; i < story.paragraphs.length; i++) {
      state.chunkingData[i] = heuristicChunking(story.paragraphs[i]);
    }
    state.chunkingOn = true;
    renderDetail(story);
  });
  root.querySelector("#nextParagraph").addEventListener("click", () => {
    const first = [...root.querySelectorAll(".reader-paragraph")].find((el) => !done.has(Number(el.dataset.paragraph))) || root.querySelector(".reader-paragraph");
    first?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  root.querySelectorAll("[data-speak]").forEach((button) => button.addEventListener("click", () => speak(story.paragraphs[Number(button.dataset.speak)])));
  root.querySelectorAll("[data-record]").forEach((button) => button.addEventListener("click", () => toggleRecord(story, Number(button.dataset.record), button)));
  root.querySelectorAll("[data-word]").forEach((button) => button.addEventListener("click", (event) => showWordPopup(event, story, button.dataset.word)));
  if (state.ipaOn) hydrateIpa();
}

// hydrateIpa is now a no-op — IPA is rendered synchronously via renderWordSmart
// using the LuyenDoc 20K dict. Kept as stub to avoid breaking existing call sites.
async function hydrateIpa() { /* no-op */ }

document.addEventListener("click", (e) => {
  const popup = document.querySelector("#wordPopup");
  if (popup && !popup.hidden && !popup.contains(e.target) && !e.target.closest("[data-word]")) {
    popup.hidden = true;
  }
});

function showWordPopup(event, story, word) {
  event.stopPropagation();
  const data = lookup(word);
  const popup = root.querySelector("#wordPopup");
  popup.hidden = false;
  popup.style.left = `${Math.min(event.clientX, window.innerWidth - 340)}px`;
  popup.style.top = `${Math.min(event.clientY + 12, window.innerHeight - 220)}px`;
  popup.innerHTML = `
    <strong>${esc(data.word || word)}</strong>
    <span>${esc(data.ipa || "")}</span>
    <p>${esc(data.vi || data.definition || "")||"Chưa có nghĩa tiếng Việt."}</p>
    <button data-practice>Ghi âm từ này</button>
    <button data-save>Lưu vào ôn tập</button>`;
  popup.querySelector("[data-practice]").addEventListener("click", () => location.href = `/alphafeature/pronun?word=${encodeURIComponent(word)}`);
  popup.querySelector("[data-save]").addEventListener("click", () => {
    savePhrase({ term: data.word || word, ipa: data.ipa || "", vi: data.vi || "", source: "reading", slug: story.slug });
    popup.querySelector("[data-save]").textContent = "Đã lưu";
  });
}

async function toggleRecord(story, index, button) {
  if (state.recorder && state.recorder.state === "recording") {
    state.recorder.stop();
    button.textContent = "Đang chấm...";
    return;
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  state.chunks = [];
  state.recorder = new MediaRecorder(stream);
  state.recorder.ondataavailable = (event) => event.data.size && state.chunks.push(event.data);
  state.recorder.onstop = async () => {
    stream.getTracks().forEach((track) => track.stop());
    const blob = new Blob(state.chunks, { type: state.recorder.mimeType || "audio/webm" });
    const audioBase64 = await blobToBase64(blob);
    const res = await fetch("/api/gemini/score-sentence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: getKey(), model: getModel(), sentence: story.paragraphs[index], audioBase64, mimeType: blob.type })
    });
    const data = await res.json();
    const band = data.score === "?" ? "?" : (Number(data.score) / 10).toFixed(1);
    const slot = root.querySelector(`[data-score="${index}"]`);
    slot.innerHTML = `<strong>${esc(band)}</strong><p>${esc(data.verdict || "")}</p><small>${esc(data.tips || "")}</small>`;
    const next = [{ index, band, score: data.score, at: new Date().toISOString(), worstWords: data.worstWords || [] }, ...history(story.slug).filter((x) => x.index !== index)];
    try { localStorage.setItem(historyKey(story.slug), JSON.stringify(next)); } catch {}
    button.textContent = "Ghi âm đọc paragraph";
    renderDetail(story);
  };
  state.recorder.start();
  button.textContent = "Dừng và gửi";
}

async function init() {
  try {
    const [stories, vocab] = await Promise.all([
      fetch("/data/reading-stories.json").then((r) => r.json()),
      fetch("/data/luyendoc-vocab.json").then((r) => r.json()).catch(() => [])
    ]);
    state.stories = stories;
    vocab.forEach((item) => state.vocab.set(wordKey(item.word), item));
  } catch (e) {
    console.error("[reading] init failed:", e);
    root.innerHTML = `<p style="color:#d9381e;padding:2rem;">Không tải được dữ liệu bài đọc. Vui lòng tải lại trang.</p>`;
    return;
  }
  // Wait for the LuyenDoc 20K-word grapheme dictionary to be ready before
  // rendering the story — so the Smart IPA overlay can render in one pass.
  if (typeof window.lnDictReady === "function") {
    try { await window.lnDictReady(); } catch {}
  }
  const slug = location.pathname.replace(/^\/reading\/?/, "");
  if (!slug) return renderList();
  const allStories = [...loadCustomStories(), ...state.stories];
  const story = allStories.find((item) => item.slug === slug) || allStories[0];
  if (!story) return renderList();
  renderDetail(story);
}

init();


