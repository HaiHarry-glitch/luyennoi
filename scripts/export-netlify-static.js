import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = process.cwd();
const publicDir = join(root, "public");
const realDir = join(publicDir, "real");

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
  ["font-medium","font-medium"],
];

function fixMojibake(html) {
  let out = html;
  for (const [bad, good] of MOJIBAKE) {
    out = out.split(bad).join(good);
  }
  return out;
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
  const tag = `
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Fraunces:opsz,wght@9..144,400;9..144,700;9..144,900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/neo-brutalism.css">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"><\/script>
<script src="/auth.js" defer><\/script>
<script src="/sidebar.js"><\/script>
<script src="/real-overlay.js"><\/script>`;
  if (html.includes("/real-overlay.js")) return html;
  if (html.includes("<head>")) return html.replace("<head>", "<head>" + tag);
  if (html.includes("<head ")) return html.replace(/(<head[^>]*>)/, "$1" + tag);
  return tag + html;
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
  const final = skipOverlay ? html : stripSvelteScripts(injectOverlay(fixMojibake(html)));
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
  "/alphafeature/join-us": "join-us.html"
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
      html = html.replace("</body>", '<script src="/full-test.js" defer></script></body>');
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
  await writeFile(detailOut, detailFinal, "utf8");
  console.log(`[export] /question-answer/detail.html -> ${detailOut}`);

  const home = await readReal("home.html");
  for (const feature of shellFeatures) {
    const mount = `<div id="${feature.mountId}" class="ln-feature-mount" style="padding:1.2rem 1.4rem;min-height:calc(100vh - 64px);"></div>`;
    const scripts = [`<script type="module" src="${feature.script}"></script>`];
    if (feature.extraScripts) feature.extraScripts.forEach(s => scripts.push(`<script src="${s}" defer></script>`));
    const html = withTitle(wrapInLuyennoiShell(home, mount, scripts), feature.title);
    await writeRoute(feature.route, html);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
