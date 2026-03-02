import {
  secureTextEqual,
} from "../../../../lib/tg-rewards";
import { getFirestoreOrError } from "../../../../lib/tg-api";
import { pickHeader, setCors } from "../../../../lib/http";
import { mapRewardError, payoutRewardEvent } from "../../../../lib/tg-reward-payout";

function valuesFromSource(source, keys) {
  if (!source || typeof source !== "object") return [];
  const out = [];
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) {
      for (const part of value) {
        const text = String(part || "").trim();
        if (text) out.push(text);
      }
      continue;
    }
    const text = String(value || "").trim();
    if (text) out.push(text);
  }
  return out;
}

function firstValue(source, keys) {
  const values = valuesFromSource(source, keys);
  return values.length > 0 ? values[0] : "";
}

function candidateSecrets(req) {
  const authHeader = pickHeader(req.headers.authorization || "");
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const bearerToken = bearerMatch ? String(bearerMatch[1] || "").trim() : "";

  return [
    pickHeader(req.headers["x-postback-secret"]),
    bearerToken,
    ...valuesFromSource(req.query, ["token", "secret", "postback_secret"]),
    ...valuesFromSource(req.body, ["token", "secret", "postback_secret"])
  ].filter(Boolean);
}

function hasMatchingSecret(expected, candidates) {
  for (const candidate of candidates) {
    if (secureTextEqual(expected, candidate)) return true;
  }
  return false;
}

function rewardIdFromRequest(req) {
  return firstValue(req.body, ["rewardId", "reward_id", "ymid", "subid", "sub_id", "request_var", "requestVar"])
    || firstValue(req.query, ["rewardId", "reward_id", "ymid", "subid", "sub_id", "request_var", "requestVar"]);
}

function rewardEventTypeFromRequest(req) {
  return firstValue(req.query, ["reward_event_type", "rewardEventType"])
    || firstValue(req.body, ["reward_event_type", "rewardEventType"]);
}

function rewardEventIsPaid(value) {
  const safe = String(value || "").trim().toLowerCase();
  if (!safe) return null;
  if (["yes", "true", "1", "valued", "paid"].includes(safe)) return true;
  if (["no", "false", "0", "unvalued", "unpaid"].includes(safe)) return false;
  return null;
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return;

  if (req.method !== "POST" && req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const expectedSecret = String(process.env.POSTBACK_SECRET || "").trim();
  if (!expectedSecret) {
    res.status(501).json({ ok: false, error: "missing_postback_secret" });
    return;
  }

  const providedSecrets = candidateSecrets(req);
  if (!hasMatchingSecret(expectedSecret, providedSecrets)) {
    res.status(401).json({ ok: false, error: "invalid_postback_secret" });
    return;
  }

  const rewardId = rewardIdFromRequest(req);
  if (!rewardId) {
    res.status(400).json({ ok: false, error: "missing_reward_id" });
    return;
  }

  const rewardEventType = String(rewardEventTypeFromRequest(req) || "").trim();
  const isPaidReward = rewardEventIsPaid(rewardEventType);
  if (isPaidReward === false) {
    res.status(200).json({
      ok: true,
      rewardId,
      ignored: true,
      reason: "reward_event_not_paid"
    });
    return;
  }

  if (rewardEventType && isPaidReward == null) {
    res.status(200).json({
      ok: true,
      rewardId,
      ignored: true,
      reason: `unknown_reward_event_type_${rewardEventType}`
    });
    return;
  }

  const db = getFirestoreOrError(res);
  if (!db) return;

  try {
    const outcome = await payoutRewardEvent({
      db,
      rewardId,
      nowMs: Date.now(),
      paidBy: "postback"
    });

    res.status(200).json({ ok: true, ...outcome });
  } catch (error) {
    const mapped = mapRewardError(error, "postback_failed");
    res.status(mapped.status).json({ ok: false, error: mapped.code });
  }
}
