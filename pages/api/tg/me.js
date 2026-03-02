import { setCors } from "../../../lib/http";
import { getFirestoreOrError, requireTgSession } from "../../../lib/tg-api";
import { quotaFromLimiter, toMillis } from "../../../lib/tg-rewards";

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return;

  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const session = requireTgSession(req, res);
  if (!session) return;

  const db = getFirestoreOrError(res);
  if (!db) return;

  const telegramId = String(session.telegramId || "");
  const linkRef = db.collection("telegram_links").doc(telegramId);
  const linkSnap = await linkRef.get();

  let uid = "";
  let limiter = null;
  let linkedAt = 0;
  let linkedAccount = null;
  if (linkSnap.exists) {
    const linkData = linkSnap.data() || {};
    uid = String(linkData.uid || "").trim();
    linkedAt = toMillis(linkData.linkedAt || linkData.updatedAt || 0);
    if (uid) {
      const userSnap = await db.collection("users").doc(uid).get();
      const userData = userSnap.exists ? userSnap.data() || {} : {};
      limiter = userData && userData.rewardLimiter ? userData.rewardLimiter : null;
      const profile = userData && userData.profile && typeof userData.profile === "object" ? userData.profile : {};
      const displayName = String(profile.name || profile.localBubbleName || "").trim();
      linkedAccount = {
        uid,
        displayName: displayName || null,
        telegramId: String(profile.telegramId || "").trim() || null,
        telegramUsername: String(profile.telegramUsername || "").trim() || null,
        credits: Math.max(0, Math.floor(Number(profile.credits || 0))),
        crystals: Math.max(0, Math.floor(Number(profile.crystals || 0)))
      };
    }
  }

  res.status(200).json({
    ok: true,
    telegramUser: {
      id: telegramId,
      username: String(session.username || "").trim(),
      firstName: String(session.firstName || "").trim(),
      lastName: String(session.lastName || "").trim()
    },
    linkStatus: {
      linked: Boolean(uid),
      uid: uid || null,
      linkedAt: linkedAt || null,
      lockedToTelegramId: Boolean(uid)
    },
    linkedAccount,
    wallet: linkedAccount
      ? {
          credits: linkedAccount.credits,
          crystals: linkedAccount.crystals
        }
      : null,
    quota: quotaFromLimiter(limiter, Date.now())
  });
}
