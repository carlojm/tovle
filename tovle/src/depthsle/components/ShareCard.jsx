import { usePlayer } from '../../context/PlayerContext'
import { getMainSlots, getBonusSlots, getItemInSlot, getPlayerSlots } from '../../utils/equipUtils'
import { calcStats } from '../../utils/odm/statCalc'
import { buildRunStats } from '../engine/gearBridge'
import { ABILITY_TREES } from '../data/abilities'
import { getAbilityIconClass } from '../../data/abilityIcons'
import { getDepthslePuzzleNumber, getDisplayDate, getEasternDateStr } from '../../utils/dates'
import islesItems from '../../data/islesItems.json'
import ItemIcon from '../../components/ItemIcon'
import depthsleLogo from '../../assets/depthsle_logo.png'
import abilityBorder from '../../assets/depths_icons/ability_border.png'
import './ShareCard.css'

import flamecallerIcon  from '../../assets/talismans/flamecaller_talisman.png'
import earthboundIcon   from '../../assets/talismans/earthbound_talisman.png'
import shadowdancerIcon from '../../assets/talismans/shadowdancer_talisman.png'
import frostbornIcon    from '../../assets/talismans/frostborn_talisman.png'
import dawnbringerIcon  from '../../assets/talismans/dawnbringer_talisman.png'
import steelsageIcon    from '../../assets/talismans/steelsage_talisman.png'
import windwalkerIcon   from '../../assets/talismans/windwalker_talisman.png'

const TREE_ICONS = {
  flamecaller:  flamecallerIcon,
  earthbound:   earthboundIcon,
  shadowdancer: shadowdancerIcon,
  frostborn:    frostbornIcon,
  dawnbringer:  dawnbringerIcon,
  steelsage:    steelsageIcon,
  windwalker:   windwalkerIcon,
}

const TIER_BADGE = {
  'Tier 1': 'T1', 'Tier 2': 'T2', 'Tier 3': 'T3',
  'Tier 4': 'T4', 'Tier 5': 'T5',
  'Uncommon': 'Uc', 'Unique': 'Uq',
  'Rare': 'R', 'Artifact': 'A', 'Epic': 'E',
}

const UNKNOWN_ICON = 'ability-icon--windwalker-unknown-ability'

const DAMAGE_TYPE_LABEL = {
  sword:  'Melee DPS',
  axe:    'Melee DPS',
  scythe: 'Melee DPS',
  ranged: 'Ranged DPS',
  wand:   'Magic DPS',
}

const DAMAGE_STAT_KEY = {
  sword:  'critSpamDPS',
  axe:    'critSpamDPS',
  scythe: 'critSpamDPS',
  ranged: 'projSpamDPS',
  wand:   'magicDPS',
}

function SlotCell({ slot, instance }) {
  const isEmpty = !instance
  return (
    <div className={`sc-slot sc-slot--${slot.type} ${isEmpty ? 'sc-slot--empty' : 'sc-slot--filled'}`}>
      {!isEmpty && (
        <>
          <ItemIcon itemKey={instance.itemKey} />
          {/* <span className="sc-slot-badge">{TIER_BADGE[instance.tier] ?? ''}</span> */}
        </>
      )}
    </div>
  )
}

export default function ShareCard({ state }) {
  const { playerData } = usePlayer()

  const slots = getPlayerSlots(playerData)
  const mainSlots = getMainSlots(playerData)
  const bonusSlots = getBonusSlots(playerData)
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
  const dpsLabel = DAMAGE_TYPE_LABEL[weaponType]
  const dpsKey = DAMAGE_STAT_KEY[weaponType]
  const dpsValue = stats ? parseFloat(stats[dpsKey]).toFixed(1) : '—'
  const hpValue = stats ? parseFloat(stats.meleeEHP).toFixed(0) : '—'
  const speedValue = stats ? stats.speedPercent : '—'

  const dateStr = getEasternDateStr()
  const puzzleNumber = getDepthslePuzzleNumber(dateStr)
  const displayDate = getDisplayDate(dateStr)

  const mainTree = ABILITY_TREES[state.mainTree]
  const subclasses = (state.classOptions ?? []).filter(id => id !== state.mainTree)

  // bonus slot rows of 9
  const bonusRows = []
  for (let i = 0; i < bonusSlots.length; i += 9) {
    bonusRows.push(bonusSlots.slice(i, i + 9))
  }

  return (
    <div className="sc-card">

      {/* ── Header ── */}
      <div className="sc-header">
        <img src={depthsleLogo} alt="Depthsle" className="sc-logo" />
        <div className="sc-header-center">
          <span className="sc-dungeon-label">Dungeon</span>
          <span className="sc-dungeon-number">#{puzzleNumber}</span>
          {/* <span className="sc-header-divider">·</span> */}
          <span className="sc-date">{displayDate}</span>
        </div>
        <div className="sc-class-block">
          <span className="sc-main-class-name">{mainTree?.name}</span>
          <img
            src={TREE_ICONS[state.mainTree]}
            alt={mainTree?.name}
            className="sc-main-class-icon"
          />
          <div className="sc-subclass-row">
            {subclasses.map(id => (
              <img
                key={id}
                src={TREE_ICONS[id]}
                alt={id}
                className="sc-sub-class-icon"
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="sc-body">

        {/* Column 1 — slot icons */}
        <div className="sc-col sc-col--slots">
          <div className="sc-col-label">LOADOUT</div>
          <div className="sc-slots-grid">
            <SlotCell slot={helmetSlot}   instance={getItemInSlot(helmetSlot, equipment)} />
            <SlotCell slot={offhandSlot}  instance={getItemInSlot(offhandSlot, equipment)} />
            <SlotCell slot={chestSlot}    instance={getItemInSlot(chestSlot, equipment)} />
            <div className="sc-slot-spacer" />
            <SlotCell slot={legsSlot}     instance={getItemInSlot(legsSlot, equipment)} />
            <div className="sc-slot-spacer" />
            <SlotCell slot={bootsSlot}    instance={getItemInSlot(bootsSlot, equipment)} />
            <SlotCell slot={mainhandSlot} instance={getItemInSlot(mainhandSlot, equipment)} />
          </div>
          {bonusSlots.length > 0 && (
            <div className="sc-bonus-slots">
              {bonusRows.map((row, i) => (
                <div key={i} className="sc-bonus-row">
                  {row.map(slot => (
                    <SlotCell
                      key={slot.slotId}
                      slot={slot}
                      instance={getItemInSlot(slot, equipment)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column 2 — item names + stats */}
        <div className="sc-col sc-col--names">
          {/* <div className="sc-col-label">&nbsp;</div> */}
          <div className="sc-stat-list">
            <div className="sc-stat-row">
              <span className="sc-stat-label">Dungeon HP</span>
              <span className="sc-stat-value">{hpValue}</span>
            </div>
            <div className="sc-stat-row">
              <span className="sc-stat-label">{dpsLabel}</span>
              <span className="sc-stat-value">{dpsValue}</span>
            </div>
            <div className="sc-stat-row">
              <span className="sc-stat-label">Speed</span>
              <span className="sc-stat-value">{speedValue}%</span>
            </div>
          </div>

          <div className="sc-divider" />

          <div className="sc-namelist">
            {SLOT_LABELS.map(([slot, label]) => {
              const instance = getItemInSlot(slot, equipment)
              const itemDef = instance ? islesItems[instance.itemKey] : null
              return (
                <div key={slot.slotId} className="sc-name-row">
                  <span className="sc-name-slot-label">{label}</span>
                  <span className={`sc-name-value ${!itemDef ? 'sc-name-empty' : ''}`}>
                    {itemDef ? itemDef.name : '—'}
                    {instance?.tier && (
                      <span className="sc-name-tier">
                        {TIER_BADGE[instance.tier] ?? instance.tier}
                      </span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
          
        </div>

        {/* Column 3 — run summary + abilities */}
        <div className="sc-col sc-col--run">
          <div className="sc-col-label">TODAY'S RUN</div>
          <div className="sc-run-stats">
            <span className="sc-run-line">
              {state.roomsCleared} {state.roomsCleared === 1 ? 'room' : 'rooms'} cleared
            </span>
            <span className="sc-run-line">{state.killCount} kills</span>
            {state.treasureScore > 0 && (
              <span className="sc-run-line">{state.treasureScore} treasure score</span>
            )}
            <span className="sc-run-line">{DAMAGE_TYPE_LABEL[weaponType].replace(' DPS', '')} build</span>
          </div>

          {state.abilities.length > 0 && (
            <>
              <div className="sc-col-label sc-col-label--abilities">ABILITIES</div>
              <div className="sc-abilities-grid">
                {state.abilities.map(ability => {
                  const iconClass = getAbilityIconClass(ability.tree, ability.id) ?? UNKNOWN_ICON
                  return (
                    <div key={ability.id} className="sc-ability-item">
                      <div className="sc-ability-icon-wrap">
                        <div className={`ability-icon ${iconClass}`} />
                        <img src={abilityBorder} className="sc-ability-border" alt="" />
                      </div>
                      <span className="sc-ability-name">{ability.name}</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  )
}