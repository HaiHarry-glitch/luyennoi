(function () {
  if (window.__lnAuth) return;
  window.__lnAuth = true;

  const ACCESS_COOKIE = "ln_sb_access";
  const MAX_AGE = 60 * 60 * 24 * 30;
  const SCORE_HISTORY_PREFIX = "ln.scoreHistory:";
  const SCORE_HISTORY_INDEX_KEY = "ln.scoreHistoryIndex";
  const MAX_LOCAL_SCORE_QUESTIONS = 30;
  const MAX_LOCAL_SCORE_ATTEMPTS_PER_Q = 3;

  function setCookie(name, value, maxAge = MAX_AGE) {
    document.cookie = `${name}=${encodeURIComponent(value || "")}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  }

  function clearCookie(name) {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
  }

  async function loadConfig() {
    if (window.__lnSupabaseConfig) return window.__lnSupabaseConfig;
    const res = await fetch("/api/supabase/config", { cache: "no-store" });
    const cfg = await res.json();
    window.__lnSupabaseConfig = cfg;
    return cfg;
  }

  async function getClient() {
    if (window.__lnSupabase) return window.__lnSupabase;
    const cfg = await loadConfig();
    if (!cfg?.url || !cfg?.publishableKey || !window.supabase?.createClient) return null;
    window.__lnSupabase = window.supabase.createClient(cfg.url, cfg.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return window.__lnSupabase;
  }

  // localStorage caps at ~5MB per origin in most browsers. Spreading raw_score_json
  // (transcript + grammar/vocab/pronun issues) for 500 questions explodes well past
  // that, especially when local entries already store base64 audio. Whittle down each
  // entry to just what the score panel needs and cap entries per question.
  const MAX_SUPA_ENTRIES_PER_Q = 8;
  function trimSupabaseAttempt(row) {
    const raw = row.raw_score_json || {};
    return {
      ts: new Date(row.created_at).getTime(),
      overall: row.score_overall,
      transcript: row.transcript || raw.transcript || "",
      audioPath: row.audio_path || "",
      criteria: {
        fluency: row.score_fluency,
        vocabulary: row.score_vocab,
        grammar: row.score_grammar,
        pronunciation: row.score_pronunciation,
      },
      rewrittenAnswer: raw.rewrittenAnswer || "",
      feedback: raw.feedback || "",
      pronunciationIssues: Array.isArray(raw.pronunciationIssues) ? raw.pronunciationIssues.slice(0, 12) : [],
      grammarIssues: Array.isArray(raw.grammarIssues) ? raw.grammarIssues.slice(0, 12) : [],
      vocabularyIssues: Array.isArray(raw.vocabularyIssues) ? raw.vocabularyIssues.slice(0, 12) : [],
      spellingIssues: Array.isArray(raw.spellingIssues) ? raw.spellingIssues.slice(0, 8) : [],
      fluencyPauses: Array.isArray(raw.fluencyPauses) ? raw.fluencyPauses.slice(0, 8) : [],
      part: row.part || raw.part || "",
      model: raw.model || "",
      environmentWarning: raw.environmentWarning || "",
      warning: raw.warning || "",
      __fromSupabase: true,
    };
  }

  function safeSetItem(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (e) {
      if (e?.name !== "QuotaExceededError" && e?.code !== 22) throw e;
      return false;
    }
  }

  function trimLocalScoreEntry(entry = {}) {
    const {
      audioDataUrl, audioUrl, raw,
      pronunciationIssues, grammarIssues, vocabularyIssues, spellingIssues, fluencyPauses,
      ...rest
    } = entry || {};
    return {
      ...rest,
      transcript: String(rest.transcript || "").slice(0, 700),
      rewrittenAnswer: String(rest.rewrittenAnswer || "").slice(0, 900),
      feedback: String(rest.feedback || "").slice(0, 900),
      suggestions: Array.isArray(rest.suggestions) ? rest.suggestions.slice(0, 4) : rest.suggestions,
      pronunciationIssues: Array.isArray(pronunciationIssues) ? pronunciationIssues.slice(0, 5) : [],
      grammarIssues: Array.isArray(grammarIssues) ? grammarIssues.slice(0, 5) : [],
      vocabularyIssues: Array.isArray(vocabularyIssues) ? vocabularyIssues.slice(0, 5) : [],
      spellingIssues: Array.isArray(spellingIssues) ? spellingIssues.slice(0, 4) : [],
      fluencyPauses: Array.isArray(fluencyPauses) ? fluencyPauses.slice(0, 4) : [],
    };
  }

  function cleanupLocalScoreCache() {
    try {
      const entries = [];
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(SCORE_HISTORY_PREFIX)) continue;
        let arr = [];
        try { arr = JSON.parse(localStorage.getItem(key) || "[]"); } catch {}
        const slim = (Array.isArray(arr) ? arr : [])
          .filter((item) => item?.__realAttempt && item?.transcript && item?.criteria)
          .slice(0, MAX_LOCAL_SCORE_ATTEMPTS_PER_Q)
          .map(trimLocalScoreEntry);
        if (!slim.length) {
          try { localStorage.removeItem(key); } catch {}
          continue;
        }
        safeSetItem(key, JSON.stringify(slim));
        entries.push([key, Number(slim[0]?.ts || slim[0]?.created_at || 0) || 0]);
      }
      entries.sort((a, b) => b[1] - a[1]);
      const keep = new Set(entries.slice(0, MAX_LOCAL_SCORE_QUESTIONS).map(([key]) => key));
      const idx = {};
      for (const [key, ts] of entries) {
        if (keep.has(key)) idx[key] = ts || Date.now();
        else {
          try { localStorage.removeItem(key); } catch {}
        }
      }
      safeSetItem(SCORE_HISTORY_INDEX_KEY, JSON.stringify(idx));
    } catch {}
  }

  // When the storage quota is hit, evict the oldest scoreHistory keys until
  // setItem succeeds. As a final safety, drop heavy fields from the payload.
  function setScoreHistoryWithEviction(key, arr) {
    const tryWrite = (entries) => safeSetItem(key, JSON.stringify(entries));
    if (tryWrite(arr)) return true;
    // 1. Evict oldest other ln.scoreHistory: keys (keep the active key).
    const candidates = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("ln.scoreHistory:") && k !== key) candidates.push(k);
    }
    candidates.sort((a, b) => {
      const aTs = (() => { try { return JSON.parse(localStorage.getItem(a) || "[]")[0]?.ts || 0; } catch { return 0; } })();
      const bTs = (() => { try { return JSON.parse(localStorage.getItem(b) || "[]")[0]?.ts || 0; } catch { return 0; } })();
      return aTs - bTs;
    });
    for (const k of candidates) {
      localStorage.removeItem(k);
      if (tryWrite(arr)) return true;
    }
    // 2. Last resort: drop heavy fields and retry.
    const slim = arr.slice(0, MAX_SUPA_ENTRIES_PER_Q).map((entry) => ({
      ts: entry.ts,
      overall: entry.overall,
      criteria: entry.criteria,
      part: entry.part,
      transcript: (entry.transcript || "").slice(0, 600),
      __fromSupabase: !!entry.__fromSupabase,
    }));
    return tryWrite(slim);
  }

  async function syncPracticeAttemptsFromSupabase(client, userId) {
    if (!client || !userId) return 0;
    try {
      cleanupLocalScoreCache();
      window.dispatchEvent(new CustomEvent("ln-data-synced", { detail: { count: 0, dropped: 0, cloudOnly: true } }));
      return 0;
    } catch (e) {
      console.warn("[ln-sync] failed:", e);
      return 0;
    }
  }

  async function syncProfileSettingsFromSupabase(client, userId) {
    if (!client || !userId) return null;
    try {
      const { data, error } = await client
        .from("profiles")
        .select("gemini_api_keys,gemini_model")
        .eq("id", userId)
        .maybeSingle();
      if (error) { console.warn("[profile settings]", error.message); return null; }
      const keys = Array.isArray(data?.gemini_api_keys) ? data.gemini_api_keys.filter(Boolean) : [];
      if (keys.length) {
        safeSetItem("luyennoi.geminiKeys", JSON.stringify(keys));
        safeSetItem("luyennoi.geminiKey", keys[0]);
      }
      if (data?.gemini_model) safeSetItem("luyennoi.geminiModel", data.gemini_model);
      window.dispatchEvent(new CustomEvent("ln-profile-settings-synced", { detail: { keys: keys.length, model: data?.gemini_model || "" } }));
      return data;
    } catch (e) {
      console.warn("[profile settings] failed:", e);
      return null;
    }
  }

  async function saveProfileSettings(settings = {}) {
    const client = await getClient();
    if (!client) throw new Error("Supabase client chưa sẵn sàng");
    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user?.id) throw new Error("Bạn cần đăng nhập để lưu profile");
    const patch = { updated_at: new Date().toISOString() };
    if (Array.isArray(settings.geminiKeys)) patch.gemini_api_keys = settings.geminiKeys.filter(Boolean);
    if (typeof settings.geminiModel === "string") patch.gemini_model = settings.geminiModel;
    const { error } = await client.from("profiles").update(patch).eq("id", user.id);
    if (error) throw error;
    await syncProfileSettingsFromSupabase(client, user.id);
    return true;
  }

  async function syncSession(session) {
    if (session?.access_token) {
      setCookie("ln_auth", "1");
      setCookie(ACCESS_COOKIE, session.access_token);
      try {
        const user = session.user || {};
        const meta = user.user_metadata || {};
        safeSetItem("ln.user", JSON.stringify({
          id: user.id,
          email: user.email,
          name: meta.full_name || meta.name || user.email || "Học viên",
          avatar_url: meta.avatar_url || meta.picture || "",
          authenticated: true,
        }));
        safeSetItem("ln.authenticated", "1");
        if (window.__lnSupabase && user.id) {
          syncPracticeAttemptsFromSupabase(window.__lnSupabase, user.id);
          syncProfileSettingsFromSupabase(window.__lnSupabase, user.id);
        }
      } catch {}
    } else {
      clearCookie(ACCESS_COOKIE);
      try { localStorage.removeItem("ln.authenticated"); } catch {}
    }
    window.dispatchEvent(new CustomEvent("ln-auth-change", { detail: { session } }));
  }

  async function initAuth() {
    const client = await getClient();
    if (!client) return null;
    const { data } = await client.auth.getSession();
    await syncSession(data?.session || null);
    // Don't auto-redirect — let user stay on landing page and click to enter
    client.auth.onAuthStateChange((_event, session) => {
      syncSession(session || null);
    });
    return data?.session || null;
  }

  async function loginWithGoogle() {
    const client = await getClient();
    if (!client) {
      window.location.href = "/api/login";
      return;
    }
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/login" },
    });
    if (error) {
      alert("Không mở được Google login: " + error.message);
    }
  }

  async function logout() {
    const client = await getClient();
    try { await client?.auth.signOut(); } catch {}
    clearCookie("ln_auth");
    clearCookie(ACCESS_COOKIE);
    try {
      localStorage.removeItem("ln.user");
      localStorage.removeItem("ln.authenticated");
      // Clear Supabase persisted session to prevent auto-restore
      Object.keys(localStorage).forEach(k => { if (k.startsWith("sb-")) localStorage.removeItem(k); });
    } catch {}
    window.location.href = "/logout";
  }

  window.LNAuth = { getClient, initAuth, loginWithGoogle, logout, syncProfileSettingsFromSupabase, saveProfileSettings };
  window.loginWithGoogle = loginWithGoogle;
  window.logout = logout;

  cleanupLocalScoreCache();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuth);
  } else {
    initAuth();
  }
})();
