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

function supportUrl() {
  const direct = String(process.env.TG_SUPPORT_URL || "").trim();
  if (direct) return direct;

  const publicBotUrl = String(process.env.NEXT_PUBLIC_TG_BOT_URL || "").trim();
  if (publicBotUrl) return publicBotUrl;

  const username = botUsername();
  if (!username) return "";
  return `https://t.me/${username}?start=support`;
}

function localeFromCode(code) {
  const safe = String(code || "").trim().toLowerCase();
  if (safe.startsWith("uz")) return "uz";
  if (safe.startsWith("ru")) return "ru";
  if (safe.startsWith("tr")) return "tr";
  return "en";
}

function normalizeLocale(value) {
  const safe = String(value || "").trim().toLowerCase();
  if (safe === "uz" || safe === "ru" || safe === "tr" || safe === "en") return safe;
  return "en";
}

function i18n(locale) {
  const dict = {
    en: {
      caption:
        "<b>StellarSiege Reward Center</b>\n"
        + "<i>Link account. Watch ads. Earn in-game rewards.</i>\n\n"
        + "What you can do:\n"
        + "• Securely link your game account\n"
        + "• Watch rewarded ads\n"
        + "• Get random crystals or credits\n"
        + "• Track quota and reward history\n\n"
        + "Choose a language below or open the mini app.",
      open: "Open Reward Center",
      support: "Support",
      channel: "Join Channel",
      langPrompt: "Choose language:",
      langChanged: "Language updated.",
      help:
        "Need help?\n"
        + "Open the mini app, or use Support below.",
      showSupport: "Open Support"
    },
    uz: {
      caption:
        "<b>StellarSiege Reward Center ga xush kelibsiz</b>\n"
        + "<i>Hisobni ulang. Reklama ko'ring. O'yinda mukofot oling.</i>\n\n"
        + "Bu yerda siz:\n"
        + "• O'yin hisobingizni xavfsiz ulaysiz\n"
        + "• Mukofotli reklamalarni ko'rasiz\n"
        + "• Tasodifiy kristall yoki kredit olasiz\n"
        + "• Limit va mukofot tarixini kuzatasiz\n\n"
        + "Quyidan tilni tanlang yoki mini ilovani oching.",
      open: "Reward Center ni ochish",
      support: "Yordam",
      channel: "Kanalga qo'shilish",
      langPrompt: "Tilni tanlang:",
      langChanged: "Til yangilandi.",
      help:
        "Yordam kerakmi?\n"
        + "Mini ilovani oching yoki quyidagi Yordam tugmasidan foydalaning.",
      showSupport: "Yordamni ochish"
    },
    ru: {
      caption:
        "<b>StellarSiege Reward Center</b>\n"
        + "<i>Привяжите аккаунт. Смотрите рекламу. Получайте игровые награды.</i>\n\n"
        + "Что можно делать:\n"
        + "• Безопасно привязать игровой аккаунт\n"
        + "• Смотреть рекламные задания\n"
        + "• Получать случайные кристаллы или кредиты\n"
        + "• Следить за лимитом и историей наград\n\n"
        + "Выберите язык ниже или откройте мини-приложение.",
      open: "Открыть Reward Center",
      support: "Поддержка",
      channel: "Канал",
      langPrompt: "Выберите язык:",
      langChanged: "Язык обновлен.",
      help:
        "Нужна помощь?\n"
        + "Откройте мини-приложение или используйте кнопку Поддержка ниже.",
      showSupport: "Открыть поддержку"
    },
    tr: {
      caption:
        "<b>StellarSiege Reward Center</b>\n"
        + "<i>Hesabini bagla. Reklamalari izle. Oyun ici odul kazan.</i>\n\n"
        + "Burada sunlari yapabilirsin:\n"
        + "• Oyun hesabini guvenli sekilde baglamak\n"
        + "• Odullu reklamlari izlemek\n"
        + "• Rastgele kristal veya kredi kazanmak\n"
        + "• Kota ve odul gecmisini takip etmek\n\n"
        + "Asagidan dil sec veya mini uygulamayi ac.",
      open: "Reward Center Ac",
      support: "Destek",
      channel: "Kanala Katil",
      langPrompt: "Dil secin:",
      langChanged: "Dil guncellendi.",
      help:
        "Yardima mi ihtiyacin var?\n"
        + "Mini uygulamayi ac veya asagidaki Destek dugmesini kullan.",
      showSupport: "Destegi Ac"
    }
  };

  return dict[normalizeLocale(locale)] || dict.en;
}

function looksLikeStartCommand(text) {
  return /^\/start(?:@\w+)?(?:\s+.*)?$/i.test(String(text || "").trim());
}

function looksLikeHelpCommand(text) {
  return /^\/help(?:@\w+)?(?:\s+.*)?$/i.test(String(text || "").trim());
}

function looksLikeLangCommand(text) {
  return /^\/lang(?:@\w+)?(?:\s+.*)?$/i.test(String(text || "").trim());
}

function startPayload(text) {
  const match = String(text || "").trim().match(/^\/start(?:@\w+)?(?:\s+(.+))?$/i);
  if (!match || !match[1]) return "";
  return String(match[1]).trim().toLowerCase();
}

function languageKeyboardRow() {
  return [
    { text: "🇺🇿 O'zbek", callback_data: "lang:uz" },
    { text: "🇬🇧 English", callback_data: "lang:en" },
    { text: "🇷🇺 Русский", callback_data: "lang:ru" },
    { text: "🇹🇷 Türkçe", callback_data: "lang:tr" }
  ];
}

function buttons(localePack) {
  const rows = [
    [
      {
        text: localePack.open,
        web_app: { url: miniAppUrl() }
      }
    ],
    languageKeyboardRow()
  ];

  const channel = optionalChannelUrl();
  if (channel) {
    rows.push([{ text: localePack.channel, url: channel }]);
  }

  const support = supportUrl();
  if (support) {
    rows.push([{ text: localePack.support, url: support }]);
  }

  return { inline_keyboard: rows };
}

function supportButtons(localePack) {
  const rows = [];
  const support = supportUrl();
  if (support) {
    rows.push([{ text: localePack.showSupport, url: support }]);
  }

  rows.push([
    {
      text: localePack.open,
      web_app: { url: miniAppUrl() }
    }
  ]);
  rows.push(languageKeyboardRow());

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
    const description = body && body.description ? String(body.description) : "unknown";
    throw new Error(`telegram_api_${method}_failed:${description}`);
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

async function sendLanguagePrompt(chatId, locale) {
  const localePack = i18n(locale);
  await tgApi("sendMessage", {
    chat_id: chatId,
    text: localePack.langPrompt,
    reply_markup: { inline_keyboard: [languageKeyboardRow()] }
  });
}

async function sendSupport(chatId, locale) {
  const localePack = i18n(locale);
  await tgApi("sendMessage", {
    chat_id: chatId,
    text: localePack.help,
    reply_markup: supportButtons(localePack)
  });
}

function webhookFallbackMessage(chatId, locale) {
  const localePack = i18n(locale);
  return {
    method: "sendMessage",
    chat_id: chatId,
    text: localePack.caption,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: buttons(localePack)
  };
}

async function answerCallback(callbackQueryId, text) {
  if (!callbackQueryId) return;
  try {
    await tgApi("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text: String(text || "").trim(),
      show_alert: false
    });
  } catch {
    // Ignore callback answer errors.
  }
}

async function applyLanguageToMessage(callbackQuery, locale) {
  const message = callbackQuery && callbackQuery.message ? callbackQuery.message : null;
  const chatId = message && message.chat ? message.chat.id : null;
  const messageId = message && message.message_id ? message.message_id : null;
  if (!chatId || !messageId) return;

  const localePack = i18n(locale);
  const replyMarkup = buttons(localePack);

  const isCaptionMessage = Boolean(
    message && (
      typeof message.caption === "string"
      || message.animation
      || message.photo
      || message.video
      || message.document
    )
  );

  try {
    if (isCaptionMessage) {
      await tgApi("editMessageCaption", {
        chat_id: chatId,
        message_id: messageId,
        caption: localePack.caption,
        parse_mode: "HTML",
        reply_markup: replyMarkup
      });
    } else {
      await tgApi("editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text: localePack.caption,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: replyMarkup
      });
    }
  } catch (error) {
    const messageText = String(error && error.message ? error.message : "");
    if (!/message is not modified/i.test(messageText)) {
      await tgApi("sendMessage", {
        chat_id: chatId,
        text: localePack.caption,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: replyMarkup
      });
    }
  }
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
  const callbackQuery = update.callback_query && typeof update.callback_query === "object"
    ? update.callback_query
    : null;

  if (callbackQuery) {
    const data = String(callbackQuery.data || "").trim();
    const locale = normalizeLocale(data.replace(/^lang:/i, ""));
    if (/^lang:(en|uz|ru|tr)$/i.test(data)) {
      await answerCallback(callbackQuery.id, i18n(locale).langChanged);
      await applyLanguageToMessage(callbackQuery, locale);
      res.status(200).json({ ok: true, handled: true, type: "callback_query" });
      return;
    }

    res.status(200).json({ ok: true, ignored: true, reason: "unsupported_callback_query" });
    return;
  }

  const message = update.message && typeof update.message === "object" ? update.message : null;
  if (!message) {
    res.status(200).json({ ok: true, ignored: true, reason: "no_message" });
    return;
  }

  const text = String(message.text || "").trim();
  const chatId = message.chat && message.chat.id ? message.chat.id : null;
  if (!chatId) {
    res.status(200).json({ ok: true, ignored: true, reason: "missing_chat_id" });
    return;
  }

  const userLang = localeFromCode(message.from && message.from.language_code);

  try {
    if (looksLikeLangCommand(text)) {
      await sendLanguagePrompt(chatId, userLang);
      res.status(200).json({ ok: true, handled: true, type: "lang" });
      return;
    }

    if (looksLikeStartCommand(text)) {
      const payload = startPayload(text);
      if (payload === "support") {
        await sendSupport(chatId, userLang);
      } else {
        await sendWelcome(chatId, userLang);
      }
      res.status(200).json({ ok: true, handled: true, type: "start" });
      return;
    }

    if (looksLikeHelpCommand(text)) {
      await sendSupport(chatId, userLang);
      res.status(200).json({ ok: true, handled: true, type: "help" });
      return;
    }

    res.status(200).json({ ok: true, ignored: true, reason: "unsupported_message" });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/tg/bot/webhook] failed", {
      message: String(error && error.message ? error.message : "unknown")
    });
    res.status(200).json(webhookFallbackMessage(chatId, userLang));
  }
}
