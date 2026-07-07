import { SUB_PHASES } from '../engine/combatReducer.js'
import './CardHand.css'

import '../../assets/depths_icons/abilities_spritesheet.css'
import { getAbilityIconClass } from '../../data/abilityIcons.js'
import abilityBorder from '../../assets/depths_icons/ability_border.png'

import basicSwordIcon  from '../../assets/depths_icons/basic_sword.png'
import basicAxeIcon    from '../../assets/depths_icons/basic_axe.png'
import basicScytheIcon from '../../assets/depths_icons/basic_scythe.png'
import basicWandIcon   from '../../assets/depths_icons/basic_wand.png'
import basicBowIcon    from '../../assets/depths_icons/basic_bow.png'
const BASIC_ATTACK_ICONS = {
  sword:  basicSwordIcon,
  axe:    basicAxeIcon,
  scythe: basicScytheIcon,
  magic:  basicWandIcon,
  ranged: basicBowIcon,
}

const DAMAGE_COLOR = {
  melee:      '#e07040',
  projectile: '#60a8e0',
  magic:      '#a060e0',
}

function CooldownBar({ current, max }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, 1 - current / max)) : 1
  return (
    <div className="ch-cd-track">
      <div className="ch-cd-fill" style={{ width: `${pct * 100}%` }} />
    </div>
  )
}

function renderDesc(text = '') {
  const parts = text.split('**')
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ color: 'var(--color-coords-border)' }}>{part}</strong>
      : part
  )
}

function AbilityButton({ ability, isReady, isSelected, isDisabled, cooldown, maxCooldown, onSelect }) {
  const iconClass = getAbilityIconClass(ability.tree, ability.id) ?? 'ability-icon--windwalker-unknown-ability'

  return (
    <button
      className={[
        'ch-card',
        isReady    ? 'ch-card--ready'    : 'ch-card--charging',
        isSelected ? 'ch-card--selected' : '',
        isDisabled ? 'ch-card--disabled' : '',
      ].join(' ')}
      onClick={() => isReady && !isDisabled && onSelect(ability)}
      disabled={!isReady || isDisabled}
    >
      <div className="ch-card-icon-wrap">
        <div className={`ability-icon ${iconClass ?? 'ability-icon--unknown'}`} />
        <img src={abilityBorder} className="ch-card-border" alt="" />
      </div>
      <div className="ch-card-body">
        <span className="ch-card-name">{ability.name}</span>
        {!isReady && (
          <span className="ch-card-cd-label">{Math.ceil(cooldown)}</span>
        )}
      </div>
      <CooldownBar current={cooldown} max={maxCooldown} />
    </button>
  )
}

function BasicAttackCard({ card, isSelected, isDisabled, weaponType, onSelect }) {
  const icon = BASIC_ATTACK_ICONS[weaponType] ?? basicSwordIcon

  return (
    <button
      className={[
        'ch-card ch-card--basic ch-card--ready',
        isSelected ? 'ch-card--selected' : '',
        isDisabled ? 'ch-card--disabled' : '',
      ].join(' ')}
      onClick={() => !isDisabled && onSelect(card)}
      disabled={isDisabled}
    >
      <div className="ch-card-icon-wrap">
        <img src={icon} alt={card.name} className="ch-basic-icon" />
        <img src={abilityBorder} className="ch-card-border" alt="" />
      </div>
      <div className="ch-card-body">
        <span className="ch-card-name">{card.name}</span>
        <span className="ch-card-type" style={{ opacity: 0.5, fontSize: 10 }}>Basic</span>
      </div>
    </button>
  )
}

export default function CardHand({ hand, abilities, abilityCooldowns, subPhase, selectedCard, weaponType, onCardSelect }) {
  const isPlayerTurn = subPhase === SUB_PHASES.PLAYER_TURN
  const handIds = new Set(hand.map(c => c.cardId ?? c.id))

  const basicAttack = hand.find(c => c.isBasicAttack)
  const activeAbilities = (abilities ?? []).filter(a => a.cardType !== 'passive')

  return (
    <div className="ch-container">
      <div className="ch-scroll">

        {/* Basic attack always first */}
        {basicAttack && (
          <BasicAttackCard
            card={basicAttack}
            isSelected={selectedCard?.instanceId === basicAttack.instanceId}
            isDisabled={!isPlayerTurn}
            weaponType={weaponType}
            onSelect={onCardSelect}
          />
        )}

        {/* All active abilities, ready or charging */}
        {activeAbilities.map(ability => {
          const isReady = handIds.has(ability.id)
          const handCard = hand.find(c => (c.cardId ?? c.id) === ability.id)
          const cooldown = abilityCooldowns?.[ability.id] ?? 0
          const maxCooldown = ability.cooldownBase ?? 5

          return (
            <AbilityButton
              key={ability.id}
              ability={handCard ?? ability}
              isReady={isReady}
              isSelected={isReady && selectedCard?.instanceId === handCard?.instanceId}
              isDisabled={!isPlayerTurn}
              cooldown={cooldown}
              maxCooldown={maxCooldown}
              onSelect={onCardSelect}
            />
          )
        })}

      </div>

      {selectedCard && (
        <div className="ch-selected-info">
          {!selectedCard.isBasicAttack && (
            <>
              <div className="ch-selected-name">
                {selectedCard.name}
                {selectedCard.rarity > 0 && (
                  <span className={`ch-card-rarity ch-card-rarity--${selectedCard.rarity}`}>
                    {' '}{['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'][selectedCard.rarity]}
                  </span>
                )}
              </div>
              {selectedCard.descriptionText && (
                <div className="ch-selected-desc">
                  {renderDesc(selectedCard.descriptionText)}
                </div>
              )}
            </>
          )}
          <p className="ch-hint">
            {['row_wide', 'row2', 'front_2rows_wide', 'all_enemies', 'all_frozen', 'none'].includes(selectedCard.attackPattern)
              ? 'Tap anywhere on the grid to confirm'
              : selectedCard.attackPattern === 'single'
              ? 'Tap an enemy to target'
              : 'Tap the grid to select a target'
            }
          </p>
        </div>
      )}
    </div>
  )
}