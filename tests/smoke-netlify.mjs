import { chromium } from "playwright";

const BASE = process.argv[2] || process.env.LN_BASE || "https://luyennoi.netlify.app";
const ROUTES = [
  "/",
  "/home",
  "/question-answer",
  "/question-answer/part1",
  "/question-answer/part2",
  "/question-answer/part3",
  "/question-answer/PART%202~Describe%20a%20person%20who%20is%20good%20at%20learning%20and%20speaking%20new%20languages",
  "/take-test/home",
  "/take-test/full-test",
  "/alphafeature/pronun",
  "/reading/short-stories",
  "/settings"
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

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 LuyennoiSmoke/1.0",
    locale: "vi-VN"
  });

  for (const route of ROUTES) {
    const url = BASE + route;
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];

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
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2500);
    } catch (e) {
      record(route, "nav", e.message);
    }

    consoleErrors.forEach((e) => record(route, "console", e));
    pageErrors.forEach((e) => record(route, "page-error", e));
    failedRequests.forEach((e) => record(route, "request", e));

    if (/^\/question-answer\/part[123]$/i.test(route)) {
      const toggleCount = await page.locator(":text-matches(\"^\\\\s*(Ẩn|Hiện) câu đã (trả lời|làm rồi)\")").count();
      if (toggleCount > 1) record(route, "ui", `multiple answered toggles: ${toggleCount}`);
      const stickyScore = await page.locator("#ln-score-panel").count();
      if (stickyScore > 0) record(route, "ui", "score panel showing on library page");
    }

    await page.close();
  }

  await browser.close();

  if (!findings.length) {
    console.log(`OK: 0 findings on ${ROUTES.length} routes (${BASE})`);
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
