import crypto from "node:crypto";

import { setCors } from "../../../../lib/http";
import { getFirestoreOrError, normalizePlacement, requireTgSession } from "../../../../lib/tg-api";
import { REWARD_EVENT_TTL_MS, periodKeyFromStart, quotaFromLimiter, toMillis } from "../../../../lib/tg-rewards";

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return;

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const session = requireTgSession(req, res);
  if (!session) return;

  const db = getFirestoreOrError(res);
  if (!db) return;

  const now = Date.now();
  const telegramId = String(session.telegramId || "").trim();
  const placement = normalizePlacement(req.body && req.body.placement);

  const linkSnap = await db.collection("telegram_links").doc(telegramId).get();
  if (!linkSnap.exists) {
    res.status(409).json({ ok: false, error: "telegram_not_linked" });
    return;
  }

  const linkData = linkSnap.data() || {};
  const uid = String(linkData.uid || "").trim();
  if (!uid) {
    res.status(409).json({ ok: false, error: "invalid_link_payload" });
    return;
  }

  const userSnap = await db.collection("users").doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() || {} : {};
  const limiter = userData && userData.rewardLimiter ? userData.rewardLimiter : null;
  const quota = quotaFromLimiter(limiter, now);

  if (quota.remaining <= 0) {
    res.status(429).json({ ok: false, error: "quota_reached", quota });
    return;
  }

  const existingSnap = await db.collection("reward_events").where("uid", "==", uid).limit(25).get();
  let activePending = null;

  for (const doc of existingSnap.docs) {
    const data = doc.data() || {};
    const status = String(data.status || "").trim();
    if (status !== "pending") continue;
    const expiresAtMs = toMillis(data.expiresAt);
    if (expiresAtMs <= now) continue;

    const createdAtMs = toMillis(data.createdAt);
    if (
      !activePending ||
      createdAtMs > toMillis(activePending.createdAt)
    ) {
      activePending = {
        rewardId: doc.id,
        createdAt: createdAtMs,
        expiresAt: expiresAtMs
      };
    }
  }

  if (activePending) {
    res.status(200).json({
      ok: true,
      rewardId: activePending.rewardId,
      createdAt: activePending.createdAt,
      expiresAt: activePending.expiresAt,
      quota,
      reused: true
    });
    return;
  }

  const rewardId = crypto.randomUUID();
  const expiresAt = now + REWARD_EVENT_TTL_MS;

  await db.collection("reward_events").doc(rewardId).set({
    uid,
    telegramId,
    status: "pending",
    createdAt: now,
    expiresAt,
    paidAt: null,
    rewardType: null,
    amount: null,
    periodKey: periodKeyFromStart(quota.periodStart),
    placement
  });

  res.status(200).json({
    ok: true,
    rewardId,
    createdAt: now,
    expiresAt,
    quota,
    reused: false
  });
}
