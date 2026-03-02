import Script from "next/script";
import { useMemo, useState } from "react";

import TgShell from "../../components/tg/TgShell";
import { apiFetch, useTgSession } from "../../lib/tg-miniapp-client";
import styles from "../../styles/tg-miniapp.module.css";

const MONETAG_SDK_URL = String(process.env.NEXT_PUBLIC_MONETAG_SDK_URL || "https://libtl.com/sdk.js").trim();
const MONETAG_ZONE_ID = String(process.env.NEXT_PUBLIC_MONETAG_ZONE_ID || "10673518").trim();
const MONETAG_SDK_FN = String(process.env.NEXT_PUBLIC_MONETAG_SDK_FN || "show_10673518").trim();
const STATUS_POLL_INTERVAL_MS = 1500;
const STATUS_POLL_TIMEOUT_MS = 45000;

function rewardBreakdown(type, amount) {
  const safeType = String(type || "").trim();
  const safeAmount = Math.max(0, Math.floor(Number(amount || 0)));
  if (!safeType || !safeAmount) return { credits: 0, crystals: 0 };
  if (safeType === "credits") return { credits: safeAmount, crystals: 0 };
  if (safeType === "crystals") return { credits: 0, crystals: safeAmount };
  return { credits: 0, crystals: 0 };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function TgAdPage() {
  const { loading, error, me, refreshMe } = useTgSession();
  const [creating, setCreating] = useState(false);
  const [runningAd, setRunningAd] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [result, setResult] = useState(null);
  const [uiError, setUiError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [statusNote, setStatusNote] = useState("");

  const isLinked = Boolean(me && me.linkStatus && me.linkStatus.linked);
  const rewardId = String(result && result.rewardId ? result.rewardId : "").trim();
  const status = String(result && result.status ? result.status : "").trim() || "";
  const payoutBreakdown = rewardBreakdown(result && result.rewardType, result && result.amount);

  async function createRewardEvent() {
    setUiError("");
    setSuccessMessage("");
    setStatusNote("");
    setCreating(true);
    const createResult = await apiFetch("/api/tg/rewards/create", {
      method: "POST",
      body: { placement: `tg_monetag_zone_${MONETAG_ZONE_ID}` }
    });
    setCreating(false);

    if (!createResult.ok) {
      const code = createResult.data && createResult.data.error ? createResult.data.error : "create_failed";
      setUiError(`Could not start reward (${code}).`);
      return null;
    }

    const next = {
      rewardId: createResult.data.rewardId,
      status: "pending",
      rewardType: null,
      amount: null,
      createdAt: Number(createResult.data.createdAt || Date.now()),
      paidAt: null,
      balances: null
    };
    setResult(next);
    return next;
  }

  async function fetchRewardStatus(targetRewardId, { silentPending = false } = {}) {
    const safeRewardId = String(targetRewardId || "").trim();
    if (!safeRewardId) return "unknown";

    setCheckingStatus(true);
    const statusRes = await apiFetch(`/api/tg/rewards/status?rewardId=${encodeURIComponent(safeRewardId)}`);
    setCheckingStatus(false);

    if (!statusRes.ok) {
      const code = statusRes.data && statusRes.data.error ? statusRes.data.error : "status_failed";
      setUiError(`Could not fetch reward status (${code}).`);
      return "unknown";
    }

    const nextStatus = String((statusRes.data && statusRes.data.status) || "pending").trim() || "pending";
    setResult((prev) => ({
      ...(prev || {}),
      rewardId: safeRewardId,
      status: nextStatus,
      rewardType: statusRes.data && statusRes.data.rewardType ? statusRes.data.rewardType : null,
      amount: statusRes.data && statusRes.data.amount != null ? Number(statusRes.data.amount) : null,
      createdAt: Number(statusRes.data && statusRes.data.createdAt ? statusRes.data.createdAt : Date.now()),
      paidAt: statusRes.data && statusRes.data.paidAt ? Number(statusRes.data.paidAt) : null
    }));

    if (nextStatus === "paid") {
      const won = rewardBreakdown(statusRes.data && statusRes.data.rewardType, statusRes.data && statusRes.data.amount);
      await refreshMe();
      setSuccessMessage(`Reward granted: Crystals +${won.crystals}, Credits +${won.credits}.`);
      setStatusNote("");
      return "paid";
    }

    if (nextStatus === "expired") {
      setUiError("Reward event expired before payout.");
      setStatusNote("");
      return "expired";
    }

    if (!silentPending) {
      setStatusNote("Still pending. Waiting for ad network postback...");
    }
    return nextStatus;
  }

  async function pollRewardStatusUntilPaid(targetRewardId) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < STATUS_POLL_TIMEOUT_MS) {
      const nextStatus = await fetchRewardStatus(targetRewardId, { silentPending: true });
      if (nextStatus === "paid" || nextStatus === "expired") return nextStatus;
      await delay(STATUS_POLL_INTERVAL_MS);
    }
    return "pending";
  }

  async function startRewardedAd() {
    if (!isLinked || creating || runningAd || checkingStatus) return;
    const created = await createRewardEvent();
    if (!created) return;

    if (typeof window === "undefined") return;
    const adFn = window[MONETAG_SDK_FN];
    if (typeof adFn !== "function") {
      setUiError("Monetag SDK is not ready yet. Reopen the mini app and retry.");
      return;
    }

    setUiError("");
    setSuccessMessage("");
    setStatusNote("Opening rewarded ad...");
    setRunningAd(true);

    try {
      await adFn({
        type: "end",
        ymid: created.rewardId,
        requestVar: created.rewardId
      });
    } catch {
      setStatusNote("");
      setUiError("Ad was closed before completion or failed to open.");
      return;
    } finally {
      setRunningAd(false);
    }

    setStatusNote("Ad completed. Verifying reward...");
    const polled = await pollRewardStatusUntilPaid(created.rewardId);
    if (polled !== "paid") {
      setStatusNote("Ad completed, but payout is still pending. Tap Check status in a few seconds.");
    }
  }

  const statusText = useMemo(() => {
    if (!status) return "Not started";
    if (status === "paid") return "Paid";
    if (status === "pending") return "Pending (awaiting postback)";
    if (status === "expired") return "Expired";
    return status;
  }, [status]);

  return (
    <TgShell
      title="Rewarded Ad"
      subtitle="Starts Monetag rewarded interstitial and credits rewards only after server verification."
    >
      <Script
        src={MONETAG_SDK_URL}
        strategy="afterInteractive"
        data-zone={MONETAG_ZONE_ID}
        data-sdk={MONETAG_SDK_FN}
      />

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
            <h2 className={styles.cardTitle}>Ad Flow</h2>
            <p className={styles.help}>
              Press Start Reward to open Monetag rewarded interstitial. Reward is added only after server postback confirms completion.
            </p>
            <div className={styles.buttonGrid}>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonPrimary}`}
                onClick={startRewardedAd}
                disabled={!isLinked || creating || runningAd || checkingStatus}
              >
                {!isLinked
                  ? "Link account first"
                  : creating
                  ? "Creating reward..."
                  : runningAd
                  ? "Ad running..."
                  : "Start Reward"}
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() => fetchRewardStatus(rewardId)}
                disabled={!rewardId || runningAd || checkingStatus}
              >
                {checkingStatus ? "Checking..." : "Check status"}
              </button>
            </div>
            {statusNote ? <p className={styles.help}>{statusNote}</p> : null}
            {successMessage ? <p className={styles.success}>{successMessage}</p> : null}
            {uiError ? <p className={styles.error}>{uiError}</p> : null}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Reward Result</h2>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Reward ID</span>
              <span className={styles.statValue}>{rewardId || "-"}</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Status</span>
              <span className={styles.statValue}>{statusText}</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Won Crystals</span>
              <span className={styles.statValue}>+{payoutBreakdown.crystals}</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Won Credits</span>
              <span className={styles.statValue}>+{payoutBreakdown.credits}</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Crystals Balance</span>
              <span className={styles.statValue}>
                {Number(me && me.wallet ? me.wallet.crystals || 0 : 0)}
              </span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Credits Balance</span>
              <span className={styles.statValue}>
                {Number(me && me.wallet ? me.wallet.credits || 0 : 0)}
              </span>
            </div>
          </section>
        </>
      ) : null}
    </TgShell>
  );
}
