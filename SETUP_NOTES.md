# GraceGuide — What changed & what you still need to do

## 1. Bible caching + persisted version + book → chapter → reader flow
- Chapters are now cached in `localStorage` the first time they're fetched from api.bible. Reopening the same chapter/version — even after a reload — never calls the API again. This is the main lever for managing your token usage.
- The last Bible version you pick is saved and reloaded automatically (no more resetting to KJV).
- Navigation is now: **Books grid → Chapter grid → Reader**, with breadcrumbs and back buttons. Opening the Bible tab still resumes your last-read chapter directly, so regular reading isn't slowed down.
- Nothing to configure — this works out of the box.

## 2. Multi-verse selection + bookmarks/notes
- Root cause of "can only select one verse": tapping a verse opened a full-screen sheet that blocked further taps. Replaced with a small floating bar that never covers the verse list.
- Root cause of "bookmark/note does nothing": those actions silently required sign-in with no feedback. They now prompt sign-in via the app's existing auth modal.
- Highlighted/bookmarked verses are now visibly marked when you reopen a chapter (previously saved but never rendered).
- Nothing to configure.

## 3. Progressive Web App (installable)
- Added `manifest.json`, `sw.js` (offline app-shell caching), and generated icon set in `img/icons/`.
- "Install App" button now appears at the bottom of the drawer, and disappears automatically once installed or if already running as an installed app.
- On Android/Chrome/Edge: true one-tap install via the native prompt.
- On iOS Safari: there's no API for one-tap install, so the button shows short "Add to Home Screen" instructions instead — that's an iOS platform limitation, not something any web app can work around.
- Nothing to configure, but **PWAs require HTTPS** — this will only install correctly once deployed to `https://graceguide.com.ng`, not over plain HTTP.

## 4. Push notifications (Firebase Cloud Messaging) — ACTION NEEDED
Client side is fully wired up: `firebase-messaging-sw.js`, an "Enable Notifications" button in Settings, token generation/storage, and a foreground toast handler.

**But you must do two things before push notifications will actually work:**

### a. Generate your own VAPID key
The key needed to request push tokens is *not* the same as the device token you shared. Get it from:
**Firebase Console → Project Settings → Cloud Messaging → Web configuration → Web Push certificates → Generate key pair**

Then paste it into `js/config.js`:
```js
const FCM_VAPID_KEY = "REPLACE_WITH_YOUR_VAPID_KEY"; // ← put your real key here
```
Until this is set, tapping "Enable Notifications" will show a clear warning instead of failing silently.

### b. Deploy the Cloud Function (`functions/`) — required for real delivery
A browser can request permission and save its own token, but it **cannot securely send** a push message — that needs the Admin SDK and your project's service-account credentials, which must never live in client code. That's what `functions/index.js` does:
- `sendPushOnNotification` — fires automatically whenever the app writes a notification (connection request/accept, Amen, comment, DM, group/forum message) and delivers it to every device the recipient has enabled notifications on.
- `dailyReadingReminder` — a scheduled job that nudges anyone who hasn't read anything yet today, to protect their streak.

To deploy (**requires the Blaze/pay-as-you-go plan** — scheduled functions and outbound calls aren't available on the free Spark plan; Blaze still has a generous free tier for this kind of usage):
```bash
npm install -g firebase-tools
firebase login
cd graceguide-main
firebase deploy --only functions
```
Until this is deployed, tokens will save correctly but no pushes will actually be delivered — that final delivery step lives entirely in this function, by design (it's the only safe place to hold your credentials).

## One more thing worth knowing
Your Bible API key and DeepSeek API key are visible in `js/config.js`, which ships to every visitor's browser — this was already true before these changes and is a pre-existing characteristic of a client-only site, not something introduced here. If you want those hidden, it would take a small backend/proxy (or Cloud Functions) in front of those calls. Happy to help with that separately if you'd like.
