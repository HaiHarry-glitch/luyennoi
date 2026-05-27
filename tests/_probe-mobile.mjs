import { chromium, devices } from "playwright";

const base = process.argv[2] || "https://luyennoi.netlify.app";

const ROUTES = [
  "/",
  "/home",
  "/login",
  "/question-answer",
  "/question-answer/part1",
  "/question-answer/PART%202~Describe%20a%20person%20who%20is%20good%20at%20learning%20and%20speaking%20new%20languages",
  "/take-test/home",
  "/take-test/full-test",
  "/reading",
  "/reading/postcards-from-paradise-my-trip-to-the-coast",
  "/alphafeature/pronun",
  "/alphafeature/pronun/lesson1/section1",
  "/alphafeature/vocab",
  "/alphafeature/boxing"
];

const VIEWPORT = { width: 390, height: 844 };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: UA,
  locale: "vi-VN"
});

const findings = [];

for (const path of ROUTES) {
  const p = await ctx.newPage();
  try {
    await p.goto(base + path, { waitUntil: "domcontentloaded", timeout: 30000 });
    await p.waitForTimeout(1800);
    const v = await p.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      const sidebar = document.querySelector(".ln-sidebar-shell, .ln-sidebar-fixed, aside.sidebar");
      const sidebarRect = sidebar ? sidebar.getBoundingClientRect() : null;
      const sidebarStyle = sidebar ? getComputedStyle(sidebar) : null;
      const main = document.querySelector("main, #ln-feature-root, #readingRoot, #pronunRoot, #vocabRoot");
      const mainRect = main ? main.getBoundingClientRect() : null;
      // Look for elements overflowing the viewport, skipping those inside scroll/overflow-clipped containers
      const overflowEls = [];
      const insideScrollAncestor = (el) => {
        let cur = el.parentElement;
        while (cur && cur !== document.body) {
          const cs = getComputedStyle(cur);
          if (/auto|scroll|hidden|clip/.test(cs.overflowX) || /auto|scroll|hidden|clip/.test(cs.overflow)) return true;
          cur = cur.parentElement;
        }
        return false;
      };
      document.querySelectorAll("*").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > window.innerWidth + 1 && !insideScrollAncestor(el)) {
          overflowEls.push({
            tag: el.tagName,
            id: el.id,
            cls: (el.className || "").toString().slice(0, 50),
            right: Math.round(r.right),
            w: Math.round(r.width)
          });
        }
      });
      // Find tap targets smaller than 32x32 css
      const smallTargets = [];
      document.querySelectorAll("button, a").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && (r.width < 28 || r.height < 28)) {
          smallTargets.push({
            tag: el.tagName,
            text: (el.textContent || "").trim().slice(0, 30),
            w: Math.round(r.width),
            h: Math.round(r.height)
          });
        }
      });
      return {
        bodyScrollWidth: body.scrollWidth,
        innerWidth: window.innerWidth,
        horizontalScroll: body.scrollWidth > window.innerWidth + 2,
        sidebar: sidebar ? {
          width: Math.round(sidebarRect.width),
          left: Math.round(sidebarRect.left),
          display: sidebarStyle.display,
          position: sidebarStyle.position
        } : null,
        main: mainRect ? { left: Math.round(mainRect.left), width: Math.round(mainRect.width) } : null,
        overflowEls: overflowEls.slice(0, 8),
        overflowCount: overflowEls.length,
        smallTargets: smallTargets.slice(0, 5),
        smallTargetCount: smallTargets.length
      };
    });
    const issues = [];
    if (v.horizontalScroll) issues.push(`horizontal-scroll scroll=${v.bodyScrollWidth} vw=${v.innerWidth}`);
    if (v.sidebar && v.sidebar.width > v.innerWidth * 0.7 && v.sidebar.display !== "none") issues.push(`sidebar too wide ${v.sidebar.width}px (${v.sidebar.display}) covering content`);
    if (v.main && v.main.left > v.innerWidth * 0.5) issues.push(`main starts off-screen at left=${v.main.left}`);
    if (v.overflowCount > 3) issues.push(`${v.overflowCount} elements overflow viewport`);
    if (v.smallTargetCount > 5) issues.push(`${v.smallTargetCount} small tap targets (<28px)`);

    if (issues.length) {
      findings.push({ path, issues, detail: { overflowSamples: v.overflowEls, smallSamples: v.smallTargets, sidebar: v.sidebar } });
    }
  } catch (e) {
    findings.push({ path, issues: [`nav: ${e.message}`] });
  }
  await p.close();
}
await b.close();

if (!findings.length) {
  console.log(`MOBILE OK: 0 findings on ${ROUTES.length} routes (${base})`);
  process.exit(0);
}
for (const f of findings) {
  console.log(`\n${f.path}`);
  f.issues.forEach((i) => console.log(`  - ${i}`));
  if (f.detail) {
    if (f.detail.sidebar) console.log(`  sidebar:`, JSON.stringify(f.detail.sidebar));
    if (f.detail.overflowSamples?.length) console.log(`  overflow samples:`, JSON.stringify(f.detail.overflowSamples, null, 2));
    if (f.detail.smallSamples?.length) console.log(`  small targets:`, JSON.stringify(f.detail.smallSamples, null, 2));
  }
}
console.log(`\nTotal: ${findings.length} routes with issues`);
process.exit(1);
