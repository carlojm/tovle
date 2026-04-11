import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import mapImage from '../assets/map.png';
import './Map.css'

const MAX_ZOOM = 10
const MIN_ZOOM = 1
const ZOOM_STEP = 1
const CLICK_THRESHOLD = 5
const TOUCH_CLICK_THRESHOLD = 10

const MAP_MIN_X = -2223
const MAP_MAX_X = 862
const MAP_WIDTH = 3085
const MAP_MIN_Y = -655
const MAP_MAX_Y = 1902
const MAP_HEIGHT = 2557

const Map = forwardRef(function Map({selectedCoords, setSelectedCoords, correctCoords}, ref) {
  const imageRef = useRef(null)
  const containerRef = useRef(null)

  const [zoom, setZoom] = useState(1) //1 = 100%
  const [pan, setPan] = useState({x:0, y:0}) //pan offset in pixels
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({x:0, y:0})
  const [mouseDownPos, setMouseDownPos] = useState({x:0, y:0})

  //touch
  const [touchStart, setTouchStart] = useState(null)
  const [lastTouchDistance, setLastTouchDistance] = useState(null)

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

  //we're doing some funky stuff here to move the map after the cache has been found
  //it's a little ugly but it's better than lifting all of the pan zoom logic and 
  //everything up into the App component so i'll go with it for now
  useImperativeHandle(ref, () => ({
    panToSubmittedGuess(coordA, coordB) {
      if (!containerRef.current || !imageRef.current) return

      const imageRect = imageRef.current.getBoundingClientRect()
      const originalWidth = imageRect.width / zoom
      const originalHeight = imageRect.height / zoom
      const containerRect = containerRef.current.getBoundingClientRect()

      // convert both pins to image pixel space
      const ax = ((coordA.x - MAP_MIN_X) / MAP_WIDTH) * originalWidth
      const ay = ((coordA.z - MAP_MIN_Y) / MAP_HEIGHT) * originalHeight
      const bx = ((coordB.minecraftX - MAP_MIN_X) / MAP_WIDTH) * originalWidth
      const by = ((coordB.minecraftZ - MAP_MIN_Y) / MAP_HEIGHT) * originalHeight

      const midX = (ax + bx) / 2
      const midY = (ay + by) / 2

      const spanX = Math.abs(ax - bx) * 2.5
      const spanY = Math.abs(ay - by) * 2.5

      // zoom level that fits both pins
      const zoomToFitX = containerRect.width / spanX
      const zoomToFitY = containerRect.height / spanY
      const newZoom = Math.min(Math.max(Math.min(zoomToFitX, zoomToFitY), MIN_ZOOM), MAX_ZOOM)

      const newPan = {
        x: containerRect.width / 2 - midX * newZoom,
        y: containerRect.height / 2 - midY * newZoom
      }

      //now do animation!
      const startZoom = zoom
      const startPan = {...pan}
      const duration = 600
      const startTime = performance.now()

      const frame = (now) => {
        const elapsed = now - startTime
        const progress = Math.min(elapsed/duration, 1)
        const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2

        setZoom(startZoom + (newZoom - startZoom) * eased)
        setPan({
          x: startPan.x + (newPan.x - startPan.x) * eased,
          y: startPan.y + (newPan.y - startPan.y) * eased,
        })

        if (progress < 1) requestAnimationFrame(frame)
      }

      requestAnimationFrame(frame)
    },
    
    resetView() {
      const duration = 400
      const startZoom = zoom
      const startPan = { ...pan }
      const targetZoom = 1
      const targetPan = { x: 0, y: 0 }
      const startTime = performance.now()

      const frame = (now) => {
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2

        setZoom(startZoom + (targetZoom - startZoom) * eased)
        setPan({
          x: startPan.x + (targetPan.x - startPan.x) * eased,
          y: startPan.y + (targetPan.y - startPan.y) * eased,
        })

        if (progress < 1) requestAnimationFrame(frame)
      }

      requestAnimationFrame(frame)
    }
  }), [zoom, pan])

  const handleWheel = (event) => {
    event.preventDefault()
    if (isDragging) return
    if (!containerRef.current) return

    const delta = event.deltaY * -0.001 * zoom //make it negative so scroll down = zoom out
    const newZoom = Math.min(Math.max(zoom + delta, MIN_ZOOM), MAX_ZOOM) //clamped between 1x and 5x zoom

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
    //left click
    if (event.button === 0) {
      event.preventDefault()
      setIsDragging(true)
      setDragStart({
        x: event.clientX - pan.x,
        y: event.clientY - pan.y
      })
      setMouseDownPos({
        x: event.clientX,
        y: event.clientY
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

  const handleMouseUp = (event) => {
    if (!isDragging) return
    if (mouseDownPos.x === 0 && mouseDownPos.y === 0) {
      //right click and middle click
      setIsDragging(false)
      return
    }

    //calculate how far mouse moved
    const moveDistance = Math.hypot(
      event.clientX - mouseDownPos.x,
      event.clientY - mouseDownPos.y
    )

    //if moved less than 5 pixels, treat as a click
    if (moveDistance < CLICK_THRESHOLD) {
      handleMapClick(event, {x:event.clientX, y:event.clientY})
    }

    setIsDragging(false)
    setMouseDownPos({x:0, y:0})
  }

  const handleContextMenu = (event) => {
    //stop context menu on right click
    event.preventDefault()
  }

  const getTouchDistance = (touch1, touch2) => {
    return Math.hypot(
      touch1.clientX - touch2.clientX,
      touch1.clientY - touch2.clientY
    )
  }

  const getTouchCenter = (touch1, touch2) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    }
  }

  const handleTouchStart = (event) => {
    if (event.touches.length === 1) {
      //single touch - a pan or a tap, handle like left click
      const touch = event.touches[0]
      setIsDragging(true)
      setDragStart({
        x: touch.clientX - pan.x,
        y: touch.clientY - pan.y
      })
      setMouseDownPos({
        x: touch.clientX,
        y: touch.clientY
      })
      setTouchStart({x:touch.clientX, y:touch.clientY})
    } else if (event.touches.length === 2) {
      //double touch - zoom
      event.preventDefault()
      const distance = getTouchDistance(event.touches[0], event.touches[1])
      setLastTouchDistance(distance)
      setIsDragging(false) //dont pan while pinching
    }
  }

  const handleTouchMove = (event) => {
    if (event.touches.length === 1 && isDragging) {
      //single finger panning, handle like left click panning
      const touch = event.touches[0]
      setPan({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y
      })
    } else if (event.touches.length === 2) {
      //pinch zoom
      event.preventDefault()
      const distance = getTouchDistance(event.touches[0], event.touches[1])
      if(lastTouchDistance) {
        const scale = distance / lastTouchDistance
        const newZoom = Math.min(Math.max(zoom * scale, MIN_ZOOM), MAX_ZOOM)
        
        //get center of pinch
        const center = getTouchCenter(event.touches[0], event.touches[1])
        const rect = containerRef.current.getBoundingClientRect()
        const centerX = center.x - rect.left
        const centerY = center.y - rect.top

        //zoom toward center of pinch
        const pointX = (centerX - pan.x) / zoom
        const pointY = (centerY - pan.y) / zoom
        const newPointX = pointX * newZoom
        const newPointY = pointY * newZoom

        const newPan = {
          x: centerX - newPointX,
          y: centerY - newPointY
        }

        setZoom(newZoom)
        setPan(newPan)
      }

      setLastTouchDistance(distance)
    }
  }

  const handleTouchEnd = (event) => {
    if (event.touches.length === 0) {
      //all touches lifted
      if (isDragging && touchStart) {
        //check if tap happened, or if it was a pan
        const moveDistance = Math.hypot(
          mouseDownPos.x - touchStart.x,
          mouseDownPos.y - touchStart.y
        )
        
        if (moveDistance < TOUCH_CLICK_THRESHOLD) {
          handleMapClick(event, touchStart)
        }
      }

      setIsDragging(false)
      setMouseDownPos({x: 0, y: 0})
      setTouchStart(null)
      setLastTouchDistance(null)
    } else if (event.touches.length === 1) {
      //one finger lifted, but another finger still on screen; reset distance
      setLastTouchDistance(null)
    }
  }

  const handleMapClick = (event, pos) => {
    /*
    this method handles both mouse clicks and taps
    to place down a pin on the map
    */
    if (event.button !== 0) return

    if (!imageRef.current || !containerRef.current) return

    //if already won, don't place a new pin
    if (correctCoords !== null) return

    //get image position and size on screen
    const containerRect = containerRef.current.getBoundingClientRect()

    //calculate where on the image was clicked, relative to container
    const clickX = pos.x - containerRect.left
    const clickY = pos.y - containerRect.top

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

    // console.log("map clicked! at:", clickX, clickY, imageX, imageY, xPercent, yPercent)
    // console.log("click event:", event)

    setSelectedCoords({
      percentX: xPercent,
      percentY: yPercent,
      pixelX: Math.round(imageX),
      pixelY: Math.round(imageY),
      minecraftX: Math.round(MAP_MIN_X + (xPercent * MAP_WIDTH)), //-2223 to 862 = 3085
      minecraftZ: Math.round(MAP_MIN_Y + (yPercent * MAP_HEIGHT))  //-655 to 1902 = 2557
    })

  }

  const zoomCentered = (newZoom) => {
    if (!containerRef.current) return
    newZoom = Math.min(Math.max(newZoom, MIN_ZOOM), MAX_ZOOM)

    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    //same as handlewheel, find point at the center of the current view
    //and adjust pan to stay there after zoom
    const pointX = (centerX - pan.x) / zoom
    const pointY = (centerY - pan.y) / zoom

    setPan({
      x: centerX - pointX * newZoom,
      y: centerY - pointY * newZoom
    })
    setZoom(newZoom)
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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        cursor: isDragging ? 'grabbing' : 'default',
        overflow: 'hidden',
        // touchAction: 'none'
      }}
    >
      <div className="zoom-controls" onMouseDown={(e) => e.stopPropagation()}>
        <button onClick={() => zoomCentered(zoom - ZOOM_STEP)}>-</button>
        <span>{Math.round(zoom*100)}%</span>
        <button onClick={() => zoomCentered(zoom + ZOOM_STEP)}>+</button>
        <button className="reset-button" onClick={() => {setZoom(1); setPan({x:0, y:0}) }}>Reset</button>

      </div>
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0', //scale from top left
          // transition: isDragging ? 'none' : 'transform 0.1s ease-out'
        }}
      >
        <img 
          ref={imageRef}
          src={mapImage} 
          alt="Isles Map"
          className="map-image"
        />

        {selectedCoords && (
          <div
            key={`${selectedCoords.percentX}-${selectedCoords.percentY}`} //update key for css animation to run
            className="map-pin"
            style={{
              left: `${selectedCoords.percentX * 100}%`,
              top: `${selectedCoords.percentY * 100}%`,
              transform: `translate(-50%, -100%) scale(${1/zoom})`,
              '--zoom-factor': 1 / zoom,
              transformOrigin: 'bottom center'
            }}
          >
            <svg viewBox="0 0 24 24" fill="red">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
        )}

        {correctCoords && (
          <div
            className="map-pin map-pin--correct"
            style={{
              left: `${((correctCoords.x - MAP_MIN_X) / MAP_WIDTH) * 100}%`,
              top: `${((correctCoords.z - MAP_MIN_Y) / MAP_HEIGHT) * 100}%`,
              transform: `translate(-50%, -100%) scale(${1/zoom})`,
              '--zoom-factor': 1 / zoom,
              transformOrigin: 'bottom center'
            }}
          >
            <svg viewBox="0 0 24 24" fill="gold">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
        )}
      </div>
    </div>
  );
})

export default Map