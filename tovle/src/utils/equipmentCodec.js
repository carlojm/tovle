// Compact storage format for equipment pieces.
// Mirrored in tovle/src/utils/equipmentCodec.js and server/equipmentCodec.js — keep identical.
//
// Packed piece: "id|itemKey|tier|float36|obtainedFrom|YYMMDD|flags"
//   tier:    "Tier N" is stored as just N; named tiers (Rare, Unique, ...) as-is
//   float36: Math.round(float * 1e6) in base36 (6 decimal places)
//   flags:   1 = equipped, 2 = starred
//
// Anything that doesn't fit the expected shape is left as a plain object,
// so nothing is ever lost. decode() accepts both forms, so old docs keep working.

const KNOWN_KEYS = new Set(['id', 'itemKey', 'tier', 'float', 'obtainedFrom', 'obtainedDate', 'equipped', 'starred']);
export const FLOAT_SCALE = 1e6;

// rounds a float to the precision the packed format keeps, so freshly
// rolled pieces match what a reload from firestore gives back
export const roundFloat = (f) => Math.round(f * FLOAT_SCALE) / FLOAT_SCALE;

const safeStr = (s) => typeof s === 'string' && !s.includes('|');

export function encodePiece(p) {
  if (typeof p === 'string') return p;
  const packable =
    p && typeof p === 'object' &&
    Object.keys(p).every((k) => KNOWN_KEYS.has(k)) &&
    safeStr(p.id) && safeStr(p.itemKey) && safeStr(p.obtainedFrom) &&
    (/^Tier \d+$/.test(p.tier ?? '') || (safeStr(p.tier) && p.tier !== '' && !/^\d+$/.test(p.tier))) &&
    /^20\d{2}-\d{2}-\d{2}$/.test(p.obtainedDate ?? '') &&
    typeof p.float === 'number' && p.float >= 0 && p.float <= 1;
  if (!packable) return p;

  const flags = (p.equipped ? 1 : 0) | (p.starred ? 2 : 0);
  return [
    p.id,
    p.itemKey,
    /^Tier \d+$/.test(p.tier) ? p.tier.slice(5) : p.tier,
    Math.round(p.float * FLOAT_SCALE).toString(36),
    p.obtainedFrom,
    p.obtainedDate.slice(2).replaceAll('-', ''),
    flags,
  ].join('|');
}

export function decodePiece(s) {
  if (typeof s !== 'string') return s;
  const [id, itemKey, tier, f, obtainedFrom, d, flags] = s.split('|');
  const n = Number(flags);
  return {
    id,
    itemKey,
    tier: /^\d+$/.test(tier) ? `Tier ${tier}` : tier,
    float: parseInt(f, 36) / FLOAT_SCALE,
    obtainedFrom,
    obtainedDate: `20${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)}`,
    equipped: !!(n & 1),
    starred: !!(n & 2),
  };
}

export const encodeEquipment = (arr) => (arr ?? []).map(encodePiece);
export const decodeEquipment = (arr) => (arr ?? []).map(decodePiece);
