import { useState, useEffect } from 'react'
import Footer from './components/Footer'
import Notification from './components/Notification'
import Dateline from './components/Dateline'
import Map from './components/Map'
import Navbar from './components/Navbar'
import Water from './components/Water'
import './App.css'

import {Cloudinary} from "@cloudinary/url-gen";
import {AdvancedImage} from '@cloudinary/react';
import {fill} from "@cloudinary/url-gen/actions/resize";

import tovData from './tovs.json'

const App = () => {
  const [selectedCoords, setSelectedCoords] = useState(null)
  const [correctCoords, setCorrectCoords] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [cacheImage, setCacheImage] = useState(null)
  const [imageId, setImageId] = useState(null)

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
      setErrorMessage(`No data found for ID ${id}`)
    }
  }, [])

  const handleSubmitGuess = () => {
    const distance = Math.hypot(
      selectedCoords.minecraftX - correctCoords.x,
      selectedCoords.minecraftZ - correctCoords.z
    )

    console.log("distance", distance)

    setErrorMessage(`the cache is ${Math.round(distance)} blocks away`)
    // setTimeout(() => setErrorMessage(null), 5000)
  }

  return (
    <div className = "full-container">
      <div className="app-container">
        {/* <h1 className="app-title">Tovle!</h1> */}
        <Navbar />
        <Water />
        <Dateline />

        {cacheImage &&
          <AdvancedImage cldImg={cacheImage} className="cache-image"/>
        }

        <p>Pinpoint the cache's location on the map below.</p>
        <Map selectedCoords={selectedCoords} setSelectedCoords={setSelectedCoords} />

        {selectedCoords && (
          <div className="coords-display">
            <p><strong>Selected:</strong> X {selectedCoords.minecraftX}, Z {selectedCoords.minecraftZ}</p>
          </div>
        )}
        
        {selectedCoords && (
          <button onClick={handleSubmitGuess} className="submit-button">Search Area</button>
        )}

        <Notification message={errorMessage} />
      </div>

      <Footer />
    </div>
  )
}
export default App