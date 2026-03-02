import crypto from "node:crypto";

export const LIMIT_MAX = 10;
export const LIMIT_WINDOW_MS = 90 * 60 * 1000;
export const REWARD_EVENT_TTL_MS = 10 * 60 * 1000;

const TABLE = Object.freeze([
  { rewardType: "crystals", amount: 15, weight: 35 },
  { rewardType: "crystals", amount: 20, weight: 25 },
  { rewardType: "crystals", amount: 25, weight: 20 },
  { rewardType: "crystals", amount: 30, weight: 10 },
  { rewardType: "crystals", amount: 40, weight: 7 },
  { rewardType: "crystals", amount: 50, weight: 3 },
  { rewardType: "credits", amount: 100, weight: 5 }
]);

const TOTAL_WEIGHT = TABLE.reduce((acc, row) => acc + Number(row.weight || 0), 0);

export function toMillis(value) {
  if (value == null) return 0;
  if (Number.isFinite(Number(value))) return Math.floor(Number(value));
  if (value && typeof value.toMillis === "function") {
    const n = Math.floor(Number(value.toMillis()));
    return Number.isFinite(n) ? n : 0;
  }
  if (value && Number.isFinite(Number(value._seconds))) {
    const sec = Number(value._seconds);
    const ns = Number.isFinite(Number(value._nanoseconds)) ? Number(value._nanoseconds) : 0;
    return Math.floor(sec * 1000 + ns / 1e6);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function normalizeLimiter(raw, nowMs = Date.now()) {
  const now = Math.floor(Number(nowMs));
  const count = Math.max(0, Math.floor(Number(raw && raw.count ? raw.count : 0)));
  const periodStartRaw = toMillis(raw && raw.periodStart ? raw.periodStart : 0);

  if (!periodStartRaw || now < periodStartRaw || now - periodStartRaw >= LIMIT_WINDOW_MS) {
    return {
      periodStart: now,
      count: 0,
      resetAt: now + LIMIT_WINDOW_MS,
      rolled: true
    };
  }

  return {
    periodStart: periodStartRaw,
    count,
    resetAt: periodStartRaw + LIMIT_WINDOW_MS,
    rolled: false
  };
}

export function quotaFromLimiter(raw, nowMs = Date.now()) {
  const now = Math.floor(Number(nowMs));
  const state = normalizeLimiter(raw, now);
  const used = Math.min(LIMIT_MAX, Math.max(0, state.count));
  const remaining = Math.max(0, LIMIT_MAX - used);
  const resetInMs = remaining === LIMIT_MAX ? 0 : Math.max(0, state.resetAt - now);

  return {
    limit: LIMIT_MAX,
    used,
    remaining,
    periodStart: state.periodStart,
    periodEndsAt: state.resetAt,
    resetInMs
  };
}

export function periodKeyFromStart(periodStart) {
  const start = Math.max(0, Math.floor(Number(periodStart || 0)));
  return `rl_${Math.floor(start / LIMIT_WINDOW_MS)}`;
}

export function pickWeightedReward() {
  const roll = crypto.randomInt(Math.max(1, TOTAL_WEIGHT));
  let cursor = 0;
  for (const row of TABLE) {
    cursor += Number(row.weight || 0);
    if (roll < cursor) {
      return { rewardType: row.rewardType, amount: Number(row.amount || 0) };
    }
  }
  const fallback = TABLE[TABLE.length - 1];
  return { rewardType: fallback.rewardType, amount: Number(fallback.amount || 0) };
}

export function secureTextEqual(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}
