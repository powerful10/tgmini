import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import TgShell from "../../components/tg/TgShell";
import { formatRemainingTime, openTelegramUrl, useTgSession } from "../../lib/tg-miniapp-client";
import styles from "../../styles/tg-miniapp.module.css";

const CHANNEL_URL = String(process.env.NEXT_PUBLIC_TG_CHANNEL_URL || "").trim();
const BOT_URL = String(process.env.NEXT_PUBLIC_TG_BOT_URL || "").trim();

function renderUserName(user) {
  if (!user) return "-";
  if (user.username) return `@${user.username}`;
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return full || "-";
}

function shortUid(value) {
  const uid = String(value || "").trim();
  if (!uid) return "-";
  if (uid.length <= 10) return uid;
  return `${uid.slice(0, 6)}...${uid.slice(-4)}`;
}

export default function TgHomePage() {
  const { loading, error, me } = useTgSession();
  const [countdownMs, setCountdownMs] = useState(0);

  useEffect(() => {
    setCountdownMs(Math.max(0, Number(me && me.quota ? me.quota.resetInMs : 0)));
  }, [me]);

  useEffect(() => {
    if (!countdownMs) return undefined;
    const timer = setInterval(() => {
      setCountdownMs((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdownMs]);

  const quotaText = useMemo(() => {
    const quota = me && me.quota ? me.quota : null;
    if (!quota) return "-";
    return `${quota.remaining} / ${quota.limit} ads remaining`;
  }, [me]);

  return (
    <TgShell title="StellarSiege Reward Center" subtitle="Link your account, run rewarded actions, and track quota safely.">
      {loading ? (
        <section className={styles.card}>
          <div className={styles.loadingCard} />
        </section>
      ) : null}

      {!loading && error ? (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Session Error</h2>
          <p className={styles.error}>{error}</p>
        </section>
      ) : null}

      {!loading && !error ? (
        <>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Identity</h2>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Telegram ID</span>
              <span className={styles.statValue}>{String(me.telegramUser.id || "-")}</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Telegram User</span>
              <span className={styles.statValue}>{renderUserName(me.telegramUser)}</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Link Status</span>
              <span className={styles.statValue}>{me.linkStatus && me.linkStatus.linked ? "Linked" : "Not linked"}</span>
            </div>
            {me.linkStatus && me.linkStatus.linked ? (
              <>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Game Account</span>
                  <span className={styles.statValue}>
                    {me.linkedAccount && me.linkedAccount.displayName
                      ? me.linkedAccount.displayName
                      : shortUid(me.linkStatus.uid)}
                  </span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>UID</span>
                  <span className={styles.statValue}>{shortUid(me.linkStatus.uid)}</span>
                </div>
                <p className={styles.help}>
                  Linked and locked: this StellarSiege account is bound to Telegram ID {String(me.telegramUser.id || "-")}.
                </p>
              </>
            ) : null}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Quota</h2>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Available</span>
              <span className={styles.statValue}>{quotaText}</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Reset In</span>
              <span className={styles.statValue}>{formatRemainingTime(countdownMs)}</span>
            </div>
            {me.wallet ? (
              <>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Crystals</span>
                  <span className={styles.statValue}>{Number(me.wallet.crystals || 0)}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Credits</span>
                  <span className={styles.statValue}>{Number(me.wallet.credits || 0)}</span>
                </div>
              </>
            ) : null}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Actions</h2>
            <div className={styles.buttonGrid}>
              <Link className={`${styles.button} ${styles.buttonPrimary}`} href="/tg/link">
                Link account
              </Link>
              <Link
                className={`${styles.button} ${!me.linkStatus.linked ? styles.buttonDisabled : ""}`}
                href={me.linkStatus.linked ? "/tg/ad" : "#"}
                aria-disabled={!me.linkStatus.linked}
                onClick={(event) => {
                  if (!me.linkStatus.linked) event.preventDefault();
                }}
              >
                Watch Ad (Reward)
              </Link>
              <Link className={styles.button} href="/tg/history">
                Rewards history
              </Link>
              {CHANNEL_URL ? (
                <button type="button" className={styles.button} onClick={() => openTelegramUrl(CHANNEL_URL)}>
                  Join channel
                </button>
              ) : null}
              {BOT_URL ? (
                <button type="button" className={styles.button} onClick={() => openTelegramUrl(BOT_URL)}>
                  Support
                </button>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </TgShell>
  );
}
