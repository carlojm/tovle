import './Submit.css'

const placeholder_message = "The cache is ... blocks away."

const Submit = ({selectedCoords, handleSubmitGuess, guessHistory, numGuesses, hasWon}) => {
  const hasGuesses = guessHistory.length > 0

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
        onClick={!selectedCoords || hasWon ? null : handleSubmitGuess}
        className={`submit-button ${!selectedCoords || hasWon ? 'disable-button' : ''}`}
      >
        Search Area
      </button>

      <div className="answer-message">
        {!hasGuesses && <p className="answer-log">{placeholder_message}</p>}
        <div className="answer-log">
          {[...guessHistory].slice(-10).reverse().map((guess) => (
            <>
              <p key={`num-${guess.guessNumber}`}>   <strong>#{guess.guessNumber}</strong></p>
              <p key={`dist-${guess.guessNumber}`}>  {guess.distance} blocks away.</p>
              <p key={`msg-${guess.guessNumber}`}>   {guess.message}</p>
              <p key={`arrow-${guess.guessNumber}`}> {guess.arrow}</p>
            </>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Submit