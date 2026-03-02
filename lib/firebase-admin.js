import fs from "node:fs";
import path from "node:path";

import admin from "firebase-admin";

function fromInlineJson() {
  const inlineJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (!inlineJson) return null;

  try {
    return JSON.parse(inlineJson);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[firebase-admin] invalid FIREBASE_SERVICE_ACCOUNT_JSON, trying fallback", {
      message: String(error && error.message ? error.message : "unknown"),
    });
    return null;
  }
}

function fromSplitEnv() {
  const projectId = String(process.env.FIREBASE_PROJECT_ID || "").trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || "").trim();
  const privateKeyRaw = String(process.env.FIREBASE_PRIVATE_KEY || "").trim();
  if (!projectId || !clientEmail || !privateKeyRaw) return null;

  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
  return {
    project_id: projectId,
    projectId,
    client_email: clientEmail,
    clientEmail,
    private_key: privateKey,
    privateKey,
  };
}

function fromFile() {
  const filePath = String(process.env.FIREBASE_SERVICE_ACCOUNT_FILE || "").trim();
  if (!filePath) return null;

  const resolved = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  const raw = fs.readFileSync(resolved, "utf8");
  return JSON.parse(raw);
}

function loadCredentials() {
  const byInline = fromInlineJson();
  if (byInline) return byInline;

  const bySplit = fromSplitEnv();
  if (bySplit) return bySplit;

  const byFile = fromFile();
  if (byFile) return byFile;

  return null;
}

export function initFirebaseAdmin() {
  if (admin.apps && admin.apps.length > 0) return;

  const credentials = loadCredentials();
  if (!credentials) {
    throw new Error(
      "Missing Firebase Admin credentials. Use FIREBASE_SERVICE_ACCOUNT_JSON, split FIREBASE_* vars, or FIREBASE_SERVICE_ACCOUNT_FILE."
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
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[firebase-admin] init failed in requireFirebaseAuth", {
      message: String(error && error.message ? error.message : "unknown"),
    });
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
