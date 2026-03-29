import { useState } from 'react'
import { createPortal } from 'react-dom'
import './Navbar.css'
import { Sun, Moon } from 'lucide-react'
import Logo from './Logo'

export default function Navbar({ theme, onToggleTheme, onNavigate }) {
  const [menuOpen, setMenuOpen] = useState(false)

  function handleNavigate(tabId) {
    onNavigate(tabId)
    setMenuOpen(false)
  }

  return (
    <nav className="navbar">
      <Logo />
      <div className="navbar-buttons">
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
          <button className="navbar-menu-btn" onClick={() => handleNavigate('data')}>Save Data</button>
        </div>,
        document.body
      )}
    </nav>
  )
}