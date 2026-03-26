import { useState, useEffect, useRef } from 'react'
import { usePlayer } from "./context/PlayerContext"
import './App.css'

import Navbar from './components/Navbar'
import Toggle from './components/Toggle'

import PlayTab from './components/Playtab'
import Caches from './components/Caches'
import Info from './components/Info'

const IMAGE_BASE_URL_STANDARD = 'https://images.tovle.net/standard'
const IMAGE_BASE_URL_CUSTOM = 'https://images.tovle.net/custom'

const TABS = [
  { id: 'play',   label: 'Play' },
  { id: 'caches', label: 'Caches' },
  { id: 'info',   label: 'Info' },
]

const App = () => {
  const { uid, playerData, save, ready } = usePlayer()

  const [dailyCaches, setDailyCaches] = useState([])
  const [currentCacheIndex, setCurrentCacheIndex] = useState(0) //0-3
  const [cacheResults, setCacheResults] = useState([]) //accumulates each completed cache for end summary
  const [allComplete, setAllComplete] = useState(false) //flips to true when all 4 caches done
  const [delvePoints, setDelvePoints] = useState({})

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

  useEffect(() => {
    //dont run effect until firebase finishing loading player data
    if (!ready || !playerData) return

    fetch('/api/daily').then(res => res.json()).then(data => {
      setDailyCaches(data.caches)

      //the following lines handle game state storage.
      //if the player has played today, we reload their data from where they left off.
      //prevents stuff like save scumming for example, or losing data from a page refresh
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
      const savedToday = playerData.today

      if (savedToday?.date === todayStr && savedToday.caches?.length > 0) {

        //edge case: cache is solved but hasnt pressed "next cache" and reloads the page
        //fixed now
        //the solution is to always go back to the last "win" screen if the saved data says
        //the last cache the player interacted with was solved but wasn't the final cache.
        //aka if the player's last interacted with cache is cache 1/4, and they havent
        //made any guesses on 2/4, and we're reloading game state, jump back to 1/4's result screen.
        //ok that actually didnt work either it caused other problems
        //the solution is to use a third state 'advanced' to track if next button was pressed.

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
        }
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

  //cache score based on guess count.
  //score of 25 equates to 95% luck
  const calculateScore = (guessCount) => {
    if (guessCount === 1) return 100
    if (guessCount === 2) return 85
    if (guessCount === 3) return 70
    if (guessCount === 4) return 55
    if (guessCount === 5) return 40
    return 25
  }

  const calculateUpdatedStats = (currentStats, results) => {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

    const lastPlayed = currentStats?.lastPlayedDate ?? null
    const currentStreak = currentStats?.currentStreak ?? 0
    const bestStreak = currentStats?.bestStreak ?? 0

    //streak logic
    let newStreak
    if (lastPlayed === yesterdayStr) {
      newStreak = currentStreak + 1
    } else if (lastPlayed === todayStr) {
      newStreak = currentStreak //already updated today, don't double count
    } else {
      newStreak = 1 //streak broken, start fresh
    }

    const newBestStreak = Math.max(bestStreak, newStreak)

    //guess distribution
    const distribution = { ...(currentStats?.guessDistribution ?? {}) }
    let totalNewGuesses = 0
    for (const result of results) {
      const bucket = result.guessCount >= 10 ? '10+' : String(result.guessCount)
      distribution[bucket] = (distribution[bucket] ?? 0) + 1
      totalNewGuesses += result.guessCount
    }

    //average guesses
    const prevTotalSolved = currentStats?.totalCachesSolved ?? 0
    const prevTotalGuesses = Math.round((currentStats?.averageGuesses ?? 0) * prevTotalSolved)
    const newTotalSolved = prevTotalSolved + results.length
    const newAverageGuesses = newTotalSolved === 0 ? 0 :
      Math.round(((prevTotalGuesses + totalNewGuesses) / newTotalSolved) * 10) / 10

    return {
      currentStreak: newStreak,
      bestStreak: newBestStreak,
      totalCachesSolved: newTotalSolved,
      totalDaysPlayed: (currentStats?.totalDaysPlayed ?? 0) + 1,
      lastPlayedDate: todayStr,
      guessDistribution: distribution,
      averageGuesses: newAverageGuesses,
    }
  }

  //advancing the game
  const handleNextCache = () => {

    const savedCacheEntry = playerData?.today?.caches?.find(c => c.cacheId === currentCache.id)

    const currentResult = {
      cacheId: currentCache.id,
      status: 'advanced', //advanced = solved AND next cache button pressed
      guesses: guessHistory,
      guessCount: numGuesses,
      score: calculateScore(numGuesses),
      delvePointsTotal: savedCacheEntry?.delvePointsTotal ?? 0,
      delvePointsSnapshot: savedCacheEntry?.delvePointsSnapshot ?? {},
    }

    const updatedResults = [...cacheResults, currentResult]
    setCacheResults(updatedResults)

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const newUnopenedCache = {
      cacheId: currentCache.id,
      date: todayStr,
      guessCount: numGuesses,
      score: calculateScore(numGuesses),
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
  }

  //ending the game
  const handleComplete = () => {
    if (allComplete) return

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
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
      score: calculateScore(numGuesses),
      delvePointsTotal: savedCacheEntry?.delvePointsTotal ?? 0,
      delvePointsSnapshot: savedCacheEntry?.delvePointsSnapshot ?? {},
    }

    const updatedResults = [...cacheResults, currentResult]
    setCacheResults(updatedResults)

    const updatedStats = calculateUpdatedStats(playerData?.stats, updatedResults)
    setTodayStats(updatedStats) //save to display in results screen

    const newUnopenedCache = {
      cacheId: currentCache.id,
      date: todayStr,
      guessCount: numGuesses,
      score: calculateScore(numGuesses),
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
        ...playerData.stats,  //preserve all existing fields including totalCachesOpened etc.
        ...updatedStats,      //override with freshly calculated fields
      }
    })

    setAllComplete(true)
  }

  if (!ready) return null

  return (
    <div className="full-container">
      <div className="app-container">
        <Navbar theme={theme} onToggleTheme={toggleTheme} />
        <Toggle tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'play' && (
          <PlayTab
            // cache data
            dailyCaches={dailyCaches}
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
        {activeTab === 'info' && <Info />}
      </div>
    </div>
  )
}

export default App