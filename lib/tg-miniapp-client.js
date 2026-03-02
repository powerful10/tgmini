import { useCallback, useEffect, useMemo, useState } from "react";

import { TG_SESSION_HEADER_NAME } from "./tg-session";

const TG_SESSION_STORAGE_KEY = "tg_session_fallback_v1";

function getTelegramWebApp() {
  if (typeof window === "undefined") return null;
  return window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
}

function setThemeVars(themeParams) {
  if (typeof document === "undefined") return;
  if (!themeParams || typeof themeParams !== "object") return;

  const map = {
    "--tg-bg": themeParams.bg_color,
    "--tg-text": themeParams.text_color,
    "--tg-hint": themeParams.hint_color,
    "--tg-link": themeParams.link_color,
    "--tg-button": themeParams.button_color,
    "--tg-button-text": themeParams.button_text_color,
    "--tg-secondary-bg": themeParams.secondary_bg_color
  };

  Object.entries(map).forEach(([key, value]) => {
    if (value) document.documentElement.style.setProperty(key, String(value));
  });
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function readFallbackToken() {
  if (!canUseStorage()) return "";
  try {
    return String(window.sessionStorage.getItem(TG_SESSION_STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
}

function writeFallbackToken(token) {
  if (!canUseStorage()) return;
  const value = String(token || "").trim();
  try {
    if (!value) {
      window.sessionStorage.removeItem(TG_SESSION_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(TG_SESSION_STORAGE_KEY, value);
  } catch {
    // Ignore storage errors in restricted webviews.
  }
}

export async function apiFetch(path, { method = "GET", body, headers } = {}) {
  const fallbackToken = readFallbackToken();

  const response = await fetch(path, {
    method,
    credentials: "include",
    headers: {
      ...(headers || {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(fallbackToken ? { [TG_SESSION_HEADER_NAME]: fallbackToken } : {})
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

export function formatRemainingTime(ms) {
  const totalSec = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function useTgSession() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [me, setMe] = useState(null);

  const refreshMe = useCallback(async () => {
    const meResult = await apiFetch("/api/tg/me");
    if (!meResult.ok) return meResult;
    setMe(meResult.data || null);
    return meResult;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function establish() {
      setLoading(true);
      setError("");

      const webApp = getTelegramWebApp();
      if (webApp) {
        try {
          webApp.ready();
          webApp.expand();
          setThemeVars(webApp.themeParams || {});
        } catch {
          // Ignore Telegram runtime errors on web fallback.
        }
      }

      const meResult = await apiFetch("/api/tg/me");
      if (cancelled) return;
      if (meResult.ok) {
        setMe(meResult.data || null);
        setLoading(false);
        return;
      }

      const initData = webApp && typeof webApp.initData === "string" ? webApp.initData.trim() : "";
      if (!initData) {
        setError("Open this mini app from Telegram.");
        setLoading(false);
        return;
      }

      const authResult = await apiFetch("/api/tg/auth", {
        method: "POST",
        body: { initData }
      });
      if (cancelled) return;
      if (!authResult.ok) {
        const code = authResult.data && authResult.data.error ? authResult.data.error : "auth_failed";
        setError(`Telegram auth failed (${code}).`);
        setLoading(false);
        return;
      }

      const sessionToken = String((authResult.data && authResult.data.sessionToken) || "").trim();
      if (sessionToken) {
        writeFallbackToken(sessionToken);
      }

      const refreshed = await apiFetch("/api/tg/me");
      if (cancelled) return;
      if (!refreshed.ok) {
        const code = refreshed.data && refreshed.data.error ? refreshed.data.error : "session_unavailable";
        setError(`Could not establish mini app session (${code}).`);
        setLoading(false);
        return;
      }

      setMe(refreshed.data || null);
      setLoading(false);
    }

    establish();
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () => ({
      loading,
      error,
      me,
      refreshMe
    }),
    [loading, error, me, refreshMe]
  );
}

export function openTelegramUrl(url) {
  const href = String(url || "").trim();
  if (!href) return;

  const webApp = getTelegramWebApp();
  if (webApp && typeof webApp.openTelegramLink === "function" && /^https?:\/\/t\.me\//i.test(href)) {
    webApp.openTelegramLink(href);
    return;
  }

  if (typeof window !== "undefined") {
    window.open(href, "_blank", "noopener,noreferrer");
  }
}
