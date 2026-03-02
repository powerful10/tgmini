import fs from "node:fs";
import path from "node:path";

import admin from "firebase-admin";

function loadCredentials() {
  const inlineJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (inlineJson) return JSON.parse(inlineJson);

  const filePath = String(process.env.FIREBASE_SERVICE_ACCOUNT_FILE || "").trim();
  if (!filePath) return null;

  const resolved = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  const raw = fs.readFileSync(resolved, "utf8");
  return JSON.parse(raw);
}

export function initFirebaseAdmin() {
  if (admin.apps && admin.apps.length > 0) return;

  const credentials = loadCredentials();
  if (!credentials) {
    throw new Error(
      "Missing Firebase Admin credentials. Use FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_FILE."
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert(credentials),
  });
}

export function getDb() {
  initFirebaseAdmin();
  return admin.firestore();
}

export async function requireFirebaseAuth(req, res) {
  try {
    initFirebaseAdmin();
  } catch {
    res.status(501).json({ ok: false, error: "firebase_not_configured" });
    return null;
  }

  const auth = String(req.headers.authorization || "");
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ ok: false, error: "missing_bearer_token" });
    return null;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    return decoded;
  } catch {
    res.status(401).json({ ok: false, error: "invalid_bearer_token" });
    return null;
  }
}
