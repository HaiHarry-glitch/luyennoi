const $ = (selector) => document.querySelector(selector);

let qaData = {};

// ── User state ────────────────────────────────────────────────
const US_KEY = "ln.userState";
function getUS() { try { return JSON.parse(localStorage.getItem(US_KEY)) || {}; } catch { return {}; } }
function saveUS(s) { try { localStorage.setItem(US_KEY, JSON.stringify(s)); } catch {} }
function getUserDisplay() {
  const s = getUS();
  return { answered: s.answered || 0, goal: 25, dayStreak: s.dayStreak || 0, band: s.band || 5.0, history: s.history || [] };
}
function addAnswer(question, part, score, transcript) {
  const s = getUS();
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  s.answered = (s.answered || 0) + 1;
  s.band = Math.round(((s.band || 5.0) * (s.answered - 1) + score) / s.answered * 2) / 2;
  s.dayStreak = (s.lastDate === today) ? (s.dayStreak || 1) : (s.lastDate === yesterday) ? (s.dayStreak || 0) + 1 : 1;
  s.lastDate = today;
  s.history = [{ question, part, score, transcript: String(transcript || "").slice(0, 180), date: new Date().toISOString() }, ...(s.history || [])].slice(0, 60);
  if (!s.heatmap) s.heatmap = Array(84).fill(0);
  s.heatmap[s.heatmap.length - 1] = Math.min(4, (s.heatmap[s.heatmap.length - 1] || 0) + 1);
  saveUS(s);
  return s;
}
function refreshHomeStats() {
  const ud = getUserDisplay();
  if ($("#answeredMini")) $("#answeredMini").textContent = ud.answered;
  if ($(".progress-ring")) $(".progress-ring").style.setProperty("--progress", Math.round(Math.min(ud.answered / 25, 1) * 360) + "deg");
  if ($("#dayStreak")) $("#dayStreak").textContent = ud.dayStreak;
  if ($("#band")) $("#band").textContent = Number(ud.band).toFixed(1);
}
// ─────────────────────────────────────────────────────────────

const userQuestions = [
  { text: "describing a phone you want to buy.", part: "PART 2", score: "5.0" },
  { text: "2 What is your favorite app on your phone? Why?", part: "PART 1" }
];

const detailQuestions = [
  { part: "PART 1", question: "Do you wear a watch?" },
  { part: "PART 1", question: "Do you think it is important to wear a watch? Why?" },
  { part: "PART 1", question: "Have you ever got a watch as a gift?" },
  { part: "PART 2", question: "Describe a person who is good at learning and speaking new languages" },
  { part: "PART 2", question: "Describe a person who works in a successful company" },
  { part: "PART 3", question: "What is the most important thing for learning a language well?" }
];

let recordTimer = null;
let recordSeconds = 0;
let apiMap = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordingStream = null;

const GEMINI_MODELS = {
  scoring: "gemini-2.5-pro",
  sample: "gemini-2.5-flash",
  vocab: "gemini-2.5-flash-lite",
  pronun: "gemini-3-flash-preview",
  note: "gemini-3.1-flash-lite-preview",
  quick: "gemini-2.5-flash"
};

function getGeminiKey() {
  return localStorage.getItem("luyennoi.geminiKey") || "";
}

function setGeminiKey(value) {
  const trimmed = value.trim();
  try {
    if (trimmed) localStorage.setItem("luyennoi.geminiKey", trimmed);
    else localStorage.removeItem("luyennoi.geminiKey");
  } catch {}
}

async function getApiMap() {
  if (!apiMap) apiMap = await fetch("/data/api-map.json").then((response) => response.json());
  return apiMap;
}

function iconFor(index) {
  return ["nodes", "clipboard", "book", "swap"][index % 4];
}

function buttonClass(cardIndex, actionIndex) {
  if (actionIndex < 3) return "pill solid";
  return cardIndex === 1 ? "pill outline pink" : "pill outline";
}

function renderFeatureCard(target, data, cardIndex) {
  target.innerHTML = `
    <div class="feature-heading">
      <span class="icon ${cardIndex === 1 ? "clipboard" : "nodes"}"></span>
      <h2>${data.title}</h2>
    </div>
    <p>${data.text}</p>
    <div class="actions">
      ${data.actions.map((action, index) => `<a class="${buttonClass(cardIndex, index)}" href="${action.href}">${action.label} &gt;</a>`).join("")}
    </div>
  `;
}

function renderHeatmap(values) {
  $("#heatmap").innerHTML = values
    .map((value) => `<span class="cell level-${value || 0}"></span>`)
    .join("");
}

function renderMonths(months) {
  $("#months").innerHTML = months.map((month) => `<span>${month}</span>`).join("");
}

function renderTips(tips) {
  $("#tips").innerHTML = tips
    .map((tip) => `
      <article class="tip">
        <h3>${tip.title}</h3>
        <p>${tip.text}</p>
      </article>
    `)
    .join("");
}

function renderSmallFeatures(features) {
  $("#smallFeatures").innerHTML = features
    .map((feature, index) => `
      <a class="small-feature panel" href="${feature.href}">
        <span class="icon ${iconFor(index)}"></span>
        <strong>${feature.label}</strong>
      </a>
    `)
    .join("");
}

function routeHeader(title, subtitle, eyebrow = "Luyện Nói") {
  return `
    <header class="route-header">
      <span>${eyebrow}</span>
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </header>
  `;
}

function qaTabs(active) {
  return `
    <div class="qa-top-tabs">
      <a class="${active === "part1" ? "active" : ""}" href="/question-answer/part1">Luyện Part 1</a>
      <a class="${active === "part2" ? "active" : ""}" href="/question-answer/part2">Luyện Part 2</a>
      <a class="${active === "part3" ? "active" : ""}" href="/question-answer/part3">Luyện Part 3</a>
      <a class="${active === "custom" ? "active" : ""}" href="/question-answer/user-question">Câu Bạn thêm</a>
    </div>
  `;
}

function qaToolbar(showToggle = true) {
  return `
    <div class="qa-toolbar">
      ${showToggle ? `<label data-action="toggle-answered">Ẩn câu đã trả lời <span class="switch"></span></label>` : "<span></span>"}
      <div class="search-box"><input placeholder="Tìm câu hỏi"><span></span></div>
    </div>
  `;
}

function questionHref(partLabel, question) {
  return `/question-answer/${encodeURIComponent(partLabel + "~" + question)}`;
}

function topicSidebar(data, activeTitle, listMode = "questions") {
  const listItems = listMode === "topics"
    ? data.topics.map((topic) => topic.title)
    : data.topics.flatMap((topic) => topic.title === activeTitle ? topic.questions : [topic.title]).slice(0, 48);

  return `
    <aside class="topic-sidebar">
      ${data.topicTabs.length > 1 ? `<div class="topic-tabs">${data.topicTabs.map((tab, index) => `<button class="${index === 0 ? "active" : ""}">${tab}</button>`).join("")}</div>` : `<div class="topic-single">Forecast</div>`}
      <strong>Topic: ${activeTitle}</strong>
      <div class="topic-list">
        ${listItems.map((item, index) => `
          <button class="${index === 0 ? "selected" : ""}">${item}</button>
        `).join("")}
      </div>
    </aside>
  `;
}

function renderPart1() {
  const data = qaData.part1;
  return `
    ${qaTabs("part1")}
    ${qaToolbar()}
    <div class="qa-layout part1-layout">
      ${topicSidebar(data, "Watch", "topics")}
      <section class="topic-content">
        ${data.topics.map((topic, topicIndex) => `
          <article class="topic-block ${topicIndex === 0 ? "focused" : ""}">
            <h2>${topic.title}</h2>
            <div class="qa-card-grid">
              ${topic.questions.map((question) => `
                <a class="qa-question-card" href="${questionHref("PART 1", question)}">${question}</a>
              `).join("")}
            </div>
            <button class="practice-topic"><span>▷</span> Luyện topic này</button>
          </article>
        `).join("")}
      </section>
    </div>
  `;
}

function renderPart2() {
  const data = qaData.part2;
  const tabs = data.topicTabs || ["Person", "Object", "Activity", "Place", "Forecast cũ"];
  return `
    ${qaTabs("part2")}
    ${qaToolbar()}
    <div class="qa-layout wide-topic">
      <aside class="topic-sidebar">
        <div class="topic-tabs">${tabs.map((t, i) => `<button class="${i === 0 ? "active" : ""}" data-tab="${t}">${t}</button>`).join("")}</div>
        <div class="topic-list">
          ${data.topics[0]?.questions.slice(0, 20).map((q, i) => `<button class="${i === 0 ? "selected" : ""}">${q.slice(0, 48)}</button>`).join("")}
        </div>
      </aside>
      <section class="part2-content">
        ${data.topics.map((topic) => `
          <div class="tab-group" data-topic="${topic.title}" style="${topic.title !== (tabs[0] || "Person") ? "display:none" : ""}">
            ${topic.questions.map((question, index) => `
              <a class="large-prompt-card ${index === 0 && topic.title === (tabs[0] || "Person") ? "focused" : ""}" href="${questionHref("PART 2", question)}">${question}</a>
            `).join("")}
          </div>
        `).join("")}
      </section>
    </div>
  `;
}

function renderPart3() {
  const data = qaData.part3;
  const tabs = data.topicTabs || ["Person", "Object", "Activity", "Place"];
  return `
    ${qaTabs("part3")}
    ${qaToolbar()}
    <div class="qa-layout wide-topic">
      <aside class="topic-sidebar">
        <div class="topic-tabs">${tabs.map((t, i) => `<button class="${i === 0 ? "active" : ""}" data-tab="${t}">${t}</button>`).join("")}</div>
        <div class="topic-list">
          ${(data.topics[0]?.questions || []).slice(0, 20).map((q, i) => `<button class="${i === 0 ? "selected" : ""}">${q.slice(0, 48)}</button>`).join("")}
        </div>
      </aside>
      <section class="part3-content">
        ${data.topics.map((topic) => `
          <div class="tab-group" data-topic="${topic.title}" style="${topic.title !== (tabs[0] || "Person") ? "display:none" : ""}">
            <h2><span class="chat-dot">◌</span> ${topic.title}</h2>
            <div class="qa-card-grid">
              ${topic.questions.map(q => `<a class="qa-question-card" href="${questionHref("PART 3", q)}">${q}</a>`).join("")}
            </div>
          </div>
        `).join("")}
      </section>
    </div>
  `;
}

function renderUserQuestions() {
  return `
    ${qaTabs("custom")}
    ${qaToolbar(false)}
    <form class="add-question">
      <input placeholder="Nhập câu hỏi của bạn vào đây...">
      <button>Thêm Câu hỏi</button>
    </form>
    <section class="user-question-grid">
      ${userQuestions.map((item) => `
        <a class="user-question-card" href="${questionHref(item.part, item.text)}">
          <div><h2>${item.text}</h2>${item.score ? `<strong>${item.score}</strong>` : ""}</div>
          <span>${item.part}</span>
        </a>
      `).join("")}
    </section>
  `;
}

function renderHistoryCards() {
  const hist = getUserDisplay().history;
  if (!hist.length) return `<p style="padding:1rem;color:#888">Chưa có lịch sử. Ghi âm câu đầu tiên nhé! 🎙</p>`;
  return hist.slice(0, 6).map(h => `
    <article class="history-card">
      <div class="history-title">
        <span>${Number(h.score || 0).toFixed(1)}</span>
        <b>${h.part}: ${String(h.question || "").slice(0, 55)}</b>
        <a href="${questionHref(h.part, h.question)}">Luyện lại</a>
      </div>
      <button class="play-mini" data-action="play-tts" data-text="${escapeAttr(h.transcript)}">▷</button>
      <p>${String(h.transcript || "").slice(0, 120)}...</p>
      <small>${new Date(h.date).toLocaleDateString("vi-VN")}</small>
    </article>
  `).join("");
}

function renderLeaderboard() {
  const raw = decodeURIComponent(location.pathname.split("~")[1] || "speaking");
  const seed = [...raw].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = (n) => { const x = (seed + n * 9301 + 49297) % 233280; return x / 233280; };
  const names = ["ngoc_h****","minh_t****","thu_n****","linh_p****","anh_v****","dat_k****","hoa_m****","vu_t****","khanh_l****","dung_b****"];
  const answers = [
    "I think it is absolutely fascinating. From my perspective, this topic plays a significant role in our daily lives, especially for younger generations who seek meaningful connections.",
    "Honestly, it depends on the situation. On one hand there are clear benefits, but on the other hand we must also consider the potential drawbacks involved in this matter.",
    "Well, from what I have observed, many Vietnamese people feel strongly about this. I personally believe it shapes our cultural identity and helps us stay grounded in our values.",
    "That is a great question. I would say it is quite important because it allows us to elaborate on our ideas clearly and communicate with confidence in real-life situations.",
    "In my opinion, the key factor here is consistency. People who practice regularly tend to improve much faster than those who only study occasionally without real interaction.",
  ];
  function makeEntry(i, band) {
    return { name: names[(seed + i) % names.length], answer: answers[(seed + i) % answers.length], score: (band + rng(i) * 0.5).toFixed(1), fl: (band + rng(i + 1) * 0.5).toFixed(0), vc: (band - 0.5 + rng(i + 2) * 1).toFixed(0), gr: (band + rng(i + 3) * 0.5).toFixed(0), pr: (band - 0.5 + rng(i + 4) * 1).toFixed(0) };
  }
  function tabHtml(band) {
    return Array.from({ length: 3 }, (_, i) => makeEntry(i + band * 10, band)).map((e, i) => `
      <article class="leader-card">
        <header><b>Top ${i + 1}</b><span>${e.name}</span><button>Theo Dõi</button></header>
        <div><button class="play-mini" data-action="play-tts" data-text="${escapeAttr(e.answer)}">▷</button><p>${e.answer}</p><strong>${e.score}</strong></div>
        <footer><span>Trôi chảy: ${e.fl}</span><span>Từ vựng: ${e.vc}</span><span>Ngữ pháp: ${e.gr}</span><span>Phát âm: ${e.pr}</span></footer>
      </article>`).join("");
  }
  return `
    <div class="leaderboard-tabs">
      ${[6, 7, 8].map(b => `<button class="${b === 7 ? "active" : ""}" onclick="this.closest('.leaderboard-tabs').querySelectorAll('button').forEach(x=>x.classList.remove('active'));this.classList.add('active');this.closest('.ai-output').querySelector('.lb-content').innerHTML=\`${tabHtml(b)}\`"  >Band ${b}</button>`).join("")}
    </div>
    ${vocabHtml([{term:"elaborate on",vi:"trình bày chi tiết"},{term:"from my perspective",vi:"theo quan điểm của tôi"},{term:"it depends on",vi:"tuỳ thuộc vào"},{term:"play a role",vi:"đóng vai trò"},{term:"in comparison",vi:"so với"}],"bảng vàng")}
    <div class="lb-content">${tabHtml(7)}</div>`;
}

function renderQuestionAnswerHome() {
  return `
    <section class="qa-home-real">
      <div class="qa-home-head">
        <div>
          <h1>Luyện theo câu</h1>
          <p>Luyện trả lời câu hỏi bất kỳ, nhận phản hồi, điểm số và hướng dẫn cải thiện tức thì.</p>
        </div>
        <aside class="forecast-card">
          <header><b>Forecast Quý 2-2026</b><a href="#">cập nhật ngày 11/5/2026</a></header>
          ${[
            ["Part 1", getUserDisplay().history.filter(h => h.part === "PART 1").length, (qaData.part1?.topics || []).flatMap(t => t.questions).length || 146],
            ["Part 2", getUserDisplay().history.filter(h => h.part === "PART 2").length, (qaData.part2?.topics || []).flatMap(t => t.questions).length || 88],
            ["Part 3", getUserDisplay().history.filter(h => h.part === "PART 3").length, (qaData.part3?.topics || []).flatMap(t => t.questions).length || 260]
          ].map(([label, done, total]) => `
            <div class="forecast-row"><span>${label}</span><i><em style="width:${Math.max(3, done / total * 100)}%"></em></i><strong>${done}/${total}</strong></div>
          `).join("")}
        </aside>
      </div>
      <nav class="qa-home-actions">
        <a href="/question-answer/part1">Luyện Part 1</a>
        <a href="/question-answer/part2">Luyện Part 2</a>
        <a href="/question-answer/part3">Luyện Part 3</a>
        <a class="pink" href="/question-answer/user-question">Câu Bạn thêm</a>
      </nav>
      <section class="practice-log">
        <header><h2>Lịch sử luyện tập <span>i</span></h2><button data-action="refresh-history">↻</button></header>
        ${renderHistoryCards()}
      </section>
    </section>
  `;
}

function questionPractice(part) {
  if (part === "part1") return renderPart1();
  if (part === "part2") return renderPart2();
  if (part === "part3") return renderPart3();
  return renderUserQuestions();
}

function renderQuestionDetail(path) {
  const raw = decodeURIComponent(path.split("/question-answer/")[1] || "PART 1~Do you wear a watch?");
  const [part = "PART 1", question = "Do you wear a watch?"] = raw.split("~");
  return `
    <div class="record-shell">
      <header class="record-header">
        <a class="record-brand" href="/"><span class="brand-mark"></span><strong>Luyện Nói</strong></a>
      </header>
      <nav class="breadcrumb">
        <a href="/">⌂ Trang chủ</a><span>›</span>
        <a href="/question-answer/part1">⌘ Luyện từng câu</a><span>›</span>
        <a href="/question-answer/${part.includes("2") ? "part2" : part.includes("3") ? "part3" : "part1"}">✎ ${part}</a><span>›</span>
        <strong><span class="play-mini">▷</span> ${question}</strong>
      </nav>
      <main class="record-main">
        <section class="record-stage">
          <p>Nhấn nút <strong>Ghi âm ngay</strong> ở dưới để trả lời câu hỏi</p>
          <div class="record-bottom">
            <span class="round-count">0</span>
            <span class="recording-status"><b></b>Đang ghi âm...</span>
            <span class="record-bars"><i></i><i></i><i></i></span>
            <button class="cancel-record" data-action="cancel-record">Hủy</button>
            <button data-action="record">Ghi âm ngay</button>
          </div>
        </section>
        <aside class="ai-panel">
          <div class="ai-tabs"><button class="active" data-action="ai-help">AI hỗ trợ</button><button data-action="leaderboard">Bảng vàng (51)</button></div>
          <div class="ai-empty"></div>
          <div class="ai-actions">
            <button class="settings-button" data-action="gemini-settings" title="Gemini key">Cai dat Gemini</button>
            <button data-action="sample">Cho mình câu mẫu</button>
            <button data-action="vocab">Từ vựng chủ đề</button>
            <button data-action="note">▱ Ghi chú - tạo câu mẫu</button>
            <button class="debug-api" data-action="api-map">API dang goi</button>
            <div class="pronun-row"><input placeholder="Nhập từ/cụm từ để luyện phát âm"><button data-action="pronun">Luyện phát âm</button></div>
          </div>
          <div class="ai-output" aria-live="polite"></div>
          <footer><button class="arrow" data-action="prev-question">←</button><span><em>Topic</em> ${question}</span><button class="arrow" data-action="next-question">→</button></footer>
        </aside>
      </main>
    </div>
  `;
}

function testPage(part) {
  if (part === "home") {
    return `
      <section class="test-home">
        <div>
          <h1>Thi thử</h1>
          <h2>Làm thử bài test và nhận điểm SPEAKING sát điểm thi thật.</h2>
          <nav>
            <a href="/take-test/part1">Thi PART 1</a>
            <a href="/take-test/part2">Thi PART 2</a>
            <a href="/take-test/part3">Thi PART 3</a>
            <a class="pink" href="/take-test/full-test">FULL TEST</a>
            <a class="dark" href="/take-test/custom-strict">Tùy chọn đề</a>
          </nav>
        </div>
        <p>Chưa có bài thi nào.</p>
      </section>
    `;
  }

  const isFull = part === "full";
  const title = isFull ? "Full Test - Thi thử, nhận điểm và sửa lỗi" : `Test Part ${part.slice(-1)} - Thi thử, nhận điểm và sửa lỗi`;
  return `
    <div class="test-setup-shell">
      <header><a class="record-brand" href="/"><span class="brand-mark"></span><strong>Luyện Nói</strong></a></header>
      <main>
        <section class="test-setup-card">
          <h1>${title}</h1>
          <div class="setup-body">
            <div class="setup-controls">
              <label>Chế độ thi</label>
              <div class="mode-row">
                <span class="switch on" data-action="toggle-mode"></span>
                <div>
                  <strong>${isFull ? "Chill — dễ thở hơn" : "Căng — chuẩn phòng thi"}</strong>
                  <p>${isFull ? "Thời gian thư thái hơn, biết tiến độ trả lời." : "Giới hạn thời gian mỗi câu. Hết giờ là giám khảo ngắt lời để sang câu sau."}</p>
                  ${isFull ? "" : "<small>Tối đa 30 giây mỗi câu.</small>"}
                </div>
              </div>
              <label>Giọng giám khảo</label>
              <select>
                <option>Select a voice</option>
                <option>Heart (Female-American)</option>
                <option>Bella (Female-American)</option>
                <option>Adam (Male-American)</option>
                <option>Echo (Male-American)</option>
                <option>Emma (Female-British)</option>
                <option>Alice (Female-British)</option>
                <option>George (Male-British)</option>
                <option>Daniel (Male-British)</option>
                <option>No Voice</option>
              </select>
              ${isFull ? "" : `
                <label>Số câu hỏi</label>
                <input type="range" min="2" max="9" value="4">
                <div class="range-labels">${[2,3,4,5,6,7,8,9].map((n) => `<span>${n}</span>`).join("")}</div>
                <div class="follow-row"><span class="switch on" data-action="toggle-followups"></span><span>Thêm follow-up questions</span></div>
              `}
            </div>
            <div class="setup-copy">
              <p>✓ Làm quen với cấu trúc bài thi, áp lực như thi thật.</p>
              <p>✓ Nhận đánh giá điểm sát như thi thật.</p>
            </div>
          </div>
          <footer>
            <a href="/take-test/home">Thoát</a>
            <button data-action="start-test">Bắt Đầu</button>
          </footer>
        </section>
      </main>
    </div>
  `;
}

function paymentPage() {
  return `
    ${routeHeader("Mua Xịn", "Mở thêm lượt chấm, thi thử đầy đủ và góp ý chi tiết hơn.", "Thanh toán")}
    <div class="pricing-grid">
      <article class="price-card panel">
        <h2>Miễn phí</h2>
        <strong>0 VNĐ / tháng</strong>
        <p>20 lượt chấm điểm, forecast cập nhật và sửa lỗi cơ bản.</p>
        <button>Đang dùng</button>
      </article>
      <article class="price-card panel featured">
        <h2>Gói Xịn</h2>
        <strong>từ 90.000 VNĐ / tháng</strong>
        <p>Nói mỏi mồm luôn, thi thử như thật, chấm chi tiết 4 tiêu chí.</p>
        <button>Nâng cấp</button>
      </article>
    </div>
  `;
}

function simpleFeature(title, subtitle, items, eyebrow = "Tính năng") {
  return `
    ${routeHeader(title, subtitle, eyebrow)}
    <div class="test-grid">
      ${items.map((item) => `
        <article class="step-card panel">
          <span>${item.icon}</span>
          <h2>${item.title}</h2>
          <p>${item.text}</p>
        </article>
      `).join("")}
    </div>
  `;
}

const routes = {
  "/": "",
  "/question-answer": renderQuestionAnswerHome,
  "/question-answer/": renderQuestionAnswerHome,
  "/question-answer/part1": () => questionPractice("part1"),
  "/question-answer/part2": () => questionPractice("part2"),
  "/question-answer/part3": () => questionPractice("part3"),
  "/question-answer/user-question": () => questionPractice("custom"),
  "/take-test/home": () => testPage("home"),
  "/take-test/part1": () => testPage("part1"),
  "/take-test/part2": () => testPage("part2"),
  "/take-test/part3": () => testPage("part3"),
  "/take-test/full-test": () => testPage("full"),
  "/take-test/custom-strict": () => testPage("custom-strict"),
  "/alphafeature/payment": paymentPage,
  "/alphafeature/set-voice": () => {
    const voices = window.speechSynthesis?.getVoices().filter(v => /^en/i.test(v.lang)) || [];
    const stored = localStorage.getItem("ln.ttsVoice") || "";
    return `
      ${routeHeader("Chỉnh giọng đọc", "Chọn giọng để nghe câu hỏi và câu mẫu.", "Tài khoản")}
      <div class="test-grid" id="voicePicker">
        ${voices.length ? voices.map(v => `
          <article class="step-card panel${v.name === stored ? " selected" : ""}" style="cursor:pointer"
            onclick="localStorage.setItem('ln.ttsVoice','${escapeAttr(v.name)}');document.querySelectorAll('#voicePicker article').forEach(x=>x.classList.remove('selected'));this.classList.add('selected');const u=new SpeechSynthesisUtterance('Hello, this is a test of my voice.');u.lang='${v.lang}';u.rate=0.9;u.voice=window.speechSynthesis.getVoices().find(x=>x.name==='${escapeAttr(v.name)}');window.speechSynthesis.cancel();window.speechSynthesis.speak(u)">
            <span>${escHtml(v.lang)}</span><h2 style="font-size:.8rem;word-break:break-word">${escHtml(v.name)}</h2>
          </article>`).join("") : "<p style='padding:1rem'>Trình duyệt chưa tải giọng. Nhấn F5 thử lại.</p>"}
      </div>`;
  },
  "/alphafeature/setup-mic": () => simpleFeature("Chọn microphone", "Kiểm tra thiết bị ghi âm trước khi vào bài luyện nói.", [
    { icon: "1", title: "Thiết bị", text: "Danh sách microphone và quyền truy cập." },
    { icon: "2", title: "Kiểm âm", text: "Thanh mức âm lượng giúp biết mic đang hoạt động." }
  ], "Tài khoản"),
  "/profile/teaching/landing-page": () => simpleFeature("Luyennoi theo lớp", "Không gian giáo viên theo dõi lớp, giao bài và xem tiến độ học viên.", [
    { icon: "L", title: "Lớp học", text: "Tạo lớp, mời học viên và quản lý danh sách." },
    { icon: "B", title: "Bài giao", text: "Giao Part 1/2/3 hoặc full test cho từng nhóm." },
    { icon: "P", title: "Tiến độ", text: "Theo dõi số câu đã ghi âm và điểm ước lượng." }
  ]),
  "/alphafeature/pronun": () => simpleFeature("Khóa học phát âm", "Các bài phát âm theo âm, cặp âm dễ nhầm và luyện nghe-nói.", [
    { icon: "P", title: "Âm đơn", text: "Luyện từng âm với ví dụ và phản hồi." },
    { icon: "M", title: "Minimal pairs", text: "So sánh các cặp âm gần giống nhau." },
    { icon: "S", title: "Shadowing", text: "Nghe, lặp lại và kiểm tra độ rõ." }
  ]),
  "/alphafeature/vocab": () => simpleFeature("Sổ từ vựng", "Lưu từ hay cho IELTS Speaking và ôn lại theo chủ đề.", [
    { icon: "V", title: "Từ đã lưu", text: "Danh sách từ, nghĩa và ví dụ nói." },
    { icon: "T", title: "Topic", text: "Nhóm từ theo work, study, hometown, travel." }
  ]),
  "/alphafeature/boxing": () => simpleFeature("Luyện S/es", "Bài luyện phát âm đuôi s/es trong câu trả lời tự nhiên.", [
    { icon: "S", title: "Nhận diện", text: "Phân biệt /s/, /z/ và /iz/." },
    { icon: "R", title: "Lặp lại", text: "Ghi âm câu ngắn và xem phản hồi." }
  ]),
  "/alphafeature/join-us": () => simpleFeature("Join us", "Trang tuyển cộng tác viên, giáo viên và người đồng hành cùng Luyện Nói.", [
    { icon: "J", title: "Vị trí mở", text: "Nội dung, giảng dạy, sản phẩm và hỗ trợ học viên." },
    { icon: "C", title: "Liên hệ", text: "Form ứng tuyển và liên kết cộng đồng." }
  ]),
  "/api/logout": () => simpleFeature("Đăng xuất", "Trang mô phỏng hành động đăng xuất trong bản clone cục bộ.", [
    { icon: "✓", title: "Local only", text: "Bản clone không xử lý phiên đăng nhập thật." }
  ], "Tài khoản")
};

function renderRoute(path = location.pathname) {
  const view = $("#routeView");
  const home = $("#homeView");
  const normalized = path.replace(/\/$/, "");
  const isQuestionDetail = normalized.startsWith("/question-answer/") && ![
    "/question-answer",
    "/question-answer/part1",
    "/question-answer/part2",
    "/question-answer/part3",
    "/question-answer/user-question"
  ].includes(normalized);
  const renderer = isQuestionDetail ? () => renderQuestionDetail(path) : routes[path] || routes[normalized];

  document.body.classList.toggle("qa-page", normalized.startsWith("/question-answer") && !isQuestionDetail);
  document.body.classList.toggle("record-page", isQuestionDetail);
  document.body.classList.toggle("test-setup-page", normalized.startsWith("/take-test/") && normalized !== "/take-test/home");

  document.querySelectorAll(".nav-item").forEach((item) => {
    const itemPath = new URL(item.href).pathname;
    item.classList.toggle("active", itemPath === path || (itemPath !== "/" && path.startsWith(itemPath)));
  });

  if (!renderer || path === "/") {
    document.body.classList.remove("qa-page", "record-page", "test-setup-page");
    home.hidden = false;
    view.hidden = true;
    view.innerHTML = "";
    return;
  }

  home.hidden = true;
  view.hidden = false;
  view.innerHTML = renderer();
}

let data = {};
try {
  data = await fetch("/data/site.json").then((response) => response.json());
  qaData = await fetch('/data/questions.json').then(r=>r.json());
} catch (e) { console.error("[app] Failed to load data:", e); }
const ud = getUserDisplay();
const ratio = Math.min(ud.answered / 25, 1);
$("#answeredMini").textContent = ud.answered;
$(".progress-ring").style.setProperty("--progress", `${Math.round(ratio * 360)}deg`);
$("#dayStreak").textContent = ud.dayStreak;
$("#taskTitle").textContent = data.today?.title || "";
$("#taskText").innerHTML = `Ghi âm <strong>${data.today?.target || 0}</strong> câu trả lời nhé :}`;
$("#band").textContent = Number(ud.band).toFixed(1);

renderMonths(data.months);
renderHeatmap(data.heatmap);
renderTips(data.tips);
renderFeatureCard($("#practiceCard"), data.practice, 0);
renderFeatureCard($("#mockCard"), data.mockTest, 1);
renderSmallFeatures(data.features);
renderRoute();

function showToast(text) {
  let toast = $(".app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "app-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.classList.add("show");
  window.clearTimeout(toast.hideTimer);
  toast.hideTimer = window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function showGeminiSettings() {
  const output = $(".ai-output");
  if (!output) return;
  const key = getGeminiKey();
  output.innerHTML = `
    <h3>Cai dat Gemini</h3>
    <p>Key chi luu trong trinh duyet local cua ban. Backend proxy khong ghi key vao file.</p>
    <form class="gemini-settings-form">
      <input type="password" value="${key}" placeholder="Nhap Gemini API key">
      <button>Luu key</button>
    </form>
    <p><b>Map model:</b> Cham diem: ${GEMINI_MODELS.scoring}; Goi y: ${GEMINI_MODELS.sample}; Tu vung: ${GEMINI_MODELS.vocab}; Phat am: ${GEMINI_MODELS.pronun}; Len y tuong: ${GEMINI_MODELS.note}.</p>
  `;
}

function navigateLocal(path) {
  history.pushState(null, "", path);
  renderRoute(path);
}

function getBestVoice() {
  const stored = localStorage.getItem("ln.ttsVoice");
  const voices = window.speechSynthesis?.getVoices() || [];
  if (stored) { const v = voices.find(v => v.name === stored); if (v) return v; }
  return voices.find(v => /en-GB/i.test(v.lang) && /hazel|serena|emily/i.test(v.name))
    || voices.find(v => /en-GB/i.test(v.lang))
    || voices.find(v => /en-US/i.test(v.lang) && /zira|aria|jenny/i.test(v.name))
    || voices.find(v => /en-US/i.test(v.lang))
    || voices.find(v => /^en/.test(v.lang))
    || null;
}
function playText(text, rate = 0.9) {
  const cleanText = String(text || "").trim();
  if (!cleanText || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = "en-GB";
  utterance.rate = rate;
  const voice = getBestVoice();
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

function escapeAttr(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function aiSampleHtml(text, model) {
  return `
    <p class="sample-label">Đây là câu mẫu nhé</p>
    <article class="sample-card">
      <button class="play-mini" data-action="play-tts" data-text="${escapeAttr(text)}">▷</button>
      <p>${escHtml(text)}</p>
      <button data-action="sample">Mở rộng câu</button>
    </article>
    <p class="model-chip">Model: ${model}</p>
  `;
}

function vocabHtml(items, model) {
  return `
    <h3>Từ vựng chủ đề</h3>
    <div class="vocab-chip-grid">
      ${items.map((item) => `
        <button data-action="play-tts" data-text="${escapeAttr(item.term)}"><span class="play-mini">▷</span>${escHtml(item.term)}<em>${escHtml(item.vi)}</em><b data-action="save-vocab">♡</b></button>
      `).join("")}
    </div>
    <p class="model-chip">Model: ${model}</p>
  `;
}

function noteIdeaHtml(model) {
  return `
    <div class="note-maker real-note">
      <textarea placeholder="Nhập ý tưởng để tạo câu mẫu, tiếng Anh/Việt đều được..."></textarea>
      <button data-action="make-note-sample">Tạo câu mẫu</button>
      <small>Ghi chú là lưu :}</small>
    </div>
    <p class="model-chip">Model: ${model}</p>
  `;
}

function renderAiPayload(kind, data, topic, pronunInput = "") {
  const model = data.model || GEMINI_MODELS[kind] || GEMINI_MODELS.quick;
  if (kind === "vocab") {
    return vocabHtml([
      { term: "keep track of time", vi: "theo dõi thời gian" },
      { term: "stylish accessory", vi: "phụ kiện thời trang" },
      { term: "quick glance", vi: "xem nhanh" },
      { term: "remind me of appointments", vi: "nhắc lịch hẹn" },
      { term: "battery lasts a long time", vi: "pin dùng lâu" }
    ], model);
  }
  if (kind === "note") return noteIdeaHtml(model);
  if (kind === "pronun") {
    const phrase = pronunInput || "practice speaking";
    const words = phrase.trim().split(/\s+/).slice(0, 6);
    function approxPhon(w) {
      return "/" + w.toLowerCase().replace(/ph/g,"f").replace(/th(?=[aeiou])/g,"ð").replace(/sh/g,"ʃ").replace(/ch/g,"tʃ").replace(/ng/g,"ŋ").replace(/wh/g,"w").replace(/[aeiou]+/g,m=>({a:"æ",e:"ɛ",i:"ɪ",o:"ɒ",u:"ʌ"}[m[0]]||m[0])).replace(/[^a-zA-Zæɛɪɒʌðʃŋ]/g,"") + "/";
    }
    return `
      <h3>Luyện phát âm</h3>
      <article class="pronun-card">
        <button class="play-mini" data-action="play-tts" data-text="${escapeAttr(phrase)}">▷</button>
        <b>${escHtml(phrase)}</b>
        <p>${words.map(w => escapeAttr(approxPhon(w))).join(" ")}</p>
        <span>Đọc lại từ/cụm từ dưới đây rồi bấm ghi âm.</span>
      </article>
      <p class="model-chip">Model: ${model}</p>
    `;
  }
  const text = data.html
    ? data.html.replace(/<\/?p>/g, "").replace(/<[^>]+>/g, "")
    : "Yes, I wear a watch when I go to school. It helps me keep track of time during classes and breaks. For example, I know when to start my next lesson.";
  return aiSampleHtml(text, model);
}

async function setAiOutput(kind) {
  const output = $(".ai-output");
  if (!output) return;
  const topic = $(".ai-panel footer span")?.textContent?.replace("Topic", "").trim() || "this topic";
  const pronunInput = $(".pronun-row input")?.value.trim();
  output.innerHTML = `<h3>Gemini dang tao...</h3><p>Model: ${GEMINI_MODELS[kind] || GEMINI_MODELS.quick}</p>`;
  try {
    const response = await fetch("/api/gemini/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: getGeminiKey(),
        model: GEMINI_MODELS[kind] || GEMINI_MODELS.quick,
        kind,
        topic: kind === "pronun" && pronunInput ? `${topic}. Pronunciation phrase: ${pronunInput}` : topic
      })
    });
    const data = await response.json();
    output.innerHTML = renderAiPayload(kind, data, topic, pronunInput);
    output.dataset.endpoint = "/api/gemini/assist";
    if (data.warning) showToast(data.warning);
  } catch {
    output.innerHTML = `<h3>Gemini loi ket noi</h3><p>Kiem tra key hoac mang roi bam lai.</p>`;
  }
  return;
  const content = {
    sample: `<h3>Câu mẫu</h3><p>Well, ${topic.toLowerCase()} is something I can talk about naturally. I would give a clear answer first, then add one short reason and a personal example.</p>`,
    vocab: `<h3>Từ vựng chủ đề</h3><ul><li>fluently and accurately</li><li>broaden my knowledge</li><li>stay consistent</li><li>real-life practice</li></ul>`,
    note: `<h3>Ghi chú</h3><textarea placeholder="Viết ý tưởng của bạn ở đây..."></textarea><button data-action="sample">Tạo câu mẫu</button>`,
    pronun: `<h3>Luyện phát âm</h3><p>Nhập một từ/cụm từ, bấm lại để hệ thống giả lập bài luyện phát âm.</p>`
  };
  output.innerHTML = content[kind] || "";
  output.dataset.endpoint = kind === "leaderboard" ? "/api/be/databases" : "/api/oai/chat";
}

function renderScoreResult(score = {}) {
  const stage = $(".record-stage");
  const output = $(".ai-output");
  if (!stage) return;
  const criteria = score.criteria || {};
  const pronun = criteria.pronunciation || {};
  const fluency = criteria.fluency || {};
  const grammar = criteria.grammar || {};
  const vocab = criteria.vocabulary || {};
  stage.classList.add("has-result");
  stage.querySelector(".record-result")?.remove();
  const result = document.createElement("article");
  result.className = "record-result";
  result.innerHTML = `
    <section class="practice-history">
      <strong>Lịch sử luyện tập</strong>
      <span>Đã luyện: <b>1 lần</b></span>
    </section>
    <article class="answer-review-card">
      <div class="answer-line"><span class="play-mini">▷</span><p>${escHtml(score.transcript || "Uh no I have never gotten a watch as a gift in the past.")}</p><strong>${Number(score.overall || 5.5).toFixed(1)}</strong></div>
      <div class="criteria-pills">
        <button data-action="explain-fluency">Trôi chảy: ${Number(fluency.score || 6).toFixed(0)}<small>chi tiết</small></button>
        <button data-action="explain-vocab">Từ vựng: ${Number(vocab.score || 5.5).toFixed(0)}<small>chi tiết</small></button>
        <button data-action="explain-grammar">Ngữ pháp: ${Number(grammar.score || 5.5).toFixed(0)}<small>chi tiết</small></button>
        <button data-action="explain-pronun">Phát âm: ${Number(pronun.score || 5).toFixed(0)}<small>chi tiết</small></button>
      </div>
      <footer><a href="#">Chia sẻ ↗</a><button data-action="sample">Cải thiện câu</button></footer>
    </article>
    <div class="compact-score">
    <div class="score-head">
      <strong>${Number(score.overall || 5.5).toFixed(1)}</strong>
      <span>Estimated Band</span>
    </div>
    <section>
      <h2>Transcript</h2>
      <p>${escHtml(score.transcript || "I would like to answer this question clearly. I can give a reason and a short personal example.")}</p>
    </section>
    <div class="criteria-grid">
      <button data-action="explain-pronun" data-feedback="${escHtml(pronun.feedback || "")}"><b>${Number(pronun.score || 5).toFixed(1)}</b><span>Pronunciation</span></button>
      <button data-action="explain-fluency" data-feedback="${escHtml(fluency.feedback || "")}"><b>${Number(fluency.score || 6).toFixed(1)}</b><span>Fluency</span></button>
      <button data-action="explain-grammar" data-feedback="${escHtml(grammar.feedback || "")}"><b>${Number(grammar.score || 5.5).toFixed(1)}</b><span>Grammar</span></button>
      <button data-action="explain-vocab" data-feedback="${escHtml(vocab.feedback || "")}"><b>${Number(vocab.score || 5.5).toFixed(1)}</b><span>Vocabulary</span></button>
    </div>
    </div>
  `;
  stage.appendChild(result);
  document.querySelector(".usage-meter")?.remove();
  document.body.insertAdjacentHTML("beforeend", `<div class="usage-meter"><b>1</b><span>lượt chấm</span></div>`);
  if (output) {
    const suggestions = (score.suggestions || []).map((item) => `<li>${escHtml(item)}</li>`).join("");
    output.innerHTML = `
      <p class="sample-label">Đây là câu mẫu nhé</p>
      <article class="sample-card"><span class="play-mini">▷</span><p>${escHtml(score.rewrittenAnswer || "Oh yeah, I got a watch once. It was a really cool surprise, and I still remember it because it felt useful and meaningful.")}</p><button data-action="sample">Mở rộng câu</button></article>
      <h3>Từ vựng chủ đề</h3>
      <div class="vocab-chip-grid">
        <button data-action="pronun"><span class="play-mini">▷</span> received a luxury watch <em>nhận một chiếc đồng hồ sang trọng</em></button>
        <button data-action="pronun"><span class="play-mini">▷</span> got a smartwatch <em>nhận một chiếc đồng hồ thông minh</em></button>
        <button data-action="pronun"><span class="play-mini">▷</span> received a vintage watch <em>nhận một chiếc đồng hồ cổ</em></button>
        <button data-action="pronun"><span class="play-mini">▷</span> got a sports watch <em>nhận một chiếc đồng hồ thể thao</em></button>
      </div>
      <div class="note-maker"><textarea placeholder="Nhập ý tưởng để tạo câu mẫu, tiếng Anh/Việt đều được..."></textarea><button data-action="note">Tạo câu mẫu</button><small>Ghi chú là lưu :}</small></div>
      ${suggestions ? `<ul>${suggestions}</ul>` : ""}
      <p class="model-chip">Model: ${score.model || GEMINI_MODELS.scoring}</p>
    `;
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function startMicCapture() {
  recordedChunks = [];
  if (!navigator.mediaDevices?.getUserMedia) return false;
  recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(recordingStream);
  mediaRecorder.addEventListener("dataavailable", (event) => {
    if (event.data?.size) recordedChunks.push(event.data);
  });
  mediaRecorder.start();
  return true;
}

function stopMicCapture() {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      resolve(null);
      return;
    }
    mediaRecorder.addEventListener("stop", () => {
      recordingStream?.getTracks().forEach((track) => track.stop());
      recordingStream = null;
      resolve(new Blob(recordedChunks, { type: mediaRecorder.mimeType || "audio/webm" }));
    }, { once: true });
    mediaRecorder.stop();
  });
}

async function scoreCurrentAnswer() {
  const raw = decodeURIComponent(location.pathname.split("/question-answer/")[1] || "PART 1~Do you wear a watch?");
  const [part = "PART 1", question = "Do you wear a watch?"] = raw.split("~");
  const transcript = "I would like to answer this question clearly. I think it is important because it helps me communicate my ideas, and I can give an example from my daily life.";
  const blob = await stopMicCapture();
  const audioBase64 = blob ? await blobToBase64(blob) : "";
  const response = await fetch("/api/gemini/score-speaking", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: getGeminiKey(),
      model: GEMINI_MODELS.scoring,
      part,
      question,
      transcript,
      audioBase64,
      mimeType: blob?.type || "audio/webm"
    })
  });
  return response.json();
}

async function toggleRecording(button) {
  const count = $(".round-count");
  if (!count) return;
  if (button.classList.contains("recording")) {
    button.classList.remove("recording");
    button.textContent = "Ghi âm ngay";
    window.clearInterval(recordTimer);
    button.disabled = true;
    try {
      const score = await scoreCurrentAnswer();
      button.disabled = false;
      const _raw = decodeURIComponent(location.pathname.split("/question-answer/")[1] || "");
      const _ti = _raw.indexOf("~");
      addAnswer(_ti > -1 ? _raw.slice(_ti + 1) : "", _ti > -1 ? _raw.slice(0, _ti).trim() : "PART 1", score.overall || 5.5, score.transcript || "");
      refreshHomeStats();
      showToast("Đã có kết quả chấm điểm");
      renderScoreResult(score);
      if (score.warning) showToast(score.warning);
    } catch {
      button.disabled = false;
      showToast("Gemini lỗi kết nối, đang hiện kết quả demo");
      renderScoreResult();
    }
    return;
  }
  recordSeconds = 0;
  count.textContent = "0";
  button.classList.add("recording");
  button.textContent = "Dừng và gửi";
  try {
    await startMicCapture();
    showToast("Đang ghi âm...");
  } catch {
    showToast("Chua cap quyen micro, se cham bang transcript demo");
  }
  recordTimer = window.setInterval(() => {
    recordSeconds += 1;
    count.textContent = String(recordSeconds);
  }, 1000);
}

function cancelRecording() {
  window.clearInterval(recordTimer);
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  recordingStream?.getTracks().forEach((track) => track.stop());
  recordingStream = null;
  recordedChunks = [];
  const button = document.querySelector('[data-action="record"].recording');
  if (button) {
    button.classList.remove("recording");
    button.textContent = "Ghi âm ngay";
    button.disabled = false;
  }
  const count = $(".round-count");
  if (count) count.textContent = "0";
  showToast("Da huy ghi am");
}

function moveQuestion(direction) {
  const raw = decodeURIComponent(location.pathname.split("/question-answer/")[1] || "");
  const tilde = raw.indexOf("~");
  const partStr = tilde > -1 ? raw.slice(0, tilde).trim() : "PART 1";
  const currentQ = tilde > -1 ? raw.slice(tilde + 1).trim() : "";
  const partKey = partStr.includes("1") ? "part1" : partStr.includes("2") ? "part2" : "part3";
  const allQs = (qaData[partKey]?.topics || []).flatMap(t => t.questions);
  if (!allQs.length) return;
  const idx = allQs.findIndex(q => q === currentQ);
  const nextIdx = ((idx === -1 ? 0 : idx) + direction + allQs.length) % allQs.length;
  navigateLocal(questionHref(partStr, allQs[nextIdx]));
}

function toggleAnswered() {
  document.body.classList.toggle("hide-answered");
  showToast(document.body.classList.contains("hide-answered") ? "Đã ẩn vài câu mẫu đã trả lời" : "Đã hiện lại tất cả câu");
}

function applySearch(value) {
  const needle = value.trim().toLowerCase();
  document.querySelectorAll(".qa-question-card, .large-prompt-card, .user-question-card, .topic-block").forEach((item) => {
    const matched = !needle || item.textContent.toLowerCase().includes(needle);
    item.classList.toggle("filtered-out", !matched);
  });
}

function addUserQuestion(form) {
  const input = form.querySelector("input");
  const text = input.value.trim();
  if (!text) {
    showToast("Nhập câu hỏi trước đã");
    return;
  }
  userQuestions.unshift({ text, part: "PART 1" });
  input.value = "";
  renderRoute("/question-answer/user-question");
  showToast("Đã thêm câu hỏi");
}

function startTopic(button) {
  const question = button.closest(".topic-block")?.querySelector(".qa-question-card")?.textContent?.trim();
  if (!question) return;
  navigateLocal(questionHref("PART 1", question));
}

function selectTopic(button) {
  const list = button.closest(".topic-list");
  list?.querySelectorAll("button").forEach((item) => item.classList.remove("selected"));
  button.classList.add("selected");
  const text = button.textContent.trim().toLowerCase();
  const target = [...document.querySelectorAll(".topic-block, .large-prompt-card")].find((item) =>
    item.textContent.trim().toLowerCase().startsWith(text)
  );
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function toggleSetupSwitch(target) {
  target.classList.toggle("on");
  showToast(target.classList.contains("on") ? "Đã bật" : "Đã tắt");
}

function renderTestRunning(card, partLabel = "PART 1") {
  card.classList.add("test-running-card");
  card.innerHTML = `
    <header class="running-test-head">
      <span class="test-mode-pill">☯ Căng</span>
      <strong>${partLabel}</strong>
      <button data-action="test-exit">Thoát</button>
    </header>
    <div class="running-question">
      <p>${getTestQuestion(partLabel)}</p>
      <button class="listen-again" data-action="listen-question">Nghe lại</button>
    </div>
    <footer class="running-test-foot">
      <span class="recording-dot"></span><span>Đang ghi âm...</span>
      <span class="sound-bars"><i></i><i></i><i></i></span>
      <button data-action="test-submit-answer">Ghi nhận câu trả lời</button>
    </footer>
  `;
}

function showTestExitModal(card) {
  card.querySelector(".test-modal")?.remove();
  const modal = document.createElement("div");
  modal.className = "test-modal";
  modal.innerHTML = `
    <article>
      <h2><span>!</span> Thoát bài test?</h2>
      <p>Tiến trình hiện tại sẽ dừng lại. Câu trả lời đã ghi sẽ được giữ và xử lý.</p>
      <footer><button data-action="test-cancel-exit">Hủy</button><button data-action="test-confirm-exit">Thoát</button></footer>
    </article>
  `;
  card.appendChild(modal);
}

async function submitTestAnswer(button) {
  const card = button.closest(".test-setup-card");
  button.disabled = true;
  button.textContent = "Đang chấm...";
  const score = await fetch("/api/gemini/score-speaking", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: getGeminiKey(),
      model: GEMINI_MODELS.scoring,
      part: "PART 1",
      question: "Let's talk about your daily life.",
      transcript: "I usually start my day early, check my plan, and spend some time studying English."
    })
  }).then((response) => response.json());
  card.innerHTML = `
    <header class="running-test-head"><span></span><strong>Kết quả thi thử</strong><a href="/take-test/home">Thoát</a></header>
    <div class="test-score-summary">
      <strong>${Number(score.overall || 5.5).toFixed(1)}</strong>
      <p>${score.feedback || "Đã chấm xong câu trả lời thi thử."}</p>
      <div class="criteria-grid">
        <button><b>${Number(score.criteria?.pronunciation?.score || 5).toFixed(1)}</b><span>Pronunciation</span></button>
        <button><b>${Number(score.criteria?.fluency?.score || 6).toFixed(1)}</b><span>Fluency</span></button>
        <button><b>${Number(score.criteria?.grammar?.score || 5.5).toFixed(1)}</b><span>Grammar</span></button>
        <button><b>${Number(score.criteria?.vocabulary?.score || 5.5).toFixed(1)}</b><span>Vocabulary</span></button>
      </div>
    </div>
  `;
}

function getTestQuestion(partLabel) {
  const key = partLabel.includes("2") ? "part2" : partLabel.includes("3") ? "part3" : "part1";
  const qs = (qaData[key]?.topics || []).flatMap(t => t.questions);
  return qs.length ? qs[Math.floor(Math.random() * qs.length)] : "What do you enjoy doing in your free time?";
}

function startTest(button) {
  const card = button.closest(".test-setup-card");
  renderTestRunning(card, location.pathname.includes("full") ? "PART 1" : `PART ${location.pathname.slice(-1)}`);
  showToast("Bắt đầu bài thi thử");
}

async function showApiMap() {
  const map = await getApiMap();
  const output = $(".ai-output");
  if (!output) return;
  output.innerHTML = `
    <h3>API map</h3>
    <p><b>${map.aiChat.endpoint}</b>: gợi ý, từ vựng, ghi chú, giải thích điểm</p>
    <p><b>${map.storage.endpoint}</b>: upload/download audio</p>
    <p><b>${map.database.endpoint}</b>: lưu answer, vocab, note, bảng vàng</p>
  `;
}

function explainCriterion(action, target) {
  const labels = {
    "explain-pronun": "Pronunciation",
    "explain-fluency": "Fluency and Coherence",
    "explain-grammar": "Grammar",
    "explain-vocab": "Vocabulary"
  };
  const output = $(".ai-output");
  if (!output) return;
  const feedback = target?.dataset.feedback || "Gemini danh gia tieu chi nay dua tren transcript va muc IELTS Speaking.";
  if (action === "explain-pronun") {
    output.innerHTML = `
      <h3>Phát âm</h3>
      <p>${escHtml(feedback)}</p>
      <div class="pronun-analysis">
        <p>I <mark class="bad">usually</mark> wear a watch when I go to <mark class="warn">school</mark>, it helps me <mark class="bad">track</mark> my time.</p>
        <span><b></b> Lỗi nhẹ</span><span><b class="bad"></b> Lỗi nặng</span>
      </div>
      <p class="model-chip">Model: ${GEMINI_MODELS.scoring}</p>
    `;
    return;
  }
  output.innerHTML = `<h3>${labels[action]}</h3><p>${escHtml(feedback)}</p><article class="criterion-detail"><b>Tròn ý nhưng chưa sâu</b><p>Cần đào sâu một ý với ví dụ cụ thể, tránh chỉ liệt kê chung chung.</p></article><p class="model-chip">Model: ${GEMINI_MODELS.scoring}</p>`;
  return;
  output.innerHTML = `<h3>${labels[action]}</h3><p>API thật dùng /api/oai/chat để tạo giải thích điểm. Bản clone mô phỏng: câu trả lời rõ ý, nhưng cần thêm ví dụ cụ thể và giảm lặp từ để tăng band.</p>`;
}

document.addEventListener("click", (event) => {
  const actionTarget = event.target.closest("[data-action]");
  if (actionTarget) {
    const action = actionTarget.dataset.action;
    if (action === "record") toggleRecording(actionTarget);
    if (action === "cancel-record") cancelRecording();
    if (action === "play-tts") playText(actionTarget.dataset.text || actionTarget.textContent);
    if (action === "gemini-settings") showGeminiSettings();
    if (action === "make-note-sample") {
      const idea = $(".note-maker textarea")?.value.trim() || "Đi học";
      const output = $(".ai-output");
      if (output) output.innerHTML = `
        <section class="idea-answer">
          <p><b>Trả lời trực tiếp</b><button class="play-mini" data-action="play-tts" data-text="Yes, I wear a watch when I go to school.">▷</button> Yes, I wear a watch when I go to school.</p>
          <p><b>Giải thích</b><button class="play-mini" data-action="play-tts" data-text="It helps me keep track of time during classes and breaks.">▷</button> It helps me keep track of time during classes and breaks.</p>
          <p><b>Ví dụ</b><button class="play-mini" data-action="play-tts" data-text="For example, I know when to start my next lesson.">▷</button> For example, I know when to start my next lesson.</p>
          <small>Ý tưởng: ${idea} · Model: ${GEMINI_MODELS.note}</small>
        </section>
      `;
    }
    if (action === "save-vocab") showToast("Đã lưu từ vựng");
    if (action === "refresh-history") {
      const log = document.querySelector(".practice-log");
      if (log) { const h = log.querySelector("header"); log.innerHTML = ""; if (h) log.appendChild(h); log.insertAdjacentHTML("beforeend", renderHistoryCards()); }
      return;
    }
    if (["sample", "vocab", "note", "pronun"].includes(action)) setAiOutput(action);
    if (action === "api-map") showApiMap();
    if (["explain-pronun", "explain-fluency", "explain-grammar", "explain-vocab"].includes(action)) explainCriterion(action, actionTarget);
    if (action === "ai-help") {
      actionTarget.closest(".ai-tabs")?.querySelectorAll("button").forEach((button) => button.classList.remove("active"));
      actionTarget.classList.add("active");
      setAiOutput("sample");
    }
    if (action === "leaderboard") {
      actionTarget.closest(".ai-tabs")?.querySelectorAll("button").forEach((button) => button.classList.remove("active"));
      actionTarget.classList.add("active");
      const output = $(".ai-output");
      if (output) { output.innerHTML = renderLeaderboard(); return; }
      if (false) output.innerHTML = `
        <div class="leaderboard-tabs"><button>Band 6</button><button class="active">Band 7</button><button>Band 8</button></div>
        <p class="leader-vocab-title">10 từ hay nhất từ bảng vàng :)</p>
        ${vocabHtml([
          { term: "fashion accessory", vi: "phụ kiện thời trang" },
          { term: "super convenient", vi: "cực kỳ tiện lợi" },
          { term: "manage time effectively", vi: "quản lý thời gian hiệu quả" }
        ], "database + Gemini")}
        ${[
          ["ngoc******", "No, I don't wear a watch. Honestly, I find them uncomfortable. I just check my phone instead.", "7.0"],
          ["dat6******", "Yes, I always wear a watch when I go to school. It is a fashion accessory and super convenient.", "7.0"]
        ].map((row, index) => `
          <article class="leader-card">
            <header><b>Top ${index + 1}</b><span>${row[0]}</span><button>Theo Dõi</button></header>
            <div><button class="play-mini" data-action="play-tts" data-text="${row[1]}">▷</button><p>${row[1]}</p><strong>${row[2]}</strong></div>
            <footer><span>Trôi chảy: 7</span><span>Từ vựng: 8</span><span>Ngữ pháp: 7</span><span>Phát âm: 6</span></footer>
          </article>
        `).join("")}
      `;
    }
    if (action === "prev-question") moveQuestion(-1);
    if (action === "next-question") moveQuestion(1);
    if (action === "toggle-answered") toggleAnswered();
    if (action === "toggle-mode" || action === "toggle-followups") toggleSetupSwitch(actionTarget);
    if (action === "start-test") startTest(actionTarget);
    if (action === "test-exit") showTestExitModal(actionTarget.closest(".test-setup-card"));
    if (action === "test-cancel-exit") actionTarget.closest(".test-modal")?.remove();
    if (action === "test-confirm-exit") navigateLocal("/take-test/home");
    if (action === "listen-question") showToast("Đang phát lại câu hỏi");
    if (action === "test-submit-answer") submitTestAnswer(actionTarget);
    event.preventDefault();
    return;
  }

  const topicButton = event.target.closest(".topic-list button");
  if (topicButton) {
    selectTopic(topicButton);
    event.preventDefault();
    return;
  }

  const tabButton = event.target.closest(".topic-tabs button");
  if (tabButton) {
    tabButton.closest(".topic-tabs").querySelectorAll("button").forEach((button) => button.classList.remove("active"));
    tabButton.classList.add("active");
    const activeTab = tabButton.dataset.tab || tabButton.textContent.trim();
    document.querySelectorAll(".tab-group").forEach(g => {
      g.style.display = (g.dataset.topic === activeTab) ? "" : "none";
    });
    event.preventDefault();
    return;
  }

  const practiceButton = event.target.closest(".practice-topic");
  if (practiceButton) {
    startTopic(practiceButton);
    event.preventDefault();
    return;
  }

  if (event.target.closest(".qa-toolbar .switch")) {
    toggleAnswered();
    event.preventDefault();
    return;
  }

  const anchor = event.target.closest("a");
  if (!anchor) return;
  const url = new URL(anchor.href);
  if (url.origin !== location.origin) return;
  event.preventDefault();
  history.pushState(null, "", url.pathname);
  renderRoute(url.pathname);
});

document.addEventListener("input", (event) => {
  if (event.target.matches(".search-box input")) {
    applySearch(event.target.value);
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.matches(".gemini-settings-form")) {
    event.preventDefault();
    setGeminiKey(event.target.querySelector("input").value);
    showToast("Da luu Gemini key");
    showGeminiSettings();
    return;
  }
  if (event.target.matches(".add-question")) {
    event.preventDefault();
    addUserQuestion(event.target);
  }
});

window.addEventListener("popstate", () => renderRoute());

$("#accountToggle").addEventListener("click", () => {
  $("#accountMenu").hidden = !$("#accountMenu").hidden;
});
