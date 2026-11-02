// Runs hourly on GitHub Actions (see .github/workflows/notify.yml):
//  1. new-member alerts: a push to the club's admins (and global admins) when someone has registered since the last run;
//  2. the weekly "who's coming?" reminder, sent at 07:00 Berlin time on each club's vote day.
// Needs the FIREBASE_SERVICE_ACCOUNT secret (service-account JSON from Firebase → Project settings → Service accounts).
import admin from "firebase-admin";

const APP_URL = process.env.APP_URL || "https://badminton-berlin.github.io/";
const TZ = "Europe/Berlin";
const FORCE = String(process.env.FORCE || "").toLowerCase() === "true";
const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "null");
if (!sa) { console.error("FIREBASE_SERVICE_ACCOUNT secret is missing"); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// "now" in Berlin, as a Date whose local fields equal Berlin wall-clock time
const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false }).formatToParts(new Date()).map(p => [p.type, p.value]));
const now = new Date(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
function nextSessionDate(cfg){
  const d = new Date(now); d.setHours(0,0,0,0); let add = ((+cfg.weekday||0) - d.getDay() + 7) % 7;
  if (add === 0) { const [h,m] = (cfg.end||"23:59").split(":").map(Number); const endT = new Date(now); endT.setHours(h,m,0,0); if (now > endT) add = 7; }
  d.setDate(d.getDate()+add); return iso(d);
}

const REMINDER_HOUR = +(process.env.REMINDER_HOUR || 7); // Berlin wall-clock hour for the weekly reminder
const event = (await db.doc("settings/event").get()).data() || {};
const teamName = t => t === "A" ? (event.teamA || "Team A") : (event.teamB || "Team B");
const players = Object.fromEntries((await db.collection("players").get()).docs.map(d => [d.id, d.data()]));
const tokens = (await db.collection("pushTokens").get()).docs.map(d => ({ uid: d.id, ...d.data() }));

let sent = 0;
const adminUids = (await db.doc("settings/admins").get()).data()?.uids || [];
const tokenOf = uid => tokens.find(x => x.uid === uid && x.token)?.token;

// ---- 1. New-member alerts ----
const fresh = Object.entries(players).filter(([id, p]) => !p.joinNotified && !p.manual && (p.createdAt || 0) > Date.now() - 14 * 864e5);
for (const [id, p] of fresh) {
  const recipients = new Set([...adminUids, ...Object.entries(players).filter(([, q]) => q.role === "clubAdmin" && q.team === p.team && (q.active !== false)).map(([qid]) => qid)]);
  recipients.delete(id);
  const toks = [...recipients].map(tokenOf).filter(Boolean);
  const name = `${p.first || ""} ${p.last || ""}`.trim();
  if (toks.length) {
    const res = await admin.messaging().sendEachForMulticast({
      tokens: toks,
      notification: { title: `${name} joined ${teamName(p.team)}`, body: p.guest ? "Registered as a guest. Tap to see the profile." : "New member. Tap to review, set invite rights or deactivate." },
      webpush: { notification: { icon: APP_URL + "icons/icon-192.png", badge: APP_URL + "icons/icon-192.png", tag: "join-" + id }, fcmOptions: { link: APP_URL } },
      data: { playerId: id, url: APP_URL }
    });
    console.log("join alert for", name, `→ ${res.successCount}/${toks.length}`); sent += res.successCount;
  } else console.log("join alert for", name, "– no admin device has notifications on");
  await db.doc(`players/${id}`).set({ joinNotified: true }, { merge: true });
}

// ---- 2. Weekly session reminder (only around REMINDER_HOUR Berlin time, unless forced) ----
if (!FORCE && now.getHours() !== REMINDER_HOUR) { console.log(`reminder: not the reminder hour (${now.getHours()}:00 Berlin) – done`); console.log("notifications sent:", sent); process.exit(0); }
for (const t of ["A","B"]) {
  const cfg = (await db.doc(`teams/${t}`).get()).data();
  if (!cfg || !cfg.enabled) { console.log(t, "no regular session"); continue; }
  const voteDay = cfg.voteDay ?? 5;
  if (!FORCE && now.getDay() !== voteDay) { console.log(t, `vote day is ${WEEKDAYS[voteDay]}, today is ${WEEKDAYS[now.getDay()]} – skip`); continue; }
  const date = nextSessionDate(cfg), id = `${t}_${date}`, ref = db.doc(`sessions/${id}`);
  let snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ team:t, date, start:cfg.start||"08:30", end:cfg.end||"09:30", location:cfg.location||"", address:cfg.address||"", note:"", rsvps:{}, attended:null, status:"open", auto:true, createdAt:Date.now(), createdBy:"reminder-job" });
    snap = await ref.get(); console.log(t, "created session", id);
  }
  const s = snap.data();
  if (s.status === "cancelled") { console.log(t, "session cancelled – skip"); continue; }
  if (s.notifiedAt && !FORCE) { console.log(t, "already notified – skip"); continue; }
  const teamTokens = tokens.filter(x => players[x.uid]?.team === t && x.token).map(x => x.token);
  if (!teamTokens.length) { console.log(t, "no devices with notifications on"); continue; }
  const dayName = new Date(date + "T12:00:00").toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"short" });
  const title = `${teamName(t)}: who's playing ${dayName}?`;
  const body = `${s.start}–${s.end} at ${s.location || "the usual place"}. Tap to vote Yes / Maybe / No.`;
  const res = await admin.messaging().sendEachForMulticast({
    tokens: teamTokens,
    notification: { title, body },
    webpush: { notification: { icon: APP_URL + "icons/icon-192.png", badge: APP_URL + "icons/icon-192.png", tag: "session-" + id, renotify: true }, fcmOptions: { link: APP_URL + "#sessions" } },
    data: { sessionId: id, url: APP_URL + "#sessions" }
  });
  console.log(t, `sent to ${res.successCount}/${teamTokens.length} devices`);
  sent += res.successCount;
  // drop dead tokens
  const dead = res.responses.map((r,i)=> (!r.success && /not-registered|invalid-argument|invalid-registration/.test(r.error?.code||"")) ? teamTokens[i] : null).filter(Boolean);
  for (const x of tokens.filter(x => dead.includes(x.token))) { await db.doc(`pushTokens/${x.uid}`).delete(); console.log("removed dead token for", x.uid); }
  await ref.set({ notifiedAt: Date.now() }, { merge: true });
}
console.log("done, notifications sent:", sent);
