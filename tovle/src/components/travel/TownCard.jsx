// src/components/travel/TownCard.jsx
import { useState, useEffect } from 'react'
import { usePlayer } from '../../context/PlayerContext'
import { ITEM_MAP } from '../../data/itemMap'
import { TOWN_CONFIG } from '../../data/townConfig'
import './TownCard.css'
import TradeModal from './TradeModal'

import { getTownLevel, getRepForNextLevel } from '../../utils/townUtils'

const TownCard = ({ townId, children }) => {
  const { uid, playerData } = usePlayer()
  const config = TOWN_CONFIG[townId]

  //town data from firestore
  const townData = playerData?.travel?.towns?.[townId] ?? {}
  const reputation = townData.reputation ?? 0
  const townLevel = getTownLevel(reputation)

  //trade logic
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(false)
  const [windowIndex, setWindowIndex] = useState(null)
  const [nextWindowIn, setNextWindowIn] = useState(null)
  const [selectedTrade, setSelectedTrade] = useState(null)

  const fetchTrades = async () => {
    if (!uid) return
    setLoading(true)
    try {
      const res = await fetch(`/api/trades/${townId}?uid=${uid}`)
      const data = await res.json()
      if (!res.ok) { console.error(data.error); return }
      setTrades(data.trades)
      setWindowIndex(data.windowIndex)
      setNextWindowIn(data.nextWindowIn)
    } catch (err) {
      console.error('Failed to fetch trades:', err)
    } finally {
      setLoading(false)
    }
  }

  //awesome useeffect
  useEffect(() => { fetchTrades() }, [uid])

  //reload trades every 4 hours
  const [refreshNotice, setRefreshNotice] = useState(false)
  //another awesome useeffect
  useEffect(() => {
    if (nextWindowIn === null) return

    const interval = setInterval(() => {
      setNextWindowIn(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          // close modal and refetch
          setSelectedTrade(null)
          setRefreshNotice(true)
          fetchTrades().then(() => {
            setTimeout(() => setRefreshNotice(false), 3000)
          })
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [nextWindowIn === null ? null : 'active'])

  const handleExecuteTrade = async () => {
    console.log('execute trade', selectedTrade)
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

          <div className="town-trades-row">
            {loading ? (
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
                  <span className="town-trade-qty">{trade.offer.reputation} rep</span>
                  <span className="town-trade-arrow">+</span>
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
          </div>

        </div>
      </div>

      {children}


      <TradeModal
        trade={selectedTrade?.trade}
        tradeIndex={selectedTrade?.index}
        config={config}
        nextWindowIn={nextWindowIn}
        onClose={() => setSelectedTrade(null)}
        onExecute={handleExecuteTrade}
      />
    </div>
  )
}

export default TownCard