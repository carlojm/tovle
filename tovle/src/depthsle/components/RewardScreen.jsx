import { ABILITY_TREES } from '../data/abilities.js'
import { ROOM_TYPES } from '../data/layouts.js'
import './RewardScreen.css'

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

const RARITY_LABEL = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']
const RARITY_COLOR = ['#888', '#7df', '#f90', '#f4f', '#fa0']

function renderDesc(text = '') {
  const parts = text.split('**')
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ color: '#fff' }}>{part}</strong>
      : part
  )
}

function AbilityCard({ ability, onSelect, showUpgradeRarity }) {
  const tree = ABILITY_TREES[ability.tree]
  const rarityColor = RARITY_COLOR[ability.rarity] ?? '#888'
  const rarityLabel = RARITY_LABEL[ability.rarity] ?? 'Common'
  const nextRarityColor = RARITY_COLOR[ability.rarity + 1]
  const nextRarityLabel = RARITY_LABEL[ability.rarity + 1]

  return (
    <button className="rs-ability-card" onClick={() => onSelect(ability.id)}>
      <div className="rs-ability-header">
        {TREE_ICONS[ability.tree] && (
          <img src={TREE_ICONS[ability.tree]} alt={tree?.name} className="rs-ability-icon" />
        )}
        <div className="rs-ability-titles">
          {showUpgradeRarity ? (
            <span className="rs-ability-rarity">
              <span style={{ color: rarityColor }}>{rarityLabel}</span>
              <span style={{ opacity: 0.4 }}> → </span>
              <span style={{ color: nextRarityColor }}>{nextRarityLabel}</span>
            </span>
          ) : (
            <span className="rs-ability-rarity" style={{ color: rarityColor }}>
              {rarityLabel}
            </span>
          )}
          <span className="rs-ability-name">{ability.name}</span>
          <span className="rs-ability-tree">{tree?.name}</span>
        </div>
      </div>
      <p className="rs-ability-desc">
        {renderDesc(ability.descriptionText ?? ability.description, ability.rarity)}
      </p>
    </button>
  )
}

function UpgradeCard({ upgrade, onSelect }) {
  return (
    <button className="rs-upgrade-card" onClick={() => onSelect(upgrade.id)}>
      <span className="rs-upgrade-label">{upgrade.label}</span>
      <span className="rs-upgrade-desc">{upgrade.description}</span>
    </button>
  )
}

export default function RewardScreen({ state, dispatch }) {
  const roomDef = state.currentRoom ? ROOM_TYPES[state.currentRoom.type] : null

  const handleSelectAbility = (abilityId) => {
    dispatch({ type: 'SELECT_REWARD', abilityId })
  }

  const handleSelectUpgrade = (upgradeId) => {
    dispatch({ type: 'SELECT_REWARD', upgradeId })
  }

  return (
    <div className="depthsle-container">

      {/* ── Header ── */}
      <div className="ds-header">
        <div>
          <h1 className="ds-title">Room Cleared</h1>
          <p className="rs-stats">
            {state.killCountRoom} {state.killCountRoom === 1 ? 'enemy' : 'enemies'} defeated
            · {state.roomsCleared} {state.roomsCleared === 1 ? 'room' : 'rooms'} cleared total
          </p>
        </div>
      </div>

      {/* ── Reward section ── */}
      <div className="ds-section">
        <div className="travel-section-header">
          <h2 className="travel-section-title">
            {state.rewardType === 'upgrade' ? 'Choose an Upgrade' : 'Choose an Ability'}
          </h2>
          <span className="travel-section-caption">
            {roomDef?.isElite ? 'Elite room: ' : ''}
            {state.rewardType === 'upgrade'
              ? 'A permanent card upgrade for this run.'
              : 'A new card added to your deck.'}
          </span>
        </div>

        {/* Ability reward */}
        {state.rewardType !== 'upgrade' && (
          <div className="rs-choices">
            {(state.rewardChoices ?? []).length === 0 ? (
              <button
                className="ds-start-btn"
                onClick={() => dispatch({ type: 'SELECT_REWARD', abilityId: '__skip__' })}
              >
                No abilities available — Continue →
              </button>
            ) : (
              state.rewardChoices.map(ability => (
                <AbilityCard
                  key={ability.id}
                  ability={ability}
                  onSelect={handleSelectAbility}
                />
              ))
            )}
          </div>
        )}

        {/* Upgrade reward */}
        {state.rewardType === 'upgrade' && (
          <div className="rs-choices">
            {(state.upgradeChoices ?? []).length === 0 ? (
              <div className="ds-loadout-card" style={{ flexDirection: 'column', gap: 4 }}>
                <span style={{ opacity: 0.5, fontSize: 13 }}>No available upgrades.</span>
                <button
                  className="ds-start-btn"
                  style={{ marginTop: 8 }}
                  onClick={() => dispatch({ type: 'SELECT_REWARD', abilityId: '__skip__' })}
                >
                  Continue →
                </button>
              </div>
            ) : (
              state.upgradeChoices.map(ability => (
                <AbilityCard
                  key={ability.id}
                  ability={ability}
                  onSelect={handleSelectAbility}
                  showUpgradeRarity
                />
              ))
            )}
          </div>
        )}
      </div>

    </div>
  )
}