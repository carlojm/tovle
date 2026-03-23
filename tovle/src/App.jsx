import { useState, useEffect, useRef} from 'react'
import Footer from './components/Footer'
import Notification from './components/Notification'
import Dateline from './components/Dateline'
import Map from './components/Map'
import Navbar from './components/Navbar'
import Water from './components/Water'
import Submit from './components/Submit'
import './App.css'
import Toggle from './components/Toggle'
import Info from './components/Info'
import Caches from './components/Caches'
import { usePlayer } from "./context/PlayerContext"

const IMAGE_BASE_URL_STANDARD = 'https://images.tovle.net/standard'
const IMAGE_BASE_URL_CUSTOM = 'https://images.tovle.net/custom'

const TABS = [
    { id: 'play',   label: 'Play' },
    { id: 'caches', label: 'Caches' },
    { id: 'info',   label: 'Info' },
  ]

const App = () => {
  const {uid, playerData, save, ready} = usePlayer()

  const [dailyCaches, setDailyCaches] = useState([])
  const [currentCacheIndex, setCurrentCacheIndex] = useState(0) //0-3
  const [cacheResults, setCacheResults] = useState([]) //accumulates each completed cache for end summary
  const [allComplete, setAllComplete] = useState(false) //flips to true when all 4 caches done

  const [selectedCoords, setSelectedCoords] = useState(null)
  const [lastSelectedCoords, setLastSelectedCoords] = useState(null)

  const [guessHistory, setGuessHistory] = useState([])
  const [numGuesses, setNumGuesses] = useState(0)
  const [hasWon, setHasWon] = useState(false)

  const [todayStats, setTodayStats] = useState(null)
  
  const [imageLoaded, setImageLoaded] = useState(null)
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

    setImageLoaded(false)

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
        //aka if the player's last intereacted with cache is cache 1/4, and they havent
        //made any guesses on 2/4, and we're reloading game state, jump back to 1/4's result screen.
        //ok that actually didnt work either it caused other problems
        //the solution is to use a third state 'advanced' to track is next button was pressed.

        const savedCaches = savedToday.caches

        //check if game is truly complete:
        //-all saved caches are marked solved
        //-the number of saved caches is the same as number of daily caches (usually 4)

        // const allDone = savedCaches.length === data.caches.length &&
        //   savedCaches[savedCaches.length - 1]?.status === 'solved' &&
        //   savedCaches.every(c => c.status === 'solved')

        const allDone = savedCaches.length === data.caches.length &&
          // savedCaches[savedCaches.length - 1]?.status === 'solved' &&
          // savedCaches.slice(0, -1).every(c => c.status === 'advanced')
          savedCaches.every(c => c.status === 'advanced')
        
        if (allDone) {
          setCacheResults(savedCaches)
          setCurrentCacheIndex(data.caches.length - 1)
          setAllComplete(true)
          setTodayStats(playerData?.stats ?? null)
          setImageLoaded(true)
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
          ? savedCaches.slice(0, -1)  // exclude the last solved-but-not-advanced cache
          : savedCaches.filter(c => c.status === 'advanced')

        //restore game state if in progress
        setCacheResults(completedCaches)
        setCurrentCacheIndex(completedCaches.length)

        if (lastIsSolvedButNotAdvanced) {
          // player solved this cache but hasn't pressed Next Cache yet
          // restore their guess history and won state
          setGuessHistory(lastCache?.guesses ?? [])
          setNumGuesses(lastCache?.guesses?.length ?? 0)
          setHasWon(true)
        } else {
          // player already pressed Next Cache, they're on a fresh cache
          // don't restore any guess state
          setGuessHistory([])
          setNumGuesses(0)
          setHasWon(false)
        }
      }

      setImageLoaded(true)
    }).catch(err => console.error('Failed to fetch daily caches:', err))

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
    // document.documentElement.classList.toggle('light')
  }

  //cache score based on guess count.
  //score of 25 equates to 95% luck, 
  const calculateScore = (guessCount) => {
    if (guessCount === 1) return 100
    if (guessCount === 2) return 85
    if (guessCount === 3) return 70
    if (guessCount === 4) return 55
    if (guessCount === 5) return 40
    return 25
  }

  //advancing the game
  const handleNextCache = () => {
    const currentResult = {
      cacheId: currentCache.id,
      status: 'advanced', //advanced = solved AND next cache button pressed
      guesses: guessHistory,
      guessCount: numGuesses,
      score: calculateScore(numGuesses),
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
    //may be unnecessary now but can't hurt to have the check i guess
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
    setSelectedCoords(null)
    setLastSelectedCoords(null)
    setImageLoaded(false)
    mapRef.current?.resetView()
  }


  //ending the game
  const handleComplete = () => {
    if (allComplete) return

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    // edge case fix: if the game was started on a different day, don't complete it
    const savedDate = playerData?.today?.date
    if (savedDate && savedDate !== todayStr) {
      console.warn('Attempted to complete a game from a previous day, ignoring.')
      setAllComplete(true) // show completion screen but don't save stats
      return
    }
    
    const currentResult = {
      cacheId: currentCache.id,
      status: 'advanced',
      guesses: guessHistory,
      guessCount: numGuesses,
      score: calculateScore(numGuesses),
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
      },
      inventory: {
        ...playerData.inventory,
        unopenedCaches: [...(playerData.inventory?.unopenedCaches ?? []), newUnopenedCache],
      },
      stats: {
        ...playerData.stats,  // preserve all existing fields including totalCachesOpened etc.
        ...updatedStats,      // override with freshly calculated fields
      }
    })

    setAllComplete(true)
  }

  const getDirectionArrow = (guessCoords, correctCoords) => {
    const dx = correctCoords.x - guessCoords.minecraftX
    const dz = correctCoords.z - guessCoords.minecraftZ

    const angle = Math.atan2(dz, dx) * (180 / Math.PI)
    const normalized = (angle + 360) % 360

    const directionTier = playerData?.upgrades?.directionArrows ?? 0

    if (directionTier === 0) {
      // 4 cardinal directions only
      const arrows = ['→', '→', '↓', '↓', '←', '←', '↑', '↑']
      const index = Math.round(normalized / 45) % 8
      return arrows[index]
    } else {
      // all 8 directions
      const arrows = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗']
      const index = Math.round(normalized / 45) % 8
      return arrows[index]
    }
  }

  const handleSubmitGuess = () => {
    if (lastSelectedCoords && (lastSelectedCoords === selectedCoords)) {
      return;
    }

    setLastSelectedCoords(selectedCoords)
    setNumGuesses(numGuesses + 1)

    const distance = Math.hypot(
      selectedCoords.minecraftX - correctCoords.x,
      selectedCoords.minecraftZ - correctCoords.z
    )

    // console.log("distance", distance)

    let msg = ""

    if (distance > 100) {
      msg = "Keep searching!"
    } else if (distance > 50) {
      msg = "Getting close..."
    } else if (distance >= 11 && distance <= 50) {
      msg = "You found the cache!"
      setHasWon(true)
      mapRef.current?.panToSubmittedGuess(correctCoords, selectedCoords)
    } else if (distance < 11) {
      msg = "Perfect guess! You found the cache!"
      setHasWon(true)
      mapRef.current?.panToSubmittedGuess(correctCoords, selectedCoords)
    }

    const newGuess = {
      guessNumber: numGuesses + 1,
      distance: Math.round(distance),
      message: msg,
      arrow: getDirectionArrow(selectedCoords, correctCoords)
    }

    const updatedHistory = [...guessHistory, newGuess]
    setGuessHistory(updatedHistory)

    //save in progress state after every guess
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const existingCaches = cacheResults.filter(r => r.cacheId !== currentCache.id)
    const inProgressCache = {
      cacheId: currentCache.id,
      status: distance < 50 ? 'solved' : 'unsolved',
      guesses: updatedHistory,
      guessCount: numGuesses + 1,
      score: null, // TODO
    }

    save({
      today: {
        date: todayStr,
        caches: [...existingCaches, inProgressCache],
      }
    })
  }

  const calculateUpdatedStats = (currentStats, results) => {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const yesterday = new Date()
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
      newStreak = 1 // streak broken, start fresh
    }

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

  const handleShare = () => {
    const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' })
    
    const lines = cacheResults.map((result, i) => {
      const dots = '🌊'.repeat(Math.min(result.guessCount, 10))
      return `Cache ${i + 1}: ${dots} (${result.guessCount} ${result.guessCount === 1 ? 'guess' : 'guesses'})`
    })

    const text = `Tovle ${todayStr}\n\n${lines.join('\n')}\n\nPlay at https://tovle.net`

    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!')
    })
  }

  if (!ready) return null

  return (
    <div className = "full-container">
      <div className="app-container">
        <Navbar theme={theme} onToggleTheme={toggleTheme} />
        {/* <Water /> */}

        <Toggle tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
        {activeTab === 'play' && <> 
          

          

          {!allComplete && <>
            <div className="play-layout">
              <div className="play-image-col">

                <Dateline  />

                <div className={`cache-image-wrapper ${imageLoaded ? '' : 'loading'}`}>
                  {cacheImage &&
                    <img 
                      src={cacheImage}
                      className="cache-image"
                      onLoad={()=>setImageLoaded(true)}
                    />
                  }
                </div>

              </div>
              <div className="play-map-col">

                <Map 
                  ref={mapRef}
                  selectedCoords={selectedCoords}
                  setSelectedCoords={setSelectedCoords}
                  correctCoords={hasWon ? correctCoords : null}
                />

              </div>
            </div>
            
            <Submit
              selectedCoords={selectedCoords}
              handleSubmitGuess={handleSubmitGuess}
              handleNextCache={handleNextCache}
              handleComplete={handleComplete}
              guessHistory={guessHistory}
              numGuesses={numGuesses}
              hasWon={hasWon}
              isLastCache={currentCacheIndex === dailyCaches.length - 1}
              dailyCaches={dailyCaches} currentCacheIndex={currentCacheIndex} allComplete={allComplete}
              distancePrecision={playerData?.upgrades?.distancePrecision ?? 0}
            />
          </>}

          {allComplete && <>
            {/* i like how the last cache image shows up at the end so im putting it in again here */}
            {/* it is a feature now not a bug */}
            <div className={`cache-image-wrapper ${imageLoaded ? '' : 'loading'}`}>
              {cacheImage &&
                <img 
                  src={cacheImage}
                  className="cache-image"
                  onLoad={()=>setImageLoaded(true)}
                  style={{width:"min(90vw,500px)"}}
                />
              }
            </div>
            <div className="completion-summary">
              <p>You found all {dailyCaches.length} caches today!</p>
              {cacheResults.map((result, i) => (
                <div key={result.cacheId} className="summary-row">
                  <span>Cache {i+1}:</span>
                  <span>{result.guessCount} {result.guessCount === 1 ? 'guess!' : 'guesses'}</span>
                  <span className="summary-distances">
                    {result.guesses.length > 5
                      ? [
                          ...result.guesses.slice(0, 2).map(g => g.distance),
                          '...',
                          ...result.guesses.slice(-2).map(g => g.distance)
                        ].join(' > ')
                      : result.guesses.map(g => g.distance).join(' > ')
                    } away
                  </span>
                </div>
              ))}
            </div>
            <div className="completion-buttons">
              <button onClick={handleShare}>Share</button> 
              <button onClick={() => setActiveTab('caches')}>Open Caches</button>
            </div>
          </>}

          {todayStats && (
            <>
              <div className="completion-stats">
                <div className="completion-stat">
                  <span className="completion-stat-value">{todayStats.currentStreak}</span>
                  <span className="completion-stat-label">day streak</span>
                </div>
                <div className="completion-stat">
                  <span className="completion-stat-value">{todayStats.bestStreak}</span>
                  <span className="completion-stat-label">best streak</span>
                </div>
                <div className="completion-stat">
                  <span className="completion-stat-value">{todayStats.totalCachesSolved}</span>
                  <span className="completion-stat-label">caches found</span>
                </div>
                <div className="completion-stat">
                  <span className="completion-stat-value">{todayStats.averageGuesses}</span>
                  <span className="completion-stat-label">avg guesses</span>
                </div>
              </div>
              <p style={{marginTop:"16px"}}>See full statistics on the info page.</p>
            </>
          )}
          
        </>}
        {activeTab === 'caches' && <Caches />}
        {activeTab === 'info'   && <Info/>}
        
        
        {/* <Notification message={errorMessage} /> */}
      </div>

      {/* <Footer /> */}
    </div>
  )
}
export default App