import { useEffect, useState } from "react";

import TgShell from "../../components/tg/TgShell";
import { apiFetch, useTgSession } from "../../lib/tg-miniapp-client";
import styles from "../../styles/tg-miniapp.module.css";

function formatEventLine(item) {
  const status = String(item && item.status ? item.status : "").trim();
  if (status === "pending") return "Pending";
  if (status === "expired") return "Expired";

  const rewardType = String(item && item.rewardType ? item.rewardType : "").trim();
  const amount = Math.max(0, Math.floor(Number(item && item.amount ? item.amount : 0)));
  const crystals = rewardType === "crystals" ? amount : 0;
  const credits = rewardType === "credits" ? amount : 0;
  return `Crystals +${crystals}, Credits +${credits}`;
}

function formatWhen(ts) {
  const value = Number(ts || 0);
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default function TgHistoryPage() {
  const { loading, error, me } = useTgSession();
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");

  useEffect(() => {
    if (loading || error || !me) return;
    let cancelled = false;

    async function loadEvents() {
      setEventsLoading(true);
      setEventsError("");
      const result = await apiFetch("/api/tg/rewards/history");
      if (cancelled) return;
      setEventsLoading(false);

      if (!result.ok) {
        const code = result.data && result.data.error ? result.data.error : "history_failed";
        setEventsError(`Could not load history (${code}).`);
        return;
      }

      setEvents(Array.isArray(result.data && result.data.events) ? result.data.events : []);
    }

    loadEvents();
    return () => {
      cancelled = true;
    };
  }, [loading, error, me]);

  return (
    <TgShell title="Rewards History" subtitle="Last 20 reward events for your linked StellarSiege account.">
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
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Event Log</h2>
          {eventsLoading ? <div className={styles.loadingCard} /> : null}
          {!eventsLoading && eventsError ? <p className={styles.error}>{eventsError}</p> : null}
          {!eventsLoading && !eventsError && events.length === 0 ? <p className={styles.help}>No reward events yet.</p> : null}

          {!eventsLoading && !eventsError && events.length > 0 ? (
            <ul className={styles.list}>
              {events.map((eventItem) => (
                <li key={eventItem.rewardId} className={styles.listItem}>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}>Reward</span>
                    <span className={styles.statValue}>{formatEventLine(eventItem)}</span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}>Status</span>
                    <span className={styles.statValue}>{String(eventItem.status || "-")}</span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}>Created</span>
                    <span className={styles.statValue}>{formatWhen(eventItem.createdAt)}</span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}>Paid</span>
                    <span className={styles.statValue}>{formatWhen(eventItem.paidAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </TgShell>
  );
}
