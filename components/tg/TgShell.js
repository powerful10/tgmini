import Head from "next/head";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import styles from "../../styles/tg-miniapp.module.css";

const THEME_STORAGE_KEY = "tg_theme_mode_v1";
const THEME_MODES = ["normal", "day", "night"];

function sanitizeThemeMode(value) {
  const safe = String(value || "").trim().toLowerCase();
  return THEME_MODES.includes(safe) ? safe : "normal";
}

function navActive(pathname, target) {
  const safePathname = String(pathname || "").trim();
  const safeTarget = String(target || "").trim();
  if (!safePathname || !safeTarget) return false;
  if (safeTarget === "/tg") return safePathname === "/tg";
  return safePathname === safeTarget || safePathname.startsWith(`${safeTarget}/`);
}

export default function TgShell({ title, subtitle, children }) {
  const router = useRouter();
  const pageTitle = title ? `${title} | StellarSiege Reward Center` : "StellarSiege Reward Center";
  const [themeMode, setThemeMode] = useState("normal");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      setThemeMode(sanitizeThemeMode(stored));
    } catch {
      setThemeMode("normal");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // Ignore storage errors in restricted webviews.
    }
  }, [themeMode]);

  const pageThemeClass = useMemo(() => {
    if (themeMode === "day") return styles.themeDay;
    if (themeMode === "night") return styles.themeNight;
    return styles.themeNormal;
  }, [themeMode]);

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Audiowide&family=Exo+2:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />

      <main className={`${styles.page} ${pageThemeClass}`}>
        <section className={styles.shell}>
          <header className={styles.header}>
            <p className={styles.kicker}>Telegram Mini App</p>
            <h1 className={styles.title}>{title || "Reward Center"}</h1>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
            <section className={styles.themeBar} aria-label="Theme mode">
              <span className={styles.themeLabel}>Theme</span>
              <div className={styles.themeSwitch}>
                <button
                  type="button"
                  className={`${styles.themeOption} ${themeMode === "normal" ? styles.themeOptionActive : ""}`}
                  onClick={() => setThemeMode("normal")}
                  aria-pressed={themeMode === "normal"}
                >
                  Normal
                </button>
                <button
                  type="button"
                  className={`${styles.themeOption} ${themeMode === "day" ? styles.themeOptionActive : ""}`}
                  onClick={() => setThemeMode("day")}
                  aria-pressed={themeMode === "day"}
                >
                  Day
                </button>
                <button
                  type="button"
                  className={`${styles.themeOption} ${themeMode === "night" ? styles.themeOptionActive : ""}`}
                  onClick={() => setThemeMode("night")}
                  aria-pressed={themeMode === "night"}
                >
                  Night
                </button>
              </div>
            </section>
            <nav className={styles.nav}>
              <Link className={`${styles.navLink} ${navActive(router.pathname, "/tg") ? styles.navLinkActive : ""}`} href="/tg">
                Home
              </Link>
              <Link className={`${styles.navLink} ${navActive(router.pathname, "/tg/link") ? styles.navLinkActive : ""}`} href="/tg/link">
                Link
              </Link>
              <Link className={`${styles.navLink} ${navActive(router.pathname, "/tg/ad") ? styles.navLinkActive : ""}`} href="/tg/ad">
                Ad
              </Link>
              <Link className={`${styles.navLink} ${navActive(router.pathname, "/tg/history") ? styles.navLinkActive : ""}`} href="/tg/history">
                History
              </Link>
            </nav>
          </header>
          <section className={styles.content}>{children}</section>
        </section>
      </main>
    </>
  );
}
