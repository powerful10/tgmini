import crypto from "node:crypto";

import { requireFirebaseAuth } from "../../../lib/firebase-admin";
import { setCors } from "../../../lib/http";
import { getFirestoreOrError } from "../../../lib/tg-api";

const CODE_MIN = 6;
const CODE_MAX = 8;
const EXPIRES_MS = 5 * 60 * 1000;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ATTEMPTS = 16;

function randomCode() {
  const size = CODE_MIN + crypto.randomInt(CODE_MAX - CODE_MIN + 1);
  let out = "";
  for (let i = 0; i < size; i += 1) {
    out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return out;
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return;

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const auth = await requireFirebaseAuth(req, res);
  if (!auth) return;

  const db = getFirestoreOrError(res);
  if (!db) return;

  const now = Date.now();
  const expiresAt = now + EXPIRES_MS;

  for (let i = 0; i < ATTEMPTS; i += 1) {
    const code = randomCode();
    const codeRef = db.collection("link_codes").doc(code);

    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(codeRef);
        if (snap.exists) throw new Error("collision");
        tx.set(codeRef, {
          uid: auth.uid,
          createdAt: now,
          expiresAt
        });
      });

      res.status(200).json({ ok: true, code, expiresAt });
      return;
    } catch (error) {
      if (String(error && error.message ? error.message : "") === "collision") continue;
      res.status(500).json({ ok: false, error: "link_code_create_failed" });
      return;
    }
  }

  res.status(503).json({ ok: false, error: "code_generation_busy" });
}
