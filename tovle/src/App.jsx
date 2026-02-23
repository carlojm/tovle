import { useState, useEffect, useRef} from 'react'
import Footer from './components/Footer'
import Notification from './components/Notification'
import Dateline from './components/Dateline'
import Map from './components/Map'
import Navbar from './components/Navbar'
import Water from './components/Water'
import Submit from './components/Submit'
import './App.css'

import {Cloudinary} from "@cloudinary/url-gen";
import {AdvancedImage} from '@cloudinary/react';
import {fill} from "@cloudinary/url-gen/actions/resize";

import tovData from './tovs.json'

const App = () => {
  const [selectedCoords, setSelectedCoords] = useState(null)
  const [lastSelectedCoords, setLastSelectedCoords] = useState(null)
  const [correctCoords, setCorrectCoords] = useState(null)
  const [answerMessage, setAnswerMessage] = useState(null)
  const [cacheImage, setCacheImage] = useState(null)
  const [imageId, setImageId] = useState(null)
  const [hasWon, setHasWon] = useState(false)
  const [numGuesses, setNumGuesses] = useState(0)

  //this ref used in submitguess
  //to tell map to zoom in on the cache after it is found
  const mapRef = useRef(null)

  useEffect(() => {
    // create a cloudinary instance
    const cld = new Cloudinary({
      cloud: { cloudName: 'carlojm' }
    });

    // random id
    const id = Math.floor(Math.random() * 14) + 1;
    setImageId(id)

    const image = cld.image(`tov/${id}`);
    image.resize(fill().width(1000));
    setCacheImage(image)

    //grab the correct coords
    const idData = tovData.find(item => item.id === id)
    if (idData) {
      setCorrectCoords(idData.coordinates)
    } else {
      console.error(`No data found for cache ID ${id}`);
    }
  }, [])

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

    setAnswerMessage(`The cache is ${Math.round(distance)} blocks away. ${msg}`)
  }

  return (
    <div className = "full-container">
      <div className="app-container">
        <Navbar />
        {/* <Water /> */}
        <Dateline />

        {cacheImage &&
          <AdvancedImage cldImg={cacheImage} className="cache-image"/>
        }

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
          message={answerMessage}
          numGuesses={numGuesses}
          hasWon={hasWon}
        />
        {/* <Notification message={errorMessage} /> */}
      </div>

      <Footer />
    </div>
  )
}
export default App