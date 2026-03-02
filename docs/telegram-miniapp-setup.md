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
- `TG_SESSION_SECRET`
- `POSTBACK_SECRET`
- `NEXT_PUBLIC_TG_CHANNEL_URL` (optional)
- `NEXT_PUBLIC_TG_BOT_URL` (optional)
- `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_SERVICE_ACCOUNT_FILE`

Optional local dev helper:

- `NEXT_PUBLIC_DEV_POSTBACK_SECRET`
  - In local dev only, set this equal to `POSTBACK_SECRET` so `/tg/ad` can call `/api/tg/rewards/postback`.
  - Do not use this in production.

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
2. Ad network postback calls `POST /api/tg/rewards/postback` with header:
   - `X-Postback-Secret: <POSTBACK_SECRET>`
3. Server transaction:
   - verifies pending event
   - enforces limiter (10 payouts per 90 minutes per `uid`)
   - picks weighted random reward
   - updates `users/{uid}` currency
   - marks event `paid`.

## 7) Monetag Integration Later

When integrating Monetag:

1. Include generated `rewardId` as `subid`/custom macro in the ad request.
2. Configure Monetag postback URL to call:
   - `POST https://<your-domain>/api/tg/rewards/postback`
   - Header `X-Postback-Secret: <POSTBACK_SECRET>`
   - Body `{ "rewardId": "<subid>" }`
3. Keep `POSTBACK_SECRET` private and rotate if leaked.
