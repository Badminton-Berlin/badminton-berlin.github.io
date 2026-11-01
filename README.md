# Preussenpark Challenge app — setup guide

A phone-first web app for the Lichtenrade/Lankwitz vs Spandau/Staaken 2v2 badminton
challenge (3 January 2027, Preussenpark, Berlin). Team members open one link, register
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
- **Schedule**: the app tells you the number of matches from the pairs you have — every
  pair plays every pair of the other team (choose 1 or 2 legs). **Generate schedule**
  builds rounds so no pair plays twice in a round and spreads them over your courts.
  Add single extra matches by hand if you like.
- **Scores**: tap a match, enter game scores (best of 3 to 21, cap at 30, by default).
  The winner, team standings and player records update for everyone live. Admins can
  also award a walkover. Optionally allow registered players to enter scores themselves
  (Admin → Event).
- **Rules**: the document icon in the header (and "Rules & how we play" on Home) opens the
  challenge rules — format, tie-breaks, BWF scoring, doubles serving rotation, faults, lets,
  fair play. Admin → Event → "House rules" adds your own text at the top.
- **Stats**: Players → Stats is a badhub-style player table (Sp, S, N, Quote, Satz ±, Ball ±);
  Matches → Grid is the pair-by-pair head-to-head.
- **Money**: admins add expenses (court, shuttles, food…), who paid, and whether it's
  split across everyone or one team. Everyone sees the total, their own share and
  balance, and a "settle up" list of who pays whom.

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
