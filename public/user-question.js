// =====================================================================
//  Tá»± thÃªm cÃ¢u â€” /question-answer/user-question
//  Wraps in the Luyennoi home.html shell. User adds a question + picks Part,
//  saves to localStorage `ln.userQuestions`, and the saved list links into
//  the per-question detail page so the full Speaking scoring flow works.
// =====================================================================
(function () {
  const root = document.querySelector("#userQuestionRoot");
  if (!root) return;

  // Inject CSS once (shell host has no /styles.css)
  (function injectCss() {
    if (document.getElementById("ln-uq-css")) return;
    const s = document.createElement("style");
    s.id = "ln-uq-css";
    s.textContent = `
      #userQuestionRoot { font-family: Lexend, sans-serif; max-width: 880px; margin: 0 auto; }
      .uq-tabs { display:flex; gap:.5rem; flex-wrap:wrap; margin-bottom:1.3rem; }
      .uq-tabs a { padding:.4rem 1rem; border:1.5px solid #e5e7eb; border-radius:9999px; font-size:.85rem; font-weight:600; color:#4b5563; text-decoration:none; }
      .uq-tabs a.active { background:#d9381e; color:white; border-color:#d9381e; }
      .uq-tabs a:hover { border-color:#d9381e; color:#d9381e; }
      .uq-tabs a.active:hover { color:white; }

      .uq-card { background:white; border:1px solid #e5e7eb; border-radius:.8rem; padding:1.2rem 1.4rem; margin-bottom:1.4rem; }
      .uq-input-row { display:flex; gap:.6rem; flex-wrap:wrap; align-items:stretch; }
      .uq-input-row input { flex:1; min-width:200px; padding:.7rem 1rem; border:1.5px solid #e5e7eb; border-radius:.55rem; font-size:.95rem; font-family:inherit; outline:none; }
      .uq-input-row input:focus { border-color:#d9381e; }
      .uq-input-row select { padding:.7rem .8rem; border:1.5px solid #e5e7eb; border-radius:.55rem; font-size:.92rem; font-family:inherit; outline:none; background:white; cursor:pointer; }
      .uq-input-row button { padding:.7rem 1.6rem; background:#d9381e; color:white; border:none; border-radius:.55rem; font-size:.92rem; font-weight:700; cursor:pointer; font-family:inherit; }
      .uq-input-row button:hover { background:#4a0cd4; }
      .uq-input-row button:disabled { background:var(--ink); cursor:not-allowed; }

      .uq-filter { display:flex; gap:.4rem; flex-wrap:wrap; margin-bottom:.8rem; }
      .uq-filter button { padding:.3rem .9rem; border:1.5px solid #e5e7eb; background:white; border-radius:9999px; font-size:.78rem; font-weight:500; color:#4b5563; cursor:pointer; font-family:inherit; }
      .uq-filter button.active { background:#d9381e; color:white; border-color:#d9381e; }

      .uq-list { display:flex; flex-direction:column; gap:.55rem; }
      .uq-empty { text-align:center; color:#9ca3af; padding:2.5rem 1rem; font-size:.9rem; }
      .uq-item { display:flex; justify-content:space-between; align-items:center; gap:.7rem; padding:.85rem 1.1rem; background:white; border:1px solid #e5e7eb; border-radius:.6rem; transition:border-color .15s, box-shadow .15s; }
      .uq-item:hover { border-color:var(--ink); box-shadow:0 2px 8px rgba(217,56,30,.16); }
      .uq-item-text { flex:1; min-width:0; }
      .uq-part-badge { display:inline-block; background:#ffffff; color:#d9381e; font-size:.66rem; font-weight:700; padding:.1rem .55rem; border-radius:9999px; margin-right:.5rem; letter-spacing:.05em; }
      .uq-item-q { font-weight:600; color:#171717; font-size:.95rem; line-height:1.4; }
      .uq-item-meta { font-size:.72rem; color:#9ca3af; margin-top:.2rem; }
      .uq-item-actions { display:flex; gap:.4rem; flex-shrink:0; }
      .uq-btn-practice { background:#d9381e; color:white; border:none; padding:.4rem .9rem; border-radius:9999px; font-size:.76rem; font-weight:600; cursor:pointer; font-family:inherit; text-decoration:none; display:inline-flex; align-items:center; }
      .uq-btn-practice:hover { background:#4a0cd4; }
      .uq-btn-del { background:transparent; border:none; color:#9ca3af; cursor:pointer; padding:.4rem .55rem; border-radius:.3rem; font-size:.95rem; }
      .uq-btn-del:hover { background:#ffffff; color:var(--red); }
    `;
    document.head.appendChild(s);
  })();

  const STORE_KEY = "ln.userQuestions";
  const state = { filter: "all" };

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); } catch { return []; }
  }
  function save(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch {}
  }
  function addQuestion(question, part) {
    const list = load();
    list.unshift({ id: Date.now() + "-" + Math.random().toString(36).slice(2, 7), question: question.trim(), part, addedAt: new Date().toISOString() });
    save(list.slice(0, 500));
  }
  function deleteQuestion(id) {
    save(load().filter((q) => q.id !== id));
  }
  function fmtTime(ts) {
    const d = new Date(ts);
    return d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
  }
  function detailUrl(q) {
    return `/question-answer/${encodeURIComponent(q.part)}~${encodeURIComponent(q.question)}`;
  }
  function escHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function render() {
    const list = load();
    const filtered = state.filter === "all" ? list : list.filter((q) => q.part === state.filter);
    const counts = {
      "all": list.length,
      "PART 1": list.filter((q) => q.part === "PART 1").length,
      "PART 2": list.filter((q) => q.part === "PART 2").length,
      "PART 3": list.filter((q) => q.part === "PART 3").length,
    };
    root.innerHTML = `
      <div class="uq-tabs">
        <a href="/question-answer/part1">Luyá»‡n Part 1</a>
        <a href="/question-answer/part2">Luyá»‡n Part 2</a>
        <a href="/question-answer/part3">Luyá»‡n Part 3</a>
        <a class="active" href="/question-answer/user-question">CÃ¢u báº¡n thÃªm</a>
      </div>

      <div class="uq-card">
        <h2 style="margin:0 0 .8rem;font-size:1.05rem;font-weight:700;color:#171717;">ThÃªm cÃ¢u há»i má»›i</h2>
        <div class="uq-input-row">
          <input id="uqInput" type="text" placeholder="Nháº­p cÃ¢u há»i tiáº¿ng Anh cá»§a báº¡n..." autocomplete="off" />
          <select id="uqPart">
            <option value="PART 1">Part 1</option>
            <option value="PART 2">Part 2</option>
            <option value="PART 3">Part 3</option>
          </select>
          <button id="uqAdd">ThÃªm CÃ¢u há»i</button>
        </div>
        <div style="font-size:.78rem;color:#9ca3af;margin-top:.55rem;">
          CÃ¢u báº¡n thÃªm sáº½ vÃ o "List cÃ¢u Ä‘Ã£ thÃªm". Báº¥m <b>Luyá»‡n</b> Ä‘á»ƒ má»Ÿ trang cháº¥m Ä‘iá»ƒm nhÆ° cÃ¢u IELTS bÃ¬nh thÆ°á»ng.
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem;flex-wrap:wrap;gap:.5rem;">
        <h3 style="margin:0;font-size:.98rem;font-weight:700;color:#171717;">CÃ¢u Ä‘Ã£ thÃªm <span style="color:#9ca3af;font-weight:500;">(${list.length})</span></h3>
        <div class="uq-filter">
          <button class="${state.filter === "all" ? "active" : ""}" data-filter="all">Táº¥t cáº£ Â· ${counts["all"]}</button>
          <button class="${state.filter === "PART 1" ? "active" : ""}" data-filter="PART 1">Part 1 Â· ${counts["PART 1"]}</button>
          <button class="${state.filter === "PART 2" ? "active" : ""}" data-filter="PART 2">Part 2 Â· ${counts["PART 2"]}</button>
          <button class="${state.filter === "PART 3" ? "active" : ""}" data-filter="PART 3">Part 3 Â· ${counts["PART 3"]}</button>
        </div>
      </div>

      <div class="uq-list">
        ${filtered.length === 0 ? `
          <div class="uq-empty">
            ${list.length === 0 ? "ChÆ°a cÃ³ cÃ¢u há»i nÃ o. HÃ£y thÃªm cÃ¢u há»i Ä‘áº§u tiÃªn cá»§a báº¡n!" : "KhÃ´ng cÃ³ cÃ¢u nÃ o trong " + state.filter + "."}
          </div>` : filtered.map((q) => `
          <div class="uq-item" data-id="${escHtml(q.id)}">
            <div class="uq-item-text">
              <span class="uq-part-badge">${escHtml(q.part)}</span>
              <span class="uq-item-q">${escHtml(q.question)}</span>
              <div class="uq-item-meta">ThÃªm lÃºc ${fmtTime(q.addedAt)}</div>
            </div>
            <div class="uq-item-actions">
              <a class="uq-btn-practice" href="${detailUrl(q)}">ðŸŽ¤ Luyá»‡n</a>
              <button class="uq-btn-del" data-del="${escHtml(q.id)}" title="XoÃ¡">âœ•</button>
            </div>
          </div>
        `).join("")}
      </div>
    `;

    const input = root.querySelector("#uqInput");
    const partSel = root.querySelector("#uqPart");
    const addBtn = root.querySelector("#uqAdd");

    function trySubmit() {
      const q = (input.value || "").trim();
      if (!q) { input.focus(); input.style.borderColor = "var(--red)"; setTimeout(() => { input.style.borderColor = "#e5e7eb"; }, 1200); return; }
      addQuestion(q, partSel.value);
      input.value = "";
      render();
      input.focus();
    }
    addBtn.addEventListener("click", trySubmit);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") trySubmit(); });

    root.querySelectorAll("[data-filter]").forEach((b) => {
      b.addEventListener("click", () => { state.filter = b.dataset.filter; render(); });
    });
    root.querySelectorAll("[data-del]").forEach((b) => {
      b.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        if (confirm("XoÃ¡ cÃ¢u há»i nÃ y?")) { deleteQuestion(b.dataset.del); render(); }
      });
    });
  }

  render();
})();


