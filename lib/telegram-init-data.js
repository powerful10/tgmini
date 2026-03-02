import crypto from "node:crypto";

const MAX_AGE_SEC_DEFAULT = 24 * 60 * 60;
const MAX_CLOCK_SKEW_SEC = 5 * 60;

function normalizeUser(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const id = String(parsed && parsed.id != null ? parsed.id : "").trim();
    if (!/^\d+$/.test(id)) return null;
    return {
      id,
      username: String(parsed.username || "").trim(),
      firstName: String(parsed.first_name || "").trim(),
      lastName: String(parsed.last_name || "").trim(),
      languageCode: String(parsed.language_code || "").trim(),
      isPremium: Boolean(parsed.is_premium),
      allowsWriteToPm: Boolean(parsed.allows_write_to_pm),
      photoUrl: String(parsed.photo_url || "").trim(),
    };
  } catch {
    return null;
  }
}

function buildCheckString(params) {
  const rows = [];
  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    rows.push(`${key}=${value}`);
  }
  rows.sort((a, b) => a.localeCompare(b));
  return rows.join("\n");
}

function timingSafeHexEqual(left, right) {
  const a = String(left || "").trim().toLowerCase();
  const b = String(right || "").trim().toLowerCase();
  if (!a || !b || a.length !== b.length) return false;

  try {
    const aBuffer = Buffer.from(a, "hex");
    const bBuffer = Buffer.from(b, "hex");
    if (!aBuffer.length || aBuffer.length !== bBuffer.length) return false;
    return crypto.timingSafeEqual(aBuffer, bBuffer);
  } catch {
    return false;
  }
}

export function validateTelegramInitData({ initData, botToken, maxAgeSec = MAX_AGE_SEC_DEFAULT, nowMs = Date.now() }) {
  const token = String(botToken || "").trim();
  const data = String(initData || "").trim();
  if (!token) return { ok: false, error: "missing_bot_token" };
  if (!data) return { ok: false, error: "missing_init_data" };

  const params = new URLSearchParams(data);
  const receivedHash = String(params.get("hash") || "").trim();
  if (!receivedHash) return { ok: false, error: "missing_hash" };

  const authDate = Math.floor(Number(params.get("auth_date") || 0));
  if (!Number.isFinite(authDate) || authDate <= 0) {
    return { ok: false, error: "invalid_auth_date" };
  }

  const nowSec = Math.floor(Number(nowMs) / 1000);
  if (authDate > nowSec + MAX_CLOCK_SKEW_SEC) {
    return { ok: false, error: "auth_date_in_future" };
  }
  if (nowSec - authDate > Math.max(60, Math.floor(Number(maxAgeSec || MAX_AGE_SEC_DEFAULT)))) {
    return { ok: false, error: "auth_date_too_old" };
  }

  const dataCheckString = buildCheckString(params);
  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const computedHash = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  if (!timingSafeHexEqual(computedHash, receivedHash)) {
    return { ok: false, error: "invalid_hash" };
  }

  const user = normalizeUser(params.get("user"));
  if (!user) return { ok: false, error: "invalid_user" };

  return {
    ok: true,
    authDate,
    queryId: String(params.get("query_id") || "").trim(),
    user,
  };
}
