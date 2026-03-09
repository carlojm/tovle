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

import {Cloudinary} from "@cloudinary/url-gen";
import {AdvancedImage} from '@cloudinary/react';
import {fill} from "@cloudinary/url-gen/actions/resize";
import { auto } from "@cloudinary/url-gen/qualifiers/quality";
import { auto as autoFormat } from "@cloudinary/url-gen/qualifiers/format";
import { quality } from "@cloudinary/url-gen/actions/delivery";
import { format } from "@cloudinary/url-gen/actions/delivery";

import tovData from './tovs.json'

const TABS = [
    { id: 'play',   label: 'Play' },
    { id: 'caches', label: 'Caches' },
    { id: 'info',   label: 'Info' },
  ]

const App = () => {
  const [selectedCoords, setSelectedCoords] = useState(null)
  const [lastSelectedCoords, setLastSelectedCoords] = useState(null)
  const [correctCoords, setCorrectCoords] = useState(null)
  // const [answerMessage, setAnswerMessage] = useState(null)
  const [guessHistory, setGuessHistory] = useState([])
  const [cacheImage, setCacheImage] = useState(null)
  const [imageId, setImageId] = useState(null)
  const [imageLoaded, setImageLoaded] = useState(null)
  const [hasWon, setHasWon] = useState(false)
  const [numGuesses, setNumGuesses] = useState(0)
  const [theme, setTheme] = useState('light')
  const [activeTab, setActiveTab] = useState('play')

  //this ref used in submitguess
  //to tell map to zoom in on the cache after it is found
  const mapRef = useRef(null)

  useEffect(() => {
    setImageLoaded(false)

    // create a cloudinary instance
    const cld = new Cloudinary({
      cloud: { cloudName: 'carlojm' }
    });

    // random id
    const id = Math.floor(Math.random() * 14) + 1;
    setImageId(id)

    const image = cld.image(`tov/${id}`);
    image
      .resize(fill().width(900))
      .delivery(quality(auto()))
      .delivery(format(autoFormat()));
    setCacheImage(image)

    //grab the correct coords
    const idData = tovData.find(item => item.id === id)
    if (idData) {
      setCorrectCoords(idData.coordinates)
    } else {
      console.error(`No data found for cache ID ${id}`);
    }
  }, [])


  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.classList.toggle('light')
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
      msg = "Getting closer..."
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
    }])
  }

  return (
    <div className = "full-container">
      <div className="app-container">
        <Navbar theme={theme} onToggleTheme={toggleTheme} />
        {/* <Water /> */}
        <Dateline />

        <div className={`cache-image-wrapper ${imageLoaded ? '' : 'loading'}`}>
          {cacheImage &&
            <AdvancedImage 
              cldImg={cacheImage}
              className="cache-image"
              onLoad={()=>setImageLoaded(true)}
            />
          }
        </div>
        
        <Toggle tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
        {activeTab === 'play' && <> 
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