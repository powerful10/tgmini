import { useEffect, useMemo, useState } from "react";

import TgShell from "../../components/tg/TgShell";
import { apiFetch, useTgSession } from "../../lib/tg-miniapp-client";
import styles from "../../styles/tg-miniapp.module.css";

const DEV_POSTBACK_SECRET = String(process.env.NEXT_PUBLIC_DEV_POSTBACK_SECRET || "").trim();

function formatReward(type, amount) {
  const safeType = String(type || "").trim();
  const safeAmount = Number(amount || 0);
  if (!safeType || !safeAmount) return "-";
  return `${safeType} +${safeAmount}`;
}

export default function TgAdPage() {
  const { loading, error, me, refreshMe } = useTgSession();
  const [creating, setCreating] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [uiError, setUiError] = useState("");

  const isLinked = Boolean(me && me.linkStatus && me.linkStatus.linked);
  const rewardId = String(result && result.rewardId ? result.rewardId : "").trim();
  const status = String(result && result.status ? result.status : "").trim() || "";
  const showSimulate = process.env.NODE_ENV !== "production";

  async function createRewardEvent() {
    setUiError("");
    setCreating(true);
    const createResult = await apiFetch("/api/tg/rewards/create", {
      method: "POST",
      body: { placement: "tg_ad_placeholder" }
    });
    setCreating(false);

    if (!createResult.ok) {
      const code = createResult.data && createResult.data.error ? createResult.data.error : "create_failed";
      setUiError(`Could not start reward (${code}).`);
      return;
    }

    setResult({
      rewardId: createResult.data.rewardId,
      status: "pending",
      rewardType: null,
      amount: null,
      createdAt: Date.now(),
      paidAt: null
    });
  }

  async function checkStatus() {
    if (!rewardId) return;
    setChecking(true);
    const statusResult = await apiFetch(`/api/tg/rewards/status?rewardId=${encodeURIComponent(rewardId)}`);
    setChecking(false);

    if (!statusResult.ok) {
      const code = statusResult.data && statusResult.data.error ? statusResult.data.error : "status_failed";
      setUiError(`Could not check reward status (${code}).`);
      return;
    }

    setResult({
      rewardId,
      status: statusResult.data.status,
      rewardType: statusResult.data.rewardType,
      amount: statusResult.data.amount,
      createdAt: statusResult.data.createdAt,
      paidAt: statusResult.data.paidAt,
      placement: statusResult.data.placement
    });

    if (String(statusResult.data.status || "") === "paid") {
      refreshMe();
    }
  }

  async function simulateCompletion() {
    if (!rewardId) return;
    if (!DEV_POSTBACK_SECRET) {
      setUiError("Set NEXT_PUBLIC_DEV_POSTBACK_SECRET for dev simulation.");
      return;
    }

    setUiError("");
    setSimulating(true);
    const postback = await apiFetch("/api/tg/rewards/postback", {
      method: "POST",
      headers: {
        "X-Postback-Secret": DEV_POSTBACK_SECRET
      },
      body: { rewardId }
    });
    setSimulating(false);

    if (!postback.ok) {
      const code = postback.data && postback.data.error ? postback.data.error : "postback_failed";
      setUiError(`Simulation failed (${code}).`);
      return;
    }

    await checkStatus();
  }

  useEffect(() => {
    if (!rewardId || status !== "pending") return undefined;
    const timer = setInterval(() => {
      checkStatus();
    }, 2500);
    return () => clearInterval(timer);
  }, [rewardId, status]);

  const statusText = useMemo(() => {
    if (!status) return "Not started";
    if (status === "paid") return "Paid";
    if (status === "pending") return "Pending";
    if (status === "expired") return "Expired";
    return status;
  }, [status]);

  return (
    <TgShell title="Reward Ad Placeholder" subtitle="Ad starting... this is a placeholder flow until Monetag postback integration.">
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
            <h2 className={styles.cardTitle}>Reward Event</h2>
            <p className={styles.help}>Start a reward event before ad completion callback.</p>
            <div className={styles.buttonGrid}>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonPrimary}`}
                onClick={createRewardEvent}
                disabled={!isLinked || creating}
              >
                {!isLinked ? "Link account first" : creating ? "Starting..." : "Start Reward"}
              </button>
              <button type="button" className={styles.button} onClick={checkStatus} disabled={!rewardId || checking}>
                {checking ? "Checking..." : "Check status"}
              </button>
              {showSimulate ? (
                <button
                  type="button"
                  className={styles.button}
                  onClick={simulateCompletion}
                  disabled={!rewardId || simulating || status === "paid"}
                >
                  {simulating ? "Simulating..." : "Simulate completion"}
                </button>
              ) : null}
            </div>
            {uiError ? <p className={styles.error}>{uiError}</p> : null}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Current State</h2>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Reward ID</span>
              <span className={styles.statValue}>{rewardId || "-"}</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Status</span>
              <span className={styles.statValue}>{statusText}</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Reward</span>
              <span className={styles.statValue}>{formatReward(result && result.rewardType, result && result.amount)}</span>
            </div>
          </section>
        </>
      ) : null}
    </TgShell>
  );
}
