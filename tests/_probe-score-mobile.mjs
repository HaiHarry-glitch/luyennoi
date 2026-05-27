import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:3000";
const route = "/question-answer/PART%202~Describe%20a%20person%20who%20is%20good%20at%20learning%20and%20speaking%20new%20languages";

const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  locale: "vi-VN"
});
const p = await ctx.newPage();

const errors = [];
p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

await p.goto(base + route, { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(2500);

// Inject the score panel HTML directly to verify mobile CSS handles it well.
const result = await p.evaluate(() => {
  const html = `
    <div id="ln-score-panel" class="ln-score-panel" style="position:fixed;right:1rem;top:5rem;width:380px;background:white;border:1.5px solid #e5e7eb;border-radius:1rem;box-shadow:0 8px 32px rgba(0,0,0,.15);z-index:9999;max-height:80vh;overflow-y:auto;font-family:Lexend,sans-serif;">
      <div style="position:absolute;top:.7rem;right:.7rem;display:flex;gap:.3rem;align-items:center;">
        <button class="ln-score-toggle" style="background:none;border:none;cursor:pointer;font-size:.85rem;color:#6b7280;padding:0;line-height:1;">▼</button>
        <button class="ln-score-close" style="background:none;border:none;cursor:pointer;font-size:1rem;color:#9ca3af;">×</button>
      </div>
      <div class="ln-score-header" style="display:flex;align-items:flex-start;gap:.7rem;margin-bottom:.4rem;cursor:pointer;padding-right:3rem;">
        <button class="ln-user-audio-btn" style="background:transparent;border:1.5px solid #171717;color:#171717;border-radius:50%;width:1.8rem;height:1.8rem;">▶</button>
        <div class="ln-user-transcript" style="flex:1;font-size:.88rem;line-height:1.85;">Wow this is a very long transcript with many words that should wrap correctly and not push the layout out of the viewport even on a small mobile screen of 390 pixels wide.</div>
        <div class="ln-overall-score" style="background:#d9381e;color:#fff;font-size:1.05rem;font-weight:900;min-width:2.6rem;width:2.6rem;height:2.6rem;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1;"><span>6.5</span></div>
      </div>
      <div class="ln-score-body">
        <div style="margin:.2rem 0 .5rem 2.3rem;">
          <button class="ln-word-sync-btn" style="background:#d9381e;color:#fff;border:1.5px solid #171717;padding:.28rem .7rem;font-size:.72rem;font-weight:800;">🎯 Nghe theo từ</button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.7rem;">
          <div style="background:#fff7cc;border:1.5px solid #FFD700;border-radius:9999px;padding:.3rem .8rem;"><span>Trôi chảy: 6.5</span> <button class="ln-crit-btn" data-crit="fluency">Chi tiết</button></div>
          <div style="background:#fff7cc;border:1.5px solid #FFD700;border-radius:9999px;padding:.3rem .8rem;"><span>Từ vựng: 6</span> <button class="ln-crit-btn" data-crit="vocabulary">Chi tiết</button></div>
          <div style="background:#fff7cc;border:1.5px solid #FFD700;border-radius:9999px;padding:.3rem .8rem;"><span>Ngữ pháp: 7</span> <button class="ln-crit-btn" data-crit="grammar">Chi tiết</button></div>
          <div style="background:#fff7cc;border:1.5px solid #FFD700;border-radius:9999px;padding:.3rem .8rem;"><span>Phát âm: 6</span> <button class="ln-crit-btn" data-crit="pronunciation">Chi tiết</button></div>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
  return true;
});

await p.waitForTimeout(300);

const info = await p.evaluate(() => {
  const panel = document.getElementById("ln-score-panel");
  if (!panel) return { found: false };
  const r = panel.getBoundingClientRect();
  const overall = panel.querySelector(".ln-overall-score");
  const crits = panel.querySelectorAll(".ln-crit-btn");
  const word = panel.querySelector(".ln-word-sync-btn");
  const close = panel.querySelector(".ln-score-close");
  const overallR = overall?.getBoundingClientRect();
  return {
    found: true,
    inner: window.innerWidth,
    panel: { left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) },
    overflow: r.right > window.innerWidth + 1 || r.left < -1,
    overall: overallR ? { w: Math.round(overallR.width), h: Math.round(overallR.height) } : null,
    crits: [...crits].map((c) => {
      const rr = c.getBoundingClientRect();
      return { w: Math.round(rr.width), h: Math.round(rr.height) };
    }),
    word: word ? { w: Math.round(word.getBoundingClientRect().width), h: Math.round(word.getBoundingClientRect().height) } : null,
    close: close ? { w: Math.round(close.getBoundingClientRect().width), h: Math.round(close.getBoundingClientRect().height) } : null
  };
});

console.log(JSON.stringify(info, null, 2));
if (errors.length) console.log("errors:", errors);

await b.close();

const ok = info.found && !info.overflow
  && info.crits.every((c) => c.h >= 36 && c.w >= 60)
  && info.word && info.word.h >= 36
  && info.close && info.close.w >= 32 && info.close.h >= 32;
process.exit(ok ? 0 : 1);
