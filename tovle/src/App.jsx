import { useState, useEffect } from 'react'
import Footer from './components/Footer'
import Notification from './components/Notification'
import Dateline from './components/Dateline'
import Map from './components/Map'

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

  const getDistance = (x0, z0, x1, z1) => {
    if ([x0, z0, x1, z1].some(v => typeof v !== 'number' || Number.isNaN(v))) {
      throw new TypeError('getDistance requires four numeric arguments: x0, z0, x1, z1');
    }
    return Math.hypot(x1 - x0, z1 - z0);
  }

  const handleSubmitGuess = () => {
    const distance = Math.hypot(
      selectedCoords.minecraftX - correctCoords.x,
      selectedCoords.minecraftZ - correctCoords.z
    )

    console.log("distance", distance)

    setErrorMessage(`distance is ${distance}}`)
    setTimeout(() => setErrorMessage(null), 3000)
  }

  return (
    <div>
      <div style={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minHeight: '100vh'  // full viewport height
      }}>
        <h1>Tovle!</h1>
        <Dateline />
        <Notification message={errorMessage} />

        {cacheImage &&
          <AdvancedImage cldImg={cacheImage} style={{
            // maxHeight: '70vh',
            width: 'min(90vw, 1000px)',
            height: 'auto',
            objectFit: 'contain'
          }} />
        }

        <Map selectedCoords={selectedCoords} setSelectedCoords={setSelectedCoords} />

        {selectedCoords && (
          <button
            onClick={handleSubmitGuess}
            style = {{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#7070d4ff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              // fontWeight: 'bold'
            }}
          >Search Area</button>
        )}
      </div>

      <Footer />
    </div>
  )
}
export default App