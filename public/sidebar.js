// sidebar.js — Standalone sidebar module for Luyện Nói clone.
// Renders a consistent sidebar across all pages with active-state highlighting.
(function () {
  if (window.LNSidebar) return;

  const SIDEBAR_ITEMS = [
    { href: "/", label: "Trang chủ" },
    {
      group: "Luyện tập tương tác",
      children: [
        { href: "/question-answer/part1", label: "Part 1" },
        { href: "/question-answer/part2", label: "Part 2" },
        { href: "/question-answer/part3", label: "Part 3" },
        { href: "/question-answer/user-question", label: "Tự thêm câu" },
      ]
    },
    {
      group: "Thi thử",
      children: [
        { href: "/take-test/part1", label: "Part 1" },
        { href: "/take-test/part2", label: "Part 2" },
        { href: "/take-test/part3", label: "Part 3" },
        { href: "/take-test/full-test", label: "Full test" },
        { href: "/take-test/custom-strict", label: "Tùy chọn đề" },
      ]
    },
    {
      group: "Bài học",
      children: [
        { href: "/reading", label: "Luyện đọc" },
        { href: "/alphafeature/pronun", label: "Khóa phát âm" },
        { href: "/alphafeature/vocab", label: "Sổ từ vựng" },
        { href: "/alphafeature/boxing", label: "Luyện S/es" },
        { href: "/alphafeature/past-tense", label: "Luyện thì quá khứ" },
        { href: "/alphafeature/intonation", label: "Luyện intonation" },
        { href: "/alphafeature/rhythm", label: "Luyện rhythm" },
      ]
    }
  ];

  function escHtml(s) {
    return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // Determine if a given href matches the current page
  function isActive(href) {
    const path = location.pathname;
    if (href === "/") return path === "/";
    // Exact match
    if (path === href) return true;
    // Detail page match: /question-answer/PART%201~... should match /question-answer/part1
    if (href === "/question-answer/part1" && /^\/question-answer\/PART\s*1/i.test(decodeURIComponent(path))) return true;
    if (href === "/question-answer/part2" && /^\/question-answer\/PART\s*2/i.test(decodeURIComponent(path))) return true;
    if (href === "/question-answer/part3" && /^\/question-answer\/PART\s*3/i.test(decodeURIComponent(path))) return true;
    // Sub-path match for grouped routes
    if (href !== "/" && path.startsWith(href + "/")) return true;
    return false;
  }

  // Check if any child in a group is active (to keep <details> open)
  function groupHasActive(children) {
    return children.some(c => isActive(c.href));
  }

  function buildNavHtml() {
    let html = "";
    for (const item of SIDEBAR_ITEMS) {
      if (item.href) {
        // Top-level link
        html += `<a class="${isActive(item.href) ? "active" : ""}" href="${item.href}">${escHtml(item.label)}</a>\n`;
      } else if (item.group) {
        // Group with children
        const hasActive = groupHasActive(item.children);
        html += `<details${hasActive ? " open" : ""}>\n`;
        html += `  <summary>${escHtml(item.group)}</summary>\n`;
        for (const child of item.children) {
          const active = isActive(child.href) ? " active" : "";
          html += `  <a class="${active.trim()}" href="${child.href}">${escHtml(child.label)}</a>\n`;
        }
        html += `</details>\n`;
      }
    }
    return html;
  }

  function getCurrentUserLabel() {
    try {
      const raw = localStorage.getItem("ln.user");
      if (raw) {
        const u = JSON.parse(raw);
        return u.name || u.display_name || u.email || "Học viên";
      }
    } catch {}
    return "Học viên";
  }

  function buildSidebarHtml() {
    const name = getCurrentUserLabel();
    const navHtml = buildNavHtml();
    return `
      <div style="display:flex;align-items:center;gap:6px;">
        <a class="ln-side-brand" href="/login"><img src="/hin-logo.png" alt=""><strong>HIN Luyện Nói</strong></a>
        <button type="button" class="ln-side-collapse" title="Thu/mở menu"></button>
      </div>
      <nav class="ln-side-nav">
        ${navHtml}
      </nav>
      <button type="button" class="ln-side-user"><span>${escHtml(name.slice(0, 1).toUpperCase())}</span><b>${escHtml(name)}</b><small>Xem dữ liệu học tập</small></button>`;
  }

  function wireEvents(aside, onUserClick) {
    if (!aside) return;
    aside.querySelector(".ln-side-collapse")?.addEventListener("click", (e) => {
      e.preventDefault();
      const next = !document.body.classList.contains("ln-sidebar-collapsed");
      document.body.classList.toggle("ln-sidebar-collapsed", next);
      try { localStorage.setItem("ln.sidebarCollapsed", next ? "1" : "0"); } catch {}
    });
    if (onUserClick) {
      aside.querySelector(".ln-side-user")?.addEventListener("click", onUserClick);
    }
  }

  // Main render: find or create the sidebar element and populate it
  function render(opts = {}) {
    const onUserClick = opts.onUserClick || null;
    const collapsed = (() => { try { return localStorage.getItem("ln.sidebarCollapsed") === "1"; } catch { return false; } })();
    document.body.classList.toggle("ln-sidebar-collapsed", collapsed);

    const html = buildSidebarHtml();

    const wireSingle = (aside) => {
      if (!aside) return;
      aside.classList.add("ln-sidebar-shell");
      aside.innerHTML = html;
      wireEvents(aside, onUserClick);
    };

    // Find existing sidebar candidates
    const candidates = [
      ...[...document.querySelectorAll("div")].filter(el =>
        /\bmd:block\b/.test(String(el.className || "")) &&
        /Trang|Luyen|Luyện|Thi|Mua/i.test(el.innerText || "")
      ),
      ...document.querySelectorAll("aside, .drawer-side, [class*='drawer-side'], ul.menu")
    ];

    let patched = false;
    const seen = new Set();
    candidates.forEach((aside) => {
      if (!aside || seen.has(aside) || aside.id === "lnFixedUserBadge") return;
      seen.add(aside);
      if (aside.classList.contains("ln-sidebar-shell")) { patched = true; return; }
      const txt = aside.innerText || "";
      if (!/Trang|Luyen|Luyện|Thi|Mua/i.test(txt)) return;
      wireSingle(aside);
      patched = true;
    });

    // If no existing element found, create a fixed sidebar
    if (!patched && !document.querySelector(".ln-sidebar-shell")) {
      const aside = document.createElement("aside");
      aside.className = "ln-sidebar-fixed";
      wireSingle(aside);
      document.body.prepend(aside);
      document.body.classList.add("ln-has-fixed-sidebar");
    }

    // Hide duplicates — keep only the first
    const allSidebars = [...document.querySelectorAll(".ln-sidebar-shell")];
    let kept = null;
    allSidebars.forEach((el) => {
      if (!kept) {
        kept = el;
        el.style.removeProperty("display");
        el.removeAttribute("data-ln-hidden-duplicate");
      } else {
        el.style.display = "none";
        el.setAttribute("data-ln-hidden-duplicate", "1");
      }
    });
  }

  window.LNSidebar = { render, buildSidebarHtml, buildNavHtml, isActive, SIDEBAR_ITEMS };
})();
