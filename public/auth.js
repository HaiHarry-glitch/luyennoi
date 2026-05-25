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
