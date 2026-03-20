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
  isLastCache
}) => {
  const hasGuesses = guessHistory.length > 0

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
  const isDisabled = !selectedCoords || (!hasWon && !selectedCoords)

  return (
    <div className="coords-wrapper">
      <div className="coords-display">
        <p>
          <strong>Selected:</strong>{' '}
          {selectedCoords ? `X ${selectedCoords.minecraftX}, Z ${selectedCoords.minecraftZ}` : 'X ..., Z ...'}
        </p>
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
              <p>{guess.distance} blocks away.</p>
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