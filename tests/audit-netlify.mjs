import { chromium } from "playwright";

const BASE = process.argv[2] || process.env.LN_BASE || "https://luyennoi.netlify.app";

const ROUTES = [
  { path: "/",                                        expect: { landingCta: true } },
  { path: "/home",                                    expect: { brand: true, sidebar: true } },
  { path: "/login",                                   expect: { landingCta: true } },
  { path: "/landing",                                 expect: { landingCta: true } },
  { path: "/question-answer",                         expect: { brand: true, sidebar: true } },
  { path: "/question-answer/part1",                   expect: { brand: true, sidebar: true, qaToggle: true, qaCards: true } },
  { path: "/question-answer/part2",                   expect: { brand: true, sidebar: true, qaToggle: true, qaCards: true } },
  { path: "/question-answer/part3",                   expect: { brand: true, sidebar: true, qaToggle: true, qaCards: true } },
  { path: "/question-answer/PART%202~Describe%20a%20person%20who%20is%20good%20at%20learning%20and%20speaking%20new%20languages",
                                                      expect: { brand: true, detailText: /Describe a person who is good at learning/i } },
  { path: "/question-answer/user-question",           expect: { brand: true, mount: "#userQuestionRoot" } },
  { path: "/take-test",                               expect: { brand: true } },
  { path: "/take-test/home",                          expect: { brand: true } },
  { path: "/take-test/full-test",                     expect: { brand: true } },
  { path: "/take-test/part1",                         expect: { brand: true } },
  { path: "/take-test/part2",                         expect: { brand: true } },
  { path: "/take-test/part3",                         expect: { brand: true } },
  { path: "/take-test/custom-strict",                 expect: { brand: true } },
  { path: "/reading",                                 expect: { brand: true, mount: "#readingRoot", readingHero: true, readingModal: true } },
  { path: "/reading/postcards-from-paradise-my-trip-to-the-coast",
                                                      expect: { brand: true, mount: "#readingRoot", readingDetail: true } },
  { path: "/alphafeature/pronun",                     expect: { brand: true, mount: "#pronunRoot" } },
  { path: "/alphafeature/pronun/lesson1/section1",    expect: { brand: true, pronunLesson: { section: 1 } } },
  { path: "/alphafeature/pronun/lesson1/section2",    expect: { brand: true, pronunLesson: { section: 2 } } },
  { path: "/alphafeature/pronun/lesson1/section3",    expect: { brand: true, pronunLesson: { section: 3 } } },
  { path: "/alphafeature/vocab",                      expect: { brand: true, mount: "#vocabRoot" } },
  { path: "/alphafeature/boxing",                     expect: { brand: true, mount: "#boxingRoot" } },
  { path: "/alphafeature/past-tense",                 expect: { brand: true, mount: "#pastTenseRoot" } },
  { path: "/alphafeature/intonation",                 expect: { brand: true, mount: "#intonationRoot" } },
  { path: "/alphafeature/rhythm",                     expect: { brand: true, mount: "#rhythmRoot" } },
  { path: "/alphafeature/payment",                    expect: { brand: true } },
  { path: "/alphafeature/set-voice",                  expect: { brand: true } },
  { path: "/alphafeature/setup-mic",                  expect: { brand: true } },
  { path: "/alphafeature/join-us",                    expect: { brand: true } },
  { path: "/profile/teaching/landing-page",           expect: { brand: true } },
  { path: "/settings",                                final: ["/home", "/home/"], expect: { settingsRedirect: true } }
];

const API_PROBES = [
  { path: "/api/models",            requireField: "models" },
  { path: "/api/auth/user" },
  { path: "/api/practice-attempts" },
  { path: "/api/supabase/config",   requireField: "url" }
];

const ASSET_PROBES = [
  "/real/manifest.webmanifest",
  "/real/icons/icon-192.png",
  "/neo-brutalism.css",
  "/styles.css",
  "/real-overlay.js",
  "/auth.js",
  "/sidebar.js",
  "/reading.js",
  "/full-test.js",
  "/data/reading-stories.json",
  "/data/translations.json"
];

const ALLOWED_404 = ["favicon.ico"];
const ALLOWED_CONSOLE = [
  /preloaded using link preload but not used/i,
  /A preload for .* is found, but is not used because the request credentials/i,
  /Failed to load resource: the server responded with a status of 401/i,
  /Failed to load resource: the server responded with a status of 403/i,
  /Manifest:/i
];

const findings = [];
function record(route, kind, msg) { findings.push({ route, kind, msg }); }

function normalizePath(path) {
  let out = path || "/";
  try { out = decodeURIComponent(out); } catch {}
  out = out.replace(/\/+$/, "");
  return out || "/";
}

const MOJIBAKE_RE = /[\u0081\u008d\u008f\u0090\u009d]|Ã[\u00A1-\u00FF]|Ä[ƒ\u00A1-\u00FF]|Æ°|á»‡|á»‹|á»c|á»±|á»±|á»i/;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 LuyennoiAudit/1.0",
    locale: "vi-VN",
    viewport: { width: 1366, height: 900 }
  });

  for (const route of ROUTES) {
    const url = BASE + route.path;
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];
    let navOk = false;

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (!ALLOWED_CONSOLE.some((re) => re.test(text))) consoleErrors.push(text);
      }
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("response", (res) => {
      const status = res.status();
      const u = res.url();
      if (status >= 400 && !ALLOWED_404.some((p) => u.includes(p))) {
        failedRequests.push(`HTTP ${status} ${u}`);
      }
    });

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2500);
      navOk = true;
      const finalPath = normalizePath(new URL(page.url()).pathname);
      const expected = (route.final || [route.path]).map(normalizePath);
      if (!expected.includes(finalPath)) record(route.path, "route", `expected ${expected.join(" or ")}, got ${finalPath}`);
    } catch (e) {
      record(route.path, "nav", e.message);
    }

    consoleErrors.forEach((e) => record(route.path, "console", e));
    pageErrors.forEach((e) => record(route.path, "page-error", e));
    failedRequests.forEach((e) => record(route.path, "request", e));

    if (navOk && !page.isClosed()) {
      try {
        const finalUrl = page.url();
        const exp0 = route.expect || {};
        if (exp0.settingsRedirect) {
          await page.waitForTimeout(800);
          const modalCount = await page.locator("#lnUserDataModal").count();
          if (modalCount < 1) record(route.path, "interaction", "settings redirect did not open #lnUserDataModal");
        }
        const bodyText = await page.locator("body").innerText().catch(() => "");
        if (MOJIBAKE_RE.test(bodyText)) {
          const m = bodyText.match(/[^\s]{0,30}(Ã[¡-ÿ]|Ä[ƒ¡-ÿ]|Æ°|á»[^\s]{1,5}|[\u0081\u008d\u008f\u0090\u009d])[^\s]{0,15}/);
          record(route.path, "mojibake", `garbled: ${(m ? m[0] : bodyText.slice(0, 60)).replace(/\n/g, " ")}`);
        }

        const exp = route.expect || {};

        if (exp.brand) {
          const brandCount = await page.locator(".ln-side-brand, a[href='/login'] strong:has-text('Luy')").count();
          if (brandCount < 1) record(route.path, "ui", "missing sidebar brand");
        }
        if (exp.sidebar) {
          const sidebarCount = await page.locator(".ln-sidebar-shell, aside.ln-sidebar-fixed").count();
          if (sidebarCount < 1) record(route.path, "ui", "missing sidebar");
          const navLinks = await page.locator(".ln-side-nav a").count();
          if (navLinks < 5) record(route.path, "ui", `sidebar nav links low: ${navLinks}`);
        }
        if (exp.mount) {
          const mountCount = await page.locator(exp.mount).count();
          if (mountCount < 1) record(route.path, "ui", `missing mount ${exp.mount}`);
        }

        if (exp.qaToggle) {
          const toggle = page.locator(":text-matches(\"^\\\\s*(Ẩn|Hiện) câu đã (trả lời|làm rồi)\")");
          const count = await toggle.count();
          if (count !== 1) record(route.path, "ui", `answered toggle count: ${count}`);
          if (count === 1) {
            const before = await page.evaluate(() => document.body.classList.contains("hide-answered"));
            await toggle.first().click({ delay: 50 }).catch(() => {});
            await page.waitForTimeout(400);
            const after = await page.evaluate(() => document.body.classList.contains("hide-answered"));
            if (before === after) record(route.path, "interaction", "answered toggle did not change body.hide-answered class");
            await toggle.first().click({ delay: 50 }).catch(() => {});
            await page.waitForTimeout(200);
          }
        }
        if (exp.qaCards) {
          const cardCount = await page.locator('a[href*="/question-answer/PART"], .question-card, .qa-question-card, [class*="QuestionCard"], [data-question]').count();
          if (cardCount < 5) record(route.path, "ui", `expected many question cards, got ${cardCount}`);
          const stickyScore = await page.locator("#ln-score-panel").count();
          if (stickyScore > 0) record(route.path, "ui", "score panel showing on library page");
        }

        if (exp.detailText) {
          if (!exp.detailText.test(bodyText)) record(route.path, "ui", "detail question text not rendered");
          const recordBtn = await page.locator("button:has-text('Ghi âm'), button:has-text('Bắt đầu'), button:has-text('Bat dau'), [data-record]").count();
          if (recordBtn < 1) record(route.path, "ui", "detail page missing record button");
          const sampleAns = await page.locator(":text-matches('Sample|Đ.p m.u|G.i .|Sample answer', 'i')").count();
          if (sampleAns < 1) record(route.path, "ui", "detail page missing sample answer section");
        }

        if (exp.readingHero) {
          const heroH1 = await page.locator("#readingRoot h1").innerText().catch(() => "");
          if (!/Luy/i.test(heroH1)) record(route.path, "ui", `reading hero h1 unexpected: '${heroH1}'`);
          const filterCount = await page.locator(".reading-filter button").count();
          if (filterCount < 2) record(route.path, "ui", `reading filter button count: ${filterCount}`);
        }
        if (exp.readingModal) {
          const addBtn = page.locator("#addCustomText");
          const has = await addBtn.count();
          if (has < 1) record(route.path, "ui", "missing add-custom-text button");
          if (has === 1) {
            await addBtn.click({ delay: 50 }).catch(() => {});
            await page.waitForTimeout(300);
            const modal = await page.locator("#ln-add-text-modal").count();
            if (modal < 1) record(route.path, "interaction", "add-custom-text modal did not open");
            else {
              const modalText = await page.locator("#ln-add-text-modal").innerText().catch(() => "");
              if (MOJIBAKE_RE.test(modalText)) record(route.path, "mojibake", "garbled text inside add-custom-text modal");
              await page.locator("#cancelAdd").click({ delay: 30 }).catch(() => {});
              await page.waitForTimeout(150);
            }
          }
        }

        if (exp.readingDetail) {
          const back = await page.locator("#readingRoot a.back-link").count();
          if (back < 1) record(route.path, "ui", "reading detail missing back link");
          const speak = await page.locator("#readingRoot #speakStory").count();
          if (speak < 1) record(route.path, "ui", "reading detail missing speak button");
          const ipa = await page.locator("#readingRoot #toggleIpa").count();
          if (ipa < 1) record(route.path, "ui", "reading detail missing IPA toggle");
          if (ipa === 1) {
            const before = await page.evaluate(() => ({ ruby: document.querySelectorAll("ruby.g-tricky").length, withIpa: document.querySelectorAll("p.with-ipa").length }));
            await page.locator("#readingRoot #toggleIpa").click({ delay: 30 }).catch(() => {});
            await page.waitForTimeout(400);
            const after = await page.evaluate(() => ({ ruby: document.querySelectorAll("ruby.g-tricky").length, withIpa: document.querySelectorAll("p.with-ipa").length }));
            if (before.ruby === after.ruby && before.withIpa === after.withIpa) {
              record(route.path, "interaction", `IPA toggle did not change rendering (ruby ${before.ruby}->${after.ruby}, withIpa ${before.withIpa}->${after.withIpa})`);
            }
          }
          const para = await page.locator("#readingRoot [data-paragraph]").count();
          if (para < 1) record(route.path, "ui", "reading detail has 0 paragraphs");

          for (const cfg of [{ id: "#toggleIntonation", token: "intonationOn", label: "intonation" }, { id: "#toggleChunking", token: "chunkingOn", label: "chunking" }]) {
            const has = await page.locator(`#readingRoot ${cfg.id}`).count();
            if (has !== 1) record(route.path, "ui", `${cfg.label} toggle missing`);
            else {
              const beforeText = await page.locator(`#readingRoot ${cfg.id}`).innerText().catch(() => "");
              await page.locator(`#readingRoot ${cfg.id}`).click({ delay: 30 }).catch(() => {});
              await page.waitForTimeout(400);
              const afterText = await page.locator(`#readingRoot ${cfg.id}`).innerText().catch(() => "");
              if (beforeText && beforeText === afterText) record(route.path, "interaction", `${cfg.label} toggle did not change button label`);
            }
          }
        }

        if (exp.landingCta) {
          const cta = await page.locator("a.btn, a.drill-cta, a[href='/home'], a[href='/question-answer'], a[href='/take-test/custom-strict'], a[href='/alphafeature/pronun'], a[href='/login'], a[href='/landing']").count();
          if (cta < 1) record(route.path, "ui", `landing page CTA missing (count=${cta})`);
          const heroH1 = await page.locator("h1").first().innerText().catch(() => "");
          if (!heroH1 || heroH1.length < 3) record(route.path, "ui", `landing hero h1 missing/short: '${heroH1}'`);
        }

        if (exp.pronunLesson) {
          const card = await page.locator(".pc-card").count();
          if (card < 1) record(route.path, "ui", "pronun lesson missing .pc-card root");
          const nav = await page.locator(".pc-nav, .pc-lessonnav").count();
          if (nav < 1) record(route.path, "ui", "pronun lesson missing nav buttons");
          if (exp.pronunLesson.section === 1) {
            const iframe = await page.locator(".pc-card iframe[src*='youtube']").count();
            if (iframe < 1) record(route.path, "ui", "section1 missing youtube iframe");
          }
          if (exp.pronunLesson.section === 2) {
            const wordBtn = await page.locator(".pc-card button:has-text('Ghi âm')").count();
            if (wordBtn < 1) record(route.path, "ui", "section2 missing record button");
          }
          if (exp.pronunLesson.section === 3) {
            const recBtn = await page.locator("#pc-rec").count();
            if (recBtn < 1) record(route.path, "ui", "section3 missing #pc-rec record button");
          }
        }
      } catch (e) {
        record(route.path, "audit", e.message);
      }
    }

    if (!page.isClosed()) await page.close();
  }

  for (const probe of API_PROBES) {
    const url = BASE + probe.path;
    let res;
    try { res = await context.request.get(url, { timeout: 15000 }); }
    catch (e) { record(probe.path, "api", e.message); continue; }
    if (res.status() >= 400) { record(probe.path, "api", `HTTP ${res.status()}`); continue; }
    const data = await res.json().catch(() => null);
    if (!data || data.ok === false) record(probe.path, "api", "invalid JSON or ok=false");
    if (probe.requireField && data && data[probe.requireField] === undefined) {
      record(probe.path, "api", `missing field ${probe.requireField}`);
    }
  }

  for (const path of ASSET_PROBES) {
    const url = BASE + path;
    let res;
    try { res = await context.request.get(url, { timeout: 15000 }); }
    catch (e) { record(path, "asset", e.message); continue; }
    if (res.status() >= 400) record(path, "asset", `HTTP ${res.status()}`);
    if (path.endsWith(".json")) {
      const data = await res.json().catch(() => null);
      if (!data) record(path, "asset", "json parse failed");
    }
  }

  await browser.close();

  if (!findings.length) {
    console.log(`OK: 0 findings on ${ROUTES.length} routes, ${API_PROBES.length} APIs, ${ASSET_PROBES.length} assets (${BASE})`);
    process.exit(0);
  }

  const grouped = {};
  for (const f of findings) {
    grouped[f.route] = grouped[f.route] || [];
    grouped[f.route].push(`${f.kind}: ${f.msg}`);
  }
  for (const [route, items] of Object.entries(grouped)) {
    console.log(`\n${route} (${items.length})`);
    for (const it of items) console.log(`  - ${it}`);
  }
  console.log(`\nTotal findings: ${findings.length} (${BASE})`);
  process.exit(1);
})().catch((e) => {
  console.error("[audit] fatal:", e);
  process.exit(2);
});
