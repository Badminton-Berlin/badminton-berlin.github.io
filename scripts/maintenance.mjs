// One-off database maintenance: applies the operations listed in the ops/*.json file given as argument.
// Each op: {"col": "players", "id": "...", "update": {...}} or {"col": "...", "id": "...", "delete": true}.
import admin from "firebase-admin";
import { readFileSync } from "node:fs";
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "null");
if (!sa) { console.error("FIREBASE_SERVICE_ACCOUNT secret is missing"); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const files = process.argv.slice(2);
for (const f of files) {
  const ops = JSON.parse(readFileSync(f, "utf8"));
  for (const op of ops) {
    const ref = db.doc(`${op.col}/${op.id}`);
    const snap = await ref.get();
    if (!snap.exists) { console.log("skip (missing)", op.col, op.id); continue; }
    if (op.delete) { await ref.delete(); console.log("deleted", op.col, op.id); continue; }
    await ref.set(op.update, { merge: true }); console.log("updated", op.col, op.id, Object.keys(op.update).join(","));
  }
}
