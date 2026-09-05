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

## 8. Notification reliability (items #1, #2, #5 from your last message)
Found a real, systemic bug: several buttons did `closeSheet(); openSomething();` in a single click. `closeSheet()`'s `history.back()` resolves asynchronously, so the very next line's `history.pushState()` (from opening a modal, or navigating) could fire before it — corrupting the browser history stack. This explained:
- Verse-sharing to chat/forum silently doing nothing
- The notification bell sometimes not responding
All 10 occurrences of this pattern are fixed (via new `closeSheetThen()`/`closeModalThen()` helpers). `showNotificationPanel` is also now wrapped in a try/catch so one bad record can't make it fail silently.
Foreground push messages now also raise a real OS notification (not just an in-app toast), so pushes show in the system notification panel even while the app is open — not only when backgrounded. This is on top of the Cloud Function requirement from before (see section 4 above) — foreground behavior doesn't need the function, but backgrounded/closed delivery still does.

## 9. Back button (item #7)
Added a back arrow in the top navbar (before the notification bell), shown on every screen except Home/Shepherd/Space (the 3 bottom-nav tabs). Needed because an installed PWA on iOS/desktop has no browser chrome of its own to go back with.

## 10. Profile restructure (item #3)
- "Your Journey" (chapters/bookmarks/notes) moved from Home to Profile, right before "Recent Activity".
- The stat row under the bio is now Brethren / Posts / Streak. Tapping Brethren lists your accepted connections; tapping Posts lists everything you've posted to Space. Both link straight through to the relevant profile/post.

## 11. Space filter + search (item #6)
Added a search bar and type filter pills (All/Reflections/Notes/Study Plans/Videos) above the Space feed — both apply instantly against posts already loaded, no extra network round trip.

## 12. Weekly Bible Quiz (item #4) — ACTION NEEDED (admin page is next)
The "Today's Verse" home card is now a live countdown to a Weekly Bible Quiz competition, with a full quiz page (prep → attempt → result) and a Home/quiz-page leaderboard (top 5 + "Show More" modal with full ranking).

**This reads from `quizCompetition/current` in the Realtime Database — there's no data there yet**, so right now it will just show "No competition is scheduled yet." Once the admin page exists, it needs to write this shape:
```js
quizCompetition/current: {
  startTime: 1735689600000,      // ms epoch — when the quiz opens (the "D-Day")
  timerMinutes: 25,              // optional, defaults to 25
  concentration: [                // optional prep list shown pre-window
    { character: "Moses", book: "Exodus", reference: "Exodus 1-14" }
  ],
  questions: [                    // required before the window opens
    { question: "Who led Israel out of Egypt?", options: ["Moses","Aaron","Joshua","Caleb"], correctIndex: 0 }
  ]
  // participants/{uid} is written by the app itself on submission — leave this out
}
```
State is computed purely from `now` vs `startTime` (no separate status flag to keep in sync): countdown → active (24h window) → ended (shows leaderboard, until the admin sets a new future `startTime`).

**Known limitation to flag for whoever builds the admin page/rules**: without backend gating, `questions[].correctIndex` is technically visible to any signed-in client that inspects network traffic. Locking this down properly means adding a Firebase Security Rule that only allows reading `quizCompetition/current/questions` once the active window has opened (keyed off `startTime`). Worth doing before this is used for anything with real stakes attached.

Also: when scheduling a new round, the admin page should also clear out the previous round's `participants` (or move them into a separate history path) — otherwise old scores will keep showing on the new round's leaderboard.

Your Bible API key and DeepSeek API key are visible in `js/config.js`, which ships to every visitor's browser — this was already true before these changes and is a pre-existing characteristic of a client-only site, not something introduced here. If you want those hidden, it would take a small backend/proxy (or Cloud Functions) in front of those calls. Happy to help with that separately if you'd like.
