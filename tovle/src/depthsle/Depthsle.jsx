import { useReducer, useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { combatReducer, buildInitialState, PHASES } from './engine/combatReducer.js'
import { ABILITY_TREES } from './data/abilities.js'
import { calcStats } from '../utils/odm/statCalc'
import { getPlayerSlots, getItemInSlot, getMainSlots } from '../utils/equipUtils'
import islesItems from '../data/islesItems.json'
import ItemIcon from '../components/ItemIcon'
import './Depthsle.css'
import DayTimer from '../components/DayTimer.jsx'

import RoomSelectGrid from './components/RoomSelectGrid.jsx'
import CombatScreen from './components/CombatScreen.jsx'

import flamecallerIcon  from '../assets/talismans/flamecaller_talisman.png'
import earthboundIcon   from '../assets/talismans/earthbound_talisman.png'
import shadowdancerIcon from '../assets/talismans/shadowdancer_talisman.png'
import frostbornIcon    from '../assets/talismans/frostborn_talisman.png'
import dawnbringerIcon  from '../assets/talismans/dawnbringer_talisman.png'
import steelsageIcon    from '../assets/talismans/steelsage_talisman.png'
import windwalkerIcon   from '../assets/talismans/windwalker_talisman.png'

const TREE_ICONS = {
  flamecaller:  flamecallerIcon,
  earthbound:   earthboundIcon,
  shadowdancer: shadowdancerIcon,
  frostborn:    frostbornIcon,
  dawnbringer:  dawnbringerIcon,
  steelsage:    steelsageIcon,
  windwalker:   windwalkerIcon,
}

const DAMAGE_TYPE_LABEL = {
  sword:  'Melee Base Damage',
  axe:    'Melee Base Damage',
  scythe: 'Melee Base Damage',
  ranged: 'Ranged Base Damage',
  magic:  'Magic Base Damage',
}

const WEAPON_TYPE_LABEL = {
  sword:  'Aspect of the Sword',
  axe:    'Aspect of the Axe',
  scythe: 'Aspect of the Scythe',
  ranged: 'Aspect of the Bow',
  magic:  'Aspect of the Wand',
}

const DAMAGE_STAT_KEY = {
  sword:  'critSpamDPS',
  axe:    'critSpamDPS',
  scythe: 'critSpamDPS',
  ranged: 'projSpamDPS',
  magic:  'magicDPS',
}

const TIER_BADGE = {
  'Tier 1': 'I', 'Tier 2': 'II', 'Tier 3': 'III',
  'Tier 4': 'IV', 'Tier 5': 'V',
  'Uncommon': 'Uc', 'Unique': 'Uq',
  'Rare': 'R', 'Artifact': 'A', 'Epic': 'E',
}

function SlotCell({ slot, instance }) {
  const isEmpty = !instance
  return (
    <div className={`ds-slot ${isEmpty ? 'ds-slot--empty' : 'ds-slot--filled'} ds-slot--${slot.type}`}>
      {!isEmpty && (
        <>
          <ItemIcon itemKey={instance.itemKey} />
          <span className="ds-slot-badge">{TIER_BADGE[instance.tier] ?? ''}</span>
        </>
      )}
    </div>
  )
}

export default function Depthsle({ onExit }) {
  const { playerData } = usePlayer()
  const [state, dispatch] = useReducer(combatReducer, playerData, buildInitialState)
  const [selectedClass, setSelectedClass] = useState(null)

  const slots = getPlayerSlots(playerData)
  const mainSlots = getMainSlots(playerData)
  const equipment = playerData?.equipment ?? []
  const stats = calcStats(slots, equipment)

  const weaponType = state.runStats?.weaponType ?? 'sword'
  const dpsLabel = DAMAGE_TYPE_LABEL[weaponType]
  const dpsKey = DAMAGE_STAT_KEY[weaponType]
  const dpsValue = stats ? parseFloat(stats[dpsKey]).toFixed(1) : '—'
  const hpValue = stats ? parseFloat(stats.meleeEHP).toFixed(0) : '—'
  const speedValue = stats ? stats.speedPercent : '—'

  const [helmetSlot, chestSlot, legsSlot, bootsSlot, mainhandSlot, offhandSlot] = mainSlots
  const mainhandInstance = getItemInSlot(mainhandSlot, equipment)
  const mainhandDef = mainhandInstance ? islesItems[mainhandInstance.itemKey] : null

  const handleStart = () => {
    if (!selectedClass) return
    dispatch({ type: 'SELECT_CLASS', treeId: selectedClass })
  }

  // replace the early return for non-CLASS_SELECT phases:
  if (state.phase === PHASES.ROOM_SELECT) {
    return (
      <div className="depthsle-container">
        <div className="ds-header">
          <div>
            <h1 className="ds-title">Darkest Depths</h1>
            <p style={{ opacity: 0.6, fontSize: '0.8rem', marginTop: '4px' }}>
              Room {state.roomNumber + 1} / {state.roomsCleared} cleared
            </p>
          </div>
        </div>
        <div className="ds-section">
          <div className="travel-section-header">
            <h2 className="travel-section-title">Room Select</h2>
            <span className="travel-section-caption">
              Select your path through the dungeon. Choose the reward to receive at the end of the next room.
            </span>
          </div>
          <RoomSelectGrid
            roomOptions={state.roomOptions}
            onSelect={(roomType) => dispatch({ type: 'SELECT_ROOM', roomType })}
          />
        </div>
      </div>
    )
  }

  if (state.phase === PHASES.PLAYING) {
    return <CombatScreen state={state} dispatch={dispatch} />
  }

  if (state.phase !== PHASES.CLASS_SELECT) {
    return (
      <div className="depthsle-container">
        <p style={{ opacity: 0.5 }}>Game in progress — UI coming soon</p>
      </div>
    )
  }

  return (
    <div className="depthsle-container">

      {/* ── Header ── */}
      <div className="ds-header">
        {/* <button className="ds-back" onClick={onExit}>← Travel</button> */}
        <div>
          <h1 className="ds-title">Darkest Depths</h1>
          {/* <span className="ds-subtitle">
            An endless labyrinth that changes with the tides.
            All players enter the same dungeon each day.
            Can you make it the farthest?
          </span> */}
          <p style={{ opacity: 0.6, fontSize: "0.8rem", marginTop: "4px" }}>
            Dungeon resets in: <strong><DayTimer /></strong>
          </p>
        </div>
      </div>

      {/* ── Loadout ── */}
      <div className="ds-section">
        <div className="travel-section-header">
          <h2 className="travel-section-title">Loadout</h2>
          <span className="travel-section-caption">Your equipment determines your base stats</span>
        </div>
        <div className="ds-loadout-card">

          {/* slot grid — left side */}
          <div className="ds-loadout-slots">
            <div className="ds-slots-grid">
              <SlotCell slot={helmetSlot}   instance={getItemInSlot(helmetSlot, equipment)} />
              <SlotCell slot={chestSlot}    instance={getItemInSlot(chestSlot, equipment)} />
              <SlotCell slot={legsSlot}     instance={getItemInSlot(legsSlot, equipment)} />
              <SlotCell slot={bootsSlot}    instance={getItemInSlot(bootsSlot, equipment)} />
              <SlotCell slot={offhandSlot}  instance={getItemInSlot(offhandSlot, equipment)} />
              <SlotCell slot={mainhandSlot} instance={mainhandInstance} />
            </div>
          </div>

          {/* stats — right side */}
          <div className="ds-loadout-stats">
            <div className="ds-weapon-name">
              {mainhandDef ? mainhandDef.name : <span className="ds-empty">No weapon</span>} ({dpsLabel.split(' ')[0].toLowerCase()})
            </div>
            <div className="ds-weapon-type">Entering with {WEAPON_TYPE_LABEL[weaponType]}</div>
            <div className="ds-loadout-divider" />
            <div className="ds-stat-row">
              <span className="ds-stat-label">Dungeon HP</span>
              <span className="ds-stat-value">{hpValue}</span>
            </div>
            <div className="ds-stat-row">
              <span className="ds-stat-label">{dpsLabel}</span>
              <span className="ds-stat-value">{dpsValue}</span>
            </div>
            <div className="ds-stat-row">
              <span className="ds-stat-label">Speed</span>
              <span className="ds-stat-value">{speedValue}%</span>
            </div>
          </div>

        </div>
      </div>

      {/* ── Class select ── */}
      <div className="ds-section">
        <div className="travel-section-header">
          <h2 className="travel-section-title">Main Class Selection</h2>
          <span className="travel-section-caption">
            Today's dungeon will draw ablities from these four classes.
            Choose a main tree that will appear more often and at higher rarities.
          </span>
        </div>
          
        <div className="ds-class-row">
          {state.classOptions.map(treeId => {
            const tree = ABILITY_TREES[treeId]
            const selected = selectedClass === treeId
            return (
              <button
                key={treeId}
                className={`ds-class-card ${selected ? 'ds-class-card--selected' : ''}`}
                onClick={() => setSelectedClass(treeId)}
              >
                <img
                  src={TREE_ICONS[treeId]}
                  alt={tree.name}
                  className="ds-class-icon"
                />
                <span className="ds-class-name">{tree.name}</span>
                <span className="ds-class-desc">{tree.description}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Start ── */}
      <button
        className={`ds-start-btn ${!selectedClass ? 'ds-start-btn--disabled' : ''}`}
        onClick={handleStart}
        disabled={!selectedClass}
      >
        {selectedClass ? `Enter as ${ABILITY_TREES[selectedClass]?.name} →` : 'Select a class to begin'}
      </button>

    </div>
  )
}