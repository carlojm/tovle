import { useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { restoreWithUid } from '../firebase/auth'
import { KeyRound, ClipboardCopy, ShieldAlert } from 'lucide-react'
// import './Info.css'
import './DataTab.css'

const DataTab = () => {
  const { uid } = usePlayer()
  const [input, setInput] = useState('')
  const [status, setStatus] = useState(null) // null | 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [uidVisible, setUidVisible] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(uid)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRestore = async () => {
    const trimmed = input.trim()
    if (!trimmed || trimmed === uid) return
    setStatus('loading')
    setErrorMsg('')
    try {
      await restoreWithUid(trimmed)
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err.message)
    }
  }

  return (
    <div className="info-page-layout">
      <div className="info-box">
        <h1>Your Save Data</h1>

        <div className="info-row">
          <KeyRound size={20} color="var(--color-text)" />
          <p>
            Your progress is tied to a unique ID stored in your browser.
            If you clear your cache or switch devices, you can use this ID to restore your data.
          </p>
        </div>

        <div className="info-row">
          <ClipboardCopy size={20} color="var(--color-text)" />
          <p>
            <strong>Copy your UID and keep it somewhere safe.</strong> Do not share it.
            This is currently the only way to recover your data.
          </p>
        </div>

        <div className="data-uid-display">
          <span className="data-uid-text">
            {uidVisible ? uid : '••••••••'}
          </span>
          <button className="data-uid-copy-btn" onClick={() => setUidVisible(v => !v)}>
            {uidVisible ? 'Hide' : 'Show'}
          </button>
          <button className="data-uid-copy-btn" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <h1>Restore on This Device</h1>

        <div className="info-row">
          <ShieldAlert size={20} color="var(--color-text)" />
          <p>
            Pasting a UID here will replace your current save on this device.
            Make sure you copy your current UID above before restoring if you want to keep it.
          </p>
        </div>

        <div className="data-restore">
          <input
            className="data-restore-input"
            type="text"
            placeholder="Paste UID here"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={status === 'loading' || status === 'success'}
          />
          <button
            className="data-restore-btn"
            onClick={handleRestore}
            disabled={!input.trim() || input.trim() === uid || status === 'loading' || status === 'success'}
          >
            {status === 'loading' ? 'Restoring...' : 'Restore'}
          </button>
          {status === 'error' && <p className="data-status data-status--error">{errorMsg}</p>}
          {status === 'success' && <p className="data-status data-status--success">Restored! Reloading your data...</p>}
        </div>

      </div>
    </div>
  )
}

export default DataTab