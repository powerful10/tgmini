import { setCors } from "../../../../lib/http";
import { getFirestoreOrError, requireTgSession } from "../../../../lib/tg-api";
import { toMillis } from "../../../../lib/tg-rewards";

function mapEvent(doc) {
  const data = doc.data() || {};
  return {
    rewardId: doc.id,
    status: String(data.status || "").trim() || "pending",
    rewardType: String(data.rewardType || "").trim() || null,
    amount: data.amount == null ? null : Number(data.amount),
    createdAt: toMillis(data.createdAt),
    paidAt: toMillis(data.paidAt),
    placement: String(data.placement || "").trim()
  };
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return;

  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const session = requireTgSession(req, res);
  if (!session) return;

  const db = getFirestoreOrError(res);
  if (!db) return;

  const telegramId = String(session.telegramId || "").trim();
  const linkSnap = await db.collection("telegram_links").doc(telegramId).get();
  if (!linkSnap.exists) {
    res.status(200).json({ ok: true, events: [] });
    return;
  }

  const uid = String((linkSnap.data() || {}).uid || "").trim();
  if (!uid) {
    res.status(200).json({ ok: true, events: [] });
    return;
  }

  const rawSnap = await db.collection("reward_events").where("uid", "==", uid).limit(120).get();
  const sorted = rawSnap.docs
    .map(mapEvent)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, 20);

  res.status(200).json({ ok: true, events: sorted });
}
