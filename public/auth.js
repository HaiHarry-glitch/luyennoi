(function () {
  if (window.__lnAuth) return;
  window.__lnAuth = true;

  const ACCESS_COOKIE = "ln_sb_access";
  const MAX_AGE = 60 * 60 * 24 * 30;

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

  async function syncPracticeAttemptsFromSupabase(client, userId) {
    if (!client || !userId) return 0;
    try {
      const { data, error } = await client
        .from("practice_attempts")
        .select("prompt_text,part,transcript,score_overall,score_fluency,score_vocab,score_grammar,score_pronunciation,raw_score_json,created_at,audio_path")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) { console.warn("[sync attempts]", error.message); return 0; }
      if (!Array.isArray(data) || !data.length) return 0;
      // Group by question (prompt_text)
      const byQuestion = {};
      for (const row of data) {
        const q = (row.prompt_text || "").trim();
        if (!q) continue;
        const item = {
          ts: new Date(row.created_at).getTime(),
          overall: row.score_overall,
          transcript: row.transcript || "",
          audioPath: row.audio_path || "",
          criteria: {
            fluency: row.score_fluency,
            vocabulary: row.score_vocab,
            grammar: row.score_grammar,
            pronunciation: row.score_pronunciation,
          },
          part: row.part || "",
          __fromSupabase: true,
          ...(row.raw_score_json || {}),
        };
        (byQuestion[q] = byQuestion[q] || []).push(item);
      }
      let count = 0;
      for (const [q, arr] of Object.entries(byQuestion)) {
        const key = "ln.scoreHistory:" + encodeURIComponent(q);
        // Merge with existing local entries (keep both, dedupe by ts)
        let existing = [];
        try { existing = JSON.parse(localStorage.getItem(key) || "[]"); } catch {}
        const seen = new Set(arr.map(x => x.ts));
        const merged = [...arr, ...existing.filter(x => !seen.has(x.ts))]
          .sort((a, b) => (b.ts || 0) - (a.ts || 0));
        localStorage.setItem(key, JSON.stringify(merged));
        count += arr.length;
      }
      console.log(`[ln-sync] Restored ${count} practice attempts from Supabase`);
      window.dispatchEvent(new CustomEvent("ln-data-synced", { detail: { count } }));
      return count;
    } catch (e) {
      console.warn("[ln-sync] failed:", e);
      return 0;
    }
  }

  async function syncSession(session) {
    if (session?.access_token) {
      setCookie("ln_auth", "1");
      setCookie(ACCESS_COOKIE, session.access_token);
      try {
        const user = session.user || {};
        const meta = user.user_metadata || {};
        localStorage.setItem("ln.user", JSON.stringify({
          id: user.id,
          email: user.email,
          name: meta.full_name || meta.name || user.email || "Học viên",
          avatar_url: meta.avatar_url || meta.picture || "",
          authenticated: true,
        }));
        localStorage.setItem("ln.authenticated", "1");
        // Background fetch user history from Supabase (don't block UI)
        if (window.__lnSupabase && user.id) {
          syncPracticeAttemptsFromSupabase(window.__lnSupabase, user.id);
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

  window.LNAuth = { getClient, initAuth, loginWithGoogle, logout };
  window.loginWithGoogle = loginWithGoogle;
  window.logout = logout;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuth);
  } else {
    initAuth();
  }
})();
