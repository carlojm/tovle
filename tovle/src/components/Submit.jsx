import './Submit.css'
import {Fragment, useState, useEffect} from 'react'

import { AnimatePresence, motion } from 'framer-motion'

const placeholder_message = "The cache is ... blocks away."

const PERNICIOUS_SYMBOLS = ['X', '?', '!', '#']
const applyPernicious = (str, level) => {
  if (!level) return str
  const chance = level === 1 ? 0.3 : 0.75
  return str.split('').map(char => {
    if (/\d/.test(char) && Math.random() < chance) {
      return PERNICIOUS_SYMBOLS[Math.floor(Math.random() * PERNICIOUS_SYMBOLS.length)]
    }
    return char
  }).join('')
}

const TormentedArrow = ({ arrow, level }) => {
  if (!level) return <>{arrow}</>
  const className = level === 1 ? 'tormented-arrow--slight' : 'tormented-arrow--heavy'
  const duration = level === 1 ? 3 : 6
  const delay = -(Math.random() * duration)
  return <span className={`tormented-arrow ${className}`} style={{ animationDelay: `${delay}s` }}>{arrow}</span>
}

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
  distancePrecision,
  delvePoints
}) => {
  const hasGuesses = guessHistory.length > 0

  const tormentedLevel = delvePoints?.tormented ?? 0
  const perniciousLevel = delvePoints?.pernicious ?? 0

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

  const buttonLabel = !hasWon ? 'Search Area'
    : isLastCache ? 'Complete'
    : 'Next Cache'

  const isDisabled = buttonLabel === 'Search Area' && !selectedCoords

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

        <AnimatePresence mode="wait">
          {hasGuesses && (
            <motion.p
              key={guessHistory.length}
              className="latest-hint"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
            >
              {/* {getDisplayDistance(guessHistory.at(-1).distance, distancePrecision)} {guessHistory.at(-1).arrow} */}
              {applyPernicious(getDisplayDistance(guessHistory.at(-1).distance, distancePrecision), perniciousLevel)}{' '}
              <TormentedArrow arrow={guessHistory.at(-1).arrow} level={tormentedLevel} />
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <motion.button
        layout
        onClick={isDisabled ? null : handlePrimaryAction}
        className={`submit-button ${isDisabled ? 'disable-button' : ''}`}
      >
        {buttonLabel}
      </motion.button>

      <div className="answer-message">
        {!hasGuesses && <p className="answer-log">{placeholder_message}</p>}
        <div className="answer-log">
          {[...guessHistory].slice(-10).reverse().map((guess) => (
            <Fragment key={guess.guessNumber}>
              <p><strong>#{guess.guessNumber}</strong></p>
              <p>{applyPernicious(getDisplayDistance(guess.distance, distancePrecision), perniciousLevel)}</p>
              <p>{guess.message}</p>
              <p><TormentedArrow arrow={guess.arrow} level={tormentedLevel} /></p>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Submit