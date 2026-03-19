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

const IMAGE_BASE_URL = 'https://images.tovle.net/standard'
const TABS = [
    { id: 'play',   label: 'Play' },
    { id: 'caches', label: 'Caches' },
    { id: 'info',   label: 'Info' },
  ]

const App = () => {
  const [dailyCaches, setDailyCaches] = useState([])
  const [cacheImage, setCacheImage] = useState(null)
  const [correctCoords, setCorrectCoords] = useState(null)

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

  useEffect(() => {
    setImageLoaded(false)

    fetch('/api/daily').then(res => res.json()).then(data => {
      setDailyCaches(data.caches)
      const first = data.caches[0]
      if (!first) return
      setCacheImage(`${IMAGE_BASE_URL}/${String(first.id).padStart(3, '0')}.webp`)
      setCorrectCoords(first.coordinates)
    }).catch(err => console.error('Failed to fetch daily caches:', err))

  }, [])

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

    console.log("distance", distance)

    // const msg = distance < 100 ? (
    //   distance < 50 ? (
    //     distance < 10 ? "PERFECT!" : "cache found!"
    //   ) : "getting close..."
    // ) : "darnit."

    let msg = ""

    if (distance > 100) {
      msg = "Keep searching!"
    } else if (distance > 50) {
      msg = "Getting close..."
    } else if (distance >= 11) {
      msg = "You found the cache!"
      setHasWon(true)
      mapRef.current?.panToSubmittedGuess(correctCoords, selectedCoords)
    } else if (distance < 11) {
      msg = "Perfect guess! You found the cache!"
      setHasWon(true)
      mapRef.current?.panToSubmittedGuess(correctCoords, selectedCoords)
    }

    // setAnswerMessage(`The cache is ${Math.round(distance)} blocks away. ${msg}`)
    setGuessHistory(prev => [...prev, {
      guessNumber: numGuesses + 1,
      distance: Math.round(distance),
      message: msg,
      arrow: getDirectionArrow(selectedCoords, correctCoords)
    }])
  }

  return (
    <div className = "full-container">
      <div className="app-container">
        <Navbar theme={theme} onToggleTheme={toggleTheme} />
        {/* <Water /> */}

        <Toggle tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
        {activeTab === 'play' && <> 
          <Dateline />
          <div className={`cache-image-wrapper ${imageLoaded ? '' : 'loading'}`}>
            {cacheImage &&
              <img 
                src={cacheImage}
                className="cache-image"
                onLoad={()=>setImageLoaded(true)}
              />
            }
          </div>
          <p>Pinpoint the cache's location on the map below.</p>
          <p style = {{marginBottom:'16px'}}>Guess within 50 blocks to find the cache.</p>
          <Map 
            ref={mapRef}
            selectedCoords={selectedCoords}
            setSelectedCoords={setSelectedCoords}
            correctCoords={hasWon ? correctCoords : null}
          />
          <Submit
            selectedCoords={selectedCoords}
            handleSubmitGuess={handleSubmitGuess}
            guessHistory={guessHistory}
            numGuesses={numGuesses}
            hasWon={hasWon}
          />
        </>}
        {activeTab === 'caches' && <p>Cache opening coming soon</p>}
        {activeTab === 'info'   && <>
          <p>WIP</p>
          <p>I am building Tovle as a way to learn React and CSS!</p>
          <p>For feedback or suggestions message me @carlojm on Discord.</p>
        </>}
        


        
        {/* <Notification message={errorMessage} /> */}
      </div>

      {/* <Footer /> */}
    </div>
  )
}
export default App