import { setCors } from "../../../lib/http";
import { validateTelegramInitData } from "../../../lib/telegram-init-data";
import { issueTgSession, setTgSessionCookie } from "../../../lib/tg-session";

const MAX_INIT_AGE_SEC = 24 * 60 * 60;

export default function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return;

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!botToken) {
    res.status(501).json({ ok: false, error: "missing_telegram_bot_token" });
    return;
  }

  const initData = String((req.body && req.body.initData) || "").trim();
  if (!initData) {
    res.status(400).json({ ok: false, error: "missing_init_data" });
    return;
  }

  const checked = validateTelegramInitData({
    initData,
    botToken,
    maxAgeSec: MAX_INIT_AGE_SEC
  });
  if (!checked.ok) {
    res.status(401).json({ ok: false, error: checked.error || "invalid_init_data" });
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
  } catch {
    res.status(501).json({ ok: false, error: "missing_tg_session_secret" });
    return;
  }

  setTgSessionCookie(res, token);
  res.status(200).json({
    ok: true,
    telegramUser: checked.user,
    authDate: checked.authDate
  });
}
