import { setCors } from "../../../lib/http";
import { getFirestoreOrError, requireTgSession } from "../../../lib/tg-api";
import { toMillis } from "../../../lib/tg-rewards";

class ApiError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
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

  const code = normalizeCode(req.body && req.body.code);
  if (!/^[A-Z0-9]{6,8}$/.test(code)) {
    res.status(400).json({ ok: false, error: "invalid_code_format" });
    return;
  }

  const db = getFirestoreOrError(res);
  if (!db) return;

  const now = Date.now();
  const telegramId = String(session.telegramId || "").trim();
  const telegramUsername = String(session.username || "").trim();

  const codeRef = db.collection("link_codes").doc(code);
  const tgLinkRef = db.collection("telegram_links").doc(telegramId);

  try {
    const result = await db.runTransaction(async (tx) => {
      const codeSnap = await tx.get(codeRef);
      if (!codeSnap.exists) throw new ApiError("code_not_found", 404);

      const codeData = codeSnap.data() || {};
      const uid = String(codeData.uid || "").trim();
      if (!uid) throw new ApiError("invalid_code_payload", 400);

      const expiresAt = toMillis(codeData.expiresAt);
      if (!expiresAt || expiresAt <= now) throw new ApiError("code_expired", 410);

      const usedAt = toMillis(codeData.usedAt);
      const usedByTelegramId = String(codeData.usedByTelegramId || "").trim();
      if (usedAt > 0 && usedByTelegramId !== telegramId) {
        throw new ApiError("code_used", 409);
      }

      const userRef = db.collection("users").doc(uid);
      const tgLinkSnap = await tx.get(tgLinkRef);
      const userSnap = await tx.get(userRef);

      if (tgLinkSnap.exists) {
        const tgLinkData = tgLinkSnap.data() || {};
        const currentUid = String(tgLinkData.uid || "").trim();
        if (currentUid && currentUid !== uid) {
          throw new ApiError("telegram_already_linked", 409);
        }
      }

      const userData = userSnap.exists ? userSnap.data() || {} : {};
      const profile = userData && userData.profile && typeof userData.profile === "object" ? userData.profile : {};
      const profileTelegramId = String(profile.telegramId || "").trim();
      if (profileTelegramId && profileTelegramId !== telegramId) {
        throw new ApiError("uid_linked_to_other_telegram", 409);
      }

      const displayName = String(profile.name || profile.localBubbleName || "").trim();
      const currentCredits = Math.max(0, Math.floor(Number(profile.credits || 0)));
      const currentCrystals = Math.max(0, Math.floor(Number(profile.crystals || 0)));
      const resolvedLinkedAt = tgLinkSnap.exists ? toMillis((tgLinkSnap.data() || {}).linkedAt) || now : now;

      tx.set(
        tgLinkRef,
        {
          uid,
          telegramUsername,
          linkedAt: resolvedLinkedAt,
          updatedAt: now
        },
        { merge: true }
      );

      tx.set(
        userRef,
        {
          profile: {
            ...profile,
            telegramId,
            telegramUsername,
            updatedAt: now
          }
        },
        { merge: true }
      );

      tx.set(
        codeRef,
        {
          usedAt: usedAt || now,
          usedByTelegramId: telegramId
        },
        { merge: true }
      );

      return {
        uid,
        alreadyLinked: Boolean(usedAt && usedByTelegramId === telegramId),
        linkedAt: resolvedLinkedAt,
        linkedAccount: {
          uid,
          displayName: displayName || null,
          telegramId,
          telegramUsername: telegramUsername || null,
          credits: currentCredits,
          crystals: currentCrystals
        }
      };
    });

    res.status(200).json({
      ok: true,
      uid: result.uid,
      alreadyLinked: result.alreadyLinked,
      linkedAt: result.linkedAt,
      linkedAccount: result.linkedAccount
    });
  } catch (error) {
    const status = Number(error && error.status ? error.status : 500);
    const code = String(error && error.code ? error.code : "link_failed");
    res.status(status).json({ ok: false, error: code });
  }
}
