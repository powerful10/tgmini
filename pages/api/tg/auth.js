import { setCors } from "../../../lib/http";
import { validateTelegramInitData } from "../../../lib/telegram-init-data";
import { issueTgSession, setTgSessionCookie } from "../../../lib/tg-session";

const MAX_INIT_AGE_SEC = 24 * 60 * 60;

function isProd() {
  return String(process.env.NODE_ENV || "").trim() === "production";
}

function fail(res, { status, error, stage, details }) {
  const safeDetails = details && typeof details === "object" ? details : { info: String(details || "") };
  const logPayload = {
    stage,
    error,
    details: safeDetails
  };

  // eslint-disable-next-line no-console
  console.error("[api/tg/auth]", logPayload);

  if (isProd()) {
    res.status(status).json({ ok: false, error });
    return;
  }

  res.status(status).json({
    ok: false,
    error,
    stage,
    details: safeDetails
  });
}

export default function handler(req, res) {
  setCors(req, res);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return;

  if (req.method !== "POST") {
    fail(res, {
      status: 405,
      error: "method_not_allowed",
      stage: "method_check",
      details: { method: String(req.method || "") }
    });
    return;
  }

  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!botToken) {
    fail(res, {
      status: 501,
      error: "missing_telegram_bot_token",
      stage: "config_check",
      details: { hasBotToken: false }
    });
    return;
  }

  const initData = String((req.body && req.body.initData) || "").trim();
  if (!initData) {
    fail(res, {
      status: 400,
      error: "missing_init_data",
      stage: "input_check",
      details: {
        hasBody: Boolean(req.body),
        initDataType: typeof (req.body && req.body.initData)
      }
    });
    return;
  }

  const checked = validateTelegramInitData({
    initData,
    botToken,
    maxAgeSec: MAX_INIT_AGE_SEC
  });
  if (!checked.ok) {
    fail(res, {
      status: 401,
      error: checked.error || "invalid_init_data",
      stage: "init_data_validation",
      details: {
        initDataLength: initData.length,
        userAgent: String(req.headers["user-agent"] || "").slice(0, 180)
      }
    });
    return;
  }

  let token = "";
  try {
    token = issueTgSession({
      telegramId: checked.user.id,
      username: checked.user.username,
      firstName: checked.user.firstName,
      lastName: checked.user.lastName
    });
  } catch (error) {
    fail(res, {
      status: 501,
      error: "missing_tg_session_secret",
      stage: "session_issue",
      details: { message: String(error && error.message ? error.message : "unknown") }
    });
    return;
  }

  try {
    setTgSessionCookie(res, token);
  } catch (error) {
    fail(res, {
      status: 500,
      error: "cookie_set_failed",
      stage: "cookie_write",
      details: { message: String(error && error.message ? error.message : "unknown") }
    });
    return;
  }

  res.status(200).json({
    ok: true,
    telegramUser: checked.user,
    authDate: checked.authDate,
    // Fallback for WebViews that block third-party cookies.
    sessionToken: token
  });
}
