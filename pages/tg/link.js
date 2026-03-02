import { useRouter } from "next/router";
import { useMemo, useState } from "react";

import TgShell from "../../components/tg/TgShell";
import { apiFetch, useTgSession } from "../../lib/tg-miniapp-client";
import styles from "../../styles/tg-miniapp.module.css";

function sanitizeCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

export default function TgLinkPage() {
  const router = useRouter();
  const { loading, error, me, refreshMe } = useTgSession();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [linkedReport, setLinkedReport] = useState(null);

  const linked = useMemo(() => Boolean(me && me.linkStatus && me.linkStatus.linked), [me]);

  function linkErrorText(code) {
    const safe = String(code || "link_failed").trim();
    if (safe === "code_expired") return "This code expired. Generate a new one on the website.";
    if (safe === "code_used") return "This code was already used by another Telegram account.";
    if (safe === "uid_linked_to_other_telegram") return "This game account is already locked to another Telegram account.";
    if (safe === "telegram_already_linked") return "This Telegram account is already linked to a different game account.";
    if (safe === "code_not_found") return "Code not found. Check the code and try again.";
    return `Link failed (${safe}).`;
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSubmitError("");
    setMessage("");
    setLinkedReport(null);

    const normalized = sanitizeCode(code);
    if (!/^[A-Z0-9]{6,8}$/.test(normalized)) {
      setSubmitError("Enter a valid 6-8 character code.");
      return;
    }

    setSubmitting(true);
    const result = await apiFetch("/api/tg/link", {
      method: "POST",
      body: { code: normalized }
    });
    setSubmitting(false);

    if (!result.ok) {
      const errCode = result.data && result.data.error ? result.data.error : "link_failed";
      setSubmitError(linkErrorText(errCode));
      return;
    }

    const report = result.data && result.data.linkedAccount ? result.data.linkedAccount : null;
    setLinkedReport(report);
    setMessage("Account linked successfully and locked to this Telegram profile.");
    await refreshMe();
    setTimeout(() => router.push("/tg"), 1200);
  }

  return (
    <TgShell title="Link Account" subtitle="Use a one-time code generated on the StellarSiege website.">
      {loading ? (
        <section className={styles.card}>
          <div className={styles.loadingCard} />
        </section>
      ) : null}

      {!loading && error ? (
        <section className={styles.card}>
          <p className={styles.error}>{error}</p>
        </section>
      ) : null}

      {!loading && !error ? (
        <>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Steps</h2>
            <p className={styles.help}>1. Open StellarSiege website while signed in with Google.</p>
            <p className={styles.help}>2. Generate a Telegram link code (valid for 5 minutes).</p>
            <p className={styles.help}>3. Enter the code below to bind this Telegram account.</p>
            <p className={styles.help}>
              Current status: <strong>{linked ? "Linked" : "Not linked"}</strong>
            </p>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Enter Code</h2>
            <form onSubmit={onSubmit} className={styles.field}>
              <label className={styles.label} htmlFor="tg-link-code">
                One-time link code
              </label>
              <input
                id="tg-link-code"
                className={styles.input}
                value={code}
                onChange={(event) => setCode(sanitizeCode(event.target.value))}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="EX: A9B2KD"
              />
              <button
                type="submit"
                className={`${styles.button} ${styles.buttonPrimary}`}
                disabled={submitting || linked}
              >
                {linked ? "Already linked" : submitting ? "Linking..." : "Submit"}
              </button>
              {submitError ? <p className={styles.error}>{submitError}</p> : null}
              {message ? <p className={styles.success}>{message}</p> : null}
              {linkedReport ? (
                <div className={styles.field}>
                  <p className={styles.help}>
                    Linked account: {linkedReport.displayName || linkedReport.uid}
                  </p>
                  <p className={styles.help}>UID: {linkedReport.uid}</p>
                  <p className={styles.help}>Lock: only this Telegram account can use this link.</p>
                </div>
              ) : null}
            </form>
          </section>
        </>
      ) : null}
    </TgShell>
  );
}
