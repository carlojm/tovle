// src/components/travel/TownCard.jsx
import { useState } from 'react'
import { usePlayer } from '../../context/PlayerContext'
import { ITEM_MAP } from '../../data/itemMap'
import { TOWN_CONFIG } from '../../data/townConfig'
import './TownCard.css'
import TradeModal from './TradeModal'

import { getTownLevel, getRepForNextLevel } from '../../utils/townUtils'
import { getEasternDateStr } from '../../utils/dates'

const TownCard = ({ townId, tradesData, tradesLoading, windowIndex, onTradeExecuted, children }) => {
  const { uid, playerData, save } = usePlayer()
  const config = TOWN_CONFIG[townId]

  //town data from firestore
  const townData = playerData?.travel?.towns?.[townId] ?? {}
  const alreadyCollected = (townData?.lastShipment ?? null) === getEasternDateStr()
  const reputation = tradesData?.reputation ?? townData.reputation ?? 0
  const townLevel = getTownLevel(reputation)

  //comes from parent
  const trades = tradesData?.trades ?? []

  //ui state
  const [selectedTrade, setSelectedTrade] = useState(null)
  const [refreshNotice, setRefreshNotice] = useState(false)

  const handleExecuteTrade = async (trade, tradeIndex) => {
    console.log('execute trade', selectedTrade)

    try {
      const res = await fetch('/api/execute-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid,
          townId,
          tradeIndex,
          windowIndex,
          executionNumber: trade.timesCompleted
        })
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.windowExpired) {
          setSelectedTrade(null)
          setRefreshNotice(true)
          setTimeout(() => setRefreshNotice(false), 3000)
        } else if (data.alreadyExecuted) {
          console.warn('Trade already executed')
        } else {
          console.error(data.error)
        }
        return
      }

      //update trades locally dont need to fetch again
      const newTimesCompleted = trade.timesCompleted + 1
      const updatedTrades = trades.map((t,i) => {
        if (i !== tradeIndex) return t
        return {
          ...t,
          timesCompleted: newTimesCompleted,
          canTrade: newTimesCompleted < t.limit
        }
      })

      //tell parent (Travel) to update its state
      onTradeExecuted(townId, updatedTrades, data.reputation)

      //close modal if limit reached, otherwise update selected trade
      if (newTimesCompleted >= trade.limit) {
        setSelectedTrade(null)
      } else {
        setSelectedTrade(prev => ({
          ...prev,
          trade: {
            ...prev.trade,
            timesCompleted: newTimesCompleted,
            canTrade: newTimesCompleted < trade.limit
          }
        }))
      }

      //finally, update inventory ===

      // deduct items locally to match what the server did
      const updatedItems = (playerData?.inventory?.items ?? []).map(item => {
        if (item.itemId !== trade.want.itemId) return item
        return { ...item, quantity: item.quantity - trade.want.quantity }
      }).filter(item => item.quantity > 0)

      // add offered items locally
      const itemsWithOffers = [...updatedItems]
      for (const offered of trade.offer.items) {
        const existing = itemsWithOffers.find(i => i.itemId === offered.itemId)
        if (existing) {
          existing.quantity += offered.quantity
        } else {
          itemsWithOffers.push({ itemId: offered.itemId, quantity: offered.quantity })
        }
      }

      //local update the inventory since we already update firebase on the serverside
      save({
        inventory: {
          ...playerData?.inventory,
          items: itemsWithOffers
        }
      }, { localOnly: true })

    } catch (err) {
      console.error('Failed to execute trade:', err)
    }
  }

  const handleCollectShipment = () => {
    console.log('collect shipment', townId)
  }


  if (!config) return null

  return (
    <div className="town-card">
      <div className="town-header">
        <div className="town-icon-wrap">
          <img src={config.image} alt={config.name} className="town-icon" />
        </div>

        <div className="town-header-info">
          <div className="town-name-row">
            <span className="town-name">{config.name}</span>
            <span className="town-level">level {townLevel}</span>
            <span className="town-coords">x: {config.coordinates.x}, z: {config.coordinates.z}</span>
          </div>
          <p className="town-description">{config.description}</p>
          <div className="town-rep-row">
            <span className="town-label">Reputation</span>
            <div className="town-rep-track">
              <div
                className="town-rep-fill"
                style={{ width: `${Math.min((reputation / getRepForNextLevel(reputation)) * 100, 100)}%` }}
              />
            </div>
            <span className="town-rep-num">{reputation} / {getRepForNextLevel(reputation)}</span>
          </div>

          {refreshNotice && (
            <p className="town-refresh-notice">Trades have refreshed!</p>
          )}

        </div>
      </div>

      <div className="town-trades-row">
        {tradesLoading ? (
          <p className="town-label">Loading trades...</p>
        ) : trades.map((trade, i) => (
          <button
            key={i}
            className="town-trade-slot"
            onClick={() => setSelectedTrade({ trade, index: i })}
          >
            <div className="town-trade-want">
              <img
                src={ITEM_MAP[trade.want.itemId]?.img}
                className="town-trade-icon"
                style={{ imageRendering: 'pixelated' }}
              />
              <span className="town-trade-qty">{trade.want.quantity}</span>
            </div>
            <span className="town-trade-arrow">→</span>
            <div className="town-trade-offer">
              {trade.offer.items[0] ? (
                <div>
                <span className="town-trade-qty">{trade.offer.reputation} rep</span>
                <span className="town-trade-arrow"> +</span>
                </div>
              ) : (
                <span className="town-trade-qty">{trade.offer.reputation} rep</span>
              )}
              {/* <span className="town-trade-qty">{trade.offer.reputation} rep +</span> */}
              {/* <span className="town-trade-arrow">+</span> */}
              {trade.offer.items.length > 0 && (
                <>
                  <img
                    src={ITEM_MAP[trade.offer.items[0].itemId]?.img}
                    className="town-trade-icon"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <span className="town-trade-qty">{trade.offer.items[0].quantity}</span>
                </>
              )}
              
            </div>
            {!trade.canTrade && (
              <span className="town-trade-done">✓</span>
            )}
          </button>
        ))}

        {(() => {
          const nextSlotLevel = trades.length * 3 - 3
          return (
            <button className="town-trade-slot town-trade-slot--locked" disabled>
              <span className="town-trade-locked-label">Next slot at level {nextSlotLevel}</span>
            </button>
          )
        })()}
      </div>

      {children}

      <button
        className={`upgrade-button ${alreadyCollected ? 'disable-button' : ''}`}
        onClick={handleCollectShipment}
      >
        {alreadyCollected ? 'Shipment collected today' : "Collect today's shipment"}
      </button>


      <TradeModal
        trade={selectedTrade?.trade}
        tradeIndex={selectedTrade?.index}
        config={config}
        // nextWindowIn={nextWindowIn}
        onClose={() => setSelectedTrade(null)}
        onExecute={handleExecuteTrade}
      />
    </div>
  )
}

export default TownCard