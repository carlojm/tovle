import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { uploadToR2 } from './r2.js'
import { db } from './firebase.js'
import { getItemIconBase64 } from './itemIcons.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Load assets at module startup ─────────────────────────────────────────

//command to convert woff2 to ttf:
//cd server
//woff2_decompress fonts/OpenRunde-Bold.woff2
const fontRegular = fs.readFileSync(path.join(__dirname, 'fonts/OpenRunde-Regular.ttf'))
const fontBold    = fs.readFileSync(path.join(__dirname, 'fonts/OpenRunde-Bold.ttf'))

const FONTS = [
  { name: 'Open Runde', data: fontRegular, weight: 400, style: 'normal' },
  { name: 'Open Runde', data: fontBold,    weight: 700, style: 'normal' },
]

// Generate a random 6-char alphanumeric share ID
function loadBase64(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[share] Asset not found: ${filePath}`)
    return null
  }
  const ext = path.extname(filePath).slice(1).replace('jpg', 'jpeg')
  const data = fs.readFileSync(filePath).toString('base64')
  return `data:image/${ext};base64,${data}`
}

const depthsleLogo = loadBase64(path.join(__dirname, 'assets/depthsle_logo.png'))
// console.log('[share] depthsleLogo loaded:', !!depthsleLogo, depthsleLogo?.slice(0, 50))
const abilityBorderImg = loadBase64(path.join(__dirname, 'assets/ability_border.png'))
const unknownAbilityImg = loadBase64(path.join(__dirname, 'assets/unknown_ability.png'))

const talismanIcons = {
  flamecaller:  loadBase64(path.join(__dirname, 'assets/talismans/flamecaller_talisman.png')),
  earthbound:   loadBase64(path.join(__dirname, 'assets/talismans/earthbound_talisman.png')),
  shadowdancer: loadBase64(path.join(__dirname, 'assets/talismans/shadowdancer_talisman.png')),
  frostborn:    loadBase64(path.join(__dirname, 'assets/talismans/frostborn_talisman.png')),
  dawnbringer:  loadBase64(path.join(__dirname, 'assets/talismans/dawnbringer_talisman.png')),
  steelsage:    loadBase64(path.join(__dirname, 'assets/talismans/steelsage_talisman.png')),
  windwalker:   loadBase64(path.join(__dirname, 'assets/talismans/windwalker_talisman.png')),
}

function loadAbilityIcons() {
  const icons = {}
  const abilitiesDir = path.join(__dirname, 'scripts/abilities')
  if (!fs.existsSync(abilitiesDir)) {
    console.warn('[share] Abilities dir not found:', abilitiesDir)
    return icons
  }
  for (const className of fs.readdirSync(abilitiesDir)) {
    const classDir = path.join(abilitiesDir, className)
    if (!fs.statSync(classDir).isDirectory()) continue
    for (const file of fs.readdirSync(classDir)) {
      if (!file.endsWith('.png')) continue
      if (file === 'border.png' || file === 'border_silenced.png') continue
      const abilityId = file.replace('.png', '')
      icons[`${className}/${abilityId}`] = loadBase64(path.join(classDir, file))
    }
  }
  console.log(`[share] Loaded ${Object.keys(icons).length} ability icons`)
  return icons
}

const abilityIcons = loadAbilityIcons()

// ── Constants ─────────────────────────────────────────────────────────────

const TIER_BADGE = {
  'Tier 1': 'T1', 'Tier 2': 'T2', 'Tier 3': 'T3',
  'Tier 4': 'T4', 'Tier 5': 'T5',
  'Uncommon': 'Uc', 'Unique': 'Uq',
  'Rare': 'R', 'Artifact': 'A', 'Epic': 'E',
}

const DAMAGE_TYPE_LABEL = {
  sword: 'Melee DPS', axe: 'Melee DPS', scythe: 'Melee DPS',
  ranged: 'Ranged DPS', wand: 'Magic DPS',
}

const RARITY_COLORS = ['#888888', '#77ddff', '#ff9900', '#ff44ff', '#ffaa00']

// ── Colors ────────────────────────────────────────────────────────────────

const C = {
  bg:        '#0e0618',
  headerBg:  '#130820',
  border:    '#2a1a4a',
  slotBg:    '#1a0f2e',
  slotBorderEmpty:  '#2a1a4a',
  slotBorderFilled: '#5a3a8a',
  text:      '#eff1ed',
  textDim:   'rgba(239, 241, 237, 0.60)',
  textFaint: 'rgba(239,241,237,0.45)',
  accent:    '#7a4aaa',
}

// ── Element builders ──────────────────────────────────────────────────────

const d = (style, children) => ({
  type: 'div',
  props: { style: { display: 'flex', ...style }, children: Array.isArray(children) ? children.filter(Boolean) : children }
})

const t = (style, text) => ({
  type: 'span',
  props: { style: { fontFamily: 'Open Runde', ...style }, children: String(text ?? '') }
})

const i = (src, style) => src ? ({
  type: 'img',
  props: { src, style }
}) : null

const row = (children, style = {}) => d({ flexDirection: 'row', ...style }, children)
const col = (children, style = {}) => d({ flexDirection: 'column', ...style }, children)

// ── Card dimensions ───────────────────────────────────────────────────────

const W = 1200
const H = 600
const HEADER_H = 140
const BODY_H = H - HEADER_H
const PAD = 28
const SLOT = 80   // slot cell size in px
const SLOT_GAP = 4

// ── Sub-components ────────────────────────────────────────────────────────

function slotCell(instance, iconBase64) {
  const filled = !!instance
  return d({
    width: SLOT,
    height: SLOT,
    background: C.slotBg,
    border: `2px solid ${filled ? C.slotBorderFilled : C.slotBorderEmpty}`,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }, filled && iconBase64 ? [i(iconBase64, { width: SLOT - 8, height: SLOT - 8 })] : [])
}

function slotSpacer() {
  return d({ width: SLOT, height: SLOT, flexShrink: 0 }, [])
}

function statRow(label, value) {
  return row([
    t({ fontSize: 26, color: C.textDim }, label),
    t({ fontSize: 32, fontWeight: 700, color: C.accent }, String(value)),
  ], {
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  })
}

function nameRow(label, name, tier) {
  return row([
    t({ fontSize: 22, color: C.textFaint, width: 110, flexShrink: 0 }, label),
    row([
      t({ fontSize: 22, fontWeight: 600, color: C.text }, name ?? '—'),
      tier ? t({ fontSize: 18, fontWeight: 700, color: C.textDim, marginLeft: 8 }, tier) : null,
    ].filter(Boolean), { justifyContent: 'flex-end', flex: 1 }),
  ], {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  })
}

function abilityItem(ability) {
  const iconKey = `${ability.tree}/${ability.id}`
  const iconSrc = abilityIcons[iconKey]
  // const rarityColor = RARITY_COLORS[ability.rarity ?? 0]
  const ICON = 64

  return row([
    // icon box
    d({
      width: ICON,
      height: ICON,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
      flexShrink: 0,
      position: 'relative',
    }, [
      iconSrc
        ? i(iconSrc, { width: ICON, height: ICON })
        : unknownAbilityImg ? i(unknownAbilityImg, { width: ICON, height: ICON }) : null,
        // : d({ width: ICON, height: ICON, background: rarityColor, borderRadius: 4, opacity: 0.5 }, []),
      abilityBorderImg
        ? i(abilityBorderImg, { position: 'absolute', top: -6, left: -6, width: ICON + 12, height: ICON + 12 })
        : null,
    ]),
    d({ width: 140, flexWrap: 'wrap' }, [
      t({ fontSize: 18, fontWeight: 600, color: C.text }, ability.name),
    ]),
  ], {
    alignItems: 'center',
    width: '48%',
    marginBottom: 12,
    marginRight: '2%',
  })
}

// ── Main card builder ─────────────────────────────────────────────────────

function buildCard({
  puzzleNumber, displayDate,
  mainTree, subclasses,
  weaponType, hpValue, dpsValue, dpsLabel, speedValue,
  slotData, equippedSlots,
  roomsCleared, killCount, treasureScore,
  abilities, equippedIconsBase64
}) {
  const treeIcon = talismanIcons[mainTree?.toLowerCase()] ?? talismanIcons.flamecaller

  // slot grid — C shape
  const SLOTS_COL_W = SLOT * 2 + SLOT_GAP

  const slotsLeft = col([
    slotCell(equippedSlots[0], equippedIconsBase64[0]),  // helmet
    d({ height: SLOT_GAP }, []),
    slotCell(equippedSlots[1], equippedIconsBase64[1]),  // chest
    d({ height: SLOT_GAP }, []),
    slotCell(equippedSlots[2], equippedIconsBase64[2]),  // legs
    d({ height: SLOT_GAP }, []),
    slotCell(equippedSlots[3], equippedIconsBase64[3]),  // boots
  ])

  const slotsRight = col([
    slotCell(equippedSlots[5], equippedIconsBase64[5]),  // offhand
    d({ height: SLOT_GAP }, []),
    slotSpacer(),
    d({ height: SLOT_GAP }, []),
    slotSpacer(),
    d({ height: SLOT_GAP }, []),
    slotCell(equippedSlots[4], equippedIconsBase64[4]),  // mainhand
  ])

  const slotsGrid = row([slotsLeft, d({ width: SLOT_GAP }, []), slotsRight])

  // column widths
  const COL1_W = SLOTS_COL_W + PAD * 2       // slots column
  const COL2_W = 500                           // names + stats
  const COL3_W = W - COL1_W - COL2_W         // run + abilities

  const treeName = mainTree ? mainTree.charAt(0).toUpperCase() + mainTree.slice(1) : ''

  return d({
    width: W,
    height: H,
    background: C.bg,
    fontFamily: 'Open Runde',
    color: C.text,
    flexDirection: 'column',
  }, [

    // ── Header ────────────────────────────────────────────────────────
    row([
      // logo
      depthsleLogo
        ? i(depthsleLogo, { height: 80, width: 300, objectFit: 'contain', marginLeft: -12, marginRight: 12, marginTop: 14 })
        : t({ fontSize: 40, fontWeight: 700, color: C.text, marginRight: 24 }, 'Depthsle'),

      // dungeon number + date
      row([
        // t({ fontSize: 32, color: 'rgba(239,241,237,0.6)', marginRight: 10 }, 'Dungeon'),
        t({ fontSize: 36, color: 'rgba(239,241,237,0.6)', marginTop: 6, marginRight: 14}, displayDate),
        t({ fontSize: 44, fontWeight: 700, color: C.text, marginTop: 6}, `#${puzzleNumber}`),
      ], { alignItems: 'baseline', flex: 1 }),

      // class block: name + main icon + sub icons
      row([
        t({ fontSize: 32, fontWeight: 600, marginRight: 12, marginTop: 6 }, treeName ?? ''),
        treeIcon ? i(treeIcon, { width: 80, height: 80 }) : null,
        col(
          subclasses.map((id, idx) => i(talismanIcons[id], {
            width: 28, height: 28,
            marginTop: idx > 0 ? 4 : 0,
            opacity: 0.8,
          })).filter(Boolean),
          { marginLeft: 8 }
        ),
      ], { alignItems: 'center' }),
    ], {
      height: HEADER_H,
      alignItems: 'center',
      padding: `0 ${PAD}px`,
      background: C.headerBg,
      borderBottom: `2px solid ${C.border}`,
    }),

    // ── Body ──────────────────────────────────────────────────────────
    row([

      // Column 1 — slot icons
      col([
        t({ fontSize: 26, color: C.textDim, marginTop: 8, marginBottom: 16 }, 'Equipment'),
        slotsGrid,
      ], {
        width: COL1_W,
        padding: `${PAD}px`,
        borderRight: `1px solid ${C.border}`,
        flexShrink: 0,
      }),

      // Column 2 — stats + item names
      col([
        statRow('Dungeon HP', hpValue),
        statRow(dpsLabel, dpsValue),
        statRow('Speed', `${speedValue}%`),
        d({ height: 1, background: C.border, marginTop: 12, marginBottom: 24 }, []),
        ...slotData.map(({ label, name, tier }) => nameRow(label, name, tier)),
      ], {
        width: COL2_W,
        padding: `${PAD}px`,
        borderRight: `1px solid ${C.border}`,
        flexShrink: 0,
      }),

      // Column 3 — run summary + abilities
      col([
        // t({ fontSize: 26, color: C.textDim, marginBottom: 16 }, "TODAY'S RUN"),
        // t({ fontSize: 32, color: C.text, marginBottom: 10 },
        //   `${roomsCleared} ${roomsCleared === 1 ? 'room' : 'rooms'} cleared`),
        // t({ fontSize: 32, color: C.text, marginBottom: 10 }, `${killCount} kills`),
        // t({ fontSize: 32, color: C.text, marginBottom: 10 }, `${treasureScore} treasure score`),
        statRow('Rooms cleared', `${roomsCleared}`),
        statRow('Kills', `${killCount}`),
        statRow('Treasure score', `${treasureScore}`),
        // t({ fontSize: 28, color: C.textDim, marginBottom: 20 },
        //   `${DAMAGE_TYPE_LABEL[weaponType]?.replace(' DPS', '') ?? 'Melee'} build`),
        d({ height: 1, background: C.border, marginTop: 12, marginBottom: 24 }, []),
        abilities.length > 0 ? col([
          // t({ fontSize: 26, color: C.textDim, marginBottom: 14 }, 'ABILITIES'),
          d({ flexWrap: 'wrap' }, abilities.map(a => abilityItem(a))),
        ]) : null,
      ].filter(Boolean), {
        flex: 1,
        padding: `${PAD}px`,
      }),

    ], { flex: 1 }),

  ])
}

// ── Firestore helpers ─────────────────────────────────────────────────────

function generateShareId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function getOrCreateShareId(uid) {
  const playerRef = db.collection('players').doc(uid)
  const doc = await playerRef.get()
  const existing = doc.data()?.shareId
  if (existing) return existing
  const shareId = generateShareId()
  await playerRef.set({ shareId }, { merge: true })
  return shareId
}

// ── Main export ───────────────────────────────────────────────────────────

export async function generateShareImage(uid, runData) {
  const shareId = await getOrCreateShareId(uid)

  const {
    roomsCleared = 0,
    killCount = 0,
    treasureScore = 0,
    mainTree = 'flamecaller',
    classOptions = [],
    abilities = [],
    weaponType = 'sword',
    hpValue = '—',
    dpsValue = '—',
    dpsLabel = 'Melee DPS',
    speedValue = '—',
    puzzleNumber = 1,
    displayDate = '',
    equippedItems = [],
  } = runData

  const subclasses = classOptions.filter(id => id !== mainTree)

  const slotData = equippedItems.map(item => ({
    label: item.label,
    name: item.name,
    tier: item.tier ? (TIER_BADGE[item.tier] ?? item.tier) : null,
  }))

  const equippedSlots = equippedItems.map(item => item.instance)

  //item images
  const islesItemsPath = path.join(__dirname, 'data/islesItems.json')
  const islesItems = JSON.parse(fs.readFileSync(islesItemsPath, 'utf-8'))
  const equippedIconsBase64 = await Promise.all(
    equippedItems.map(async item => {
      if (!item.instance?.itemKey) return null
      // console.log('[share] itemKey:', item.instance?.itemKey, '-> found:', !!islesItems[item.instance?.itemKey])
      const itemDef = islesItems[item.instance.itemKey]
      return getItemIconBase64(itemDef)
    })
  )
  

  const element = buildCard({
    puzzleNumber, displayDate,
    mainTree, subclasses,
    weaponType, hpValue, dpsValue, dpsLabel, speedValue,
    slotData, equippedSlots,
    roomsCleared, killCount, treasureScore,
    abilities, equippedIconsBase64
  })

  const svg = await satori(element, {
    width: W,
    height: H,
    fonts: FONTS,
  })

  const resvg = new Resvg(svg)
  const pngBuffer = resvg.render().asPng()

  const key = `og/${shareId}.png`
  await uploadToR2(key, pngBuffer, 'image/png')

  return { shareId, url: `https://tovle-beta.fly.dev/d/${shareId}` }
}