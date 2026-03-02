import {
  LIMIT_MAX,
  normalizeLimiter,
  periodKeyFromStart,
  pickWeightedReward,
  quotaFromLimiter,
  secureTextEqual,
  toMillis
} from "../../../../lib/tg-rewards";
import { getFirestoreOrError } from "../../../../lib/tg-api";
import { pickHeader, setCors } from "../../../../lib/http";

class ApiError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return;

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const expectedSecret = String(process.env.POSTBACK_SECRET || "").trim();
  if (!expectedSecret) {
    res.status(501).json({ ok: false, error: "missing_postback_secret" });
    return;
  }

  const providedSecret = pickHeader(req.headers["x-postback-secret"]);
  if (!secureTextEqual(expectedSecret, providedSecret)) {
    res.status(401).json({ ok: false, error: "invalid_postback_secret" });
    return;
  }

  const rewardId = String((req.body && req.body.rewardId) || "").trim();
  if (!rewardId) {
    res.status(400).json({ ok: false, error: "missing_reward_id" });
    return;
  }

  const db = getFirestoreOrError(res);
  if (!db) return;

  const now = Date.now();
  const eventRef = db.collection("reward_events").doc(rewardId);

  try {
    const outcome = await db.runTransaction(async (tx) => {
      const eventSnap = await tx.get(eventRef);
      if (!eventSnap.exists) throw new ApiError("reward_not_found", 404);

      const eventData = eventSnap.data() || {};
      const status = String(eventData.status || "").trim();

      if (status === "paid") {
        return {
          rewardId,
          status: "paid",
          alreadyPaid: true,
          rewardType: String(eventData.rewardType || "").trim() || null,
          amount: eventData.amount == null ? null : Number(eventData.amount),
          paidAt: toMillis(eventData.paidAt)
        };
      }

      if (status === "expired") {
        return {
          rewardId,
          status: "expired",
          alreadyExpired: true,
          reason: String(eventData.expiredReason || "").trim() || "expired"
        };
      }

      const expiresAt = toMillis(eventData.expiresAt);
      if (expiresAt > 0 && now > expiresAt) {
        tx.set(
          eventRef,
          {
            status: "expired",
            expiredAt: now,
            expiredReason: "timeout"
          },
          { merge: true }
        );

        return {
          rewardId,
          status: "expired",
          reason: "timeout"
        };
      }

      const uid = String(eventData.uid || "").trim();
      if (!uid) throw new ApiError("invalid_reward_payload", 400);

      const userRef = db.collection("users").doc(uid);
      const userSnap = await tx.get(userRef);
      const userData = userSnap.exists ? userSnap.data() || {} : {};
      const profile = userData && userData.profile && typeof userData.profile === "object" ? userData.profile : {};

      const limiterState = normalizeLimiter(userData.rewardLimiter || null, now);
      if (limiterState.count >= LIMIT_MAX) {
        const quota = quotaFromLimiter(
          {
            periodStart: limiterState.periodStart,
            count: limiterState.count
          },
          now
        );

        tx.set(
          eventRef,
          {
            status: "expired",
            expiredAt: now,
            expiredReason: "rate_limited",
            periodKey: periodKeyFromStart(limiterState.periodStart)
          },
          { merge: true }
        );

        return {
          rewardId,
          status: "expired",
          reason: "rate_limited",
          quota
        };
      }

      const reward = pickWeightedReward();
      const currentCrystals = Math.max(0, Math.floor(Number(profile.crystals || 0)));
      const currentCredits = Math.max(0, Math.floor(Number(profile.credits || 0)));
      const nextProfile = {
        ...profile,
        crystals: reward.rewardType === "crystals" ? currentCrystals + reward.amount : currentCrystals,
        credits: reward.rewardType === "credits" ? currentCredits + reward.amount : currentCredits,
        updatedAt: now
      };

      const nextLimiterCount = limiterState.count + 1;
      tx.set(
        userRef,
        {
          profile: nextProfile,
          rewardLimiter: {
            periodStart: limiterState.periodStart,
            count: nextLimiterCount
          }
        },
        { merge: true }
      );

      tx.set(
        eventRef,
        {
          status: "paid",
          paidAt: now,
          rewardType: reward.rewardType,
          amount: reward.amount,
          periodKey: periodKeyFromStart(limiterState.periodStart),
          expiredReason: null
        },
        { merge: true }
      );

      const quota = quotaFromLimiter(
        {
          periodStart: limiterState.periodStart,
          count: nextLimiterCount
        },
        now
      );

      return {
        rewardId,
        status: "paid",
        alreadyPaid: false,
        rewardType: reward.rewardType,
        amount: reward.amount,
        paidAt: now,
        quota
      };
    });

    res.status(200).json({ ok: true, ...outcome });
  } catch (error) {
    const status = Number(error && error.status ? error.status : 500);
    const code = String(error && error.code ? error.code : "postback_failed");
    res.status(status).json({ ok: false, error: code });
  }
}
