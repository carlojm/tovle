//used for generating satori friendly versions of item icons
//for depthsle share embed images
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

//parse css position map
function parseSpritesheet(cssPath) {
  const map = {}
  if (!fs.existsSync(cssPath)) {
    console.warn('[itemIcons] CSS not found:', cssPath)
    return map
  }
  const css = fs.readFileSync(cssPath, 'utf-8')
  const rules = css.matchAll(/\.([\w-]+)\s*\{\s*background-position:\s*(-?\d+)px\s+(-?\d+)px/g)
  for (const [, className, x, y] of rules) {
    map[className] = { x: Math.abs(parseInt(x)), y: Math.abs(parseInt(y)) }
  }
  console.log(`[itemIcons] Parsed ${Object.keys(map).length} sprites from ${path.basename(cssPath)}`)
  return map
}

const monumentaMap = parseSpritesheet(path.join(__dirname, 'assets/_itemsheet.css'))
const minecraftMap = parseSpritesheet(path.join(__dirname, 'assets/_minecraft.css'))

const ITEMSHEET = path.join(__dirname, 'assets/itemsheet.png')
const MINECRAFT = path.join(__dirname, 'assets/minecraft.png')


//class name generators, copy of ItemIcon.jsx basically
function getMonumentaClass(itemName) {
  return `monumenta-${itemName
    .replaceAll('-', '')
    .replaceAll('.', '')
    .replaceAll("'", '')
    .replace(/\(.*\)/g, '')
    .trim()
    .replaceAll(' ', '-')
    .replaceAll('_', '-')
    .toLowerCase()
    .replace(/(^|-)([a-z])/g, (_, sep, c) => `${sep}${c.toUpperCase()}`)
  }`
}

function getMinecraftClass(baseItem) {
  return `minecraft-${baseItem
    .replaceAll(' ', '-')
    .replaceAll('_', '-')
    .toLowerCase()
  }`
}


//sprite cache
const cache = {}

async function extractSprite(spritesheetPath, x, y) {
  const cacheKey = `${spritesheetPath}:${x}:${y}`
  if (cache[cacheKey]) return cache[cacheKey]

  try {
    const buffer = await sharp(spritesheetPath)
      .extract({ left: x, top: y, width: 64, height: 64 })
      .png()
      .toBuffer()
    const b64 = `data:image/png;base64,${buffer.toString('base64')}`
    cache[cacheKey] = b64
    return b64
  } catch (err) {
    console.warn(`[itemIcons] Failed to extract sprite at ${x},${y}:`, err.message)
    return null
  }
}


//main export
export async function getItemIconBase64(item) {
  if (!item) return null

  const monumentaClass = getMonumentaClass(item.name)
  if (monumentaMap[monumentaClass]) {
    const { x, y } = monumentaMap[monumentaClass]
    return extractSprite(ITEMSHEET, x, y)
  }

  if (item.base_item) {
    const minecraftClass = getMinecraftClass(item.base_item)
    if (minecraftMap[minecraftClass]) {
      const { x, y } = minecraftMap[minecraftClass]
      return extractSprite(MINECRAFT, x, y)
    }
  }

  return null
}