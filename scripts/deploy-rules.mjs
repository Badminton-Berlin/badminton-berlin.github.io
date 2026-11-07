// Publishes firestore.rules to the project with the Admin SDK (run by .github/workflows/rules.yml).
import admin from "firebase-admin";
import { readFileSync } from "node:fs";
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "null");
if (!sa) { console.error("FIREBASE_SERVICE_ACCOUNT secret is missing"); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(sa) });
const src = readFileSync("firestore.rules", "utf8");
const rs = await admin.securityRules().releaseFirestoreRulesetFromSource(src);
console.log("published ruleset", rs.name, "created", rs.createTime);
