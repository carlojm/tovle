import React, { useState, useEffect, useRef } from 'react';
import mapImage from '../assets/map.png';
import './Map.css'

export default function Map({selectedCoords, setSelectedCoords}) {
  const imageRef = useRef(null)
  const containerRef = useRef(null)

  const [zoom, setZoom] = useState(1) //1 = 100%
  const [pan, setPan] = useState({x:0, y:0}) //pan offset in pixels
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({x:0, y:0})

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const preventScroll = (e) => {
      e.preventDefault()
    }
    //listener with passive:false to allow preventdefault
    container.addEventListener('wheel', preventScroll, {passive:false})

    //cleanup
    return () => {
      container.removeEventListener('wheel', preventScroll)
    }
  }, [])

  const handleWheel = (event) => {
    event.preventDefault()
    if (!containerRef.current) return

    const delta = event.deltaY * -0.001 //make it negative so scroll down = zoom out
    const newZoom = Math.min(Math.max(zoom + delta, 1), 5) //clamped between 1x and 5x zoom

    //get mouse pos relative to container
    const rect = containerRef.current.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top

    //calculate point in image under mouse
    const pointX = (mouseX - pan.x) / zoom
    const pointY = (mouseY - pan.y) / zoom

    //after zoom, where should that point be
    const newPointX = pointX * newZoom
    const newPointY = pointY * newZoom

    //adjust pan so the point stays under the mouse
    const newPan = {
      x: mouseX - newPointX,
      y: mouseY - newPointY
    }
    
    setZoom(newZoom)
    setPan(newPan)
  }

  const handleMouseDown = (event) => {
    //right or middle click = panning around the map TODO what about mobile
    if (event.button === 2 || event.button === 1) {
      event.preventDefault()
      setIsDragging(true)
      setDragStart({
        x: event.clientX - pan.x,
        y: event.clientY - pan.y
      })
    }
  }

  const handleMouseMove = (event) => {
    if (!isDragging) return
    setPan({
      x: event.clientX - dragStart.x,
      y: event.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleContextMenu = (event) => {
    //stop context menu on right click
    event.preventDefault()
  }

  const handleMapClick = (event) => {
    //if dragging, don't place a pin
    if (isDragging) return
    //only place pin on left click TODO mobile?
    if (event.button !== 0) return

    if (!imageRef.current || !containerRef.current) return

    //get image position and size on screen
    const containerRect = containerRef.current.getBoundingClientRect()

    //calculate where on the image was clicked, relative to container
    const clickX = event.clientX - containerRect.left
    const clickY = event.clientY - containerRect.top

    //convert to position on original image
    const imageX = (clickX - pan.x) / zoom
    const imageY = (clickY - pan.y) / zoom

    //original image dimensions before zoom
    const imageRect = imageRef.current.getBoundingClientRect()
    const originalWidth = imageRect.width / zoom
    const originalHeight = imageRect.height / zoom

    //convert to percentages
    const xPercent = imageX / originalWidth
    const yPercent = imageY / originalHeight

    if (xPercent < 0 || xPercent > 1 || yPercent < 0 || yPercent > 1) {
      return //out of bounds click
    }

    console.log("map clicked! at:", clickX, clickY, imageX, imageY, xPercent, yPercent)
    console.log("click event:", event)

    setSelectedCoords({
      percentX: xPercent,
      percentY: yPercent,
      pixelX: Math.round(imageX),
      pixelY: Math.round(imageY),
      minecraftX: Math.round(-2223 + (xPercent * 3085)), //-2223 to 862
      minecraftZ: Math.round(-655 + (yPercent * 2557))  //-655 to 1902
    })

  }

  return (
    <div 
      className="map-container"
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp} //if mouse leaves, stop dragging
      onContextMenu={handleContextMenu}
      style={{
        cursor: isDragging ? 'grabbing' : (zoom > 1 ? 'grab' : 'default'),
        overflow: 'hidden',
        // touchAction: 'none'
      }}
    >
      <div className="zoom-controls">
        <button onClick={() => setZoom(Math.min(zoom + 0.5, 5))}>+</button>
        <span>{Math.round(zoom*100)}%</span>
        <button onClick={() => setZoom(Math.max(zoom - 0.5, 1))}>-</button>
        <button className="reset-button" onClick={() => {setZoom(1); setPan({x:0, y:0}) }}>Reset</button>

      </div>
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0', //scale from top left
          transition: isDragging ? 'none' : 'transform 0.1s ease-out'
        }}
      >
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
    </div>
  );
}