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

  const linked = useMemo(() => Boolean(me && me.linkStatus && me.linkStatus.linked), [me]);

  async function onSubmit(event) {
    event.preventDefault();
    setSubmitError("");
    setMessage("");

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
      setSubmitError(`Link failed (${errCode}).`);
      return;
    }

    setMessage("Account linked successfully. Returning to home...");
    await refreshMe();
    setTimeout(() => router.push("/tg"), 450);
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
            </form>
          </section>
        </>
      ) : null}
    </TgShell>
  );
}
