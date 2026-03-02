function botToken() {
  return String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
}

function webhookSecret() {
  return String(process.env.TG_BOT_WEBHOOK_SECRET || "").trim();
}

function miniAppUrl() {
  return String(process.env.TG_MINIAPP_URL || "https://tgminiappss.vercel.app/tg").trim();
}

function welcomeGifUrl() {
  return String(process.env.TG_WELCOME_GIF_URL || "https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif").trim();
}

function botUsername() {
  return String(process.env.TG_BOT_USERNAME || "StellarSiegeRewardSystem_Bot").trim();
}

function optionalChannelUrl() {
  return String(process.env.NEXT_PUBLIC_TG_CHANNEL_URL || "").trim();
}

function localeFromCode(code) {
  const safe = String(code || "").trim().toLowerCase();
  if (safe.startsWith("uz")) return "uz";
  if (safe.startsWith("ru")) return "ru";
  if (safe.startsWith("tr")) return "tr";
  return "en";
}

function i18n(locale) {
  const dict = {
    en: {
      caption:
        "<b>Welcome to StellarSiege Reward Center</b>\n\n"
        + "Inside this mini app you can:\n"
        + "• Securely link your game account\n"
        + "• Watch rewarded ads\n"
        + "• Get random crystals or credits\n"
        + "• Track your quota and reward history\n\n"
        + "Tap the button below to open the mini app.",
      open: "Open Reward Center",
      support: "Support",
      channel: "Join Channel"
    },
    uz: {
      caption:
        "<b>StellarSiege Reward Center'ga xush kelibsiz</b>\n\n"
        + "Bu mini ilovada siz:\n"
        + "• O'yin hisobingizni xavfsiz bog'laysiz\n"
        + "• Mukofotli reklamalarni ko'rasiz\n"
        + "• Tasodifiy kristall yoki kredit olasiz\n"
        + "• Limit va tarixni kuzatasiz\n\n"
        + "Mini ilovani ochish uchun tugmani bosing.",
      open: "Reward Center'ni ochish",
      support: "Yordam",
      channel: "Kanalga qo'shilish"
    },
    ru: {
      caption:
        "<b>Добро пожаловать в StellarSiege Reward Center</b>\n\n"
        + "В мини-приложении вы можете:\n"
        + "• Безопасно привязать игровой аккаунт\n"
        + "• Смотреть рекламные задания\n"
        + "• Получать случайные кристаллы или кредиты\n"
        + "• Следить за лимитом и историей наград\n\n"
        + "Нажмите кнопку ниже, чтобы открыть мини-приложение.",
      open: "Открыть Reward Center",
      support: "Поддержка",
      channel: "Канал"
    },
    tr: {
      caption:
        "<b>StellarSiege Reward Center'a hos geldin</b>\n\n"
        + "Bu mini uygulamada sunlari yapabilirsin:\n"
        + "• Oyun hesabini guvenli sekilde baglama\n"
        + "• Odullu reklamlari izleme\n"
        + "• Rastgele kristal veya kredi kazanma\n"
        + "• Kota ve odul gecmisini takip etme\n\n"
        + "Mini uygulamayi acmak icin asagidaki butona dokun.",
      open: "Reward Center'i Ac",
      support: "Destek",
      channel: "Kanala Katil"
    }
  };
  return dict[locale] || dict.en;
}

function looksLikeStartCommand(text) {
  return /^\/start(?:@\w+)?(?:\s+.*)?$/i.test(String(text || "").trim());
}

function looksLikeHelpCommand(text) {
  return /^\/help(?:@\w+)?(?:\s+.*)?$/i.test(String(text || "").trim());
}

function buttons(localePack) {
  const rows = [
    [
      {
        text: localePack.open,
        web_app: { url: miniAppUrl() }
      }
    ]
  ];

  const channel = optionalChannelUrl();
  if (channel) {
    rows.push([{ text: localePack.channel, url: channel }]);
  }

  const username = botUsername();
  if (username) {
    rows.push([{ text: localePack.support, url: `https://t.me/${username}` }]);
  }

  return { inline_keyboard: rows };
}

async function tgApi(method, payload) {
  const token = botToken();
  if (!token) {
    throw new Error("missing_telegram_bot_token");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  });

  const bodyText = await response.text();
  let body = null;
  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    body = null;
  }

  if (!response.ok || !body || body.ok !== true) {
    throw new Error(`telegram_api_${method}_failed`);
  }

  return body;
}

async function sendWelcome(chatId, locale) {
  const localePack = i18n(locale);
  const replyMarkup = buttons(localePack);
  const gif = welcomeGifUrl();

  if (gif) {
    try {
      await tgApi("sendAnimation", {
        chat_id: chatId,
        animation: gif,
        caption: localePack.caption,
        parse_mode: "HTML",
        reply_markup: replyMarkup
      });
      return;
    } catch {
      // Fallback to text below.
    }
  }

  await tgApi("sendMessage", {
    chat_id: chatId,
    text: localePack.caption,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: replyMarkup
  });
}

function verifyWebhook(req, res) {
  const expected = webhookSecret();
  if (!expected) return true;

  const provided = String(req.headers["x-telegram-bot-api-secret-token"] || "").trim();
  if (!provided || provided !== expected) {
    res.status(401).json({ ok: false, error: "invalid_webhook_secret" });
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    res.status(200).json({ ok: true, route: "tg_bot_webhook" });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  if (!verifyWebhook(req, res)) return;

  const update = req.body && typeof req.body === "object" ? req.body : {};
  const message = update.message && typeof update.message === "object" ? update.message : null;
  if (!message) {
    res.status(200).json({ ok: true, ignored: true, reason: "no_message" });
    return;
  }

  const text = String(message.text || "").trim();
  const chatId = message.chat && message.chat.id ? message.chat.id : null;
  if (!chatId || (!looksLikeStartCommand(text) && !looksLikeHelpCommand(text))) {
    res.status(200).json({ ok: true, ignored: true, reason: "unsupported_message" });
    return;
  }

  const userLang = localeFromCode(message.from && message.from.language_code);

  try {
    await sendWelcome(chatId, userLang);
    res.status(200).json({ ok: true, handled: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/tg/bot/webhook] failed", {
      message: String(error && error.message ? error.message : "unknown")
    });
    res.status(200).json({ ok: false, handled: true });
  }
}
