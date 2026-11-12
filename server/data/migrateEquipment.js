// server/data/migrateEquipment.js (run from server/)
// Dry run (all players, no writes):   node --env-file=.env data/migrateEquipment.js
// Migrate one player:                 node --env-file=.env data/migrateEquipment.js <uid> --write
import { db } from '../firebase.js';
import { encodeEquipment, decodeEquipment } from '../equipmentCodec.js';

const [uid, flag] = process.argv.slice(2);
const write = flag === '--write';

const bytes = (arr) =>
  arr.reduce((s, x) => s + (typeof x === 'string' ? Buffer.byteLength(x) + 1 : Buffer.byteLength(JSON.stringify(x))), 0);

async function check(doc) {
  const eq = doc.data().equipment;
  if (!Array.isArray(eq) || eq.length === 0) return;

  const packed = encodeEquipment(eq);
  const leftovers = packed.filter((x) => typeof x !== 'string').length;

  // Round-trip sanity check: everything except float precision must survive
  const back = decodeEquipment(packed);
  const decodedOld = decodeEquipment(eq);
  const mismatch = decodedOld.findIndex((p, i) => {
    const q = back[i];
    return p.id !== q.id || p.itemKey !== q.itemKey || p.tier !== q.tier ||
      p.obtainedFrom !== q.obtainedFrom || p.obtainedDate !== q.obtainedDate ||
      Math.abs(p.float - q.float) > 1e-6 || !!p.equipped !== !!q.equipped || !!p.starred !== !!q.starred;
  });

  console.log(
    `${doc.id}  pieces=${eq.length}  ${(bytes(eq) / 1024).toFixed(1)}KB -> ${(bytes(packed) / 1024).toFixed(1)}KB` +
    (leftovers ? `  (${leftovers} left unpacked)` : '') +
    (mismatch >= 0 ? `  !! MISMATCH at index ${mismatch}` : '')
  );

  if (write) {
    if (mismatch >= 0) return console.log('  skipped write because of mismatch');
    await db.collection('players').doc(doc.id).update({ equipment: packed });
    console.log('  written');
  }
}

if (uid) {
  await check(await db.collection('players').doc(uid).get());
} else {
  if (write) throw new Error('Pass a uid to --write');
  const snap = await db.collection('players').get();
  for (const doc of snap.docs) await check(doc);
}
