import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { uploadToR2 } from './r2.js'
import { db } from './firebase.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load fonts once at module load time
const fontRegular = fs.readFileSync(path.join(__dirname, 'fonts/OpenRunde-Regular.ttf'))
const fontBold = fs.readFileSync(path.join(__dirname, 'fonts/OpenRunde-Bold.ttf'))
//command to convert woff2 to ttf:
//cd server
//woff2_decompress fonts/OpenRunde-Bold.woff2

const FONTS = [
  { name: 'Open Runde', data: fontRegular, weight: 400, style: 'normal' },
  { name: 'Open Runde', data: fontBold,    weight: 700, style: 'normal' },
]

// Generate a random 6-char alphanumeric share ID
function generateShareId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// Get or create a stable shareId for this player
async function getOrCreateShareId(uid) {
  const userRef = db.collection('players').doc(uid)
  const doc = await userRef.get()
  const existing = doc.data()?.shareId
  if (existing) return existing
  const shareId = generateShareId()
  await userRef.set({ shareId }, { merge: true })
  return shareId
}

export async function generateShareImage(uid, runData) {
  const shareId = await getOrCreateShareId(uid)

  const {
    roomsCleared = 0,
    killCount = 0,
    treasureScore = 0,
    mainTree = null,
    abilities = [],
    puzzleNumber = 1,
    dateString = '',
  } = runData

  // Build the card JSX for satori
  const element = {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#0e0618',
        padding: '48px',
        fontFamily: 'Open Runde',
        color: '#eff1ed',
      },
      children: [
        // Header row
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '32px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'column', gap: '8px' },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: { fontSize: '36px', fontWeight: 700 },
                        children: `Darkest Depths`,
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: { fontSize: '18px', opacity: 0.5 },
                        children: `#${puzzleNumber} · ${dateString}`,
                      },
                    },
                  ],
                },
              },
              // Wave emoji as logo
              {
                type: 'div',
                props: {
                  style: { fontSize: '64px' },
                  children: '🌊',
                },
              },
            ],
          },
        },

        // Stats row
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              gap: '16px',
              marginBottom: '32px',
            },
            children: [
              statCard('Floors', roomsCleared),
              statCard('Kills', killCount),
              statCard('Score', treasureScore),
            ],
          },
        },

        // Abilities
        abilities.length > 0 ? {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: { fontSize: '14px', opacity: 0.45, marginBottom: '4px', fontWeight: 700, letterSpacing: '0.08em' },
                  children: 'ABILITIES',
                },
              },
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
                  children: abilities.slice(0, 8).map(a => abilityChip(a)),
                },
              },
            ],
          },
        } : null,

        // Footer
        {
          type: 'div',
          props: {
            style: {
              marginTop: 'auto',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: { fontSize: '14px', opacity: 0.4 },
                  children: 'tovle.net',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '14px',
                    opacity: 0.4,
                  },
                  children: mainTree ? `${mainTree} class` : '',
                },
              },
            ],
          },
        },
      ].filter(Boolean),
    },
  }

  const svg = await satori(element, {
    width: 1200,
    height: 630,
    fonts: FONTS,
  })

  const resvg = new Resvg(svg)
  const pngBuffer = resvg.render().asPng()

  // Upload to R2
  const key = `og/${shareId}.png`
  await uploadToR2(key, pngBuffer, 'image/png')

  return { shareId, url: `https://tovle.net/d/${shareId}` }
}

function statCard(label, value) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(122,74,170,0.4)',
        borderRadius: '10px',
        padding: '16px 24px',
        flex: 1,
      },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: '13px', opacity: 0.45 },
            children: label,
          },
        },
        {
          type: 'div',
          props: {
            style: { fontSize: '32px', fontWeight: 700 },
            children: String(value),
          },
        },
      ],
    },
  }
}

function abilityChip(ability) {
  const RARITY_COLORS = ['#888888', '#77ddff', '#ff9900', '#ff44ff', '#ffaa00']
  const color = RARITY_COLORS[ability.rarity ?? 0]
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(255,255,255,0.06)',
        border: `1px solid ${color}`,
        borderRadius: '6px',
        padding: '6px 12px',
        fontSize: '13px',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { color, fontSize: '11px', fontWeight: 700 },
            children: ['C','Uc','R','E','L'][ability.rarity ?? 0],
          },
        },
        {
          type: 'div',
          props: {
            style: { color: '#eff1ed' },
            children: ability.name,
          },
        },
      ],
    },
  }
}