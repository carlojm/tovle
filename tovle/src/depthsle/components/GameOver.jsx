import { useState } from 'react'
import { ABILITY_TREES } from '../data/abilities.js'
import { getAbilityIconClass } from '../../data/abilityIcons.js'
import abilityBorder from '../../assets/depths_icons/ability_border.png'
import './GameOver.css'
import { getDepthslePuzzleNumber, getDisplayDate, getEasternDateStr } from '../../utils/dates.js'

// imports needed for handleShare
import { calcStats } from '../../utils/odm/statCalc'
import { buildRunStats } from '../engine/gearBridge'
import { getPlayerSlots, getMainSlots, getItemInSlot } from '../../utils/equipUtils'
import islesItems from '../../data/islesItems.json'

import flamecallerIcon  from '../../assets/talismans/flamecaller_talisman.png'
import earthboundIcon   from '../../assets/talismans/earthbound_talisman.png'
import shadowdancerIcon from '../../assets/talismans/shadowdancer_talisman.png'
import frostbornIcon    from '../../assets/talismans/frostborn_talisman.png'
import dawnbringerIcon  from '../../assets/talismans/dawnbringer_talisman.png'
import steelsageIcon    from '../../assets/talismans/steelsage_talisman.png'
import windwalkerIcon   from '../../assets/talismans/windwalker_talisman.png'

import { usePlayer } from '../../context/PlayerContext.jsx'

import ShareCard from './ShareCard.jsx'

const TREE_ICONS = {
  flamecaller:  flamecallerIcon,
  earthbound:   earthboundIcon,
  shadowdancer: shadowdancerIcon,
  frostborn:    frostbornIcon,
  dawnbringer:  dawnbringerIcon,
  steelsage:    steelsageIcon,
  windwalker:   windwalkerIcon,
}

const UNKNOWN_ICON = 'ability-icon--windwalker-unknown-ability'

function StatRow({ label, value }) {
  return (
    <div className="go-stat-row">
      <span className="go-stat-label">{label}</span>
      <span className="go-stat-value">{value}</span>
    </div>
  )
}

export default function GameOver({ state, onRestart }) {
  const [shareState, setShareState] = useState('idle') // idle | copied
  const mainTree = ABILITY_TREES[state.mainTree]
  const treeIcon = TREE_ICONS[state.mainTree]

  const dateStr = getEasternDateStr()
  const puzzleNumber = getDepthslePuzzleNumber(dateStr)
  const displayDate = getDisplayDate(dateStr)

  const shareText = [
    `Depthsle #${puzzleNumber} ${displayDate}`,
    `Cleared ${state.roomsCleared} floors`,
    state.treasureScore > 0 ? `${state.treasureScore} treasure score` : null,
    `Play at tovle.net`,
  ].filter(Boolean).join('\n')

  const { uid, playerData } = usePlayer()

  const handleShare = async () => {
    setShareState('generating')
    try {
      const slots = getPlayerSlots(playerData)
      const mainSlots = getMainSlots(playerData)
      const equipment = playerData?.equipment ?? []
      const stats = calcStats(slots, equipment)
      const runStats = buildRunStats(playerData)

      const [helmetSlot, chestSlot, legsSlot, bootsSlot, mainhandSlot, offhandSlot] = mainSlots

      const SLOT_LABELS = [
        [helmetSlot,   'Helmet'],
        [chestSlot,    'Chest'],
        [legsSlot,     'Leggings'],
        [bootsSlot,    'Boots'],
        [mainhandSlot, 'Mainhand'],
        [offhandSlot,  'Offhand'],
      ]

      const weaponType = runStats?.weaponType ?? 'sword'
      const DAMAGE_TYPE_LABEL = {
        sword: 'Melee DPS', axe: 'Melee DPS', scythe: 'Melee DPS',
        ranged: 'Ranged DPS', wand: 'Magic DPS',
      }
      const DAMAGE_STAT_KEY = {
        sword: 'critSpamDPS', axe: 'critSpamDPS', scythe: 'critSpamDPS',
        ranged: 'projSpamDPS', wand: 'magicDPS',
      }

      const dateStr = getEasternDateStr()

      const equippedItems = SLOT_LABELS.map(([slot, label]) => {
        const instance = getItemInSlot(slot, equipment)
        const itemDef = instance ? islesItems[instance.itemKey] : null
        return {
          label,
          name: itemDef?.name ?? null,
          tier: instance?.tier ?? null,
          instance: instance ? { itemKey: instance.itemKey } : null,
        }
      })

      const res = await fetch('/api/depthsle/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid,
          runData: {
            roomsCleared: state.roomsCleared,
            killCount: state.killCount,
            treasureScore: state.treasureScore,
            mainTree: state.mainTree,
            classOptions: state.classOptions,
            abilities: state.abilities.map(a => ({
              name: a.name,
              rarity: a.rarity,
              tree: a.tree,
              id: a.id,
            })),
            weaponType,
            hpValue: stats ? parseFloat(stats.meleeEHP).toFixed(0) : '—',
            dpsValue: stats ? parseFloat(stats[DAMAGE_STAT_KEY[weaponType]]).toFixed(1) : '—',
            dpsLabel: DAMAGE_TYPE_LABEL[weaponType],
            speedValue: stats ? stats.speedPercent : '—',
            puzzleNumber: getDepthslePuzzleNumber(dateStr),
            displayDate: getDisplayDate(dateStr),
            equippedItems,
          }
        })
      })

      const data = await res.json()
      if (!data.ok) throw new Error(data.error)

      const text = [
        `Depthsle #${getDepthslePuzzleNumber(dateStr)} ${getDisplayDate(dateStr)}`,
        `Cleared ${state.roomsCleared} floors`,
        state.treasureScore > 0 ? `${state.treasureScore} treasure score` : null,
        `Play at ${data.url}`,
      ].filter(Boolean).join('\n')

      await navigator.clipboard.writeText(text)
      setShareState('copied')
      setTimeout(() => setShareState('idle'), 2000)
    } catch (err) {
      console.error('Share failed:', err)
      setShareState('idle')
    }
  }

  return (
    <div className="depthsle-container">

      {/* ── Header ── */}
      <div className="ds-header">
        <div>
          <h1 className="ds-title">Defeated</h1>
          <p className="rs-stats">You made it to room {state.roomNumber}</p>
        </div>
        {treeIcon && (
          <img src={treeIcon} alt={mainTree?.name} className="go-tree-icon" />
        )}
      </div>

      {/* ── Run summary ── */}
      <div className="ds-section">
        <div className="travel-section-header">
          <h2 className="travel-section-title">Run Summary</h2>
        </div>
        <div className="go-summary-card">
          <StatRow label="Class" value={mainTree?.name ?? '—'} />
          <StatRow label="Rooms cleared" value={state.roomsCleared} />
          <StatRow label="Total kills" value={state.killCount} />
          <StatRow label="Treasure score" value={state.treasureScore} />
        </div>
      </div>

      {/* ── Abilities acquired ── */}
      {state.abilities.length > 0 && (
        <div className="ds-section">
          <div className="travel-section-header">
            <h2 className="travel-section-title">Abilities</h2>
            <span className="travel-section-caption">{state.abilities.length} acquired this run</span>
          </div>
          <div className="go-abilities">
            {state.abilities.map(ability => {
              const iconClass = getAbilityIconClass(ability.tree, ability.id) ?? UNKNOWN_ICON
              const tree = ABILITY_TREES[ability.tree]
              return (
                <div key={ability.id} className="go-ability-row">
                  <div className="go-ability-icon-wrap">
                    <div className={`ability-icon ${iconClass}`} />
                    <img src={abilityBorder} className="go-ability-border" alt="" />
                  </div>
                  <div className="go-ability-info">
                    <span className="go-ability-name">{ability.name}</span>
                    <span className="go-ability-tree">{tree?.name}</span>
                  </div>
                  <span className={`go-ability-rarity go-rarity--${ability.rarity}`}>
                    {['Common','Uncommon','Rare','Epic','Legendary'][ability.rarity]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="go-actions">
        <button className="ds-start-btn" onClick={onRestart}>
          Try Again →
        </button>
        <button className="go-share-btn" onClick={handleShare} disabled={shareState === 'generating'}>
          {shareState === 'generating' ? 'Generating...' : shareState === 'copied' ? 'Copied! ✓' : 'Share Result'}
        </button>
      </div>


      {/* ── Share card preview ── */}
      <div className="ds-section">
        <div className="travel-section-header">
          <h2 className="travel-section-title">Your Card</h2>
          <span className="travel-section-caption">Shared when you copy your result</span>
        </div>
        <ShareCard state={state} />
      </div>

    </div>
  )
}