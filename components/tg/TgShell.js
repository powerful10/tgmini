import Head from "next/head";
import Script from "next/script";
import Link from "next/link";

import styles from "../../styles/tg-miniapp.module.css";

export default function TgShell({ title, subtitle, children }) {
  const pageTitle = title ? `${title} | StellarSiege Reward Center` : "StellarSiege Reward Center";

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

      <main className={styles.page}>
        <section className={styles.shell}>
          <header className={styles.header}>
            <p className={styles.kicker}>Telegram Mini App</p>
            <h1 className={styles.title}>{title || "Reward Center"}</h1>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
            <nav className={styles.nav}>
              <Link className={styles.navLink} href="/tg">
                Home
              </Link>
              <Link className={styles.navLink} href="/tg/link">
                Link
              </Link>
              <Link className={styles.navLink} href="/tg/ad">
                Ad
              </Link>
              <Link className={styles.navLink} href="/tg/history">
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
