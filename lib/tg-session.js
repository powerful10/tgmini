import crypto from "node:crypto";

const COOKIE_NAME = "tg_session";
const SESSION_TTL_SEC = 7 * 24 * 60 * 60;

function getSecret() {
  const secret = String(process.env.TG_SESSION_SECRET || "").trim();
  if (!secret) throw new Error("missing_tg_session_secret");
  return secret;
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeJson(value) {
  const text = Buffer.from(String(value || ""), "base64url").toString("utf8");
  return JSON.parse(text);
}

function sign(input) {
  return crypto.createHmac("sha256", getSecret()).update(String(input || "")).digest("base64url");
}

function parseCookies(header) {
  const source = String(header || "");
  const out = {};
  if (!source) return out;
  const parts = source.split(";");
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

function isProd() {
  return String(process.env.NODE_ENV || "").trim() === "production";
}

function appendSetCookie(res, value) {
  const prev = res.getHeader("Set-Cookie");
  if (!prev) {
    res.setHeader("Set-Cookie", value);
    return;
  }
  if (Array.isArray(prev)) {
    res.setHeader("Set-Cookie", [...prev, value]);
    return;
  }
  res.setHeader("Set-Cookie", [String(prev), value]);
}

export function issueTgSession(payload, ttlSec = SESSION_TTL_SEC) {
  const nowSec = Math.floor(Date.now() / 1000);
  const safeTtl = Math.max(60, Math.floor(Number(ttlSec || SESSION_TTL_SEC)));

  const header = encodeJson({ alg: "HS256", typ: "JWT" });
  const body = encodeJson({
    telegramId: String(payload.telegramId || "").trim(),
    username: String(payload.username || "").trim(),
    firstName: String(payload.firstName || "").trim(),
    lastName: String(payload.lastName || "").trim(),
    iat: nowSec,
    exp: nowSec + safeTtl
  });

  const input = `${header}.${body}`;
  return `${input}.${sign(input)}`;
}

export function verifyTgSession(token) {
  const raw = String(token || "").trim();
  if (!raw) return { ok: false, error: "missing_token" };

  const parts = raw.split(".");
  if (parts.length !== 3) return { ok: false, error: "invalid_token" };

  const [headerPart, payloadPart, sigPart] = parts;
  if (!headerPart || !payloadPart || !sigPart) return { ok: false, error: "invalid_token" };

  const expected = sign(`${headerPart}.${payloadPart}`);
  if (expected.length !== sigPart.length) return { ok: false, error: "invalid_signature" };
  if (!crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(sigPart, "utf8"))) {
    return { ok: false, error: "invalid_signature" };
  }

  let header = null;
  let payload = null;
  try {
    header = decodeJson(headerPart);
    payload = decodeJson(payloadPart);
  } catch {
    return { ok: false, error: "invalid_token_payload" };
  }

  if (!header || header.alg !== "HS256" || header.typ !== "JWT") {
    return { ok: false, error: "invalid_token_header" };
  }

  const exp = Math.floor(Number(payload && payload.exp ? payload.exp : 0));
  const nowSec = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(exp) || exp <= nowSec) {
    return { ok: false, error: "token_expired" };
  }

  const telegramId = String(payload && payload.telegramId ? payload.telegramId : "").trim();
  if (!/^\d+$/.test(telegramId)) return { ok: false, error: "invalid_telegram_id" };

  return {
    ok: true,
    session: {
      telegramId,
      username: String(payload.username || "").trim(),
      firstName: String(payload.firstName || "").trim(),
      lastName: String(payload.lastName || "").trim(),
      iat: Math.floor(Number(payload.iat || 0)),
      exp
    }
  };
}

export function setTgSessionCookie(res, token) {
  const cookie = [
    `${COOKIE_NAME}=${encodeURIComponent(String(token || ""))}`,
    "Path=/",
    `Max-Age=${SESSION_TTL_SEC}`,
    "HttpOnly",
    "SameSite=Lax",
    isProd() ? "Secure" : ""
  ]
    .filter(Boolean)
    .join("; ");

  appendSetCookie(res, cookie);
}

export function clearTgSessionCookie(res) {
  const cookie = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax",
    isProd() ? "Secure" : ""
  ]
    .filter(Boolean)
    .join("; ");

  appendSetCookie(res, cookie);
}

export function getTgSessionFromRequest(req) {
  const cookies = parseCookies(req && req.headers ? req.headers.cookie : "");
  const token = String(cookies[COOKIE_NAME] || "").trim();
  if (!token) return null;

  const checked = verifyTgSession(token);
  if (!checked.ok) return null;
  return checked.session;
}
