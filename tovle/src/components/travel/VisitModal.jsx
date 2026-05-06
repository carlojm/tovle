import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlayer } from '../../context/PlayerContext'
import { TOWN_CONFIG } from '../../data/townConfig'
import { resolveEntryNode, resolveText } from '../../utils/dialogueUtils'
import { NYRA_DIALOGUE, NYRA_CONDITIONS } from '../../data/dialogue/nyra'
import npcPlaceholder from '../../assets/npcs/nyra.png'
import './VisitModal.css'

// map npc id to dialogue data and conditions
const NPC_DIALOGUE = {
  nyra: { dialogue: NYRA_DIALOGUE, conditions: NYRA_CONDITIONS }
}


const VisitModal = ({ townId, onClose, onViewMap }) => {
  const { playerData, save } = usePlayer()
  const config = TOWN_CONFIG[townId]
  const flags = playerData?.travel?.dialogueFlags ?? {}

  const [mode, setMode] = useState('browse') //switch between browse and talk
  const [activeNpc, setActiveNpc] = useState(null)
  const [currentNode, setCurrentNode] = useState(null)
  
  const isDark = !document.documentElement.classList.contains('light')

  const activeBanner = (() => {
    if (mode === 'talk' && activeNpc?.banner) return activeNpc.banner
    return isDark ? config.bannerDark : config.bannerLight
  })()

  if (!config) return null

  const handleTalk = (npc) => {
    const { dialogue, conditions } = NPC_DIALOGUE[npc.id] ?? {}
    if (!dialogue) return

    const entryNode = resolveEntryNode(dialogue, conditions, playerData, flags)
    const node = dialogue.nodes[entryNode]

    // set flag if needed
    if (node.setsFlag) {
      save({
        travel: {
          ...playerData?.travel,
          dialogueFlags: { ...flags, [node.setsFlag]: true }
        }
      })
    }

    setActiveNpc({ ...npc, dialogue, conditions })
    setCurrentNode(entryNode)
    setMode('talk')
  }

  const handleOption = (option) => {
    if (option.next === null) {
      handleBack()
      return
    }

    const node = activeNpc.dialogue.nodes[option.next]
    if (!node) return

    // set flag if needed
    if (node.setsFlag) {
      save({
        travel: {
          ...playerData?.travel,
          dialogueFlags: { ...flags, [node.setsFlag]: true }
        }
      })
    }

    setCurrentNode(option.next)
  }

  const handleBack = () => {
    setMode('browse')
    setActiveNpc(null)
    setCurrentNode(null)
  }

  const currentNodeData = activeNpc && currentNode
    ? activeNpc.dialogue.nodes[currentNode]
    : null

  return (
    <div className="visit-backdrop" onClick={onClose}>
      <motion.div
        className="visit-modal"
        layout
        // transition={{ layout: { duration: 0.25, ease: 'easeInOut' } }} //transition when resizing
        onClick={e => e.stopPropagation()}
      >
        
        <AnimatePresence>
          {mode === 'talk' && (
            <motion.img
              src={npcPlaceholder}
              className="visit-npc-image"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
            />
          )}
        </AnimatePresence>

        {/* banner */}
        <motion.div
          className="visit-banner"
          layout
          // style={{
          //   backgroundImage: `url(${activeBanner})`,
          //   backgroundSize: 'cover',
          //   backgroundPosition: 'center',
          // }}
        >
          {/* base banner — always rendered */}
          <div
            className="visit-banner-bg"
            style={{
              backgroundImage: `url(${isDark ? config.bannerDark : config.bannerLight})`,
            }}
          />

          {/* talk banner — fades in over base when in talk mode */}
          <AnimatePresence>
            {mode === 'talk' && activeNpc?.banner && (
              <motion.div
                className="visit-banner-bg"
                style={{ backgroundImage: `url(${activeNpc.banner})` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              />
            )}
          </AnimatePresence>

          {/* back button + close button */}
          <div className="visit-banner-btns">
            <AnimatePresence>
              {mode === 'talk' && (
                <motion.button
                  className="visit-back-btn"
                  onClick={handleBack}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  ←
                </motion.button>
              )}
            </AnimatePresence>
            <button className="visit-close-btn" onClick={onClose}>×</button>
          </div>

          {/* town info — only in browse mode */}
          <AnimatePresence>
            {mode === 'browse' && (
              <motion.div
                className="visit-banner-text"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="visit-town-name">{config.name}</h2>
                <p className="visit-town-coords">x: {config.coordinates.x}, z: {config.coordinates.z}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* body */}
        <motion.div
          className="visit-body"
          layout
          
        >
          <AnimatePresence mode="wait">

            {/* browse mode */}
            {mode === 'browse' && (
              <motion.div
                key="browse"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="visit-browse"
              >
                <p className="visit-description">{config.description}</p>

                {config.npcs?.map(npc => (
                  <div key={npc.id} className="visit-npc-card">
                    <div className="visit-npc-header">
                      <span className="visit-npc-name">{npc.name}</span>
                      <span className="visit-npc-title">{npc.title}</span>
                    </div>
                    <p className="visit-npc-desc">{npc.description}</p>
                    <div className="visit-npc-actions">
                      {npc.actions.map(action => (
                        <button
                          key={action.id}
                          className="visit-npc-btn"
                          onClick={() => {
                            if (action.id === 'talk') handleTalk(npc)
                            if (action.id === 'view_map') onViewMap()
                          }}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* talk mode */}
            {mode === 'talk' && currentNodeData && (
              <motion.div
                key="talk"
                layoutId="dialogue-card"
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ layout: { duration: 0.3, ease: 'easeInOut' } }}
                className="visit-dialogue-card"
              >
                <span className="visit-dialogue-speaker">{currentNodeData.speaker}</span>

                <AnimatePresence mode="wait">
                  <motion.p
                    key={currentNode}
                    layout
                    className="visit-dialogue-text"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3 }}
                  >
                    {resolveText(currentNodeData.text, playerData)}
                  </motion.p>
                </AnimatePresence>

                <div className="visit-dialogue-options">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentNode + '_options'}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {currentNodeData.options.map((option, i) => (
                        <button
                          key={i}
                          className="visit-dialogue-option"
                          onClick={() => handleOption(option)}
                        >
                          &gt; {option.label}
                        </button>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>

      </motion.div>
    </div>
  )
}

export default VisitModal