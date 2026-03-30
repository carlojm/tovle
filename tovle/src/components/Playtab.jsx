import { cache, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Dateline from './Dateline'
import Map from './Map'
import Submit from './Submit'
import './Playtab.css'

import DelveModal, { calcTotalPoints, DELVE_MODS } from './DelveModal'
import twistedStrand from '../assets/items/twisted_strand.png'

const PlayTab = ({
  // cache data
  dailyCaches,
  currentCacheIndex,
  currentCache,
  cacheImage,
  correctCoords,
  // game state
  guessHistory,
  setGuessHistory,
  numGuesses,
  setNumGuesses,
  hasWon,
  setHasWon,
  allComplete,
  cacheResults,
  todayStats,
  delvePoints,
  setDelvePoints,
  delveColor,
  // handlers from App
  handleNextCache,
  handleComplete,
  setActiveTab,
  // upgrades
  distancePrecision,
  directionArrows,
  // refs and save
  mapRef,
  save,
  playerData,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [selectedCoords, setSelectedCoords] = useState(null)
  const [lastSelectedCoords, setLastSelectedCoords] = useState(null)

  const [showDelveModal, setShowDelveModal] = useState(false)
  const [tapOutMsg, setTapOutMsg] = useState(null)

  const [toast, setToast] = useState(null)
  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const hasDelve = (playerData?.upgrades?.delveMods ?? 0) >= 1
  //whether the delve selection overlay has been dismissed or not
  //we want to track this so we can always disable it if delves not unlocked
  //and also to prevent refresh-scumming a bit
  const overlayDismissed = (() => {
    //this was originally state but we don't need that we can just derive it
    if (!hasDelve) return true
    if (!currentCache) return false
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const savedToday = playerData?.today
    if (savedToday?.date !== todayStr) return false
    const savedCache = savedToday?.caches?.find(c => c.cacheId === currentCache.id)
    return savedCache?.overlayDismissed ?? false
  })()

  const updateDelvePoints = (newPoints) => {
    setDelvePoints(newPoints)
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    save({
      today: {
        ...playerData.today,
        date: todayStr,
        delvePoints: newPoints,
      }
    })
  }

  const handleTapOut = () => {
    //get all mods that have points assigned
    const activeMods = Object.entries(delvePoints).filter(([id, level]) => level > 0)
    if (activeMods.length === 0) return

    //pick a random one
    const [id] = activeMods[Math.floor(Math.random() * activeMods.length)]
    const modDef = DELVE_MODS.find(m => m.id === id)

    const newPoints = { ...delvePoints, [id]: delvePoints[id] - 1 }
    updateDelvePoints(newPoints)
    setTapOutMsg(`${modDef?.name ?? id} point removed`)
  }

  const getDirectionArrow = (guessCoords, correctCoords) => {
    const dx = correctCoords.x - guessCoords.minecraftX
    const dz = correctCoords.z - guessCoords.minecraftZ
    const angle = Math.atan2(dz, dx) * (180 / Math.PI)
    const normalized = (angle + 360) % 360

    if (directionArrows === 0) {
      const arrows = ['→', '→', '↓', '↓', '←', '←', '↑', '↑']
      return arrows[Math.round(normalized / 45) % 8]
    }
    const arrows = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗']
    return arrows[Math.round(normalized / 45) % 8]
  }

  const handleSubmitGuess = () => {
    if (lastSelectedCoords && lastSelectedCoords === selectedCoords) return

    setLastSelectedCoords(selectedCoords)

    const distance = Math.hypot(
      selectedCoords.minecraftX - correctCoords.x,
      selectedCoords.minecraftZ - correctCoords.z
    )

    let msg = ""
    let won = false

    if (distance > 200) {
      msg = "Keep searching!"
    } else if (distance > 50) {
      msg = "Getting close..."
    } else if (distance >= 11 && distance <= 50) {
      msg = "You found the cache!"
      won = true
      mapRef.current?.panToSubmittedGuess(correctCoords, selectedCoords)
    } else if (distance < 11) {
      msg = "Perfect guess! You found the cache!"
      won = true
      mapRef.current?.panToSubmittedGuess(correctCoords, selectedCoords)
    }

    if (won) setHasWon(true)

    const newGuess = {
      guessNumber: numGuesses + 1,
      distance: Math.round(distance),
      message: msg,
      arrow: getDirectionArrow(selectedCoords, correctCoords)
    }

    const updatedHistory = [...guessHistory, newGuess]
    setGuessHistory(updatedHistory)
    setNumGuesses(prev => prev + 1)

    console.log(distance < 50 ? calcTotalPoints(delvePoints) : undefined)

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const existingCaches = cacheResults.filter(r => r.cacheId !== currentCache.id)
    const inProgressCache = {
      cacheId: currentCache.id,
      status: distance < 50 ? 'solved' : 'unsolved',
      guesses: updatedHistory,
      guessCount: numGuesses + 1,
      score: null,
      overlayDismissed: overlayDismissed,
      ...(distance < 50 && {
        delvePointsSnapshot: { ...delvePoints },
        delvePointsTotal: calcTotalPoints(delvePoints),
      }),
    }

    save({
      today: {
        date: todayStr,
        caches: [...existingCaches, inProgressCache],
      }
    })
  }

  const handleNextCacheWithReset = () => {
    setSelectedCoords(null)
    setLastSelectedCoords(null)
    setImageLoaded(false)
    handleNextCache()
  }

  const getDelveImageStyle = () => {
    const filters = []
    const transforms = []
    let opacity = 1

    const DELVE_COLOR_FILTERS = {
      red:    'sepia(1) saturate(3) hue-rotate(0deg)',
      blue:   'sepia(1) saturate(3) hue-rotate(180deg)',
      green:  'sepia(1) saturate(3) hue-rotate(80deg)',
      purple: 'sepia(1) saturate(3) hue-rotate(230deg)',
      orange: 'sepia(1) saturate(3) hue-rotate(20deg)',
      cyan:   'sepia(1) saturate(3) hue-rotate(150deg)',
      yellow: 'sepia(1) saturate(2) hue-rotate(40deg)',
    }

    // existing overlay blur when not dismissed
    if (!overlayDismissed) {
      filters.push('blur(16px) grayscale(100%)')
    }

    if (overlayDismissed) {
      const spectral = delvePoints.spectral ?? 0
      if (spectral > 0) opacity = 1 - (spectral * 0.25)
      if (delvePoints.vengeful > 0) filters.push(DELVE_COLOR_FILTERS[delveColor])
      if (delvePoints.twisted > 0) filters.push('invert(100%)')
      if (delvePoints.astral > 0) transforms.push('scaleY(-1)')

      // only apply colossal here if legionary is not active
      if (!delvePoints.legionary) {
        const colossal = delvePoints.colossal ?? 0
        if (colossal > 0) transforms.push(`scale(${1 + colossal * 0.25})`)
      }
    }

    if (transforms.length === 0) transforms.push('scale(1.05)')

    return {
      filter: filters.length > 0 ? filters.join(' ') : 'none',
      transform: transforms.join(' '),
      opacity,
      transition: 'filter 0.4s ease, opacity 0.4s ease',
    }
  }

  const handleShare = async () => {
    const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' })
    const lines = cacheResults.map((result, i) => {
      const dots = '🌊'.repeat(Math.min(result.guessCount, 10))
      const delveSuffix = result.delvePointsTotal > 0 ? ` ${result.delvePointsTotal}pts` : ''
      return `Cache ${i + 1}: ${dots} (${result.guessCount} ${result.guessCount === 1 ? 'guess' : 'guesses'}${delveSuffix === '' ? '' : ', '}${delveSuffix})`
    })
    const text = `Tovle ${todayStr}\n\n${lines.join('\n')}\n\nPlay at https://tovle.net`

    if (navigator.share) {
      try {
        await navigator.share({text})
      } catch (e) {
        if (e.name !== 'AbortError') showToast('Something went wrong')
      }
    } else {
      await navigator.clipboard.writeText(text)
      showToast('Copied to clipboard!')
    }
  }
  

  return (
    <>
      {!allComplete && <>
        <motion.div layout className="play-layout">
          <motion.div layout className="play-image-col">

            <Dateline />

            {/* {import.meta.env.DEV && ( */}
              <button
                className="cache-entry-button"
                onClick={() => save({
                  upgrades: {
                    ...playerData.upgrades,
                    delveMods: 1,
                  }
                })}
                style={{ marginTop: '8px' }}
              >
                [DEBUG] Unlock Delve Mods
              </button>
            {/* )} */}

            {/* {import.meta.env.DEV && ( */}
              <button
                className="cache-entry-button"
                onClick={() => setShowDelveModal(true)}
                style={{ marginTop: '8px', marginBottom: '16px' }}
              >
                [DEBUG] Open Delve Modal mid-cache
              </button>
            {/* )} */}

            <AnimatePresence mode="popLayout">
              {hasDelve && calcTotalPoints(delvePoints) > 0 && (
                <motion.p
                  key="delve-indicator"
                  className="delve-points-indicator"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  layout
                >
                  <img src={twistedStrand} alt="delve" style={{ width: '16px', height: '16px', imageRendering: 'pixelated', verticalAlign: 'middle', marginRight: '4px' }} />
                  {calcTotalPoints(delvePoints)} delve {calcTotalPoints(delvePoints) === 1 ? 'point' : 'points'} active
                </motion.p>
              )}
            </AnimatePresence>

            <AnimatePresence mode="popLayout">
              {(calcTotalPoints(delvePoints) > 0) && (
                <motion.div
                  key="tap-out"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2 }}
                  layout
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginTop: '16px', marginBottom: '16px' }}
                >
                  <button className="cache-entry-button" onClick={handleTapOut}>
                    Stuck? Remove 1 point at random
                  </button>
                  <AnimatePresence>
                    {tapOutMsg && (
                      <motion.span
                        key="tap-out-msg"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ fontSize: '12px', opacity: 0.6, fontStyle: 'italic' }}
                      >
                        {tapOutMsg}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            <div className={`cache-image-wrapper ${imageLoaded ? '' : 'loading'}`}>
              {delvePoints.legionary > 0 && overlayDismissed ? (
                <div
                  className="delve-legionary-grid"
                  style={{
                    transform: (delvePoints.colossal ?? 0) > 0
                      ? `scale(${1 + delvePoints.colossal * 0.25})`
                      : undefined
                  }}
                >
                  {[0, 1, 2, 3].map(i => (
                    <img
                      key={i}
                      src={cacheImage}
                      className="cache-image"
                      style={getDelveImageStyle()}
                      onLoad={i === 0 ? () => setImageLoaded(true) : undefined}
                    />
                  ))}
                </div>
              ) : (
                <img
                  src={cacheImage}
                  className="cache-image"
                  onLoad={() => setImageLoaded(true)}
                  style={getDelveImageStyle()}
                />
              )}
              {!overlayDismissed && (
                <div
                  className="cache-overlay"
                  style={{
                    opacity: overlayDismissed ? 0 : 1,
                    transition: 'opacity 0.3s ease',
                    pointerEvents: overlayDismissed ? 'none' : 'auto',
                  }}
                >
                  <p className = "cache-overlay-label">Assign Delve Points?</p>
                  <div className = "cache-overlay-buttons">
                    <button
                      className="cache-overlay-btn"
                      onClick={() => {setShowDelveModal(true)}}
                    >
                      Modify ({calcTotalPoints(delvePoints)} pts assigned)
                    </button>
                    <button
                      className="cache-overlay-btn cache-overlay-btn--primary"
                      onClick={() => {
                        //save overlaydismissed and delvepoints to today so refreshing page restores correctly
                        //we save it per cache so we gotta do this whole rigamarole
                        const todayStr = new Date().toLocaleDateString('en-CA', {timeZone: 'America/New_York'})
                        const existingCaches = cacheResults.filter(r => r.cacheId !== currentCache.id)
                        const inProgressCache = {
                          cacheId: currentCache.id,
                          status: 'unsolved',
                          guesses:guessHistory,
                          guessCount: numGuesses,
                          score: null,
                          overlayDismissed: true,
                        }
                        save({
                          today: {
                            date: todayStr,
                            caches: [...existingCaches, inProgressCache],
                            delvePoints: delvePoints,
                          }
                        })
                      }}
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}
              {overlayDismissed && (delvePoints.dreadful ?? 0) > 0 && (
                <div
                  className="delve-vignette"
                  style={{
                    '--vignette-intensity': `${0.6 + (delvePoints.dreadful - 1) / 2 * 0.4}`,
                  }}
                />
              )}
            </div>
            {(currentCache?.subtitle || currentCache?.contributor) && (
              <div className="cache-subtitle">
                {currentCache.subtitle && (
                  <p className="cache-subtitle-text">{currentCache.subtitle}</p>
                )}
                {currentCache.contributor && (
                  <p className="cache-subtitle-contributor">contributed by {currentCache.contributor}</p>
                )}
              </div>
            )}

            
          </motion.div>

          <motion.div layout className="play-map-col">
            <Map
              ref={mapRef}
              selectedCoords={selectedCoords}
              setSelectedCoords={setSelectedCoords}
              correctCoords={hasWon ? correctCoords : null}
            />
          </motion.div>
        </motion.div>

        <Submit
          selectedCoords={selectedCoords}
          handleSubmitGuess={handleSubmitGuess}
          handleNextCache={handleNextCacheWithReset}
          handleComplete={handleComplete}
          guessHistory={guessHistory}
          numGuesses={numGuesses}
          hasWon={hasWon}
          isLastCache={currentCacheIndex === dailyCaches.length - 1}
          dailyCaches={dailyCaches}
          currentCacheIndex={currentCacheIndex}
          allComplete={allComplete}
          distancePrecision={distancePrecision}
        />
      </>}

      {allComplete && <>
        {/* i like how the last cache image shows up at the end so im putting it in again here */}
        {/* it is a feature now not a bug */}
        <div className={`cache-image-wrapper ${imageLoaded ? '' : 'loading'}`}>
          {cacheImage &&
            <img
              src={cacheImage}
              className="cache-image"
              onLoad={() => setImageLoaded(true)}
              style={{ width: 'min(90vw,500px)' }}
            />
          }
        </div>
        {(currentCache?.subtitle || currentCache?.contributor) && (
          <div className="cache-subtitle">
            {currentCache.subtitle && (
              <p className="cache-subtitle-text">{currentCache.subtitle}</p>
            )}
            {currentCache.contributor && (
              <p className="cache-subtitle-contributor">contributed by {currentCache.contributor}</p>
            )}
          </div>
        )}
        <div className="completion-summary">
          <p>You found all {dailyCaches.length} caches today!</p>
          {cacheResults.map((result, i) => (
            <div key={result.cacheId} className="summary-row">
              <span>Cache {i + 1}:</span>
              <span>{result.guessCount} {result.guessCount === 1 ? 'guess!' : 'guesses'}</span>
              {result.delvePointsTotal > 0 && (
                <span className="summary-delve-pts">{result.delvePointsTotal}pts</span>
              )}
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

      {todayStats && (
        <>
          <div className="completion-stats">
            <div className="completion-stat">
              <span className="completion-stat-value">{todayStats.currentStreak}</span>
              <span className="completion-stat-label">day streak</span>
            </div>
            <div className="completion-stat">
              <span className="completion-stat-value">{todayStats.bestStreak}</span>
              <span className="completion-stat-label">best streak</span>
            </div>
            <div className="completion-stat">
              <span className="completion-stat-value">{todayStats.totalCachesSolved}</span>
              <span className="completion-stat-label">caches found</span>
            </div>
            <div className="completion-stat">
              <span className="completion-stat-value">{todayStats.averageGuesses}</span>
              <span className="completion-stat-label">avg guesses</span>
            </div>
          </div>
          <p style={{ marginTop: '16px' }}>See full statistics on the info page.</p>
        </>
      )}

      {showDelveModal && (
        <DelveModal
          delvePoints={delvePoints}
          setDelvePoints={updateDelvePoints}
          onClose={() => setShowDelveModal(false)}
          onSaveDefaults={() => {
            save({ upgrades: { ...playerData.upgrades, delveDefaults: delvePoints } })
            setShowDelveModal(false)
          }}
        />
      )}


      {toast && (
        <div className="toast">
          {toast}
        </div>
      )}
    </>
  )
}

export default PlayTab