import { useState, useEffect, useRef } from 'react'
import { usePlayer } from '../../context/PlayerContext'
import { formatCountdown, getSecondsUntilNextTradeWindow, getCurrentWindowIndex } from '../../utils/dates'
import TravelMap from './TravelMap'
import TravelForum from './TravelForum'
import './Travel.css'
import TownCard from './TownCard'
import { isTownUnlocked } from '../../utils/forumUtils'

const Travel = () => {
  const { uid, playerData, save } = usePlayer()
  const [showTree, setShowTree] = useState(false)
  const [tradeCountdown, setTradeCountdown] = useState(getSecondsUntilNextTradeWindow())

  //derive which towns are unlocked
  // const unlockedTowns = ['alnera', 'frostgate', 'mistport', 'steelmeld']
  //   .filter(townId => isTownUnlocked(townId, playerData))
  const unlockedTowns = ['alnera', 'frostgate', 'mistport', 'steelmeld']
    .filter(townId => playerData?.travel?.towns?.[townId]?.unlocked === true)

  //fetching trades
  const [tradesData, setTradesData] = useState(null) //{towns: {}, windowIndex}
  const [tradesLoading, setTradesLoading] = useState(false)
  const refreshTimeout = useRef(null)

  const fetchTrades = async () => {
    if (!uid) return
    setTradesLoading(true)
    try {
      const res = await fetch(`/api/trades/all?uid=${uid}`)
      const data = await res.json()
      if (!res.ok) { console.error(data.error); return }
      setTradesData(data)
      
      //schedule a refetch at the moment this trade window ends
      clearTimeout(refreshTimeout.current)
      refreshTimeout.current = setTimeout(() => {
        fetchTrades()
      }, data.nextWindowIn * 1000)

    } catch (err) {
      console.error('Failed to fetch trades:', err)
    } finally {
      setTradesLoading(false)
    }
  }

  //initial fetch
  useEffect(() => {
    fetchTrades()
    return () => clearTimeout(refreshTimeout.current)
  }, [uid])

  //another awesome useeffect
  //refetch on visibilty change if window has rolled over while player was away
  useEffect(() => {
    const handleVisibility = () => {
      if(document.visibilityState === 'visible' && tradesData?.windowIndex !== null) {
        if (getCurrentWindowIndex() !== tradesData.windowIndex) {
          fetchTrades()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [tradesData?.windowIndex])

  //countdown ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setTradeCountdown(getSecondsUntilNextTradeWindow())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  //callback for TownCard to update its slice of trades locally after an execution
  const updateTownTrades = (townId, updatedTrades, newReputation) => {
    setTradesData(prev => ({
      ...prev,
      towns: {
        ...prev.towns,
        [townId]: {
          ...prev.towns[townId],
          trades: updatedTrades,
          reputation: newReputation ?? prev.towns[townId].reputation
        }
      }
    }))
  }

  const handleDebugCurrencies = () => {
    save({
      'travel.forum.currencies': { crystals: 999, shards: 999, hearts: 999 }
    })
  }

  const handleDebugResetTree = () => {
    save({
      'travel.forum.upgrades': {},
      'travel.forum.currencies': { crystals: 0, shards: 0, hearts: 0 }
    })
  }

  const handleDebugResetTrades = () => {
    save({
      'travel.towns.alnera.tradeWindow': null
    })
  }

  const handleDebugResetShipments = () => {
    save({
      'travel.towns.alnera.lastShipment': null,
      'travel.towns.frostgate.lastShipment': null,
      'travel.towns.mistport.lastShipment': null,
      'travel.towns.steelmeld.lastShipment': null,
    })
  }

  return (
    <div className="travel-container">

      {/* <TravelMap /> */}
      <TravelForum/>
      {/* <ForumGame /> */}

      <button onClick={handleDebugCurrencies}>Debug: 999 currencies</button>
      <button onClick={handleDebugResetTree}>Debug: Reset tree</button>
      <button onClick={handleDebugResetTrades}>Debug: Reset trade window</button>
      <button onClick={handleDebugResetShipments}>Debug: Reset All Shipments</button>


      {unlockedTowns.length === 0 && (
        <p className="travel-section-caption" style={{ textAlign: 'center', marginTop: 8 }}>
          No trade routes unlocked yet.
        </p>
      )}

      {unlockedTowns.length !== 0 && (
        <div className="travel-section-header">
          <h2 className="travel-section-title">Towns</h2>
          <span className="travel-section-caption">Trades refresh in {formatCountdown(tradeCountdown)}</span>
        </div>
      )}

      {unlockedTowns.map(townId => (
        <TownCard
          key={townId}
          townId={townId}
          tradesData={tradesData?.towns?.[townId]}
          tradesLoading={tradesLoading}
          windowIndex={tradesData?.windowIndex}
          onTradeExecuted={updateTownTrades}
        />
      ))}
      {/* {['alnera', 'frostgate', 'mistport', 'steelmeld'].map(townId => (
        <TownCard
          key={townId}
          townId={townId}
          tradesData={tradesData?.towns?.[townId]}
          tradesLoading={tradesLoading}
          windowIndex={tradesData?.windowIndex}
          onTradeExecuted={updateTownTrades}
        />
      ))} */}
{/* 
      <TownCard townId="alnera" />
      <TownCard townId="frostgate" />
      <TownCard townId="mistport" />
      <TownCard townId="steelmeld" /> */}



    </div>
  )
}

export default Travel