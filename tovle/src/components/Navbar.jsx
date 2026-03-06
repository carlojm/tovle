import { useState } from 'react'
import { createPortal } from 'react-dom'
import './Navbar.css'
import {Sun, Moon} from 'lucide-react'

export default function Navbar({theme, onToggleTheme}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="navbar">
      <span className="navbar-title">Tovle</span>
      <div className="navbar-buttons">
        <button className="theme-toggle" onClick={onToggleTheme}>
          {theme === 'dark' ? <Sun size={20} color="var(--color-text" /> : <Moon size={20} color="var(--color-text" />}
        </button>
        <button className={`hamburger ${menuOpen ? 'hamburger--open' : ''}`} onClick={() => setMenuOpen(!menuOpen)}>
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
      {menuOpen && createPortal(
        <div className="navbar-menu">
          <a href="#">How to play</a>
          <a href="#">Inventory</a>
          <a href="#">Log in</a>
        </div>,
        document.body
      )}
    </nav>
  )
}