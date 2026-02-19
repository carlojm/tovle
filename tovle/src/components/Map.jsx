import React, { useState, useRef } from 'react';
import mapImage from '../assets/map.png';
import './Map.css'

export default function Map({selectedCoords, setSelectedCoords}) {
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
    <div className="map-container">
      <img 
        ref={imageRef}
        src={mapImage} 
        alt="Isles Map"
        onClick={handleMapClick}
        className="map-image"
      />
      {selectedCoords && (
        <div
          key={`${selectedCoords.percentX}-${selectedCoords.percentY}`} //update key for css animation to run
          className="map-pin"
          style={{
            left: `${selectedCoords.percentX * 100}%`,
            top: `${selectedCoords.percentY * 100}%`,
          }}
        >
          <svg viewBox="0 0 24 24" fill="red">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      )}
    </div>
  );
}