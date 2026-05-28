import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:3000";
const question = "How do you keep your work or study space tidy?";
const url = base + "/question-answer/PART%201~" + encodeURIComponent(question).replace(/%20/g, "%20");

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
await ctx.addInitScript((q) => {
  try {
    localStorage.setItem("ln.scoreHistory:" + encodeURIComponent(q), JSON.stringify([{
      ts: Date.now(),
      __realAttempt: true,
      question: q,
      part: "PART 1",
      transcript: "I keep my desk organized by tidying it every evening.",
      overall: 6,
      model: "gemini-3.5-flash",
      criteria: {
        fluency: { score: 6, feedback: "Clear." },
        vocabulary: { score: 6, feedback: "Good." },
        grammar: { score: 6, feedback: "Mostly accurate." },
        pronunciation: { score: 6, feedback: "Understandable." }
      },
      feedback: "Cached recent local result.",
      suggestions: []
    }]));
  } catch {}
}, question);
await ctx.addCookies([{ name: "ln_auth", value: "1", url: base }]);
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(2500);
const result = await page.evaluate(() => {
  const panels = [...document.querySelectorAll(".ln-score-panel, #ln-score-panel")];
  const panel = panels.find((p) => /I keep my desk organized/i.test(p.textContent || "")) || panels[0] || null;
  return {
    found: !!panel,
    totalPanels: panels.length,
    text: panel ? panel.textContent.replace(/\s+/g, " ").trim().slice(0, 240) : "",
    audioButtons: panel ? panel.querySelectorAll("audio, [data-audio]").length : 0,
  };
});
await browser.close();
if (!result.found || !/I keep my desk organized/i.test(result.text)) {
  console.log("FAIL score-cache-restore", JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log("OK score-cache-restore", JSON.stringify(result, null, 2));
