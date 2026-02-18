import React, { useState, useRef } from 'react';
import mapImage from '../assets/map.png';

export default function Map() {
  const [selectedCoords, setSelectedCoords] = useState(null);
  const imageRef = useRef(null)

  const handleMapClick = (event) => {
    if (!imageRef.current) return

    //get image position and size on screen
    const rect = imageRef.current.getBoundingClientRect()

    //calculate where on the image was clicked
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    //convert to percentages
    const xPercent = x / rect.width
    const yPercent = y / rect.height

    console.log("map clicked! at:", x, y, xPercent, yPercent)
    console.log("dims", rect.left, rect.top)
    console.log("click event:", event)

    setSelectedCoords({
      percentX: xPercent,
      percentY: yPercent,
      pixelX: Math.round(x),
      pixelY: Math.round(y),
      minecraftX: Math.round(-2223 + (xPercent * 3085)), //-2223 to 862
      minecraftZ: Math.round(-655 + (yPercent * 2557))  //-655 to 1902
    })

  }

  return (
    <div style={{ 
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      // minHeight: '100vh'  // full viewport height
    }}>
      <h3>Map Picker</h3>
      <p>Pinpoint the cache's location on the map below.</p>
      
      <div style={{ 
        position: 'relative', 
        display: 'inline-block',
        // maxWidth: '90vw',   // 90% of screen width
        // maxHeight: '70vh',  // 70% of screen height
      }}>
        <img 
          ref={imageRef}
          src={mapImage} 
          alt="Minecraft Map"
          onClick={handleMapClick}
          style={{ 
            cursor: 'crosshair', 
            display: 'block',
            // maxHeight: '70vh',
            width: 'min(90vw, 1000px)',
            // height: 'auto',
            objectFit: 'contain'
          }}
        />
        {selectedCoords && (
          <div
            style={{
              position: 'absolute',
              left: `${selectedCoords.percentX * 100}%`,
              top: `${selectedCoords.percentY * 100}%`,
              width: '20px',
              height: '20px',
              // backgroundColor: 'red',
              borderRadius: '50%',
              // border: '2px solid white',
              transform: 'translate(-42.6%, -90%)',
              pointerEvents: 'none'
            }}
          >
            <svg viewBox="0 0 24 24" fill="red" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
        )}
      </div>
      {selectedCoords && (
        <div>
          <p>You clicked at:</p>
          <p>X: {selectedCoords.minecraftX} : {(selectedCoords.percentX * 100).toFixed(1)}%</p>
          <p>Z: {selectedCoords.minecraftZ} : {(selectedCoords.percentY * 100).toFixed(1)}%</p>
        </div>
      )}
    </div>
  );
}