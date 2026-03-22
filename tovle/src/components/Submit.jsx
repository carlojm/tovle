import './Submit.css'
import {Fragment} from 'react'

const placeholder_message = "The cache is ... blocks away."

const Submit = ({
  selectedCoords,
  handleSubmitGuess,
  handleNextCache,
  handleComplete,
  guessHistory,
  numGuesses,
  hasWon,
  isLastCache,
  dailyCaches, currentCacheIndex, allComplete,
  distancePrecision
}) => {

  const hasGuesses = guessHistory.length > 0

  const cacheProgress = allComplete
  ? `${dailyCaches.length}/${dailyCaches.length}`
  : `${currentCacheIndex + 1}/${dailyCaches.length}`

  const handlePrimaryAction = () => {
    if (!hasWon) {
      handleSubmitGuess()
    } else if (isLastCache) {
      handleComplete()
    } else {
      handleNextCache()
    }
  }

  const buttonLabel = !hasWon ? 'Search Area' : isLastCache ? 'Complete' : 'Next Cache'
  const isDisabled = buttonLabel !== 'Search Area' ? false
    : !selectedCoords || (!hasWon && !selectedCoords)

  const getDisplayDistance = (distance, precision) => {
    if (distance <= 50) return `${distance} blocks away`

    if (precision === 0) {
      const lo = Math.max(50, Math.round((distance - 100) / 100) * 100)
      const hi = Math.round((distance + 100) / 100) * 100
      return `${lo}-${hi} blocks away`
    } else if (precision === 1) {
      const rounded = Math.round(distance / 100) * 100
      return `~${rounded} blocks away`
    } else if (precision === 2) {
      const rounded = Math.round(distance / 10) * 10
      return `~${rounded} blocks away`
    } else {
      return `${distance} blocks away`
    }
  }
  
  return (
    <div className="coords-wrapper">
      <div className="coords-display">
        <p className="selected-text">
          <strong>Selected:</strong>{' '}
          {selectedCoords ? `X ${selectedCoords.minecraftX}, Z ${selectedCoords.minecraftZ}` : 'X ..., Z ...'}
        </p>
        
        {dailyCaches.length > 0 && (
          <p><strong>Cache:</strong> {cacheProgress}</p>
        )}

        <p><strong>Attempts:</strong> {numGuesses}</p>
      </div>

      <button
        onClick={isDisabled ? null : handlePrimaryAction}
        className={`submit-button ${isDisabled ? 'disable-button' : ''}`}
      >
        {buttonLabel}
      </button>

      <div className="answer-message">
        {!hasGuesses && <p className="answer-log">{placeholder_message}</p>}
        <div className="answer-log">
          {[...guessHistory].slice(-10).reverse().map((guess) => (
            <Fragment key={guess.guessNumber}>
              <p><strong>#{guess.guessNumber}</strong></p>
              <p>{getDisplayDistance(guess.distance, distancePrecision)}</p>
              <p>{guess.message}</p>
              <p>{guess.arrow}</p>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Submit