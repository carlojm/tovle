import './Submit.css'

const placeholder_message = "The cache is ... blocks away."

const Submit = ({selectedCoords, handleSubmitGuess, message, numGuesses, hasWon}) => {
  if (!selectedCoords) {
    return (
      <div className="coords-wrapper">
        <div className="coords-display">
          <p><strong>Selected:</strong> X ..., Z ...</p>
          <p><strong>Attempts:</strong> {numGuesses}</p>
        </div>
        <button className="submit-button disable-button">Search Area</button>
        <div className="answer-message">
          <p>{placeholder_message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="coords-wrapper">
      <div className="coords-display">
        <p><strong>Selected:</strong> X {selectedCoords.minecraftX}, Z {selectedCoords.minecraftZ}</p>
        <p><strong>Attempts:</strong> {numGuesses}</p>
      </div>
      <button
        onClick={hasWon ? null : handleSubmitGuess}
        className={`submit-button ${hasWon ? 'disable-button' : ''}`}
      >Search Area</button>
      <div className="answer-message">
        {message && (
          <p>{message}</p>
        )}
        {message === null && (
          <p>{placeholder_message}</p>
        )}
        
      </div>
    </div>
  )
}

export default Submit