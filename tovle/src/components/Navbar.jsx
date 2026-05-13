import { useState } from 'react'
import { createPortal } from 'react-dom'
import './Navbar.css'
import { Sun, Moon } from 'lucide-react'
import Logo from './Logo'

import { motion, AnimatePresence } from 'framer-motion'
import { usePlayer } from '../context/PlayerContext'
import denPieceImg from '../assets/den_piece.png'


export default function Navbar({ theme, onToggleTheme, onNavigate }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const { playerData } = usePlayer() 
  const denPieces = playerData?.inventory?.currencies?.denPieces ?? 0

  function handleNavigate(tabId) {
    onNavigate(tabId)
    setMenuOpen(false)
  }

  return (
    <nav className="navbar">
      <Logo />
      {import.meta.env.VITE_BETA === '1' && (
        <h1>BETA</h1>
      )}
      <div className="navbar-buttons">

        {/* den piece chip — only shown when player has any */}
        <AnimatePresence>
          {denPieces > 0 && (
            <motion.div
              className="den-chip"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <img src={denPieceImg} alt="den pieces" className="den-chip-icon" />
              {/* key on denPieces so the number pops every time it changes */}
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={denPieces}
                  className="den-chip-count"
                  initial={{ opacity: 0, y: -6, scale: 1.3 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.8 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  {denPieces.toLocaleString()}
                </motion.span>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        <button className="theme-toggle" onClick={onToggleTheme}>
          {theme === 'dark'
            ? <Sun size={20} color="var(--color-text-button" />
            : <Moon size={20} color="var(--color-text-button" />}
        </button>
        <button
          className={`hamburger ${menuOpen ? 'hamburger--open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
      {menuOpen && createPortal(
        <div className="navbar-menu">
          <button className="navbar-menu-btn" onClick={() => handleNavigate('info')}>Info</button>
          <button className="navbar-menu-btn" onClick={() => handleNavigate('collection')}>Collection</button>
          <button className="navbar-menu-btn" onClick={() => handleNavigate('data')}>Save Data</button>
        </div>,
        document.body
      )}
    </nav>
  )
}