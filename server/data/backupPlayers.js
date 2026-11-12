// server/data/backupPlayers.js (run from server/)
// Dumps every players doc to a local JSON file (read-only):
//   node --env-file=.env data/backupPlayers.js
import { writeFileSync } from 'fs';
import { db } from '../firebase.js';

const snap = await db.collection('players').get();
const out = {};
for (const doc of snap.docs) out[doc.id] = doc.data();

const file = `players-backup-${process.env.FIREBASE_PROJECT_ID}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
writeFileSync(file, JSON.stringify(out));
console.log(`${snap.size} players -> ${file}`);
