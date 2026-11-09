// One-off push to every registered device. Triggered by .github/workflows/broadcast.yml whenever a file under
// broadcast/*.json is added or changed on main. File format:
//   { "title": "…", "body": "…", "link": "#home" (optional, app-relative), "clubs": ["A","B"] (optional, default all),
//     "includeInactive": false (optional) }
// Each file is sent once: the run writes broadcasts/{fileName} in Firestore and skips files already recorded there.
import admin from "firebase-admin";
import { readFileSync, existsSync } from "node:fs";
import { basename } from "node:path";

const APP_URL = process.env.APP_URL || "https://badminton-berlin.github.io/";
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "null");
if (!sa) { console.error("FIREBASE_SERVICE_ACCOUNT secret is missing"); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const files = process.argv.slice(2).filter(f => existsSync(f));
if (!files.length) { console.log("no broadcast files"); process.exit(0); }
const players = Object.fromEntries((await db.collection("players").get()).docs.map(d => [d.id, d.data()]));
const tokens = (await db.collection("pushTokens").get()).docs.map(d => ({ uid: d.id, ...d.data() })).filter(x => x.token);

for (const f of files) {
  const id = basename(f).replace(/\.json$/, "");
  const doneRef = db.doc("broadcasts/" + id);
  if ((await doneRef.get()).exists) { console.log(id, "already sent – skip"); continue; }
  const msg = JSON.parse(readFileSync(f, "utf8"));
  if (!msg.title || !msg.body) { console.log(id, "needs title and body – skip"); continue; }
  const want = tokens.filter(x => { const p = players[x.uid]; if (!p) return false; if (!msg.includeInactive && p.active === false) return false; if (msg.clubs && !msg.clubs.includes(p.team)) return false; return true; });
  const list = [...new Set(want.map(x => x.token))];
  console.log(id, "→", list.length, "devices");
  let ok = 0, bad = 0;
  for (let i = 0; i < list.length; i += 500) {
    const res = await admin.messaging().sendEachForMulticast({
      tokens: list.slice(i, i + 500),
      notification: { title: msg.title, body: msg.body },
      webpush: { notification: { icon: APP_URL + "icons/icon-192.png", badge: APP_URL + "icons/icon-192.png", tag: "broadcast-" + id, renotify: true }, fcmOptions: { link: APP_URL + (msg.link || "") } }
    });
    ok += res.successCount; bad += res.failureCount;
    res.responses.forEach((r, j) => { if (!r.success) console.log("  fail", list[i + j].slice(0, 12) + "…", r.error?.code); });
  }
  await doneRef.set({ sentAt: Date.now(), title: msg.title, body: msg.body, devices: list.length, ok, failed: bad });
  console.log(id, "sent", ok, "failed", bad);
}
