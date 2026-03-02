import { setCors } from "../../../../lib/http";
import { getFirestoreOrError, requireTgSession } from "../../../../lib/tg-api";
import { mapRewardError, payoutRewardEvent } from "../../../../lib/tg-reward-payout";

function isMockEnabled() {
const raw = String(process.env.TG_ENABLE_MOCK_AD || "true").trim().toLowerCase();
  return !["0", "false", "off", "no"].includes(raw);
}

function mockAdDurationMs() {
  const raw = Number(process.env.TG_MOCK_AD_SECONDS || 15);
  const safeSec = Number.isFinite(raw) ? Math.max(5, Math.floor(raw)) : 15;
  return safeSec * 1000;
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return;

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  if (!isMockEnabled()) {
    res.status(403).json({ ok: false, error: "mock_ad_disabled" });
    return;
  }

  const session = requireTgSession(req, res);
  if (!session) return;

  const rewardId = String((req.body && req.body.rewardId) || "").trim();
  if (!rewardId) {
    res.status(400).json({ ok: false, error: "missing_reward_id" });
    return;
  }

  const db = getFirestoreOrError(res);
  if (!db) return;

  try {
    const outcome = await payoutRewardEvent({
      db,
      rewardId,
      nowMs: Date.now(),
      expectedTelegramId: String(session.telegramId || "").trim(),
      paidBy: "mock_ad",
      minEventAgeMs: mockAdDurationMs()
    });

    res.status(200).json({ ok: true, ...outcome });
  } catch (error) {
    const mapped = mapRewardError(error, "mock_complete_failed");
    res.status(mapped.status).json({ ok: false, error: mapped.code });
  }
}
