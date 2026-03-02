import { setCors } from "../../../../lib/http";
import { getFirestoreOrError, requireTgSession } from "../../../../lib/tg-api";
import { mapRewardError, payoutRewardEvent } from "../../../../lib/tg-reward-payout";

function toObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function readText(source, keys) {
  const safeSource = toObject(source);
  for (const key of keys) {
    const value = safeSource[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function isPaidReward(value) {
  const safe = String(value || "").trim().toLowerCase();
  if (!safe) return false;
  return ["yes", "true", "1", "valued", "paid"].includes(safe);
}

function minAgeMs() {
  const raw = Number(process.env.TG_FRONTEND_REWARD_MIN_AGE_MS || 12000);
  if (!Number.isFinite(raw)) return 12000;
  return Math.max(5000, Math.floor(raw));
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return;

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const session = requireTgSession(req, res);
  if (!session) return;

  const rewardId = String((req.body && req.body.rewardId) || "").trim();
  if (!rewardId) {
    res.status(400).json({ ok: false, error: "missing_reward_id" });
    return;
  }

  const sdkResult = toObject((req.body && (req.body.sdkResult || req.body.result)) || {});
  const rewardEventType = readText(sdkResult, ["reward_event_type", "rewardEventType"]);
  if (!isPaidReward(rewardEventType)) {
    res.status(409).json({ ok: false, error: "reward_event_not_paid" });
    return;
  }

  const sdkYmid = readText(sdkResult, ["ymid", "YMID"]);
  if (sdkYmid && sdkYmid !== rewardId) {
    res.status(409).json({ ok: false, error: "invalid_ymid" });
    return;
  }

  const sdkRequestVar = readText(sdkResult, ["request_var", "requestVar", "REQUEST_VAR"]);
  if (sdkRequestVar && sdkRequestVar !== rewardId) {
    res.status(409).json({ ok: false, error: "invalid_request_var" });
    return;
  }

  const expectedZoneId = String(process.env.NEXT_PUBLIC_MONETAG_ZONE_ID || "").trim();
  const sdkZoneId = readText(sdkResult, ["zone_id", "zoneId", "ZONE_ID"]);
  if (expectedZoneId && sdkZoneId && sdkZoneId !== expectedZoneId) {
    res.status(409).json({ ok: false, error: "invalid_zone_id" });
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
      paidBy: "frontend_callback",
      minEventAgeMs: minAgeMs()
    });

    res.status(200).json({ ok: true, ...outcome });
  } catch (error) {
    const mapped = mapRewardError(error, "frontend_complete_failed");
    res.status(mapped.status).json({ ok: false, error: mapped.code });
  }
}
