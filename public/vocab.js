const list = document.querySelector("#savedPhraseList") || document.querySelector("#vocabRoot");
if (!list) { console.warn("[vocab] mount not found"); }

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let items = [];
try { const raw = JSON.parse(localStorage.getItem("ln.savedPhrases") || "[]"); items = Array.isArray(raw) ? raw : []; } catch {}

if (list) {
  list.innerHTML = items.length ? items.map((item) => `
    <article class="saved-phrase">
      <div>
        <strong>${esc(item.term)}</strong>
        <span>${esc(item.ipa)}</span>
        <p>${esc(item.vi || item.definition || "")}</p>
      </div>
      <button type="button" data-say="${esc(item.term)}">▶</button>
    </article>
  `).join("") : `<div class="empty-state">Chưa có từ nào được lưu.</div>`;

  list.querySelectorAll("[data-say]").forEach((button) => {
    button.addEventListener("click", () => {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(button.dataset.say);
      u.lang = "en-US";
      speechSynthesis.speak(u);
    });
  });
}
