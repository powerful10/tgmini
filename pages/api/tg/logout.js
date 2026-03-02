import { setCors } from "../../../lib/http";
import { clearTgSessionCookie } from "../../../lib/tg-session";

export default function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return;

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  clearTgSessionCookie(res);
  res.status(200).json({ ok: true });
}
