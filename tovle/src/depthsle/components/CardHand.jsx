import { SUB_PHASES } from '../engine/combatReducer.js'
import './CardHand.css'

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

function AbilityButton({ ability, isReady, isSelected, isDisabled, cooldown, maxCooldown, onSelect }) {
  const damageColor = DAMAGE_COLOR[ability.damageType] ?? '#888'

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
      <div className="ch-card-stripe" style={{ background: damageColor }} />
      <div className="ch-card-body">
        <span className="ch-card-name">{ability.name}</span>
        {ability.rarity > 0 && (
          <span className={`ch-card-rarity ch-card-rarity--${ability.rarity}`}>
            {['', 'Uc', 'R', 'E', 'L'][ability.rarity]}
          </span>
        )}
        {!isReady && (
          <span className="ch-card-cd-label">
            {Math.ceil(cooldown)}
          </span>
        )}
      </div>
      <CooldownBar current={cooldown} max={maxCooldown} />
    </button>
  )
}

function BasicAttackCard({ card, isSelected, isDisabled, onSelect }) {
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
      <div className="ch-card-stripe" style={{ background: '#888' }} />
      <div className="ch-card-body">
        <span className="ch-card-name">{card.name}</span>
        <span className="ch-card-type" style={{ color: '#888' }}>Basic</span>
      </div>
    </button>
  )
}

export default function CardHand({ hand, abilities, abilityCooldowns, subPhase, selectedCard, onCardSelect }) {
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
        <p className="ch-hint">
          {['row_wide', 'row2', 'front_2rows_wide', 'all_enemies', 'all_frozen', 'none'].includes(selectedCard.attackPattern)
            ? 'Tap anywhere on the grid to confirm'
            : selectedCard.attackPattern === 'single'
            ? 'Tap an enemy to target'
            : `Tap the grid to select a target`
          }
        </p>
      )}
    </div>
  )
}