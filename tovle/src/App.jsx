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
        //player has progress saved from today, restore it
        const completedCaches = savedToday.caches
        const lastIndex = completedCaches.length - 1
        const lastCache = completedCaches[lastIndex]
        setCacheResults(completedCaches)

        if (completedCaches.length === data.caches.length) {
          //if they finished today's set of caches
          setCurrentCacheIndex(data.caches.length - 1)
          setAllComplete(true)
        } else {
          //else, mid-game restore
          setCurrentCacheIndex(completedCaches.length)
        }

        if(lastCache?.status === 'solved') {
          setHasWon(true)
          setGuessHistory(lastCache.guesses)
          setNumGuesses(lastCache.guesses.length)
        } else if (lastCache?.guesses?.length > 0) {
          //restore mid-cache with existing guesses
          setGuessHistory(lastCache.guesses)
          setNumGuesses(lastCache.guesses.length)
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


  //advancing the game
  const handleNextCache = () => {
    const currentResult = {
      cacheId: currentCache.id,
      status: 'solved',
      guesses: guessHistory,
      guessCount: numGuesses,
      score: null, //TODO calculate later
    }

    const updatedResults = [...cacheResults, currentResult]
    setCacheResults(updatedResults)
    
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    save({
      today: {
        date: todayStr,
        caches: updatedResults,
      }
    })

    setCurrentCacheIndex(prev => prev + 1)
    setGuessHistory([])
    setNumGuesses(0)
    setHasWon(false)
    setSelectedCoords(null)
    setLastSelectedCoords(null)
    setImageLoaded(false)
    mapRef.current?.resetView() //TODO create this
  }


  //ending the game
  const handleComplete = () => {
    const currentResult = {
      cacheId: currentCache.id,
      status: 'solved',
      guesses: guessHistory,
      guessCount: numGuesses,
      score: null, //TODO calculate later
    }

    const updatedResults = [...cacheResults, currentResult]
    setCacheResults(updatedResults)

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    save({
      today: {
        date: todayStr,
        caches: updatedResults,
      }
    })

    setAllComplete(true)
  }

  const getDirectionArrow = (guessCoords, correctCoords) => {
    const dx = correctCoords.x - guessCoords.minecraftX
    const dz = correctCoords.z - guessCoords.minecraftZ

    const angle = Math.atan2(dz, dx) * (180 / Math.PI)
    const normalized = (angle + 360) % 360

    const arrows = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗']
    const index = Math.round(normalized / 45) % 8

    return arrows[index]
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

  const handleShare = () => {
    const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' })
    
    const lines = cacheResults.map((result, i) => {
      const dots = '🌊'.repeat(Math.min(result.guessCount, 10))
      return `Cache ${i + 1}: ${dots} (${result.guessCount} ${result.guessCount === 1 ? 'guess' : 'guesses'})`
    })

    const text = `Tovle ${todayStr}\n\n${lines.join('\n')}\n\nPlay at tovle.net`

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

          {!allComplete && <>
            <Map 
              ref={mapRef}
              selectedCoords={selectedCoords}
              setSelectedCoords={setSelectedCoords}
              correctCoords={hasWon ? correctCoords : null}
            />
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
            />
          </>}

          {allComplete && <>
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
          
        </>}
        {activeTab === 'caches' && <p>Cache opening coming soon</p>}
        {activeTab === 'info'   && <Info/>}
        
        
        {/* <Notification message={errorMessage} /> */}
      </div>

      {/* <Footer /> */}
    </div>
  )
}
export default App