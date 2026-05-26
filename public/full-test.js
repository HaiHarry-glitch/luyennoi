// =====================================================================
//  Luyện Nói — Full Test mode (custom IELTS-realistic flow)
//  Activates only on /take-test/full-test. Takes over the page UI.
//  Phase 1: setup screen + Part 1 flow (TTS → auto-record → press to advance).
//  Phase 2+: Part 2 cue card with 1-min prep, Part 3 same-topic, adaptive scoring.
// =====================================================================
(function () {
  // Match full-test AND single-part test modes
  const pathMatch = location.pathname.match(/^\/take-test\/(full-test|part[123]|custom-strict)\/?$/);
  if (!pathMatch) return;
  const TEST_MODE = pathMatch[1];                  // "full-test" | "part1" | "part2" | "part3" | "custom-strict"
  const IS_CUSTOM_STRICT = TEST_MODE === "custom-strict";
  const PART_FILTER = (TEST_MODE === "full-test" || IS_CUSTOM_STRICT) ? null : TEST_MODE; // null = run all parts

  // ──────────────── State ────────────────
  const FT = {
    state: "loading",            // loading | setup | running | scoring | result
    voice: null,                 // SpeechSynthesisVoice
    voiceName: localStorage.getItem("ln.ttsVoice") || "",
    examMode: "strict",          // strict (timed) | relaxed
    questionCount: 3,            // Part 1: 3 questions per topic × 3 topics = 9 questions
    followUp: false,
    mode: TEST_MODE,             // for downstream branching
    strictSessionId: "",
    strictGuardActive: false,
    strictCancelled: false,
    strictEvents: [],
    selectedPart1Topics: [],
    selectedPart2Key: "",
    lockedQuestionIds: [],
    questions: { part1: [], part2: null, part3: [] },
    answers: [],                 // {section, topic, question, blob, audioUrl, transcript, score}
    currentIdx: 0,
    section: "part1",
    recorder: null,
    chunks: [],
    stream: null,
    recording: false,
    questionsData: null,         // loaded from /data/questions.json
  };

  // ──────────────── Utilities ────────────────
  const getKey = () => {
    try {
      const multi = JSON.parse(localStorage.getItem("luyennoi.geminiKeys") || "[]");
      return multi[0] || localStorage.getItem("luyennoi.geminiKey") || "";
    } catch { return localStorage.getItem("luyennoi.geminiKey") || ""; }
  };
  const getModel = () => localStorage.getItem("luyennoi.geminiModel") || "";

  function strictEvent(event_type, event_payload = {}) {
    if (!IS_CUSTOM_STRICT) return;
    const event = {
      session_id: FT.strictSessionId || "",
      event_type,
      event_payload,
      page_path: location.pathname,
      created_at: new Date().toISOString()
    };
    FT.strictEvents.push(event);
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event)
    }).catch(() => {});
  }

  async function startStrictSession() {
    const res = await fetch("/api/test-sessions/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        test_type: "custom_strict",
        strict_mode: true,
        fullscreen_required: true,
        selected_part1_topics: FT.selectedPart1Topics,
        selected_part2_topic: FT.questions.part2?.title || FT.selectedPart2Key,
        derived_part3_topic: FT.questions.part2?.title || "",
        generated_question_ids: FT.lockedQuestionIds
      })
    });
    const data = await res.json();
    FT.strictSessionId = data.session?.id || "";
    strictEvent("strict_test_started", { selectedPart1Topics: FT.selectedPart1Topics, selectedPart2Topic: FT.questions.part2?.title || "" });
  }

  async function finishStrictSession(status, reason = "", extra = {}) {
    if (!IS_CUSTOM_STRICT || !FT.strictSessionId) return;
    const action = status === "completed" ? "complete" : status === "cancelled" ? "cancel" : "invalidate";
    await fetch(`/api/test-sessions/${FT.strictSessionId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, anti_cheat_summary: { events: FT.strictEvents.length, ...extra } })
    }).catch(() => {});
  }

  async function enterStrictFullscreen() {
    if (!IS_CUSTOM_STRICT) return true;
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      try {
        await el.requestFullscreen({ navigationUI: "hide" });
        strictEvent("fullscreen_enter");
      } catch (e) {
        strictEvent("fullscreen_denied", { message: e.message });
        return false;
      }
    }
    return !!document.fullscreenElement || !el.requestFullscreen;
  }

  function installStrictGuards() {
    if (!IS_CUSTOM_STRICT || FT.strictGuardActive) return;
    FT.strictGuardActive = true;
    let hiddenAt = 0;
    const invalidate = async (reason, payload = {}) => {
      if (!FT.strictGuardActive || FT.strictCancelled) return;
      FT.strictCancelled = true;
      strictEvent("strict_test_invalidated", { reason, ...payload });
      try { FT.recorder?.stop(); } catch {}
      try { FT.stream?.getTracks().forEach(t => t.stop()); } catch {}
      await finishStrictSession("invalidated", reason, payload);
      alert("Bài thi chống gian lận đã bị hủy: " + reason + ". Bạn cần làm lại từ đầu.");
      location.href = "/take-test/home";
    };
    document.addEventListener("fullscreenchange", () => {
      if (FT.strictGuardActive && !document.fullscreenElement) {
        strictEvent("fullscreen_exit");
        invalidate("Thoát toàn màn hình");
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        strictEvent("visibility_hidden");
        invalidate("Ẩn tab/chuyển ứng dụng");
      } else {
        strictEvent("visibility_visible", { hiddenMs: hiddenAt ? Date.now() - hiddenAt : 0 });
      }
    });
    window.addEventListener("pagehide", () => {
      strictEvent("mobile_app_switch_suspected");
      navigator.sendBeacon?.("/api/events", JSON.stringify({ session_id: FT.strictSessionId, event_type: "pagehide", page_path: location.pathname }));
    });
    window.addEventListener("blur", () => strictEvent("window_blur"));
    window.addEventListener("focus", () => strictEvent("window_focus"));
    window.addEventListener("orientationchange", () => strictEvent("orientation_change", { orientation: screen.orientation?.type || "" }));
    window.addEventListener("beforeunload", () => {
      if (FT.strictGuardActive && !FT.strictCancelled) {
        navigator.sendBeacon?.("/api/events", JSON.stringify({ session_id: FT.strictSessionId, event_type: "strict_test_invalidated", event_payload: { reason: "reload_or_close" }, page_path: location.pathname }));
      }
    });
    document.addEventListener("copy", (e) => { e.preventDefault(); strictEvent("copy_detected"); });
    document.addEventListener("paste", (e) => { e.preventDefault(); strictEvent("paste_detected"); });
    document.addEventListener("contextmenu", (e) => { e.preventDefault(); strictEvent("contextmenu_blocked"); });
  }

  function pickRandom(arr, n) {
    const a = [...arr];
    const out = [];
    while (a.length && out.length < n) {
      out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
    }
    return out;
  }

  function speak(text) {
    return new Promise((resolve) => {
      if (!text || !window.speechSynthesis) { console.warn("[FT-TTS] skip — no text or no speechSynthesis"); return resolve(); }
      console.log("[FT-TTS] speaking:", String(text).slice(0, 60), "voices:", speechSynthesis.getVoices().length, "current voice:", FT.voice?.name || "(browser default)");
      try { speechSynthesis.cancel(); } catch {}
      // Some browsers get stuck in a "paused" state; explicitly resume.
      try { speechSynthesis.resume(); } catch {}
      const start = () => {
        const u = new SpeechSynthesisUtterance(String(text));
        u.lang = "en-GB";
        u.rate = 0.92;
        u.pitch = 1;
        u.volume = 1;
        // Only set voice if it's still in the current voices list (some Edge voices vanish)
        if (FT.voice) {
          const stillThere = speechSynthesis.getVoices().some(v => v.voiceURI === FT.voice.voiceURI || v.name === FT.voice.name);
          if (stillThere) u.voice = FT.voice;
        }
        let resolved = false;
        const done = () => { if (!resolved) { resolved = true; resolve(); } };
        u.onend = done;
        u.onerror = (ev) => {
          if (ev?.error && ev.error !== "interrupted" && ev.error !== "canceled") {
            console.warn("[FT-TTS] error", ev.error, ev);
          }
          done();
        };
        try { speechSynthesis.speak(u); } catch (e) { console.warn("[FT-TTS] speak threw", e); done(); }
        // Safety net — if onend/onerror never fires within a reasonable time, unblock the flow.
        // Roughly 0.06s per character + 1.5s base.
        const safetyMs = Math.max(2000, 1500 + text.length * 60);
        setTimeout(done, safetyMs);
      };
      // Tiny delay AFTER cancel — Chrome/Edge can ignore speak() if fired in the same tick as cancel
      setTimeout(start, 80);
    });
  }

  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  // Prompt user inline to enter a Gemini API key. Returns true if saved.
  function promptForApiKey() {
    return new Promise((resolve) => {
      document.getElementById("ft-key-modal")?.remove();
      const ov = document.createElement("div");
      ov.id = "ft-key-modal";
      // Append to #ft-root (NOT body) — mountRoot hides every other direct body child.
      // Use !important display so nothing else can hide it.
      ov.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:99999;display:flex !important;align-items:center;justify-content:center;font-family:Lexend,sans-serif;padding:1rem;";
      ov.innerHTML = `
        <div style="background:white;border-radius:1rem;max-width:480px;width:100%;box-shadow:0 12px 48px rgba(0,0,0,.25);padding:1.4rem 1.5rem;">
          <div style="font-size:.74rem;color:#9ca3af;font-weight:700;">CẦN API KEY</div>
          <h2 style="font-size:1.2rem;font-weight:700;color:#171717;margin:.2rem 0 .5rem;">Nhập Gemini API key</h2>
          <p style="font-size:.85rem;color:#4b5563;line-height:1.55;margin-bottom:1rem;">
            Bài thi cần Gemini để chấm điểm. Lấy key miễn phí tại
            <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:#d9381e;font-weight:600;">Google AI Studio</a>.
            Key được lưu trong trình duyệt của bạn, không gửi lên server bên thứ ba.
          </p>
          <input id="ft-key-input" type="password" placeholder="AIza..." autocomplete="off"
            style="width:100%;padding:.7rem .9rem;border:1.5px solid #e0e0f0;border-radius:.5rem;font-size:.95rem;outline:none;box-sizing:border-box;font-family:'Courier New',monospace;" />
          <div id="ft-key-error" style="display:none;color:var(--red);font-size:.78rem;margin-top:.4rem;"></div>
          <div style="display:flex;justify-content:space-between;gap:.5rem;margin-top:1.1rem;">
            <button class="ft-btn ft-btn-ghost" id="ft-key-cancel" style="padding:.55rem 1.1rem;">Để sau</button>
            <div style="display:flex;gap:.5rem;">
              <a class="ft-btn ft-btn-ghost" href="/settings" style="padding:.55rem 1rem;text-decoration:none;">⚙ Cài đặt</a>
              <button class="ft-btn ft-btn-primary" id="ft-key-save" style="padding:.55rem 1.1rem;">Lưu & tiếp tục</button>
            </div>
          </div>
        </div>
      `;
      // CRITICAL: append to #ft-root (not body) because mountRoot adds
      //   body > *:not(#ft-root):not(script) { display: none !important; }
      // which would otherwise hide our modal entirely.
      (root || document.getElementById("ft-root") || document.body).appendChild(ov);
      const input = ov.querySelector("#ft-key-input");
      const err = ov.querySelector("#ft-key-error");
      input.focus();
      const close = (ok) => { ov.remove(); resolve(ok); };
      const save = () => {
        const v = (input.value || "").trim();
        if (!v || !/^AIza[a-zA-Z0-9_\-]{10,}$/.test(v)) {
          err.style.display = "block";
          err.textContent = "Key trông không đúng định dạng. Phải bắt đầu bằng AIza...";
          input.style.borderColor = "var(--red)";
          return;
        }
        try {
          const arr = JSON.parse(localStorage.getItem("luyennoi.geminiKeys") || "[]");
          if (!arr.includes(v)) arr.unshift(v);
          localStorage.setItem("luyennoi.geminiKeys", JSON.stringify(arr));
          localStorage.setItem("luyennoi.geminiKey", v);
        } catch {
          try { localStorage.setItem("luyennoi.geminiKey", v); } catch {}
        }
        close(true);
      };
      ov.querySelector("#ft-key-cancel").addEventListener("click", () => close(false));
      ov.querySelector("#ft-key-save").addEventListener("click", save);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
      ov.addEventListener("click", (e) => { if (e.target === ov) close(false); });
    });
  }

  // ──────────────── Mount root ────────────────
  let root = null;
  function mount() {
    // Hide the entire body content from the original Svelte page
    const style = document.createElement("style");
    style.textContent = `
      body > *:not(#ft-root) { display: none !important; }
      #ft-root { font-family: Lexend, sans-serif; min-height: 100vh; background: #f9fafb; }
      .ft-card { background: white; border-radius: 1rem; box-shadow: 0 4px 24px rgba(0,0,0,0.06); padding: 2rem; max-width: 640px; margin: 2rem auto; }
      .ft-h1 { font-size: 1.4rem; font-weight: 700; color: #171717; margin: 0 0 .5rem; }
      .ft-h2 { font-size: 1.1rem; font-weight: 600; color: #d9381e; margin: 1.4rem 0 .6rem; }
      .ft-row { margin-bottom: 1rem; }
      .ft-label { display: block; font-size: .88rem; font-weight: 600; color: #374151; margin-bottom: .35rem; }
      .ft-hint { font-size: .75rem; color: #6b7280; margin-top: .25rem; }
      .ft-select, .ft-input { width: 100%; padding: .55rem .7rem; border: 1.5px solid #e5e7eb; border-radius: .5rem; font-size: .9rem; font-family: inherit; }
      .ft-btn { padding: .7rem 1.4rem; border: none; border-radius: .5rem; font-size: .95rem; font-weight: 600; cursor: pointer; font-family: inherit; }
      .ft-btn-primary { background: #d9381e; color: white; }
      .ft-btn-primary:hover { background: #4a0cd4; }
      .ft-btn-primary:disabled { background: var(--ink); cursor: not-allowed; }
      .ft-btn-ghost { background: transparent; color: #d9381e; border: 1.5px solid #d9381e; }
      .ft-btn-ghost:hover { background: #ffffff; }
      .ft-btn-danger { background: #ffffff; color: var(--red); border: none; }
      .ft-toggle { display: inline-flex; align-items: center; gap: .5rem; cursor: pointer; }
      .ft-toggle input { width: 1.1rem; height: 1.1rem; cursor: pointer; }
      .ft-slider { width: 100%; }
      .ft-section-chip { display: inline-block; background: #ffffff; color: #d9381e; font-size: .72rem; font-weight: 700; padding: .2rem .6rem; border-radius: 9999px; }
      .ft-progress { background: #e5e7eb; border-radius: 9999px; height: .35rem; overflow: hidden; margin: .5rem 0 1rem; }
      .ft-progress-bar { background: #d9381e; height: 100%; transition: width .3s; }
      .ft-mic-pulse { width: 1rem; height: 1rem; border-radius: 50%; background: #ef4444; animation: ft-mic 1.2s infinite; display: inline-block; vertical-align: middle; }
      @keyframes ft-mic { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,.6) } 50% { box-shadow: 0 0 0 8px rgba(239,68,68,0) } }
      .ft-tts-pulse { width: .8rem; height: .8rem; border-radius: 50%; background: #d9381e; animation: ft-tts 1.2s infinite; display: inline-block; vertical-align: middle; }
      @keyframes ft-tts { 0%,100% { box-shadow: 0 0 0 0 rgba(217, 56, 30,.55) } 50% { box-shadow: 0 0 0 8px rgba(217, 56, 30,0) } }
      .ft-question { font-size: 1.25rem; font-weight: 600; color: #171717; line-height: 1.5; margin: 1rem 0; }
      .ft-status { font-size: .85rem; color: #6b7280; margin: .8rem 0; min-height: 1.4em; }
      .ft-back { color: #9ca3af; font-size: .85rem; text-decoration: none; }
      .ft-back:hover { color: #d9381e; }
    `;
    document.head.appendChild(style);

    root = document.createElement("div");
    root.id = "ft-root";
    document.body.appendChild(root);
  }

  // ──────────────── Voices ────────────────
  function loadVoices() {
    return new Promise((resolve) => {
      let voices = speechSynthesis.getVoices();
      if (voices.length) return resolve(voices);
      const t = setTimeout(() => resolve(speechSynthesis.getVoices()), 1500);
      speechSynthesis.addEventListener("voiceschanged", () => {
        clearTimeout(t);
        resolve(speechSynthesis.getVoices());
      }, { once: true });
    });
  }

  async function setupVoice() {
    const voices = (await loadVoices()).filter(v => /^en[-_](GB|US|AU)/i.test(v.lang));
    let chosen = null;
    if (FT.voiceName) chosen = voices.find(v => v.name === FT.voiceName);
    if (!chosen) chosen = voices.find(v => /female|samantha|google.*female|emma|microsoft.*hazel|microsoft.*zira/i.test(v.name)) || voices[0];
    FT.voice = chosen;
    return voices;
  }

  // ──────────────── Load question data ────────────────
  // We pull from TWO sources:
  //  • /data/questions.json — light Part 1 list (topic + questions[])
  //  • /real/_app/immutable/chunks/forecast-map-*.js — rich Part 2/3 data
  //    (each card has its own cueCards[] AND its own Part 3 questions[])
  async function loadQuestionData() {
    let questionsJson = { part1: { topics: [] }, part2: { topics: [] }, part3: { topics: [] } };
    try {
      const r = await fetch("/data/questions.json");
      questionsJson = await r.json();
    } catch (e) { console.warn("[FT] failed to load questions.json", e); }

    // The forecast-map chunk exports the detailed Part 2/3 data as the `c` export
    // (`x as c` in the bundle → that's the original `n` array with full cueCards + questions).
    let part23Detailed = null;
    try {
      const mod = await import("/real/_app/immutable/chunks/forecast-map-a2d894f2.js");
      // Try common export names — the chunk maps internal vars to short letters.
      part23Detailed = mod.c || mod.b || mod.default || null;
      // Validate shape: array of {topic, data: [{title, cueCards[], questions[]}]}
      if (!Array.isArray(part23Detailed) || !part23Detailed[0]?.data?.[0]?.cueCards) {
        // Walk every export and find the first one matching the shape
        for (const k of Object.keys(mod)) {
          const v = mod[k];
          if (Array.isArray(v) && v[0]?.data?.[0]?.cueCards) { part23Detailed = v; break; }
        }
      }
      if (!Array.isArray(part23Detailed) || !part23Detailed[0]?.data) {
        console.warn("[FT] forecast-map shape mismatch, exports:", Object.keys(mod));
        part23Detailed = null;
      }
    } catch (e) {
      console.warn("[FT] failed to load forecast-map chunk", e);
    }

    FT.questionsData = questionsJson;
    FT.part23Detailed = part23Detailed; // [{topic:"Person", data:[{title, cueCards[], questions[]}]}, ...]
  }

  // ──────────────── Build questions for the test ────────────────
  function buildQuestionsForTest() {
    const data = FT.questionsData;

    if (IS_CUSTOM_STRICT) {
      const selected = new Set(FT.selectedPart1Topics);
      const p1Topics = (data.part1?.topics || []).filter(t => selected.has(t.title)).slice(0, 3);
      FT.questions.part1 = [];
      p1Topics.forEach(t => {
        pickRandom(t.questions || [], Math.min(3, t.questions?.length || 0)).forEach((q, i) => {
          FT.questions.part1.push({ section: "part1", topic: t.title, question: q, isFirstInTopic: i === 0 });
        });
      });

      const allCards = [];
      if (Array.isArray(FT.part23Detailed) && FT.part23Detailed.length) {
        FT.part23Detailed.forEach(g => (g.data || []).forEach(card => {
          if (card.cueCards && card.questions) allCards.push({ ...card, group: g.topic, key: `${g.topic}::${card.title}` });
        }));
      }
      const pickedCard = allCards.find(c => c.key === FT.selectedPart2Key) || allCards[0];
      FT.questions.part2 = pickedCard || null;
      FT.questions.part3 = (pickedCard?.questions || []).slice(0, 5).map(q => ({
        section: "part3",
        topic: pickedCard.title,
        question: q,
      }));
      FT.lockedQuestionIds = [
        ...FT.questions.part1.map(q => `part1:${q.topic}:${q.question}`),
        FT.questions.part2 ? `part2:${FT.questions.part2.group}:${FT.questions.part2.title}` : "",
        ...FT.questions.part3.map(q => `part3:${FT.questions.part2?.title || ""}:${q.question}`)
      ].filter(Boolean);
      return;
    }

    // ── PART 1 — pick 3 random topics × N questions ──
    const p1Topics = pickRandom(data.part1?.topics || [], 3);
    FT.questions.part1 = [];
    p1Topics.forEach(t => {
      const qs = pickRandom(t.questions || [], FT.questionCount);
      qs.forEach((q, i) => {
        FT.questions.part1.push({
          section: "part1",
          topic: t.title,
          question: q,
          isFirstInTopic: i === 0,
        });
      });
    });

    // ── PART 2 & 3 — pull from rich forecast-map chunk if available ──
    let p2Card = null;
    let p3Questions = [];
    if (Array.isArray(FT.part23Detailed) && FT.part23Detailed.length) {
      // Flatten all cards across topic groups (Person/Object/Activity/Place)
      const allCards = [];
      FT.part23Detailed.forEach(g => (g.data || []).forEach(card => {
        if (card.cueCards && card.questions) allCards.push({ ...card, group: g.topic });
      }));
      if (allCards.length) {
        p2Card = allCards[Math.floor(Math.random() * allCards.length)];
        // Part 3 questions are EMBEDDED in the same card
        p3Questions = (p2Card.questions || []).slice(0, 5);
      }
    }

    // Fallback: questions.json only has titles → synthesise a minimal cue card
    if (!p2Card) {
      const flat = [];
      (data.part2?.topics || []).forEach(g => (g.questions || []).forEach(title => flat.push({ title, group: g.title })));
      if (flat.length) {
        const pick = flat[Math.floor(Math.random() * flat.length)];
        p2Card = {
          title: pick.title,
          group: pick.group,
          cueCards: ["Who/what it is", "When/where it happened", "What you did or saw", "How you feel about it"],
          questions: [],
        };
      }
    }

    FT.questions.part2 = p2Card;

    // Part 3: prefer embedded questions; otherwise sample from questions.json part3 by matching topic group
    if (p3Questions.length) {
      FT.questions.part3 = p3Questions.map(q => ({
        section: "part3",
        topic: p2Card.title,
        question: q,
      }));
    } else {
      // Fallback: try part3 from questions.json filtered by same group label
      const group = p2Card?.group || "";
      const p3Source = (data.part3?.topics || []).find(t => (t.title || "").toLowerCase() === group.toLowerCase());
      const p3List = (p3Source?.questions || []).slice();
      const picked = pickRandom(p3List, 5);
      FT.questions.part3 = picked.map(q => ({ section: "part3", topic: p2Card?.title || group, question: q }));
    }

    // Apply single-part filter (mode = "part1" | "part2" | "part3")
    if (PART_FILTER) {
      if (PART_FILTER !== "part1") FT.questions.part1 = [];
      if (PART_FILTER !== "part2") FT.questions.part2 = null;
      if (PART_FILTER !== "part3") FT.questions.part3 = [];
      // Part 3 single-test mode: only 1 question
      if (PART_FILTER === "part3" && FT.questions.part3.length) {
        FT.questions.part3 = [FT.questions.part3[0]];
      }
    }

    console.log("[FT] built test (mode=" + TEST_MODE + "):", {
      part1: FT.questions.part1.length,
      part2: FT.questions.part2 ? FT.questions.part2.title : null,
      part3: FT.questions.part3.length,
    });
  }

  // ──────────────── Setup screen ────────────────
  function showCustomStrictSetup(voices) {
    const p1Topics = FT.questionsData?.part1?.topics || [];
    const allCards = [];
    if (Array.isArray(FT.part23Detailed)) {
      FT.part23Detailed.forEach(g => (g.data || []).forEach(card => {
        if (card.cueCards && card.questions) allCards.push({ ...card, group: g.topic, key: `${g.topic}::${card.title}` });
      }));
    }
    if (!FT.selectedPart1Topics.length) FT.selectedPart1Topics = p1Topics.slice(0, 3).map(t => t.title);
    if (!FT.selectedPart2Key && allCards[0]) FT.selectedPart2Key = allCards[0].key;
    FT.state = "setup";
    root.innerHTML = `
      <div class="ft-card" style="max-width:860px;">
        <a class="ft-back" href="/take-test/home">← Quay lại</a>
        <h1 class="ft-h1" style="margin-top:.5rem;">Tùy chọn đề chống gian lận</h1>
        <p class="ft-hint">Chế độ này dùng để dự đoán band nghiêm túc hơn. Thoát toàn màn hình, đổi tab, reload hoặc chuyển app sẽ hủy bài từ đầu.</p>
        <div class="ft-row" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:.7rem;padding:.8rem 1rem;color:#9a3412;font-size:.84rem;line-height:1.55;">
          <b>Siêu chống gian lận - chống đọc:</b> không có câu mẫu, không AI gợi ý, không IPA, không từ vựng. Trên điện thoại hệ thống theo dõi ẩn tab/chuyển app/khóa màn hình bằng lifecycle events.
        </div>
        <div class="ft-row">
          <label class="ft-label">Giọng giám khảo</label>
          <select id="ft-voice" class="ft-select">
            ${voices.map(v => `<option value="${escapeHtml(v.name)}" ${v.name === FT.voice?.name ? "selected" : ""}>${escapeHtml(v.name)} (${escapeHtml(v.lang)})</option>`).join("")}
          </select>
          <button id="ft-voice-test" class="ft-btn ft-btn-ghost" style="padding:.35rem .8rem;font-size:.78rem;margin-top:.4rem;">▶ Nghe thử</button>
        </div>
        <div class="ft-row">
          <label class="ft-label">Chọn tối đa 3 nhóm Part 1</label>
          <div id="strict-p1-topics" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.45rem;max-height:260px;overflow:auto;border:1px solid #e5e7eb;border-radius:.7rem;padding:.7rem;">
            ${p1Topics.map(t => `
              <label class="ft-toggle" style="font-size:.82rem;background:#f9fafb;border-radius:.5rem;padding:.45rem .55rem;">
                <input type="checkbox" value="${escapeHtml(t.title)}" ${FT.selectedPart1Topics.includes(t.title) ? "checked" : ""}>
                <span>${escapeHtml(t.title)} <small style="color:#9ca3af;">${(t.questions || []).length}</small></span>
              </label>
            `).join("")}
          </div>
          <div class="ft-hint" id="strict-p1-count"></div>
        </div>
        <div class="ft-row">
          <label class="ft-label">Chọn 1 chủ đề Part 2</label>
          <select id="strict-p2-topic" class="ft-select">
            ${allCards.map(c => `<option value="${escapeHtml(c.key)}" ${c.key === FT.selectedPart2Key ? "selected" : ""}>${escapeHtml(c.group)} · ${escapeHtml(c.title)}</option>`).join("")}
          </select>
          <div class="ft-hint">Part 3 sẽ tự đi theo chủ đề Part 2 đã chọn.</div>
        </div>
        <div style="display:flex;justify-content:space-between;gap:.5rem;margin-top:1.5rem;">
          <button id="ft-cancel" class="ft-btn ft-btn-danger">Huỷ</button>
          <button id="ft-start" class="ft-btn ft-btn-primary">Bắt đầu fullscreen</button>
        </div>
      </div>
    `;
    const updateSelection = () => {
      const checks = [...root.querySelectorAll('#strict-p1-topics input[type="checkbox"]')];
      FT.selectedPart1Topics = checks.filter(c => c.checked).map(c => c.value).slice(0, 3);
      checks.forEach(c => { c.disabled = !c.checked && FT.selectedPart1Topics.length >= 3; });
      root.querySelector("#strict-p1-count").textContent = `Đã chọn ${FT.selectedPart1Topics.length}/3 nhóm.`;
      root.querySelector("#ft-start").disabled = FT.selectedPart1Topics.length === 0 || !FT.selectedPart2Key;
    };
    root.querySelector("#ft-voice").addEventListener("change", (e) => {
      const v = voices.find(x => x.name === e.target.value);
      if (v) { FT.voice = v; FT.voiceName = v.name; try { localStorage.setItem("ln.ttsVoice", v.name); } catch {} }
    });
    root.querySelector("#ft-voice-test").addEventListener("click", () => speak("Hello, I'm your IELTS examiner. Strict test mode will now begin."));
    root.querySelectorAll('#strict-p1-topics input[type="checkbox"]').forEach(input => input.addEventListener("change", updateSelection));
    root.querySelector("#strict-p2-topic").addEventListener("change", (e) => { FT.selectedPart2Key = e.target.value; updateSelection(); });
    root.querySelector("#ft-cancel").addEventListener("click", () => { location.href = "/take-test/home"; });
    root.querySelector("#ft-start").addEventListener("click", startTest);
    updateSelection();
  }

  async function showSetup() {
    FT.state = "setup";
    const voices = await setupVoice();
    if (IS_CUSTOM_STRICT) return showCustomStrictSetup(voices);
    root.innerHTML = `
      <div class="ft-card">
        <a class="ft-back" href="/take-test/home">← Quay lại</a>
        <h1 class="ft-h1" style="margin-top:.5rem;">${
          TEST_MODE === "full-test" ? "Full Test — Thi thử IELTS Speaking" :
          TEST_MODE === "part1"     ? "Thi Part 1 — Personal questions" :
          TEST_MODE === "part2"     ? "Thi Part 2 — Cue card" :
                                       "Thi Part 3 — Discussion"
        }</h1>
        <p class="ft-hint">Cấu hình bài thi: giọng giám khảo${TEST_MODE === "full-test" ? ", số câu Part 1, follow-up" : ""}.</p>

        <div class="ft-row">
          <label class="ft-label">Giọng giám khảo</label>
          <select id="ft-voice" class="ft-select">
            ${voices.map(v => `<option value="${escapeHtml(v.name)}" ${v.name === FT.voice?.name ? "selected" : ""}>${escapeHtml(v.name)} (${escapeHtml(v.lang)})</option>`).join("")}
          </select>
          <div style="margin-top:.4rem;">
            <button id="ft-voice-test" class="ft-btn ft-btn-ghost" style="padding:.35rem .8rem;font-size:.78rem;">▶ Nghe thử</button>
          </div>
        </div>

        <div class="ft-row">
          <label class="ft-label">Cấu trúc bài thi</label>
          <div style="background:#ffffff;border-radius:.5rem;padding:.7rem .9rem;font-size:.82rem;color:#171717;line-height:1.6;">
            ${TEST_MODE === "full-test" ? `
              <b>Part 1:</b> 3 chủ đề × 3 câu = 9 câu (~5 phút)<br>
              <b>Part 2:</b> 1 cue card, ghi chú 1 phút → nói 2-2:30 phút<br>
              <b>Part 3:</b> 4-5 câu thảo luận cùng chủ đề Part 2 (~5 phút)
            ` : TEST_MODE === "part1" ? `
              <b>Part 1:</b> 3 chủ đề × 3 câu = <b>9 câu</b> (~5 phút).<br>
              Mỗi câu: TTS hỏi → tự động ghi âm → bấm "Ghi nhận câu trả lời" để qua câu.
            ` : TEST_MODE === "part2" ? `
              <b>Part 2:</b> 1 cue card, ghi chú 1 phút → nói tối đa 2:30 phút.<br>
              Cue card có 4 ý gợi ý (you should say).
            ` : `
              <b>Part 3:</b> 1 câu thảo luận chủ đề chung (~40s).<br>
              Trả lời theo dạng phân tích, nói về ý chung chứ không phải trải nghiệm cá nhân.
            `}
          </div>
          <div id="ft-diagnostic" style="margin-top:.5rem;font-size:.72rem;color:#9ca3af;"></div>
        </div>

        ${TEST_MODE === "full-test" ? `
        <div class="ft-row">
          <label class="ft-toggle">
            <input type="checkbox" id="ft-followup" ${FT.followUp ? "checked" : ""}>
            <span><b>Bật follow-up question</b> — nếu học sinh trả lời quá ngắn, giám khảo hỏi thêm 1 câu Part 3 liên quan để mở rộng.</span>
          </label>
        </div>` : ""}

        <div class="ft-row">
          <label class="ft-label">Chế độ thi</label>
          <label class="ft-toggle">
            <input type="checkbox" id="ft-strict" ${FT.examMode === "strict" ? "checked" : ""}>
            <span><b>Căng — chuẩn phòng thi.</b> Giám khảo hỏi liên tục, học sinh bấm "Ghi nhận câu trả lời" để qua câu. Part 2 tối đa 2:30.</span>
          </label>
        </div>

        <div style="display:flex;justify-content:space-between;gap:.5rem;margin-top:1.5rem;">
          <button id="ft-cancel" class="ft-btn ft-btn-danger">Huỷ</button>
          <button id="ft-start" class="ft-btn ft-btn-primary">Bắt đầu thi</button>
        </div>
      </div>
    `;

    root.querySelector("#ft-voice").addEventListener("change", (e) => {
      const v = voices.find(x => x.name === e.target.value);
      if (v) { FT.voice = v; FT.voiceName = v.name; try { localStorage.setItem("ln.ttsVoice", v.name); } catch {} }
    });
    root.querySelector("#ft-voice-test").addEventListener("click", () => speak("Hello, I'm your IELTS examiner. Shall we begin?"));
    root.querySelector("#ft-followup")?.addEventListener("change", (e) => { FT.followUp = e.target.checked; });
    root.querySelector("#ft-strict").addEventListener("change", (e) => { FT.examMode = e.target.checked ? "strict" : "relaxed"; });
    root.querySelector("#ft-cancel").addEventListener("click", () => { location.href = "/take-test/home"; });
    root.querySelector("#ft-start").addEventListener("click", startTest);

    // Diagnostic: show whether data sources loaded
    const diag = root.querySelector("#ft-diagnostic");
    const p1Topics = (FT.questionsData?.part1?.topics || []).length;
    const richP23 = Array.isArray(FT.part23Detailed) && FT.part23Detailed.length;
    const p2Pool = richP23
      ? FT.part23Detailed.reduce((n, g) => n + (g.data || []).length, 0)
      : (FT.questionsData?.part2?.topics || []).reduce((n, g) => n + (g.questions || []).length, 0);
    diag.innerHTML = `Đã load: <b>${p1Topics}</b> chủ đề Part 1 · <b>${p2Pool}</b> cue card Part 2 ${richP23 ? "(rich + Part 3 questions ✓)" : "(synthesised fallback ⚠)"}`;
  }

  // ──────────────── Start the test ────────────────
  async function startTest() {
    console.log("[FT] startTest clicked, has key:", !!getKey());
    if (!getKey()) {
      console.log("[FT] opening API key prompt modal");
      const ok = await promptForApiKey();
      console.log("[FT] key prompt result:", ok);
      if (!ok) return;
    }
    buildQuestionsForTest();
    // Validate based on mode — don't require Part 1 when running Part 2/3 alone
    const haveContent =
      (TEST_MODE === "full-test" && FT.questions.part1.length && FT.questions.part2) ||
      (IS_CUSTOM_STRICT        && FT.questions.part1.length && FT.questions.part2 && FT.questions.part3.length) ||
      (TEST_MODE === "part1"     && FT.questions.part1.length) ||
      (TEST_MODE === "part2"     && FT.questions.part2) ||
      (TEST_MODE === "part3"     && FT.questions.part3.length);
    if (!haveContent) {
      alert("Không tải được dữ liệu câu hỏi cho chế độ này. Reload thử nhé.");
      return;
    }
    if (IS_CUSTOM_STRICT) {
      const ok = await enterStrictFullscreen();
      if (!ok) {
        alert("Không thể bắt đầu chế độ chống gian lận nếu chưa vào toàn màn hình.");
        return;
      }
      await startStrictSession();
      installStrictGuards();
    }
    FT.state = "running";
    FT.section = TEST_MODE === "part2" ? "part2" : TEST_MODE === "part3" ? "part3" : "part1";
    FT.currentIdx = 0;
    FT.answers = [];
    renderTestUI();
    await runIntro();
    await runQuestionFlow();
  }

  async function runIntro() {
    setStatus("Giám khảo đang giới thiệu...");
    if (IS_CUSTOM_STRICT) {
      showQuestion("Strict IELTS Speaking test.", "Intro");
      await speak("Good morning. This is your strict IELTS Speaking test. Please stay in fullscreen until the test is finished.");
    } else if (TEST_MODE === "full-test") {
      showQuestion("Welcome to your IELTS Speaking test.", "Intro");
      await speak("Good morning. My name is your examiner today. Could we begin with some questions about yourself?");
    } else if (TEST_MODE === "part1") {
      showQuestion("Welcome to Part 1.", "Intro");
      await speak("Good morning. Let's begin with some questions about yourself.");
    } else if (TEST_MODE === "part2") {
      showQuestion("Welcome to Part 2.", "Intro");
      // Don't speak yet — runPart2 has its own intro
    } else {
      showQuestion("Welcome to Part 3.", "Intro");
      await speak("Now I'd like to discuss a more general topic with you.");
    }
    await wait(300);
  }

  // ──────────────── Test running UI ────────────────
  function renderTestUI() {
    const total = FT.questions.part1.length + (FT.questions.part2 ? 1 : 0) + FT.questions.part3.length;
    root.innerHTML = `
      <div class="ft-card" style="max-width:760px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem;">
          <span class="ft-section-chip" id="ft-section-chip">PART 1</span>
          <button id="ft-quit" class="ft-btn ft-btn-ghost" style="padding:.3rem .9rem;font-size:.78rem;">Thoát</button>
        </div>
        <div class="ft-progress"><div class="ft-progress-bar" id="ft-progress-bar" style="width:0%"></div></div>
        <div id="ft-topic" style="font-size:.78rem;color:#9ca3af;margin-bottom:.4rem;"></div>
        <div class="ft-question" id="ft-question">…</div>
        <div class="ft-status" id="ft-status">Giám khảo đang nói… <span class="ft-tts-pulse"></span></div>
        <div style="display:flex;gap:.5rem;margin-top:1.2rem;">
          <button id="ft-skip-speak" class="ft-btn ft-btn-ghost" style="padding:.5rem 1rem;font-size:.78rem;">Bỏ qua, sẵn sàng ghi âm</button>
          <button id="ft-record" class="ft-btn ft-btn-primary" style="display:none;flex:1;">🎤 Đang ghi âm — bấm để dừng & qua câu</button>
        </div>
      </div>
    `;
    root.querySelector("#ft-quit").addEventListener("click", quit);
    root.querySelector("#ft-skip-speak").addEventListener("click", () => { try { speechSynthesis.cancel(); } catch {} });
    root.querySelector("#ft-record").addEventListener("click", () => stopRecording());
  }

  function showQuestion(text, topic = "") {
    const qEl = root.querySelector("#ft-question");
    if (qEl) qEl.textContent = text;
    const tEl = root.querySelector("#ft-topic");
    if (tEl) tEl.textContent = topic ? `Chủ đề: ${topic}` : "";
  }

  function setStatus(text, withMic = false, withTts = false) {
    const el = root.querySelector("#ft-status");
    if (!el) return;
    el.innerHTML = text + (withMic ? ' <span class="ft-mic-pulse"></span>' : "") + (withTts ? ' <span class="ft-tts-pulse"></span>' : "");
  }

  function updateProgress() {
    const total = FT.questions.part1.length + (FT.questions.part2 ? 1 : 0) + FT.questions.part3.length;
    const done = FT.answers.length;
    const bar = root.querySelector("#ft-progress-bar");
    if (bar) bar.style.width = Math.round(done / total * 100) + "%";
    const chip = root.querySelector("#ft-section-chip");
    const label = { part1: "PART 1", part2: "PART 2", part3: "PART 3" }[FT.section] || "PART 1";
    if (chip) chip.textContent = label;
  }

  function setRecordBtn(visible) {
    const r = root.querySelector("#ft-record");
    const s = root.querySelector("#ft-skip-speak");
    if (r) r.style.display = visible ? "" : "none";
    if (s) s.style.display = visible ? "none" : "";
  }

  // ──────────────── Question loop ────────────────
  async function runQuestionFlow() {
    const isFull = TEST_MODE === "full-test";

    // ── PART 1 ──
    if (FT.questions.part1.length) {
      FT.section = "part1";
      FT.currentIdx = 0;
      while (FT.currentIdx < FT.questions.part1.length) {
        const q = FT.questions.part1[FT.currentIdx];
        await runOneQuestion(q);
        FT.currentIdx++;
      }
    }

    // ── PART 2 ──
    if (FT.questions.part2) {
      FT.section = "part2";
      FT.currentIdx = 0;
      renderTestUI();
      updateProgress();
      if (isFull) {
        setStatus("Chuyển sang Part 2…", false, true);
        await speak("Thank you. Now, let's move on to Part 2.");
        await wait(400);
      }
      await runPart2(FT.questions.part2);
    }

    // ── PART 3 ──
    if (FT.questions.part3.length) {
      FT.section = "part3";
      FT.currentIdx = 0;
      renderTestUI();
      updateProgress();
      if (isFull) {
        setStatus("Chuyển sang Part 3…", false, true);
        const p2title = (FT.questions.part2?.title || "").toLowerCase().replace(/^describe\s+/, "");
        await speak(`Let's move on to Part 3. I'd like to discuss some more general questions related to ${p2title || "the topic"}.`);
        await wait(400);
      }
      while (FT.currentIdx < FT.questions.part3.length) {
        const q = FT.questions.part3[FT.currentIdx];
        await runOneQuestion(q);
        FT.currentIdx++;
      }
    }

    // Done — show preliminary summary (full scoring lands in Phase 3)
    setStatus("Bài thi hoàn thành — đang chấm sơ bộ…");
    await wait(800);
    await scoreAllAndShowSummary();
  }

  // ──────────────── Part 2 — cue card with 1-min prep + 2:30 record ────────────────
  async function runPart2(cue) {
    // 1) Render cue card with prep timer + note area
    const cueHtml = `
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:.7rem;padding:1rem 1.1rem;">
        <div style="font-weight:700;color:#d9381e;margin-bottom:.6rem;font-size:1.05rem;">${escapeHtml(cue.title)}</div>
        <div style="font-size:.85rem;color:#4b5563;margin-bottom:.4rem;">You should say:</div>
        <ul style="margin:0;padding-left:1.2rem;font-size:.9rem;color:#171717;line-height:1.7;">
          ${(cue.cueCards || []).map(c => `<li>${escapeHtml(c)}</li>`).join("")}
        </ul>
      </div>
    `;
    const notesHtml = `
      <div style="margin-top:1rem;">
        <label style="display:block;font-size:.78rem;font-weight:600;color:#374151;margin-bottom:.3rem;">📝 Ghi chú của bạn (1 phút):</label>
        <textarea id="ft-p2-notes" rows="5" style="width:100%;padding:.6rem .7rem;border:1.5px solid #e5e7eb;border-radius:.5rem;font-family:inherit;font-size:.88rem;resize:vertical;" placeholder="Ghi nhanh ý chính ra đây…"></textarea>
      </div>
    `;
    root.querySelector("#ft-question").innerHTML = cueHtml + notesHtml;
    root.querySelector("#ft-topic").textContent = `Part 2 cue card · ${cue.group || ""}`;
    setRecordBtn(false);

    // 2) Speak the prep prompt
    setStatus("Giám khảo đang nói… ", false, true);
    await speak("Now I'd like you to talk about a topic for one to two minutes. Before you talk, you'll have one minute to think and make some notes if you wish. Your topic is:");
    await speak(cue.title);
    for (const c of (cue.cueCards || [])) {
      await speak(c);
      await wait(100);
    }
    await speak("You have one minute to prepare. You can make notes if you wish.");

    // 3) Prep countdown (60s) — show "Còn lại Xs" + skip button
    const prepStart = Date.now();
    const PREP_MS = 60_000;
    let prepDone = false;
    const skipPrepBtn = document.createElement("button");
    skipPrepBtn.className = "ft-btn ft-btn-ghost";
    skipPrepBtn.style.cssText = "padding:.5rem 1rem;font-size:.78rem;";
    skipPrepBtn.textContent = "Sẵn sàng nói ngay";
    skipPrepBtn.addEventListener("click", () => { prepDone = true; });
    // Insert before the record button
    const btnRow = root.querySelector("#ft-record")?.parentElement;
    if (btnRow) btnRow.prepend(skipPrepBtn);

    while (!prepDone && Date.now() - prepStart < PREP_MS) {
      const remain = Math.ceil((PREP_MS - (Date.now() - prepStart)) / 1000);
      setStatus(`⏱ Chuẩn bị — còn ${remain}s. Ghi chú vào textarea.`);
      await wait(250);
    }
    skipPrepBtn.remove();

    // 4) Cue start of speaking
    setStatus("Bắt đầu nói. Tối đa 2:30. ", true);
    await speak("All right? Remember, you have one to two minutes for this. Now please start speaking.");
    await wait(300);

    // 5) Record up to 2:30 OR until user clicks the stop button
    setRecordBtn(true);
    const recBtn = root.querySelector("#ft-record");
    if (recBtn) recBtn.textContent = "🎤 Đang nói Part 2 — bấm để dừng (max 2:30)";

    // Build the question entry for storage
    const cueQ = {
      section: "part2",
      topic: cue.title,
      question: `${cue.title}\n${(cue.cueCards || []).map(c => "• " + c).join("\n")}`,
    };

    // Auto-stop timer
    const MAX_MS = 150_000; // 2:30
    let autoStopTimer = null;
    const startedAt = Date.now();
    const startedRecPromise = startRecording(cueQ);
    autoStopTimer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= MAX_MS) {
        clearInterval(autoStopTimer);
        if (recBtn) recBtn.textContent = "⏱ Hết giờ — đang lưu…";
        stopRecording();
        return;
      }
      // Update countdown on button label every second
      const remain = Math.max(0, Math.ceil((MAX_MS - elapsed) / 1000));
      const mm = String(Math.floor(remain / 60)).padStart(1, "0");
      const ss = String(remain % 60).padStart(2, "0");
      if (recBtn) recBtn.textContent = `🎤 Đang nói Part 2 — bấm để dừng (${mm}:${ss})`;
    }, 500);

    await startedRecPromise;
    if (autoStopTimer) clearInterval(autoStopTimer);

    // 6) Save the notes onto the latest answer entry
    const ansLast = FT.answers[FT.answers.length - 1];
    if (ansLast) ansLast.notes = root.querySelector("#ft-p2-notes")?.value || "";

    setRecordBtn(false);
    updateProgress();
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  async function runOneQuestion(q) {
    showQuestion(q.question, q.topic);
    updateProgress();
    setStatus("Giám khảo đang nói… ", false, true);
    setRecordBtn(false);

    // If it's the first question in a topic, speak a short intro lead-in
    if (q.isFirstInTopic && q.topic) {
      await speak(`Now, I'd like to ask you about ${q.topic}.`);
      await wait(250);
    }
    await speak(q.question);
    await wait(400);

    // Auto-start recording after 2-second countdown
    for (let s = 2; s >= 1; s--) {
      setStatus(`Sẵn sàng ghi âm trong ${s}…`);
      await wait(1000);
    }
    setStatus("Đang ghi âm. Bấm nút để dừng & qua câu tiếp theo. ", true);
    setRecordBtn(true);

    // Start recording, await stop
    await startRecording(q);
  }

  // ──────────────── Recording ────────────────
  async function startRecording(q) {
    return new Promise(async (resolve) => {
      try {
        if (!FT.stream) FT.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        FT.chunks = [];
        const ftMimeOpts = typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported("audio/webm") ? { mimeType: "audio/webm" } : {};
        const rec = new MediaRecorder(FT.stream, ftMimeOpts);
        rec.ondataavailable = (e) => FT.chunks.push(e.data);
        rec.onstop = async () => {
          const blob = new Blob(FT.chunks, { type: "audio/webm" });
          strictEvent("record_stop", { section: q.section, topic: q.topic, question: q.question, size: blob.size });
          FT.answers.push({
            section: q.section, topic: q.topic, question: q.question,
            blob, audioUrl: URL.createObjectURL(blob),
            ts: Date.now(),
          });
          FT.recording = false;
          resolve();
        };
        FT.recorder = rec;
        FT.recording = true;
        rec.start();
        strictEvent("record_start", { section: q.section, topic: q.topic, question: q.question });
      } catch (e) {
        alert("Không truy cập được mic: " + e.message);
        resolve();
      }
    });
  }

  function stopRecording() {
    if (FT.recording && FT.recorder) {
      try { FT.recorder.stop(); } catch {}
    }
  }

  function quit() {
    if (!confirm("Thoát khỏi bài thi? Mọi tiến trình sẽ mất.")) return;
    if (IS_CUSTOM_STRICT) {
      FT.strictCancelled = true;
      strictEvent("strict_test_cancelled", { reason: "user_exit" });
      finishStrictSession("cancelled", "user_exit");
    }
    try { FT.recorder?.stop(); } catch {}
    FT.stream?.getTracks().forEach(t => t.stop());
    location.href = "/take-test/home";
  }

  // ──────────────── PHASE 3 — full scoring + aggregation + history save ────────────────

  // Compute duration of an audio blob (seconds). Useful for Part 2 < 2:00 cap.
  function blobDuration(blob) {
    return new Promise((resolve) => {
      const a = new Audio();
      a.preload = "metadata";
      a.onloadedmetadata = () => resolve(a.duration || 0);
      a.onerror = () => resolve(0);
      a.src = URL.createObjectURL(blob);
      // Safari sometimes leaves duration as Infinity — give it a tiny nudge
      setTimeout(() => resolve(a.duration || 0), 1200);
    });
  }

  function avg(arr) {
    const nums = arr.filter(n => typeof n === "number" && !isNaN(n));
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  }

  // Aggregate a set of per-question criteria scores into a single section band.
  // Returns { band, criteria: {fluency, vocabulary, grammar, pronunciation}, count }.
  function aggregatePart(scoredArr) {
    const crit = { fluency: [], vocabulary: [], grammar: [], pronunciation: [] };
    scoredArr.forEach(s => {
      const c = s.score?.criteria || {};
      ["fluency","vocabulary","grammar","pronunciation"].forEach(k => {
        const v = c[k]?.score;
        if (typeof v === "number") crit[k].push(v);
      });
    });
    const avgCrit = {};
    Object.keys(crit).forEach(k => { avgCrit[k] = +avg(crit[k]).toFixed(1); });
    const band = +avg(Object.values(avgCrit)).toFixed(1);
    return { band, criteria: avgCrit, count: scoredArr.length };
  }

  // Apply strict caps per IELTS rules.
  function applyCaps(part2Agg, part2Duration, part3Agg, part3Combined) {
    // Part 2 cap: under 2 minutes (120s) → cap band at 5
    if (part2Agg && part2Duration < 120) {
      part2Agg.cap = `Part 2 chỉ ${Math.round(part2Duration)}s (<2 phút) → cap band 5.`;
      ["fluency","vocabulary","grammar","pronunciation"].forEach(k => {
        if (part2Agg.criteria[k] > 5) part2Agg.criteria[k] = 5;
      });
      part2Agg.band = Math.min(part2Agg.band, 5);
    }
    // Part 3 cap: combined sentences < 8 → cap band at 5
    if (part3Agg && part3Combined?.sentenceCount < 8) {
      part3Agg.cap = `Part 3 chỉ ${part3Combined.sentenceCount} câu (<8) → cap band 5.`;
      ["fluency","vocabulary","grammar","pronunciation"].forEach(k => {
        if (part3Agg.criteria[k] > 5) part3Agg.criteria[k] = 5;
      });
      part3Agg.band = Math.min(part3Agg.band, 5);
    }
  }

  // Final overall: base = average(P1, P2); P3 adjusts ±0.5 band depending on whether it
  // outperforms or underperforms the base.
  function computeOverall(p1, p2, p3) {
    const base = avg([p1?.band, p2?.band].filter(Boolean));
    if (!p3 || !p3.band) return { overall: +base.toFixed(1), base: +base.toFixed(1), delta: 0 };
    let delta = 0;
    if (p3.band >= base + 0.75) delta = 0.5;
    else if (p3.band <= base - 0.75) delta = -0.5;
    const overall = Math.max(1, Math.min(9, base + delta));
    // Round to nearest 0.5 (IELTS bands)
    const rounded = Math.round(overall * 2) / 2;
    return { overall: rounded, base: +base.toFixed(1), delta };
  }

  // Save a scored answer into the per-question practice history so the student can
  // click into that question's detail page and see the attempt there.
  // The detail page (overlay.js → restoreCachedAssist) reads
  //   ln.scoreHistory:<encodeURIComponent(question_text_as_shown_on_page)>
  // so we MUST use the exact same key.
  function saveToPerQuestionHistory(ans, score) {
    try {
      // For Part 1/3, the question is the raw English text shown on the detail page.
      // For Part 2, the detail page shows the CUE CARD TITLE (e.g. "Describe a person who...").
      const qKey = ans.section === "part2" ? (ans.topic || ans.question.split("\n")[0]) : ans.question;
      const key = "ln.scoreHistory:" + encodeURIComponent(qKey);
      const arr = JSON.parse(localStorage.getItem(key) || "[]");
      arr.unshift({
        ts: ans.ts || Date.now(),
        fromFullTest: true,
        section: ans.section,
        overall: score.overall,
        transcript: score.transcript,
        rewrittenAnswer: score.rewrittenAnswer,
        criteria: score.criteria,
        feedback: score.feedback,
        suggestions: score.suggestions,
        environmentWarning: score.environmentWarning,
        pronunciationIssues: score.pronunciationIssues,
        grammarIssues: score.grammarIssues,
        vocabularyIssues: score.vocabularyIssues,
        spellingIssues: score.spellingIssues,
        fluencyPauses: score.fluencyPauses,
        warning: score.warning,
      });
      try { localStorage.setItem(key, JSON.stringify(arr.slice(0, 20))); }
      catch { localStorage.setItem(key, JSON.stringify(arr.slice(0, 5))); }
    } catch (e) { console.warn("[FT] saveToPerQuestionHistory", e); }
  }

  // Build a URL into the per-question detail page so the result list can deep-link.
  function detailUrlFor(ans) {
    const part = ans.section === "part1" ? "PART 1" : ans.section === "part2" ? "PART 2" : "PART 3";
    const q = ans.section === "part2" ? (ans.topic || ans.question.split("\n")[0]) : ans.question;
    return `/question-answer/${encodeURIComponent(part)}~${encodeURIComponent(q)}`;
  }

  async function scoreAllAndShowSummary() {
    const total = FT.answers.length;
    if (!total) return showSummary([]);

    // Render a progress-y holding screen while we score
    root.innerHTML = `
      <div class="ft-card" style="max-width:720px;text-align:center;">
        <h1 class="ft-h1">Đang chấm điểm bài thi…</h1>
        <p class="ft-hint" id="ft-score-prog">Chuẩn bị chấm ${total} câu.</p>
        <div class="ft-progress" style="margin:1.5rem 0;"><div class="ft-progress-bar" id="ft-score-bar" style="width:0%"></div></div>
        <div style="font-size:.78rem;color:#9ca3af;">Có thể mất 1-3 phút tuỳ mạng. Đừng đóng tab.</div>
      </div>
    `;

    const scored = [];
    for (let i = 0; i < total; i++) {
      const ans = FT.answers[i];
      const partLabel = { part1: "PART 1", part2: "PART 2", part3: "PART 3" }[ans.section] || "PART 1";
      root.querySelector("#ft-score-prog").textContent = `Đang chấm câu ${i+1}/${total} (${partLabel})…`;
      root.querySelector("#ft-score-bar").style.width = Math.round((i / total) * 100) + "%";
      try {
        const b64 = await blobToBase64(ans.blob);
        const r = await fetch("/api/gemini/score-speaking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: getKey(), model: getModel(),
            question: ans.question, part: partLabel,
            audioBase64: b64.split(",")[1] || b64,
            mimeType: "audio/webm",
            note: "FULL TEST. Give GENERAL (not personal) feedback in Vietnamese — avoid phrasing like 'I think', 'mình thấy bạn...'. Be objective and concise.",
          }),
        });
        const data = await r.json();
        scored.push({ ...ans, score: data });
        // Save into per-question history so it appears in that question's detail
        if (data?.criteria) saveToPerQuestionHistory(ans, data);
      } catch (e) {
        scored.push({ ...ans, score: { warning: e.message } });
      }
    }
    root.querySelector("#ft-score-bar").style.width = "100%";

    // Compute durations needed for caps
    const part2Item = scored.find(s => s.section === "part2");
    const part2Duration = part2Item ? await blobDuration(part2Item.blob) : 0;

    // Section aggregates
    const p1 = aggregatePart(scored.filter(s => s.section === "part1"));
    const p2 = aggregatePart(scored.filter(s => s.section === "part2"));
    const p3Arr = scored.filter(s => s.section === "part3");
    const p3 = aggregatePart(p3Arr);
    // Sentence count for Part 3 combined cap
    const p3SentenceCount = p3Arr.reduce((sum, s) => sum + ((s.score?.transcript || "").split(/[.!?]+/).filter(x => x.trim()).length), 0);
    const p3Combined = { sentenceCount: p3SentenceCount };

    applyCaps(p2, part2Duration, p3, p3Combined);

    const overallRes = computeOverall(p1, p2, p3);

    // Save to full-test history (strip audio blob URLs — they don't survive reload)
    try {
      const ftKey = "ln.fullTestHistory";
      const list = JSON.parse(localStorage.getItem(ftKey) || "[]");
      const ts = Date.now();
      const persistableAnswers = scored.map(s => ({
        section: s.section,
        topic: s.topic,
        question: s.question,
        ts: s.ts,
        score: s.score ? {
          overall: s.score.overall,
          transcript: s.score.transcript,
          rewrittenAnswer: s.score.rewrittenAnswer,
          criteria: s.score.criteria,
          feedback: s.score.feedback,
          warning: s.score.warning,
          // skip heavy fields like grammarIssues to keep storage small — they live in per-question history
        } : null,
      }));
      list.unshift({
        ts,
        mode: IS_CUSTOM_STRICT ? "custom_strict" : TEST_MODE,
        sessionId: FT.strictSessionId || "",
        predictionWeight: IS_CUSTOM_STRICT ? 1 : 0.45,
        selectedPart1Topics: FT.selectedPart1Topics || [],
        selectedPart2Topic: FT.questions.part2?.title || "",
        overall: overallRes.overall,
        base: overallRes.base,
        delta: overallRes.delta,
        sections: { part1: p1, part2: p2, part3: p3 },
        part2Duration,
        questionCount: scored.length,
        answers: persistableAnswers,
      });
      try { localStorage.setItem(ftKey, JSON.stringify(list.slice(0, 5))); }
      catch (qe) {
        // Quota — drop answers from older entries
        const trimmed = list.slice(0, 5).map((t, i) => i === 0 ? t : ({ ...t, answers: undefined }));
        localStorage.setItem(ftKey, JSON.stringify(trimmed));
      }
    } catch (e) { console.warn("[FT] save history", e); }

    if (IS_CUSTOM_STRICT) {
      FT.strictGuardActive = false;
      await finishStrictSession("completed", "", {
        overall: overallRes.overall,
        questionCount: scored.length,
        selectedPart1Topics: FT.selectedPart1Topics,
        selectedPart2Topic: FT.questions.part2?.title || ""
      });
      try { if (document.fullscreenElement) await document.exitFullscreen(); } catch {}

      // ── Sync điểm lên Supabase (chỉ cho thi chống gian lận) ──
      try {
        const attempts = scored.map(s => {
          const c = s.score?.criteria || {};
          return {
            mode: "custom_strict",
            part: s.section === "part1" ? "PART 1" : s.section === "part2" ? "PART 2" : "PART 3",
            topic: s.topic || "",
            prompt_text: s.question || "",
            transcript: s.score?.transcript || "",
            audio_duration_ms: null,
            score_overall: s.score?.overall ?? null,
            score_fluency: c.fluency?.score ?? null,
            score_vocab: c.vocabulary?.score ?? null,
            score_grammar: c.grammar?.score ?? null,
            score_pronunciation: c.pronunciation?.score ?? null,
            raw_score_json: s.score || {},
            gemini_model: getModel(),
          };
        });
        fetch("/api/practice-attempts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: FT.strictSessionId || null, attempts })
        }).catch(e => console.warn("[FT] sync attempts:", e));
      } catch (e) { console.warn("[FT] sync attempts build:", e); }
    }

    showSummary(scored, { p1, p2, p3, overall: overallRes, part2Duration });
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  // Aggregate criteria across all parts to one general comment string. We DO NOT
  // hand the model a single Gemini call for this — we just pick the lowest-scoring
  // dimension and offer a generic Vietnamese suggestion (avoids extra latency).
  function buildGeneralFeedback(p1, p2, p3) {
    const merged = { fluency: 0, vocabulary: 0, grammar: 0, pronunciation: 0 };
    let n = 0;
    [p1, p2, p3].forEach(p => {
      if (p && p.count) {
        Object.keys(merged).forEach(k => { merged[k] += p.criteria[k]; });
        n++;
      }
    });
    if (n === 0) return "Chưa có đủ dữ liệu để đưa ra nhận xét chung.";
    Object.keys(merged).forEach(k => merged[k] /= n);
    const ranked = Object.entries(merged).sort((a, b) => a[1] - b[1]);
    const weakest = ranked[0];
    const labels = { fluency: "Độ trôi chảy", vocabulary: "Vốn từ vựng", grammar: "Ngữ pháp", pronunciation: "Phát âm" };
    const tips = {
      fluency: "Luyện nói liền mạch, hạn chế filler ('uh', 'um'), kéo dài câu trả lời với connectors.",
      vocabulary: "Mở rộng vocab chủ đề, dùng collocation thay vì từ phổ thông như 'good', 'bad'.",
      grammar: "Trộn câu phức + câu ghép, chú ý thì + sự hoà hợp chủ-vị.",
      pronunciation: "Luyện trọng âm + intonation, đặc biệt các âm cuối /s/, /t/, /d/.",
    };
    return `Điểm yếu nhất hiện tại: <b>${labels[weakest[0]]}</b> (band ${weakest[1].toFixed(1)}). ${tips[weakest[0]]}`;
  }

  function sectionBox(label, agg, color = "#d9381e") {
    if (!agg || !agg.count) return `<div style="background:#f3f4f6;border-radius:.5rem;padding:.7rem;font-size:.82rem;color:#9ca3af;">${label}: chưa có dữ liệu</div>`;
    return `
      <div style="background:#ffffff;border:1px solid #ffffff;border-radius:.6rem;padding:.7rem .9rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:700;color:${color};">${label}</div>
          <div style="font-size:1.3rem;font-weight:800;color:${color};">${agg.band.toFixed(1)}</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.5rem;font-size:.72rem;">
          <span style="background:white;border-radius:9999px;padding:.15rem .6rem;">Trôi chảy: <b>${agg.criteria.fluency.toFixed(1)}</b></span>
          <span style="background:white;border-radius:9999px;padding:.15rem .6rem;">Từ vựng: <b>${agg.criteria.vocabulary.toFixed(1)}</b></span>
          <span style="background:white;border-radius:9999px;padding:.15rem .6rem;">Ngữ pháp: <b>${agg.criteria.grammar.toFixed(1)}</b></span>
          <span style="background:white;border-radius:9999px;padding:.15rem .6rem;">Phát âm: <b>${agg.criteria.pronunciation.toFixed(1)}</b></span>
        </div>
        ${agg.cap ? `<div style="margin-top:.4rem;font-size:.72rem;color:var(--red);">⚠ ${agg.cap}</div>` : ""}
      </div>
    `;
  }

  function showSummary(scored, agg = {}) {
    const { p1, p2, p3, overall, part2Duration = 0 } = agg;
    const general = (p1 || p2 || p3) ? buildGeneralFeedback(p1, p2, p3) : "";

    const overallBlock = overall ? `
      <div style="background:linear-gradient(135deg,#d9381e 0%,#d9381e 100%);color:white;border-radius:.9rem;padding:1.3rem 1.5rem;margin-bottom:1rem;">
        <div style="font-size:.78rem;opacity:.85;">BAND OVERALL</div>
        <div style="font-size:3rem;font-weight:800;line-height:1;">${overall.overall.toFixed(1)}</div>
        <div style="font-size:.74rem;opacity:.85;margin-top:.4rem;">
          Base (Part 1 + Part 2): ${overall.base.toFixed(1)}
          ${overall.delta !== 0 ? ` · Part 3 điều chỉnh ${overall.delta > 0 ? "+" : ""}${overall.delta}` : " · Part 3 trung lập"}
        </div>
      </div>` : "";

    const sectionsBlock = `
      <div style="display:grid;grid-template-columns:1fr;gap:.6rem;margin-bottom:1rem;">
        ${sectionBox("Part 1 — Personal", p1, "#d9381e")}
        ${sectionBox(`Part 2 — Cue card (${Math.round(part2Duration)}s)`, p2, "#d9381e")}
        ${sectionBox("Part 3 — Discussion", p3, "#d9381e")}
      </div>
    `;

    const feedbackBlock = general ? `
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:.6rem;padding:.8rem 1rem;margin-bottom:1rem;">
        <div style="font-weight:700;color:#92400e;margin-bottom:.3rem;">💡 Nhận xét chung</div>
        <div style="font-size:.86rem;color:#171717;line-height:1.6;">${general}</div>
      </div>` : "";

    const answersBlock = scored.map((s, i) => {
      const partLabel = { part1: "PART 1", part2: "PART 2", part3: "PART 3" }[s.section] || "";
      const url = detailUrlFor(s);
      const ov = s.score?.overall;
      const txt = s.score?.transcript || "(không có transcript)";
      return `
        <div style="border:1px solid #e5e7eb;border-radius:.6rem;padding:.7rem .9rem;margin-bottom:.5rem;background:white;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.6rem;">
            <div style="flex:1;">
              <div style="font-size:.7rem;color:#9ca3af;font-weight:700;">${partLabel}${s.topic ? " · " + escapeHtml(s.topic) : ""}</div>
              <div style="font-weight:600;font-size:.88rem;margin:.2rem 0;color:#171717;">${escapeHtml(s.question.split("\n")[0])}</div>
            </div>
            ${typeof ov === "number" ? `<div style="background:#d9381e;color:white;border-radius:9999px;padding:.2rem .7rem;font-weight:700;font-size:.78rem;flex-shrink:0;">${ov}</div>` : ""}
          </div>
          <audio controls src="${s.audioUrl}" style="width:100%;margin:.4rem 0;"></audio>
          <div style="font-size:.78rem;color:#4b5563;line-height:1.55;">${escapeHtml(txt).slice(0, 280)}${txt.length > 280 ? "…" : ""}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:.5rem;">
            ${s.score?.warning ? `<div style="color:var(--red);font-size:.72rem;">⚠ ${escapeHtml(s.score.warning)}</div>` : "<div></div>"}
            <a href="${url}" class="ft-back" style="font-weight:600;color:#d9381e;">Luyện lại câu này →</a>
          </div>
        </div>
      `;
    }).join("");

    root.innerHTML = `
      <div class="ft-card" style="max-width:780px;">
        <h1 class="ft-h1" style="margin-bottom:.7rem;">${
          TEST_MODE === "full-test" ? "Kết quả Full Test" :
          TEST_MODE === "part1" ? "Kết quả Thi Part 1" :
          TEST_MODE === "part2" ? "Kết quả Thi Part 2" :
                                   "Kết quả Thi Part 3"
        }</h1>
        ${overallBlock}
        ${sectionsBlock}
        ${feedbackBlock}
        ${scored.length ? `
          <details style="margin-bottom:1rem;" open>
            <summary style="cursor:pointer;font-weight:600;color:#d9381e;font-size:.88rem;padding:.4rem 0;">📋 Xem chi tiết ${scored.length} câu đã thi</summary>
            <div style="margin-top:.6rem;">${answersBlock}</div>
          </details>` : `
          <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:.6rem;padding:.8rem 1rem;margin-bottom:1rem;font-size:.82rem;color:#92400e;">
            ⚠ <b>Bài thi cũ không lưu chi tiết từng câu.</b> Các câu trả lời đã được lưu vào lịch sử luyện tập riêng của từng câu — vào <a href="/question-answer/part1" style="color:#d9381e;font-weight:600;">Luyện theo câu</a> để xem. Thi mới để có chi tiết đầy đủ ở đây.
          </div>`}
        <div style="display:flex;justify-content:space-between;margin-top:1rem;">
          <button class="ft-btn ft-btn-ghost" onclick="location.href='/take-test/home'">Về trang thi thử</button>
          <button class="ft-btn ft-btn-primary" onclick="location.reload()">Thi lại</button>
        </div>
      </div>
    `;
  }

  // ──────────────── Past-result viewer ────────────────
  function showPastResult(ts) {
    let list = [];
    try { list = JSON.parse(localStorage.getItem("ln.fullTestHistory") || "[]"); } catch {}
    const entry = list.find(t => t.ts === ts);
    if (!entry) {
      root.innerHTML = `<div class="ft-card"><h1 class="ft-h1">Không tìm thấy kết quả</h1><a class="ft-back" href="/take-test/home">← Về trang thi thử</a></div>`;
      return;
    }
    // Re-hydrate "scored" array shape expected by showSummary
    const scored = (entry.answers || []).map(a => ({
      ...a,
      audioUrl: null,  // blob URL doesn't survive reload
      score: a.score || {},
    }));
    showSummary(scored, {
      p1: entry.sections.part1,
      p2: entry.sections.part2,
      p3: entry.sections.part3,
      overall: { overall: entry.overall, base: entry.base, delta: entry.delta },
      part2Duration: entry.part2Duration,
      isPastResult: true,
      hasAnswers: scored.length > 0,
    });
  }

  // ──────────────── Boot ────────────────
  async function boot() {
    mount();
    const params = new URLSearchParams(location.search);
    const resultTs = +params.get("result");
    if (resultTs) {
      showPastResult(resultTs);
      return;
    }
    await loadQuestionData();
    await showSetup();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();


