import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = process.cwd();
const publicDir = join(root, "public");
const realDir = join(publicDir, "real");
const ASSET_VERSION = "score-async-v17";

// ── Mojibake fix map (same as real-overlay.js fixMojibakeText) ──
const MOJIBAKE = [
  ["Luyá»‡n NÃ³i","Luyện Nói"],["Trang chá»§","Trang chủ"],
  ["Luyá»‡n theo cÃ¢u","Luyện theo câu"],["Thi thá»­","Thi thử"],
  ["BÃ i há»c","Bài học"],["Luyá»‡n táº­p tÆ°Æ¡ng tÃ¡c","Luyện tập tương tác"],
  ["cÃ¢u há»i","câu hỏi"],["cÃ¢u tráº£ lá»i","câu trả lời"],
  ["Ä'Ã¡nh giÃ¡","đánh giá"],["liÃªn tá»¥c","liên tục"],
  ["Nhiá»‡m vá»¥ hÃ´m nay","Nhiệm vụ hôm nay"],
  ["Tá»± Luyá»‡n IELTS Speaking Hiá»‡u Quáº£","Tự Luyện IELTS Speaking Hiệu Quả"],
  ["CÃ¡c tÃ­nh nÄƒng","Các tính năng"],["Day streak","Day streak"],
  ["Tráº£ lá»i","Trả lời"],["tháº³ng vÃ o trá»ng tÃ¢m","thẳng vào trọng tâm"],
  ["Sai sá»­a liá»n tay","Sai sửa liền tay"],
  ["LÆ°á»i quÃ¡","Lười quá"],["khÃ´ng luyá»‡n","không luyện"],
  ["vÃ o ngÃ y","vào ngày"],
  ["Äiá»ƒm trung bÃ¬nh","Điểm trung bình"],
  ["Äá»«ng vÃ²ng vo tam quá»'c","Đừng vòng vo tam quốc"],
  ["Chá»› Ä'á»ƒ lÃ¢u ngÃ y","Chớ để lâu ngày"],
  ["lá»—i quen thÃ nh thÃ³i xáº¥u","lỗi quen thành thói xấu"],
  ["sá»­a khÃ³ láº¯m","sửa khó lắm"],
  ["Ghi Ã¢m","Ghi âm"],["nhÃ©","nhé"],
  ["Luyá»‡n Ä'á»c","Luyện đọc"],["KhoÃ¡ phÃ¡t Ã¢m","Khoá phát âm"],
  ["Sá»• tá»« vá»±ng","Sổ từ vựng"],["CÃ¢u báº¡n thÃªm","Câu bạn thêm"],
  ["Luyá»‡n S/es","Luyện S/es"],["Luyá»‡n thÃ¬ quÃ¡ khá»©","Luyện thì quá khứ"],
  ["Luyá»‡n intonation","Luyện intonation"],["Luyá»‡n rhythm","Luyện rhythm"],
  ["Tá»± thÃªm cÃ¢u","Tự thêm câu"],
  ["Tá»± luyá»‡n IELTS Speaking hiá»‡u quáº£ vá»›i forecast má»›i nháº¥t, thi thá»­ vÃ\u00a0 cáº£i thiá»‡n táº¡i Luyennoi.","Tự luyện IELTS Speaking hiệu quả với forecast mới nhất, thi thử và cải thiện tại Luyennoi."],
  ["Tá»± luyá»‡n IELTS Speaking hiá»‡u quáº£ hiá»‡u quáº£ vá»›i forecast má»›i nháº¥t, thi thá»­ vÃ\u00a0 cáº£i thiá»‡n táº¡i Luyennoi.","Tự luyện IELTS Speaking hiệu quả với forecast mới nhất, thi thử và cải thiện tại Luyennoi."],
  ["font-medium","font-medium"],
];

const CP1252 = {
  0x20AC: 0x80, 0x0081: 0x81, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84,
  0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89,
  0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x008D: 0x8D, 0x017D: 0x8E,
  0x008F: 0x8F, 0x0090: 0x90, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93,
  0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98,
  0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x009D: 0x9D,
  0x017E: 0x9E, 0x0178: 0x9F
};
const MOJIBAKE_RUN_RE = /[\u0081\u008d\u008f\u0090\u009d\u00a0-\u00ff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2013\u2014\u2018\u2019\u201a\u201c\u201d\u201e\u2020\u2021\u2022\u2026\u2030\u2039\u203a\u20ac\u2122]+/g;

function expectedContinuations(lead) {
  if ((lead & 0xE0) === 0xC0) return 1;
  if ((lead & 0xF0) === 0xE0) return 2;
  if ((lead & 0xF8) === 0xF0) return 3;
  return 0;
}

function repairBytes(bytes) {
  let i = 0;
  const out = [];
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) { out.push(b); i++; continue; }
    const need = expectedContinuations(b);
    if (need === 0) return null;
    const seq = [b];
    let j = i + 1;
    while (seq.length < 1 + need) {
      if (j < bytes.length && (bytes[j] & 0xC0) === 0x80) { seq.push(bytes[j]); j++; }
      else if (seq.length === 1 && need >= 2) seq.push(0x90);
      else if (seq.length === 2 && need === 2) seq.push(0x8D);
      else if (seq.length === 1 && need === 1 && b === 0xC4) seq.push(0x90);
      else return null;
    }
    out.push(...seq);
    i = j;
  }
  return out;
}

function decodeMojibakeRun(text) {
  if (!text) return text;
  const bytes = [];
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (c <= 0xff) bytes.push(c);
    else if (CP1252[c] !== undefined) bytes.push(CP1252[c]);
    else return text;
  }
  const tryDecode = (arr) => {
    try {
      const out = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(arr));
      return out.includes("\uFFFD") ? null : out;
    } catch { return null; }
  };
  const direct = tryDecode(bytes);
  if (direct) return direct;
  if (bytes.length < 2) return text;
  const lead = bytes[0];
  const isLead = (lead & 0xE0) === 0xC0 || (lead & 0xF0) === 0xE0 || (lead & 0xF8) === 0xF0;
  if (!isLead) return text;
  const repaired = repairBytes(bytes);
  if (repaired) {
    const out = tryDecode(repaired);
    if (out) return out;
  }
  return text;
}

function fixMojibake(html) {
  let out = html;
  for (const [bad, good] of MOJIBAKE) {
    out = out.split(bad).join(good);
  }
  return out.replace(MOJIBAKE_RUN_RE, (m) => decodeMojibakeRun(m));
}

function stripSvelteScripts(html) {
  // Remove Svelte/SvelteKit hydration scripts and modulepreload — overlay handles UI.
  // Keep CSS/font preloads (purely visual).
  let out = html;
  out = out.replace(/<link[^>]+rel=["']modulepreload["'][^>]*>/gi, "");
  out = out.replace(/<script[^>]+type=["']module["'][^>]*>[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<script[^>]+src=["'][^"']*\/_app\/[^"']+["'][^>]*>\s*<\/script>/gi, "");
  // Remove preconnect/dns-prefetch to dead Cognito/Cloudfront origins to silence errors
  out = out.replace(/<link[^>]+(cognito-idp|difz6g2sivtgc)[^>]*>/gi, "");
  return out;
}

function injectOverlay(html) {
  html = html
    .replace(/<link[^>]+rel=["'](?:shortcut icon|icon|apple-touch-icon|mask-icon)["'][^>]*>/gi, "")
    .replace(/<link[^>]+rel=["']manifest["'][^>]*>/gi, "")
    .replace(/<meta[^>]+name=["']theme-color["'][^>]*>/gi, "");
  const iconTag = `
<link rel="icon" type="image/png" sizes="32x32" href="/real/favicon.png?v=logo3">
<link rel="icon" type="image/png" sizes="192x192" href="/real/icons/icon-192.png?v=logo3">
<link rel="shortcut icon" href="/real/favicon.ico?v=logo3">
<link rel="apple-touch-icon" sizes="180x180" href="/real/apple-touch-icon-iphone-retina-120x120.png?v=logo3">
<link rel="manifest" href="/real/manifest.webmanifest">
<meta name="theme-color" content="#d9381e">`;
  const tag = `
<meta charset="utf-8">
<style id="ln-curtain-css">html.ln-loading body{opacity:0!important}html.ln-rdy body{opacity:1;transition:opacity .18s ease-out}html.ln-loading::before{content:"";position:fixed;inset:0;background:#fff;z-index:2147483647;pointer-events:none}html.ln-rdy::before{display:none}</style>
<script id="ln-curtain-js">(function(){try{var d=document.documentElement;d.classList.add("ln-loading");window.__lnReveal=function(){if(!d.classList.contains("ln-loading"))return;d.classList.remove("ln-loading");d.classList.add("ln-rdy");};setTimeout(window.__lnReveal,2500);}catch(e){}})();<\/script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Fraunces:opsz,wght@9..144,400;9..144,700;9..144,900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/neo-brutalism.css">
${iconTag}
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"><\/script>
<script src="/auth.js?v=${ASSET_VERSION}" defer><\/script>
<script src="/sidebar.js?v=${ASSET_VERSION}"><\/script>
<script src="/real-overlay.js?v=${ASSET_VERSION}"><\/script>`;
  if (html.includes("/real-overlay.js")) {
    if (html.includes("<head>")) return html.replace("<head>", "<head>" + iconTag);
    if (html.includes("<head ")) return html.replace(/(<head[^>]*>)/, "$1" + iconTag);
    return iconTag + html;
  }
  if (html.includes("<head>")) return html.replace("<head>", "<head>" + tag);
  if (html.includes("<head ")) return html.replace(/(<head[^>]*>)/, "$1" + tag);
  return tag + html;
}

const SITE_URL = "https://luyennoi.netlify.app";
const SEO_DEFAULT_DESC = "HIN Luyện Nói: luyện IELTS Speaking miễn phí với đề Forecast, AI chấm chi tiết từng tiêu chí, Smart IPA và thi thử chống gian lận.";
const SEO_IMAGE = SITE_URL + "/real/icons/icon-512.png";

function escAttr(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Thêm thẻ SEO chuẩn cho mạng xã hội + canonical (Open Graph, Twitter Card).
// Lấy title + description sẵn có của trang để og/twitter khớp nội dung.
function injectSeo(html, route) {
  const url = SITE_URL + (route === "/" ? "/" : route);
  const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "HIN Luyện Nói | IELTS Speaking AI").trim();
  const desc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] || SEO_DEFAULT_DESC).trim();
  // Bỏ các thẻ favicon/manifest/theme/og/twitter/canonical cũ để tránh trùng + chèn lại
  // bộ chuẩn (favicon theo logo). injectSeo chạy cho MỌI trang (kể cả landing/login
  // skipOverlay) -> đảm bảo trang nào cũng có favicon logo + SEO đồng nhất.
  let out = html
    .replace(/<link[^>]+rel=["'](?:shortcut icon|icon|apple-touch-icon|mask-icon)["'][^>]*>/gi, "")
    .replace(/<link[^>]+rel=["']manifest["'][^>]*>/gi, "")
    .replace(/<meta[^>]+name=["']theme-color["'][^>]*>/gi, "")
    .replace(/<link[^>]+rel=["']canonical["'][^>]*>/gi, "")
    .replace(/<meta[^>]+property=["']og:[^"']*["'][^>]*>/gi, "")
    .replace(/<meta[^>]+name=["']twitter:[^"']*["'][^>]*>/gi, "");
  // Favicon đặt NGAY ĐẦU <head> để trình duyệt phát hiện sớm -> không nháy favicon cũ.
  // svg đứng đầu (trình duyệt hiện đại ưu tiên) + ico/png cho fallback. ?v=logo3 ép cache.
  const faviconHead = `
<link rel="icon" type="image/svg+xml" href="/real/favicon.svg?v=logo3">
<link rel="icon" type="image/png" sizes="32x32" href="/real/favicon.png?v=logo3">
<link rel="icon" type="image/png" sizes="192x192" href="/real/icons/icon-192.png?v=logo3">
<link rel="shortcut icon" href="/real/favicon.ico?v=logo3">
<link rel="apple-touch-icon" sizes="180x180" href="/real/apple-touch-icon-iphone-retina-120x120.png?v=logo3">
<link rel="manifest" href="/real/manifest.webmanifest">
<meta name="theme-color" content="#d9381e">`;
  const seoMeta = `
<link rel="canonical" href="${escAttr(url)}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="HIN Luyện Nói">
<meta property="og:locale" content="vi_VN">
<meta property="og:title" content="${escAttr(title)}">
<meta property="og:description" content="${escAttr(desc)}">
<meta property="og:url" content="${escAttr(url)}">
<meta property="og:image" content="${SEO_IMAGE}">
<meta property="og:image:width" content="512">
<meta property="og:image:height" content="512">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escAttr(title)}">
<meta name="twitter:description" content="${escAttr(desc)}">
<meta name="twitter:image" content="${SEO_IMAGE}">`;
  // Chèn favicon ngay sau <head ...>; SEO meta trước </head>.
  if (/<head[^>]*>/i.test(out)) out = out.replace(/(<head[^>]*>)/i, `$1${faviconHead}`);
  else out = faviconHead + out;
  if (out.includes("</head>")) return out.replace("</head>", seoMeta + "\n</head>");
  return out + seoMeta;
}

function versionAssets(html) {
  return html
    .replace(/(["'])\/auth\.js(?:\?[^"']*)?\1/g, `$1/auth.js?v=${ASSET_VERSION}$1`)
    .replace(/(["'])\/real-overlay\.js(?:\?[^"']*)?\1/g, `$1/real-overlay.js?v=${ASSET_VERSION}$1`)
    .replace(/(["'])\/sidebar\.js(?:\?[^"']*)?\1/g, `$1/sidebar.js?v=${ASSET_VERSION}$1`)
    .replace(/(["'])\/full-test\.js(?:\?[^"']*)?\1/g, `$1/full-test.js?v=${ASSET_VERSION}$1`)
    .replace(/(["'])\/neo-brutalism\.css(?:\?[^"']*)?\1/g, `$1/neo-brutalism.css?v=${ASSET_VERSION}$1`);
}

function wrapInLuyennoiShell(homeHtml, mountHtml, extraScripts = []) {
  const containerRe = /(<div class="flex-1 overflow-y-auto overflow-x-hidden"[^>]*>)([\s\S]*?)(<\/div>\s*<\/div>\s*<\/div>\s*<div class="md:hidden">)/;
  let out = homeHtml;
  if (containerRe.test(out)) {
    out = out.replace(containerRe, (_, open, _inner, tail) => `${open}<div class="h-full w-full overflow-y-auto" id="ln-feature-root">${mountHtml}</div>${tail}`);
  } else {
    out = out.replace("</body>", `<div id="ln-feature-root">${mountHtml}</div></body>`);
  }
  if (extraScripts.length) out = out.replace("</body>", extraScripts.join("\n") + "</body>");
  return out;
}

function withTitle(html, title) {
  return html.replace(/(<title[^>]*>)[^<]*(<\/title>)/i, `$1${title} | Luyện Nói$2`);
}

async function readReal(name) {
  const p = name.startsWith("..") ? join(publicDir, name.replace(/^\.\.\//, "")) : join(realDir, name);
  return readFile(p, "utf8");
}

const NO_OVERLAY = new Set(["../landing-new.html", "landing.html"]);

async function writeRoute(route, html, { skipOverlay = false } = {}) {
  const outPath = route === "/" ? join(publicDir, "index.html") : join(publicDir, route.replace(/^\/+/, ""), "index.html");
  await mkdir(dirname(outPath), { recursive: true });
  const final = versionAssets(injectSeo(skipOverlay ? html : stripSvelteScripts(injectOverlay(fixMojibake(html))), route));
  await writeFile(outPath, final, "utf8");
  console.log(`[export] ${route} -> ${outPath}${skipOverlay ? " (no overlay)" : ""}`);
}

const routeMap = {
  "/": "../landing-new.html",
  "/home": "home.html",
  "/login": "../landing-new.html",
  "/landing": "../landing-new.html",
  "/question-answer": "question-answer.html",
  "/question-answer/part1": "part1.html",
  "/question-answer/part2": "part2.html",
  "/question-answer/part3": "part3.html",
  "/take-test": "take-test-home.html",
  "/take-test/home": "take-test-home.html",
  "/take-test/full-test": "take-test-full.html",
  "/take-test/part1": "take-test-full.html",
  "/take-test/part2": "take-test-full.html",
  "/take-test/part3": "take-test-full.html",
  "/take-test/custom-strict": "take-test-full.html",
  "/alphafeature/payment": "payment.html",
  "/alphafeature/set-voice": "set-voice.html",
  "/alphafeature/setup-mic": "setup-mic.html",
  "/alphafeature/join-us": "join-us.html",
  "/profile/teaching/landing-page": "teaching-landing.html"
};

const shellFeatures = [
  { route: "/reading", title: "Luyện đọc", mountId: "readingRoot", script: "/reading.js" },
  { route: "/alphafeature/pronun", title: "Khoá phát âm", mountId: "pronunRoot", script: "/pronun-tabs.js", extraScripts: ["/pronun-course.js"] },
  { route: "/alphafeature/vocab", title: "Sổ từ vựng", mountId: "vocabRoot", script: "/vocab.js" },
  { route: "/question-answer/user-question", title: "Câu bạn thêm", mountId: "userQuestionRoot", script: "/user-question.js" },
  { route: "/alphafeature/boxing", title: "Luyện S/es", mountId: "boxingRoot", script: "/boxing.js" },
  { route: "/alphafeature/past-tense", title: "Luyện thì quá khứ", mountId: "pastTenseRoot", script: "/past-tense.js" },
  { route: "/alphafeature/intonation", title: "Luyện intonation", mountId: "intonationRoot", script: "/intonation.js" },
  { route: "/alphafeature/rhythm", title: "Luyện rhythm", mountId: "rhythmRoot", script: "/rhythm.js" }
];

async function main() {
  for (const [route, file] of Object.entries(routeMap)) {
    let html = await readReal(file);
    if (file === "take-test-full.html" && !html.includes("/full-test.js")) {
      html = html.replace("</body>", `<script src="/full-test.js?v=${ASSET_VERSION}" defer></script></body>`);
    }
    await writeRoute(route, html, { skipOverlay: NO_OVERLAY.has(file) });
  }

  // Question detail catch-all page: served for /question-answer/PART... URLs
  // Inject a client-side substitution script that parses the URL and replaces the template text
  const detailHtml = await readReal("detail-sample.html");
  const substScript = `<script>(function(){
    try {
      var raw = decodeURIComponent(location.pathname.replace(/^\\/question-answer\\//i, ""));
      var t = raw.indexOf("~");
      var part = t > -1 ? raw.slice(0, t).trim() : "PART 1";
      var question = t > -1 ? raw.slice(t + 1).trim() : "";
      if (!question) return;
      var safeQ = question.replace(/[<>"]/g, "");
      document.title = safeQ + " | Luyện Nói";
      function replaceTextNodes(root) {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        var nodes = [];
        var n;
        while ((n = walker.nextNode())) nodes.push(n);
        nodes.forEach(function(node){
          if (node.nodeValue && node.nodeValue.indexOf("Do you wear a watch?") > -1) {
            node.nodeValue = node.nodeValue.replace(/Do you wear a watch\\?/g, safeQ);
          }
        });
        document.querySelectorAll('[data-tip*="Bạn có đeo đồng hồ"]').forEach(function(el){ el.removeAttribute("data-tip"); });
      }
      function run() { replaceTextNodes(document.body); }
      if (document.body) run(); else document.addEventListener("DOMContentLoaded", run);
      // Re-run after Svelte hydration / overlay patches
      setTimeout(run, 500);
      setTimeout(run, 1500);
    } catch(e) { console.error("[detail-subst]", e); }
  })();</script>`;
  const detailOut = join(publicDir, "question-answer", "detail.html");
  await mkdir(dirname(detailOut), { recursive: true });
  let detailFinal = stripSvelteScripts(injectOverlay(fixMojibake(detailHtml)));
  detailFinal = detailFinal.replace("</head>", substScript + "</head>");
  await writeFile(detailOut, versionAssets(detailFinal), "utf8");
  console.log(`[export] /question-answer/detail.html -> ${detailOut}`);

  const home = await readReal("home.html");
  for (const feature of shellFeatures) {
    const mount = `<div id="${feature.mountId}" class="ln-feature-mount" style="padding:1.2rem 1.4rem;min-height:calc(100vh - 64px);"></div>`;
    const scripts = [`<script src="${feature.script}" defer></script>`];
    if (feature.extraScripts) feature.extraScripts.forEach(s => scripts.push(`<script src="${s}" defer></script>`));
    const html = withTitle(wrapInLuyennoiShell(home, mount, scripts), feature.title);
    await writeRoute(feature.route, html);
  }

  // Copy LuyenDoc IPA dictionary chunk so overlay can load it on Netlify
  const dictSrc = join(root, "LuyenNoi", "public", "_app", "immutable", "chunks", "BhbigMMl.js");
  const dictDst = join(publicDir, "luyendoc", "_app", "immutable", "chunks", "BhbigMMl.js");
  try {
    await mkdir(dirname(dictDst), { recursive: true });
    await copyFile(dictSrc, dictDst);
    console.log(`[export] LuyenDoc IPA dict -> ${dictDst}`);
  } catch (e) {
    console.warn(`[export] LuyenDoc IPA dict not found — IPA will fall back to Gemini API: ${e.message}`);
  }

  // ── SEO: robots.txt + sitemap.xml ──
  const seoRoutes = [
    "/", "/home", "/question-answer", "/question-answer/part1", "/question-answer/part2",
    "/question-answer/part3", "/question-answer/user-question", "/take-test", "/take-test/full-test",
    "/reading", "/alphafeature/pronun", "/alphafeature/vocab", "/alphafeature/boxing",
    "/alphafeature/past-tense", "/alphafeature/intonation", "/alphafeature/rhythm"
  ];
  const today = new Date().toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${seoRoutes.map(r => `  <url><loc>${SITE_URL}${r === "/" ? "/" : r}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${r === "/" ? "1.0" : "0.7"}</priority></url>`).join("\n")}
</urlset>
`;
  await writeFile(join(publicDir, "sitemap.xml"), sitemap, "utf8");
  const robots = `User-agent: *
Allow: /
Disallow: /api/
Sitemap: ${SITE_URL}/sitemap.xml
`;
  await writeFile(join(publicDir, "robots.txt"), robots, "utf8");
  console.log("[export] wrote sitemap.xml + robots.txt");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
