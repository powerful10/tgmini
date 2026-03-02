import { getDb } from "./firebase-admin";
import { getTgSessionDebugFromRequest, getTgSessionFromRequest } from "./tg-session";

function isProd() {
  return String(process.env.NODE_ENV || "").trim() === "production";
}

export function requireTgSession(req, res) {
  const session = getTgSessionFromRequest(req);
  if (!session) {
    const payload = { ok: false, error: "unauthorized" };
    if (!isProd()) {
      payload.details = getTgSessionDebugFromRequest(req);
    }
    res.status(401).json(payload);
    return null;
  }
  return session;
}

export function getFirestoreOrError(res) {
  try {
    return getDb();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[firebase-admin] init failed in getFirestoreOrError", {
      message: String(error && error.message ? error.message : "unknown"),
    });
    res.status(501).json({ ok: false, error: "firebase_not_configured" });
    return null;
  }
}

export function normalizePlacement(value) {
  const raw = String(value || "").trim();
  if (!raw) return "tg_reward_center";
  return raw.slice(0, 80);
}
