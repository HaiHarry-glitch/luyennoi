import { chromium } from "playwright";

const BASE = process.argv[2] || process.env.LN_BASE || "https://luyennoi.netlify.app";
const ROUTES = [
  { path: "/" },
  { path: "/home" },
  { path: "/question-answer" },
  { path: "/question-answer/part1" },
  { path: "/question-answer/part2" },
  { path: "/question-answer/part3" },
  { path: "/question-answer/PART%202~Describe%20a%20person%20who%20is%20good%20at%20learning%20and%20speaking%20new%20languages" },
  { path: "/take-test/home" },
  { path: "/take-test/full-test" },
  { path: "/alphafeature/pronun" },
  { path: "/reading", checkMojibake: true },
  { path: "/reading/short-stories" },
  { path: "/settings", final: ["/home", "/home/"] },
  { path: "/settings/", final: ["/home", "/home/"] }
];

const API_PROBES = [
  "/api/models",
  "/api/auth/user",
  "/api/practice-attempts",
  "/api/supabase/config"
];

const ASSET_PROBES = [
  "/real/manifest.webmanifest",
  "/real/icons/icon-192.png",
  "/neo-brutalism.css",
  "/real-overlay.js"
];

const ALLOWED_404 = [
  "favicon.ico"
];

const ALLOWED_CONSOLE_PATTERNS = [
  /preloaded using link preload but not used/i,
  /A preload for .* is found, but is not used because the request credentials/i,
  /Failed to load resource: the server responded with a status of 401/i,
  /Failed to load resource: the server responded with a status of 403/i
];

const findings = [];
function record(route, kind, msg) {
  findings.push({ route, kind, msg });
}

function normalizePath(path) {
  let out = path || "/";
  try { out = decodeURIComponent(out); } catch {}
  out = out.replace(/\/+$/, "");
  return out || "/";
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 LuyennoiSmoke/1.0",
    locale: "vi-VN"
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
        if (!ALLOWED_CONSOLE_PATTERNS.some((re) => re.test(text))) {
          consoleErrors.push(text);
        }
      }
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("requestfailed", (req) => {
      const url = req.url();
      if (ALLOWED_404.some((p) => url.includes(p))) return;
      failedRequests.push(`${req.failure()?.errorText} ${url}`);
    });
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
      const expectedPaths = (route.final || [route.path]).map(normalizePath);
      if (!expectedPaths.includes(finalPath)) {
        record(route.path, "route", `expected ${expectedPaths.join(" or ")}, got ${finalPath}`);
      }
    } catch (e) {
      record(route.path, "nav", e.message);
    }

    consoleErrors.forEach((e) => record(route.path, "console", e));
    pageErrors.forEach((e) => record(route.path, "page-error", e));
    failedRequests.forEach((e) => record(route.path, "request", e));

    if (navOk && !page.isClosed()) {
      try {
        const bodyText = await page.locator("body").innerText().catch(() => "");
        const mojibakeRe = /[\u0081\u008d\u008f\u0090\u009d]|Ã[\u00A0-\u00FF]|Ä[ƒ\u00A0-\u00FF]|Æ°|á»‡|á»‹|á»c/;
        if (mojibakeRe.test(bodyText)) {
          const sample = (bodyText.match(/[^\s]{0,40}(Ã[^\s]{0,15}|Ä[^\s]{0,15}|Æ°[^\s]{0,15}|á»[^\s]{0,15}|[\u0081\u008d\u008f\u0090\u009d][^\s]{0,15})/) || [bodyText.slice(0, 80)])[0];
          record(route.path, "mojibake", `garbled Vietnamese: ${sample}`);
        }
        if (/^\/question-answer\/part[123]$/i.test(route.path)) {
          const toggleCount = await page.locator(":text-matches(\"^\\\\s*(Ẩn|Hiện) câu đã (trả lời|làm rồi)\")").count();
          if (toggleCount !== 1) record(route.path, "ui", `answered toggle count: ${toggleCount}`);
          const stickyScore = await page.locator("#ln-score-panel").count();
          if (stickyScore > 0) record(route.path, "ui", "score panel showing on library page");
          const cardCount = await page.locator('a[href*="/question-answer/PART"], .question-card, .qa-question-card, [class*="QuestionCard"], [data-question]').count();
          if (cardCount < 1) record(route.path, "ui", "no question cards found");
        }

        if (route.path.includes("~")) {
          const body = await page.locator("body").innerText().catch(() => "");
          if (!/Describe a person who is good at learning and speaking new languages/i.test(body)) {
            record(route.path, "ui", "detail question text not rendered");
          }
        }
      } catch (e) {
        record(route.path, "ui", e.message);
      }
    }

    if (!page.isClosed()) await page.close();
  }

  for (const path of API_PROBES) {
    let res;
    try {
      res = await context.request.get(BASE + path, { timeout: 15000 });
    } catch (e) {
      record(path, "api", e.message);
      continue;
    }
    if (res.status() >= 400) {
      record(path, "api", `HTTP ${res.status()}`);
      continue;
    }
    const data = await res.json().catch(() => null);
    if (!data || data.ok === false) record(path, "api", "invalid JSON response");
    if (path === "/api/models" && !Array.isArray(data?.models)) record(path, "api", "missing models array");
  }

  for (const path of ASSET_PROBES) {
    let res;
    try {
      res = await context.request.get(BASE + path, { timeout: 15000 });
    } catch (e) {
      record(path, "asset", e.message);
      continue;
    }
    if (res.status() >= 400) record(path, "asset", `HTTP ${res.status()}`);
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
    items.forEach((it) => console.log("  - " + it));
  }
  console.log(`\nTotal findings: ${findings.length}`);
  process.exit(1);
})().catch((e) => {
  console.error("[smoke] fatal:", e);
  process.exit(2);
});
