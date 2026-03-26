import { cache, useState } from 'react'
import Dateline from './Dateline'
import Map from './Map'
import Submit from './Submit'
import './Playtab.css'

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

  const hasDelve = playerData?.upgrades?.delveMods === 1 ?? false

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

    if (distance > 100) {
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

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const existingCaches = cacheResults.filter(r => r.cacheId !== currentCache.id)
    const inProgressCache = {
      cacheId: currentCache.id,
      status: distance < 50 ? 'solved' : 'unsolved',
      guesses: updatedHistory,
      guessCount: numGuesses + 1,
      score: null,
      overlayDismissed: overlayDismissed,
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

  const handleShare = () => {
    const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' })
    const lines = cacheResults.map((result, i) => {
      const dots = '🌊'.repeat(Math.min(result.guessCount, 10))
      return `Cache ${i + 1}: ${dots} (${result.guessCount} ${result.guessCount === 1 ? 'guess' : 'guesses'})`
    })
    const text = `Tovle ${todayStr}\n\n${lines.join('\n')}\n\nPlay at https://tovle.net`
    navigator.clipboard.writeText(text).then(() => alert('Copied to clipboard!'))
  }

  return (
    <>
      {!allComplete && <>
        <div className="play-layout">
          <div className="play-image-col">
            <Dateline />
            <div className={`cache-image-wrapper ${imageLoaded ? '' : 'loading'}`}>
              {cacheImage && 
                <img
                  src={cacheImage}
                  className="cache-image"
                  onLoad={() => setImageLoaded(true)}
                  style={{
                    filter: overlayDismissed ? 'none' : 'blur(20px) grayscale(100%)',
                    transition: 'filter 0.4s ease',
                    transform: 'scale(1.05)',
                  }}
                />
              }
              {!overlayDismissed && (
                <div
                  className="cache-overlay"
                  style={{
                    opacity: overlayDismissed ? 0 : 1,
                    transition: 'opacity 0.3s ease',
                    pointerEvents: overlayDismissed ? 'none' : 'auto',
                  }}
                >
                  <p className = "cache-overlay-label">Delve Points Active</p>
                  <div className = "cache-overlay-buttons">
                    <button
                      className="cache-overlay-btn"
                      onClick={() => {/*TODO open modal*/}}
                    >
                      Modify (0 pts assigned)
                    </button>
                    <button
                      className="cache-overlay-btn cache-overlay-btn--primary"
                      onClick={() => {
                        //save overlaydismissed to today so refreshing page restores correctly
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
                            caches: [...existingCaches, inProgressCache]
                          }
                        })
                      }}
                    >
                      Continue
                    </button>
                  </div>
                </div>
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
          </div>

          <div className="play-map-col">
            <Map
              ref={mapRef}
              selectedCoords={selectedCoords}
              setSelectedCoords={setSelectedCoords}
              correctCoords={hasWon ? correctCoords : null}
            />
          </div>
        </div>

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
    </>
  )
}

export default PlayTab