import { useState } from 'react'
import { createPortal } from 'react-dom'
import './Navbar.css'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="navbar">
      <span className="navbar-title">Tovle</span>
      <button className={`hamburger ${menuOpen ? 'hamburger--open' : ''}`} onClick={() => setMenuOpen(!menuOpen)}>
        <span></span>
        <span></span>
        <span></span>
      </button>
      {menuOpen && createPortal(
        <div className="navbar-menu">
          <a href="#">How to play</a>
          <a href="#">About</a>
        </div>,
        document.body
      )}
    </nav>
  )
}