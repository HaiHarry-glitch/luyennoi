// Probe — verify the new mini dashboard + Thi PART chooser modal on /take-test/home
// and the lesson 40-46 cards on /alphafeature/pronun.
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:3000";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("luyennoi.geminiKeys", JSON.stringify(["stub-key-for-probe"]));
    localStorage.setItem("luyennoi.geminiKey", "stub-key-for-probe");
    // Seed a single fake full-test entry so the mini-dashboard renders.
    localStorage.setItem("ln.fullTestHistory", JSON.stringify([{
      ts: Date.now() - 86400000, mode: "full", overall: 6.5,
      sections: { part1: { band: 6.0 }, part2: { band: 6.5 }, part3: { band: 7.0 } },
      questionCount: 9, predictionWeight: 0.45,
      selectedPart1Topics: [], selectedPart2Topic: "",
      answers: [],
    }]));
  } catch {}
});
await ctx.addCookies([{ name: "ln_auth", value: "1", url: base }]);
const page = await ctx.newPage();
const findings = [];

// 1. /take-test/home — mini dashboard + chooser modal
await page.goto(base + "/take-test/home", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(2500);

const summary = await page.evaluate(() => {
  const card = document.getElementById("ln-test-summary");
  if (!card) return { found: false };
  const blocks = card.querySelectorAll("div[style*='text-align:center']");
  return {
    found: true,
    valuesShown: blocks.length,
    text: card.textContent.replace(/\s+/g, " ").slice(0, 200),
  };
});
if (!summary.found || summary.valuesShown < 3) findings.push({ what: "Mini dashboard summary card missing on /take-test/home", got: summary });

// Click Thi PART 1 link → chooser modal should open
const chooser = await page.evaluate(async () => {
  const a = [...document.querySelectorAll('a[href="/take-test/part1"]')].find(x => /thi\s*part\s*1/i.test(x.textContent || ""));
  if (!a) return { sawLink: false };
  a.click();
  await new Promise((r) => setTimeout(r, 250));
  const modal = document.getElementById("ln-test-chooser");
  if (!modal) return { sawLink: true, modalOpened: false };
  return {
    sawLink: true,
    modalOpened: true,
    hasStandardBtn: !!modal.querySelector('[data-act="standard"]'),
    hasCustomBtn: !!modal.querySelector('[data-act="custom"]'),
  };
});
if (!chooser.sawLink || !chooser.modalOpened || !chooser.hasStandardBtn || !chooser.hasCustomBtn) {
  findings.push({ what: "Thi PART 1 chooser modal not wired correctly", got: chooser });
}

// Click "Custom" inside modal → topic picker should render
const customPicker = await page.evaluate(async () => {
  const modal = document.getElementById("ln-test-chooser");
  if (!modal) return { found: false };
  modal.querySelector('[data-act="custom"]')?.click();
  await new Promise((r) => setTimeout(r, 800)); // wait for /data/questions.json
  const body = document.getElementById("ln-test-chooser-body");
  if (!body) return { found: false };
  const checkboxes = body.querySelectorAll("input[type=checkbox]").length;
  const perqBtns = body.querySelectorAll("[data-perq]").length;
  return { found: true, checkboxes, perqBtns };
});
if (!customPicker.found || customPicker.checkboxes < 5 || customPicker.perqBtns < 4) {
  findings.push({ what: "Custom picker missing topic checkboxes / perQuestion buttons", got: customPicker });
}

// 2. /alphafeature/pronun/lesson1/section1 — lesson 40-46 cards injected into the sidebar list
await page.goto(base + "/alphafeature/pronun/lesson1/section1", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(2500);
const pronunCards = await page.evaluate(() => {
  const titles = [...document.querySelectorAll(".collapse-title")].map(el => el.textContent.replace(/\s+/g, " ").trim());
  const lesson40 = titles.find(t => /Bài\s*40\s*:.*ɔɪ/i.test(t)) || "";
  const lesson46 = titles.find(t => /Bài\s*46\s*:.*aʊə/i.test(t)) || "";
  const links40 = document.querySelectorAll('a[href^="/alphafeature/pronun/lesson40"]').length;
  const links46 = document.querySelectorAll('a[href^="/alphafeature/pronun/lesson46"]').length;
  return { totalCards: titles.length, lesson40, lesson46, links40, links46 };
});
if (!pronunCards.lesson40 || !pronunCards.lesson46) {
  findings.push({ what: "Lesson 40 or 46 not rendered on /alphafeature/pronun", got: pronunCards });
}

await browser.close();
if (findings.length) {
  console.log("FAIL:", JSON.stringify(findings, null, 2));
  process.exit(1);
}
console.log("OK probe-test-home + pronun-46");
console.log(JSON.stringify({ summary, chooser, customPicker, pronunCards }, null, 2));
