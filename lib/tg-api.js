import { getDb } from "./firebase-admin";
import { getTgSessionFromRequest } from "./tg-session";

export function requireTgSession(req, res) {
  const session = getTgSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return null;
  }
  return session;
}

export function getFirestoreOrError(res) {
  try {
    return getDb();
  } catch {
    res.status(501).json({ ok: false, error: "firebase_not_configured" });
    return null;
  }
}

export function normalizePlacement(value) {
  const raw = String(value || "").trim();
  if (!raw) return "tg_reward_center";
  return raw.slice(0, 80);
}
