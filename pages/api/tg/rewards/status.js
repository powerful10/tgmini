import { setCors } from "../../../../lib/http";
import { getFirestoreOrError, requireTgSession } from "../../../../lib/tg-api";
import { toMillis } from "../../../../lib/tg-rewards";

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return;

  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const session = requireTgSession(req, res);
  if (!session) return;

  const rewardId = String(req.query.rewardId || "").trim();
  if (!rewardId) {
    res.status(400).json({ ok: false, error: "missing_reward_id" });
    return;
  }

  const db = getFirestoreOrError(res);
  if (!db) return;

  const ref = db.collection("reward_events").doc(rewardId);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ ok: false, error: "reward_not_found" });
    return;
  }

  const data = snap.data() || {};
  const telegramId = String(data.telegramId || "").trim();
  if (telegramId !== String(session.telegramId || "").trim()) {
    res.status(404).json({ ok: false, error: "reward_not_found" });
    return;
  }

  const now = Date.now();
  const status = String(data.status || "").trim();
  const expiresAt = toMillis(data.expiresAt);
  if (status === "pending" && expiresAt > 0 && now > expiresAt) {
    await ref.set(
      {
        status: "expired",
        expiredAt: now,
        expiredReason: "timeout"
      },
      { merge: true }
    );
  }

  const latest = (await ref.get()).data() || {};
  res.status(200).json({
    ok: true,
    rewardId,
    status: String(latest.status || "pending"),
    rewardType: latest.rewardType || null,
    amount: latest.amount == null ? null : Number(latest.amount),
    createdAt: toMillis(latest.createdAt),
    expiresAt: toMillis(latest.expiresAt),
    paidAt: toMillis(latest.paidAt),
    placement: String(latest.placement || "").trim()
  });
}
