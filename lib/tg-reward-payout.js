import {
  LIMIT_MAX,
  normalizeLimiter,
  periodKeyFromStart,
  pickWeightedReward,
  quotaFromLimiter,
  toMillis
} from "./tg-rewards";

class RewardApiError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export async function payoutRewardEvent({
  db,
  rewardId,
  nowMs = Date.now(),
  expectedTelegramId = "",
  paidBy = "postback",
  minEventAgeMs = 0
}) {
  const now = Math.floor(Number(nowMs || Date.now()));
  const safeRewardId = String(rewardId || "").trim();
  const safeTelegramId = String(expectedTelegramId || "").trim();
  const safePaidBy = String(paidBy || "postback").trim() || "postback";
  const eventRef = db.collection("reward_events").doc(safeRewardId);

  return db.runTransaction(async (tx) => {
    const eventSnap = await tx.get(eventRef);
    if (!eventSnap.exists) throw new RewardApiError("reward_not_found", 404);

    const eventData = eventSnap.data() || {};
    const status = String(eventData.status || "").trim();
    const eventTelegramId = String(eventData.telegramId || "").trim();
    if (safeTelegramId && safeTelegramId !== eventTelegramId) {
      throw new RewardApiError("reward_not_found", 404);
    }

    if (status === "paid") {
      return {
        rewardId: safeRewardId,
        status: "paid",
        alreadyPaid: true,
        rewardType: String(eventData.rewardType || "").trim() || null,
        amount: eventData.amount == null ? null : Number(eventData.amount),
        paidAt: toMillis(eventData.paidAt),
        balances: {
          credits: Math.max(0, Math.floor(Number(eventData.balances && eventData.balances.credits ? eventData.balances.credits : 0))),
          crystals: Math.max(0, Math.floor(Number(eventData.balances && eventData.balances.crystals ? eventData.balances.crystals : 0)))
        }
      };
    }

    if (status === "expired") {
      return {
        rewardId: safeRewardId,
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
        rewardId: safeRewardId,
        status: "expired",
        reason: "timeout"
      };
    }

    const createdAt = toMillis(eventData.createdAt);
    const requiredAge = Math.max(0, Math.floor(Number(minEventAgeMs || 0)));
    if (requiredAge > 0 && createdAt > 0 && now - createdAt < requiredAge) {
      throw new RewardApiError("ad_not_finished", 409);
    }

    const uid = String(eventData.uid || "").trim();
    if (!uid) throw new RewardApiError("invalid_reward_payload", 400);

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
        rewardId: safeRewardId,
        status: "expired",
        reason: "rate_limited",
        quota
      };
    }

    const reward = pickWeightedReward();
    const currentCrystals = Math.max(0, Math.floor(Number(profile.crystals || 0)));
    const currentCredits = Math.max(0, Math.floor(Number(profile.credits || 0)));
    const nextCrystals = reward.rewardType === "crystals" ? currentCrystals + reward.amount : currentCrystals;
    const nextCredits = reward.rewardType === "credits" ? currentCredits + reward.amount : currentCredits;
    const nextProfile = {
      ...profile,
      crystals: nextCrystals,
      credits: nextCredits,
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
        expiredReason: null,
        paidBy: safePaidBy,
        balances: {
          credits: nextCredits,
          crystals: nextCrystals
        }
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
      rewardId: safeRewardId,
      status: "paid",
      alreadyPaid: false,
      rewardType: reward.rewardType,
      amount: reward.amount,
      paidAt: now,
      quota,
      balances: {
        credits: nextCredits,
        crystals: nextCrystals
      }
    };
  });
}

export function mapRewardError(error, fallbackCode = "reward_payout_failed") {
  return {
    status: Number(error && error.status ? error.status : 500),
    code: String(error && error.code ? error.code : fallbackCode)
  };
}
