// Runs every 20 minutes on GitHub Actions (see .github/workflows/notify.yml):
//  1. new-member alerts: a push to the club's admins (and global admins) when someone has registered since the last run;
//  2. the weekly "who's coming?" reminder, sent once on each club's vote day from 07:00 Berlin time;
//  3. payment requests: a push to the payer when a request is created or re-sent, and to the requester when it is paid.
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
const clubs = Object.fromEntries((await db.collection("clubs").get()).docs.map(d => [d.id, d.data()]));
const teamName = t => clubs[t]?.name || (t === "A" ? (event.teamA || "Team A") : t === "B" ? (event.teamB || "Team B") : t);
const clubIds = Object.keys(clubs).length ? Object.keys(clubs) : ["A", "B"];
const players = Object.fromEntries((await db.collection("players").get()).docs.map(d => [d.id, d.data()]));
const tokens = (await db.collection("pushTokens").get()).docs.map(d => ({ uid: d.id, ...d.data() }));

let sent = 0;
const adminUids = (await db.doc("settings/admins").get()).data()?.uids || [];
const tokenOf = uid => tokens.find(x => x.uid === uid && x.token)?.token;
const isAway = (p, date) => !!(p && p.away && p.away.from && p.away.from <= date && (!p.away.to || p.away.to >= date));

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

// ---- 1b. Payment requests: notify the payer of new (or re-sent) requests, and the requester when it is paid ----
const money = c => (event.currency || "€") + (c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nameOf = uid => { const p = players[uid]; return p ? `${p.first || ""} ${p.last || ""}`.trim() : "Someone"; };
async function pushTo(uid, title, body, tag, link) {
  const tok = tokenOf(uid); if (!tok) { console.log("no device for", nameOf(uid)); return false; }
  try {
    await admin.messaging().send({ token: tok, notification: { title, body }, webpush: { notification: { icon: APP_URL + "icons/icon-192.png", badge: APP_URL + "icons/icon-192.png", tag, renotify: true }, fcmOptions: { link: link || APP_URL } }, data: { url: link || APP_URL } });
    sent++; return true;
  } catch (e) { console.log("push failed", uid, e.code || e.message); if (/not-registered|invalid-argument|invalid-registration/.test(e.code || "")) await db.doc(`pushTokens/${uid}`).delete(); return false; }
}
const pending = (await db.collection("requests").where("notifyPending", "==", true).get()).docs;
for (const d of pending) {
  const r = d.data(); if (r.status !== "open") { await d.ref.set({ notifyPending: false }, { merge: true }); continue; }
  const ok = await pushTo(r.to, `${nameOf(r.from)} asks you for ${money(r.amount)}`, `${r.note ? r.note + " · " : ""}Tap to pay in one tap (PayPal / bank).`, "req-" + d.id, APP_URL + "#money");
  console.log("payment request", nameOf(r.from), "→", nameOf(r.to), money(r.amount), ok ? "sent" : "no device");
  await d.ref.set({ notifyPending: false, notifiedAt: Date.now() }, { merge: true });
}
const paidReqs = (await db.collection("requests").where("paidNotify", "==", true).get()).docs;
for (const d of paidReqs) {
  const r = d.data();
  const ok = await pushTo(r.from, `${nameOf(r.to)} paid ${money(r.amount)}`, `Your request${r.note ? " for " + r.note : ""} is settled.`, "req-" + d.id, APP_URL + "#money");
  console.log("paid notice →", nameOf(r.from), ok ? "sent" : "no device");
  await d.ref.set({ paidNotify: false }, { merge: true });
}

// ---- 2. Weekly session reminder: on each club's vote day, once, any run at or after REMINDER_HOUR Berlin time ----
// (GitHub runs scheduled jobs late or skips some, so "at or after" rather than "exactly at" the hour.)
if (!FORCE && now.getHours() < REMINDER_HOUR) { console.log(`reminder: before the reminder hour (${now.getHours()}:00 Berlin) – done`); console.log("notifications sent:", sent); process.exit(0); }
for (const t of clubIds) {
  const cfg = (await db.doc(`teams/${t}`).get()).data();
  if (!cfg || !cfg.enabled) { console.log(t, "no regular session"); continue; }
  const voteDay = cfg.voteDay ?? 5;
  if (!FORCE && now.getDay() !== voteDay) { console.log(t, `vote day is ${WEEKDAYS[voteDay]}, today is ${WEEKDAYS[now.getDay()]} – skip`); continue; }
  const date = nextSessionDate(cfg), id = `${t}_${date}`, ref = db.doc(`sessions/${id}`);
  let snap = await ref.get();
  if (!snap.exists) {
    const awayIds = Object.entries(players).filter(([, q]) => q.team === t && q.active !== false && isAway(q, date)).map(([qid]) => qid);
    await ref.set({ team:t, date, start:cfg.start||"08:30", end:cfg.end||"09:30", location:cfg.location||"", address:cfg.address||"", note:"", rsvps:Object.fromEntries(awayIds.map(u => [u, "no"])), awayAuto:Object.fromEntries(awayIds.map(u => [u, 1])), attended:null, status:"open", auto:true, createdAt:Date.now(), createdBy:"reminder-job" });
    snap = await ref.get(); console.log(t, "created session", id);
  }
  const s = snap.data();
  if (s.status === "cancelled") { console.log(t, "session cancelled – skip"); continue; }
  if (s.notifiedAt && !FORCE) { console.log(t, "already notified – skip"); continue; }
  // members marked away for the session date get no reminder
  const teamTokens = tokens.filter(x => players[x.uid]?.team === t && x.token && !isAway(players[x.uid], date)).map(x => x.token);
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
