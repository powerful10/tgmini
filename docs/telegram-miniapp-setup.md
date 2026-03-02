# Telegram Mini App Setup (StellarSiege Reward Center)

## 1) Deploy to Vercel

1. Push this project to GitHub.
2. Import the repo in Vercel.
3. Set Environment Variables (below) in Vercel project settings.
4. Deploy.

Mini app URL:

`https://<your-domain>/tg`

In BotFather:

- Use `/mybots` -> your bot -> `Bot Settings` -> `Menu Button` or `Mini App`.
- Set web app URL to:
  - `https://<your-domain>/tg`

## 2) Required Environment Variables

- `TELEGRAM_BOT_TOKEN`
- `TG_BOT_WEBHOOK_SECRET` (optional but recommended for Telegram webhook validation)
- `TG_BOT_USERNAME` (example: `StellarSiegeRewardSystem_Bot`)
- `TG_MINIAPP_URL` (example: `https://tgminiappss.vercel.app/tg`)
- `TG_WELCOME_GIF_URL` (optional GIF URL for `/start` welcome message)
- `TG_SUPPORT_URL` (optional direct support link for "Support" button)
- `TG_SESSION_SECRET`
- `POSTBACK_SECRET`
- `TG_ENABLE_MOCK_AD` (optional fallback payout mode for local testing)
- `TG_MOCK_AD_SECONDS` (optional, default `15`)
- `NEXT_PUBLIC_TG_CHANNEL_URL` (optional)
- `NEXT_PUBLIC_TG_BOT_URL` (optional)
- `NEXT_PUBLIC_MONETAG_SDK_URL` (default `https://libtl.com/sdk.js`)
- `NEXT_PUBLIC_MONETAG_ZONE_ID` (your Monetag zone id, e.g. `10673518`)
- `NEXT_PUBLIC_MONETAG_SDK_FN` (SDK function, e.g. `show_10673518`)
- `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_SERVICE_ACCOUNT_FILE`

## 3) Local Run

```bash
npm install
npm run dev
```

Open:

- `http://localhost:8787/tg`

For Telegram auth, open through Telegram Mini App launch, not a regular browser tab.

## 4) Security Notes

- Client-side `window.Telegram.WebApp.initDataUnsafe` is not trusted.
- Server validates `initData` signature with Telegram HMAC flow in `POST /api/tg/auth`.
- Session cookie is server-issued (`tg_session`, httpOnly).
- Reward updates happen server-side in `POST /api/tg/rewards/postback`.

## 5) Linking Flow

1. Website user (Google-authenticated) calls `POST /api/linkcodes/create` with Firebase Bearer token.
2. Server returns one-time code (6-8 chars, 5 min TTL).
3. Mini app user enters code on `/tg/link`.
4. `POST /api/tg/link` atomically:
   - writes `telegram_links/{telegramId}`
   - updates `users/{uid}.profile.telegramId`
   - marks `link_codes/{code}` as used.

## 6) Reward Flow

1. Mini app starts reward via `POST /api/tg/rewards/create` (creates `pending` event).
2. `/tg/ad` opens Monetag rewarded interstitial using SDK function and sends the same `rewardId` as `ymid`.
3. Monetag postback calls `/api/tg/rewards/postback` with:
   - secret via `X-Postback-Secret` header, or `token=<POSTBACK_SECRET>` query param
   - reward id via `ymid` (or `rewardId`/`subid`)
4. Server transaction (idempotent):
   - verifies pending event
   - enforces limiter (10 payouts per 90 minutes per `uid`)
   - picks weighted random reward
   - updates `users/{uid}` currency
   - marks event `paid`.
5. Fast fallback: when Monetag SDK returns `reward_event_type=valued`, mini app calls:
   - `POST /api/tg/rewards/frontend-complete` (still server-side payout, idempotent)
6. Mini app polls `GET /api/tg/rewards/status` until `paid` and refreshes balances.

## 7) Monetag Integration Later

Recommended configuration for Rewarded Interstitial:

1. Add SDK in mini app (already done on `/tg/ad`):
   - `https://libtl.com/sdk.js`
   - `data-zone=<zone id>`
   - `data-sdk=show_<zone id>`
2. Call SDK with event id:
   - `show_<zone>({ type: "end", ymid: "<rewardId>" })`
3. Configure Monetag postback URL:
   - `https://<your-domain>/api/tg/rewards/postback?token=<POSTBACK_SECRET>&ymid={ymid}&reward_event_type={reward_event_type}&event_type={event_type}`
4. Keep `POSTBACK_SECRET` private and rotate immediately if leaked.
5. Optional local/testing fallback without ad network postback:
   - use `POST /api/tg/rewards/mock-complete` (requires authenticated mini app session).

## 8) Bot Start Welcome + Mini App Button

Webhook route:

- `POST /api/tg/bot/webhook`

This route handles `/start` and `/help` and sends:

- localized welcome text (UZ/EN/RU/TR by Telegram `language_code`)
- GIF intro (if `TG_WELCOME_GIF_URL` set/reachable)
- inline "Open Reward Center" button (`web_app.url = TG_MINIAPP_URL`)
- language switch buttons (UZ / EN / RU / TR) via callback queries

Set webhook in Telegram API:

```bash
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<your-domain>/api/tg/bot/webhook&secret_token=<TG_BOT_WEBHOOK_SECRET>
```

If you do not use secret token, omit `secret_token` from the URL and leave `TG_BOT_WEBHOOK_SECRET` empty.
