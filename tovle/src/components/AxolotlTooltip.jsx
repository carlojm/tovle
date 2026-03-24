import { useState } from 'react'
import './AxolotlTooltip.css'
import { Info } from 'lucide-react'

const AxolotlTooltip = () => {
  const [visible, setVisible] = useState(false)

  return (
    <span className="axolotl-tooltip-anchor">
      <Info
        className="axolotl-tooltip-icon"
        size={16}
        // onClick={() => setVisible(v => !v)}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      />
      {visible && (
        <span className="axolotl-tooltip-box loot-tooltip">
          Axolotls find an extra cache every day. Leveling them gives a chance to find multiple caches per day. Axolotl caches have a different loot pool, including some unique items like torn canvas.
        </span>
      )}
    </span>
  )
}

export default AxolotlTooltip