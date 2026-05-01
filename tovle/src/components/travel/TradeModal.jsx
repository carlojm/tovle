import { ITEM_MAP } from '../../data/itemMap'
import { formatCountdown } from '../../utils/dates'
import './TownCard.css'
import './TradeModal.css'
import { usePlayer } from '../../context/PlayerContext'

const TradeModal = ({ trade, tradeIndex, config, nextWindowIn, onClose, onExecute }) => {
  if (!trade) return null

  const { playerData } = usePlayer()
  const playerQty = playerData?.inventory?.items?.find(i => i.itemId === trade.want.itemId)?.quantity ?? 0
  const canAfford = playerQty >= trade.want.quantity

  return (
    <div className="town-backdrop" onClick={onClose}>
      <div className="town-modal" onClick={e => e.stopPropagation()}>

        <div className="town-modal-header">
          <h2>Trade with {config.name}</h2>
          <button className="town-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="town-modal-body">
          <div className="town-modal-trade">

            <div className="town-modal-side">
              <span className="town-modal-side-label">You give</span>
              <div className="town-modal-item">
                <img
                  src={ITEM_MAP[trade.want.itemId]?.img}
                  className="town-modal-item-icon"
                  style={{ imageRendering: 'pixelated' }}
                />
                <span className="town-modal-item-qty">{trade.want.quantity}×</span>
                <span className="town-modal-item-name">{trade.want.itemId.replace(/_/g, ' ')}</span>
              </div>
            </div>

            <span className="town-modal-arrow">→</span>

            <div className="town-modal-side">
              <span className="town-modal-side-label">You receive</span>
              {trade.offer.items.map((item, i) => (
                <div key={i} className="town-modal-item">
                  <img
                    src={ITEM_MAP[item.itemId]?.img}
                    className="town-modal-item-icon"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <span className="town-modal-item-qty">{item.quantity}×</span>
                  <span className="town-modal-item-name">{item.itemId.replace(/_/g, ' ')}</span>
                </div>
              ))}
              <div className="town-modal-item">
                <span className="town-modal-item-qty">{trade.offer.reputation}</span>
                <span className="town-modal-item-name">reputation</span>
              </div>
            </div>

          </div>

          <div className="town-modal-info">
            <p className="town-modal-info-line">
              Performed {trade.timesCompleted} / {trade.limit} times this cycle
            </p>
            {/* <p className="town-modal-info-line">
              Quantity multiplied by {trade.want.multiplier.toFixed(2)}x
            </p> */}
            {/* <p className="town-modal-info-line">
              Quantity multiplier: {trade.want.multiplier.toFixed(2)}x
              {trade.want.multiplier >= 4 && <span style={{ color: '#ff9f43', marginLeft: 6 }}>Incredible deal!</span>}
              {trade.want.multiplier >= 3 && trade.want.multiplier < 4 && <span style={{ color: '#4caf82', marginLeft: 6 }}>Great deal!</span>}
              {trade.want.multiplier >= 2 && trade.want.multiplier < 3 && <span style={{ color: '#4caf82', marginLeft: 6 }}>Good deal!</span>}
            </p> */}
            {trade.want.multiplier >= 2 && (
              <p className="town-modal-info-line">
                Your rep increased this trade's quantity by ~{trade.want.multiplier.toFixed(1)}x
              </p>
            )}
            <p className="town-modal-info-line">
              Trades refresh in {formatCountdown(nextWindowIn)}
            </p>
          </div>
        </div>

        <div className="town-modal-footer">
          <button className="town-footer-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`town-footer-btn town-footer-btn--primary ${!trade.canTrade ? 'town-footer-btn--disabled' : ''}`}
            onClick={() => onExecute(trade, tradeIndex)}
            disabled={!trade.canTrade || !canAfford}
          >
            Trade
          </button>
        </div>

      </div>
    </div>
  )
}

export default TradeModal