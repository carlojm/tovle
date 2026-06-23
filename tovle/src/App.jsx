import { useState, useEffect, useRef } from 'react'
import { usePlayer } from "./context/PlayerContext"
import './App.css'

import Navbar from './components/Navbar'
import Toggle from './components/Toggle'

import PlayTab from './components/Playtab'
import Caches from './components/Caches'
import Info from './components/Info'
import DataTab from './components/DataTab'
import Travel from './components/travel/Travel.jsx'
import Collection from './components/Collection.jsx'
import Depthsle from './depthsle/Depthsle.jsx'

import { IMAGE_BASE_URL_STANDARD, IMAGE_BASE_URL_CUSTOM } from './data/constants.js'

import DepthsleDevConsole from './depthsle/DepthsleDevConsole.jsx'

const IS_DEPTHSLE_DEV = new URLSearchParams(window.location.search).get('dev') === '1'
  || localStorage.getItem('depthsle_dev') === '1'

const TABS = [
  { id: 'play',   label: 'Play' },
  { id: 'caches', label: 'Caches' },
  { id: 'info',   label: 'Info' },
  { id: 'data',   label: 'Data' },
  { id: 'collection',   label: 'Collection' },
  { id: 'depthsle',   label: 'Depthsle' },
]

const App = () => {
  const { uid, playerData, save, ready } = usePlayer()

  const [dailyCaches, setDailyCaches] = useState([])
  const [gameDate, setGameDate] = useState(null) //current date according to api/daily fetch
  const [currentCacheIndex, setCurrentCacheIndex] = useState(0) //0-3
  const [cacheResults, setCacheResults] = useState([]) //accumulates each completed cache for end summary
  const [allComplete, setAllComplete] = useState(false) //flips to true when all 4 caches done
  const [delvePoints, setDelvePoints] = useState({})

  const DELVE_COLORS = ['red', 'blue', 'green', 'purple', 'orange', 'cyan', 'yellow']
  const [delveColor, setDelveColor] = useState(() => 
    DELVE_COLORS[Math.floor(Math.random() * DELVE_COLORS.length)]
  )

  const [guessHistory, setGuessHistory] = useState([])
  const [numGuesses, setNumGuesses] = useState(0)
  const [hasWon, setHasWon] = useState(false)

  const [todayStats, setTodayStats] = useState(null)

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  const [activeTab, setActiveTab] = useState('play')

  //this ref used in submitguess
  //to tell map to zoom in on the cache after it is found
  const mapRef = useRef(null)

  //instead of state, these vars are now derived from dailyCaches[currentCacheIndex]
  const currentCache = dailyCaches[currentCacheIndex] ?? null
  const cacheImage = currentCache
    ? currentCache.id > 1000
      ? `${IMAGE_BASE_URL_CUSTOM}/${currentCache.id}.webp`
      : `${IMAGE_BASE_URL_STANDARD}/${String(currentCache.id).padStart(3, '0')}.webp`
    : null
  const correctCoords = currentCache?.coordinates ?? null

  const hasTravel = playerData?.upgrades?.unlockTravel ?? false
  const activeTabs = TABS.map(tab =>
    tab.id === 'info' && hasTravel
      ? { id: 'travel', label: 'Travel' }
      : tab
  )

  useEffect(() => {
    //dont run effect until firebase finishing loading player data
    if (!ready || !playerData) return

    fetch('/api/daily').then(res => res.json()).then(data => {
      setDailyCaches(data.caches)
      setGameDate(data.date)
      const todayStr = data.date //use date from server

      // == streak break detection =========================
      const yesterday = new Date(todayStr + 'T12:00:00')
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

      const lastPlayed = playerData?.stats?.lastPlayedDate
      const currentStreak = playerData?.stats?.currentStreak ?? 0
      const alreadyFlagged = (playerData?.upgrades?.unlocked ?? []).includes('streakRedeemable')

      const missedDay = new Date(lastPlayed + 'T12:00:00')
      missedDay.setDate(missedDay.getDate() + 1)
      const streakBrokeDate = missedDay.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

      if (
        lastPlayed &&
        lastPlayed !== todayStr &&
        lastPlayed !== yesterdayStr &&
        currentStreak > 0 &&
        !alreadyFlagged
      ) {
        save({
          stats: {
            ...playerData.stats,
            currentStreak: 0,
            previousStreak: currentStreak,
            streakBrokeDate: streakBrokeDate,
          },
          upgrades: {
            ...playerData.upgrades,
            unlocked: [...(playerData.upgrades?.unlocked ?? []), 'streakRedeemable'],
            streakRestore: 0,
          }
        })
      }
      // ==================

      //the following lines handle game state storage.
      //if the player has played today, we reload their data from where they left off.
      //prevents stuff like save scumming for example, or losing data from a page refresh
      const savedToday = playerData.today
      const todayCacheIds = new Set(data.caches.map(c => c.id))

      //does the saved date actually match today's date?
      const savedMatchesToday =
        savedToday?.date === todayStr &&
        savedToday.caches?.length > 0 &&
        savedToday.caches.every(c => todayCacheIds.has(c.cacheId)) //check cache ids

      if (savedMatchesToday) {

        //edge case: cache is solved but hasnt pressed "next cache" and reloads the page
        //use a third state 'advanced' to track if next button was pressed.

        const savedCaches = savedToday.caches

        //check if game is truly complete:
        //-all saved caches are marked advanced (not just solved, but advanced=moved to next page)
        //-the number of saved caches is the same as number of daily caches (usually 4)
        const allDone = savedCaches.length === data.caches.length &&
          savedCaches.every(c => c.status === 'advanced')

        if (allDone) {
          setCacheResults(savedCaches)
          setCurrentCacheIndex(data.caches.length - 1)
          setAllComplete(true)
          setTodayStats(playerData?.stats ?? null)
          return
        }

        //at this point we know game isnt fully complete
        //restore partial game state
        const lastCache = savedCaches[savedCaches.length - 1]
        const lastIsSolvedButNotAdvanced = lastCache?.status === 'solved'

        //advanced means solved AND next cache button pressed
        //solved means solved but still on this cache.
        //this will fix problems with refreshing after solving a cache in the middle of the game.

        //completed caches = all except the last one, if last is in progress
        const completedCaches = lastIsSolvedButNotAdvanced
          ? savedCaches.slice(0, -1)  //exclude the last solved-but-not-advanced cache
          : savedCaches.filter(c => c.status === 'advanced')

        //restore game state if in progress
        setCacheResults(completedCaches)
        setCurrentCacheIndex(completedCaches.length)

        if (lastIsSolvedButNotAdvanced) {
          //player solved this cache but hasn't pressed Next Cache yet
          //restore their guess history and won state
          setGuessHistory(lastCache?.guesses ?? [])
          setNumGuesses(lastCache?.guesses?.length ?? 0)
          setHasWon(true)
        } else {
          // player is mid-cache with guesses, or on a fresh cache
          if (lastCache?.guesses?.length > 0) {
            // restore mid-cache guesses
            setGuessHistory(lastCache.guesses)
            setNumGuesses(lastCache.guesses.length)
          } else {
            // truly fresh cache
            setGuessHistory([])
            setNumGuesses(0)
          }
          setHasWon(false)
        }

        //restore delve points too
        if (savedToday?.delvePoints) {
          setDelvePoints(savedToday.delvePoints)
        } else {
          setDelvePoints(playerData.upgrades?.delveDefaults ?? {})
        }
      } else {
        //apply default delve points
        setDelvePoints(playerData.upgrades?.delveDefaults ?? {})
      }
    }).catch(err => console.error('Failed to fetch daily caches:', err))

    // console.log(playerData?.today)

  }, [ready])

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
  }, [theme])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
  }

  const calculateUpdatedStats = (currentStats, currentUpgrades, results) => {
    const todayStr = gameDate
    const yesterday = new Date(todayStr + 'T12:00:00')
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const lastPlayed = currentStats?.lastPlayedDate ?? null
    const currentStreak = currentStats?.currentStreak ?? 0
    const bestStreak = currentStats?.bestStreak ?? 0

    // streak logic
    let newStreak
    if (lastPlayed === yesterdayStr) {
      newStreak = currentStreak + 1
    } else if (lastPlayed === todayStr) {
      newStreak = currentStreak // already updated today, don't double count
    } else {
      newStreak = 1 // starting fresh
    }

    // remove streakRedeemable flag if streak is continuing
    const currentUnlocked = currentUpgrades?.unlocked ?? []
    let updatedUnlocked = newStreak > 1
      ? currentUnlocked.filter(f => f !== 'streakRedeemable')
      : [...currentUnlocked]

    const newBestStreak = Math.max(bestStreak, newStreak)

    // guess distribution
    const distribution = { ...(currentStats?.guessDistribution ?? {}) }
    let totalNewGuesses = 0
    for (const result of results) {
      const bucket = result.guessCount >= 10 ? '10+' : String(result.guessCount)
      distribution[bucket] = (distribution[bucket] ?? 0) + 1
      totalNewGuesses += result.guessCount
    }

    // average guesses
    const prevTotalSolved = currentStats?.totalCachesSolved ?? 0
    const prevTotalGuesses = Math.round((currentStats?.averageGuesses ?? 0) * prevTotalSolved)
    const newTotalSolved = prevTotalSolved + results.length
    const newAverageGuesses = newTotalSolved === 0 ? 0
      : Math.round(((prevTotalGuesses + totalNewGuesses) / newTotalSolved) * 10) / 10

    return {
      stats: {
        currentStreak: newStreak,
        bestStreak: newBestStreak,
        totalCachesSolved: newTotalSolved,
        totalDaysPlayed: (currentStats?.totalDaysPlayed ?? 0) + 1,
        lastPlayedDate: todayStr,
        guessDistribution: distribution,
        averageGuesses: newAverageGuesses,
        ...(newStreak > 1 && {
          previousStreak: null,
          streakBrokeDate: null,
        }),
      },
      upgrades: {
        ...currentUpgrades,
        unlocked: updatedUnlocked,
        ...(newStreak > 1 && { streakRestore: 0 }),
      }
    }
  }

  const calculateScore = (guessCount, delvePointsTotal = 0, streak = 0) => {
    const baseScore = (() => {
      if (guessCount === 1) return 100
      if (guessCount === 2) return 85
      if (guessCount === 3) return 70
      if (guessCount === 4) return 55
      if (guessCount === 5) return 40
      return 25 //score of 25 equates to 95% luck
    })()

    const delveMultiplier = 1 + (delvePointsTotal * 0.15) //10pts = 2.5x score

    const streakBonus = streak <= 10
      ? streak * 5 //5 each day for ten days
      : 50 + (streak - 10) //1 each day after ten days

    return Math.round(baseScore * delveMultiplier + streakBonus)
  }

  //advancing the game
  const handleNextCache = () => {

    const savedCacheEntry = playerData?.today?.caches?.find(c => c.cacheId === currentCache.id)

    const currentResult = {
      cacheId: currentCache.id,
      status: 'advanced', //advanced = solved AND next cache button pressed
      guesses: guessHistory,
      guessCount: numGuesses,
      score: calculateScore(
        numGuesses,
        savedCacheEntry?.delvePointsTotal ?? 0,
        playerData?.stats?.currentStreak ?? 0,
      ),
      delvePointsTotal: savedCacheEntry?.delvePointsTotal ?? 0,
      delvePointsSnapshot: savedCacheEntry?.delvePointsSnapshot ?? {},
    }

    const updatedResults = [...cacheResults, currentResult]
    setCacheResults(updatedResults)

    const todayStr = gameDate
    const newUnopenedCache = {
      cacheId: currentCache.id,
      date: todayStr,
      guessCount: numGuesses,
      score: calculateScore(
        numGuesses,
        savedCacheEntry?.delvePointsTotal ?? 0,
        playerData?.stats?.currentStreak ?? 0,
      ),
      delvePointsTotal: savedCacheEntry?.delvePointsTotal ?? 0,
      delvePointsSnapshot: savedCacheEntry?.delvePointsSnapshot ?? {},
    }

    //prevent player from refreshing and claiming a cache again
    const existingUnopenedCaches = playerData.inventory?.unopenedCaches ?? []
    const existingOpenedCaches = playerData.inventory?.openedCaches ?? []
    const alreadyAdded = existingUnopenedCaches.some(
      c => c.cacheId === currentCache.id && c.date === todayStr
    )
    const alreadyOpened = existingOpenedCaches.some(
      c => c.cacheId === currentCache.id && c.date === todayStr
    )

    save({
      today: {
        date: todayStr,
        caches: updatedResults,
        delvePoints: playerData?.today?.delvePoints ?? {},
      },
      inventory: {
        ...playerData.inventory,
        unopenedCaches: (alreadyAdded || alreadyOpened)
          ? existingUnopenedCaches
          : [...existingUnopenedCaches, newUnopenedCache],
      }
    })

    setCurrentCacheIndex(prev => prev + 1)
    setGuessHistory([])
    setNumGuesses(0)
    setHasWon(false)
    mapRef.current?.resetView()

    //get a new color for delve mods that need color
    setDelveColor(DELVE_COLORS[Math.floor(Math.random() * DELVE_COLORS.length)])
  }

  //ending the game
  const handleComplete = () => {
    if (allComplete) return

    const todayStr = gameDate
    //edge case fix: if the game was started on a different day, don't complete it
    const savedDate = playerData?.today?.date
    if (savedDate && savedDate !== todayStr) {
      console.warn('Attempted to complete a game from a previous day, ignoring.')
      setAllComplete(true) //show completion screen but don't save stats
      return
    }

    const savedCacheEntry = playerData?.today?.caches?.find(c => c.cacheId === currentCache.id)

    const currentResult = {
      cacheId: currentCache.id,
      status: 'advanced',
      guesses: guessHistory,
      guessCount: numGuesses,
      score: calculateScore(
        numGuesses,
        savedCacheEntry?.delvePointsTotal ?? 0,
        playerData?.stats?.currentStreak ?? 0,
      ),
      delvePointsTotal: savedCacheEntry?.delvePointsTotal ?? 0,
      delvePointsSnapshot: savedCacheEntry?.delvePointsSnapshot ?? {},
    }

    const updatedResults = [...cacheResults, currentResult]
    setCacheResults(updatedResults)

    const updatedStats = calculateUpdatedStats(playerData?.stats, playerData?.upgrades, updatedResults)
    setTodayStats(updatedStats.stats) //save to display in results screen

    const newUnopenedCache = {
      cacheId: currentCache.id,
      date: todayStr,
      guessCount: numGuesses,
      score: calculateScore(
        numGuesses,
        savedCacheEntry?.delvePointsTotal ?? 0,
        playerData?.stats?.currentStreak ?? 0,
      ),
      delvePointsTotal: savedCacheEntry?.delvePointsTotal ?? 0,
      delvePointsSnapshot: savedCacheEntry?.delvePointsSnapshot ?? {},
    }

    save({
      today: {
        date: todayStr,
        caches: updatedResults,
        delvePoints: playerData?.today?.delvePoints ?? {},
      },
      inventory: {
        ...playerData.inventory,
        unopenedCaches: [...(playerData.inventory?.unopenedCaches ?? []), newUnopenedCache],
      },
      stats: {
        ...playerData.stats,   //preserve all existing fields including totalCachesOpened etc.
        ...updatedStats.stats, //override with freshly calculated fields
      },
      upgrades: updatedStats.upgrades,
    })

    setAllComplete(true)
  }

  if (!ready) return null

  if (IS_DEPTHSLE_DEV) return <DepthsleDevConsole />

  return (
    <div className="full-container">
      <div className="app-container">
        <Navbar theme={theme} onToggleTheme={toggleTheme} onNavigate={setActiveTab}/>
        <Toggle tabs={activeTabs.slice(0,3)} activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'play' && (
          <PlayTab
            // cache data
            dailyCaches={dailyCaches}
            gameDate={gameDate}
            currentCacheIndex={currentCacheIndex}
            currentCache={currentCache}
            cacheImage={cacheImage}
            correctCoords={correctCoords}
            // game state
            guessHistory={guessHistory}
            setGuessHistory={setGuessHistory}
            numGuesses={numGuesses}
            setNumGuesses={setNumGuesses}
            hasWon={hasWon}
            setHasWon={setHasWon}
            allComplete={allComplete}
            cacheResults={cacheResults}
            todayStats={todayStats}
            delvePoints={delvePoints}
            setDelvePoints={setDelvePoints}
            delveColor={delveColor}
            // handlers from App
            handleNextCache={handleNextCache}
            handleComplete={handleComplete}
            setActiveTab={setActiveTab}
            // upgrades
            distancePrecision={playerData?.upgrades?.distancePrecision ?? 0}
            directionArrows={playerData?.upgrades?.directionArrows ?? 0}
            // refs and save
            mapRef={mapRef}
            save={save}
            playerData={playerData}
          />
        )}
        {activeTab === 'caches' && <Caches />}
        {activeTab === 'info' && <Info onNavigate={setActiveTab} />}
        {activeTab === 'travel' && <Travel onEnterDungeon={() => setActiveTab('depthsle')} />}
        {activeTab === 'data' && <DataTab />}
        {activeTab === 'collection' && <Collection />}
        {activeTab === 'depthsle' && <Depthsle />}

      </div>
    </div>
  )
}

export default App