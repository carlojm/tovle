import { useState } from 'react'
import './CombatLog.css'

export default function CombatLog({ log }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="cl-container">
      <button className="cl-toggle" onClick={() => setOpen(o => !o)}>
        <span>Combat Log</span>
        <span className="cl-toggle-right">
          <span className="cl-latest">{log[log.length - 1] ?? '—'}</span>
          <span className="cl-chevron">{open ? '▴' : '▾'}</span>
        </span>
      </button>

      {open && (
        <div className="cl-entries">
          {[...log].reverse().map((entry, i) => (
            <div key={i} className={`cl-entry ${i === 0 ? 'cl-entry--latest' : ''}`}>
              {entry}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}