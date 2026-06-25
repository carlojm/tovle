import { SUB_PHASES } from '../engine/combatReducer.js'
import './CardHand.css'

const DAMAGE_COLOR = {
  melee:      '#e07040',
  projectile: '#60a8e0',
  magic:      '#a060e0',
}

const CARD_TYPE_LABEL = {
  offense: 'Attack',
  utility: 'Utility',
  passive: 'Passive',
}

function Card({ card, selected, disabled, onSelect }) {
  const damageColor = DAMAGE_COLOR[card.damageType] ?? '#888'
  const isBasic = card.isBasicAttack

  return (
    <button
      className={[
        'ch-card',
        selected   ? 'ch-card--selected'  : '',
        disabled   ? 'ch-card--disabled'  : '',
        isBasic    ? 'ch-card--basic'     : '',
      ].join(' ')}
      onClick={() => onSelect(card)}
      disabled={disabled}
    >
      {/* damage type stripe */}
      <div className="ch-card-stripe" style={{ background: damageColor }} />

      <div className="ch-card-body">
        <span className="ch-card-name">{card.name}</span>
        {!isBasic && (
          <span className="ch-card-type" style={{ color: damageColor }}>
            {CARD_TYPE_LABEL[card.cardType] ?? card.cardType}
          </span>
        )}
        {card.rarity > 0 && (
          <span className={`ch-card-rarity ch-card-rarity--${card.rarity}`}>
            {['', 'Uc', 'R', 'E', 'L'][card.rarity]}
          </span>
        )}
      </div>
    </button>
  )
}

export default function CardHand({ hand, subPhase, selectedCard, onCardSelect }) {
  const isPlayerTurn = subPhase === SUB_PHASES.PLAYER_TURN
  const disabled = !isPlayerTurn

  if (hand.length === 0) {
    return (
      <div className="ch-container ch-container--empty">
        <span className="ch-empty-label">No cards in hand</span>
      </div>
    )
  }

  return (
    <div className="ch-container">
      <div className="ch-scroll">
        {hand.map(card => (
          <Card
            key={card.instanceId}
            card={card}
            selected={selectedCard?.instanceId === card.instanceId}
            disabled={disabled}
            onSelect={onCardSelect}
          />
        ))}
      </div>
      {selectedCard && (
        <p className="ch-hint">
          {['row_wide', 'row2'].includes(selectedCard.attackPattern)
            ? 'Tap anywhere on the grid to confirm'
            : selectedCard.attackPattern === 'single'
            ? 'Tap an enemy to target'
            : `Tap the grid to select a ${selectedCard.attackPattern}`
          }
        </p>
      )}
    </div>
  )
}