# Preussenpark Challenge app — setup guide

A phone-first web app for the Lichtenrade/Lankwitz vs Spandau/Staaken 2v2 badminton
challenge (16 January 2027, Preussenpark, Berlin). Team members open one link, register
with name, date of birth and photo, and see pairs, the match schedule, live scores and
expenses. Admins control the event settings, pairs, schedule, scores and money.

It installs on a phone like an app ("Add to Home Screen"), needs no app store, and uses a
free Firebase project as the shared database. Total setup is about 15 minutes.

## What's in this folder

| File | Purpose |
|---|---|
| `index.html` | The whole app (one file). Paste your Firebase config at the top of its `<script>`. |
| `manifest.webmanifest`, `sw.js`, `icons/` | Make it installable and quick to open on phones. |
| `firestore.rules` | Database security rules — who may read and write what. |
| `firebase.json`, `firestore.indexes.json` | Config for deploying with the Firebase CLI (optional). |

Without a Firebase config the app runs in **demo mode** (data stays on that device only) —
useful for trying it out, not for the real event.

> **Status (2 Nov 2026):** done. Firebase project `preussenpark-challenge` (Firestore in eur3,
> Anonymous sign-in, rules published, GitHub Pages domain authorised) and the config is in
> `index.html`. The live app is https://hiteshmalhotra2583.github.io/badminton-challenge/ .
> Steps 1–3 below are only needed again for a new event/project.

## Step 1 — Create the Firebase project (5 min)

1. Go to https://console.firebase.google.com and click **Add project**. Name it e.g.
   `preussenpark-challenge`. Google Analytics can stay off.
2. In the project, open **Build → Authentication → Get started → Sign-in method** and
   enable **Anonymous**. (Players don't need accounts; each phone gets an anonymous ID.)
3. Open **Build → Firestore Database → Create database**. Choose the **eur3 (Europe)**
   location, start in **production mode**.
4. In Firestore, open the **Rules** tab, delete what's there, paste the full contents of
   `firestore.rules`, and click **Publish**.
5. Click the gear → **Project settings**, scroll to **Your apps**, click the web icon
   `</>`, register the app (nickname `challenge`, no hosting needed), and copy the
   `firebaseConfig` object it shows.

## Step 2 — Put the config into the app (1 min)

Open `index.html` in any text editor, find this near the top of the `<script>`:

```js
const FIREBASE_CONFIG = null;
```

and replace it with the object you copied, e.g.

```js
const FIREBASE_CONFIG = {
  apiKey: "AIza…", authDomain: "preussenpark-challenge.firebaseapp.com",
  projectId: "preussenpark-challenge", storageBucket: "preussenpark-challenge.appspot.com",
  messagingSenderId: "1234567890", appId: "1:1234567890:web:abcdef"
};
```

Save the file. (The API key is meant to be public; the security rules are what protect the data.)

## Step 3 — Put it online (5 min) — choose one

**Option A, no command line: Netlify Drop.** Go to https://app.netlify.com/drop, drag the
whole folder onto the page, and you get a URL like `https://something.netlify.app` within
seconds. (Create a free account to keep the site and rename it.)

**Option B: Firebase Hosting.** With Node.js installed:

```bash
npm install -g firebase-tools
firebase login
firebase use --add            # pick the project you created
firebase deploy               # deploys the app AND the Firestore rules
```

You get `https://<project-id>.web.app`.

Either way, afterwards go to Firebase **Authentication → Settings → Authorized domains**
and add your site's domain (e.g. `something.netlify.app`) if it isn't listed.

## Step 4 — Claim admin and share the link (2 min)

1. Open the URL on **your** phone first. The home screen shows a banner
   "No organiser yet" → tap **Claim admin**. The first person to do this becomes admin;
   after that only admins can add more admins (Admin tab → Admins).
2. Tap the profile icon top right and register yourself.
3. Send the link to both teams (WhatsApp works well). Tell them: open the link, tap
   **Register**, add a photo. On iPhone: Share → **Add to Home Screen**. On Android:
   browser menu → **Install app** / **Add to Home screen**.

## Running the event — how the pieces fit

- **Registration**: first name, last name, date of birth, photo, team. Others see the
  age only; admins see the full date. Close registration in Admin → Event when the lists
  are final.
- **Pairs** (Admin tab): tap two team-mates to pair them, or use **Random pairs** /
  **Pair by age** (oldest with youngest). A left-over player shows as unpaired and can
  substitute.
- **Format** (Admin → Event → Schedule format):
  - *Fixed pairs* — you build pairs, every pair plays every opposing pair (1 or 2 legs).
  - *Rotation (Davis Cup style)* — no fixed pairs. You set matches per player (= rounds);
    each round everyone who can play plays once, the app rotates partners and opponents
    so nobody repeats a partner or opponent until it's unavoidable, and players who have
    to sit out (odd team sizes) take turns. The schedule is sized so that every player of a
    team plays exactly the same number of matches (e.g. 6 vs 5 players → blocks of 15
    matches: every LL player 5, every SP player 6).
- **Schedule**: the app tells you the number of matches from the pairs you have — every
  pair plays every pair of the other team (choose 1 or 2 legs). **Generate schedule**
  builds rounds so no pair plays twice in a round and spreads them over your courts.
  Add single extra matches by hand if you like.
- **Scores**: tap a match, enter game scores (best of 3 to 21, cap at 30, by default).
  The winner, team standings and player records update for everyone live. Admins can
  also award a walkover. Optionally allow registered players to enter scores themselves
  (Admin → Event).
- **Club rules**: the document icon in the header opens your own club's rules — regular slot,
  address with map and directions link, and the free-text team rules (Sessions → Regular
  session → Edit → "Team rules"). Members only ever see their own club's rules; admins see both.
- **Maps**: in the team setup and in a session's edit form, type the address and tap
  **Find on map** (OpenStreetMap search); a map with a draggable pin appears and players get
  a "Directions" link (Google Maps) on the session cards and club rules page.
- **Game rules** (how a match is scored/served): the "Game rules" button inside club rules, or (and "Rules & how we play" on Home) opens the
  challenge rules — format, tie-breaks, BWF scoring, doubles serving rotation, faults, lets,
  fair play. Admin → Event → "House rules" adds your own text at the top.
- **Stats**: Players → Stats is a badhub-style player table (Sp, S, N, Quote, Satz ±, Ball ±);
  Matches → Grid is the pair-by-pair head-to-head.
- **Money**: admins add expenses (court, shuttles, food…), who paid, and whether it's
  split across everyone or one team. Everyone sees the total, their own share and
  balance, and a "settle up" list of who pays whom.

## Home

Home is a dashboard: your team's next session with the Yes/Maybe/No vote, the events list,
your upcoming matches (yours first, across all events), your money position (team sessions
and challenge), and your team's regular slot plus its team rules (Sessions → Regular
session → Edit → "Team rules"). Tapping an event opens the event screen: poster, score,
countdown, format, standings.

## Invites

Players → **Invite someone** (admins, and members given the invite right under Players → player →
"May invite other players"). Kinds: club member, guest of the club, guest for one session. A link
(`?invite=CODE`) or the code is shared; the invitee registers with club/session preset. Invites
have an expiry and a use count. With "Open registration" off, registration is invite-only
(enforced by the rules). Guests can't edit the club setup; one-session guests see only that session.

## Roles and inactive members

- **Global admin** — everything. **Club admin** (assigned by a global admin on the player sheet) — adds/invites members
  of their club, sets them inactive/active, gives invite rights, edits the club setup. **Member**, **guest**, **one-session guest**.
- **Inactive** members (set by admins / club admins) lose access to sessions, events and club activity but keep their profile
  and read access to the costs and payments they are part of (own balance). Enforced by the rules; they are excluded from
  pairs, attendance and cost splits. Reactivate from the player sheet; permanent delete is global-admin only.
- Admins/club admins see a **New members** card on Home, and the hourly notification job pushes "X joined <club>".

## History and reports

- **My history** (profile → My history, or Home → Money → My history): sessions played, attendance rate, paid/share/balance,
  monthly charts, every session played with the member's share, all matches across events, CSV export.
- **Club report** (Admin → Open club report; club admins from Home/Sessions): KPIs, players per session, spend per month and
  by category, member table (played, rate, paid, share, balance, last played), sessions list, event results, attendance and
  money CSV exports. Period filter 30/90/365 days or all.
- Pairs, matches and challenge costs are now loaded for every event the reader can see (not only the selected one).

## Money extras

- **Pay links**: players store `paypal` (PayPal.me handle) and `iban`/`ibanName` on their profile. The settle-up "Pay"
  button opens `paypal.me/<handle>/<amount>EUR` or shows the IBAN + an EPC/GiroCode QR (qrcode-generator from cdnjs,
  loaded lazily). "Mark as paid" records a payment.
- **Monthly fee mode** (`teams/{t}.feeMode = "monthly"`, `feeAmount` cents, `feeFrom` "YYYY-MM", `treasurer` uid):
  every non-guest member owes the fee per month from max(feeFrom, join month) until deactivation; payments to the
  treasurer (or to self for the treasurer) go into the pot; costs with an empty `splitAmong` are paid from the pot
  (if `paidBy` is not the treasurer the club owes them). `teamMoneyMonthly()` returns `fee: {pot, outstanding, due…}`.
- **Statements**: `memberStatementHtml` / `clubStatementHtml` open a print view (`openPrintable`), Print → Save as PDF.

## Admin extras

- **Google account linking**: `linkWithPopup` (fallback `linkWithRedirect`) keeps the anonymous uid, so profile and
  admin rights survive. "Restore" on the Home banner = `signInWithPopup` + reload. Google provider is enabled in the
  Firebase console (support email set).
- **Activity log**: collection `audit` `{at, by, byName, action, detail, team, eventId}`, written by `audit()` on
  scores, costs, payments, member/role changes, invites, events, schedules, club setup, seasons, backups. Admins read
  all; club admins read `team == theirs`. Never updated or deleted. Admin → Activity log, CSV export.
- **Backup**: Admin → Download JSON (`store.getAll` for every collection).
- **Seasons**: `seasons/{id}` = frozen snapshot (`seasonSnapshot`), `settings/event.seasonStart` = day after the
  season's end. History/report default to "This season"; members see their past-season rows.
- Build: `python3 build/build.py` writes `index.html` (live config + VAPID) and `build/demo-mobile.html` (demo mode).

## Guides

`docs/player-guide.pdf` and `docs/admin-guide.pdf` (sources: the .html files next to them, rendered
with Chromium). Linked from the app's rules pages.

## Who sees what (club scoping)

Every event has a list of **participating clubs** (set by the admin when creating or editing
it). A registered member only sees events their club takes part in, their own club's sessions,
votes and session costs, and the pairs/schedule/costs of events they are part of. This is
enforced by the Firestore security rules, not just hidden in the app. Admins see everything.
The header shows the app name (Admin → Event → Edit → "App name") and the reader's club.

## Events

Home lists all events. The challenge is one of them; admins create more with **New event**
(Home or Admin → Event → New): name, type (challenge / tournament / social / training camp),
date, venue, courts, match format. Tap an event to select it — pairs, schedule, scores and
challenge-day costs are kept per event. Admin → Event → Edit changes the selected event
(and the global team names / scoring options); Delete removes an event with its schedule.

## Weekly team sessions, votes, reminders and team money

- **Sessions tab**: each team sets its regular slot (day, time, place) under "Regular session".
  The app then creates the next session automatically; members vote **Yes / Maybe / No**
  (also from a card on Home), see who's coming, and afterwards tick **Who played**.
  One-off sessions and cancellations are handled with Edit / Add a one-off session.
- **Reminder notifications**: a GitHub Actions job (`.github/workflows/notify.yml`,
  `scripts/notify.mjs`) runs every morning at 06:00 UTC and, on each team's vote day
  (default Friday), sends a push notification "SP: who's playing Sunday?" to every device
  that enabled notifications (Sessions → Reminders → Enable notifications; iPhone needs the
  app on the Home Screen first). It also creates the session if it doesn't exist yet.
  One-time setup: Firebase → Project settings → Service accounts → **Generate new private
  key**, then GitHub repo → Settings → Secrets and variables → Actions → **New repository
  secret** named `FIREBASE_SERVICE_ACCOUNT` with the JSON file's content. Test it with
  Actions → "Weekly session reminder" → Run workflow → force = true.
- **Team money (Splitwise-style)**: Money → "LL sessions" / "SP sessions". Any team member
  adds a cost (court, shuttles), who paid, and who shares it (defaults to who played that
  session). Balances show who is owed / owes what, "Settle up" suggests the fewest payments,
  and **Record payment** clears a debt when someone pays a team-mate back. Challenge-day
  costs stay under "Challenge" (admins only).

## Changing teams, dates, rules

Admin → Event → Edit: event name, date/time, venue, team names and short codes, number
of courts, legs, best-of and points per game, currency, registration open/closed,
player scoring on/off.

## Notes

- Free Firebase limits (50k reads / 20k writes per day) are far more than a weekend
  event needs.
- Photos are shrunk to a 320px square on the phone before upload, so the database stays
  tiny and no paid storage is needed.
- A player's identity is tied to their phone/browser. If someone clears their browser
  data, an admin can edit or delete the old profile and they register again.
- To reuse the app for a future challenge: Admin → Event (change the date/teams), clear
  the schedule and pairs, and remove old players — or create a new Firebase project.
