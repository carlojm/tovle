const Submit = ({selectedCoords, handleSubmitGuess}) => {
  if (!selectedCoords) {
    return (
      <div className="coords-wrapper">
        <button className="disable-button">Search Area</button>
        <div className="coords-display">
          <p><strong>Selected:</strong> X ..., Z ...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="coords-wrapper">
      <button onClick={handleSubmitGuess} className="submit-button">Search Area</button>
      <div className="coords-display">
        <p><strong>Selected:</strong> X {selectedCoords.minecraftX}, Z {selectedCoords.minecraftZ}</p>
      </div>
    </div>
  )
}

export default Submit